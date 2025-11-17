document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

  /* ============================================================================
      🔵 WebSocket 전역 선언
  ============================================================================ */
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${protocol}://${location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  /* ============================================================================
      🔵 PIVOT (지도 중심)
  ============================================================================ */
  const PIVOT_X = 1.42;
  const PIVOT_Y = 1.72;

  /* ============================================================================
      🔥 지도 보정값
  ============================================================================ */
  const OFFSET_X = -43;
  const OFFSET_Y = -5;
  const SCALE_X  = 0.55;
  const SCALE_Y  = 0.52;

  /* ============================================================================
      변수들
  ============================================================================ */
  const robotSelect = document.getElementById("robot_select");
  const resultBody  = document.getElementById("result_body");
  const emptyHint   = document.getElementById("empty_hint");
  const pickedName  = document.getElementById("picked_name");


  let products = [];
  let selectedItem = null;
  let ROBOT_STATUS = {};
  let lastRobotPose = { x: null, y: null, theta: 0 };
  let activeRobotName = null;

  let mapInfo = {
    image: null,
    resolution: 0.045,
    origin: [0, 0]
  };

  /* ============================================================================
      ⭐ 명령 대기 로그 저장용
  ============================================================================ */
  let pendingCommands = [];

  function addPendingLog(text) {
    const area = document.getElementById("log_area");
    if (!area) return;

    const p = document.createElement("p");
    p.textContent = text;
    p.style.margin = "4px 0";
    area.appendChild(p);
  }

  /* ============================================================================
      로봇 상태카드 초기 생성
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
        mode: "대기중",
      };
    });

    renderRobotCards();
  }

  /* ============================================================================
      상품/로봇 데이터
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
      로봇 카드 렌더링
  ============================================================================ */
  function renderRobotCards() {
    const container = document.getElementById("robot_status_list");
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
      WS 메시지 처리
  ============================================================================ */
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "stock_update") {
        console.log("📦 재고 갱신 → 테이블 리로드");
        loadProducts();   // ← DB 재조회 후 테이블 갱신
        return;
    }

    const p   = msg?.payload || {};
    const name = p.robot_name;

    /* ----------------------------------------------------------
       1) robot_status 는 robot_name 없이 올 수도 있음 (WAIT)
    ---------------------------------------------------------- */
    if (msg.type === "robot_status") {
      const state = p.state || "대기중";

      // 이름이 있으면 해당 로봇에 반영
      if (name && ROBOT_STATUS[name]) {
        ROBOT_STATUS[name].mode = state;
        activeRobotName = name;
      }
      // 이름이 없으면, 현재 활성 로봇에 반영 (단일 로봇 가정)
      else if (activeRobotName && ROBOT_STATUS[activeRobotName]) {
        ROBOT_STATUS[activeRobotName].mode = state;
      }

      renderRobotCards();
      return;
    }

    // 나머지 타입은 기존 로직 그대로
    if (!name || !ROBOT_STATUS[name]) return;
    const r = ROBOT_STATUS[name];
    activeRobotName = name;

    if (msg.type === "status") {
      r.connected = p.connected;
      r.mode = p.connected ? "대기중" : "미연결";
    }

    else if (msg.type === "battery") {
      r.battery = p.percentage;
    }

    else if (msg.type === "odom") {
      r.speed = p.linear?.x || 0;
    }

    else if (msg.type === "amcl_pose") {
      r.x = p.x;
      r.y = p.y;
      r.theta = p.theta;

      lastRobotPose = { x: r.x, y: r.y, theta: r.theta };
      updateRobotMarker(r);
    }

    else if (msg.type === "robot_arrived") {
      const pin = p.pin;

      if (pin === "WAIT") {
        // 복귀 완료
        r.mode = "대기중";
      } else {
        // 목적지 도착 → App에서 확인 누르기 전까지는 '작업중'
        r.mode = "작업중";
      }
    }


    renderRobotCards();
  };

  ws.onclose = () => {
    console.log("[WS] Dashboard lost. Reconnecting…");
    setTimeout(() => location.reload(), 1500);
  };

  /* ============================================================================
      지도 로딩
  ============================================================================ */
  async function loadMap() {
    try {
      const res = await fetch("/map/info");
      const info = await res.json();

      mapInfo = info;

      const img = document.getElementById("map_image");
      img.src = info.image;

    } catch (err) {
      console.error("지도 로딩 실패:", err);
    }
  }

  /* ============================================================================
      좌표 변환
  ============================================================================ */
  function rosToPixel(x, y) {
    const img = document.getElementById("map_image");
    const container = document.getElementById("map_container");
    if (!img.complete) return {x:0,y:0};

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const scaleBase = Math.max(cw / iw, ch / ih);

    const pivot_px = (PIVOT_X - mapInfo.origin[0]) / mapInfo.resolution;
    const pivot_py = (PIVOT_Y - mapInfo.origin[1]) / mapInfo.resolution;
    const pivot_pyFlip = ih - pivot_py;

    const offsetX0 = (cw - iw * scaleBase) / 2;
    const offsetY0 = (ch - ih * scaleBase) / 2;

    const pivot_global_x = pivot_px * scaleBase + offsetX0;
    const pivot_global_y = pivot_pyFlip * scaleBase + offsetY0;

    const px = (x - mapInfo.origin[0]) / mapInfo.resolution;
    const py = (y - mapInfo.origin[1]) / mapInfo.resolution;
    const pyFlip = ih - py;

    return {
      x: pivot_global_x + (px - pivot_px) * scaleBase * SCALE_X + OFFSET_X,
      y: pivot_global_y + (pyFlip - pivot_pyFlip) * scaleBase * SCALE_Y + OFFSET_Y
    };
  }

  function updateRobotMarker(robot) {
    const marker = document.getElementById("robot_marker");
    const p = rosToPixel(robot.x, robot.y);

    marker.style.display = "block";
    marker.style.left = `${p.x - 10}px`;
    marker.style.top  = `${p.y - 10}px`;
    marker.style.transform = `rotate(${robot.theta * 180/Math.PI}deg)`;
  }

  /* ============================================================================
      ⭐ 입고 / 출고 → 대기 로그 저장 기능
  ============================================================================ */

  document.getElementById("btn_in").addEventListener("click", () => {
      if (!selectedItem) return alert("상품을 선택하세요!");
      if (!robotSelect.value) return alert("로봇을 선택하세요!");

      const qty = Number(document.getElementById("delta_qty").value);

      // 🔥 로봇 이름 가져오기
      const robotName = robotSelect.selectedOptions[0].textContent.split(" ")[0];
      const pinName = selectedItem.pin_name;

      const entry = {
        stock_id: selectedItem.id,
        amount: qty,
        robot_name: robotName,  // 여기 저장됨
        mode: "INBOUND"
      };

      pendingCommands.push(entry);

      addPendingLog(`[입고] ${robotName} : ${selectedItem.name} ${qty}개 → ${pinName}`);

  });


  document.getElementById("btn_out").addEventListener("click", () => {
      if (!selectedItem) return alert("상품을 선택하세요!");
      if (!robotSelect.value) return alert("로봇을 선택하세요!");

      const qty = Number(document.getElementById("delta_qty").value);

      // 🔥 로봇 이름 가져오기
      const robotName = robotSelect.selectedOptions[0].textContent.split(" ")[0];
      const pinName = selectedItem.pin_name;

      const entry = {
        stock_id: selectedItem.id,
        amount: qty,
        robot_name: robotName,
        mode: "OUTBOUND"
      };

      pendingCommands.push(entry);

      addPendingLog(`[출고] ${robotName} : ${selectedItem.name} ${qty}개 → ${pinName}`);
  });

  /* ============================================================================
      ⭐ 시작 버튼 → 서버로 1건 전송
  ============================================================================ */
  document.getElementById("btn_start").addEventListener("click", () => {
    if (pendingCommands.length === 0) {
      return alert("대기 중인 명령이 없습니다.");
    }

    const cmd = pendingCommands.shift();

    const wsMsg = {
      type: "request_stock_move",
      payload: {
        stock_id: cmd.stock_id,
        robot_id: cmd.robot_id,
        amount: cmd.amount,
        mode: cmd.mode
      }
    };

    ws.send(JSON.stringify(wsMsg));

    console.log("📤 서버로 전송:", wsMsg);

    // UI 상태 업데이트 (기존 동작 유지)
    if (activeRobotName) {
      ROBOT_STATUS[activeRobotName].mode = `${selectedItem.pin_name} 이동중`;
      renderRobotCards();
    }

    // 대기 로그 초기화
    document.getElementById("log_area").innerHTML = "";

    alert("명령이 실행되었습니다.");
  });

  /* ============================================================================
      초기 로드
  ============================================================================ */
  (async () => {
    await loadProducts();
    await loadRobots();
    await initRobotStatusList();
    await loadMap();
  })();
});