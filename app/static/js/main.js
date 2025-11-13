/**  ===============================
 *   WMS Dashboard JS  (B 모드 포함)
 *   모든 기존 기능 그대로 유지 + 전체 로봇 표시 추가
 *  =============================== 
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

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
  const startBtn    = document.getElementById("btn_start");

  let products = [];
  let selectedItem = null;
  let commandQueue = [];
  let ROBOT_STATUS = {};   // ❤️ 여기서 모든 로봇 관리

  /* ==========================
     1) 전체 로봇 목록 가져와서
        ROBOT_STATUS에 기본값만 미리 넣어둠
  ========================== */
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
          mode: "미연결",
        };
      }
    });

    renderRobotCards();
    console.log("🔄 초기 로봇 목록 생성 완료:", ROBOT_STATUS);
  }

  /* ==========================
     기존 상품/검색/명령 코드는 그대로 유지
  ========================== */

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

  /* ==========================
       8) 로봇 상태 카드 렌더링 (B 모드 적용)
    ========================== */
    function renderRobotCards() {
      const container = document.getElementById("robot_status_list");
      if (!container) return;

      container.innerHTML = "";

      // 연결된 로봇을 위로 정렬
      const sorted = Object.values(ROBOT_STATUS).sort((a, b) =>
        Number(b.connected) - Number(a.connected)
      );
    
      sorted.forEach(robot => {
        const card = document.createElement("div");
        card.className = "robot_card";
      
        // OFFLINE 회색 처리
        if (!robot.connected) {
          card.classList.add("offline");
        }
      
        const battery = robot.battery ?? 0;
        const speed = robot.speed ? robot.speed.toFixed(2) : "0.00";
      
        const posX = robot.x !== undefined ? robot.x.toFixed(2) : "0.00";
        const posY = robot.y !== undefined ? robot.y.toFixed(2) : "0.00";
      
        card.innerHTML = `
          <div class="robot_card_title">${robot.name}</div>
          <div class="robot_card_info">속도: ${speed} m/s</div>
          <div class="robot_card_info">위치: (${posX}, ${posY})</div>
          <div class="robot_card_info">상태: ${robot.mode}</div>
      
          <div class="robot_card_bar" style="margin-top: 8px;">
            <div class="robot_card_bar_fill" style="width: ${battery}%"></div>
          </div>
        `;
      
        container.appendChild(card);
      });
    }

  /* ==========================
     9) WebSocket (B 모드 완성)
  ========================== */
  function connectDashboardWs() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      let msg = JSON.parse(event.data);
      const type = msg.type;
      const p = msg.payload || {};
      const name = p.robot_name;
      if (!name) return;

      // ROBOT_STATUS에 없으면 무시
      if (!ROBOT_STATUS[name]) return;

      const r = ROBOT_STATUS[name];

      if (type === "status") {
        r.connected = p.connected;
        r.mode = p.connected ? "자동" : "미연결";
      }

      else if (type === "battery") {
        r.battery = p.percentage;
      }

      else if (type === "odom") {
        r.speed = p.linear?.x || 0;
        if (p.position) {
          r.x = p.position.x;
          r.y = p.position.y;
        }
      }

      else if (type === "teleop_key") {
        r.mode = p.key ? "수동" : "자동";
      }

      renderRobotCards();
    };

    ws.onclose = () => {
      console.log("[WS] Dashboard disconnected, retrying...");
      setTimeout(connectDashboardWs, 2000);
    };
  }

  /* ==========================
      초기 실행
  ========================== */
  (async () => {
    await loadProducts();
    await loadRobots();
    await initRobotStatusList();   // ⭐ 전체 로봇 목록으로 ROBOT_STATUS 초기화
    connectDashboardWs();
  })();
});