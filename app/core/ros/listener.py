import roslibpy
from app.websocket.manager import broadcast_text  # FastAPI 웹소켓 브로드캐스트용
import json
import threading
import asyncio


class RosListener:
    """ROS 토픽 구독 전담 (공유 Ros 인스턴스 사용)"""

    def __init__(self, ros: roslibpy.Ros, callback):
        self.ros = ros
        self.callback = callback
        self.topics = []

    def subscribe(self, topic_name: str):
        if not self.ros:
            print("[ROS] Listener: ROS 미연결 상태")
            return

        topic_map = {
            "/odom": "nav_msgs/msg/Odometry",
            "/battery": "sensor_msgs/msg/BatteryState",
            "/cmd_vel": "geometry_msgs/msg/Twist",
            "/amcl_pose": "geometry_msgs/msg/PoseWithCovarianceStamped",
            "/base_link": "geometry_msgs/msg/PoseStamped",
            "/nav": "std_msgs/msg/String",
            "/teleop_key": "std_msgs/msg/String",
            "/diagnostics": "diagnostic_msgs/msg/DiagnosticArray",
            "/camera": "sensor_msgs/msg/Image",
        }

        msg_type = topic_map.get(topic_name, "std_msgs/msg/String")
        topic = roslibpy.Topic(self.ros, topic_name, msg_type)

        def _cb(msg, t=topic_name):
            self.callback(t, msg)

        topic.subscribe(_cb)
        self.topics.append(topic)
        print(f"[ROS] Subscribe → {topic_name} ({msg_type})")

    def close(self):
        print("[ROS] Listener closed")
        for t in self.topics:
            try:
                t.unsubscribe()
            except Exception:
                pass
        self.topics.clear()


class RosListenerManager:
    """FastAPI와 통합된 ROS 리스너 관리자"""

    def __init__(self, host="192.168.1.47", port=9090):
        self.host = host
        self.port = port
        self.ros = None
        self.listener = None

    def start(self):
        """ROS 연결 및 토픽 구독 시작"""
        print(f"[ROS] Connecting to {self.host}:{self.port} ...")
        self.ros = roslibpy.Ros(host=self.host, port=self.port)
        self.ros.run()

        # 콜백 정의
        def on_message(topic, msg):
            print(f"[ROS] 수신 ← {topic}")
            # WebSocket 브로드캐스트 (웹 대시보드로 실시간 전송)
            payload = {
                "type": topic,
                "payload": msg,
            }
            asyncio.run(broadcast_text(json.dumps(payload)))

        self.listener = RosListener(self.ros, on_message)

        # 필요한 토픽 전부 구독
        for t in ["/odom", "/battery", "/cmd_vel", "/camera"]:
            self.listener.subscribe(t)

        print("[ROS] Listener started ✅")

    def stop(self):
        """리스너 종료"""
        if self.listener:
            self.listener.close()
        if self.ros:
            self.ros.terminate()
        print("[ROS] Connection closed ❌")