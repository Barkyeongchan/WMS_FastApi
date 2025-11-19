import time
import math

# -----------------------------
# ✓ Quaternion → Yaw 변환 함수
# -----------------------------
def quaternion_to_yaw(q):
    """Quaternion → yaw(rad) 변환"""
    x = q.get('x', 0.0)
    y = q.get('y', 0.0)
    z = q.get('z', 0.0)
    w = q.get('w', 0.0)

    siny = 2.0 * (w * z + x * y)
    cosy = 1.0 - 2.0 * (y * y + z * z)
    return math.atan2(siny, cosy)


# =========================================================
#                   ROS 데이터 처리기
# =========================================================
def process_ros_data(topic_name, msg, robot_name="unknown"):
    """ROS 토픽 데이터 → WebSocket 전송용 JSON 변환"""

    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

    # =========================================================
    # 🦾 1. ODOM (속도 + 상대 위치)
    # =========================================================
    if topic_name == '/odom':
        pose = msg['pose']['pose']
        twist = msg['twist']['twist']

        ori = pose["orientation"]
        theta = quaternion_to_yaw(ori)

        return {
            "type": "odom",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "position": {
                    "x": round(pose['position']['x'], 3),
                    "y": round(pose['position']['y'], 3),
                    "z": round(pose['position']['z'], 3)
                },
                "orientation": ori,
                "theta": theta,
                "linear": twist['linear'],
                "angular": twist['angular']
            }
        }

    # =========================================================
    # 🧭 2. AMCL POSE (전역 위치)
    # =========================================================
    elif topic_name == '/amcl_pose':
        pose = msg['pose']['pose']
        ori = pose["orientation"]
        theta = quaternion_to_yaw(ori)

        return {
            "type": "amcl_pose",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "x": round(pose['position']['x'], 3),
                "y": round(pose['position']['y'], 3),
                "theta": theta,                 # ← 추가됨 (rad)
                "orientation": ori
            }
        }

    # =========================================================
    # 🔋 BATTERY
    # =========================================================
    elif topic_name in ['/battery', '/battery_state']:
        raw_percentage = msg.get('percentage', 0.0)
        if 0.0 <= raw_percentage <= 1.0:
            raw_percentage *= 100.0

        status_map = {
            0: "Unknown",
            1: "Charging",
            2: "Discharging",
            3: "Not Charging",
            4: "Full",
        }
        power_supply_status = msg.get('power_supply_status', 0)
        status = status_map.get(power_supply_status, "Unknown")

        return {
            "type": "battery",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "voltage": round(msg.get('voltage', 0.0), 2),
                "current": round(msg.get('current', 0.0), 3),
                "percentage": round(raw_percentage, 2),
                "status": status
            }
        }

    # =========================================================
    # 🚗 CMD VEL
    # =========================================================
    elif topic_name == '/cmd_vel':
        linear = msg['linear']
        angular = msg['angular']
        return {
            "type": "cmd_vel",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "linear_x": round(linear.get('x', 0.0), 3),
                "angular_z": round(angular.get('z', 0.0), 3)
            }
        }

    # =========================================================
    # 🧍 BASE LINK
    # =========================================================
    elif topic_name == '/base_link':
        pose = msg['pose']
        ori = pose['orientation']
        theta = quaternion_to_yaw(ori)

        return {
            "type": "base_link",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "position": pose['position'],
                "orientation": ori,
                "theta": theta
            }
        }

    # =========================================================
    # 🗺 NAV PATH
    # =========================================================
    elif topic_name == '/nav':
        path = msg.get('poses', [])
        simplified = [
            {"x": p['pose']['position']['x'], "y": p['pose']['position']['y']}
            for p in path
        ]
        return {
            "type": "nav",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "path_points": simplified[:50]
            }
        }

    # =========================================================
    # 🎮 TELEOP KEY
    # =========================================================
    elif topic_name == '/teleop_key':
        return {
            "type": "teleop_key",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "key": msg.get('data', '')
            }
        }

    # =========================================================
    # 🧩 DIAGNOSTICS
    # =========================================================
    elif topic_name == '/diagnostics':
        status_list = msg.get('status', []) or []

        overall_level = 0
        summary = "정상"

        for s in status_list:
            lvl = int(s.get('level', 0))
            name = (s.get('name') or '').lower()
            message = (s.get('message') or '').lower()

            if lvl > overall_level:
                overall_level = lvl

            if lvl == 2:
                # 🔥 모터 문제 먼저 체크
                if ("motor" in name or "base" in name or "wheel" in name or
                    "overcurrent" in message or "stall" in message or
                    "overheat" in message or "velocity" in message):
                    summary = "모터 오류"

                # 🔥 센서 끊김 분리
                elif ("lidar" in name or "connect" in message or "lost" in message):
                    summary = "센서 끊김"

                else:
                    summary = "시스템 오류"

                overall_level = 2
                break

            elif lvl == 1 and overall_level < 2:
                if "temp" in message:
                    summary = "온도 높음"
                elif "battery" in name or "battery" in message:
                    summary = "배터리 약함"
                else:
                    summary = "주의"
                overall_level = 1

        color = "green" if overall_level == 0 else ("orange" if overall_level == 1 else "red")

        return {
            "type": "diagnostics",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "status": summary,
                "color": color
            }
        }


    # =========================================================
    # 📷 CAMERA
    # =========================================================
    elif topic_name == '/camera':
        return {
            "type": "camera",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "data": msg.get('data', '')
            }
        }

    # =========================================================
    # ⚙ OTHER
    # =========================================================
    else:
        print(f"[WARN] 처리되지 않은 토픽: {topic_name}")
        return None