document.addEventListener('DOMContentLoaded', () => {
  const mainScreen = document.getElementById("main_screen");
  let products = [];  // 전체 상품 저장용

  console.log("✅ WMS Dashboard JS Loaded");

  // ✅ WebSocket 연결 (기존 유지)
  const ws = new WebSocket("ws://" + window.location.host + "/ws");
  ws.onopen = () => {
    console.log("[CLIENT] WebSocket connected to EC2");
    ws.send("init_request");
  };

  // ================================
  // ✅ 상품 검색 기능
  // ================================
  const searchInput = document.getElementById("search_input");
  const searchBtn   = document.getElementById("search_btn");
  const resultBody  = document.getElementById("result_body");
  const emptyHint   = document.getElementById("empty_hint");
  const pickedName  = document.getElementById("picked_name");

  // ✅ 상품 목록 로드
  async function loadProducts() {
    try {
      const res = await fetch("/stocks");
      if (!res.ok) throw new Error("상품 목록 로딩 실패");
      products = await res.json();
      renderTable(products);
    } catch (err) {
      console.error(err);
    }
  }

  // ✅ 테이블 렌더링
  function renderTable(data) {
    resultBody.innerHTML = "";

    if (data.length === 0) {
      emptyHint.style.display = "block";
      return;
    } else {
      emptyHint.style.display = "none";
    }

    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.pin_name}</td>
        <td>${item.quantity}</td>
      `;
      tr.addEventListener("click", () => {
        document.querySelectorAll(".product_table tr").forEach(row => row.classList.remove("selected"));
        tr.classList.add("selected");
        pickedName.textContent = item.name;
      });
      resultBody.appendChild(tr);
    });
  }

  // ✅ 검색 기능
  function searchProducts() {
    const keyword = searchInput.value.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(keyword) ||
        (p.pin_name || "").toLowerCase().includes(keyword)
    );
    renderTable(filtered);
  }

  // ✅ 이벤트 연결
  searchBtn.addEventListener("click", searchProducts);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchProducts();
  });

  // ✅ 페이지 진입 시 전체 상품 불러오기
  loadProducts();

  // ================================
  // ✅ 입고 / 출고 기능
  // ================================
  const btnIn  = document.getElementById("btn_in");
  const btnOut = document.getElementById("btn_out");
  const deltaInput = document.getElementById("delta_qty");
  
  const popup = document.getElementById("confirm_popup");
  const popupMsg = document.getElementById("popup_message");
  const popupYes = document.getElementById("popup_yes");
  const popupNo  = document.getElementById("popup_no");
  
  let selectedItem = null;
  let pendingAction = null; // "in" or "out"
  
  // 상품 클릭 시 selectedItem 저장 (renderTable 안)
  function renderTable(data) {
    resultBody.innerHTML = "";
  
    if (data.length === 0) {
      emptyHint.style.display = "block";
      return;
    } else {
      emptyHint.style.display = "none";
    }
  
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.pin_name}</td>
        <td>${item.quantity}</td>
      `;
      tr.addEventListener("click", () => {
        document.querySelectorAll(".product_table tr").forEach(row => row.classList.remove("selected"));
        tr.classList.add("selected");
        pickedName.textContent = item.name;
        selectedItem = item;
      });
      resultBody.appendChild(tr);
    });
  }
  
  // ✅ PUT 요청 (수량 업데이트)
  async function updateQuantity(item, newQty) {
    try {
      const res = await fetch(`/stocks/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty })
      });
  
      if (!res.ok) throw new Error("수량 업데이트 실패");
      const updated = await res.json();
  
      console.log("✅ 업데이트 성공:", updated);
      // ✅ 성공 시 화면 새로고침
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("수량 변경 중 오류 발생");
    }
  }
  
  // ✅ 팝업 열기
  function openPopup(message, actionType) {
    popupMsg.textContent = message;
    popup.style.display = "flex";
    pendingAction = actionType;
  }
  
  // ✅ 팝업 닫기
  function closePopup() {
    popup.style.display = "none";
    pendingAction = null;
  }
  
  // ✅ 팝업 버튼 이벤트
  popupNo.addEventListener("click", closePopup);
  popupYes.addEventListener("click", async () => {
    if (!selectedItem || !pendingAction) return closePopup();
    const delta = Number(deltaInput.value) || 0;
    if (delta <= 0) {
      alert("변경 수량을 올바르게 입력하세요.");
      return closePopup();
    }
  
    let newQty = selectedItem.quantity;
    if (pendingAction === "in") newQty += delta;
    else if (pendingAction === "out") {
      newQty -= delta;
      if (newQty < 0) {
        alert("출고 수량이 재고보다 많습니다.");
        return closePopup();
      }
    }
  
    closePopup();
    await updateQuantity(selectedItem, newQty);
  });
  
  // ✅ 입고 버튼
  btnIn.addEventListener("click", () => {
    if (!selectedItem) return alert("상품을 선택하세요.");
    openPopup(`"${selectedItem.name}"의 수량을 추가하시겠습니까?`, "in");
  });
  
  // ✅ 출고 버튼
  btnOut.addEventListener("click", () => {
    if (!selectedItem) return alert("상품을 선택하세요.");
    openPopup(`"${selectedItem.name}"의 수량을 감소하시겠습니까?`, "out");
  });
  
  // ✅ 작업 내역 출력용
  const logWrapper = document.getElementById("log_text_wrapper");
  
  function addLog(message) {
    const p = document.createElement("p");
    p.classList.add("log_entry");
    p.textContent = message;
    logWrapper.appendChild(p);
  
    // ✅ 스크롤 자동 아래로
    logWrapper.scrollTop = logWrapper.scrollHeight;
  }
  
  // ✅ 시간 포맷 함수
  function getTimeString() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }
  
  // ✅ PUT 요청 (수량 업데이트)
  async function updateQuantity(item, newQty, actionType, delta) {
    try {
      const res = await fetch(`/stocks/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty })
      });
  
      if (!res.ok) throw new Error("수량 업데이트 실패");
      const updated = await res.json();
  
      // ✅ 작업 내역 출력
      const msg = `[${item.name}]이/가 ${delta}개가 ${item.pin_name}로 ${actionType === "in" ? "입고" : "출고"}되었습니다. ${getTimeString()}`;
      addLog(msg);
  
      console.log("✅ 업데이트 성공:", updated);
  
      // ✅ 자동 새로고침 (약간의 딜레이)
      setTimeout(() => window.location.reload(), 600);
  
    } catch (err) {
      console.error(err);
      alert("수량 변경 중 오류 발생");
    }
  }
  
  // ✅ 팝업 “예” 버튼 이벤트 수정
  popupYes.addEventListener("click", async () => {
    if (!selectedItem || !pendingAction) return closePopup();
    const delta = Number(deltaInput.value) || 0;
    if (delta <= 0) {
      alert("변경 수량을 올바르게 입력하세요.");
      return closePopup();
    }
  
    let newQty = selectedItem.quantity;
    if (pendingAction === "in") newQty += delta;
    else if (pendingAction === "out") {
      newQty -= delta;
      if (newQty < 0) {
        alert("출고 수량이 재고보다 많습니다.");
        return closePopup();
      }
    }
  
    closePopup();
    await updateQuantity(selectedItem, newQty, pendingAction, delta);
  });


});