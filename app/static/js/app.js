document.addEventListener("DOMContentLoaded", () => {
    console.log("📱 APP 로드");

    const ws = new WebSocket("ws://localhost:8000/ws");

    const statusText  = document.getElementById("status_text");
    const actionBtn   = document.getElementById("action_btn");
    const robotNameEl = document.getElementById("robot_name");

    let activeRobot = null;
    let stage = "IDLE";  
    // IDLE → MOVING → ARRIVED → RETURNING → IDLE

    // 버튼은 확실히 "확인" 상황에서만 보인다
    actionBtn.style.display = "none";

    ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);

        // 🔵 로봇 연결/상태 정보
        if (data.type === "status") {
            activeRobot = data.payload.robot_name;
            const connected = data.payload.connected;

            robotNameEl.textContent =
                connected ? `로봇: ${activeRobot}` : `로봇: 미연결`;
            return;
        }

        // 🔵 로봇 상태 변경 (대시보드에서 작업 시작 시 서버가 publish)
        if (data.type === "robot_status") {
            const state = data.payload.state;

            // 서버에서 오는 상태 기준
            if (state === "moving") {
                stage = "MOVING";
                statusText.textContent = "상태: 이동중";
                actionBtn.style.display = "none";
            }

            return;
        }

        // 🔵 목적지 도착 이벤트
        if (data.type === "robot_arrived") {
            const pin = data.payload.pin;

            if (pin !== "HOME") {
                // 목적지 도착
                stage = "ARRIVED";
                statusText.textContent = "상태: 도착!";
                actionBtn.textContent = "확인";
                actionBtn.style.display = "block";
            }
            else {
                // HOME 복귀 도착
                stage = "IDLE";
                statusText.textContent = "상태: 대기중";
                actionBtn.style.display = "none";
            }
        }
    };

    // 🔵 확인 버튼 (arrived → returning)
    actionBtn.addEventListener("click", () => {
        if (stage !== "ARRIVED") return;

        // DB 업데이트 + 복귀 명령
        ws.send(JSON.stringify({
            type: "complete_stock_move"
        }));

        stage = "RETURNING";
        statusText.textContent = "상태: 복귀중";
        actionBtn.style.display = "none";
    });
});