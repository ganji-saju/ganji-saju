// 택일 — 중요한 날 잡기

function TaekilPage({ onBack }) {
  const [step, setStep] = React.useState("purpose");
  const [purpose, setPurpose] = React.useState(null);

  const purposes = [
    { k: "wedding", l: "결혼·약혼", c: "#e6549a" },
    { k: "open", l: "개업·오픈", c: "#d49a3a" },
    { k: "move", l: "이사·입주", c: "#3f7a8c" },
    { k: "contract", l: "계약·서명", c: "#5b8a5b" },
    { k: "trip", l: "여행·출발", c: "#8a6a3a" },
    { k: "etc", l: "기타", c: "#7e7c8a" },
  ];

  // Generated good days (simple pattern)
  const days = [
    { date: "11월 12일", weekday: "수", score: 92, label: "최상" },
    { date: "11월 18일", weekday: "화", score: 86, label: "좋음" },
    { date: "11월 25일", weekday: "화", score: 80, label: "좋음" },
    { date: "12월 03일", weekday: "수", score: 78, label: "양호" },
    { date: "12월 14일", weekday: "일", score: 88, label: "좋음" },
  ];

  const selectPurpose = (p) => {
    setPurpose(p);
    setStep("loading");
    setTimeout(() => setStep("result"), 1400);
  };

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="택일" onBack={step === "purpose" ? onBack : () => setStep("purpose")} />

      {step === "purpose" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35 }}>
            어떤 날을<br/>잡아드릴까요?
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
            목적에 맞는 좋은 날짜를 골라드려요.
          </div>
          <div className="rise-stagger" style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {purposes.map(p => (
              <button key={p.k} onClick={() => selectPurpose(p)} style={{
                padding: "20px 14px",
                background: "#fff", border: "1.5px solid var(--line)", borderRadius: 16,
                display: "flex", flexDirection: "column", gap: 12, textAlign: "left",
                minHeight: 110,
              }}
              onTouchStart={(e) => { e.currentTarget.style.borderColor = p.c; e.currentTarget.style.background = "var(--pink-soft)"; }}>
                <div style={{ width: 36, height: 36, borderRadius: 12,
                  background: `linear-gradient(135deg, ${p.c}22, ${p.c}44)`, color: p.c,
                  display: "grid", placeItems: "center" }}>
                  <Icon.Calendar style={{ width: 20, height: 20 }}/>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{p.l}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "loading" && <Loader text="좋은 날을 골라보는 중…" />}

      {step === "result" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div className="rise" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", background: "var(--pink-soft)",
            borderRadius: 999, fontSize: 12, fontWeight: 700, color: "var(--pink-strong)",
          }}>
            {purpose?.l}에 좋은 날
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35, marginTop: 10 }}>
            앞으로 두 달,<br/>이 날들을 추천해요
          </div>

          <div className="rise-stagger" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {days.map((d, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 18px",
                background: i === 0 ? "var(--pink-soft)" : "#fff",
                border: i === 0 ? "1.5px solid var(--pink)" : "1px solid var(--line)",
                borderRadius: 16,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "#fff", border: "1px solid var(--line)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 10, color: "var(--pink-strong)", fontWeight: 700 }}>
                    {d.date.split(" ")[0]}
                  </div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                    {parseInt(d.date.split(" ")[1])}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--ink-64)", fontWeight: 700 }}>{d.weekday}요일</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{d.label}</div>
                  <div style={{ marginTop: 6, height: 5, borderRadius: 999, background: "#f4f4f6", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${d.score}%`, background: "var(--pink)",
                      animation: `growW 700ms ${i * 80}ms cubic-bezier(0.2,0.8,0.2,1) both` }}/>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-64)", marginTop: 6 }}>점수 {d.score} · 추천</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rise" style={{ marginTop: 16, padding: "16px",
            background: "var(--ink)", color: "#fff", borderRadius: 18 }}>
            <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 700 }}>시간대까지 자세히</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>중요한 날 확인 · 990원</div>
            <button className="btn btn-pink" style={{ marginTop: 12, height: 40, fontSize: 13 }}>풀이 열기</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.TaekilPage = TaekilPage;
