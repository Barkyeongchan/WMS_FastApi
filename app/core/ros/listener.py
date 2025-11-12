import roslibpy
from app.websocket.manager import broadcast_text
import json, threading, asyncio

class RosListener:
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
            "/battery_state": "sensor_msgs/msg/BatteryState",
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
    def __init__(self, host="192.168.1.47", port=9090):
        self.host = host
        self.port = port
        self.ros = None
        self.listener = None

    def start(self):
        print(f"[ROS] Connecting to {self.host}:{self.port} ...")
        self.ros = roslibpy.Ros(host=self.host, port=self.port)
        self.ros.run()

        def on_message(topic, msg):
            print(f"[ROS] 수신 ← {topic}")
            payload = {"type": topic, "payload": msg}
            asyncio.run(broadcast_text(json.dumps(payload)))

        self.listener = RosListener(self.ros, on_message)
        for t in ["/odom", "/battery_state", "/cmd_vel", "/camera"]:
            self.listener.subscribe(t)

        print("[ROS] Listener started ✅")

    # 🔥 추가: 로봇 교체 시 ROS 재연결
    def reconnect(self, new_host):
        print(f"[ROS] Reconnecting to {new_host} ...")
        try:
            if self.listener:
                self.listener.close()
            if self.ros:
                self.ros.terminate()

            self.host = new_host
            self.start()
            print("[ROS] Reconnected successfully ✅")
        except Exception as e:
            print(f"[ROS] 재연결 실패: {e}")

    def stop(self):
        if self.listener:
            self.listener.close()
        if self.ros:
            self.ros.terminate()
        print("[ROS] Connection closed ❌")