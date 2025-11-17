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
  const moveBtn = document.querySelector(".move_btn");
  const returnBtn = document.querySelector(".return");
  const emergencyBtn = document.querySelector(".stop");
  

  // 시스템 상태
  const sysStatusEl = document.querySelector(".value.system_status");

  // 모달
  const openModalBtn = document.getElementById("open_modal_btn");
  const modal = document.getElementById("robot_modal");
  const modalCloseBtn = document.getElementById("modal_close_btn");

  const STORAGE_KEY = "last_selected_robot";

  let lastOdometrySpeed = 0;

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

  // ====== 속도 정책 ======
  const MAX_SPEED = { 1: 0.10, 2: 0.15, 3: 0.22 };
  const MAX_SPEED_DISPLAY = 0.22;

  let currentSpeedLevel = 1;
  let currentMode = "auto";

  const speedSlider = document.getElementById("speed_slider");
  const modeText = document.querySelector(".value.mode");
  const autoBtn = document.getElementById("auto_mode");
  const manualBtn = document.getElementById("manual_mode");
  const manualLock = document.getElementById("manual_lock");
  const dirButtons = document.querySelectorAll(".dir_btn");

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "robot_status") {
        const state = data.payload.state || "-";
        const el = document.getElementById("robot_state");

        if (el) {
          el.textContent = state;

          if (state === "이동중") el.style.color = "#e67e22";      // 주황
          else if (state === "복귀중") el.style.color = "#3498db"; // 파랑
          else if (state === "작업중") el.style.color = "#e74c3c";
          else el.style.color = "#2c3e50";                         // 기본
        }
      }

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
            ".value.position_value"
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

        updateBattery(level);

        console.log(
          `[BATTERY] ${data?.payload?.robot_name || "-"} → ${level.toFixed(
            0
          )}%`
        );
      }

      // 위치 (amcl_pose)
      if (data.type === "amcl_pose") {
        try {
          const x = data.payload?.x;
          const y = data.payload?.y;

          const posRow = document.querySelector(
            ".value.position_value"
          );
          if (posRow) {
            posRow.textContent =
              (x != null && y != null)
                ? `(${x.toFixed(1)}, ${y.toFixed(1)})`
                : "( - , - )";
          }

          // 속도는 odom에서 마지막으로 저장된 값 사용
          const speedRow = document.querySelector(
            ".status_row.gauge_row .value.small"
          );
          const speedBar = document.querySelector(".bar_fill.speed");

          if (speedRow && lastOdometrySpeed != null) {
            const speed = Math.abs(lastOdometrySpeed);
            speedRow.textContent = `${speed.toFixed(2)} m/s`;

            const percent = Math.min(
              (speed / MAX_SPEED_DISPLAY) * 100,
              100
            );

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

          // ★★★★★ 지도 부분: 로봇 위치 업데이트 호출 ★★★★★
          robotMap_updateRobotMarker(x, y, data.payload.theta);

        } catch (e) {
          console.error("amcl_pose 처리 오류:", e);
        }
      }

      // odom → 속도 업데이트
      if (data.type === "odom") {
        lastOdometrySpeed = data.payload?.linear?.x ?? 0;
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

  // ====== 로봇 목록 불러오기 ======
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

  let currentLinear = 0;
  let currentAngular = 0;
  let accelInterval = null;

  const ACCEL_STEP = 0.03;
  const ACCEL_TICK = 70;
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

  function sendAutoSpeed(gear) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "auto_speed",
        payload: { gear },
      })
    );
    console.log(`[AUTO] 자동 모드 기어 → ${gear}단`);
  }

  // ====== 속도 슬라이더 ======
  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      currentSpeedLevel = Number(e.target.value);
      console.log(
        `[속도 단계] ${currentSpeedLevel}단 (${MAX_SPEED[currentSpeedLevel]} m/s)`
      );
      if (currentMode === "auto") {
        sendAutoSpeed(currentSpeedLevel);
      }
    });
  }

  // ====== cmd_vel ======
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
        gear: currentSpeedLevel,
      },
    };

    ws.send(JSON.stringify(msg));
  }

  // ====== 가속 시작 ======
  function startAcceleration(direction) {
    if (currentMode !== "manual") return;

    stopAcceleration();

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

  // ====== 가속 중지 ======
  function stopAcceleration() {
    if (accelInterval) clearInterval(accelInterval);
    accelInterval = null;
    currentLinear = 0;
    currentAngular = 0;
    sendVelocity(0, 0);
  }

  // ====== 방향 버튼 ======
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
      if (accelInterval) stopAcceleration();
    });
  });

  if (stopBtn) stopBtn.addEventListener("click", stopAcceleration);

  // ====== 키보드 방향키 ======
  document.addEventListener("keydown", (e) => {
    if (currentMode !== "manual") return;
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
    }
  });

  document.addEventListener("keyup", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      stopAcceleration();
    }
  });

  // ====== 초기 설정 ======
  setMode("auto");
  if (speedSlider) speedSlider.value = String(currentSpeedLevel);

  loadRobotList();

  async function loadPins() {
    const res = await fetch("/pins/");
    const pins = await res.json();

    const pinSelect = document.getElementById("pin_select");
    pinSelect.innerHTML = "";

    pins.forEach(pin => {
      const op = document.createElement("option");
      op.value = pin.id;
      op.textContent = `${pin.name}`;
      pinSelect.appendChild(op);
    });
  }

  loadPins();

  if (moveBtn) {
    moveBtn.addEventListener("click", () => {
      const pinSelect = document.getElementById("pin_select");
      const pinName = pinSelect.selectedOptions[0].textContent.split(" ")[0];

      const currentRobotName =
        document.getElementById("robot_select")
                ?.selectedOptions[0]
                ?.textContent.split("(")[0].trim();

      // 1) 상태 브로드캐스트
      ws.send(JSON.stringify({
        type: "robot_status",
        payload: {
          name: currentRobotName,
          state: "이동중"
        }
      }));

      // 2) 실제 이동 명령
      const command = `MOVE_TO_PIN ${pinName}`;
      ws.send(JSON.stringify({
        type: "ui_command",
        payload: { command }
      }));

      console.log("[WS] 위치 이동 명령:", command);
    });
  }

  if (returnBtn) {
    returnBtn.addEventListener("click", () => {
    
      const currentRobotName =
        document.getElementById("robot_select")
                ?.selectedOptions[0]
                ?.textContent.split("(")[0].trim();
    
      // 1) 상태 업데이트
      ws.send(JSON.stringify({
        type: "robot_status",
        payload: {
          name: currentRobotName,
          state: "복귀중"
        }
      }));
    
      // 2) 실제 명령
      ws.send(JSON.stringify({
        type: "ui_command",
        payload: { command: "WAIT" }
      }));
    
      console.log("[WS] 복귀 명령 전송");
    });
  }

  if (emergencyBtn) {
    emergencyBtn.addEventListener("click", () => {

      // 1) 즉시 정지 cmd_vel 전송
      ws.send(JSON.stringify({
        type: "cmd_vel",
        payload: {
          linear: { x: 0, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: 0 },
          gear: 0
        }
      }));

      // 2) 로봇 상태도 갱신 (대시보드·로봇관리 둘 다)
      ws.send(JSON.stringify({
        type: "robot_status",
        payload: {
          state: "비상정지"
        }
      }));

      console.log("🛑 비상정지 즉시 정지 명령 전송!");
    });
  }

  


  /* ============================================================
     🔥 로봇 관리 페이지 지도 기능 (대시보드와 충돌 방지)
     모든 변수/함수 robotMap_ 네임스페이스로 분리됨
  ============================================================ */

  const robotMap_container = document.querySelector(".map_canvas");
  let robotMap_img = null;
  let robotMap_marker = null;

  let robotMap_info = {
    image: null,
    resolution: 0.05,
    origin: [0, 0]
  };

  const robotMap_PIVOT_X = 1.42;
  const robotMap_PIVOT_Y = 1.72;

  const ROBOT_MAP_OFFSET_X = -43;
  const ROBOT_MAP_OFFSET_Y = -5;
  const ROBOT_MAP_SCALE_X = 0.85;
  const ROBOT_MAP_SCALE_Y = 0.80;

  /* ------------------------------------------------------------
     지도 로딩
  ------------------------------------------------------------ */
  async function robotMap_loadMap() {
    try {
      const res = await fetch("/map/info");
      const info = await res.json();

      robotMap_info = info;

      // 기존 안내 문구 제거
      robotMap_container.innerHTML = "";

      // 이미지 엘리먼트 생성
      robotMap_img = document.createElement("img");
      robotMap_img.src = info.image;
      robotMap_img.style.position = "absolute";
      robotMap_img.style.top = "0";
      robotMap_img.style.left = "0";
      robotMap_img.style.width = "100%";
      robotMap_img.style.height = "100%";
      robotMap_img.style.objectFit = "contain";

      robotMap_container.style.position = "relative";
      robotMap_container.appendChild(robotMap_img);

      // 로봇 마커
      robotMap_marker = document.createElement("div");
      robotMap_marker.style.position = "absolute";
      robotMap_marker.style.width = "25px";
      robotMap_marker.style.height = "25px";
      robotMap_marker.style.background = "red";
      robotMap_marker.style.borderRadius = "50%";
      robotMap_marker.style.transformOrigin = "center";
      robotMap_marker.style.display = "none";
      robotMap_container.appendChild(robotMap_marker);

      console.log("📌 RobotMap: 지도 로딩 완료");

    } catch (err) {
      console.error("RobotMap: 지도 로딩 실패 →", err);
    }
  }

  /* ------------------------------------------------------------
     ROS → 픽셀 변환
  ------------------------------------------------------------ */
  function robotMap_rosToPixel(x, y) {
    if (!robotMap_img || !robotMap_img.complete) return { x: 0, y: 0 };

    const iw = robotMap_img.naturalWidth;
    const ih = robotMap_img.naturalHeight;

    const cw = robotMap_container.clientWidth;
    const ch = robotMap_container.clientHeight;

    const scaleBase = Math.max(cw / iw, ch / ih);

    const pivot_px = (robotMap_PIVOT_X - robotMap_info.origin[0]) / robotMap_info.resolution;
    const pivot_py = (robotMap_PIVOT_Y - robotMap_info.origin[1]) / robotMap_info.resolution;
    const pivot_pyFlip = ih - pivot_py;

    const offsetX0 = (cw - iw * scaleBase) / 2;
    const offsetY0 = (ch - ih * scaleBase) / 2;

    const pivot_global_x = pivot_px * scaleBase + offsetX0;
    const pivot_global_y = pivot_pyFlip * scaleBase + offsetY0;

    const px = (x - robotMap_info.origin[0]) / robotMap_info.resolution;
    const py = (y - robotMap_info.origin[1]) / robotMap_info.resolution;
    const pyFlip = ih - py;

    return {
      x:
        pivot_global_x +
        (px - pivot_px) * scaleBase * ROBOT_MAP_SCALE_X +
        ROBOT_MAP_OFFSET_X,
      y:
        pivot_global_y +
        (pyFlip - pivot_pyFlip) * scaleBase * ROBOT_MAP_SCALE_Y +
        ROBOT_MAP_OFFSET_Y,
    };
  }

  /* ------------------------------------------------------------
     마커 업데이트
  ------------------------------------------------------------ */
  function robotMap_updateRobotMarker(x, y, theta) {
    if (!robotMap_marker || !robotMap_img) return;

    const p = robotMap_rosToPixel(x, y);

    robotMap_marker.style.display = "block";
    robotMap_marker.style.left = `${p.x - 9}px`;
    robotMap_marker.style.top = `${p.y - 9}px`;
    robotMap_marker.style.transform = `rotate(${(theta || 0) * 180 / Math.PI}deg)`;
  }

  /* ------------------------------------------------------------
     초기 지도 로딩 실행
  ------------------------------------------------------------ */
  robotMap_loadMap();


}); // END OF DOMContentLoaded

