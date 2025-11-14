# app/core/ros/ros_manager.py

import threading
import time
import roslibpy
from app.websocket.manager import ws_manager
from app.core.ros.listener import RosListener
from app.core.ros.publisher import RosPublisher

# 🔧 터틀봇3 Burger 기준 자동 모드 속도 정책 (m/s)
AUTO_SPEED = {
    1: 0.10,
    2: 0.15,
    3: 0.22,  # TB3 Burger 공식 최대속도 근처
}


class ROSRobotConnection:
    """단일 로봇의 rosbridge 연결 상태 + 구독/퍼블리시 관리"""

    def __init__(self, name: str, ip: str, port: int = 9090):
        self.name = name
        self.ip = ip
        self.port = port

        self.ros: roslibpy.Ros | None = None
        self.listener: RosListener | None = None
        self.publisher: RosPublisher | None = None
        self.connected: bool = False

        self.auto_speed_level: int = 1  # ✅ 자동 모드 기어 (1~3)

        self._stop_flag = False
        self._monitor_thread: threading.Thread | None = None
        self._last_broadcast = 0  # ✅ 최근 broadcast 시각

    # ==========================================
    #  연결 / 모니터링
    # ==========================================
    def connect(self) -> bool:
        """rosbridge 서버 연결"""
        try:
            self.ros = roslibpy.Ros(host=self.ip, port=self.port)
            threading.Thread(target=self.ros.run, daemon=True).start()
            print(f"[ROS] {self.name}({self.ip}) 연결 시도...")

            start = time.time()
            while time.time() - start < 2.5:
                if self.ros.is_connected:
                    self.connected = True
                    print(f"[ROS] ✅ {self.name} 연결 완료")

                    # ✅ 리스너 시작 (battery / odom / cmd_vel / diagnostics 등 구독)
                    self.listener = RosListener(self.ros, self.name)
                    for topic in ["/battery_state", "/odom", "/cmd_vel", "/diagnostics", "/amcl_pose", "/nav"]:
                        self.listener.subscribe(topic)

                    # ✅ 퍼블리셔 준비 (cmd_vel 퍼블리셔)
                    self.publisher = RosPublisher(self.ros)

                    # 상태 감시 스레드 시작
                    self._stop_flag = False
                    self._monitor_thread = threading.Thread(
                        target=self._monitor_connection,
                        daemon=True,
                    )
                    self._monitor_thread.start()

                    self._broadcast_status(True)
                    return True
                time.sleep(0.3)

            print(f"[ROS] ❌ {self.name} 연결 실패 (timeout)")
            self.connected = False
            self._broadcast_status(False)
            return False

        except Exception as e:
            print(f"[ROS] 🚨 {self.name} 연결 오류: {e}")
            self._broadcast_status(False)
            return False

    def _monitor_connection(self):
        prev = self.connected
        while not self._stop_flag:
            if not self.ros:
                break

            self.connected = self.ros.is_connected
            if prev != self.connected:
                self._broadcast_status(self.connected)
                print(
                    f"[ROS] 상태 변경 ({self.name}): "
                    f"{'✅ 연결됨' if self.connected else '❌ 해제됨'}"
                )
                prev = self.connected
            time.sleep(0.5)

    def disconnect(self):
        """rosbridge 연결 해제"""
        try:
            self._stop_flag = True

            # 리스너 해제
            if self.listener:
                self.listener.close()
                self.listener = None

            # 퍼블리셔 해제
            if self.publisher:
                self.publisher.close()
                self.publisher = None

            # ROS 세션 종료
            if self.ros and self.ros.is_connected:
                self.ros.close()

            self.ros = None
            self.connected = False
            print(f"[ROS] 🔴 {self.name} 연결 해제 완료")
        except Exception as e:
            print(f"[ROS] ⚠️ 연결 해제 오류: {e}")

        self._broadcast_status(False)

    def _broadcast_status(self, connected: bool):
        """웹소켓으로 연결 상태 전달"""
        now = time.time()
        if now - self._last_broadcast < 3:
            return
        self._last_broadcast = now

        msg = {
            "type": "status",
            "payload": {
                "robot_name": self.name,
                "ip": self.ip,
                "connected": connected,
            },
        }
        ws_manager.broadcast(msg)

    # ==========================================
    # ✅ /cmd_vel 명령 퍼블리시 (수동 제어)
    # ==========================================
    def send_cmd_vel(self, cmd: dict):
        """
        cmd 구조는 robot.js 의 payload와 동일:
        {
          "linear": {...},
          "angular": {...},
          "gear": 1~3
        }
        """
        if not self.publisher:
            print(f"[ROS] cmd_vel 무시 ({self.name}): 퍼블리셔 없음")
            return
        self.publisher.publish_command(cmd)

    # ==========================================
    # ✅ 자동 모드 속도 레벨 설정 (Nav2 연동용)
    # ==========================================
    def set_nav2_speed(self, gear: int):
        """
        지금은 더미 환경이므로 Nav2 서비스 호출은 하지 않고,
        단순히 '현재 자동 모드 기어'를 저장하고 로그만 남긴다.

        나중에 실제 터틀봇3 + Nav2 연결 시 이 함수 안에
        /controller_server/set_parameters 서비스 호출 로직을 추가하면 됨.
        """
        if gear not in AUTO_SPEED:
            print(f"[NAV2] 잘못된 gear={gear}, 기본값 1단으로 처리")
            gear = 1

        self.auto_speed_level = gear
        max_v = AUTO_SPEED[gear]

        print(
            f"[NAV2] (더미) 자동 모드 속도 레벨 설정 → "
            f"{self.name}: gear={gear}, max_vel_x={max_v} m/s"
        )
        # TODO: 실제 Nav2 사용 시 예시
        # service = roslibpy.Service(
        #     self.ros,
        #     '/controller_server/set_parameters',
        #     'rcl_interfaces/srv/SetParameters'
        # )
        # req = { ... }
        # service.call(req)


