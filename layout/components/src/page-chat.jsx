// 대화방 — 선생님 리스트

const TEACHERS = [
  { z: "dragon", name: "용 선생", topic: "사주 종합", desc: "전체적인 흐름을 봐드려요", price: "990원~" },
  { z: "rabbit", name: "토끼 선생", topic: "연애·마음", desc: "연애의 결을 읽어드려요", price: "990원~" },
  { z: "tiger",  name: "호랑이 선생", topic: "일·직장", desc: "이직과 흐름 상담", price: "990원~" },
  { z: "ox",     name: "소 선생", topic: "재물·돈", desc: "돈의 흐름을 짚어드려요", price: "990원~" },
  { z: "snake",  name: "뱀 선생", topic: "택일·결정", desc: "중요한 날 골라드려요", price: "550원~" },
];

function ChatPage({ onBack }) {
  const [opened, setOpened] = React.useState(null);

  if (opened) {
    return <ChatRoom teacher={opened} onBack={() => setOpened(null)} />;
  }

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="대화방" onBack={onBack} />
      <div style={{ padding: "20px" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 800, lineHeight: 1.4 }}>
          어떤 선생님과<br/>이야기 나눠볼까요?
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 6 }}>
          궁금한 분야의 선생님을 골라보세요.
        </div>

        <div className="rise-stagger" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {TEACHERS.map((t, i) => (
            <button key={i} onClick={() => setOpened(t)} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px",
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 16, textAlign: "left",
            }}>
              <CharCircle z={t.z} size={52} showPh={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 2 }}>{t.topic} · {t.desc}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)" }}>{t.price}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatRoom({ teacher, onBack }) {
  const [messages, setMessages] = React.useState([
    { from: "t", text: `안녕하세요, ${teacher.name}이에요. 무엇이 궁금하세요?` },
  ]);
  const [input, setInput] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const send = () => {
    if (!input.trim()) return;
    const text = input;
    setMessages(m => [...m, { from: "u", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, {
        from: "t",
        text: "마음을 잘 들었어요. 지금 흐름은 한 번 호흡을 가다듬을 때예요. 작은 결정 하나부터 천천히 가보세요."
      }]);
    }, 1400);
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{
        height: 56, padding: "0 8px 0 4px",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid var(--line)", background: "#fff",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <button className="icon-btn" onClick={onBack}><Icon.ArrowLeft /></button>
        <CharCircle z={teacher.z} size={36} showPh={false} />
        <div style={{ marginLeft: 10, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{teacher.name}</div>
          <div style={{ fontSize: 11, color: "#3da673", fontWeight: 600 }}>● 응답 중</div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px",
        background: "#fafafb",
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", marginBottom: 8,
            justifyContent: m.from === "u" ? "flex-end" : "flex-start",
            gap: 8, alignItems: "flex-end",
          }}>
            {m.from === "t" && <CharCircle z={teacher.z} size={28} showPh={false} />}
            <div style={{
              maxWidth: "75%", padding: "10px 14px",
              borderRadius: 16,
              background: m.from === "u" ? "var(--pink)" : "#fff",
              color: m.from === "u" ? "#fff" : "var(--ink)",
              fontSize: 14, lineHeight: 1.55,
              border: m.from === "t" ? "1px solid var(--line)" : "0",
              borderBottomRightRadius: m.from === "u" ? 4 : 16,
              borderBottomLeftRadius: m.from === "t" ? 4 : 16,
              animation: "rise 240ms ease both",
            }}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <CharCircle z={teacher.z} size={28} showPh={false} />
            <div style={{ background: "#fff", border: "1px solid var(--line)",
              padding: "12px 14px", borderRadius: 16, borderBottomLeftRadius: 4,
              display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 999,
                  background: "var(--ink-44)",
                  animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out` }}/>
              ))}
            </div>
            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
                40% { opacity: 1; transform: translateY(-4px); }
              }
            `}</style>
          </div>
        )}
      </div>

      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "10px 14px calc(10px + var(--safe-bottom))",
        background: "#fff", borderTop: "1px solid var(--line)",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="궁금한 것을 적어주세요"
          style={{ flex: 1, height: 42, border: "1px solid var(--line)",
            borderRadius: 999, padding: "0 16px", fontSize: 14, outline: 0, fontFamily: "inherit" }}/>
        <button onClick={send} style={{
          width: 42, height: 42, borderRadius: "50%", border: 0,
          background: "var(--pink)", color: "#fff",
          display: "grid", placeItems: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l14-7-7 14-2-5-5-2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

window.ChatPage = ChatPage;
