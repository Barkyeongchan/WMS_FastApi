document.addEventListener("DOMContentLoaded", () => {
  console.log("📱 APP 로드");

  // ==============================
  // 🔵 WebSocket URL 안전하게 생성
  // ==============================
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = wsScheme + "://" + window.location.host + "/ws";
  console.log("🔌 WS URL =", wsUrl);

  const ws = new WebSocket(wsUrl);

  const statusText  = document.getElementById("status_text");
  const actionBtn   = document.getElementById("action_btn");
  const robotNameEl = document.getElementById("robot_name");

  let activeRobot = null;
  let stage = "IDLE";  // IDLE → MOVING → ARRIVED → RETURNING → IDLE

  actionBtn.style.display = "none";   // 확인 버튼은 기본 비활성화

  // ==============================
  // 🔵 연결/에러 로그
  // ==============================
  ws.onopen = () => {
    console.log("🟢 WS Connected:", wsUrl);
  };

  ws.onerror = (e) => {
    console.error("🔴 WS Error:", e);
  };

  ws.onclose = (e) => {
    console.warn("🟡 WS Closed:", e.code, e.reason);
    // 끊어지면 UI도 초기화
    robotNameEl.textContent = "로봇: 미연결";
    statusText.textContent = "상태: 대기중";
    actionBtn.style.display = "none";
    stage = "IDLE";
  };

  // ==============================
  // 🔵 메시지 수신
  // ==============================
  ws.onmessage = (ev) => {
    let data;
    try {
      data = JSON.parse(ev.data);
    } catch (err) {
      console.error("❌ JSON 파싱 오류:", ev.data, err);
      return;
    }

    // 디버그용
    console.log("📨 WS MESSAGE:", data);

    const msgType = data.type;

    // ---------------------------------
    // 1) 로봇 연결 상태 (status)
    // ---------------------------------
    if (msgType === "status") {
      const payload = data.payload || {};
      activeRobot = payload.robot_name || null;
      const connected = !!payload.connected;

      robotNameEl.textContent = connected
        ? `로봇: ${activeRobot}`
        : "로봇: 미연결";

      // 연결 끊겼으면 상태/버튼도 초기화
      if (!connected) {
        statusText.textContent = "상태: 대기중";
        actionBtn.style.display = "none";
        stage = "IDLE";
      }

      return;
    }

    // ---------------------------------
    // 2) 서버가 브로드캐스트하는 상태 (robot_status)
    //    state: 이동중 / 복귀중 / 대기중 / 도착
    // ---------------------------------
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
          // 실제 도착 처리는 robot_arrived에서
          break;
      }

      return;
    }

    // ---------------------------------
    // 3) 도착 이벤트 (robot_arrived)
    //    payload.pin: "WAIT" 이면 복귀 완료
    // ---------------------------------
    if (msgType === "robot_arrived") {
      const payload = data.payload || {};
      const pin = payload.pin;

      if (pin !== "WAIT") {
        // 정상 목적지 도착
        stage = "ARRIVED";
        statusText.textContent = "상태: 도착!";
        actionBtn.textContent = "확인";
        actionBtn.style.display = "block";
      } else {
        // 대기장소(=WAIT) 도착 = 복귀 완료
        stage = "IDLE";
        statusText.textContent = "상태: 대기중";
        actionBtn.style.display = "none";
      }

      return;
    }
  };

  // ==============================
  // 🔵 확인 버튼 (도착 → 복귀 시작)
  // ==============================
  actionBtn.addEventListener("click", () => {
    if (stage !== "ARRIVED") return;

    const msg = { type: "complete_stock_move" };
    console.log("📤 WS SEND:", msg);
    ws.send(JSON.stringify(msg));

    stage = "RETURNING";
    statusText.textContent = "상태: 복귀중";
    actionBtn.style.display = "none";
  });
});