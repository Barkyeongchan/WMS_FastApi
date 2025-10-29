document.addEventListener("DOMContentLoaded", () => {

  // 드롭다운
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

    menu.querySelectorAll("p").forEach(item => {
      item.addEventListener("click", () => {
        button.textContent = item.textContent;
        menu.style.display = "none";
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown_menu").forEach(menu => {
      menu.style.display = "none";
    });
  });

  // ✅ 더미 데이터
  let products = [
    { name: "모니터", category: "전자제품", qty: 5, location: "A1" },
    { name: "물티슈", category: "생활용품", qty: 20, location: "B2" },
    { name: "컵라면", category: "식품", qty: 50, location: "C3" },
    { name: "키보드", category: "전자제품", qty: 10, location: "A2" },
    { name: "휴지", category: "생활용품", qty: 35, location: "B3" }
  ];

  const tbody = document.querySelector(".stock_table.body tbody");

  // ✅ 테이블 렌더링
  const renderTable = (data) => {
    tbody.innerHTML = "";
    data.forEach(item => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="checkbox" /></td>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td>${item.qty}</td>
        <td>${item.location}</td>
      `;
      tbody.appendChild(row);
    });
  };
  renderTable(products);

  // ✅ 검색 기능
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(keyword) ||
      p.category.toLowerCase().includes(keyword)
    );
    renderTable(filtered);
  });

  // ✅ 정렬 상태 저장용 객체
  let sortStates = {
    name: "asc",
    category: "asc",
    qty: "asc",
    location: "asc"
  };

  // ✅ 정렬 기능 (화살표 유지형)
  document.querySelectorAll(".stock_table thead th[data-sort]").forEach(th => {
    const key = th.dataset.sort;

    // 초기 상태 표시
    th.textContent += " ▲";

    th.addEventListener("click", () => {
      const isAsc = sortStates[key] === "asc";
      sortStates[key] = isAsc ? "desc" : "asc";

      products.sort((a, b) => {
        if (typeof a[key] === "number") {
          return isAsc ? b[key] - a[key] : a[key] - b[key];
        } else {
          return isAsc
            ? b[key].localeCompare(a[key])
            : a[key].localeCompare(b[key]);
        }
      });

      // 🔁 클릭한 항목만 화살표 반대로 토글, 다른 항목 유지
      document.querySelectorAll(".stock_table thead th[data-sort]").forEach(header => {
        const k = header.dataset.sort;
        header.textContent = header.textContent.replace(/ ▲| ▼/g, "");
        if (sortStates[k] === "asc") header.textContent += " ▲";
        else header.textContent += " ▼";
      });

      renderTable(products);
    });
  });
});