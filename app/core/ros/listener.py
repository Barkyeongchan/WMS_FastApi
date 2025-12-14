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

        # 토픽별 ROS 메시지 타입 매핑
        topic_map = {
            "/odom": "nav_msgs/msg/Odometry",
            "/battery_state": "sensor_msgs/msg/BatteryState",
            "/cmd_vel": "geometry_msgs/msg/Twist",
            "/amcl_pose": "geometry_msgs/msg/PoseWithCovarianceStamped",
            "/base_link": "geometry_msgs/msg/PoseStamped",
            "/nav": "std_msgs/msg/String",
            "/teleop_key": "std_msgs/msg/String",
            "/diagnostics": "diagnostic_msgs/msg/DiagnosticArray",
        }

        msg_type = topic_map.get(topic_name, "std_msgs/msg/String")
        topic = roslibpy.Topic(self.ros, topic_name, msg_type)

        # 구독 콜백 등록
        def _cb(msg, t=topic_name):
            self._handle_message(t, msg)

        topic.subscribe(_cb)
        self.topics.append(topic)
        print(f"[ROS] Subscribe → {topic_name} ({msg_type})")

    def _handle_message(self, topic_name, msg):
        try:
            # /nav 도착 이벤트(ARRIVED:PIN) 처리
            if topic_name == "/nav":
                text = msg.get("data", "")
                if isinstance(text, str) and text.startswith("ARRIVED:"):
                    pin_name = text.replace("ARRIVED:", "")
                    print(f"[ROS] 🏁 도착 신호 → {pin_name}")

                    # WAIT 도착이면 대기중 상태 브로드캐스트
                    if pin_name == "WAIT":
                        ws_manager.broadcast({
                            "type": "robot_status",
                            "payload": {"state": "대기중"}
                        })

                    # 도착 이벤트 브로드캐스트
                    ws_manager.broadcast({
                        "type": "robot_arrived",
                        "payload": {
                            "pin": pin_name,
                            "robot_name": self.robot_name
                        }
                    })
                    return

            # ROS 메시지 -> 전송용 데이터 변환
            data = process_ros_data(
                topic_name,
                msg,
                robot_name=self.robot_name
            )
            if not data:
                return

            # payload에 robot_name 보장
            if "payload" in data:
                data["payload"]["robot_name"] = self.robot_name

            # 최종 WS 메시지 생성 후 브로드캐스트
            ws_msg = build_message(data["type"], data["payload"])
            ws_manager.broadcast(ws_msg)

            # /amcl_pose 최신 좌표 캐시 저장
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
        # 구독 해제 및 리소스 정리
        print("[ROS] Listener closed")
        for t in self.topics:
            try:
                t.unsubscribe()
            except:
                pass
        self.topics.clear()