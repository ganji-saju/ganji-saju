// Shared atoms — characters, banners, etc.

const ZODIAC = [
  { key: "rat",     name: "쥐",   colors: ["#7e7c8a", "#a8a4b6"], emoji: "鼠" },
  { key: "ox",      name: "소",   colors: ["#8d6e52", "#bc9d7a"], emoji: "牛" },
  { key: "tiger",   name: "호랑이", colors: ["#e08648", "#f6b26b"], emoji: "虎" },
  { key: "rabbit",  name: "토끼", colors: ["#c8a3c8", "#e6cce6"], emoji: "兎" },
  { key: "dragon",  name: "용",   colors: ["#3f7a8c", "#6db0c4"], emoji: "龍" },
  { key: "snake",   name: "뱀",   colors: ["#5b8a5b", "#94c094"], emoji: "蛇" },
  { key: "horse",   name: "말",   colors: ["#c46a5a", "#e89a8a"], emoji: "馬" },
  { key: "sheep",   name: "양",   colors: ["#d6b27d", "#ecd2a5"], emoji: "羊" },
  { key: "monkey",  name: "원숭이", colors: ["#8a6a3a", "#b69666"], emoji: "猿" },
  { key: "rooster", name: "닭",   colors: ["#d49a3a", "#f0c570"], emoji: "鶏" },
  { key: "dog",     name: "개",   colors: ["#7a6555", "#a89380"], emoji: "犬" },
  { key: "pig",     name: "돼지", colors: ["#d68aa8", "#eeb8cc"], emoji: "猪" },
];

// Character circle — colored placeholder with kanji and "캐릭터 자리" marker
function CharCircle({ z, size = 48, showPh = true, hideChar = false }) {
  const data = ZODIAC.find(x => x.key === z) || ZODIAC[0];
  const [c1, c2] = data.colors;
  const style = {
    width: size, height: size,
    background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
    fontSize: size * 0.42,
    // dashed inner border to make it clear this is an illustration slot
    boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.45), inset 0 -4px 0 rgba(0,0,0,0.08)`,
  };
  if (hideChar) {
    return <div className="ch-circle" style={style} />;
  }
  return (
    <div className="ch-circle" style={style} title={`${data.name} 캐릭터 일러스트 자리`}>
      <span style={{
        fontFamily: "var(--serif)",
        textShadow: "0 1px 0 rgba(0,0,0,0.08)",
        opacity: 0.95,
      }}>{data.emoji}</span>
      {showPh && size >= 44 && <span className="ph">캐릭터자리</span>}
    </div>
  );
}

// Image / illustration placeholder — striped with mono label
function ImgPh({ label = "이미지", aspect = "16/9", radius = 14, tone = "pink", style }) {
  const tones = {
    pink: { bg: "#fff0f7", stripe: "rgba(255, 79, 154, 0.18)", text: "#d81b72" },
    moon: { bg: "#1c1b2a", stripe: "rgba(255, 213, 74, 0.14)", text: "#ffd54a" },
    neutral: { bg: "#f4f4f6", stripe: "rgba(17,17,20,0.06)", text: "rgba(17,17,20,0.5)" },
  };
  const t = tones[tone] || tones.pink;
  return (
    <div style={{
      aspectRatio: aspect,
      borderRadius: radius,
      background: `repeating-linear-gradient(135deg, ${t.bg} 0 12px, ${t.stripe} 12px 13px)`,
      display: "grid",
      placeItems: "center",
      color: t.text,
      fontFamily: "ui-monospace, SFMono-Regular, monospace",
      fontSize: 11,
      letterSpacing: "0.02em",
      ...style,
    }}>{label}</div>
  );
}

// Section block — title + child rail
function Section({ title, sub, action, children, pad = true }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: pad ? "0 20px" : 0 }}>
        <h2 className="section-title">
          {title}
          {sub && <span className="sub">{sub}</span>}
        </h2>
        {action}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

// Page header (sub-page)
function PageHeader({ title, onBack, right }) {
  return (
    <div style={{
      height: 52,
      padding: "0 8px 0 4px",
      display: "flex", alignItems: "center",
      borderBottom: "1px solid var(--line)",
      background: "#fff",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <button className="icon-btn" onClick={onBack} aria-label="뒤로">
        <Icon.ArrowLeft />
      </button>
      <div style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div style={{ width: 36, display: "flex", justifyContent: "flex-end" }}>
        {right || <span style={{ width: 36 }} />}
      </div>
    </div>
  );
}

// Toast hook
function useToast() {
  const [msg, setMsg] = React.useState(null);
  const show = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1800);
  };
  const node = msg ? <div className="toast">{msg}</div> : null;
  return [node, show];
}

// Sheet wrapper
function Sheet({ open, onClose, children }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  );
}

window.ZODIAC = ZODIAC;
window.CharCircle = CharCircle;
window.ImgPh = ImgPh;
window.Section = Section;
window.PageHeader = PageHeader;
window.useToast = useToast;
window.Sheet = Sheet;
