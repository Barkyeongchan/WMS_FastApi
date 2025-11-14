document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

  /* ============================================================================
      0) 기본 요소 캐싱
  ============================================================================ */
  const searchInput = document.getElementById("search_input");
  const searchBtn   = document.getElementById("search_btn");
  const resultBody  = document.getElementById("result_body");
  const emptyHint   = document.getElementById("empty_hint");
  const pickedName  = document.getElementById("picked_name");
  const btnIn       = document.getElementById("btn_in");
  const btnOut      = document.getElementById("btn_out");
  const deltaInput  = document.getElementById("delta_qty");
  const robotSelect = document.getElementById("robot_select");
  const logArea     = document.getElementById("log_area");

  let products = [];
  let selectedItem = null;
  let ROBOT_STATUS = {};
  let lastRobotPose = { x: null, y: null, theta: 0 };
  let hasInitialPose = false;
  let activeRobotName = null;

  let mapInfo = {
    image: null,
    resolution: 0.05,
    origin: [0, 0]
  };

  /* ============================================================================
      1) 로봇 상태 초기화
  ============================================================================ */
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

  /* ============================================================================
      2) 상품 / 로봇 로딩
  ============================================================================ */
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

  /* ============================================================================
      3) 로봇 카드 렌더링
  ============================================================================ */
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

      const speed = robot.speed ?? 0;
      const posX  = robot.x ?? 0;
      const posY  = robot.y ?? 0;
      const batt  = robot.battery ?? 0;
      const mode  = robot.mode || (robot.connected ? "자동" : "미연결");

      card.innerHTML = `
        <div class="robot_card_title">${robot.name}</div>
        <div class="robot_card_info">속도: ${speed.toFixed(2)} m/s</div>
        <div class="robot_card_info">위치: (${posX.toFixed(2)}, ${posY.toFixed(2)})</div>
        <div class="robot_card_info">상태: ${mode}</div>
        <div class="robot_card_info">배터리</div>
        <div class="robot_card_bar">
          <div class="robot_card_bar_fill" style="width:${batt}%"></div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* ============================================================================
      4) WebSocket 핸들러
  ============================================================================ */
  function connectDashboardWs() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("[WS] 수신:", msg);

      const p   = msg.payload || {};
      const name = p.robot_name;
      if (!name || !ROBOT_STATUS[name]) return;
      const r = ROBOT_STATUS[name];

      activeRobotName = name;

      /* ---- status ---- */
      if (msg.type === "status") {
        r.connected = p.connected;
        r.mode = p.connected ? "자동" : "미연결";
      }

      /* ---- battery ---- */
      else if (msg.type === "battery") {
        r.battery = p.percentage;
      }

      /* ---- odom (정지 상태에서도 들어옴) ---- */
      else if (msg.type === "odom") {
        r.speed = p.linear?.x || 0;

        // ⭐ 최초 좌표 자동 설정
        if (!hasInitialPose && p.position) {
          lastRobotPose.x = p.position.x;
          lastRobotPose.y = p.position.y;
          lastRobotPose.theta = p.theta || 0;

          r.x = lastRobotPose.x;
          r.y = lastRobotPose.y;
          r.theta = lastRobotPose.theta;

          hasInitialPose = true;
          updateRobotMarker(r);
        }

        if (p.theta !== undefined) r.theta = p.theta;
      }

      /* ---- amcl_pose (정확한 위치) ---- */
      else if (msg.type === "amcl_pose") {
        if (typeof p.x === "number") r.x = p.x;
        if (typeof p.y === "number") r.y = p.y;
        if (p.theta !== undefined) r.theta = p.theta;

        lastRobotPose = {
          x: r.x,
          y: r.y,
          theta: r.theta
        };

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

  /* ============================================================================
      5) 지도 로딩
  ============================================================================ */
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
        console.log("📌 지도 이미지 로드 완료:", img.naturalWidth, img.naturalHeight);
      };

    } catch (err) {
      console.error("지도 로딩 실패:", err);
    }
  }

  /* ============================================================================
      6) ROS → Pixel 변환
  ============================================================================ */
  function rosToPixel(x, y) {
    const img = document.getElementById("map_image");
    const container = document.getElementById("map_container");

    if (!img.complete) return { x: 0, y: 0 };

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scale = Math.max(cw / iw, ch / ih);

    const drawnWidth = iw * scale;
    const drawnHeight = ih * scale;

    const offsetX = (cw - drawnWidth) / 2;
    const offsetY = (ch - drawnHeight) / 2;

    const px = (x - mapInfo.origin[0]) / mapInfo.resolution;
    const py = (y - mapInfo.origin[1]) / mapInfo.resolution;

    const pyFlip = ih - py;

    return {
      x: px * scale + offsetX,
      y: pyFlip * scale + offsetY
    };
  }

  /* ============================================================================
      7) 로봇 마커 업데이트
  ============================================================================ */
  function updateRobotMarker(robot) {
    const marker = document.getElementById("robot_marker");
    const img = document.getElementById("map_image");

    if (!marker || !img.complete) return;

    if (robot.x == null || robot.y == null) {
      marker.style.display = "none";
      return;
    }

    marker.style.display = "block";

    const p = rosToPixel(robot.x, robot.y);

    marker.style.left = `${p.x - 10}px`;
    marker.style.top  = `${p.y - 10}px`;

    const theta = robot.theta || 0;
    const deg = theta * (180 / Math.PI);
    marker.style.transform = `rotate(${deg}deg)`;
  }

  /* ============================================================================
      8) 마커 유지 루프
  ============================================================================ */
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

  /* ============================================================================
      9) 초기 실행
  ============================================================================ */
  (async () => {
    await loadProducts();
    await loadRobots();
    await initRobotStatusList();
    await loadMap();
    connectDashboardWs();
  })();
});