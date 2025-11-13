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

  // 시스템 상태
  const sysStatusEl = document.querySelector(".value.system_status");

  // 모달
  const openModalBtn = document.getElementById("open_modal_btn");
  const modal = document.getElementById("robot_modal");
  const modalCloseBtn = document.getElementById("modal_close_btn");

  const STORAGE_KEY = "last_selected_robot";

  // ====== 모달 ======
  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (nameInput) nameInput.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

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

  // ====== WebSocket ======
  const WS_URL =
    (location.protocol === "https:" ? "wss://" : "ws://") +
    location.host +
    "/ws";
  const ws = new WebSocket(WS_URL);

  let lastStatusAt = 0;
  let wsOpenedAt = 0;
  let initStatusTimeout = null;

  ws.onopen = () => {
    console.log("[WS] Connected ✅", WS_URL);
    wsOpenedAt = Date.now();
    ws.send(JSON.stringify({ type: "init_request" }));

    if (netStatusEl) {
      netStatusEl.textContent = "동기화 중…";
      netStatusEl.style.color = "#999";
    }

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

  const pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: "ping" }));
  }, 25000);

  window.addEventListener("beforeunload", () => {
    clearInterval(pingTimer);
    if (initStatusTimeout) clearTimeout(initStatusTimeout);
  });

  // ====== 배터리 게이지 업데이트 ======
  function updateBattery(level) {
    const rows = document.querySelectorAll(".status_row.gauge_row");
    let batteryRow = null;
    rows.forEach((row) => {
      const label = row.querySelector(".label");
      if (label && label.textContent.trim().includes("배터리"))
        batteryRow = row;
    });
    if (!batteryRow) return;

    const bar = batteryRow.querySelector(".bar_fill.battery");
    const textEl = batteryRow.querySelector(".value.small");

    if (bar) bar.style.width = level.toFixed(0) + "%";
    if (textEl) textEl.textContent = level.toFixed(0) + "%";

    if (bar) {
      if (level < 20) {
        bar.style.background =
          "linear-gradient(90deg, #e74c3c, #c0392b)";
      } else {
        bar.style.background = "";
        bar.classList.add("battery");
      }
    }
  }

  // ====== 속도 정책 (터틀봇3 Burger 전용) ======
  // 자동 / 수동 공통 기어별 최대 선속도 (m/s)
  const MAX_SPEED = { 1: 0.10, 2: 0.15, 3: 0.22 }; // TB3 Burger 공식 최대 0.22m/s
  const MAX_SPEED_DISPLAY = 0.22; // 게이지 기준 최고속도

  let currentSpeedLevel = 1; // 기어(1~3) = 자동/수동 공통
  let currentMode = "auto";  // "auto" | "manual"

  const speedSlider = document.getElementById("speed_slider");
  const modeText = document.querySelector(".value.mode");
  const autoBtn = document.getElementById("auto_mode");
  const manualBtn = document.getElementById("manual_mode");
  const manualLock = document.getElementById("manual_lock");
  const dirButtons = document.querySelectorAll(".dir_btn");

  // ====== WebSocket 메시지 처리 ======
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // 연결 상태
      if (data.type === "status") {
        lastStatusAt = Date.now();

        const { robot_name, ip, connected } = data.payload || {};
        console.log(
          `[STATUS] ${robot_name || "-"} (${ip || "-"}) connected=${connected}`
        );
        if (netStatusEl) {
          netStatusEl.textContent = connected ? "연결됨" : "해제됨";
          netStatusEl.style.color = connected ? "#2ecc71" : "#e74c3c";
        }

        if (!connected) {
          updateBattery(0);

          if (sysStatusEl) {
            sysStatusEl.textContent = "-";
            sysStatusEl.style.color = "#999";
          }

          const posRow = document.querySelector(
            ".status_row .value.position_value"
          );
          if (posRow) posRow.textContent = "( - , - )";

          const speedRow = document.querySelector(
            ".status_row.gauge_row .value.small"
          );
          if (speedRow) speedRow.textContent = "0.00 m/s";

          const speedBar = document.querySelector(".bar_fill.speed");
          if (speedBar) {
            speedBar.style.width = "0%";
            speedBar.style.background =
              "linear-gradient(90deg, #ccc, #999)";
          }
        }
      }

      // 배터리
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
          if (label && label.textContent.trim().includes("배터리"))
            batteryRow = row;
        });
        if (!batteryRow) return;

        const bar = batteryRow.querySelector(".bar_fill.battery");
        const textEl = batteryRow.querySelector(".value.small");

        if (bar) bar.style.width = `${level.toFixed(0)}%`;
        if (textEl) textEl.textContent = `${level.toFixed(0)}%`;

        if (bar) {
          if (level < 20) {
            bar.style.background =
              "linear-gradient(90deg, #e74c3c, #c0392b)";
          } else {
            bar.style.background = "";
            bar.classList.add("battery");
          }
        }

        console.log(
          `[BATTERY] ${data?.payload?.robot_name || "-"} → ${level.toFixed(
            0
          )}%`
        );
      }

      // 위치/속도 (게이지 0.22 기준)
      if (data.type === "odom") {
        try {
          const pos = data.payload?.position || {};
          const lin = data.payload?.linear || {};

          const posRow = document.querySelector(
            ".status_row .value.position_value"
          );
          if (posRow) {
            posRow.textContent = `(${pos.x?.toFixed(1) ?? "-"}, ${
              pos.y?.toFixed(1) ?? "-"
            })`;
          }

          const linearX = lin.x ?? 0;
          const speed = Math.abs(linearX);
          const speedValue = `${speed.toFixed(2)} m/s`;

          const speedRow = document.querySelector(
            ".status_row.gauge_row .value.small"
          );
          if (speedRow) speedRow.textContent = speedValue;

          const speedBar = document.querySelector(".bar_fill.speed");
          if (speedBar) {
            const percent = Math.min(
              (speed / MAX_SPEED_DISPLAY) * 100,
              100
            ); // 0.22 기준
            speedBar.style.width = `${percent}%`;

            if (percent < 40) {
              speedBar.style.background =
                "linear-gradient(90deg, #3498db, #2980b9)";
            } else if (percent < 80) {
              speedBar.style.background =
                "linear-gradient(90deg, #2ecc71, #27ae60)";
            } else {
              speedBar.style.background =
                "linear-gradient(90deg, #e74c3c, #c0392b)";
            }
          }
        } catch (e) {
          console.error("odom 처리 오류:", e);
        }
      }

      // 시스템 상태
      if (data.type === "diagnostics") {
        const status = data.payload?.status ?? "-";
        const color = data.payload?.color ?? "#999";
        if (sysStatusEl) {
          sysStatusEl.textContent = status;
          sysStatusEl.style.color = color;
        }
      }
    } catch (err) {
      console.error("[WS 메시지 처리 오류]", err);
    }
  };

  // ====== 로봇 목록 ======
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
        console.log(
          `[RESTORE] 마지막 선택된 로봇 복원: ${savedId}`
        );

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

        await connectRobot(savedId);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ====== 연결 요청 ======
  let connectBusy = false;
  async function connectRobot(id) {
    if (connectBusy || !id) return;
    connectBusy = true;
    selectEl.disabled = true;
    try {
      const res = await fetch(`/robots/connect/${id}`, {
        method: "POST",
      });
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

  // ====== CRUD ======
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

  // ====== 자동/수동 모드 & 수동 가속 제어 ======

  // 수동 가속 변수
  let currentLinear = 0;
  let currentAngular = 0;
  let accelInterval = null;

  // 부드러운 가속 설정값
  const ACCEL_STEP = 0.03; // 매 tick 선속도 증가량
  const ACCEL_TICK = 70;   // tick 간격(ms) → 약 14Hz
  const BASE_ANGULAR = 0.6;

  function disableManualControl() {
    stopAcceleration();
    dirButtons.forEach((btn) => {
      btn.disabled = true;
      btn.classList.remove("active");
    });

    if (manualLock) manualLock.classList.add("active");

    if (modeText) {
      modeText.classList.remove("manual");
      modeText.classList.add("auto");
      modeText.textContent = "자동";
    }
  }

  function enableManualControl() {
    dirButtons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.add("active");
    });

    if (manualLock) manualLock.classList.remove("active");

    if (modeText) {
      modeText.classList.remove("auto");
      modeText.classList.add("manual");
      modeText.textContent = "수동";
    }
  }

  function setMode(mode) {
    stopAcceleration();
    if (mode === "auto") {
      currentMode = "auto";
      autoBtn?.classList.add("active");
      manualBtn?.classList.remove("active");
      disableManualControl();
      // 자동 모드로 전환 시 현재 기어 기준으로 nav2 속도 설정 요청
      sendAutoSpeed(currentSpeedLevel);
    } else {
      currentMode = "manual";
      manualBtn?.classList.add("active");
      autoBtn?.classList.remove("active");
      enableManualControl();
    }
  }

  if (autoBtn) autoBtn.addEventListener("click", () => setMode("auto"));
  if (manualBtn) manualBtn.addEventListener("click", () => setMode("manual"));

  // ====== 자동 모드 속도 변경 (nav2용 메시지) ======
  function sendAutoSpeed(gear) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: "auto_speed",
      payload: { gear }
    }));
    console.log(`[AUTO] 자동 모드 기어 → ${gear}단 (max=${MAX_SPEED[gear]} m/s)`);
  }

  // ====== 속도 슬라이더 (1~3단, 자동/수동 공통) ======
  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      currentSpeedLevel = Number(e.target.value);
      console.log(
        `[속도 단계] ${currentSpeedLevel}단 (${MAX_SPEED[currentSpeedLevel]} m/s)`
      );
      // 자동 모드일 때는 nav2 속도도 같이 변경
      if (currentMode === "auto") {
        sendAutoSpeed(currentSpeedLevel);
      }
    });
  }

  // ====== 수동 모드에서 Web → cmd_vel 전송 ======
  function sendVelocity(linearX, angularZ) {
    if (ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] 연결 안됨, 명령 전송 불가");
      return;
    }

    const maxV = MAX_SPEED[currentSpeedLevel]; // TB3 기어별 최대속도
    const clampedLinear = Math.max(-maxV, Math.min(maxV, linearX));
    const clampedAngular = Math.max(-1.0, Math.min(1.0, angularZ));

    const msg = {
      type: "cmd_vel",
      payload: {
        linear: { x: clampedLinear, y: 0.0, z: 0.0 },
        angular: { x: 0.0, y: 0.0, z: clampedAngular },
        gear: currentSpeedLevel,
      },
    };

    ws.send(JSON.stringify(msg));
    console.log(
      `[CMD] 전송 → linear=${clampedLinear.toFixed(
        2
      )} / angular=${clampedAngular.toFixed(2)} (${currentSpeedLevel}단)`
    );
  }

  // 🔥 가속 시작 함수
  function startAcceleration(direction) {
    if (currentMode !== "manual") return;

    stopAcceleration(); // 중복 방지

    accelInterval = setInterval(() => {
      const maxV = MAX_SPEED[currentSpeedLevel];

      if (direction === "forward") {
        currentLinear = Math.min(currentLinear + ACCEL_STEP, maxV);
      } else if (direction === "backward") {
        currentLinear = Math.max(currentLinear - ACCEL_STEP, -maxV);
      } else if (direction === "left") {
        currentAngular = BASE_ANGULAR;
      } else if (direction === "right") {
        currentAngular = -BASE_ANGULAR;
      }

      sendVelocity(currentLinear, currentAngular);
    }, ACCEL_TICK);
  }

  // 🔥 가속 중지 함수
  function stopAcceleration() {
    if (accelInterval) clearInterval(accelInterval);
    accelInterval = null;

    currentLinear = 0;
    currentAngular = 0;
    sendVelocity(0, 0);
  }

  // 🔥 방향 버튼 → 부드러운 가속
  const upBtn = document.querySelector(".dir_btn.up");
  const downBtn = document.querySelector(".dir_btn.down");
  const leftBtn = document.querySelector(".dir_btn.left");
  const rightBtn = document.querySelector(".dir_btn.right");
  const stopBtn = document.querySelector(".dir_btn.stop_center");

  if (upBtn) upBtn.addEventListener("mousedown", () => startAcceleration("forward"));
  if (downBtn) downBtn.addEventListener("mousedown", () => startAcceleration("backward"));
  if (leftBtn) leftBtn.addEventListener("mousedown", () => startAcceleration("left"));
  if (rightBtn) rightBtn.addEventListener("mousedown", () => startAcceleration("right"));

  ["up", "down", "left", "right"].forEach((dir) => {
    const btn = document.querySelector(`.dir_btn.${dir}`);
    if (!btn) return;
    btn.addEventListener("mouseup", stopAcceleration);
    btn.addEventListener("mouseleave", () => {
      // 버튼 밖으로 나가면 정지
      if (accelInterval) stopAcceleration();
    });
  });

  if (stopBtn) stopBtn.addEventListener("click", stopAcceleration);

  // 🔥 키보드 조작도 동일한 부드러운 가속 적용
  document.addEventListener("keydown", (e) => {
    if (currentMode !== "manual") return;

    // 이미 가속 중이면 중복 시작 방지
    if (accelInterval) return;

    switch (e.key) {
      case "ArrowUp":
        startAcceleration("forward");
        break;
      case "ArrowDown":
        startAcceleration("backward");
        break;
      case "ArrowLeft":
        startAcceleration("left");
        break;
      case "ArrowRight":
        startAcceleration("right");
        break;
      default:
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    // 방향키 떼면 정지
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      stopAcceleration();
    }
  });

  // 초기 모드 & 기어 설정
  setMode("auto");
  if (speedSlider) {
    speedSlider.value = String(currentSpeedLevel);
  }

  // 초기 로봇 목록 로드
  loadRobotList();
});