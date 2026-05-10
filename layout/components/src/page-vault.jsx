// 보관함

function VaultPage({ onBack }) {
  const items = [
    { type: "오늘운세", date: "11.04", title: "작은 결정이 하루를 바꿔요", z: "rooster" },
    { type: "타로", date: "11.02", title: "별 — 희망과 새 방향", z: "rabbit" },
    { type: "사주", date: "10.28", title: "내 사주 한 줄 풀이", z: "dragon" },
    { type: "궁합", date: "10.24", title: "82점 — 따뜻한 흐름", z: "horse" },
  ];
  const [tab, setTab] = React.useState("all");
  const tabs = [
    { k: "all", l: "전체" },
    { k: "free", l: "무료" },
    { k: "paid", l: "결제 풀이" },
  ];

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="보관함" onBack={onBack} />
      <div className="hscroll" style={{ paddingTop: 16 }}>
        {tabs.map(t => (
          <button key={t.k} className={`chip ${tab === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>
            {t.l}
          </button>
        ))}
      </div>
      <div className="rise-stagger" style={{ padding: "8px 20px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
            <CharCircle z={it.z} size={44} showPh={false} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-strong)" }}>{it.type} · {it.date}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, lineHeight: 1.4 }}>{it.title}</div>
            </div>
            <Icon.ArrowRight style={{ color: "var(--ink-44)", width: 18, height: 18 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

window.VaultPage = VaultPage;
