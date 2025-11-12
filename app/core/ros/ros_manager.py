# app/core/ros/ros_manager.py
import threading
import time
import roslibpy
from app.websocket.manager import ws_manager
from app.core.ros.listener import RosListener


class ROSRobotConnection:
    """단일 로봇의 rosbridge 연결 상태만 관리 (토픽/명령은 외부)"""

    def __init__(self, name: str, ip: str, port: int = 9090):
        self.name = name
        self.ip = ip
        self.port = port
        self.ros = None
        self.listener = None
        self.connected = False
        self._stop_flag = False
        self._monitor_thread = None
        self._last_broadcast = 0  # ✅ 최근 broadcast 시각

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

                    # ✅ 리스너 시작 (battery 등 구독)
                    self.listener = RosListener(self.ros, self.name)
                    for topic in ["/battery_state", "/odom", "/cmd_vel"]:
                        self.listener.subscribe(topic)

                    # 상태 감시 스레드 시작
                    self._stop_flag = False
                    self._monitor_thread = threading.Thread(
                        target=self._monitor_connection, daemon=True
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
                print(f"[ROS] 상태 변경 ({self.name}): {'✅ 연결됨' if self.connected else '❌ 해제됨'}")
                prev = self.connected
            time.sleep(0.5)

    def disconnect(self):
        """rosbridge 연결 해제"""
        try:
            self._stop_flag = True
            if self.listener:
                self.listener.close()
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


class ROSConnectionManager:
    def __init__(self):
        self.active_robot = None
        self.clients = {}

    def connect_robot(self, name: str, ip: str):
        """로봇 연결"""
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