import roslibpy


class RosPublisher:
    """ROS 퍼블리셔 (공유 Ros 인스턴스 사용)"""

    def __init__(self, ros: roslibpy.Ros):
        self.ros = ros
        # 필요시 다른 토픽 추가
        self.cmd_vel = roslibpy.Topic(self.ros, "/cmd_vel", "geometry_msgs/msg/Twist")

    def publish_command(self, cmd: dict | None):
        if not cmd:
            print("[ROS] 빈 제어 명령, 무시")
            return
        if not self.ros or not self.ros.is_connected:
            print("[ROS] ROS 미연결 상태, 제어 명령 전송 불가")
            return

        try:
            self.cmd_vel.publish(roslibpy.Message(cmd))
            print(f"[ROS] cmd_vel 퍼블리시 → {cmd}")
        except Exception as e:
            print("[ERROR] cmd_vel 퍼블리시 실패:", e)

    def close(self):
        try:
            self.cmd_vel.unregister()
        except Exception:
            pass