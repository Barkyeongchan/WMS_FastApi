import time

def process_ros_data(topic_name, msg, robot_name="unknown"):
    """ROS 토픽 데이터 가공 (JSON 직렬화용 / 실무형 표준 버전)"""

    # 현재 시각 (ISO 형식)
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

    # =========================================================
    # 🦾 1. Odometry (로봇 위치 / 속도)
    # =========================================================
    if topic_name == '/odom':
        pose = msg['pose']['pose']
        twist = msg['twist']['twist']
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
                "orientation": pose['orientation'],
                "linear": twist['linear'],
                "angular": twist['angular']
            }
        }

    # =========================================================
    # 🧭 2. AMCL Pose (로봇 위치 추정)
    # =========================================================
    elif topic_name == '/amcl_pose':
        pose = msg['pose']['pose']
        return {
            "type": "amcl_pose",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "x": round(pose['position']['x'], 3),
                "y": round(pose['position']['y'], 3),
                "orientation": pose['orientation']
            }
        }

    # =========================================================
    # 🔋 3. Battery State
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
    # 🚗 4. cmd_vel (속도 명령)
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
    # 🧍 5. Base Link (로봇 실제 위치)
    # =========================================================
    elif topic_name == '/base_link':
        pose = msg['pose']
        return {
            "type": "base_link",
            "payload": {
                "robot_name": robot_name,
                "timestamp": timestamp,
                "position": pose['position'],
                "orientation": pose['orientation']
            }
        }

    # =========================================================
    # 🗺️ 6. 자율주행 경로 (/nav)
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
                "path_points": simplified[:50]  # 실시간 렌더링용 50개 제한
            }
        }

    # =========================================================
    # 🎮 7. Teleop Key (수동 조작)
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
    # 🧩 8. Diagnostics (시스템 상태 - 간결 요약)
    # =========================================================
    elif topic_name == '/diagnostics':
        status_list = msg.get('status', []) or []
    
        # 기본값
        overall_level = 0
        summary = "정상"
    
        for s in status_list:
            lvl = int(s.get('level', 0))
            name = (s.get('name') or '').lower()
            message = (s.get('message') or '').lower()
    
            if lvl > overall_level:
                overall_level = lvl
    
            # level 2: 오류
            if lvl == 2:
                if ("lidar" in name or "connect" in message or "lost" in message):
                    summary = "센서 끊김"
                else:
                    summary = "시스템 오류"
                overall_level = 2
                break
            
            # level 1: 경고
            elif lvl == 1 and overall_level < 2:
                if "temp" in message or "temperature" in message:
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
                "status": summary,   # ✅ 한 줄 요약
                "color": color       # ✅ 색상
            }
        }


    # =========================================================
    # 📷 9. Camera Image (optional - base64 인코딩)
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
    # ⚙️ 기타 / 처리되지 않은 토픽
    # =========================================================
    else:
        print(f"[WARN] 처리되지 않은 토픽: {topic_name}")
        return None