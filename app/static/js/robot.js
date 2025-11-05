document.addEventListener("DOMContentLoaded", () => {
  const autoBtn = document.getElementById("auto_mode");
  const manualBtn = document.getElementById("manual_mode");
  const manualLock = document.getElementById("manual_lock");
  const directionButtons = document.querySelectorAll(".dir_btn");
  const speedSlider = document.getElementById("speed_slider");
  const returnBtn = document.querySelector(".control_btn.return");
  const stopBtn = document.querySelector(".control_btn.stop");
  const modal = document.getElementById("robot_modal");
  const modalCloseBtn = document.getElementById("modal_close_btn");
  const addBtn = document.getElementById("btn_add_robot");
  const deleteBtn = document.getElementById("btn_delete_robot");
  const nameInput = document.getElementById("robot_name_input");
  const ipInput = document.getElementById("robot_ip_input");
  const openModalBtn = document.getElementById("open_modal_btn");
  const selectEl = document.getElementById("robot_select");
  const deleteSelect = document.getElementById("robot_delete_select");
  const pinSelect = document.getElementById("pin_select");
  const moveBtn = document.querySelector(".control_btn.move_btn");

  // ✅ 로봇 상태 카드 내 모드 표시 span
  const modeStatusEl = document.querySelector(".value.mode");

  let currentMode = "auto";

  // ===============================
  // ✅ 모드 전환
  // ===============================
  autoBtn.addEventListener("click", () => {
    if (currentMode === "auto") return;
    currentMode = "auto";

    // 버튼 상태 변경
    autoBtn.classList.add("active");
    manualBtn.classList.remove("active");
    manualLock.classList.add("active");

    // 방향키 비활성화
    directionButtons.forEach(btn => {
      btn.disabled = true;
      btn.classList.remove("active");
    });

    // 🔹 로봇 상태창 모드 변경
    updateModeStatus("auto");
  });

  manualBtn.addEventListener("click", () => {
    if (currentMode === "manual") return;
    currentMode = "manual";

    // 버튼 상태 변경
    manualBtn.classList.add("active");
    autoBtn.classList.remove("active");
    manualLock.classList.remove("active");

    // 방향키 활성화
    directionButtons.forEach(btn => {
      btn.disabled = false;
      btn.classList.add("active");
    });

    // 🔹 로봇 상태창 모드 변경
    updateModeStatus("manual");
  });

  // ===============================
  // ✅ 상태창 모드 업데이트 함수
  // ===============================
  function updateModeStatus(mode) {
    if (!modeStatusEl) return;

    modeStatusEl.classList.remove("auto", "manual");
    if (mode === "auto") {
      modeStatusEl.classList.add("auto");
      modeStatusEl.textContent = "자동";
    } else {
      modeStatusEl.classList.add("manual");
      modeStatusEl.textContent = "수동";
    }
  }

  // ✅ 초기 상태
  manualLock.classList.add("active");
  directionButtons.forEach(btn => {
    btn.disabled = true;
    btn.classList.remove("active");
  });
  updateModeStatus("auto"); // 처음엔 자동

  // ===============================
  // ✅ 모달 열고 닫기
  // ===============================
  openModalBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  modalCloseBtn.addEventListener("click", () => modal.classList.add("hidden"));

  // ===============================
  // ✅ 로봇 목록 불러오기
  // ===============================
  async function loadRobotList() {
    try {
      const res = await fetch("/robots/");
      if (!res.ok) throw new Error("로봇 목록 불러오기 실패");
      const robots = await res.json();

      selectEl.innerHTML = "";
      deleteSelect.innerHTML = "";

      robots.forEach((r) => {
        const op1 = document.createElement("option");
        op1.value = r.id;
        op1.textContent = `${r.name} (${r.ip})`;
        selectEl.appendChild(op1);

        const op2 = document.createElement("option");
        op2.value = r.id;
        op2.textContent = r.name;
        deleteSelect.appendChild(op2);
      });
    } catch (err) {
      console.error("[로봇 목록 불러오기 오류]", err);
    }
  }

  // ===============================
  // ✅ 로봇 추가 (DB 저장)
  // ===============================
  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();

    if (!name || !ip) {
      alert("⚠ 로봇 이름과 IP를 모두 입력하세요.");
      return;
    }

    try {
      const res = await fetch("/robots/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ip }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(`❌ 등록 실패: ${errData.detail || "서버 오류"}`);
        return;
      }

      const data = await res.json();
      alert(`✅ 로봇 '${data.name}' 추가 완료`);
      nameInput.value = "";
      ipInput.value = "";
      loadRobotList();
    } catch (error) {
      console.error("[로봇 추가 오류]", error);
      alert("❌ 서버 오류가 발생했습니다.");
    }
  });

  // ===============================
  // ✅ 로봇 삭제
  // ===============================
  deleteBtn.addEventListener("click", async () => {
    const id = deleteSelect.value;
    if (!id) return alert("삭제할 로봇을 선택하세요.");

    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/robots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      alert("🗑 로봇 삭제 완료");
      loadRobotList();
    } catch (err) {
      console.error("[삭제 오류]", err);
      alert("❌ 삭제 중 오류 발생");
    }
  });

  // ===============================
  // ✅ 핀 목록 불러오기 (Pin 테이블 연동)
  // ===============================
  async function loadPins() {
    try {
      const res = await fetch("/pins/");
      if (!res.ok) throw new Error("핀 목록 불러오기 실패");
      const pins = await res.json();

      // 기존 옵션 초기화
      pinSelect.innerHTML = '<option value="">핀 선택</option>';

      // DB에서 가져온 핀들 추가
      pins.forEach(pin => {
        const op = document.createElement("option");
        op.value = pin.coords || ""; // "x,y" 형태 문자열 저장
        op.textContent = pin.name;
        pinSelect.appendChild(op);
      });
    } catch (err) {
      console.error("[핀 목록 로드 오류]", err);
      pinSelect.innerHTML = '<option value="">로드 실패</option>';
    }
  }

  // ===============================
  // ✅ 핀 이동 명령 (ROS goal_pose 전송 자리)
  // ===============================
  if (moveBtn) {
    moveBtn.addEventListener("click", async () => {
      const selected = pinSelect.value;
      if (!selected) return alert("이동할 핀을 선택하세요.");

      try {
        const [x, y] = selected.split(",").map(Number);
        if (isNaN(x) || isNaN(y)) {
          alert("좌표 형식이 잘못되었습니다.");
          return;
        }

        console.log(`📍 이동 명령 전송됨 → X:${x}, Y:${y}`);
        alert(`✅ 로봇이 (${x}, ${y}) 위치로 이동 명령 전송됨`);
      } catch (err) {
        console.error("[이동 명령 오류]", err);
        alert("❌ 이동 중 오류 발생");
      }
    });
  }

  // ✅ 페이지 로드 시 목록 불러오기
  loadRobotList();
  loadPins();
});