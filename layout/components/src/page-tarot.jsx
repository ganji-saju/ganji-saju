// 타로 — 부채꼴 카드 펼침 → 한 장 뽑기 → 뒤집기

const TAROT_RESULTS = [
  { name: "별", key: "star", meaning: "희망과 새 방향", advice: "오래 미뤘던 시작에 좋은 신호. 작게라도 첫 걸음을 떼세요." },
  { name: "달", key: "moon", meaning: "감정의 흐름", advice: "보이는 게 전부가 아니에요. 직감보다 며칠 더 기다려보세요." },
  { name: "해", key: "sun", meaning: "확실한 성취", advice: "지금 흐름이 답이에요. 망설일 필요 없이 한 가지를 끝내세요." },
  { name: "운명의 수레바퀴", key: "wheel", meaning: "전환점", advice: "예상 밖 변화가 와요. 흐름을 거스르지 말고 올라타세요." },
  { name: "연인", key: "lovers", meaning: "선택과 인연", advice: "두 가지 중 하나는 당신의 것이 아니에요. 마음이 가벼운 쪽으로." },
  { name: "황제", key: "emperor", meaning: "구조와 책임", advice: "리듬을 다시 잡을 때. 작은 규칙 하나가 큰 차이를 만듭니다." },
  { name: "여사제", key: "priestess", meaning: "내면의 직관", advice: "말하기보다 듣는 날. 답은 이미 안에 있어요." },
];

