document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

  /* ============================================================================
      🔵 PIVOT (지도 중심점)
      → 스케일이 바뀌어도 이 좌표는 항상 고정
  ============================================================================ */
  const PIVOT_X = 1.42;
  const PIVOT_Y = 1.72;

  /* ============================================================================
      🔥 보정값 — 네가 맞춘 값 그대로 하드코딩 (localStorage 제거)
      이제 값이 절대 변하지 않음 (재시작해도 고정)
  ============================================================================ */
  const OFFSET_X = -43;
  const OFFSET_Y = -5;
  const SCALE_X  = 0.55;
  const SCALE_Y  = 0.52;

  /* ============================================================================
      기본 요소들
  ============================================================================ */
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
      WebSocket – 위치 업데이트는 AMCL만
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
      };

    } catch (err) {
      console.error("지도 로딩 실패:", err);
    }
  }

  /* ============================================================================
      ROS → Pixel 변환 ( pivot 중심 + scale 보정 고정 )
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

    // pivot 이미지 px
    const pivot_px = (PIVOT_X - mapInfo.origin[0]) / mapInfo.resolution;
    const pivot_py = (PIVOT_Y - mapInfo.origin[1]) / mapInfo.resolution;
    const pivot_pyFlip = ih - pivot_py;

    const offsetX0 = (cw - iw * scaleBase) / 2;
    const offsetY0 = (ch - ih * scaleBase) / 2;

    const pivot_global_x = pivot_px * scaleBase + offsetX0;
    const pivot_global_y = pivot_pyFlip * scaleBase + offsetY0;

    // 현재 점
    const px = (x - mapInfo.origin[0]) / mapInfo.resolution;
    const py = (y - mapInfo.origin[1]) / mapInfo.resolution;
    const pyFlip = ih - py;

    return {
      x: pivot_global_x + (px - pivot_px) * scaleBase * SCALE_X + OFFSET_X,
      y: pivot_global_y + (pyFlip - pivot_pyFlip) * scaleBase * SCALE_Y + OFFSET_Y
    };
  }

  /* ============================================================================ */
  function updateRobotMarker(robot) {
    const marker = document.getElementById("robot_marker");
    if (!marker) return;

    const p = rosToPixel(robot.x, robot.y);

    marker.style.display = "block";
    marker.style.left = `${p.x - 10}px`;
    marker.style.top  = `${p.y - 10}px`;

    const deg = (robot.theta || 0) * (180 / Math.PI);
    marker.style.transform = `rotate(${deg}deg)`;
  }

  /* ============================================================================ */
  setInterval(() => {
    if (!activeRobotName) return;
    const r = ROBOT_STATUS[activeRobotName];
    if (lastRobotPose.x != null) {
      r.x = lastRobotPose.x;
      r.y = lastRobotPose.y;
      r.theta = lastRobotPose.theta;
      updateRobotMarker(r);
    }
  }, 200);

  async function sendInbound() {
      const stockId = selectedStockId;
      const qty = Number(document.getElementById("change_qty").value);
      const robot = document.getElementById("robot_select").value;
      const pin = selectedStockPin; // 예: "RACK_A"
    
      await fetch("/robot/command", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
              stock_id: stockId,
              qty: qty,
              robot: robot,
              pin: pin
          })
      });
  }


  /* ============================================================================ */
  (async () => {
    await loadProducts();
    await loadRobots();
    await initRobotStatusList();
    await loadMap();
    connectDashboardWs();
  })();
});