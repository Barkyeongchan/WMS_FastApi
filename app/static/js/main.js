document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ WMS Dashboard JS Loaded (safe)");

  // ---- WebSocket (있으면 연결만; 실패해도 무시) ----
  try {
    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log("[CLIENT] WebSocket connected to EC2");
      try { ws.send("init_request"); } catch (_) {}
    };
    ws.onerror = (e) => console.warn("[CLIENT] WebSocket error", e);
  } catch (e) {
    console.warn("WS skipped:", e);
  }

  // ---- 아래 기능들은 해당 페이지에 요소가 있을 때만 동작 ----
  const searchInput = document.getElementById("search_input");
  const searchBtn   = document.getElementById("search_btn");
  const resultBody  = document.getElementById("result_body");
  const emptyHint   = document.getElementById("empty_hint");
  const pickedName  = document.getElementById("picked_name");
  const btnIn       = document.getElementById("btn_in");
  const btnOut      = document.getElementById("btn_out");
  const deltaInput  = document.getElementById("delta_qty");
  const popup       = document.getElementById("confirm_popup");
  const popupMsg    = document.getElementById("popup_message");
  const popupYes    = document.getElementById("popup_yes");
  const popupNo     = document.getElementById("popup_no");

  // 요소들이 “모두” 있을 때만 이 섹션 실행 (다른 페이지에서 에러 안나게)
  if (searchInput && searchBtn && resultBody && emptyHint && pickedName && btnIn && btnOut && deltaInput && popup && popupMsg && popupYes && popupNo) {
    let products = [];
    let selectedItem = null;
    let pendingAction = null; // 'in' | 'out'

    async function loadProducts() {
      try {
        const res = await fetch("/stocks/");
        if (!res.ok) throw new Error("상품 목록 로딩 실패");
        products = await res.json();
        renderTable(products);
      } catch (err) {
        console.error(err);
      }
    }

    function renderTable(data) {
      resultBody.innerHTML = "";
      if (data.length === 0) {
        emptyHint.style.display = "block";
        return;
      }
      emptyHint.style.display = "none";

      data.forEach((item) => {
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

    function searchProducts() {
      const kw = searchInput.value.trim().toLowerCase();
      const filtered = products.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(kw) ||
          (p.pin_name || "").toLowerCase().includes(kw)
      );
      renderTable(filtered);
    }

    async function updateQuantity(item, newQty) {
      const res = await fetch(`/stocks/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      if (!res.ok) throw new Error("수량 업데이트 실패");
      await res.json();
    }

    function openPopup(message, actionType) {
      popupMsg.textContent = message;
      popup.style.display = "flex";
      pendingAction = actionType;
    }
    function closePopup() {
      popup.style.display = "none";
      pendingAction = null;
    }

    searchBtn.addEventListener("click", searchProducts);
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchProducts();
    });

    popupNo.addEventListener("click", closePopup);
    popupYes.addEventListener("click", async () => {
      try {
        if (!selectedItem || !pendingAction) return closePopup();
        const delta = Number(deltaInput.value) || 0;
        if (delta <= 0) { alert("변경 수량을 올바르게 입력하세요."); return; }
        let newQty = selectedItem.quantity + (pendingAction === "in" ? delta : -delta);
        if (newQty < 0) { alert("출고 수량이 재고보다 많습니다."); return; }
        closePopup();
        await updateQuantity(selectedItem, newQty);
        await loadProducts();
      } catch (e) {
        console.error(e);
        alert("수량 변경 중 오류 발생");
      }
    });

    btnIn.addEventListener("click", () => {
      if (!selectedItem) return alert("상품을 선택하세요.");
      openPopup(`"${selectedItem.name}"의 수량을 추가하시겠습니까?`, "in");
    });
    btnOut.addEventListener("click", () => {
      if (!selectedItem) return alert("상품을 선택하세요.");
      openPopup(`"${selectedItem.name}"의 수량을 감소하시겠습니까?`, "out");
    });

    loadProducts();
  }
});