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

  // [ADD] 시스템 상태 요소
  const sysStatusEl = document.querySelector(".value.system_status");

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

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  // ====== WebSocket 연결 ======
  const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
  const ws = new WebSocket(WS_URL);

  // [NEW] 상태 수신 타임아웃을 위한 타임스탬프
  let lastStatusAt = 0;
  let wsOpenedAt = 0;
  let initStatusTimeout = null;

  ws.onopen = () => {
    console.log("[WS] Connected ✅", WS_URL);
    wsOpenedAt = Date.now();
    ws.send(JSON.stringify({ type: "init_request" }));

    // [CHANGE] 여기서 바로 '해제됨'으로 덮어쓰지 않음
    if (netStatusEl) {
      netStatusEl.textContent = "동기화 중…";
      netStatusEl.style.color = "#999";
    }

    // [NEW] 1.5초 내에 status가 안 오면 해제됨으로 표시
    if (initStatusTimeout) clearTimeout(initStatusTimeout);
    initStatusTimeout = setTimeout(() => {
      if (lastStatusAt < wsOpenedAt) {
        if (netStatusEl) {
          netStatusEl.textContent = "해제됨";
          netStatusEl.style.color = "#e74c3c";
        }
      }
    }, 1500);
  };

  ws.onerror = (err) => console.error("[WS] Error:", err);
  ws.onclose = () => {
    console.warn("[WS] Disconnected ❌");
    if (initStatusTimeout) {
      clearTimeout(initStatusTimeout);
      initStatusTimeout = null;
    }
  };

  // keep-alive
  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
  }, 25000);
  window.addEventListener("beforeunload", () => {
    clearInterval(pingTimer);
    if (initStatusTimeout) clearTimeout(initStatusTimeout);
  });

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // ✅ 연결 상태 표시
      if (data.type === "status") {
        lastStatusAt = Date.now(); // [NEW] 상태 수신 시각 업데이트

        const { robot_name, ip, connected } = data.payload || {};
        console.log(`[STATUS] ${robot_name || "-"} (${ip || "-"}) connected=${connected}`);
        if (netStatusEl) {
          netStatusEl.textContent = connected ? "연결됨" : "해제됨";
          netStatusEl.style.color = connected ? "#2ecc71" : "#e74c3c";
        }

        if (!connected) {
          updateBattery(0);

          const sysRow = document.querySelector(".value.system_status");
          if (sysRow) { sysRow.textContent = "-"; sysRow.style.color = "#999"; }

          const posRow = document.querySelector(".status_row .value.position_value");
          if (posRow) posRow.textContent = "( - , - )";

          const speedRow = document.querySelector(".status_row.gauge_row .value.small");
          if (speedRow) speedRow.textContent = "0.00 m/s";

          const speedBar = document.querySelector(".bar_fill.speed");
          if (speedBar) {
            speedBar.style.width = "0%";
            speedBar.style.background = "linear-gradient(90deg, #ccc, #999)";
          }

          // [ADD] 연결 해제 시 시스템 표시 초기화
          if (sysStatusEl) {
            sysStatusEl.textContent = "-";
            sysStatusEl.style.color = "#999";
          }
        }
      }

      // ✅ 배터리 처리
      if (data.type === "battery") {
        let level =
          data?.payload?.percentage ??
          data?.payload?.level ??
          data?.percentage ??
          data?.level;

        if (level == null || isNaN(level)) return;
        if (level <= 1) level *= 100;
        level = Math.max(0, Math.min(100, level));

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

      // ✅ 위치 및 속도 데이터 실시간 갱신
      if (data.type === "odom") {
        try {
          const pos = data.payload?.position || {};
          const lin = data.payload?.linear || {};
          const ang = data.payload?.angular || {};

          const posRow = document.querySelector(".status_row .value.position_value");
          if (posRow) {
            posRow.textContent = `(${pos.x?.toFixed(1) ?? "-"}, ${pos.y?.toFixed(1) ?? "-"})`;
          }

          const linearX = lin.x ?? 0;
          const speed = Math.abs(linearX);
          const speedValue = `${speed.toFixed(2)} m/s`;

          const speedRow = document.querySelector(".status_row.gauge_row .value.small");
          if (speedRow) speedRow.textContent = speedValue;

          const speedBar = document.querySelector(".bar_fill.speed");
          if (speedBar) {
            const percent = Math.min((speed / 1.0) * 100, 100);
            speedBar.style.width = `${percent}%`;

            if (percent < 40) {
              speedBar.style.background = "linear-gradient(90deg, #3498db, #2980b9)";
            } else if (percent < 80) {
              speedBar.style.background = "linear-gradient(90deg, #2ecc71, #27ae60)";
            } else {
              speedBar.style.background = "linear-gradient(90deg, #e74c3c, #c0392b)";
            }
          }
        } catch (e) {
          console.error("odom 처리 오류:", e);
        }
      }

      // ✅ [ADD] 시스템 상태 처리 (/diagnostics)
      if (data.type === "diagnostics") {
        const status = data.payload?.status ?? "-";
        const color  = data.payload?.color  ?? "#999";
        if (sysStatusEl) {
          sysStatusEl.textContent = status;
          sysStatusEl.style.color = color;
        }
      }

    } catch (err) {
      console.error("[WS 메시지 처리 오류]", err);
    }
  };

  // ====== 로봇 목록 로드 ======
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

        // [NEW] 1) 우선 REST로 현재 상태 받아서 즉시 UI 반영
        try {
          const st = await fetch(`/robots/status/${savedId}`);
          if (st.ok) {
            const s = await st.json();
            if (netStatusEl) {
              if (s?.connected) {
                netStatusEl.textContent = "연결됨";
                netStatusEl.style.color = "#2ecc71";
              } else {
                netStatusEl.textContent = "해제됨";
                netStatusEl.style.color = "#e74c3c";
              }
            }
          }
        } catch (e) {
          console.warn("초기 상태 조회 실패:", e);
        }

        // [NEW] 2) 이어서 자동 연결 요청(WS 동기화 트리거)
        await connectRobot(savedId);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ====== 로봇 연결 요청 ======
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
    } catch (err) {
      console.error("[로봇 연결 요청 오류]", err);
    } finally {
      setTimeout(() => {
        connectBusy = false;
        selectEl.disabled = false;
      }, 300);
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

  // ✅ 배터리 게이지 업데이트 함수
  function updateBattery(level) {
    const rows = document.querySelectorAll(".status_row.gauge_row");
    let batteryRow = null;
    rows.forEach(row => {
      const label = row.querySelector(".label");
      if (label && label.textContent.trim().includes("배터리")) {
        batteryRow = row;
      }
    });
    if (!batteryRow) return;

    const bar = batteryRow.querySelector(".bar_fill.battery");
    const textEl = batteryRow.querySelector(".value.small");

    if (bar) bar.style.width = level.toFixed(0) + "%";
    if (textEl) textEl.textContent = level.toFixed(0) + "%";

    if (bar) {
      if (level < 20) {
        bar.style.background = "linear-gradient(90deg, #e74c3c, #c0392b)";
      } else {
        bar.style.background = "";
        bar.classList.add("battery");
      }
    }
  }

  // ==========================
  // 🚀 [ADD] 로봇 제어 - 속도 단계별 제한 (슬라이더 기반)
  // ==========================

  const MAX_SPEED = { 1: 0.2, 2: 0.4, 3: 0.6 };
  let currentSpeedLevel = 1;

  const speedSlider = document.getElementById("speed_slider");
  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      currentSpeedLevel = Number(e.target.value);
      console.log(`[속도 단계] ${currentSpeedLevel}단 (${MAX_SPEED[currentSpeedLevel]} m/s)`);
    });
  }

  function sendVelocity(linearX, angularZ) {
    if (ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] 연결 안됨, 명령 전송 불가");
      return;
    }

    const maxV = MAX_SPEED[currentSpeedLevel];
    const clampedLinear = Math.max(-maxV, Math.min(maxV, linearX));
    const clampedAngular = Math.max(-1.0, Math.min(1.0, angularZ));

    const msg = {
      type: "cmd_vel",
      payload: {
        linear: { x: clampedLinear, y: 0.0, z: 0.0 },
        angular: { x: 0.0, y: 0.0, z: clampedAngular },
        gear: currentSpeedLevel
      },
    };

    ws.send(JSON.stringify(msg));
    console.log(`[CMD] 전송 → linear=${clampedLinear.toFixed(2)} / angular=${clampedAngular.toFixed(2)} (${currentSpeedLevel}단)`);
  }

  // 초기 로드
  loadRobotList();  
});