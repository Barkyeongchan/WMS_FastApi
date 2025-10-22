document.addEventListener('DOMContentLoaded', () => {

    const toggleBtn = document.getElementById("togglebtn");
    const sidebar = document.getElementById("sidebar");
    const mainScreen = document.getElementById("main_screen");
    const userIcon = document.getElementById("user_icon");
    const userMenu = document.getElementById("user_menu");
    const poseOutput = document.getElementById("pose_output"); // pose 표시 위치

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
        console.log("[CLIENT] ✅ WebSocket connected to EC2");

        // 서버에 초기 데이터 요청
        ws.send("init_request");
        console.log("[CLIENT] 초기 데이터 요청 전송");
    };

    // 서버로부터 메시지 수신 시
    ws.onmessage = (event) => {
        console.log("[CLIENT] Received:", event.data);

        try {
            const data = JSON.parse(event.data);
            const poseEl = document.querySelector(".log_text");

            // pose 값 표시
            poseEl.innerText =
                `X: ${data.x}, Y: ${data.y}, θ: ${data.theta}, ` +
                `Linear: ${data.linear_velocity}, Angular: ${data.angular_velocity}`;
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
});