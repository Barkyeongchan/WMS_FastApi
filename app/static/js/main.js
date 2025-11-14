document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

  /* ============================================================================
      🔵 PIVOT (지도 중심점) – 네가 말한 좌표
  ============================================================================ */
  const PIVOT_X = 1.42;
  const PIVOT_Y = 1.72;

  /* ============================================================================  
        🔥 지도 보정값 — 기본값(하드코딩) + localStorage 저장 지원  
  ============================================================================ */
  let OFFSET_X = Number(localStorage.getItem("OFFSET_X") ?? -43);
  let OFFSET_Y = Number(localStorage.getItem("OFFSET_Y") ?? -5);
  let SCALE_X  = Number(localStorage.getItem("SCALE_X") ?? 0.55);
  let SCALE_Y  = Number(localStorage.getItem("SCALE_Y") ?? 0.52);

  /* ============================================================================
      🔵 Pivot 마커 생성 (파란 점)
  ============================================================================ */
  const pivotMarker = document.createElement("div");
  pivotMarker.id = "pivot_marker";
  pivotMarker.style.position = "absolute";
  pivotMarker.style.width = "14px";
  pivotMarker.style.height = "14px";
  pivotMarker.style.background = "blue";
  pivotMarker.style.border = "2px solid white";
  pivotMarker.style.borderRadius = "50%";
  pivotMarker.style.pointerEvents = "none";
  pivotMarker.style.zIndex = "99999";
  pivotMarker.style.display = "none";
  document.body.appendChild(pivotMarker);

  function updatePivotMarker() {
    const p = rosToPixel(PIVOT_X, PIVOT_Y);
    pivotMarker.style.left = `${p.x - 7}px`;
    pivotMarker.style.top  = `${p.y - 7}px`;
    pivotMarker.style.display = "block";
  }

  /* ============================================================================
      🔥 보정값 조절 UI 패널
  ============================================================================ */
  const debugPanel = document.createElement("div");
  debugPanel.style.position = "fixed";
  debugPanel.style.right = "10px";
  debugPanel.style.bottom = "10px";
  debugPanel.style.background = "#ffffffdd";
  debugPanel.style.padding = "10px";
  debugPanel.style.borderRadius = "8px";
  debugPanel.style.zIndex = "9999";
  debugPanel.style.fontSize = "12px";
  debugPanel.style.boxShadow = "0 0 8px rgba(0,0,0,0.2)";
  debugPanel.innerHTML = `
      <b>🧭 Map Debug Panel</b><br>
      OFFSET_X: <input id="dbg_offx" type="number" step="1" style="width:70px"><br>
      OFFSET_Y: <input id="dbg_offy" type="number" step="1" style="width:70px"><br>
      SCALE_X : <input id="dbg_sx" type="number" step="0.01" style="width:70px"><br>
      SCALE_Y : <input id="dbg_sy" type="number" step="0.01" style="width:70px"><br>
      <button id="dbg_apply">적용</button>
  `;
  document.body.appendChild(debugPanel);

  document.getElementById("dbg_offx").value = OFFSET_X;
  document.getElementById("dbg_offy").value = OFFSET_Y;
  document.getElementById("dbg_sx").value   = SCALE_X;
  document.getElementById("dbg_sy").value   = SCALE_Y;

  document.getElementById("dbg_apply").onclick = () => {
    OFFSET_X = Number(document.getElementById("dbg_offx").value);
    OFFSET_Y = Number(document.getElementById("dbg_offy").value);
    SCALE_X  = Number(document.getElementById("dbg_sx").value);
    SCALE_Y  = Number(document.getElementById("dbg_sy").value);

    localStorage.setItem("OFFSET_X", OFFSET_X);
    localStorage.setItem("OFFSET_Y", OFFSET_Y);
    localStorage.setItem("SCALE_X", SCALE_X);
    localStorage.setItem("SCALE_Y", SCALE_Y);

    console.log("🔄 보정값 적용!", {OFFSET_X, OFFSET_Y, SCALE_X, SCALE_Y});

    updatePivotMarker();
  };

  /* ============================================================================ */
  const robotSelect = document.getElementById("robot_select");
  const resultBody  = document.getElementById("result_body");
  const emptyHint   = document.getElementById("empty_hint");
  const pickedName  = document.getElementById("picked_name");

  let products = [];
  let selectedItem = null;
  let ROBOT_STATUS = {};
  let lastRobotPose = { x: null, y: null, theta: 0 };
  let hasInitialPose = false;
  let activeRobotName = null;

  let mapInfo = {
    image: null,
    resolution: 0.045,
    origin: [0, 0]
  };

  /* ============================================================================ */
  async function initRobotStatusList() {
    const res = await fetch("/robots/");
    const robots = await res.json();

    robots.forEach(r => {
      ROBOT_STATUS[r.name] = {
        name: r.name,
        connected: false,
        battery: 0,
        speed: 0,
        x: 0,
        y: 0,
        theta: 0,
        mode: "미연결",
      };
    });

    renderRobotCards();
  }

  /* ============================================================================ */
  async function loadProducts() {
    const res = await fetch("/stocks/");
    products = await res.json();
    renderTable(products);
  }

  async function loadRobots() {
    const res = await fetch("/robots/");
    const robots = await res.json();

    robotSelect.innerHTML = `<option value="">로봇 목록</option>`;
    robots.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      robotSelect.appendChild(opt);
    });
  }

  function renderTable(data) {
    resultBody.innerHTML = "";
    if (data.length === 0) {
      emptyHint.style.display = "block";
      return;
    }
    emptyHint.style.display = "none";

    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.pin_name}</td>
        <td>${item.quantity}</td>
      `;
      tr.addEventListener("click", () => {
        document.querySelectorAll(".product_table tr")
          .forEach(r => r.classList.remove("selected"));
        tr.classList.add("selected");
        pickedName.textContent = item.name;
        selectedItem = item;
      });
      resultBody.appendChild(tr);
    });
  }

  /* ============================================================================ */
  function renderRobotCards() {
    const container = document.getElementById("robot_status_list");
    if (!container) return;
    container.innerHTML = "";

    const sorted = Object.values(ROBOT_STATUS).sort((a, b) =>
      Number(b.connected) - Number(a.connected)
    );

    sorted.forEach(robot => {
      const card = document.createElement("div");
      card.className = "robot_card";
      if (!robot.connected) card.classList.add("offline");

      card.innerHTML = `
        <div class="robot_card_title">${robot.name}</div>
        <div class="robot_card_info">속도: ${robot.speed.toFixed(2)} m/s</div>
        <div class="robot_card_info">위치: (${robot.x.toFixed(2)}, ${robot.y.toFixed(2)})</div>
        <div class="robot_card_info">상태: ${robot.mode}</div>
        <div class="robot_card_info">배터리</div>
        <div class="robot_card_bar">
          <div class="robot_card_bar_fill" style="width:${robot.battery}%"></div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* ============================================================================
      4) WebSocket 핸들러
      ✔ 위치는 AMCL만 사용
      🚫 ODOM으로 좌표 업데이트 절대 금지
  ============================================================================ */
  function connectDashboardWs() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const p   = msg?.payload || {};
      const name = p.robot_name;

      if (!name || !ROBOT_STATUS[name]) return;
      const r = ROBOT_STATUS[name];
      activeRobotName = name;

      if (msg.type === "status") {
        r.connected = p.connected;
        r.mode = p.connected ? "자동" : "미연결";
      }

      else if (msg.type === "battery") {
        r.battery = p.percentage;
      }

      else if (msg.type === "odom") {
        r.speed = p.linear?.x || 0;  // 속도만 사용
      }

      else if (msg.type === "amcl_pose") {
        r.x = p.x;
        r.y = p.y;
        r.theta = p.theta;

        lastRobotPose = { x: r.x, y: r.y, theta: r.theta };
        hasInitialPose = true;
        updateRobotMarker(r);
      }

      renderRobotCards();
    };

    ws.onclose = () => {
      console.log("[WS] Dashboard disconnected, retrying...");
      setTimeout(connectDashboardWs, 2000);
    };
  }

  /* ============================================================================ */
  async function loadMap() {
    try {
      const res = await fetch("/map/info");
      const info = await res.json();

      mapInfo.image = info.image;
      mapInfo.resolution = info.resolution;
      mapInfo.origin = info.origin;

      const img = document.getElementById("map_image");
      img.src = info.image;

      img.onload = () => {
        console.log("📌 지도 이미지 로드:", img.naturalWidth, img.naturalHeight);
        updatePivotMarker();
      };

    } catch (err) {
      console.error("지도 로딩 실패:", err);
    }
  }

  /* ============================================================================
      🔥 pivot 중심 ROS → Pixel 변환
  ============================================================================ */
  function rosToPixel(x, y) {
    const img = document.getElementById("map_image");
    const container = document.getElementById("map_container");

    if (!img.complete) return { x:0, y:0 };

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scaleBase = Math.max(cw / iw, ch / ih);

    // pivot 이미지 좌표
    const pivot_px = (PIVOT_X - mapInfo.origin[0]) / mapInfo.resolution;
    const pivot_py = (PIVOT_Y - mapInfo.origin[1]) / mapInfo.resolution;
    const pivot_pyFlip = ih - pivot_py;

    const pivot_screen_x = pivot_px * scaleBase;
    const pivot_screen_y = pivot_pyFlip * scaleBase;

    const offsetX = (cw - iw * scaleBase) / 2;
    const offsetY = (ch - ih * scaleBase) / 2;

    const pivot_global_x = pivot_screen_x + offsetX;
    const pivot_global_y = pivot_screen_y + offsetY;

    // 현재 점 → pivot 기준 상대 좌표
    const px = (x - mapInfo.origin[0]) / mapInfo.resolution;
    const py = (y - mapInfo.origin[1]) / mapInfo.resolution;
    const pyFlip = ih - py;

    const screen_x =
      pivot_global_x + (px - pivot_px) * scaleBase * SCALE_X + OFFSET_X;

    const screen_y =
      pivot_global_y + (pyFlip - pivot_pyFlip) * scaleBase * SCALE_Y + OFFSET_Y;

    return { x: screen_x, y: screen_y };
  }

  /* ============================================================================ */
  function updateRobotMarker(robot) {
    const marker = document.getElementById("robot_marker");
    const img = document.getElementById("map_image");

    if (!marker || !img.complete) return;

    const p = rosToPixel(robot.x, robot.y);

    marker.style.display = "block";
    marker.style.left = `${p.x - 10}px`;
    marker.style.top  = `${p.y - 10}px`;

    const deg = (robot.theta || 0) * (180 / Math.PI);
    marker.style.transform = `rotate(${deg}deg)`;

    updatePivotMarker();
  }

  /* ============================================================================ */
  setInterval(() => {
    if (!activeRobotName) return;
    const r = ROBOT_STATUS[activeRobotName];
    if (!r) return;

    if (lastRobotPose.x != null && lastRobotPose.y != null) {
      r.x = lastRobotPose.x;
      r.y = lastRobotPose.y;
      r.theta = lastRobotPose.theta;
      updateRobotMarker(r);
    }
  }, 200);

  /* ============================================================================ */
  (async () => {
    await loadProducts();
    await loadRobots();
    await initRobotStatusList();
    await loadMap();
    connectDashboardWs();
  })();
});