function TarotPage({ onBack }) {
  const [phase, setPhase] = React.useState("intro"); // intro | fan | flipping | result
  const [picked, setPicked] = React.useState(null);
  const [shuffleKey, setShuffleKey] = React.useState(0);

  const startDraw = () => {
    setPhase("fan");
    setShuffleKey(k => k + 1);
  };

  const pickCard = (idx) => {
    if (phase !== "fan") return;
    const r = TAROT_RESULTS[Math.floor(Math.random() * TAROT_RESULTS.length)];
    setPicked({ ...r, idx });
    setPhase("flipping");
    setTimeout(() => setPhase("result"), 1100);
  };

  const reset = () => {
    setPicked(null);
    setPhase("intro");
  };

  // Render 7 cards in fan
  const FAN_COUNT = 7;

  return (
    <div className="page" style={{ minHeight: "100%", background: "linear-gradient(180deg, #fff 0%, #fff5f9 100%)" }}>
      <PageHeader title="타로 한 장" onBack={phase === "intro" ? onBack : reset} />

      {phase === "intro" && (
        <div className="page" style={{ padding: "24px 20px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 800, lineHeight: 1.4, marginTop: 12 }}>
            오늘 마음에<br/>한 장만 뽑아볼까요?
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-64)", marginTop: 12, lineHeight: 1.6 }}>
            잠시 눈을 감고, 가장 궁금한 한 가지를<br/>마음속에 떠올려보세요.
          </div>

          {/* Stack preview */}
          <div style={{ position: "relative", height: 280, margin: "32px 0 8px" }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                position: "absolute",
                left: "50%", top: "50%",
                transform: `translate(-50%, -50%) rotate(${(i - 2) * 6}deg) translateY(${i * -2}px)`,
                width: 130, height: 200,
                borderRadius: 14,
                background: "linear-gradient(135deg, #2a2840 0%, #3d2a4a 100%)",
                border: "2px solid var(--pink)",
                boxShadow: "0 8px 24px -8px rgba(0,0,0,0.3)",
                animation: `float-y 4s ease-in-out ${i * 0.2}s infinite`,
              }}>
                <CardBack />
              </div>
            ))}
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 24 }} onClick={startDraw}>
            카드 뽑으러 가기
          </button>
        </div>
      )}

      {phase === "fan" && (
        <div className="page" style={{ padding: "24px 20px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700 }}>
            마음이 가는 카드를 한 장 골라요
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 6 }}>
            손가락이 닿는 그 카드가 답이에요.
          </div>

          {/* Fan */}
          <div key={shuffleKey} style={{
            position: "relative", height: 320, marginTop: 32,
          }}>
            {Array.from({ length: FAN_COUNT }).map((_, i) => {
              const half = (FAN_COUNT - 1) / 2;
              const angle = (i - half) * 11;
              const x = (i - half) * 30;
              const y = Math.abs(i - half) * 8;
              return (
                <button key={i} onClick={() => pickCard(i)} style={{
                  position: "absolute",
                  left: "50%", bottom: 0,
                  transform: `translateX(-50%) translateX(${x}px) translateY(${y}px) rotate(${angle}deg)`,
                  transformOrigin: "center bottom",
                  width: 90, height: 150,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #2a2840 0%, #3d2a4a 100%)",
                  border: "2px solid var(--pink)",
                  boxShadow: "0 6px 20px -8px rgba(0,0,0,0.4)",
                  padding: 0,
                  transition: "transform 240ms cubic-bezier(0.2,0.8,0.2,1)",
                  animation: `cardEnter 480ms cubic-bezier(0.2,0.8,0.2,1) ${i * 60}ms both`,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = `translateX(-50%) translateX(${x}px) translateY(${y - 16}px) rotate(${angle}deg)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = `translateX(-50%) translateX(${x}px) translateY(${y}px) rotate(${angle}deg)`;
                }}
                >
                  <CardBack />
                </button>
              );
            })}
          </div>

          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setShuffleKey(k => k + 1)}>
            <Icon.Refresh style={{width:18,height:18}}/> 다시 섞기
          </button>

          <style>{`
            @keyframes cardEnter {
              from { opacity: 0; transform: translateX(-50%) translateY(40px) rotate(0deg); }
            }
          `}</style>
        </div>
      )}

      {phase === "flipping" && picked && (
        <div className="page" style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{
            width: 180, height: 280, margin: "0 auto",
            perspective: 1200,
          }}>
            <div style={{
              position: "relative",
              width: "100%", height: "100%",
              transformStyle: "preserve-3d",
              animation: "flip 1.1s cubic-bezier(0.4, 0, 0.2, 1) both",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                borderRadius: 16,
                background: "linear-gradient(135deg, #2a2840 0%, #3d2a4a 100%)",
                border: "2px solid var(--pink)",
                backfaceVisibility: "hidden",
                boxShadow: "0 12px 30px -10px rgba(0,0,0,0.4)",
              }}>
                <CardBack large />
              </div>
              <div style={{
                position: "absolute", inset: 0,
                borderRadius: 16,
                background: "linear-gradient(160deg, #fff5f9 0%, #fff 100%)",
                border: "2px solid var(--pink)",
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                boxShadow: "0 12px 30px -10px rgba(216,27,114,0.3)",
              }}>
                <CardFront r={picked} />
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 700, marginTop: 24 }}>
            카드를 펼치는 중…
          </div>
          <style>{`
            @keyframes flip {
              0% { transform: rotateY(0deg); }
              100% { transform: rotateY(180deg); }
            }
          `}</style>
        </div>
      )}

      {phase === "result" && picked && (
        <div className="page" style={{ padding: "24px 20px 40px", textAlign: "center" }}>
          <div style={{ width: 180, height: 280, margin: "0 auto",
            borderRadius: 16,
            background: "linear-gradient(160deg, #fff5f9 0%, #fff 100%)",
            border: "2px solid var(--pink)",
            boxShadow: "0 12px 30px -10px rgba(216,27,114,0.3)",
            animation: "rise 480ms cubic-bezier(0.2,0.8,0.2,1) both",
          }}>
            <CardFront r={picked} />
          </div>

          <div className="rise" style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)", letterSpacing: "0.08em" }}>
              뽑힌 카드
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 800, marginTop: 6 }}>
              {picked.name}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 4 }}>{picked.meaning}</div>
          </div>

          <div className="rise" style={{
            marginTop: 24,
            padding: "20px 22px",
            background: "var(--pink-soft)",
            borderRadius: 18,
            textAlign: "left",
            border: "1px solid var(--line)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)", letterSpacing: "0.06em" }}>
              오늘의 조언
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 700, marginTop: 8, lineHeight: 1.6 }}>
              {picked.advice}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reset}>
              <Icon.Refresh style={{width:18,height:18}}/> 다시 뽑기
            </button>
            <button className="btn btn-ink" style={{ flex: 1 }}>
              <Icon.Bookmark style={{width:18,height:18}}/> 보관하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CardBack({ large }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "grid", placeItems: "center",
      position: "relative",
      overflow: "hidden",
      borderRadius: "inherit",
    }}>
      {/* Stars */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 2, height: 2, borderRadius: "50%",
          background: "#ffd54a", opacity: 0.7,
          top: `${(i * 31) % 90}%`, left: `${(i * 47) % 90}%`,
          boxShadow: "0 0 4px #ffd54a",
        }}/>
      ))}
      {/* Moon */}
      <div style={{
        width: large ? 70 : 44, height: large ? 70 : 44,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #fff8d9, #ffd479 60%, #f5b740)",
        boxShadow: "0 0 20px rgba(255, 213, 121, 0.5)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute",
          width: large ? 50 : 32, height: large ? 50 : 32,
          borderRadius: "50%",
          background: "#2a2840",
          right: large ? -8 : -5, top: large ? 4 : 3,
        }}/>
      </div>
      <div style={{
        position: "absolute", bottom: 8,
        fontFamily: "var(--serif)",
        fontSize: large ? 11 : 9,
        color: "var(--pink)",
        letterSpacing: "0.16em",
      }}>달빛인생</div>
    </div>
  );
}

function CardFront({ r }) {
  // Simple symbol per card
  const symbols = {
    star: "✦",
    moon: "☾",
    sun: "☉",
    wheel: "◯",
    lovers: "♡",
    emperor: "♛",
    priestess: "✶",
  };
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 12,
      padding: 16,
    }}>
      <div style={{ fontSize: 64, color: "var(--pink-strong)", lineHeight: 1, fontFamily: "var(--serif)" }}>
        {symbols[r.key] || "✦"}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
        {r.name}
      </div>
      <div style={{ width: 40, height: 1, background: "var(--pink)" }}/>
      <div style={{ fontSize: 11, color: "var(--ink-64)", textAlign: "center" }}>
        {r.meaning}
      </div>
    </div>
  );
}

window.TarotPage = TarotPage;
