document.addEventListener('DOMContentLoaded', () => {

    const toggleBtn = document.getElementById("togglebtn");
    const sidebar = document.getElementById("sidebar");
    const mainScreen = document.getElementById("main_screen");
    const userIcon = document.getElementById("user_icon");
    const userMenu = document.getElementById("user_menu");
    const poseOutput = document.getElementById("pose_output"); // pose 표시 위치
    const controlToggle = document.getElementById("control_toggle"); // 조종 모드 버튼

    let controlMode = false; // 조종 모드 상태 (OFF 기본값)

    // 사이드바 슬라이드
    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("closed");
        mainScreen.classList.toggle("expanded");
    });

    // 유저 메뉴 토글
    userIcon.addEventListener("click", () => {
        userMenu.style.display = userMenu.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (event) => {
        if (!userIcon.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.style.display = "none";
        }
    });

    console.log("WMS Dashboard JS Loaded");

    // EC2 WebSocket 연결 (pose 데이터 표시)
    const ws = new WebSocket("ws://" + window.location.host + "/ws");

    // 연결 성공 시
    ws.onopen = () => {
        console.log("[CLIENT] WebSocket connected to EC2");
        ws.send("init_request");
        console.log("[CLIENT] 초기 데이터 요청 전송");
    };

    // 서버로부터 메시지 수신 시
    ws.onmessage = (event) => {
        console.log("[CLIENT] Received:", event.data);

        try {
            const msg = JSON.parse(event.data);
            const poseEl = document.querySelector(".log_text");

            // pose 데이터일 때만 표시
            if (msg.type === "turtle_pose" && msg.payload) {
                const p = msg.payload;
                poseEl.innerText =
                    `X: ${p.x}, Y: ${p.y}, θ: ${p.theta}, ` +
                    `Linear: ${p.linear_velocity}, Angular: ${p.angular_velocity}`;
            }
        } catch {
            console.warn("[CLIENT] Non-JSON message:", event.data);
        }
    };

    // 연결 종료
    ws.onclose = () => {
        console.warn("[CLIENT] WebSocket disconnected");
    };

    // 오류 발생 시
    ws.onerror = (error) => {
        console.error("[CLIENT] WebSocket error:", error);
    };

    // 조종 모드 토글 버튼 클릭 시
    controlToggle.addEventListener("click", () => {
        controlMode = !controlMode; // 상태 반전

        if (controlMode) {
            controlToggle.textContent = "조종 모드 ON";
            controlToggle.classList.add("active");
            console.log("[CLIENT] 조종 모드 활성화");
        } else {
            controlToggle.textContent = "조종 모드 OFF";
            controlToggle.classList.remove("active");
            console.log("[CLIENT] 조종 모드 비활성화");
        }
    });

    // 키보드 입력 감지 (조종 모드 ON일 때만 동작)
    document.addEventListener("keydown", (event) => {
        if (!controlMode) return; // 조종 모드 OFF면 무시

        let command = null;

        switch (event.key) {
            case "ArrowUp":
                command = "up";
                break;
            case "ArrowDown":
                command = "down";
                break;
            case "ArrowLeft":
                command = "left";
                break;
            case "ArrowRight":
                command = "right";
                break;
        }

        // WebSocket 연결이 유지 중일 때만 전송
        if (command && ws.readyState === WebSocket.OPEN) {
            const msg = {
                type: "control",
                payload: { command: command }
            };
            ws.send(JSON.stringify(msg));
            console.log("[CLIENT] →", msg);
        }
    });
});