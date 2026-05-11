// 궁합

function GunghapPage({ onBack }) {
  const [step, setStep] = React.useState("input");
  const [a, setA] = React.useState({ name: "나", year: "" });
  const [b, setB] = React.useState({ name: "", year: "" });

  const submit = () => {
    if (!a.year || !b.year) return;
    setStep("loading");
    setTimeout(() => setStep("result"), 1800);
  };

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="궁합" onBack={onBack} />

      {step === "input" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35 }}>
            두 사람의 흐름을<br/>한 번에 봐요
          </div>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 14 }}>
            <PersonCard data={a} setData={setA} z="rabbit" label="나" />
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--pink-strong)", fontWeight: 800 }}>♡</div>
            <PersonCard data={b} setData={setB} z="dragon" label="상대" />
          </div>

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <Row label="이름 (선택)" placeholder="이름" value={b.name}
              onChange={(v) => setB({ ...b, name: v })} />
            <Row label="태어난 해" placeholder="1996" value={b.year} num
              onChange={(v) => setB({ ...b, year: v })} suffix="년" />
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 28 }}
            disabled={!a.year || !b.year} onClick={submit}>
            궁합 보러 가기
          </button>
        </div>
      )}

      {step === "loading" && <Loader text="두 사람의 흐름을 맞춰보는 중…" />}

      {step === "result" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div className="rise" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <CharCircle z="rabbit" size={64} showPh={false} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 36, color: "var(--pink-strong)", fontFamily: "var(--serif)", animation: "pop 600ms ease both" }}>♡</div>
              </div>
              <CharCircle z="dragon" size={64} showPh={false} />
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 800, marginTop: 16, color: "var(--pink-strong)" }}>
              82점
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 4 }}>대체로 따뜻한 흐름</div>
          </div>

          <div className="rise" style={{
            marginTop: 20, padding: "18px 20px",
            background: "var(--pink-soft)", borderRadius: 18,
            border: "1px solid var(--line)",
          }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 700, lineHeight: 1.6 }}>
              서로 닮지 않아서 더 잘 맞는 사이.<br/>한쪽이 쉬어갈 때 다른 쪽이 끌어줘요.
            </div>
          </div>

          <div className="rise-stagger" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { k: "마음", v: 88, c: "#e6549a" },
              { k: "대화", v: 76, c: "#3f7a8c" },
              { k: "생활", v: 70, c: "#d49a3a" },
              { k: "가치관", v: 84, c: "#5b8a5b" },
            ].map((m, i) => (
              <div key={i} className="card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.k}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: m.c }}>{m.v}</span>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "#f4f4f6", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.v}%`, background: m.c,
                    animation: `growW 700ms ${i * 80}ms cubic-bezier(0.2,0.8,0.2,1) both` }}/>
                </div>
              </div>
            ))}
            <style>{`@keyframes growW { from { width: 0%; } }`}</style>
          </div>

          <div className="rise" style={{ marginTop: 16, padding: "16px",
            background: "var(--ink)", color: "#fff", borderRadius: 18 }}>
            <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 700 }}>더 자세한 풀이</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>연애 마음 확인 · 990원</div>
            <button className="btn btn-pink" style={{ marginTop: 12, height: 40, fontSize: 13 }}>풀이 열기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonCard({ data, setData, z, label }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <CharCircle z={z} size={72} showPh={false} />
      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 8, color: "var(--ink-64)" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{data.name || "—"}</div>
    </div>
  );
}

function Row({ label, placeholder, value, onChange, num, suffix }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 6 }}>{label}</div>
      {num
        ? <NumField placeholder={placeholder} value={value} onChange={onChange} suffix={suffix} maxLength={4} />
        : <SimpleInput placeholder={placeholder} value={value} onChange={onChange} />
      }
    </div>
  );
}

window.GunghapPage = GunghapPage;
