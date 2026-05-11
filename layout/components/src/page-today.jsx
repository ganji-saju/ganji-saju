// 오늘운세 페이지 — 고민 선택 → 입력 → 결과 등장 애니메이션

const TODAY_TOPICS = [
  { key: "all", label: "전체 흐름", icon: "Sparkle", color: "#ff4f9a" },
  { key: "love", label: "연애·마음", icon: "Heart", color: "#ff6b9d" },
  { key: "money", label: "돈·재물", icon: "Wallet", color: "#d49a3a" },
  { key: "work", label: "일·직장", icon: "Briefcase", color: "#3f7a8c" },
];

const RESULT_BY_TOPIC = {
  all: {
    headline: "작은 결정이 하루를 바꿔요",
    advice: "오전엔 미뤘던 연락 한 통, 오후엔 짧은 산책. 이 두 가지가 오늘 흐름을 부드럽게 만들어줘요.",
    cards: [
      { k: "재물", t: "예상 밖 작은 수입", tone: "good" },
      { k: "연애", t: "오해 풀기 좋은 날", tone: "good" },
      { k: "일",   t: "마무리에 집중하세요", tone: "neutral" },
      { k: "건강", t: "물 자주 챙기기", tone: "neutral" },
    ],
  },
  love: {
    headline: "마음의 거리가 가까워지는 날",
    advice: "오늘은 먼저 다가가는 쪽이 흐름을 잡아요. 짧은 안부가 길게 남는 하루.",
    cards: [
      { k: "연락", t: "먼저 보내도 좋아요", tone: "good" },
      { k: "오해", t: "스스로 풀려요", tone: "good" },
      { k: "약속", t: "저녁 시간이 좋음", tone: "neutral" },
      { k: "신호", t: "표정에 답이 있음", tone: "neutral" },
    ],
  },
  money: {
    headline: "지출보다 흐름을 살피세요",
    advice: "큰 결정은 오늘 미루고, 들어오는 돈의 출처를 한 번 더 확인해보세요.",
    cards: [
      { k: "수입", t: "약속된 돈 확인", tone: "good" },
      { k: "지출", t: "충동 구매 주의", tone: "warn" },
      { k: "투자", t: "관망이 답", tone: "neutral" },
      { k: "기회", t: "오후에 열림", tone: "good" },
    ],
  },
  work: {
    headline: "마무리가 새로운 시작이 돼요",
    advice: "남아있던 작은 일을 하나만 끝내도 오늘이 다르게 보여요. 큰 일은 내일로.",
    cards: [
      { k: "동료", t: "가벼운 부탁 OK", tone: "good" },
      { k: "회의", t: "발언 짧게", tone: "neutral" },
      { k: "성과", t: "내일 보임", tone: "neutral" },
      { k: "이직", t: "신호 모음 단계", tone: "warn" },
    ],
  },
};

