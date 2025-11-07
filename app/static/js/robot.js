document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ WMS Robot Page Loaded");

  // ===============================
  // ✅ 엘리먼트 캐싱
  // ===============================
  const autoBtn = document.getElementById("auto_mode");
  const manualBtn = document.getElementById("manual_mode");
  const manualLock = document.getElementById("manual_lock");
  const directionButtons = document.querySelectorAll(".dir_btn");
  const speedSlider = document.getElementById("speed_slider");
  const returnBtn = document.querySelector(".control_btn.return");
  const stopBtn = document.querySelector(".control_btn.stop");
  const modal = document.getElementById("robot_modal");
  const modalCloseBtn = document.getElementById("modal_close_btn");
  const addBtn = document.getElementById("btn_add_robot");
  const deleteBtn = document.getElementById("btn_delete_robot");
  const nameInput = document.getElementById("robot_name_input");
  const ipInput = document.getElementById("robot_ip_input");
  const openModalBtn = document.getElementById("open_modal_btn");
  const selectEl = document.getElementById("robot_select");
  const deleteSelect = document.getElementById("robot_delete_select");
  const pinSelect = document.getElementById("pin_select");
  const moveBtn = document.querySelector(".control_btn.move_btn");
  const modeStatusEl = document.querySelector(".value.mode");
  const netStatusEl = document.querySelector(".value.network_status"); // ✅ 네트워크 상태 표시

  let currentMode = "auto";

  // ✅ 마지막 선택 로봇 기억용 키
  const STORAGE_KEY = "last_selected_robot";

  // ===============================
  // ✅ WebSocket 연결
  // ===============================
  const ws = new WebSocket("ws://13.209.253.230:8000/ws");

  ws.onopen = () => {
    console.log("[WS] Connected to EC2 ✅");
    // 초기 연결 시 "init_request"를 보내 최근 상태 요청
    ws.send("init_request");
  };

  ws.onerror = (err) => console.error("[WS] Error:", err);
  ws.onclose = () => console.warn("[WS] Disconnected from EC2 ❌");

  // ✅ EC2 → 웹 수신 메시지 처리
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "status") {
        const { robot_name, ip, connected } = data.payload;
        console.log(`[STATUS] ${robot_name} (${ip}) → connected=${connected}`);

        if (netStatusEl) {
          netStatusEl.textContent = connected ? "연결됨" : "해제됨";
          netStatusEl.style.color = connected ? "#2ecc71" : "#e74c3c";
        } else {
          console.warn("⚠️ network_status 요소를 찾을 수 없습니다.");
        }
      }

      // === ✅ 배터리 상태 반영 ===
      else if (data.type === "battery") {
        const { robot_name, level } = data.payload;
        console.log(`[BATTERY] ${robot_name} → ${level}%`);
      
        // HTML 요소 찾기
        const batteryBar = document.querySelector(".bar_fill.battery");
        const batteryText = document.querySelector(
          ".status_row.gauge_row:nth-of-type(4) .value.small"
        );
      
        if (batteryBar && batteryText) {
          const percent = Math.max(0, Math.min(100, Number(level))); // 0~100 제한
          batteryBar.style.width = `${percent}%`;
          batteryText.textContent = `${percent.toFixed(1)}%`;
        }
      }

      // 추후 다른 타입 추가 시 여기에 else if 추가
    } catch (err) {
      console.error("[WS 메시지 처리 오류]", err);
    }
  };

  // ===============================
  // ✅ 모드 전환
  // ===============================
  function updateModeStatus(mode) {
    if (!modeStatusEl) return;
    modeStatusEl.classList.remove("auto", "manual");
    if (mode === "auto") {
      modeStatusEl.classList.add("auto");
      modeStatusEl.textContent = "자동";
    } else {
      modeStatusEl.classList.add("manual");
      modeStatusEl.textContent = "수동";
    }
  }

  autoBtn.addEventListener("click", () => {
    if (currentMode === "auto") return;
    currentMode = "auto";
    autoBtn.classList.add("active");
    manualBtn.classList.remove("active");
    manualLock.classList.add("active");
    directionButtons.forEach((btn) => {
      btn.disabled = true;
      btn.classList.remove("active");
    });
    updateModeStatus("auto");
  });

  manualBtn.addEventListener("click", () => {
    if (currentMode === "manual") return;
    currentMode = "manual";
    manualBtn.classList.add("active");
    autoBtn.classList.remove("active");
    manualLock.classList.remove("active");
    directionButtons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.add("active");
    });
    updateModeStatus("manual");
  });

  manualLock.classList.add("active");
  directionButtons.forEach((btn) => {
    btn.disabled = true;
    btn.classList.remove("active");
  });
  updateModeStatus("auto");

  // ===============================
  // ✅ 모달 열고 닫기
  // ===============================
  openModalBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  modalCloseBtn.addEventListener("click", () => modal.classList.add("hidden"));

  // ===============================
  // ✅ 로봇 목록 불러오기
  // ===============================
  async function loadRobotList() {
    try {
      const res = await fetch("/robots/");
      if (!res.ok) throw new Error("로봇 목록 불러오기 실패");
      const robots = await res.json();

      selectEl.innerHTML = "";
      deleteSelect.innerHTML = "";

      robots.forEach((r) => {
        const op1 = document.createElement("option");
        op1.value = r.id;
        op1.textContent = `${r.name} (${r.ip})`;
        op1.dataset.name = r.name;
        op1.dataset.ip = r.ip;
        selectEl.appendChild(op1);

        const op2 = document.createElement("option");
        op2.value = r.id;
        op2.textContent = r.name;
        deleteSelect.appendChild(op2);
      });

      // ✅ 저장된 로봇 자동 복원
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId && selectEl.querySelector(`option[value='${savedId}']`)) {
        selectEl.value = savedId;
        console.log(`[RESTORE] 마지막 선택된 로봇 복원: ${savedId}`);
        await connectRobot(savedId, false); // 자동 연결
      }
    } catch (err) {
      console.error("[로봇 목록 불러오기 오류]", err);
    }
  }

  // ✅ 로봇 연결 요청 함수 (복원용 포함)
  async function connectRobot(id, showAlert = true) {
    if (!id) return;
    try {
      const res = await fetch(`/robots/connect/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("연결 요청 실패");
      const data = await res.json();

      // ✅ 선택 로봇 로컬스토리지 저장
      localStorage.setItem(STORAGE_KEY, id);

      if (showAlert) {
        alert(`✅ ${data.message}`);
      }
      console.log(`[CONNECT] ${data.message}`);
    } catch (err) {
      console.error("[로봇 연결 요청 오류]", err);
      if (showAlert) alert("❌ 연결 요청 중 오류 발생");
    }
  }

  // ✅ 로봇 선택 시 EC2로 연결 요청
  selectEl.addEventListener("change", async () => {
    const selectedId = selectEl.value;
    if (!selectedId) return;
    await connectRobot(selectedId);
  });

  // ===============================
  // ✅ 로봇 추가
  // ===============================
  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();
    if (!name || !ip) return alert("⚠ 로봇 이름과 IP를 모두 입력하세요.");

    try {
      const res = await fetch("/robots/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ip }),
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(`❌ 등록 실패: ${errData.detail || "서버 오류"}`);
        return;
      }

      const data = await res.json();
      alert(`✅ 로봇 '${data.name}' 추가 완료`);
      nameInput.value = "";
      ipInput.value = "";
      loadRobotList();
    } catch (error) {
      console.error("[로봇 추가 오류]", error);
      alert("❌ 서버 오류가 발생했습니다.");
    }
  });

  // ✅ 로봇 삭제
  deleteBtn.addEventListener("click", async () => {
    const id = deleteSelect.value;
    if (!id) return alert("삭제할 로봇을 선택하세요.");
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/robots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      alert("🗑 로봇 삭제 완료");

      // ✅ 삭제된 로봇이 마지막 선택 로봇이면 기록 제거
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId === id) localStorage.removeItem(STORAGE_KEY);

      loadRobotList();
    } catch (err) {
      console.error("[삭제 오류]", err);
      alert("❌ 삭제 중 오류 발생");
    }
  });

  // ===============================
  // ✅ 핀 목록 로드
  // ===============================
  async function loadPins() {
    try {
      const res = await fetch("/pins/");
      if (!res.ok) throw new Error("핀 목록 불러오기 실패");
      const pins = await res.json();

      pinSelect.innerHTML = '<option value="">핀 선택</option>';
      pins.forEach((pin) => {
        const op = document.createElement("option");
        op.value = pin.coords || "";
        op.textContent = pin.name;
        pinSelect.appendChild(op);
      });
    } catch (err) {
      console.error("[핀 목록 로드 오류]", err);
      pinSelect.innerHTML = '<option value="">로드 실패</option>';
    }
  }

  // ✅ 핀 이동 명령
  if (moveBtn) {
    moveBtn.addEventListener("click", async () => {
      const selected = pinSelect.value;
      if (!selected) return alert("이동할 핀을 선택하세요.");
      try {
        const [x, y] = selected.split(",").map(Number);
        if (isNaN(x) || isNaN(y)) {
          alert("좌표 형식이 잘못되었습니다.");
          return;
        }
        console.log(`📍 이동 명령 전송됨 → X:${x}, Y:${y}`);
        alert(`✅ 로봇이 (${x}, ${y}) 위치로 이동 명령 전송됨`);
      } catch (err) {
        console.error("[이동 명령 오류]", err);
        alert("❌ 이동 중 오류 발생");
      }
    });
  }

  // ✅ 초기 실행
  loadRobotList();
  loadPins();
});