document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("log_table_body");

  async function loadLogs() {
    try {
      const res = await fetch("/logs/");
      if (!res.ok) {
        console.error("❌ 로그 불러오기 실패");
        return;
      }

      const logs = await res.json();
      tableBody.innerHTML = "";

      logs.forEach((log) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${log.id}</td>
          <td>${log.robot_name || "-"}</td>
          <td>${log.robot_ip || "-"}</td>
          <td>${log.pin_name || "-"}</td>
          <td>${log.pin_coords || "-"}</td>
          <td>${log.category_name || "-"}</td>
          <td>${log.stock_name || "-"}</td>
          <td>${log.stock_id || "-"}</td>
          <td>${log.quantity ?? "-"}</td>
          <td>${log.action || "-"}</td>
          <td>${new Date(log.timestamp).toLocaleString()}</td>
        `;
        tableBody.appendChild(row);
      });

      console.log("✅ 로그 데이터 렌더링 완료");
    } catch (err) {
      console.error("❌ 로그 로드 중 오류:", err);
    }
  }

  loadLogs();
});