class ROSConnectionManager:
    """여러 로봇 연결 관리 & 활성 로봇에 대한 제어"""

    def __init__(self):
        self.active_robot: str | None = None
        self.clients: dict[str, ROSRobotConnection] = {}

    # ---------------------------
    # 로봇 연결 / 해제 / 상태
    # ---------------------------
    def connect_robot(self, name: str, ip: str):
        """로봇 연결"""
        # 기존 활성 로봇 있으면 먼저 끊기
        if self.active_robot and self.active_robot in self.clients:
            self.clients[self.active_robot].disconnect()

        client = ROSRobotConnection(name, ip)
        ok = client.connect()
        if ok:
            self.clients[name] = client
            self.active_robot = name
            print(f"[ROS] 🟢 활성 로봇 = {name}")
        else:
            print(f"[ROS] ❌ {name} 연결 실패")

    def disconnect_robot(self, name: str):
        """로봇 연결 해제"""
        if name in self.clients:
            self.clients[name].disconnect()
            del self.clients[name]
            print(f"[ROS] 🔴 {name} 연결 해제 완료")

        if self.active_robot == name:
            self.active_robot = None

    def get_status(self, name: str):
        """현재 로봇 상태 반환"""
        if name not in self.clients:
            return {"connected": False, "ip": None}
        c = self.clients[name]
        return {"connected": c.connected, "ip": c.ip}

    # ---------------------------
    # ✅ 활성 로봇에 대한 cmd_vel 전송
    # ---------------------------
    def send_cmd_vel(self, payload: dict):
        """
        handler.py 에서 호출.
        payload 구조는 robot.js 의 payload 와 동일:
        {
          "linear": { "x": ..., "y": ..., "z": ... },
          "angular": { "x": ..., "y": ..., "z": ... },
          "gear": 1~3
        }
        """
        if not self.active_robot or self.active_robot not in self.clients:
            print("[ROS] cmd_vel 무시: 활성 로봇 없음")
            return

        client = self.clients[self.active_robot]
        client.send_cmd_vel(payload)

    # ---------------------------
    # ✅ 활성 로봇에 대한 자동 모드 속도 레벨 변경
    # ---------------------------
    def set_auto_speed_level(self, gear: int):
        """
        handler.py 에서 auto_speed 메시지 수신 시 호출.
        지금은 더미 환경이라 Nav2에 반영은 안 하고,
        각 로봇 객체 내부 상태만 업데이트 + 로그만 남김.
        """
        if not self.active_robot or self.active_robot not in self.clients:
            print("[NAV2] auto_speed 무시: 활성 로봇 없음")
            return

        client = self.clients[self.active_robot]
        client.set_nav2_speed(gear)


# ✅ 전역 인스턴스
ros_manager = ROSConnectionManager()