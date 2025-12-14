document.addEventListener("DOMContentLoaded", () => {
  const logList = document.getElementById("log_text_list");

  // 타임스탬프를 YYYY-MM-DD HH:mm 형식으로 변환
  function formatDate(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  // 로그 객체를 사람이 읽는 문장으로 변환
  function buildText(log) {
    const time = formatDate(log.timestamp);
    const pin = log.pin_name || "-";
    const category = log.category_name || "-";
    const name = log.stock_name || "-";
    const qty = log.quantity ?? 0;
    const action = log.action || "";
    const robot = log.robot_name || "-";

    // 상품 등록 로그
    if (action.startsWith("상품 등록")) {
      return `[${time}] ${pin}에 '${name}' ${qty}개를 등록했습니다.`;
    }

    // 상품 삭제 로그
    if (action.startsWith("상품 삭제")) {
      return `[${time}] ${pin}의 '${name}'을(를) 삭제했습니다.`;
    }

    // 상품 수정 로그
    if (action.startsWith("상품 수정")) {
      let detail = action
        .replace("상품 수정", "")
        .replace(":", "")
        .replace(/[()]/g, "")
        .trim();

      // 수량 변경 로그
      if (detail.startsWith("수량")) {
        const m = detail.match(/수량\s+(\d+)\s*→\s*(\d+)/);
        if (m) {
          return `[${time}] 사용자가 '${name}' 수량을 변경했습니다. (${m[1]} → ${m[2]})`;
        }
      }

      // 이름 변경 로그
      if (detail.startsWith("이름") || detail.startsWith("상품명")) {
        const m = detail.match(/(이름|상품명)\s+(.+)\s*→\s*(.+)/);
        if (m) {
          return `[${time}] 사용자가 '${name}' 상품명을 변경했습니다. (${m[2]} → ${m[3]})`;
        }
      }

      // 카테고리 변경 로그
      if (detail.startsWith("카테고리")) {
        const m = detail.match(/카테고리\s+(.+)\s*→\s*(.+)/);
        if (m) {
          return `[${time}] 사용자가 '${name}' 카테고리를 변경했습니다. (${m[1]} → ${m[2]})`;
        }
      }

      // 위치 변경 로그
      if (detail.startsWith("위치")) {
        const m = detail.match(/위치\s+(.+)\s*→\s*(.+)/);
        if (m) {
          return `[${time}] 사용자가 '${name}' 위치를 변경했습니다. (${m[1]} → ${m[2]})`;
        }
      }

      return `[${time}] 사용자가 '${name}' 정보를 수정했습니다. (${detail})`;
    }

    // 카테고리 등록 로그
    if (action.startsWith("카테고리 등록")) {
      return `[${time}] 카테고리 '${category}'을 등록했습니다.`;
    }

    // 카테고리 삭제 로그
    if (action.startsWith("카테고리 삭제")) {
      return `[${time}] 카테고리 '${category}'을 삭제했습니다.`;
    }

    // 핀 등록 로그
    if (action.startsWith("핀 등록")) {
      return `[${time}] 위치 '${pin}'을 등록했습니다.`;
    }

    // 핀 삭제 로그
    if (action.startsWith("핀 삭제")) {
      return `[${time}] 위치 '${pin}'을 삭제했습니다.`;
    }

    // 입고 시작 로그
    if (action.startsWith("입고 시작")) {
      return `[${time}] 로봇 ${robot}이/가 '${name}' ${qty}개 입고를 시작했습니다. (목표 위치: ${pin})`;
    }

    // 출고 시작 로그
    if (action.startsWith("출고 시작")) {
      return `[${time}] 로봇 ${robot}이/가 '${name}' ${qty}개 출고를 시작했습니다. (목표 위치: ${pin})`;
    }

    // 로봇 도착 로그
    if (action.startsWith("도착")) {
      return `[${time}] 로봇 ${robot}이/가 ${pin} 도착`;
    }

    // 입고 완료 로그
    if (action.startsWith("입고 완료")) {
      const m = action.match(/입고 완료\s*\((\d+)\s*→\s*(\d+)\)/);
      if (m) return `[${time}] 입고 완료 (${m[1]} → ${m[2]})`;
      return `[${time}] 입고 완료`;
    }

    // 출고 완료 로그
    if (action.startsWith("출고 완료")) {
      const m = action.match(/출고 완료\s*\((\d+)\s*→\s*(\d+)\)/);
      if (m) return `[${time}] 출고 완료 (${m[1]} → ${m[2]})`;
      return `[${time}] 출고 완료`;
    }

    // 복귀 시작 로그
    if (action.startsWith("복귀 시작")) {
      return `[${time}] 로봇 ${robot}이/가 대기 위치로 복귀를 시작했습니다.`;
    }

    // 복귀 완료 로그
    if (action.startsWith("복귀 완료")) {
      return `[${time}] 로봇 ${robot} 복귀 완료`;
    }

    // 기본 로그 출력
    return `[${time}] ${action} (${pin} / ${category} / ${name} / ${qty})`;
  }

  // 로그 목록 조회 및 렌더링
  async function loadLogs() {
    try {
      const res = await fetch("/logs/");
      if (!res.ok) throw new Error("서버에서 로그를 불러오지 못했습니다.");

      const data = await res.json();
      logList.innerHTML = "";

      if (data.length === 0) {
        logList.innerHTML = `<p>아직 로그가 없습니다.</p>`;
        return;
      }

      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      data.forEach((log) => {
        const line = document.createElement("div");
        line.classList.add("log_text_line");
        line.innerHTML = buildText(log);
        logList.appendChild(line);
      });

      console.log("텍스트 로그 렌더링 완료");
    } catch (err) {
      console.error("로그 로드 실패:", err);
      logList.innerHTML =
        `<p style="color:red;">로그 데이터를 불러오는 중 오류가 발생했습니다.</p>`;
    }
  }

  loadLogs();
});