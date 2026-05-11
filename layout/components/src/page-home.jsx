// Home page — seasonal banner + category chips + 2-col cards

const HOME_CATEGORIES = [
  { key: "all", label: "전체" },
  { key: "saju", label: "사주·명리" },
  { key: "fortune", label: "운세·택일" },
  { key: "consult", label: "상담" },
];

const HOME_CARDS = [
  { id: "today", title: "오늘운세", desc: "지금 핵심 한 줄", price: "무료", icon: "Sun", z: "rooster", cat: "fortune", tag: "추천" },
  { id: "tarot", title: "타로 한 장", desc: "마음이 시키는 카드", price: "무료", icon: "Card", z: "rabbit", cat: "fortune", tag: "HOT" },
  { id: "saju", title: "사주", desc: "내 사주 풀이", price: "550원~", icon: "Compass", z: "dragon", cat: "saju" },
  { id: "gunghap", title: "궁합", desc: "둘 사이의 흐름", price: "990원", icon: "Heart", z: "rabbit", cat: "saju" },
  { id: "daewoon", title: "대운", desc: "10년 흐름 보기", price: "990원", icon: "Compass", z: "tiger", cat: "saju" },
  { id: "taekil", title: "택일", desc: "중요한 날 잡기", price: "990원", icon: "Calendar", z: "ox", cat: "fortune" },
  { id: "zodiac", title: "띠운세", desc: "12띠별 이번주", price: "무료", icon: "Star", z: "horse", cat: "fortune" },
  { id: "consult", title: "대화 상담", desc: "선생님께 묻기", price: "990원~", icon: "Chat", z: "snake", cat: "consult" },
];

function SeasonBanner({ variant = 0 }) {
  // 3 banner variants — cycle through
  if (variant === 1) {
    // Today's date variant
    const d = new Date();
    const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return (
      <div style={{
        margin: "16px 20px 0",
        borderRadius: 22,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(135deg, #ff8eb9 0%, #ff4f9a 50%, #d81b72 100%)",
        color: "#fff",
        padding: "22px 22px 24px",
        boxShadow: "0 12px 28px -10px rgba(216,27,114,0.45)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(circle at 90% 20%, rgba(255,255,255,0.25), transparent 50%)",
          pointerEvents: "none",
        }} />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.85 }}>오늘의 한 줄</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, lineHeight: 1.3, fontFamily: "var(--serif)" }}>
          {md}, 작은 결정이<br/>큰 흐름을 바꾸는 날
        </div>
        <button className="btn" style={{ marginTop: 14, height: 40, background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)" }}>
          오늘운세 보러가기 →
        </button>
        <div style={{ position: "absolute", right: 18, bottom: 14, animation: "float-y 4s ease-in-out infinite" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #fff8d9, #ffd479 60%, #f5b740)",
            boxShadow: "0 0 30px rgba(255,213,121,0.6)",
          }} />
        </div>
      </div>
    );
  }
  if (variant === 2) {
    // Star/zodiac highlight
    return (
      <div style={{
        margin: "16px 20px 0",
        borderRadius: 22,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(160deg, #1c1b2a 0%, #2a2840 50%, #3d2a4a 100%)",
        color: "#fff",
        padding: "22px",
        minHeight: 168,
      }}>
        {/* Stars */}
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: 2 + (i % 3), height: 2 + (i % 3),
            background: "#ffd54a",
            borderRadius: "50%",
            opacity: 0.4 + (i % 4) * 0.15,
            top: `${(i * 37) % 90}%`,
            left: `${(i * 53) % 95}%`,
            boxShadow: "0 0 4px rgba(255, 213, 74, 0.8)",
          }} />
        ))}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#ffd54a" }}>이번 주 별자리</div>
        <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, lineHeight: 1.3, fontFamily: "var(--serif)" }}>
          전갈자리, 흐름을<br/>바꾸는 한 주
        </div>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
          오랫동안 미뤘던 일이<br/>마무리되는 시기예요.
        </div>
        <button style={{
          position: "absolute", right: 18, bottom: 18,
          background: "#ffd54a", color: "#1c1b2a",
          border: 0, height: 36, padding: "0 14px",
          borderRadius: 999, fontSize: 13, fontWeight: 800,
        }}>자세히 보기</button>
      </div>
    );
  }
  // Default: 이번 주 띠 하이라이트
  return (
    <div style={{
      margin: "16px 20px 0",
      borderRadius: 22,
      overflow: "hidden",
      position: "relative",
      background: "linear-gradient(135deg, #fff0f7 0%, #ffe7f1 100%)",
      padding: "20px 22px",
      border: "1px solid var(--line)",
    }}>
      <div style={{ position: "absolute", right: -10, top: -10, width: 110, height: 110, borderRadius: "50%",
        background: "radial-gradient(circle at 40% 40%, #ffffff, #fff0f7 60%, transparent)", opacity: 0.7 }} />
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)", letterSpacing: "0.06em" }}>
        이번 주의 띠
      </div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, lineHeight: 1.3, fontFamily: "var(--serif)", color: "var(--ink)" }}>
        호랑이띠,<br/>새 기회가 오는 주
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink-64)", lineHeight: 1.5, maxWidth: 200 }}>
          연락 한 통이 일주일을<br/>바꿀 수 있어요.
        </div>
        <div style={{ animation: "float-y 3.6s ease-in-out infinite" }}>
          <CharCircle z="tiger" size={64} showPh={false} />
        </div>
      </div>
      <button className="btn btn-pink" style={{ marginTop: 14, height: 40, fontSize: 13, padding: "0 14px" }}>
        12띠 운세 모두 보기 →
      </button>
    </div>
  );
}

