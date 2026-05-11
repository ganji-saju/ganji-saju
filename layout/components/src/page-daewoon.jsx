// 대운 — 10년 흐름 타임라인

function DaewoonPage({ onBack }) {
  const [step, setStep] = React.useState("input");
  const [year, setYear] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [day, setDay] = React.useState("");

  const submit = () => {
    if (!year || !month || !day) return;
    setStep("loading");
    setTimeout(() => setStep("result"), 1600);
  };

  // 10-year periods
  const periods = [
    { age: "20대", years: "20-29", title: "탐색기", desc: "방향을 잡는 시간", score: 65, c: "#94c094" },
    { age: "30대", years: "30-39", title: "성장기", desc: "기반을 다져요", score: 78, c: "#6db0c4" },
    { age: "40대", years: "40-49", title: "전환기", desc: "큰 흐름이 바뀌어요", score: 88, c: "#e89a8a", current: true },
    { age: "50대", years: "50-59", title: "수확기", desc: "결실이 이어져요", score: 82, c: "#d49a3a" },
    { age: "60대", years: "60-69", title: "정리기", desc: "나누는 시간", score: 70, c: "#ecd2a5" },
  ];

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="대운" onBack={onBack} />

      {step === "input" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35 }}>
            앞으로 50년의 흐름을<br/>한눈에 봐요
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
            10년 단위로 어떤 시기가 오는지 알려드려요.
          </div>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>생년월일</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
              <NumField placeholder="1995" value={year} onChange={setYear} maxLength={4} suffix="년" />
              <NumField placeholder="06" value={month} onChange={setMonth} maxLength={2} suffix="월" />
              <NumField placeholder="15" value={day} onChange={setDay} maxLength={2} suffix="일" />
            </div>
          </div>
          <button className="btn btn-pink btn-block" style={{ marginTop: 28 }} onClick={submit}
            disabled={!year || !month || !day}>
            대운 보러 가기
          </button>
        </div>
      )}

      {step === "loading" && <Loader text="10년의 흐름을 펼치는 중…" />}

      {step === "result" && (
        <div className="page" style={{ padding: "20px 20px 40px" }}>
          <div className="rise" style={{
            background: "linear-gradient(160deg, #1c1b2a 0%, #2a2840 50%, #3d2a4a 100%)",
            borderRadius: 22, padding: "20px 22px", color: "#fff",
            position: "relative", overflow: "hidden",
          }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", width: 2, height: 2,
                background: "#ffd54a", borderRadius: "50%", opacity: 0.5,
                top: `${(i * 31) % 90}%`, left: `${(i * 47) % 95}%`,
                boxShadow: "0 0 4px #ffd54a",
              }} />
            ))}
            <div style={{ fontSize: 12, fontWeight: 700, color: "#ffd54a", letterSpacing: "0.06em" }}>
              현재 흐름
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, marginTop: 8, lineHeight: 1.4 }}>
              지금은 큰 흐름이<br/>바뀌는 전환기예요
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
              40대 — 새로운 인연과 기회가 모이는 시기
            </div>
          </div>

          {/* Timeline */}
          <div style={{ marginTop: 24, position: "relative" }}>
            <div style={{ position: "absolute", left: 30, top: 12, bottom: 12, width: 2,
              background: "linear-gradient(180deg, var(--line) 0%, var(--pink) 50%, var(--line) 100%)" }}/>
            <div className="rise-stagger">
              {periods.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "stretch", gap: 16, padding: "10px 0" }}>
                  <div style={{ width: 60, flexShrink: 0, position: "relative" }}>
                    <div style={{
                      position: "absolute", left: 22, top: 14, width: 18, height: 18,
                      borderRadius: "50%", background: p.c,
                      boxShadow: p.current ? "0 0 0 4px rgba(255, 79, 154, 0.25)" : "0 0 0 3px #fff",
                      border: p.current ? "2px solid var(--pink)" : "0",
                      animation: p.current ? "pop 600ms ease both" : "none",
                    }}/>
                  </div>
                  <div style={{
                    flex: 1,
                    background: p.current ? "var(--pink-soft)" : "#fff",
                    border: p.current ? "1.5px solid var(--pink)" : "1px solid var(--line)",
                    borderRadius: 16, padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{p.age}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-64)", marginLeft: 6 }}>{p.years}세</span>
                        {p.current && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--pink)", padding: "2px 6px", borderRadius: 999, marginLeft: 6 }}>NOW</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: p.c }}>{p.score}</div>
                    </div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 15, fontWeight: 700, marginTop: 6 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 2 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rise" style={{ marginTop: 16, padding: "16px",
            background: "var(--ink)", color: "#fff", borderRadius: 18 }}>
            <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 700 }}>각 시기를 더 자세히</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>대운 깊은 풀이 · 990원</div>
            <button className="btn btn-pink" style={{ marginTop: 12, height: 40, fontSize: 13 }}>풀이 열기</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.DaewoonPage = DaewoonPage;
