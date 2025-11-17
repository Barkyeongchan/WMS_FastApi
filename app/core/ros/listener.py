# app/core/ros/listener.py

import roslibpy
import json
import math
from app.core.message.data_processor import process_ros_data
from app.core.message.message_builder import build_message
from app.websocket.manager import ws_manager


class RosListener:
    def __init__(self, ros: roslibpy.Ros, robot_name: str):
        self.ros = ros
        self.robot_name = robot_name
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
            self._handle_message(t, msg)

        topic.subscribe(_cb)
        self.topics.append(topic)
        print(f"[ROS] Subscribe → {topic_name} ({msg_type})")

    def _handle_message(self, topic_name, msg):
        try:
            # ----------------------------------------------------
            # ARRIVED:XXX (핀 도착 이벤트)
            # ----------------------------------------------------
            if topic_name == "/nav":
                text = msg.get("data", "")
                if isinstance(text, str) and text.startswith("ARRIVED:"):
                    pin_name = text.replace("ARRIVED:", "")
                    print(f"[ROS] 🏁 도착 신호 → {pin_name}")

                    if pin_name == "WAIT":
                        ws_manager.broadcast({
                            "type": "robot_status",
                            "payload": {"state": "대기중"}
                        })

                    ws_manager.broadcast({
                        "type": "robot_arrived",
                        "payload": {
                            "pin": pin_name,
                            "robot_name": self.robot_name
                        }
                    })
                    return

            # ----------------------------------------------------
            # 기본 메시지 처리
            # ----------------------------------------------------
            data = process_ros_data(
                topic_name,
                msg,
                robot_name=self.robot_name
            )
            if not data:
                return

            if "payload" in data:
                data["payload"]["robot_name"] = self.robot_name

            ws_msg = build_message(data["type"], data["payload"])
            ws_manager.broadcast(ws_msg)

            # ----------------------------------------------------
            # 🔥 마지막 위치 저장
            # ----------------------------------------------------
            if topic_name == "/amcl_pose":
                try:
                    from app.core.ros.ros_manager import ros_manager

                    px = msg["pose"]["pose"]["position"]["x"]
                    py = msg["pose"]["pose"]["position"]["y"]

                    q = msg["pose"]["pose"]["orientation"]
                    theta = math.atan2(
                        2 * (q["w"] * q["z"] + q["x"] * q["y"]),
                        1 - 2 * (q["y"]**2 + q["z"]**2)
                    )

                    ros_manager.last_pose[self.robot_name] = {
                        "x": px,
                        "y": py,
                        "theta": theta
                    }

                except Exception as e:
                    print("[ROS] 좌표 저장 오류:", e)

        except Exception as e:
            print(f"[ROS] ⚠️ {topic_name} 처리 오류:", e)

    def close(self):
        print("[ROS] Listener closed")
        for t in self.topics:
            try:
                t.unsubscribe()
            except:
                pass
        self.topics.clear()