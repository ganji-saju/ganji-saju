// 사주 진입면

function SajuPage({ onBack }) {
  const [step, setStep] = React.useState("input");
  const [name, setName] = React.useState("");
  const [year, setYear] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [day, setDay] = React.useState("");

  const submit = () => {
    if (!year || !month || !day) return;
    setStep("loading");
    setTimeout(() => setStep("result"), 1600);
  };

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="사주" onBack={onBack} />

      {step === "input" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35 }}>
            사주를 보려면<br/>이 정도면 충분해요
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
            이름은 풀이 화면에서 부르는 용도예요.
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>이름</div>
            <SimpleInput value={name} onChange={setName} placeholder="홍길동" />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>생년월일</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
              <NumField placeholder="1995" value={year} onChange={setYear} maxLength={4} suffix="년" />
              <NumField placeholder="06" value={month} onChange={setMonth} maxLength={2} suffix="월" />
              <NumField placeholder="15" value={day} onChange={setDay} maxLength={2} suffix="일" />
            </div>
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 28 }} onClick={submit}
            disabled={!year || !month || !day}>
            사주 풀이 받기
          </button>

          {/* Saved profiles */}
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)" }}>저장된 사주</div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { z: "rabbit", name: "내 사주", date: "1995.06.15" },
                { z: "dragon", name: "엄마", date: "1968.11.03" },
              ].map((p, i) => (
                <button key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  background: "#fff", border: "1px solid var(--line)",
                  borderRadius: 14, textAlign: "left",
                }}>
                  <CharCircle z={p.z} size={40} showPh={false} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-64)" }}>{p.date}</div>
                  </div>
                  <Icon.ArrowRight style={{ color: "var(--ink-44)", width: 18, height: 18 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "loading" && <Loader text="사주를 펼치는 중…" />}

      {step === "result" && (
        <div className="page" style={{ padding: "20px 20px 40px" }}>
          {/* Pillars */}
          <div className="rise" style={{
            background: "linear-gradient(160deg, #1c1b2a 0%, #2a2840 50%, #3d2a4a 100%)",
            borderRadius: 22, padding: "20px 18px", color: "#fff",
            position: "relative", overflow: "hidden",
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", width: 2, height: 2,
                background: "#ffd54a", borderRadius: "50%", opacity: 0.5,
                top: `${(i * 31) % 90}%`, left: `${(i * 47) % 95}%`,
                boxShadow: "0 0 4px #ffd54a",
              }} />
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#ffd54a", letterSpacing: "0.08em" }}>
              {name || "내"} 사주 · 사주팔자
            </div>
            <div className="rise-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 14 }}>
              {[
                { l: "년주", t: "乙", b: "亥", c: "#94c094" },
                { l: "월주", t: "壬", b: "午", c: "#6db0c4" },
                { l: "일주", t: "丙", b: "辰", c: "#e89a8a" },
                { l: "시주", t: "戊", b: "戌", c: "#ecd2a5" },
              ].map((p, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12, padding: "10px 6px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{p.l}</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 800, color: p.c, marginTop: 4 }}>{p.t}</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 0 }}>{p.b}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Headline */}
          <div className="rise" style={{
            marginTop: 16, padding: "20px 22px",
            background: "var(--pink-soft)", borderRadius: 18,
            border: "1px solid var(--line)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)", letterSpacing: "0.06em" }}>
              한 줄 요약
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 800, marginTop: 8, lineHeight: 1.5 }}>
              따뜻하고 빠른 결정형, 시작은 좋고 마무리에서 도움을 받는 흐름
            </div>
          </div>

          {/* 5 elements bar */}
          <div className="rise card" style={{ marginTop: 12, padding: "16px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>오행 균형</div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
              {[
                { n: "목", v: 60, c: "#5b8a5b" },
                { n: "화", v: 90, c: "#e6549a" },
                { n: "토", v: 40, c: "#d49a3a" },
                { n: "금", v: 30, c: "#a8a4b6" },
                { n: "수", v: 70, c: "#3f7a8c" },
              ].map((e, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ height: 64, background: "#f4f4f6", borderRadius: 8, position: "relative", overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", left: 0, right: 0, bottom: 0,
                      height: `${e.v}%`, background: e.c,
                      animation: `growUp 700ms ${i * 80}ms cubic-bezier(0.2,0.8,0.2,1) both`,
                    }}/>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{e.n}</div>
                </div>
              ))}
            </div>
            <style>{`@keyframes growUp { from { height: 0%; } }`}</style>
          </div>

          {/* Topic cards */}
          <div className="rise-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            {[
              { k: "재물", t: "꾸준한 흐름", c: "#d49a3a" },
              { k: "연애", t: "주도하는 편", c: "#e6549a" },
              { k: "직업", t: "변화에 강함", c: "#3f7a8c" },
              { k: "건강", t: "수면 챙기기", c: "#5b8a5b" },
            ].map((c, i) => (
              <div key={i} className="card" style={{ padding: "14px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: c.c }}/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-64)" }}>{c.k}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }}>{c.t}</div>
              </div>
            ))}
          </div>

          {/* Upsell */}
          <div className="rise" style={{ marginTop: 16, padding: "16px",
            background: "var(--ink)", color: "#fff", borderRadius: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.8 }}>더 깊게 보고 싶다면</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>대운 10년 흐름 · 990원</div>
            <button className="btn btn-pink" style={{ marginTop: 12, height: 40, fontSize: 13 }}
              onClick={() => window.dispatchEvent(new CustomEvent("openpay", { detail: { title: "대운 10년 흐름", price: 990, desc: "10년 단위 흐름을 자세히" }}))}>
              풀이 열기
            </button>
          </div>

          {/* Folded basis */}
          <details style={{ marginTop: 14 }}>
            <summary style={{
              cursor: "pointer", fontSize: 13, color: "var(--ink-64)", fontWeight: 600,
              padding: "10px 14px", background: "#fafafb", borderRadius: 12,
              border: "1px solid var(--line)", listStyle: "none",
            }}>풀이 기준 보기</summary>
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink-64)", lineHeight: 1.6 }}>
              일주를 중심으로 월령과 오행 분포를 함께 살펴 본 풀이입니다.
              자세한 격국·용신 정보는 깊은 풀이에서 확인할 수 있어요.
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function NumField({ value, onChange, placeholder, maxLength, suffix }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 48,
      background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "0 12px" }}>
      <input type="text" inputMode="numeric"
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder} maxLength={maxLength}
        style={{ flex: 1, border: 0, outline: 0, background: "transparent",
          fontSize: 15, fontWeight: 600, fontFamily: "inherit", minWidth: 0 }}/>
      {suffix && <span style={{ fontSize: 13, color: "var(--ink-44)", fontWeight: 600 }}>{suffix}</span>}
    </div>
  );
}
function SimpleInput({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", height: 48, border: "1px solid var(--line)", borderRadius: 12,
        padding: "0 14px", fontSize: 15, fontWeight: 600, fontFamily: "inherit", outline: 0 }}/>
  );
}

function Loader({ text }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto" }}>
        <div style={{ position: "absolute", inset: 0,
          background: "radial-gradient(circle at 30% 30%, #fff8d9, #ffd479 60%, #f5b740)",
          borderRadius: "50%", animation: "float-y 2.4s ease-in-out infinite",
          boxShadow: "0 0 40px rgba(255, 213, 121, 0.5)" }}/>
        <div style={{ position: "absolute", inset: -10, border: "2px dashed var(--pink)",
          borderRadius: "50%", animation: "spin-slow 6s linear infinite", opacity: 0.5 }}/>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700, marginTop: 28 }}>{text}</div>
    </div>
  );
}

window.SajuPage = SajuPage;
window.Loader = Loader;
window.NumField = NumField;
window.SimpleInput = SimpleInput;
