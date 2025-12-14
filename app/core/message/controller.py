import os
import time
import json
import threading
import roslibpy
from dotenv import load_dotenv

from core.websocket.client import WebSocketClient
from core.ros.listener import RosListener
from core.ros.publisher import RosPublisher
from message.message_builder import build_message
from message.data_processor import process_ros_data


class WASDController:
    # ROS ↔ Server(WebSocket) 브릿지 컨트롤러
    def __init__(self):
        load_dotenv()

        # 환경변수
        self.default_ros_host = os.getenv("ROS_HOST")
        self.ROS_PORT = int(os.getenv("ROS_PORT", "9090"))
        self.SERVER_WS = os.getenv("SERVER_WS") or os.getenv("EC2_WS")

        # Server WebSocket 클라이언트
        self.ws = WebSocketClient(self.SERVER_WS)

        # ROS 연결 객체/스레드/핸들러
        self.ros: roslibpy.Ros | None = None
        self.ros_thread: threading.Thread | None = None
        self.ros_listener: RosListener | None = None
        self.ros_pub: RosPublisher | None = None

        # 로봇 상태
        self.robot_name: str | None = None
        self.robot_ip: str | None = self.default_ros_host
        self.connected: bool = False

        # 전송 최적화 캐시
        self.last_send_time = 0.0
        self.last_odom = None

    # ROS 연결 시작 (성공 시 self.ros 갱신)
    def _start_ros(self, host: str) -> bool:
        if not host:
            print("[ROS] 호스트가 비어있음")
            self.connected = False
            return False

        print(f"[ROS] Connecting to {host}:{self.ROS_PORT} ...")

        ros = roslibpy.Ros(host=host, port=self.ROS_PORT)

        def _run():
            try:
                ros.run()
            except Exception as e:
                print(f"[ROS] ros.run 종료: {e}")

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

        timeout = time.time() + 5
        while not ros.is_connected and time.time() < timeout:
            time.sleep(0.1)

        if not ros.is_connected:
            print(f"[ERROR] ROS 연결 실패 ({host})")
            return False

        print(f"[ROS] Connected to {host}:{self.ROS_PORT} ✅")

        self.ros = ros
        self.ros_thread = thread
        self.robot_ip = host
        self.connected = True
        return True

    # ROS 연결/리스너/퍼블리셔 정리
    def _stop_ros(self):
        print("[ROS] 기존 연결 정리")

        if self.ros_listener:
            try:
                self.ros_listener.close()
            except Exception:
                pass
            self.ros_listener = None

        if self.ros_pub:
            try:
                self.ros_pub.close()
            except Exception:
                pass
            self.ros_pub = None

        if self.ros:
            try:
                if self.ros.is_connected:
                    self.ros.terminate()
            except Exception:
                pass
            self.ros = None

        self.connected = False

    # 기본 ROS 연결
    def connect_ros(self, host: str, name: str | None = None):
        self._stop_ros()
        ok = self._start_ros(host)

        if name:
            self.robot_name = name

        if ok:
            self._setup_listeners_and_publishers()
            print(f"[ROS] 기본 연결 완료 → {host}:{self.ROS_PORT}")
        else:
            print(f"[ROS] 기본 연결 실패 → {host}:{self.ROS_PORT}")

        self.send_status()

    # ROS 토픽 구독 + 퍼블리셔 생성
    def _setup_listeners_and_publishers(self):
        if not self.ros or not self.ros.is_connected:
            return

        self.ros_listener = RosListener(self.ros, callback=self.on_ros_data)
        self.ros_pub = RosPublisher(self.ros)

        topics = [
            "/odom",
            "/battery_state",
            "/cmd_vel",
            "/amcl_pose",
            "/base_link",
            "/nav",
            "/teleop_key",
            "/diagnostics",
            "/camera",
        ]

        for t in topics:
            try:
                self.ros_listener.subscribe(t)
            except Exception as e:
                print(f"[ROS] 토픽 구독 실패 {t}: {e}")

    # Server로 상태 전송
    def send_status(self):
        msg = {
            "type": "status",
            "payload": {
                "robot_name": self.robot_name or "unknown",
                "ip": self.robot_ip,
                "connected": bool(self.connected),
            },
        }
        self.ws.send(msg)

    # 1초마다 상태 전송 루프
    def start_status_loop(self):
        def _loop():
            while True:
                self.send_status()
                time.sleep(1)

        threading.Thread(target=_loop, daemon=True).start()

    # ROS 수신 → 데이터 가공 → Server 전송
    def on_ros_data(self, topic_name, msg):
        data = process_ros_data(topic_name, msg)
        if not data:
            return

        if data.get("type") == "odom":
            now = time.time()
            if data != self.last_odom and now - self.last_send_time > 0.5:
                self.ws.send(build_message("odom", data))
                self.last_odom = data
                self.last_send_time = now
            return

        if topic_name in ["/battery", "/battery_state", "battery"]:
            level = data.get("level") or data.get("percentage")
            if level is None:
                return

            if level <= 1:
                level *= 100.0

            self.ws.send(
                build_message(
                    "battery",
                    {
                        "robot_name": self.robot_name or "unknown",
                        "level": float(level),
                    },
                )
            )

    # ROS 연결 상태 변화 감지 → 상태 전송
    def monitor_ros_connection(self):
        def _loop():
            prev = None
            while True:
                current = bool(self.ros and self.ros.is_connected)
                if current != prev:
                    self.connected = current
                    self.send_status()
                    prev = current
                time.sleep(2)

        threading.Thread(target=_loop, daemon=True).start()

    # 메인 루프
    def run(self):
        if not self.SERVER_WS:
            print("[ERROR] SERVER_WS 환경변수가 비어있음")
            return

        self.ws.connect()
        print("[WASD] Controller running...")

        if self.default_ros_host:
            print(f"[INIT] 기본 ROS_HOST={self.default_ros_host} 연결 시도")
            self.connect_ros(self.default_ros_host)

        self.start_status_loop()
        self.monitor_ros_connection()

        try:
            while True:
                raw = self.ws.receive()
                if not raw or not raw.startswith("{"):
                    continue

                msg = json.loads(raw)
                mtype = msg.get("type")

                if mtype == "connect_robot":
                    payload = msg.get("payload", {})
                    name = payload.get("name") or "unknown"
                    ip = payload.get("ip")
                    if not ip:
                        continue

                    print(f"[SERVER] 로봇 변경 요청 수신 → {name} ({ip})")

                    self._stop_ros()
                    time.sleep(0.5)

                    ok = self._start_ros(ip)

                    self.robot_name = name
                    self.robot_ip = ip
                    self.connected = ok

                    if ok:
                        self._setup_listeners_and_publishers()
                        print(f"[ROS] {name} 연결 완료 → {ip}:{self.ROS_PORT}")
                    else:
                        print(f"[ROS] {name} 연결 실패 → {ip}:{self.ROS_PORT}")

                    self.send_status()
                    continue

                if mtype == "control" and "payload" in msg:
                    cmd = msg["payload"].get("command")
                    if self.ros_pub and cmd:
                        self.ros_pub.publish_command(cmd)

        except KeyboardInterrupt:
            print("[WASD] 종료 중...")
            self._stop_ros()