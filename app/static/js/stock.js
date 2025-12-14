document.addEventListener("DOMContentLoaded", () => {
  console.log("stock.js loaded");

  // 공통 DOM 요소 참조
  const tbody = document.querySelector(".stock_table.body tbody");
  if (!tbody) return console.warn("tbody not found on this page.");

  const addBox = document.querySelector(".product_add");
  const nameInput = addBox?.querySelector("input[type='text']");
  const qtyInput = addBox?.querySelector("input[type='number']");
  const cateBtn = addBox?.querySelector("button.dropdown_cate");
  const cateMenu = cateBtn?.nextElementSibling;
  const pinBtn = addBox?.querySelector("button.dropdown_pin");
  const pinMenu = pinBtn?.nextElementSibling;
  const addBtn = addBox?.querySelector(".add_btn");

  const catePanel = document.querySelector(".category_panel");
  const pinPanel = document.querySelector(".pin_panel");
  const cateInput = catePanel?.querySelector("input[type='text']");
  const cateAdd = catePanel?.querySelector(".add_btn");
  const cateDel = catePanel?.querySelector(".delete_btn");
  const cateList = catePanel?.querySelector(".category_list");
  const pinInput = pinPanel?.querySelector("input[type='text']");
  const pinAdd = pinPanel?.querySelector(".add_btn");
  const pinDel = pinPanel?.querySelector(".delete_btn");
  const pinList = pinPanel?.querySelector(".pin_list");

  const listButtons = document.querySelector(".list_buttons");

  // 상품 캐시
  let products = [];

  // 상품 목록 로딩
  async function loadProducts() {
    try {
      const res = await fetch("/stocks/");
      if (!res.ok) throw new Error("상품 목록 불러오기 실패");
      products = await res.json();
      renderTable(products);
    } catch (e) {
      console.error(e);
    }
  }

  // 상품 테이블 렌더링
  function renderTable(data) {
    tbody.innerHTML = "";
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" data-id="${item.id}" /></td>
        <td>${item.id}</td>
        <td>${item.name}</td>
        <td>${item.category_name}</td>
        <td>${item.quantity}</td>
        <td>${item.pin_name}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 검색 입력 처리
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const kw = e.target.value.toLowerCase();
      const filtered = products.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(kw) ||
          (p.category_name || "").toLowerCase().includes(kw)
      );
      renderTable(filtered);
    });
  }

  // 카테고리 목록 로딩
  async function loadCategories() {
    try {
      const res = await fetch("/categories/");
      if (!res.ok) throw new Error("카테고리 로드 실패");
      const data = await res.json();

      if (cateList) {
        cateList.innerHTML = data
          .map(
            (c) =>
              `<li><label><input type="checkbox" data-id="${c.id}" /> ${c.name}</label></li>`
          )
          .join("");
      }

      if (cateMenu) {
        cateMenu.innerHTML = data
          .map((c) => `<p data-id="${c.id}">${c.name}</p>`)
          .join("");
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 카테고리 추가 처리
  if (cateAdd && cateInput) {
    cateAdd.addEventListener("click", async () => {
      const name = cateInput.value.trim();
      if (!name) return alert("카테고리명을 입력하세요.");

      const res = await fetch("/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return alert(err.detail || "카테고리 추가 실패");
      }

      cateInput.value = "";
      loadCategories();
    });
  }

  // 카테고리 삭제 처리
  if (cateDel) {
    cateDel.addEventListener("click", async () => {
      const checked = cateList?.querySelectorAll("input:checked") || [];
      if (!checked.length) return alert("삭제할 카테고리를 선택하세요.");

      for (const cb of checked) {
        const id = cb.dataset.id;
        await fetch(`/categories/${id}`, { method: "DELETE" });
      }

      loadCategories();
      loadProducts();
    });
  }

  // 핀 목록 로딩
  async function loadPins() {
    try {
      const res = await fetch("/pins/");
      if (!res.ok) throw new Error("핀 로드 실패");
      const data = await res.json();

      if (pinList) {
        pinList.innerHTML = data
          .map(
            (p) =>
              `<li><label><input type="checkbox" data-id="${p.id}" /> ${p.name}</label></li>`
          )
          .join("");
      }

      if (pinMenu) {
        pinMenu.innerHTML = data
          .map((p) => `<p data-id="${p.id}">${p.name}</p>`)
          .join("");
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 핀 추가 처리
  if (pinAdd) {
    pinAdd.addEventListener("click", async () => {
      const name = document.querySelector(".pin_name_input").value.trim();
      const xVal = document.querySelector(".pin_x_input").value.trim();
      const yVal = document.querySelector(".pin_y_input").value.trim();

      if (!name) return alert("위치명을 입력하세요.");
      if (!xVal || !yVal) return alert("좌표(X,Y)를 입력하세요.");

      const coords = `${xVal},${yVal}`;

      const res = await fetch("/pins/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, coords }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return alert(err.detail || "위치 추가 실패");
      }

      document.querySelector(".pin_name_input").value = "";
      document.querySelector(".pin_x_input").value = "";
      document.querySelector(".pin_y_input").value = "";

      loadPins();
    });
  }

  // 핀 삭제 처리
  if (pinDel) {
    pinDel.addEventListener("click", async () => {
      const checked = pinList?.querySelectorAll("input:checked") || [];
      if (!checked.length) return alert("삭제할 위치를 선택하세요.");

      for (const cb of checked) {
        const id = cb.dataset.id;
        await fetch(`/pins/${id}`, { method: "DELETE" });
      }

      loadPins();
      loadProducts();
    });
  }

  // 드롭다운 토글 및 선택 처리
  document.querySelectorAll(".product_add .dropdown").forEach((dropdown) => {
    const button = dropdown.querySelector(".dropdown_cate, .dropdown_pin");
    const menu = dropdown.querySelector(".dropdown_menu");
    if (!button || !menu) return;

    button.addEventListener("click", (e) => {
      e.stopPropagation();

      document
        .querySelectorAll(".product_add .dropdown .dropdown_menu")
        .forEach((m) => {
          if (m !== menu) m.style.display = "none";
        });

      const isOpen = menu.style.display === "block";
      menu.style.display = isOpen ? "none" : "block";
    });

    menu.addEventListener("click", (e) => {
      const item = e.target.closest("p");
      if (!item) return;

      button.textContent = item.textContent;
      button.dataset.id = item.dataset.id;
      menu.style.display = "none";
    });
  });

  // 바깥 클릭 시 드롭다운 닫기
  document.addEventListener("click", () => {
    document
      .querySelectorAll(".product_add .dropdown .dropdown_menu")
      .forEach((m) => (m.style.display = "none"));
  });

  // 상품 등록 처리
  if (addBtn && nameInput && qtyInput && cateBtn && pinBtn) {
    addBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const qty = Number(qtyInput.value);
      const category_id = Number(cateBtn.dataset.id || 0);
      const pin_id = Number(pinBtn.dataset.id || 0);

      if (!name || !qty || !category_id || !pin_id) {
        return alert("모두 입력/선택하세요.");
      }

      await fetch("/stocks/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: qty, category_id, pin_id }),
      });

      nameInput.value = "";
      qtyInput.value = "";
      cateBtn.textContent = "카테고리";
      pinBtn.textContent = "위치";

      delete cateBtn.dataset.id;
      delete pinBtn.dataset.id;

      loadProducts();
    });
  }

  // 수정/삭제 이벤트 위임 처리
  listButtons?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.classList.contains("delete_btn")) {
      const checked = tbody.querySelectorAll("input:checked");
      if (!checked.length) return alert("삭제할 상품을 선택하세요.");

      for (const cb of checked) {
        await fetch(`/stocks/${cb.dataset.id}`, { method: "DELETE" });
      }

      return loadProducts();
    }

    if (btn.classList.contains("edit_btn")) {
      const checked = tbody.querySelectorAll("input:checked");
      if (!checked.length) return alert("수정할 상품을 선택하세요.");

      const [categories, pins] = await Promise.all([
        fetch("/categories/").then((r) => r.json()),
        fetch("/pins/").then((r) => r.json()),
      ]);

      for (const cb of checked) {
        const tr = cb.closest("tr");
        const id = cb.dataset.id;
        const product = products.find((p) => p.id == id);
        if (!product) continue;

        tr.innerHTML = `
          <td><input type="checkbox" data-id="${id}" checked /></td>
          <td>${id}</td>
          <td><input type="text" class="edit_name" value="${product.name}"/></td>
          <td>
            <select class="edit_category">
              ${categories
                .map(
                  (c) =>
                    `<option value="${c.id}" ${
                      c.name === product.category_name ? "selected" : ""
                    }>${c.name}</option>`
                )
                .join("")}
            </select>
          </td>
          <td><input type="number" class="edit_qty" value="${product.quantity}" min="0"/></td>
          <td>
            <select class="edit_pin">
              ${pins
                .map(
                  (p) =>
                    `<option value="${p.id}" ${
                      p.name === product.pin_name ? "selected" : ""
                    }>${p.name}</option>`
                )
                .join("")}
            </select>
          </td>
        `;
      }

      listButtons.innerHTML = `
        <button class="add_btn confirm_edit_btn">변경 완료</button>
        <button class="delete_btn now_delete_btn">삭제</button>
        <button class="cancel_btn">취소</button>
      `;
      return;
    }

    if (btn.classList.contains("confirm_edit_btn")) {
      const edited = tbody.querySelectorAll("input:checked");

      for (const cb of edited) {
        const tr = cb.closest("tr");
        const id = cb.dataset.id;

        const name = tr.querySelector(".edit_name").value.trim();
        const quantity = Number(tr.querySelector(".edit_qty").value);
        const category_id = Number(tr.querySelector(".edit_category").value);
        const pin_id = Number(tr.querySelector(".edit_pin").value);

        await fetch(`/stocks/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, quantity, category_id, pin_id }),
        });
      }

      alert("수정 완료");
      await loadProducts();

      listButtons.innerHTML = `
        <button class="edit_btn">수정</button>
        <button class="delete_btn">삭제</button>
      `;
      return;
    }

    if (btn.classList.contains("now_delete_btn")) {
      const checked = tbody.querySelectorAll("input:checked");
      if (!checked.length) return alert("삭제할 상품을 선택하세요.");

      for (const cb of checked) {
        await fetch(`/stocks/${cb.dataset.id}`, { method: "DELETE" });
      }

      await loadProducts();

      listButtons.innerHTML = `
        <button class="edit_btn">수정</button>
        <button class="delete_btn">삭제</button>
      `;
      return;
    }

    if (btn.classList.contains("cancel_btn")) {
      await loadProducts();

      listButtons.innerHTML = `
        <button class="edit_btn">수정</button>
        <button class="delete_btn">삭제</button>
      `;
    }
  });

  // 초기 데이터 로딩
  loadProducts();
  loadCategories();
  loadPins();

  // CSV 업로드 함수 노출
  window.uploadStockCsv = function () {
    const fileInput = document.getElementById("csvFileInput");
    const statusText = document.getElementById("csvStatus");

    if (!fileInput || !fileInput.files.length) {
      if (statusText) {
        statusText.textContent = "CSV 파일을 선택해주세요.";
        statusText.style.color = "red";
      } else {
        alert("CSV 파일을 선택해주세요.");
      }
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    if (statusText) {
      statusText.textContent = "업로드 중...";
      statusText.style.color = "black";
    }

    fetch("/stock/csv/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) throw new Error("업로드 실패");
        return response.json();
      })
      .then((data) => {
        if (statusText) {
          statusText.textContent =
            "업로드 완료! (" + (data.processed_rows ?? 0) + "건 처리됨)";
          statusText.style.color = "green";
        }
        loadProducts();
      })
      .catch((error) => {
        console.error(error);
        if (statusText) {
          statusText.textContent = "에러 발생: " + error.message;
          statusText.style.color = "red";
        } else {
          alert("에러 발생: " + error.message);
        }
      });
  };
});