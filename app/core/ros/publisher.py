# app/core/ros/publisher.py

import roslibpy

# 터틀봇3 Burger 기준 수동 모드 최대속도 (m/s)
MANUAL_MAX_SPEED = {
    1: 0.10,
    2: 0.15,
    3: 0.22,  # TB3 Burger 최대속도
}


class RosPublisher:
    """ROS 퍼블리셔 (공유 Ros 인스턴스 사용)"""

    def __init__(self, ros: roslibpy.Ros):
        self.ros = ros
        # ROS2 브리지 기준: geometry_msgs/msg/Twist 사용 (네가 쓰던 그대로 유지)
        self.cmd_vel = roslibpy.Topic(
            self.ros, "/cmd_vel", "geometry_msgs/msg/Twist"
        )

    def publish_command(self, cmd: dict | None):
        """
        WebSocket 등에서 올라온 cmd_vel 명령을 /cmd_vel로 퍼블리시.

        cmd는 전체 메시지이거나(payload만 or 전체) 둘 다 처리 가능:
        - { type: "cmd_vel", payload: {...} }
        - { linear:{...}, angular:{...}, gear: ... }
        """
        if not cmd:
            print("[ROS] 빈 제어 명령, 무시")
            return
        if not self.ros or not self.ros.is_connected:
            print("[ROS] ROS 미연결 상태, 제어 명령 전송 불가")
            return

        try:
            # 전체 메시지를 넘겨도 되고, payload만 넘겨도 동작하도록 처리
            payload = cmd.get("payload", cmd)
            linear = payload.get("linear", {})
            angular = payload.get("angular", {})
            gear = int(payload.get("gear", 1))

            max_v = MANUAL_MAX_SPEED.get(gear, 0.10)

            # 단계별 제한 적용 (TB3 Burger 기준)
            linear_x = max(-max_v, min(max_v, linear.get("x", 0.0)))
            angular_z = max(-1.0, min(1.0, angular.get("z", 0.0)))

            twist_msg = {
                "linear": {"x": linear_x, "y": 0.0, "z": 0.0},
                "angular": {"x": 0.0, "y": 0.0, "z": angular_z},
            }

            self.cmd_vel.publish(roslibpy.Message(twist_msg))
            print(
                f"[ROS] cmd_vel 퍼블리시 → {twist_msg} (gear={gear}, max_v={max_v})"
            )

        except Exception as e:
            print("[ERROR] cmd_vel 퍼블리시 실패:", e)

    def close(self):
        try:
            self.cmd_vel.unregister()
        except Exception:
            pass