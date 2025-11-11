def process_ros_data(topic_name, msg):
    """ROS 토픽 데이터 가공 (JSON 직렬화용)"""

    # 🦾 Odometry (로봇 위치/속도)
    if topic_name == '/odom':
        pose = msg['pose']['pose']
        twist = msg['twist']['twist']
        return {
            "type": "odom",
            "position": {
                "x": round(pose['position']['x'], 3),
                "y": round(pose['position']['y'], 3),
                "z": round(pose['position']['z'], 3)
            },
            "orientation": pose['orientation'],
            "linear": twist['linear'],
            "angular": twist['angular']
        }

    # 🧭 AMCL 위치
    elif topic_name == '/amcl_pose':
        pose = msg['pose']['pose']
        return {
            "type": "amcl_pose",
            "x": round(pose['position']['x'], 3),
            "y": round(pose['position']['y'], 3),
            "orientation": pose['orientation']
        }

    # 🔋 배터리 상태
    elif topic_name in ['/battery', '/battery_state']:
        percentage = msg.get('percentage', 0.0)
        if percentage <= 1.0:  # 0~1.0이면 0~100으로 변환
            percentage *= 100.0
        return {
            "type": "battery",
            "voltage": round(msg.get('voltage', 0.0), 2),
            "level": round(percentage, 2)  # ✅ level 키로 통일 (JS와 매칭)
        }

    # 🚗 속도 명령 (Twist)
    elif topic_name == '/cmd_vel':
        linear = msg['linear']
        angular = msg['angular']
        return {
            "type": "cmd_vel",
            "linear_x": round(linear['x'], 3),
            "angular_z": round(angular['z'], 3)
        }

    # 🧍 로봇 실제 좌표
    elif topic_name == '/base_link':
        pose = msg['pose']
        return {
            "type": "base_link",
            "position": pose['position'],
            "orientation": pose['orientation']
        }

    # 🗺️ 자율주행 경로
    elif topic_name == '/nav':
        path = msg['poses']
        simplified = [{"x": p['pose']['position']['x'], "y": p['pose']['position']['y']} for p in path]
        return {
            "type": "nav",
            "path_points": simplified[:50]  # 최대 50개까지만 전송
        }

    # 🎮 수동 조작 키입력
    elif topic_name == '/teleop_key':
        return {
            "type": "teleop_key",
            "key": msg.get('data', '')
        }

    # 🧩 진단 메시지
    elif topic_name == '/diagnostics':
        status = msg['status'][0] if msg['status'] else {}
        return {
            "type": "diagnostics",
            "name": status.get('name', ''),
            "message": status.get('message', ''),
            "level": status.get('level', 0)
        }

    # 🧭 YAML/PGM 지도 메타데이터
    elif topic_name in ['/yaml', '/pgm']:
        return {
            "type": topic_name.strip('/'),
            "data": msg.get('data', '')
        }

    else:
        print(f"[WARN] 처리되지 않은 토픽: {topic_name}")
        return None