import threading
import time
import roslibpy
from app.websocket.manager import ws_manager


class ROSRobotConnection:
    """단일 로봇의 rosbridge 연결 상태만 관리 (토픽/명령은 외부)"""

    def __init__(self, name: str, ip: str, port: int = 9090):
        self.name = name
        self.ip = ip
        self.port = port
        self.ros = None
        self.connected = False
        self._stop_flag = False
        self._monitor_thread = None
        self._last_broadcast = 0  # ✅ 최근 broadcast 시각

    # -------------------------------------
    # ✅ rosbridge 연결 (3초 soft timeout)
    # -------------------------------------
    def connect(self) -> bool:
        """rosbridge 서버 연결"""
        try:
            self.ros = roslibpy.Ros(host=self.ip, port=self.port)
            threading.Thread(target=self.ros.run, daemon=True).start()  # 비차단 실행
            print(f"[ROS] {self.name}({self.ip}) 연결 시도...")

            # ✅ 3초까지만 연결 대기
            start = time.time()
            while time.time() - start < 1:
                if self.ros.is_connected:
                    self.connected = True
                    print(f"[ROS] ✅ {self.name} 연결 완료")

                    # 상태 감시 스레드 시작
                    self._stop_flag = False
                    self._monitor_thread = threading.Thread(
                        target=self._monitor_connection, daemon=True
                    )
                    self._monitor_thread.start()

                    self._broadcast_status(True)
                    return True
                time.sleep(0.3)

            # 3초 내 연결 실패 → 즉시 실패 처리
            print(f"[ROS] ❌ {self.name} 연결 실패 (timeout)")
            self.connected = False
            self._broadcast_status(False)
            return False

        except Exception as e:
            print(f"[ROS] 🚨 {self.name} 연결 오류: {e}")
            self._broadcast_status(False)
            return False

    # -------------------------------------
    # ✅ 연결 상태 감시 (0.5초)
    # -------------------------------------
    def _monitor_connection(self):
        """0.5초마다 연결 상태 감시"""
        prev = self.connected
        while not self._stop_flag:
            if not self.ros:
                break

            self.connected = self.ros.is_connected
            if prev != self.connected:
                self._broadcast_status(self.connected)
                print(f"[ROS] 상태 변경 ({self.name}): {'✅ 연결됨' if self.connected else '❌ 해제됨'}")
                prev = self.connected
            time.sleep(0.5)

    # -------------------------------------
    # ✅ 연결 해제
    # -------------------------------------
    def disconnect(self):
        """rosbridge 연결 해제"""
        try:
            self._stop_flag = True
            if self.ros and self.ros.is_connected:
                self.ros.close()
            self.ros = None
            self.connected = False
            print(f"[ROS] 🔴 {self.name} 연결 해제 완료")
        except Exception as e:
            print(f"[ROS] ⚠️ 연결 해제 오류: {e}")
        self._broadcast_status(False)

    # -------------------------------------
    # ✅ 상태 브로드캐스트 (3초 중복 차단)
    # -------------------------------------
    def _broadcast_status(self, connected: bool):
        """웹소켓으로 연결 상태 전달"""
        now = time.time()
        if now - self._last_broadcast < 3:
            return  # 3초 내 중복 전송 방지
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


# ============================================================
# ✅ 다중 로봇 연결 관리자
# ============================================================
class ROSConnectionManager:
    """다중 로봇 연결 관리 (토픽/명령 제외)"""

    def __init__(self):
        self.active_robot = None
        self.clients = {}

    def connect_robot(self, name: str, ip: str):
        """로봇 연결"""
        # 기존 연결 종료
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


# ✅ 전역 인스턴스
ros_manager = ROSConnectionManager()