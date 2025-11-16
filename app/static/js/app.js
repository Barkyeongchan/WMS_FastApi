document.addEventListener("DOMContentLoaded", () => {
    console.log("📱 APP 로드");

    const ws = new WebSocket("ws://localhost:8000/ws");

    const statusText  = document.getElementById("status_text");
    const actionBtn   = document.getElementById("action_btn");
    const robotNameEl = document.getElementById("robot_name");

    let activeRobot = null;
    let stage = "IDLE";  
    // IDLE → MOVING → ARRIVED → RETURNING → IDLE

    actionBtn.style.display = "none";   // 확인 버튼은 기본 비활성화

    ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);

        // ============================================================
        // 🔵 로봇 연결 상태
        // ============================================================
        if (data.type === "status") {
            activeRobot = data.payload.robot_name;
            const connected = data.payload.connected;

            robotNameEl.textContent =
                connected ? `로봇: ${activeRobot}` : `로봇: 미연결`;

            return;
        }

        // ============================================================
        // 🔵 서버가 보내는 상태 업데이트 (robot_status)
        // ============================================================
        if (data.type === "robot_status") {
            const state = data.payload.state;

            // 서버 기준 상태 문자열: 이동중 / 복귀중 / 대기중 / 도착
            switch (state) {
                case "이동중":
                    stage = "MOVING";
                    statusText.textContent = "상태: 이동중";
                    actionBtn.style.display = "none";
                    break;

                case "복귀중":
                    stage = "RETURNING";
                    statusText.textContent = "상태: 복귀중";
                    actionBtn.style.display = "none";
                    break;

                case "대기중":
                    stage = "IDLE";
                    statusText.textContent = "상태: 대기중";
                    actionBtn.style.display = "none";
                    break;

                case "도착":
                    // 실제 도착 신호는 robot_arrived에서 처리함
                    break;
            }

            return;
        }

        // ============================================================
        // 🔵 도착 이벤트 (robot_arrived)
        // ============================================================
        if (data.type === "robot_arrived") {
            const pin = data.payload.pin;

            // --- 정상 목적지 도착 ---
            if (pin !== "WAIT") {
                stage = "ARRIVED";
                statusText.textContent = "상태: 도착!";
                actionBtn.textContent = "확인";
                actionBtn.style.display = "block";
            }
            // --- WAIT 도착 = 복귀 완료 ---
            else {
                stage = "IDLE";
                statusText.textContent = "상태: 대기중";
                actionBtn.style.display = "none";
            }
        }
    };

    // ============================================================
    // 🔵 확인 버튼 (도착 → 복귀 시작)
    // ============================================================
    actionBtn.addEventListener("click", () => {
        if (stage !== "ARRIVED") return;

        // 서버에 "complete" 요청
        ws.send(JSON.stringify({ type: "complete_stock_move" }));

        stage = "RETURNING";
        statusText.textContent = "상태: 복귀중";
        actionBtn.style.display = "none";
    });
});