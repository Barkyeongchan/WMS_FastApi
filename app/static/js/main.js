document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded");

  // ===== DOM 요소 =====
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
  const robotStatusSelect = document.getElementById("robot_status_select");

  // ===== 전역 상태 =====
  let products = [];
  let selectedItem = null;
  let commandQueue = [];

  // ==========================
  // 1️⃣ 상품 목록 불러오기
  // ==========================
  async function loadProducts() {
    try {
      const res = await fetch("/stocks/");
      if (!res.ok) throw new Error("상품 목록 로딩 실패");
      products = await res.json();
      renderTable(products);
    } catch (err) {
      console.error("[ERROR] 상품 목록 불러오기 실패:", err);
    }
  }

  // ==========================
  // 2️⃣ 로봇 목록 불러오기 (입출고용)
  // ==========================
  async function loadRobots() {
    try {
      const res = await fetch("/robots/");
      if (!res.ok) throw new Error("로봇 목록 로딩 실패");
      const robots = await res.json();
      robotSelect.innerHTML = `<option value="">로봇 목록</option>`;
      robots.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        robotSelect.appendChild(opt);
      });
      console.log("✅ 입출고용 로봇 목록 불러오기 완료:", robots);
    } catch (e) {
      console.error("로봇 목록 로딩 오류:", e);
    }
  }

  // ==========================
  // 3️⃣ 상품 테이블 렌더링
  // ==========================
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
        document.querySelectorAll(".product_table tr").forEach(r => r.classList.remove("selected"));
        tr.classList.add("selected");
        pickedName.textContent = item.name;
        selectedItem = item;
      });
      resultBody.appendChild(tr);
    });
  }

  // ==========================
  // 4️⃣ 명령 로그 렌더링
  // ==========================
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

  // ==========================
  // 5️⃣ 명령 추가
  // ==========================
  function addCommand(type) {
    if (!selectedItem) return alert("상품을 선택하세요.");
    const robotName = robotSelect.options[robotSelect.selectedIndex].text;
    if (!robotSelect.value) return alert("작업 로봇을 선택하세요.");

    const qty = Number(deltaInput.value);
    if (qty <= 0) return alert("변경 수량을 올바르게 입력하세요.");

    const cmd = {
      product: selectedItem.name,
      quantity: qty,
      robotId: robotSelect.value,
      robotName,
      type
    };

    commandQueue.push(cmd);
    renderLog();
  }

  // ==========================
  // 6️⃣ 명령 실행 (시작 버튼)
  // ==========================
  async function executeCommands() {
    if (commandQueue.length === 0) return alert("명령이 없습니다.");

    for (const cmd of commandQueue) {
      const item = products.find(p => p.name === cmd.product);
      if (!item) continue;

      let newQty = cmd.type === "입고"
        ? item.quantity + cmd.quantity
        : item.quantity - cmd.quantity;

      if (newQty < 0) newQty = 0;

      try {
        await fetch(`/stocks/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: newQty }),
        });
      } catch (err) {
        console.error("❌ 수량 업데이트 실패:", err);
      }
    }

    commandQueue = [];
    renderLog();
    await loadProducts();
    alert("모든 명령이 실행되었습니다.");
  }

  // ==========================
  // 7️⃣ 검색 기능
  // ==========================
  function searchProducts() {
    const kw = searchInput.value.trim().toLowerCase();
    const filtered = products.filter(p =>
      (p.name || "").toLowerCase().includes(kw) ||
      (p.pin_name || "").toLowerCase().includes(kw)
    );
    renderTable(filtered);
  }

  // ==========================
  // 8️⃣ 오른쪽 패널 로봇 상태용 드롭다운
  // ==========================
  async function loadRobotsForStatus() {
    try {
      const res = await fetch("/robots/");
      if (!res.ok) throw new Error("로봇 목록 로딩 실패");
      const robots = await res.json();

      robotStatusSelect.innerHTML = `<option value="">로봇 선택</option>`;
      robots.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        robotStatusSelect.appendChild(opt);
      });

      console.log("✅ 상태 패널용 로봇 목록 불러오기 완료:", robots);
    } catch (e) {
      console.error("❌ 로봇 상태 선택 로딩 오류:", e);
    }
  }

  // 선택 이벤트 (현재 콘솔 출력만)
  if (robotStatusSelect) {
    robotStatusSelect.addEventListener("change", (e) => {
      const selected = e.target.options[e.target.selectedIndex].text;
      if (e.target.value) {
        console.log(`📡 선택된 로봇: ${selected}`);
      }
    });
  }

  // ==========================
  // 9️⃣ 이벤트 등록
  // ==========================
  searchBtn.addEventListener("click", searchProducts);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchProducts();
  });

  btnIn.addEventListener("click", () => addCommand("입고"));
  btnOut.addEventListener("click", () => addCommand("출고"));
  startBtn.addEventListener("click", executeCommands);

  // ==========================
  // 🔟 초기 로드
  // ==========================
  loadProducts();
  loadRobots();
  loadRobotsForStatus(); // ✅ 중요! 오른쪽 드롭다운 작동시키는 부분
});