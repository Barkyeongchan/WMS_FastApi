import roslibpy

# 수동 모드 단계별 최대 속도 (TB3 Burger 기준)
MANUAL_MAX_SPEED = {
    1: 0.10,
    2: 0.15,
    3: 0.22,
}


class RosPublisher:
    # ROS 제어 명령 퍼블리셔
    def __init__(self, ros: roslibpy.Ros):
        self.ros = ros
        # /cmd_vel 퍼블리셔 생성
        self.cmd_vel = roslibpy.Topic(
            self.ros, "/cmd_vel", "geometry_msgs/msg/Twist"
        )

    def publish_command(self, cmd: dict | None):
        # cmd_vel 제어 명령 퍼블리시
        if not cmd:
            print("[ROS] 빈 제어 명령, 무시")
            return

        if not self.ros or not self.ros.is_connected:
            print("[ROS] ROS 미연결 상태, 제어 명령 전송 불가")
            return

        try:
            # payload만 오거나 전체 메시지가 와도 처리
            payload = cmd.get("payload", cmd)

            linear = payload.get("linear", {})
            angular = payload.get("angular", {})
            gear = int(payload.get("gear", 1))

            # 기어에 따른 최대 속도 제한
            max_v = MANUAL_MAX_SPEED.get(gear, 0.10)

            # 선속도 / 각속도 클램핑
            linear_x = max(-max_v, min(max_v, linear.get("x", 0.0)))
            angular_z = max(-1.0, min(1.0, angular.get("z", 0.0)))

            # Twist 메시지 구성
            twist_msg = {
                "linear": {"x": linear_x, "y": 0.0, "z": 0.0},
                "angular": {"x": 0.0, "y": 0.0, "z": angular_z},
            }

            # ROS로 퍼블리시
            self.cmd_vel.publish(roslibpy.Message(twist_msg))
            print(
                f"[ROS] cmd_vel 퍼블리시 → {twist_msg} (gear={gear}, max_v={max_v})"
            )

        except Exception as e:
            print("[ERROR] cmd_vel 퍼블리시 실패:", e)

    def close(self):
        # 퍼블리셔 정리
        try:
            self.cmd_vel.unregister()
        except Exception:
            pass