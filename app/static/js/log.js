document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("log_table_body");

  // ===============================
  // 🔹 더미 로그 데이터 (테스트용)
  // ===============================
  const dummyLogs = [
    {
      id: 1,
      robot_name: "Robot_A1",
      robot_ip: "192.168.0.10",
      pin_name: "Pin_A01",
      pin_coords: "(2.3, 4.1)",
      category_name: "전자부품",
      stock_name: "PCB 모듈",
      stock_id: 101,
      quantity: 20,
      action: "입고 완료",
      timestamp: "2025-10-28T09:45:30",
    },
    {
      id: 2,
      robot_name: "Robot_B3",
      robot_ip: "192.168.0.12",
      pin_name: "Pin_B02",
      pin_coords: "(5.8, 7.2)",
      category_name: "식품",
      stock_name: "커피 원두",
      stock_id: 204,
      quantity: 15,
      action: "출고 완료",
      timestamp: "2025-10-28T10:10:12",
    },
    {
      id: 3,
      robot_name: "Robot_C5",
      robot_ip: "192.168.0.15",
      pin_name: "Pin_C04",
      pin_coords: "(8.5, 3.7)",
      category_name: "생활용품",
      stock_name: "세제 리필팩",
      stock_id: 309,
      quantity: 8,
      action: "이동 중",
      timestamp: "2025-10-28T10:35:44",
    },
    {
      id: 4,
      robot_name: "Robot_D2",
      robot_ip: "192.168.0.21",
      pin_name: "Pin_D01",
      pin_coords: "(1.2, 9.8)",
      category_name: "의류",
      stock_name: "면 티셔츠",
      stock_id: 412,
      quantity: 12,
      action: "입고 준비 중",
      timestamp: "2025-10-28T11:02:11",
    },
    {
      id: 5,
      robot_name: "Robot_E7",
      robot_ip: "192.168.0.25",
      pin_name: "Pin_E03",
      pin_coords: "(4.7, 2.5)",
      category_name: "부품",
      stock_name: "서보모터",
      stock_id: 517,
      quantity: 5,
      action: "출고 대기",
      timestamp: "2025-10-28T11:35:05",
    },
  ];

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