document.addEventListener("DOMContentLoaded", () => {
  const logList = document.getElementById("log_text_list");

  // 날짜 포맷: [YYYY-MM-DD HH:mm]
  function formatDate(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  // 텍스트 로그 문장 생성
  function buildText(log) {
    const time = formatDate(log.timestamp);
    const pin = log.pin_name || "-";
    const category = log.category_name || "-";
    const name = log.stock_name || "-";
    const qty = log.quantity ?? 0;
    const action = log.action || "";

    // 상품 관련
    if (action.startsWith("상품 등록")) {
      return `[${time}] ${pin}에 ${name} ${qty}개를 등록했습니다.`;
    }
    if (action.startsWith("상품 수정")) {
      return `[${time}] ${pin}의 ${name} 정보를 수정했습니다. (${action.replace("상품 수정", "").trim()})`;
    }
    if (action.startsWith("상품 삭제")) {
      return `[${time}] ${pin}의 ${name}을(를) 삭제했습니다.`;
    }

    // 카테고리 관련
    if (action.startsWith("카테고리 등록")) {
      return `[${time}] 카테고리 '${category}'을 등록했습니다.`;
    }
    if (action.startsWith("카테고리 삭제")) {
      return `[${time}] 카테고리 '${category}'을 삭제했습니다.`;
    }

    // 핀 관련
    if (action.startsWith("핀 등록")) {
      return `[${time}] 위치 '${pin}'을 등록했습니다.`;
    }
    if (action.startsWith("핀 삭제")) {
      return `[${time}] 위치 '${pin}'을 삭제했습니다.`;
    }

    // 기본값
    return `[${time}] ${action} (${pin} / ${category} / ${name} / ${qty})`;
  }

  async function loadLogs() {
    try {
      const res = await fetch("/logs/");
      if (!res.ok) throw new Error("서버에서 로그를 불러오지 못했습니다.");

      const data = await res.json();
      logList.innerHTML = "";

      if (data.length === 0) {
        logList.innerHTML = `<p>📭 아직 로그가 없습니다.</p>`;
        return;
      }

      // 최신순 정렬
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      data.forEach((log) => {
        const line = document.createElement("div");
        line.classList.add("log_text_line");
        line.innerHTML = buildText(log);
        logList.appendChild(line);
      });

      console.log("✅ 텍스트 로그 렌더링 완료");
    } catch (err) {
      console.error("❌ 로그 로드 실패:", err);
      logList.innerHTML = `<p style="color:red;">❌ 로그 데이터를 불러오는 중 오류가 발생했습니다.</p>`;
    }
  }

  loadLogs();
});