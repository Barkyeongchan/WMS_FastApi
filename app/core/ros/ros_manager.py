# app/core/ros/ros_manager.py

import threading
import time
import roslibpy
from app.websocket.manager import ws_manager
from app.core.ros.listener import RosListener
from app.core.ros.publisher import RosPublisher

AUTO_SPEED = {
    1: 0.10,
    2: 0.15,
    3: 0.22,
}

# 🔥 ROS2 표준 메시지 타입 통일
UI_CMD_TYPE = "std_msgs/String"


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

        self.auto_speed_level: int = 1

        self._stop_flag = False
        self._monitor_thread: threading.Thread | None = None
        self._last_broadcast = 0  # ✅ 최근 broadcast 시각

        # ✅ UI 명령용 토픽 핸들
        self.ui_topic: roslibpy.Topic | None = None

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
                    for topic in ["/battery_state", "/odom", "/cmd_vel",
                                  "/diagnostics", "/amcl_pose", "/nav"]:
                        self.listener.subscribe(topic)

                    # ✅ 퍼블리셔 준비 (cmd_vel 퍼블리셔)
                    self.publisher = RosPublisher(self.ros)

                    # ✅ UI 명령용 토픽 준비 (/wasd_ui_command)
                    self.ui_topic = roslibpy.Topic(
                        self.ros,
                        "/wasd_ui_command",
                        UI_CMD_TYPE
                    )
                    try:
                        self.ui_topic.advertise()
                        print(f"[ROS] Advertise → /wasd_ui_command ({UI_CMD_TYPE})")
                    except Exception as e:
                        print("[ROS] ⚠️ /wasd_ui_command advertise 실패:", e)

                    # 상태 감시 스레드 시작
                    self._stop_flag = False
                    self._monitor_thread = threading.Thread(
                        target=self._monitor_connection,
                        daemon=True,
                    )
                    self._monitor_thread.start()

                    # 🔥 여기서 에러 나던 부분 → 메서드 복구 완료
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

    # ✅ 내가 빠뜨렸던 메서드 — 원래 네 코드 그대로 복구
    def _broadcast_status(self, connected: bool):
        """웹소켓으로 연결 상태 전달"""
        now = time.time()
        # 너무 자주 안 쏘게 쿨다운
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

    def disconnect(self):
        """rosbridge 연결 해제"""
        try:
            self._stop_flag = True

            if self.listener:
                self.listener.close()
                self.listener = None

            if self.publisher:
                self.publisher.close()
                self.publisher = None

            if self.ui_topic:
                try:
                    self.ui_topic.unadvertise()
                except Exception:
                    pass
                self.ui_topic = None

            if self.ros and self.ros.is_connected:
                self.ros.close()

            self.ros = None
            self.connected = False
            print(f"[ROS] 🔴 {self.name} 연결 해제 완료")
        except Exception as e:
            print(f"[ROS] ⚠️ 연결 해제 오류: {e}")

        self._broadcast_status(False)

    # ==========================================
    # ✅ /cmd_vel 명령 퍼블리시 (수동 제어)
    # ==========================================
    def send_cmd_vel(self, cmd: dict):
        if not self.publisher:
            print(f"[ROS] cmd_vel 무시 ({self.name}): 퍼블리셔 없음")
            return
        self.publisher.publish_command(cmd)

    # ==========================================
    # ✅ UI 명령 퍼블리시 (/wasd_ui_command)
    # ==========================================
    def send_ui_command(self, command: str):
        """입고/출고/WAIT 등 UI 명령을 ROS 토픽으로 퍼블리시"""

        print(f"[DEBUG] send_ui_command() 호출됨 → {command}")

        # 연결 체크
        if not self.ros or not self.ros.is_connected:
            print(f"[ROS] UI 명령 무시 ({self.name}): ros 연결 없음")
            return

        # 토픽 준비 (필요 시 재생성)
        try:
            if not self.ui_topic:
                self.ui_topic = roslibpy.Topic(
                    self.ros,
                    "/wasd_ui_command",
                    UI_CMD_TYPE,
                )
                self.ui_topic.advertise()
                print(f"[ROS] 재-advertise → /wasd_ui_command ({UI_CMD_TYPE})")

            # publish 전 로그
            print(f"[DEBUG] publish 직전: command={command}")

            # 메시지 생성
            msg = roslibpy.Message({"data": command})

            # 실제 퍼블리시
            self.ui_topic.publish(msg)

            # 성공 로그
            print(f"[ROS] 📤 /wasd_ui_command → {command}")

        except Exception as e:
            print("\n🔥🔥🔥 FATAL ERROR IN UI COMMAND 🔥🔥🔥")
            print(f"Exception type: {type(e).__name__}")
            print(f"Exception message: {e}")
            import traceback
            traceback.print_exc()
            print("🔥🔥🔥 END OF TRACEBACK 🔥🔥🔥\n")



    # ==========================================
    # ✅ 자동 모드 속도 레벨 설정 (Nav2 연동용)
    # ==========================================
    def set_nav2_speed(self, gear: int):
        if gear not in AUTO_SPEED:
            print(f"[NAV2] 잘못된 gear={gear}, 기본값 1단으로 처리")
            gear = 1

        self.auto_speed_level = gear
        max_v = AUTO_SPEED[gear]

        print(
            f"[NAV2] (더미) 자동 모드 속도 레벨 설정 → "
            f"{self.name}: gear={gear}, max_vel_x={max_v} m/s"
        )


class ROSConnectionManager:
    """여러 로봇 연결 관리 & 활성 로봇에 대한 제어"""

    def __init__(self):
        self.active_robot: str | None = None
        self.clients: dict[str, ROSRobotConnection] = {}

    def connect_robot(self, name: str, ip: str):
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
        if name in self.clients:
            self.clients[name].disconnect()
            del self.clients[name]
            print(f"[ROS] 🔴 {name} 연결 해제 완료")

        if self.active_robot == name:
            self.active_robot = None

    def get_status(self, name: str):
        if name not in self.clients:
            return {"connected": False, "ip": None}
        c = self.clients[name]
        return {"connected": c.connected, "ip": c.ip}

    def send_cmd_vel(self, payload: dict):
        if not self.active_robot or self.active_robot not in self.clients:
            print("[ROS] cmd_vel 무시: 활성 로봇 없음")
            return
        client = self.clients[self.active_robot]
        client.send_cmd_vel(payload)

    def send_ui_command(self, command: str):
        print(f"[DEBUG] send_ui_command() 호출됨 → {command}")
        if not self.active_robot or self.active_robot not in self.clients:
            print("[ROS] UI 명령 무시: 활성 로봇 없음")
            return
        client = self.clients[self.active_robot]
        client.send_ui_command(command)

    def set_auto_speed_level(self, gear: int):
        if not self.active_robot or self.active_robot not in self.clients:
            print("[NAV2] auto_speed 무시: 활성 로봇 없음")
            return
        client = self.clients[self.active_robot]
        client.set_nav2_speed(gear)


# ✅ 전역 인스턴스
ros_manager = ROSConnectionManager()