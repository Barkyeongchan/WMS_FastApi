document.addEventListener("DOMContentLoaded", () => {
  console.log("APP 로드");

  // WebSocket URL 생성
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = wsScheme + "://" + window.location.host + "/ws";
  console.log("WS URL =", wsUrl);

  // WebSocket 연결
  const ws = new WebSocket(wsUrl);

  // UI 요소 참조
  const statusText  = document.getElementById("status_text");
  const actionBtn   = document.getElementById("action_btn");
  const robotNameEl = document.getElementById("robot_name");

  // 현재 로봇 및 단계 상태
  let activeRobot = null;
  let stage = "IDLE"; // IDLE → MOVING → ARRIVED → RETURNING → IDLE

  // 확인 버튼 초기 비활성화
  actionBtn.style.display = "none";

  // WebSocket 연결 성공
  ws.onopen = () => {
    console.log("WS Connected:", wsUrl);
  };

  // WebSocket 오류 처리
  ws.onerror = (e) => {
    console.error("WS Error:", e);
  };

  // WebSocket 연결 종료 처리
  ws.onclose = (e) => {
    console.warn("WS Closed:", e.code, e.reason);

    robotNameEl.textContent = "로봇: 미연결";
    statusText.textContent = "상태: 대기중";
    actionBtn.style.display = "none";
    stage = "IDLE";
  };

  // WebSocket 메시지 수신
  ws.onmessage = (ev) => {
    let data;
    try {
      data = JSON.parse(ev.data);
    } catch (err) {
      console.error("JSON 파싱 오류:", ev.data, err);
      return;
    }

    console.log("WS MESSAGE:", data);

    const msgType = data.type;

    // 로봇 연결 상태 수신
    if (msgType === "status") {
      const payload = data.payload || {};
      activeRobot = payload.robot_name || null;
      const connected = !!payload.connected;

      robotNameEl.textContent = connected
        ? `로봇: ${activeRobot}`
        : "로봇: 미연결";

      if (!connected) {
        statusText.textContent = "상태: 대기중";
        actionBtn.style.display = "none";
        stage = "IDLE";
      }

      return;
    }

    // 로봇 상태 브로드캐스트 수신
    if (msgType === "robot_status") {
      const payload = data.payload || {};
      const state = payload.state;

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
          break;
      }

      return;
    }

    // 로봇 도착 이벤트 수신
    if (msgType === "robot_arrived") {
      const payload = data.payload || {};
      const pin = payload.pin;

      if (pin !== "WAIT") {
        stage = "ARRIVED";
        statusText.textContent = "상태: 도착!";
        actionBtn.textContent = "확인";
        actionBtn.style.display = "block";
      } else {
        stage = "IDLE";
        statusText.textContent = "상태: 대기중";
        actionBtn.style.display = "none";
      }

      return;
    }
  };

  // 확인 버튼 클릭 처리
  actionBtn.addEventListener("click", () => {
    if (stage !== "ARRIVED") return;

    const msg = { type: "complete_stock_move" };
    console.log("WS SEND:", msg);
    ws.send(JSON.stringify(msg));

    stage = "RETURNING";
    statusText.textContent = "상태: 복귀중";
    actionBtn.style.display = "none";
  });
});