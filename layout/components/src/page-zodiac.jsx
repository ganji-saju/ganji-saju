// 띠운세

function ZodiacPage({ onBack }) {
  const [active, setActive] = React.useState("tiger");
  const z = ZODIAC.find(x => x.key === active);
  const score = 60 + ((active.charCodeAt(0) * 7) % 35);

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="띠운세" onBack={onBack} />
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 800, lineHeight: 1.4 }}>
          이번 주 12띠 흐름
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 6 }}>띠를 골라 한 주 메시지를 받아보세요.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, padding: "20px 20px 0" }}>
        {ZODIAC.map(zd => (
          <button key={zd.key} onClick={() => setActive(zd.key)} style={{
            background: active === zd.key ? "var(--pink-soft)" : "#fff",
            border: active === zd.key ? "1.5px solid var(--pink)" : "1px solid var(--line)",
            borderRadius: 14, padding: "10px 6px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            transition: "all 140ms ease",
          }}>
            <CharCircle z={zd.key} size={36} showPh={false} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>{zd.name}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: "20px" }}>
        <div className="rise" key={active} style={{
          background: `linear-gradient(135deg, ${z.colors[0]}22, ${z.colors[1]}33)`,
          borderRadius: 22, padding: "20px 22px",
          border: "1px solid var(--line)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CharCircle z={z.key} size={56} showPh={false} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-64)" }}>이번 주</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 800, marginTop: 2 }}>{z.name}띠</div>
            </div>
            <div style={{ marginLeft: "auto", fontFamily: "var(--serif)", fontSize: 28, fontWeight: 800, color: "var(--pink-strong)" }}>
              {score}점
            </div>
          </div>
          <div style={{ marginTop: 14, fontFamily: "var(--serif)", fontSize: 16, fontWeight: 700, lineHeight: 1.6 }}>
            오랫동안 미뤘던 일이<br/>마무리되는 한 주예요.
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-64)", lineHeight: 1.6 }}>
            수요일과 금요일에 좋은 신호가 와요. 작은 약속도 가볍게 받지 마세요.
          </div>
        </div>

        <div className="rise-stagger" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { k: "재물", t: "안정적", c: "#d49a3a" },
            { k: "연애", t: "신호 옴", c: "#e6549a" },
            { k: "일", t: "성과 기대", c: "#3f7a8c" },
            { k: "건강", t: "가벼운 운동", c: "#5b8a5b" },
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
      </div>
    </div>
  );
}

window.ZodiacPage = ZodiacPage;
