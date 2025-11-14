document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

  /* ============================================================================
      0) 상품 / 로봇 기본 요소
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
  let commandQueue = [];
  let ROBOT_STATUS = {};
  let mapInfo = {
    image: null,
    resolution: 0.05,  // 기본값, /map/info에서 덮어씀
    origin: [0, 0]
  };

  /* ============================================================================
      1) 로봇 목록 초기화
  ============================================================================ */
  async function initRobotStatusList() {
    const res = await fetch("/robots/");
    const robots = await res.json();

    robots.forEach(r => {
      if (!ROBOT_STATUS[r.name]) {
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
      }
    });

    renderRobotCards();
    console.log("🔄 초기 로봇 목록 생성 완료:", ROBOT_STATUS);
  }

  /* ============================================================================
      2) 상품 목록 & 로봇 선택 목록
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
      3) (선택) 명령 로그 렌더링 – 필요하면 그대로 활용
  ============================================================================ */
  function renderLog() {
    logArea.innerHTML = "";
    if (commandQueue.length === 0) {
      logArea.innerHTML = `<p class="log_hint">※ 등록된 명령이 여기에 표시됩니다.</p>`;
      return;
    }

    commandQueue.forEach(cmd => {
      const p = document.createElement("p");
      p.classList.add("log_entry", cmd.type === "입고" ? "in" : "out");
      p.textContent = `[${cmd.type}] ${cmd.product} x${cmd.quantity} (${cmd.robotName})`;
      logArea.appendChild(p);
    });

    logArea.scrollTop = logArea.scrollHeight;
  }

  /* ============================================================================
      4) 로봇 상태 카드 렌더링
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

      const speed  = robot.speed ?? 0;
      const posX   = robot.x ?? 0;
      const posY   = robot.y ?? 0;
      const batt   = robot.battery ?? 0;
      const mode   = robot.mode || (robot.connected ? "자동" : "미연결");

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
      5) WebSocket – 기존 구조 유지
  ============================================================================ */
  function connectDashboardWs() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const p   = msg.payload || {};
      const name = p.robot_name;
      if (!name || !ROBOT_STATUS[name]) return;

      const r = ROBOT_STATUS[name];

      if (msg.type === "status") {
        r.connected = p.connected;
        r.mode = p.connected ? "자동" : "미연결";
      }
      else if (msg.type === "battery") {
        r.battery = p.percentage;
      }
      else if (msg.type === "odom") {
        r.speed = p.linear?.x || 0;
        if (p.theta !== undefined) {
          r.theta = p.theta;
        }
      }
      else if (msg.type === "amcl_pose") {
        if (typeof p.x === "number") r.x = p.x;
        if (typeof p.y === "number") r.y = p.y;
        if (p.theta !== undefined) {
          r.theta = p.theta;
        }
        updateRobotMarker(r);
      }
      else if (msg.type === "teleop_key") {
        r.mode = p.key ? "수동" : "자동";
      }


      renderRobotCards();
    };

    ws.onclose = () => {
      console.log("[WS] Dashboard disconnected, retrying...");
      setTimeout(connectDashboardWs, 2000);
    };
  }

  /* ============================================================================
      6) 지도 상태 – 방법 A (완전 수동 transform, Panzoom은 센서)
  ============================================================================ */

  // 로컬스토리지 키 (버전 태그로 \a 사용)
  const MAP_STATE_KEY = "WMS_MAP_STATE\\a";

  // 지도 상태
  let mapState = {
    x: 0,
    y: 0,
    scale: 1,
    angle: 0
  };

  let panzoomInstance = null;
  let mapControlEnabled = false;

  /* 🔹 상태 저장 */
  function saveMapState() {
    try {
      localStorage.setItem(MAP_STATE_KEY, JSON.stringify(mapState));
    } catch (e) {
      console.warn("map state save failed:", e);
    }
  }

  /* 🔹 상태 로드 */
  function loadMapStateFromStorage() {
    try {
      const saved = localStorage.getItem(MAP_STATE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);

      if (typeof parsed.x === "number") mapState.x = parsed.x;
      if (typeof parsed.y === "number") mapState.y = parsed.y;
      if (typeof parsed.scale === "number" && parsed.scale > 0) mapState.scale = parsed.scale;
      if (typeof parsed.angle === "number") mapState.angle = parsed.angle;
    } catch (e) {
      console.warn("map state load failed:", e);
    }
  }

  /* 🔹 실제 transform 적용 (유일한 transform) */
  function applyMapTransform() {
    const inner = document.getElementById("map_inner");
    if (!inner) return;

    inner.style.transform =
      `translate(${mapState.x}px, ${mapState.y}px) ` +
      `scale(${mapState.scale}) ` +
      `rotate(${mapState.angle}deg)`;
  }

  /* 🔹 Panzoom 이벤트 → mapState에 반영 */
  function setupPanzoom(inner) {
    // 초기 상태 로드
    loadMapStateFromStorage();

    panzoomInstance = Panzoom(inner, {
      maxScale: 5,
      minScale: 0.4,
      disablePan: true,
      disableZoom: true,

      // Panzoom이 계산한 x,y,scale을 우리가 직접 적용
      setTransform: (elem, { x, y, scale }) => {
        mapState.x = x;
        mapState.y = y;
        mapState.scale = scale;
        saveMapState();
        applyMapTransform();
      },

      // 저장된 상태로 시작
      startX: mapState.x,
      startY: mapState.y,
      startScale: mapState.scale
    });

    // 최초 1회 transform (각도 포함)
    applyMapTransform();

    // 휠 줌은 우리가 직접 제어해서 OFF일 때는 아예 무시
    const container = document.getElementById("map_container");
    container.addEventListener("wheel", (evt) => {
      if (!mapControlEnabled) return;
      panzoomInstance.zoomWithWheel(evt);
    });
  }

  /* 🔹 지도 로딩 */
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
        const inner = document.getElementById("map_inner");

        setupPanzoom(inner);

        applyMapTransform();
      };

    } catch (err) {
      console.error("지도 로딩 실패:", err);
    }
  }

  // ✅ ROS (m) 좌표 → 이미지 픽셀 좌표 변환
  function rosToPixel(x, y) {
    const img = document.getElementById("map_image");
    if (!img || img.naturalWidth === 0) return { x: 0, y: 0 };

    // 1) origin, resolution 기반으로 맵 좌표 → 픽셀
    const px = (x - mapInfo.origin[0]) / mapInfo.resolution;
    const py = (y - mapInfo.origin[1]) / mapInfo.resolution;

    // 2) 이미지 Y축 뒤집기
    const pyFlipped = img.naturalHeight - py;

    return { x: px, y: pyFlipped };
  }

  // ✅ 로봇 마커 위치/회전 업데이트
  function updateRobotMarker(robot) {
    const marker = document.getElementById("robot_marker");
    const img = document.getElementById("map_image");
    if (!marker || !img || !img.complete) return;

    // 좌표 없으면 숨김
    if (robot.x == null || robot.y == null) {
      marker.style.display = "none";
      return;
    }

    marker.style.display = "block";

    // ROS 좌표를 픽셀로 변환
    const p = rosToPixel(robot.x, robot.y);

    // 중심 정렬 (아이콘 20x20 기준)
    marker.style.left = `${p.x - 10}px`;
    marker.style.top  = `${p.y - 10}px`;

    // heading (theta, rad → deg)
    const theta = robot.theta || 0;
    const deg = theta * (180 / Math.PI);

    marker.style.transform = `rotate(${deg}deg)`;
  }




  /* ============================================================================
      7) 지도 조작 버튼
  ============================================================================ */
  const mapToggleBtn   = document.getElementById("map_toggle_btn");
  const rotateLeftBtn  = document.getElementById("map_rotate_left");
  const rotateRightBtn = document.getElementById("map_rotate_right");

  mapToggleBtn.addEventListener("click", () => {
    if (!panzoomInstance) return;

    mapControlEnabled = !mapControlEnabled;

    if (mapControlEnabled) {
      mapToggleBtn.textContent = "🗺️ 조작 ON";
      mapToggleBtn.classList.add("map_btn_on");

      panzoomInstance.setOptions({
        disablePan: false,
        disableZoom: false
      });

    } else {
      mapToggleBtn.textContent = "🗺️ 조작 OFF";
      mapToggleBtn.classList.remove("map_btn_on");

      panzoomInstance.setOptions({
        disablePan: true,
        disableZoom: true
      });

      // OFF 해도 상태는 유지 (단지 조작만 잠금)
      saveMapState();
      applyMapTransform();
    }
  });

  rotateLeftBtn.addEventListener("click", () => {
    if (!mapControlEnabled) {
      alert("지도 조작을 켜세요!");
      return;
    }
    mapState.angle -= 15;
    saveMapState();
    applyMapTransform();
  });

  rotateRightBtn.addEventListener("click", () => {
    if (!mapControlEnabled) {
      alert("지도 조작을 켜세요!");
      return;
    }
    mapState.angle += 15;
    saveMapState();
    applyMapTransform();
  });

  /* ============================================================================
      8) 초기 실행
  ============================================================================ */
  (async () => {
    await loadProducts();
    await loadRobots();
    await initRobotStatusList();
    await loadMap();          // 🔹 지도 + Panzoom + 상태 복원
    connectDashboardWs();
  })();
});