function TodayPage({ onBack }) {
  const [step, setStep] = React.useState("topic"); // topic | input | loading | result
  const [topic, setTopic] = React.useState(null);
  const [year, setYear] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [day, setDay] = React.useState("");
  const [hour, setHour] = React.useState("");
  const [gender, setGender] = React.useState("F");

  const selectTopic = (t) => {
    setTopic(t);
    setTimeout(() => setStep("input"), 200);
  };

  const submit = () => {
    if (!year || !month || !day) return;
    setStep("loading");
    setTimeout(() => setStep("result"), 1800);
  };

  const reset = () => {
    setStep("topic");
    setTopic(null);
  };

  const result = topic ? RESULT_BY_TOPIC[topic] : null;

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="오늘운세" onBack={step === "topic" ? onBack : reset} />

      {step === "topic" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35 }}>
            오늘 어떤 부분이<br/>가장 궁금해요?
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
            한 가지를 골라야 더 또렷이 보여드려요.
          </div>
          <div className="rise-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
            {TODAY_TOPICS.map(t => {
              const IconC = Icon[t.icon];
              return (
                <button key={t.key} onClick={() => selectTopic(t.key)} style={{
                  padding: "20px 16px",
                  background: "#fff",
                  border: "1.5px solid var(--line)",
                  borderRadius: 18,
                  textAlign: "left",
                  display: "flex", flexDirection: "column", gap: 12,
                  minHeight: 140,
                  transition: "all 160ms ease",
                }}
                onTouchStart={(e) => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = "var(--pink-soft)"; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 14,
                    background: `linear-gradient(135deg, ${t.color}22, ${t.color}44)`,
                    color: t.color, display: "grid", placeItems: "center" }}>
                    <IconC style={{ width: 22, height: 22 }}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 4 }}>지금 한 줄로</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "input" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", background: "var(--pink-soft)",
            borderRadius: 999, fontSize: 12, fontWeight: 700, color: "var(--pink-strong)",
          }}>
            {TODAY_TOPICS.find(t => t.key === topic)?.label}
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35, marginTop: 12 }}>
            태어난 정보를<br/>알려주세요
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
            저장되지 않아요. 한 번만 풀이에 쓰여요.
          </div>

          {/* Birth date */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>생년월일</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
              <Field placeholder="1995" value={year} onChange={setYear} maxLength={4} suffix="년" />
              <Field placeholder="06" value={month} onChange={setMonth} maxLength={2} suffix="월" />
              <Field placeholder="15" value={day} onChange={setDay} maxLength={2} suffix="일" />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>태어난 시간 <span style={{ fontWeight: 500, color: "var(--ink-44)" }}>(선택)</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              <Field placeholder="모르면 비워두세요" value={hour} onChange={setHour} suffix="시" />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>성별</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ k: "F", l: "여성" }, { k: "M", l: "남성" }].map(g => (
                <button key={g.k} onClick={() => setGender(g.k)} style={{
                  height: 48, borderRadius: 12,
                  border: gender === g.k ? "1.5px solid var(--pink)" : "1px solid var(--line)",
                  background: gender === g.k ? "var(--pink-soft)" : "#fff",
                  color: gender === g.k ? "var(--pink-strong)" : "var(--ink)",
                  fontWeight: 700, fontSize: 14,
                }}>{g.l}</button>
              ))}
            </div>
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 28 }} onClick={submit}
            disabled={!year || !month || !day}>
            오늘 풀이 받기
          </button>
        </div>
      )}

      {step === "loading" && (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto" }}>
            <div style={{ position: "absolute", inset: 0,
              background: "radial-gradient(circle at 30% 30%, #fff8d9, #ffd479 60%, #f5b740)",
              borderRadius: "50%",
              animation: "float-y 2.4s ease-in-out infinite",
              boxShadow: "0 0 40px rgba(255, 213, 121, 0.5)",
            }}/>
            <div style={{ position: "absolute", inset: -10,
              border: "2px dashed var(--pink)",
              borderRadius: "50%",
              animation: "spin-slow 6s linear infinite",
              opacity: 0.5,
            }}/>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700, marginTop: 28 }}>
            오늘의 흐름을 읽는 중…
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 6 }}>
            잠시만요, 곧 보여드릴게요.
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          {/* Headline */}
          <div className="rise" style={{
            background: "linear-gradient(135deg, #fff0f7, #ffe7f1)",
            borderRadius: 22,
            padding: "22px 22px 24px",
            border: "1px solid var(--line)",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -12, top: -12, width: 90, height: 90, borderRadius: "50%",
              background: "radial-gradient(circle at 40% 40%, #fff, transparent 70%)" }}/>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)", letterSpacing: "0.06em" }}>
              지금 핵심
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, marginTop: 8, lineHeight: 1.4 }}>
              {result.headline}
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-64)", marginTop: 12, lineHeight: 1.6 }}>
              {result.advice}
            </div>
          </div>

          {/* 4 area cards */}
          <div className="rise-stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            {result.cards.map((c, i) => (
              <div key={i} style={{
                padding: "14px 14px",
                background: "#fff", border: "1px solid var(--line)",
                borderRadius: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 999,
                    background: c.tone === "good" ? "#3da673" : c.tone === "warn" ? "#e6549a" : "#a8a4b6",
                  }}/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-64)" }}>{c.k}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{c.t}</div>
              </div>
            ))}
          </div>

          {/* Upsell */}
          <div className="rise" style={{ marginTop: 20, padding: "16px 16px",
            background: "var(--ink)", color: "#fff", borderRadius: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.8 }}>더 깊게 보고 싶다면</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
              오늘 자세히 보기 · 550원
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>
              시간대별 흐름과 조심할 시각까지 한 번에.
            </div>
            <button className="btn btn-pink" style={{ marginTop: 12, height: 40, fontSize: 13 }}>
              풀이 열기
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }}>
              <Icon.Bookmark style={{width:18,height:18}}/> 보관
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }}>
              <Icon.Share style={{width:18,height:18}}/> 공유
            </button>
            <button className="btn btn-ghost" onClick={reset} style={{ flex: 1 }}>
              <Icon.Refresh style={{width:18,height:18}}/> 다시
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ value, onChange, placeholder, maxLength, suffix }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      height: 48,
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "0 12px",
      transition: "border-color 120ms",
    }}>
      <input
        type="text" inputMode="numeric"
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder} maxLength={maxLength}
        style={{
          flex: 1, border: 0, outline: 0, background: "transparent",
          fontSize: 15, fontWeight: 600, fontFamily: "inherit", color: "var(--ink)",
          minWidth: 0,
        }}
      />
      {suffix && <span style={{ fontSize: 13, color: "var(--ink-44)", fontWeight: 600 }}>{suffix}</span>}
    </div>
  );
}

window.TodayPage = TodayPage;
