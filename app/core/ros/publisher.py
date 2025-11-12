import roslibpy

class RosPublisher:
    """ROS 퍼블리셔 (공유 Ros 인스턴스 사용)"""

    def __init__(self, ros: roslibpy.Ros):
        self.ros = ros
        self.cmd_vel = roslibpy.Topic(self.ros, "/cmd_vel", "geometry_msgs/msg/Twist")

        # [ADD] 속도 단계별 최대 선속도 (m/s)
        self.MAX_SPEED = {1: 0.2, 2: 0.4, 3: 0.6}

    def publish_command(self, cmd: dict | None):
        if not cmd:
            print("[ROS] 빈 제어 명령, 무시")
            return
        if not self.ros or not self.ros.is_connected:
            print("[ROS] ROS 미연결 상태, 제어 명령 전송 불가")
            return

        try:
            payload = cmd.get("payload", cmd)
            linear = payload.get("linear", {})
            angular = payload.get("angular", {})
            gear = int(payload.get("gear", 1))  # [ADD] JS에서 전달된 단계
            max_v = self.MAX_SPEED.get(gear, 0.2)

            # [ADD] 단계별 제한 적용
            linear_x = max(-max_v, min(max_v, linear.get("x", 0.0)))
            angular_z = max(-1.0, min(1.0, angular.get("z", 0.0)))

            twist_msg = {
                "linear": {"x": linear_x, "y": 0.0, "z": 0.0},
                "angular": {"x": 0.0, "y": 0.0, "z": angular_z},
            }

            self.cmd_vel.publish(roslibpy.Message(twist_msg))
            print(f"[ROS] cmd_vel 퍼블리시 → {twist_msg} (gear={gear})")

        except Exception as e:
            print("[ERROR] cmd_vel 퍼블리시 실패:", e)

    def close(self):
        try:
            self.cmd_vel.unregister()
        except Exception:
            pass