function HomeCard({ card, onClick, showCharacter = true, layout = "grid" }) {
  const IconC = Icon[card.icon];
  if (layout === "list") {
    return (
      <button onClick={onClick} style={{
        display: "flex", width: "100%",
        alignItems: "center", gap: 14,
        padding: "14px 16px",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        textAlign: "left",
        transition: "transform 120ms ease",
      }}
      onTouchStart={(e) => e.currentTarget.style.transform = "scale(0.98)"}
      onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        {showCharacter
          ? <CharCircle z={card.z} size={48} showPh={false} />
          : <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "var(--pink-soft)", color: "var(--pink-strong)",
              display: "grid", placeItems: "center",
            }}><IconC style={{width:22,height:22}}/></div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="home-card-title" style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>{card.title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 2 }}>{card.desc}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: card.price === "무료" ? "var(--pink-strong)" : "var(--ink)" }}>
          {card.price}
        </div>
      </button>
    );
  }
  // grid
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column",
      gap: 0,
      padding: 14,
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 18,
      textAlign: "left",
      position: "relative",
      overflow: "hidden",
      minHeight: 148,
      transition: "transform 140ms ease, box-shadow 140ms ease",
      boxShadow: "var(--shadow-card)",
    }}
    onTouchStart={(e) => e.currentTarget.style.transform = "scale(0.97)"}
    onTouchEnd={(e) => e.currentTarget.style.transform = "scale(1)"}
    >
      {card.tag && (
        <div style={{
          position: "absolute", right: 10, top: 10,
          fontSize: 10, fontWeight: 800,
          background: card.tag === "HOT" ? "var(--pink)" : "var(--ink)",
          color: "#fff", padding: "3px 8px", borderRadius: 999, letterSpacing: "0.04em",
        }}>{card.tag}</div>
      )}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
        {showCharacter
          ? <CharCircle z={card.z} size={56} showPh={false} />
          : <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "var(--pink-soft)", color: "var(--pink-strong)",
              display: "grid", placeItems: "center",
            }}><IconC style={{width:26,height:26}}/></div>
        }
      </div>
      <div className="home-card-title" style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", marginTop: 14 }}>
        {card.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 3, lineHeight: 1.4 }}>{card.desc}</div>
      <div style={{
        marginTop: 8, fontSize: 12, fontWeight: 800,
        color: card.price === "무료" ? "var(--pink-strong)" : "var(--ink)",
      }}>
        {card.price === "무료" ? "무료로 보기" : card.price}
      </div>
    </button>
  );
}

function HomePage({ onNavigate, tweaks }) {
  const [cat, setCat] = React.useState("all");
  const filtered = cat === "all" ? HOME_CARDS : HOME_CARDS.filter(c => c.cat === cat);

  return (
    <div className="page">
      <SeasonBanner variant={tweaks.bannerVariant} />

      {/* Quick free actions */}
      <div style={{ display: "flex", gap: 10, padding: "16px 20px 0" }}>
        <button onClick={() => onNavigate("today")} style={{
          flex: 1,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "14px 14px",
          textAlign: "left",
          display: "flex", flexDirection: "column", gap: 4,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #fff8d9, #ffd479 60%, #f5b740)",
              boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.06)" }}/>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-strong)" }}>FREE</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>오늘운세</div>
          <div style={{ fontSize: 11, color: "var(--ink-64)" }}>지금 바로 한 줄</div>
        </button>
        <button onClick={() => onNavigate("tarot")} style={{
          flex: 1,
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "14px 14px",
          textAlign: "left",
          display: "flex", flexDirection: "column", gap: 4,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 18, height: 26, borderRadius: 4,
              background: "linear-gradient(135deg, var(--pink), var(--pink-strong))",
              boxShadow: "2px 2px 0 #fff, 4px 4px 0 var(--line)" }}/>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-strong)" }}>FREE</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>타로 한 장</div>
          <div style={{ fontSize: 11, color: "var(--ink-64)" }}>마음이 시키는 카드</div>
        </button>
      </div>

      {/* Category chips */}
      <div className="hscroll" style={{ marginTop: 20 }}>
        {HOME_CATEGORIES.map(c => (
          <button key={c.key}
            className={`chip ${cat === c.key ? "active" : ""}`}
            onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Service cards */}
      <div style={{ padding: "8px 20px 0" }}>
        {tweaks.cardLayout === "list" ? (
          <div className="rise-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(c => (
              <HomeCard key={c.id} card={c} onClick={() => onNavigate(c.id)} showCharacter={tweaks.showCharacter} layout="list" />
            ))}
          </div>
        ) : (
          <div className="rise-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {filtered.map(c => (
              <HomeCard key={c.id} card={c} onClick={() => onNavigate(c.id)} showCharacter={tweaks.showCharacter} />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", padding: "32px 20px 12px", fontSize: 11, color: "var(--ink-44)", lineHeight: 1.6 }}>
        달빛인생 · 오늘 바로 보는 운세<br/>
        © 2026 Moonlight Life
      </div>
    </div>
  );
}

window.HomePage = HomePage;
