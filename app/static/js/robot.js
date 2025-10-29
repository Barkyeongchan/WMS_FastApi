document.addEventListener("DOMContentLoaded", () => {
  const autoBtn = document.getElementById("auto_mode");
  const manualBtn = document.getElementById("manual_mode");
  const manualLock = document.getElementById("manual_lock");
  const directionButtons = document.querySelectorAll(".dir_btn");
  const speedSlider = document.getElementById("speed_slider");
  const returnBtn = document.querySelector(".control_btn.return");
  const stopBtn = document.querySelector(".control_btn.stop");

  let currentMode = "auto";

  autoBtn.addEventListener("click", () => {
    if (currentMode === "auto") return;
    currentMode = "auto";
    autoBtn.classList.add("active");
    manualBtn.classList.remove("active");
    manualLock.classList.add("active");
    directionButtons.forEach(btn => {
      btn.disabled = true;
      btn.classList.remove("active");
    });
    console.log("자동 모드 전환: 수동 조작 비활성화");
  });

  manualBtn.addEventListener("click", () => {
    if (currentMode === "manual") return;
    currentMode = "manual";
    manualBtn.classList.add("active");
    autoBtn.classList.remove("active");
    manualLock.classList.remove("active");
    directionButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.add("active");
    });
    console.log("🎮 수동 모드 전환: 수동 조작 가능");
  });

  speedSlider.addEventListener("input", (e) => {
    const level = e.target.value;
    let speedValue = "0.0 m/s";
    switch (parseInt(level)) {
      case 1: speedValue = "0.5 m/s"; break;
      case 2: speedValue = "1.5 m/s"; break;
      case 3: speedValue = "3.0 m/s"; break;
    }
    console.log(`속도 ${level}단 (${speedValue}) 설정됨`);
  });

  stopBtn.addEventListener("click", () => {
    console.log("비상정지 명령 전송");
  });

  returnBtn.addEventListener("click", () => {
    console.log("대기장소 복귀 명령 전송");
  });

  directionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentMode !== "manual") {
        console.log("⚠ 자동 모드에서는 조작 불가");
        return;
      }

      let direction = "정지";
      if (btn.classList.contains("up")) direction = "전진";
      else if (btn.classList.contains("down")) direction = "후진";
      else if (btn.classList.contains("left")) direction = "좌회전";
      else if (btn.classList.contains("right")) direction = "우회전";
      else if (btn.classList.contains("stop_center")) direction = "정지";

      console.log(`➡ ${direction} 명령 전송`);
    });
  });

  manualLock.classList.add("active");
  directionButtons.forEach(btn => {
    btn.disabled = true;
    btn.classList.remove("active");
  });

  // ✅ 모달 코드 추가
  const modal = document.getElementById("robot_modal");
  const modalCloseBtn = document.getElementById("modal_close_btn");
  const addBtn = document.getElementById("btn_add_robot");
  const deleteBtn = document.getElementById("btn_delete_robot");
  const selectEl = document.getElementById("robot_select");
  const nameInput = document.getElementById("robot_name_input");
  const ipInput = document.getElementById("robot_ip_input");

  let robots = [
    { name: "R-01", ip: "192.168.0.10" },
  ];

  function updateRobotSelect() {
    selectEl.innerHTML = "";
    robots.forEach(r => {
      const op = document.createElement("option");
      op.value = r.name;
      op.textContent = `${r.name} (${r.ip})`;
      selectEl.appendChild(op);
    });
  }
  updateRobotSelect();

  modalCloseBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  addBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();
    if (!name || !ip) return alert("로봇 이름과 IP를 입력하세요!");
    robots.push({ name, ip });
    updateRobotSelect();
    nameInput.value = "";
    ipInput.value = "";
    alert("✅ 로봇 추가 완료");
  });

  deleteBtn.addEventListener("click", () => {
    const target = selectEl.value;
    robots = robots.filter(r => r.name !== target);
    updateRobotSelect();
    alert("🗑 로봇 삭제 완료");
  });

    document.getElementById("open_modal_btn").addEventListener("click", () => {
    document.getElementById("robot_modal").classList.remove("hidden");
  });

  document.getElementById("robot_select").addEventListener("change", (e) => {
    const selected = e.target.value;
    console.log(`✅ 선택한 로봇: ${selected}`);
    
    // TODO: FastAPI/ROS 연동 시 상태 업데이트 기능 추가
  });


});