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
    """ROS ↔ EC2 WebSocket 브릿지 컨트롤러"""

    def __init__(self):
        load_dotenv()

        # 환경변수
        self.default_ros_host = os.getenv("ROS_HOST")
        self.ROS_PORT = int(os.getenv("ROS_PORT", "9090"))
        self.EC2_WS = os.getenv("EC2_WS")

        # 통신 객체
        self.ws = WebSocketClient(self.EC2_WS)

        # ROS 관련
        self.ros: roslibpy.Ros | None = None
        self.ros_thread: threading.Thread | None = None
        self.ros_listener: RosListener | None = None
        self.ros_pub: RosPublisher | None = None

        # 상태
        self.robot_name: str | None = None
        self.robot_ip: str | None = self.default_ros_host
        self.connected: bool = False

        # 전송 최적화
        self.last_send_time = 0.0
        self.last_odom = None

    # =========================
    # ROS 연결 관리 (레이스 방지 버전)
    # =========================
    def _start_ros(self, host: str) -> bool:
        """지정 host로 새 ROS 연결 시도. 성공 시 self.ros 갱신."""
        if not host:
            print("[ROS] 호스트가 비어있음")
            self.connected = False
            return False

        print(f"[ROS] Connecting to {host}:{self.ROS_PORT} ...")

        # 새 인스턴스를 로컬 변수로 관리 (스레드와 self 분리)
        ros = roslibpy.Ros(host=host, port=self.ROS_PORT)

        def _run():
            try:
                ros.run()
            except Exception as e:
                print(f"[ROS] ros.run 종료: {e}")

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

        # 연결 대기
        timeout = time.time() + 5
        while not ros.is_connected and time.time() < timeout:
            time.sleep(0.1)

        if not ros.is_connected:
            print(f"[ERROR] ROS 연결 실패 ({host})")
            return False

        print(f"[ROS] Connected to {host}:{self.ROS_PORT} ✅")

        # 여기서야 self에 반영 (성공한 경우에만)
        self.ros = ros
        self.ros_thread = thread
        self.robot_ip = host
        self.connected = True
        return True

    def _stop_ros(self):
        """기존 ROS 연결/리스너/퍼블리셔 정리 (안전하게)"""
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
        # 여기서 send_status 안 보냄 → 새 연결 결과로만 상태를 알리도록

    def connect_ros(self, host: str, name: str | None = None):
        """초기 기본 연결용 래퍼"""
        self._stop_ros()
        ok = self._start_ros(host)

        if name:
            self.robot_name = name

        # 상태 전송 + 리스너 세팅
        if ok:
            self._setup_listeners_and_publishers()
            print(f"[ROS] 기본 연결 완료 → {host}:{self.ROS_PORT}")
        else:
            print(f"[ROS] 기본 연결 실패 → {host}:{self.ROS_PORT}")

        self.send_status()

    def _setup_listeners_and_publishers(self):
        """ROS 연결 후 리스너/퍼블리셔 설정"""
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

    # =========================
    # 상태 전송
    # =========================
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

    def start_status_loop(self):
        def _loop():
            while True:
                self.send_status()
                time.sleep(1)
        threading.Thread(target=_loop, daemon=True).start()

    # =========================
    # ROS → EC2 데이터 처리
    # =========================
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

        elif topic_name in ["/battery", "/battery_state", "battery"]:
            level = data.get("level") or data.get("percentage")
            if level is not None:
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

    # =========================
    # 메인 루프
    # =========================
    def run(self):
        # EC2 WebSocket 연결
        self.ws.connect()
        print("[WASD] Controller running...")

        # 기본 로봇 자동 연결 (있으면)
        if self.default_ros_host:
            print(f"[INIT] 기본 ROS_HOST={self.default_ros_host} 연결 시도")
            self.connect_ros(self.default_ros_host)

        # 상태/모니터링 루프 시작
        self.start_status_loop()
        self.monitor_ros_connection()

        try:
            while True:
                raw = self.ws.receive()
                if not raw or not raw.startswith("{"):
                    continue

                msg = json.loads(raw)
                mtype = msg.get("type")

                # === 로봇 변경 요청 ===
                if mtype == "connect_robot":
                    payload = msg.get("payload", {})
                    name = payload.get("name") or "unknown"
                    ip = payload.get("ip")
                    if not ip:
                        continue

                    print(f"[EC2] 로봇 변경 요청 수신 → {name} ({ip})")

                    # 1️⃣ 기존 연결 종료
                    self._stop_ros()
                    time.sleep(0.5)  # 잔여 소켓/스레드 정리 여유

                    # 2️⃣ 새 ROS 연결 시도
                    ok = self._start_ros(ip)

                    # 3️⃣ 상태/리스너 세팅
                    self.robot_name = name
                    self.robot_ip = ip
                    self.connected = ok

                    if ok:
                        self._setup_listeners_and_publishers()
                        print(f"[ROS] {name} 연결 완료 → {ip}:{self.ROS_PORT}")
                    else:
                        print(f"[ROS] {name} 연결 실패 → {ip}:{self.ROS_PORT}")

                    # 4️⃣ 최종 상태 전송
                    self.send_status()
                    continue

                # === 제어 명령 ===
                if mtype == "control" and "payload" in msg:
                    cmd = msg["payload"].get("command")
                    if self.ros_pub and cmd:
                        self.ros_pub.publish_command(cmd)

        except KeyboardInterrupt:
            print("[WASD] 종료 중...")
            self._stop_ros()