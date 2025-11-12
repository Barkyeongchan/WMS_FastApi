document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ WMS Robot Page Loaded");

  // ====== DOM 캐시 ======
  const selectEl = document.getElementById("robot_select");
  const deleteSelect = document.getElementById("robot_delete_select");
  const addBtn = document.getElementById("btn_add_robot");
  const deleteBtn = document.getElementById("btn_delete_robot");
  const nameInput = document.getElementById("robot_name_input");
  const ipInput = document.getElementById("robot_ip_input");
  const netStatusEl = document.querySelector(".value.network_status");

  // 🔹 모달 관련 요소
  const openModalBtn  = document.getElementById("open_modal_btn");
  const modal         = document.getElementById("robot_modal");
  const modalCloseBtn = document.getElementById("modal_close_btn");

  const STORAGE_KEY = "last_selected_robot";

  // ====== 모달 헬퍼 ======
  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // 스크롤 잠금
    // 첫 입력 포커스
    if (nameInput) nameInput.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = ""; // 스크롤 복원
  }

  // 🔹 모달 이벤트 바인딩
  if (openModalBtn) openModalBtn.addEventListener("click", openModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);

  // 바깥 영역 클릭 시 닫기
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  // ESC로 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  // ====== WebSocket 연결 ======
  const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("[WS] Connected ✅", WS_URL);
    ws.send(JSON.stringify({ type: "init_request" }));
    // UI 초기상태
    if (netStatusEl) {
      netStatusEl.textContent = "해제됨";
      netStatusEl.style.color = "#e74c3c";
    }
  };
  ws.onerror = (err) => console.error("[WS] Error:", err);
  ws.onclose = () => console.warn("[WS] Disconnected ❌");

  // keep-alive
  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
  }, 25000);
  window.addEventListener("beforeunload", () => clearInterval(pingTimer));

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // ✅ 연결 상태 표시는 WS 메시지 기준으로만
      if (data.type === "status") {
        const { robot_name, ip, connected } = data.payload || {};
        console.log(`[STATUS] ${robot_name || "-"} (${ip || "-"}) connected=${connected}`);
        if (netStatusEl) {
          netStatusEl.textContent = connected ? "연결됨" : "해제됨";
          netStatusEl.style.color = connected ? "#2ecc71" : "#e74c3c";
        }
      }

      // ✅ 배터리 처리
      if (data.type === "battery") {
        // payload 우선, 그 다음 루트 레벨 fallback
        let level =
          data?.payload?.percentage ??
          data?.payload?.level ??
          data?.percentage ??
          data?.level;

        if (level == null || isNaN(level)) return;
        if (level <= 1) level *= 100; // 0~1 → 0~100 변환
        level = Math.max(0, Math.min(100, level));

        // "배터리" 라벨 가진 행 찾기
        const rows = document.querySelectorAll(".status_row.gauge_row");
        let batteryRow = null;
        rows.forEach((row) => {
          const label = row.querySelector(".label");
          if (label && label.textContent.trim().includes("배터리")) batteryRow = row;
        });
        if (!batteryRow) return;

        const bar = batteryRow.querySelector(".bar_fill.battery");
        const textEl = batteryRow.querySelector(".value.small");

        if (bar) bar.style.width = `${level.toFixed(0)}%`;
        if (textEl) textEl.textContent = `${level.toFixed(0)}%`;

        if (bar) {
          if (level < 20) {
            bar.style.background = "linear-gradient(90deg, #e74c3c, #c0392b)";
          } else {
            bar.style.background = "";
            bar.classList.add("battery");
          }
        }

        console.log(`[BATTERY] ${data?.payload?.robot_name || "-"} → ${level.toFixed(0)}%`);
      }
    } catch (err) {
      console.error("[WS 메시지 처리 오류]", err);
    }
  };

  // ====== 로봇 목록 로드 (+ 마지막 선택 복원) ======
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
        selectEl.appendChild(op1);

        const op2 = document.createElement("option");
        op2.value = r.id;
        op2.textContent = r.name;
        deleteSelect.appendChild(op2);
      });

      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId && selectEl.querySelector(`option[value='${savedId}']`)) {
        selectEl.value = savedId;
        console.log(`[RESTORE] 마지막 선택된 로봇 복원: ${savedId}`);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ====== 로봇 연결 요청 (디바운스/중복 방지) ======
  let connectBusy = false;
  async function connectRobot(id) {
    if (connectBusy || !id) return;
    connectBusy = true;
    selectEl.disabled = true;
    try {
      const res = await fetch(`/robots/connect/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("연결 요청 실패");
      const data = await res.json();
      console.log(`[CONNECT] ${data.message}`);
      localStorage.setItem(STORAGE_KEY, id);
      // ⚠️ UI는 WS 'status' 메시지로만 갱신 (여기서는 바꾸지 않음)
    } catch (err) {
      console.error("[로봇 연결 요청 오류]", err);
    } finally {
      setTimeout(() => {
        connectBusy = false;
        selectEl.disabled = false;
      }, 300); // 짧은 디바운스
    }
  }

  // ====== 이벤트 등록 ======
  if (selectEl) {
    selectEl.addEventListener("change", async () => {
      const id = selectEl.value;
      await connectRobot(id);
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const name = nameInput?.value?.trim();
      const ip = ipInput?.value?.trim();
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
        await loadRobotList();
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const id = deleteSelect.value;
      if (!id) return alert("삭제할 로봇 선택");
      await fetch(`/robots/${id}`, { method: "DELETE" });
      await loadRobotList();
    });
  }

  // 초기 로드
  loadRobotList();
});