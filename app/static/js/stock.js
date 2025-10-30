// app/static/js/stock.js
document.addEventListener("DOMContentLoaded", () => {

  /* ✅ 공통 드롭다운 로직 (기존 유지) */
  const dropdowns = document.querySelectorAll(".dropdown");
  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector(".dropdown_cate, .dropdown_pin");
    const menu = dropdown.querySelector(".dropdown_menu");

    button.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".dropdown_menu").forEach(other => {
        if (other !== menu) other.style.display = "none";
      });
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown_menu").forEach(menu => {
      menu.style.display = "none";
    });
  });

  /* =======================
     ✅ 상품 테이블 (리스트/검색/정렬/체크삭제)
     ======================= */
  const tbody = document.querySelector(".stock_table.body tbody");
  let products = [];

  // 테이블 렌더링 — 서버 응답 필드명에 맞춤
  const renderTable = (data) => {
    tbody.innerHTML = "";
    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" data-id="${item.id}" /></td>
        <td>${item.id}</td>                 <!-- ✅ ID 추가 -->
        <td>${item.name}</td>
        <td>${item.category_name}</td>
        <td>${item.quantity}</td>
        <td>${item.pin_name}</td>
      `;
      tbody.appendChild(tr);
    });
  };


  // 검색 — name, category_name 기준
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const keyword = e.target.value.toLowerCase();
      const filtered = products.filter(p =>
        (p.name || "").toLowerCase().includes(keyword) ||
        (p.category_name || "").toLowerCase().includes(keyword)
      );
      renderTable(filtered);
    });
  }

  // ✅ 정렬 — thead 의 data-sort 값: stock_id, name, category, qty, location
  let sortStates = {
    stock_id: "asc",
    name: "asc",
    category_name: "asc",
    quantity: "asc",
    pin_name: "asc"
  };
  
  document.querySelectorAll(".stock_table thead th[data-sort]").forEach(th => {
    const rawKey = th.dataset.sort; // stock_id | name | category | qty | location
  
    // 화면 헤더 키 → 실제 데이터 키 매핑
    const keyMap = {
      stock_id: "id",
      name: "name",
      category: "category_name",
      qty: "quantity",
      location: "pin_name"
    };
    const key = keyMap[rawKey] || rawKey;
  
    // 초기 화살표
    th.textContent += " ▲";
  
    th.addEventListener("click", () => {
      const isAsc = (sortStates[key] || "asc") === "asc";
      sortStates[key] = isAsc ? "desc" : "asc";
    
      // 정렬 로직
      products.sort((a, b) => {
        const av = a[key], bv = b[key];
        if (typeof av === "number" && typeof bv === "number") {
          return isAsc ? bv - av : av - bv;   // 숫자 기준
        }
        const as = (av ?? "").toString();
        const bs = (bv ?? "").toString();
        return isAsc ? bs.localeCompare(as) : as.localeCompare(bs); // 문자열 기준
      });
    
      // 헤더 화살표 업데이트
      document.querySelectorAll(".stock_table thead th[data-sort]").forEach(h => {
        const hk = keyMap[h.dataset.sort] || h.dataset.sort;
        h.textContent = h.textContent.replace(/ ▲| ▼/g, "");
        h.textContent += (sortStates[hk] || "asc") === "asc" ? " ▲" : " ▼";
      });
    
      renderTable(products);
    });
  });


  /* =======================
     ✅ 카테고리 관리 (기존 동작 유지)
     ======================= */
  const cateInput = document.querySelector(".category_panel input");
  const cateAddBtn = document.querySelector(".category_panel .add_btn");
  const cateDelBtn = document.querySelector(".category_panel .delete_btn");
  const cateList   = document.querySelector(".category_list");

  const cateDropdownBtn   = document.querySelector(".product_add .dropdown_cate");
  const cateDropdownMenu  = document.querySelector(".product_add .dropdown_cate + .dropdown_menu");
  const CATEGORY_API = "/categories";

  function renderCategory(items) {
    // 오른쪽 패널 리스트
    if (cateList) {
      cateList.innerHTML = items.map(c =>
        `<li><input type="checkbox" data-id="${c.id}" /><span>${c.name}</span></li>`
      ).join("");
    }

    // 상품 등록 드롭다운
    if (cateDropdownMenu) {
      cateDropdownMenu.innerHTML = items.map(c =>
        `<p data-id="${c.id}">${c.name}</p>`
      ).join("");

      cateDropdownMenu.querySelectorAll("p").forEach(p => {
        p.addEventListener("click", () => {
          cateDropdownBtn.textContent = p.textContent;
          cateDropdownBtn.dataset.id = p.dataset.id;  // 등록 시 사용할 FK
          cateDropdownMenu.style.display = "none";
        });
      });
    }
  }

  async function loadCategories() {
    const res = await fetch(CATEGORY_API);
    if (!res.ok) return;
    const data = await res.json();
    renderCategory(data);
  }

  if (cateAddBtn) {
    cateAddBtn.addEventListener("click", async () => {
      const name = (cateInput?.value || "").trim();
      if (!name) return alert("카테고리명 입력");

      await fetch(CATEGORY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });

      if (cateInput) cateInput.value = "";
      loadCategories();
    });
  }

  if (cateDelBtn) {
    cateDelBtn.addEventListener("click", async () => {
      const checked = cateList?.querySelectorAll("input:checked") || [];
      if (!checked.length) return alert("삭제할 항목 선택");

      for (const c of checked) {
        await fetch(`${CATEGORY_API}/${c.dataset.id}`, { method: "DELETE" });
      }
      loadCategories();
    });
  }

  loadCategories();

  /* =======================
     ✅ 위치 관리 (기존 동작 유지)
     ======================= */
  const pinInput = document.querySelector(".pin_panel input");
  const pinAddBtn = document.querySelector(".pin_panel .add_btn");
  const pinDelBtn = document.querySelector(".pin_panel .delete_btn");
  const pinListEl = document.querySelector(".pin_list");

  const pinDropdownBtn  = document.querySelector(".product_add .dropdown_pin");
  const pinDropdownMenu = document.querySelector(".product_add .dropdown_pin + .dropdown_menu");
  const PIN_API = "/pins";

  function renderPins(items) {
    // 오른쪽 패널 리스트
    if (pinListEl) {
      pinListEl.innerHTML = items.map(p =>
        `<li><input type="checkbox" data-id="${p.id}" /><span>${p.name}</span></li>`
      ).join("");
    }

    // 상품 등록 드롭다운
    if (pinDropdownMenu) {
      pinDropdownMenu.innerHTML = items.map(p =>
        `<p data-id="${p.id}">${p.name}</p>`
      ).join("");

      pinDropdownMenu.querySelectorAll("p").forEach(p => {
        p.addEventListener("click", () => {
          pinDropdownBtn.textContent = p.textContent;
          pinDropdownBtn.dataset.id = p.dataset.id;  // 등록 시 사용할 FK
          pinDropdownMenu.style.display = "none";
        });
      });
    }
  }

  async function loadPins() {
    const res = await fetch(PIN_API);
    if (!res.ok) return;
    const data = await res.json();
    renderPins(data);
  }

  if (pinAddBtn) {
    pinAddBtn.addEventListener("click", async () => {
      const name = (pinInput?.value || "").trim();
      if (!name) return alert("위치명 입력");

      await fetch(PIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });

      if (pinInput) pinInput.value = "";
      loadPins();
    });
  }

  if (pinDelBtn) {
    pinDelBtn.addEventListener("click", async () => {
      const checked = pinListEl?.querySelectorAll("input:checked") || [];
      if (!checked.length) return alert("삭제할 위치 선택");

      for (const p of checked) {
        await fetch(`${PIN_API}/${p.dataset.id}`, { method: "DELETE" });
      }
      loadPins();
    });
  }

  loadPins();

  /* =======================
     ✅ 상품 등록 / 리스트 로딩 / 체크삭제
     ======================= */
  const productNameInput = document.querySelector(".product_add input[type='text']");
  const productQtyInput  = document.querySelector(".product_add input[type='number']");
  const productAddBtn    = document.querySelector(".product_add .add_btn");
  const stockDeleteBtn   = document.querySelector(".product_list .delete_btn");

  // 리스트 로딩
  async function loadProducts() {
    const res = await fetch("/stocks");
    if (!res.ok) return;
    const data = await res.json();
    // 서버 응답 그대로 저장 (id, name, quantity, category_name, pin_name)
    products = data;
    renderTable(products);
  }

  // 등록
  if (productAddBtn) {
    productAddBtn.addEventListener("click", async () => {
      const name = (productNameInput?.value || "").trim();
      const quantity = Number(productQtyInput?.value || 0);
      const category_id = cateDropdownBtn?.dataset.id;
      const pin_id = pinDropdownBtn?.dataset.id;

      if (!name) return alert("상품명 입력");
      if (!category_id) return alert("카테고리 선택");
      if (!pin_id) return alert("위치 선택");
      if (!quantity || quantity < 1) return alert("수량 입력");

      await fetch("/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity, category_id, pin_id })
      });

      if (productNameInput) productNameInput.value = "";
      if (productQtyInput) productQtyInput.value = "";
      if (cateDropdownBtn) { cateDropdownBtn.textContent = "카테고리"; delete cateDropdownBtn.dataset.id; }
      if (pinDropdownBtn)  { pinDropdownBtn.textContent  = "위치";     delete pinDropdownBtn.dataset.id; }

      loadProducts();
    });
  }

  // 체크삭제
  if (stockDeleteBtn) {
    stockDeleteBtn.addEventListener("click", async () => {
      const checked = tbody.querySelectorAll("input[type='checkbox']:checked");
      if (!checked.length) return alert("삭제할 상품 선택");

      for (const cb of checked) {
        const id = cb.dataset.id;
        await fetch(`/stocks/${id}`, { method: "DELETE" });
      }
      loadProducts();
    });
  }

  // 최초 로딩
  loadProducts();
});