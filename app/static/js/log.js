document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("log_table_body");

  // ===============================
  // 🔹 테이블에 로그 렌더링
  // ===============================
  dummyLogs.forEach((log) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${log.id}</td>
      <td>${log.robot_name}</td>
      <td>${log.robot_ip || "-"}</td>
      <td>${log.pin_name}</td>
      <td>${log.pin_coords || "-"}</td>
      <td>${log.category_name}</td>
      <td>${log.stock_name}</td>
      <td>${log.stock_id}</td>
      <td>${log.quantity}</td>
      <td>${log.action}</td>
      <td>${new Date(log.timestamp).toLocaleString()}</td>
    `;
    tableBody.appendChild(row);
  });

  console.log("✅ 더미 로그 데이터 렌더링 완료");
});