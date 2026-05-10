// 무료운세 허브 — FAB 진입

function FreePage({ onBack, onNavigate }) {
  const items = [
    { id: "today", title: "오늘운세", desc: "지금 한 줄로 보는 흐름", z: "rooster", icon: "Sun" },
    { id: "tarot", title: "타로 한 장", desc: "마음이 시키는 카드", z: "rabbit", icon: "Card" },
    { id: "zodiac", title: "띠운세", desc: "이번 주 12띠 메시지", z: "horse", icon: "Star" },
  ];
  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="무료운세" onBack={onBack} />
      <div style={{ padding: "20px" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.4 }}>
          무료로 바로 보는<br/>운세
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
          가입 없이도 한 번에 볼 수 있어요.
        </div>
        <div className="rise-stagger" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => {
            const IconC = Icon[it.icon];
            return (
              <button key={it.id} onClick={() => onNavigate(it.id)} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 16px",
                background: "linear-gradient(135deg, #fff0f7, #fff)",
                border: "1px solid var(--line)", borderRadius: 18, textAlign: "left",
              }}>
                <CharCircle z={it.z} size={56} showPh={false} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "inline-flex", padding: "2px 8px", background: "var(--pink)", color: "#fff",
                    borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em" }}>FREE</div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{it.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 2 }}>{it.desc}</div>
                </div>
                <Icon.ArrowRight style={{ color: "var(--ink-44)", width: 20, height: 20 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.FreePage = FreePage;
