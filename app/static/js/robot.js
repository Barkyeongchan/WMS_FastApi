document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ WMS Robot Page Loaded");

  const selectEl = document.getElementById("robot_select");
  const deleteSelect = document.getElementById("robot_delete_select");
  const addBtn = document.getElementById("btn_add_robot");
  const deleteBtn = document.getElementById("btn_delete_robot");
  const nameInput = document.getElementById("robot_name_input");
  const ipInput = document.getElementById("robot_ip_input");
  const netStatusEl = document.querySelector(".value.network_status");

  const STORAGE_KEY = "last_selected_robot";

  // --------------------------
  // ✅ WebSocket 연결
  // --------------------------
  const ws = new WebSocket("ws://localhost:8000/ws");

  ws.onopen = () => {
    console.log("[WS] Connected ✅");
    ws.send(JSON.stringify({ type: "init_request" }));
  };
  ws.onerror = (err) => console.error("[WS] Error:", err);
  ws.onclose = () => console.warn("[WS] Disconnected ❌");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "status") {
        const { robot_name, ip, connected } = data.payload;
        console.log(`[STATUS] ${robot_name} (${ip}) connected=${connected}`);
        if (netStatusEl) {
          netStatusEl.textContent = connected ? "연결됨" : "해제됨";
          netStatusEl.style.color = connected ? "#2ecc71" : "#e74c3c";
        }
      }
    } catch (err) {
      console.error("[WS 메시지 처리 오류]", err);
    }
  };

  // --------------------------
  // ✅ 로봇 목록 로드 (+복원)
  // --------------------------
  async function loadRobotList() {
    const res = await fetch("/robots/");
    if (!res.ok) return console.error("로봇 목록 불러오기 실패");
    const robots = await res.json();
    selectEl.innerHTML = "";
    deleteSelect.innerHTML = "";

    robots.forEach((r) => {
      const op1 = document.createElement("option");
      op1.value = r.id;
      op1.textContent = `${r.name} (${r.ip})`;
      selectEl.appendChild(op1);

      const op2 = document.createElement("option");
      op2.value = r.id;
      op2.textContent = r.name;
      deleteSelect.appendChild(op2);
    });

    // ✅ 마지막 선택 복원
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId && selectEl.querySelector(`option[value='${savedId}']`)) {
      selectEl.value = savedId;
      console.log(`[RESTORE] 마지막 선택된 로봇 복원: ${savedId}`);
    }
  }

  // --------------------------
  // ✅ 로봇 연결 요청
  // --------------------------
  async function connectRobot(id) {
    try {
      const res = await fetch(`/robots/connect/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("연결 요청 실패");
      const data = await res.json();
      console.log(`[CONNECT] ${data.message}`);
      localStorage.setItem(STORAGE_KEY, id);
    } catch (err) {
      console.error("[로봇 연결 요청 오류]", err);
    }
  }

  // --------------------------
  // ✅ 이벤트 등록
  // --------------------------
  selectEl.addEventListener("change", async () => {
    const id = selectEl.value;
    if (!id) return;
    await connectRobot(id);
  });

  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();
    if (!name || !ip) return alert("이름/IP 입력 필요");
    const res = await fetch("/robots/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ip }),
    });
    if (res.ok) {
      alert("✅ 등록 완료");
      nameInput.value = "";
      ipInput.value = "";
      loadRobotList();
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const id = deleteSelect.value;
    if (!id) return alert("삭제할 로봇 선택");
    await fetch(`/robots/${id}`, { method: "DELETE" });
    loadRobotList();
  });

  // 초기 실행
  loadRobotList();
});