// Main app — header, dock, page routing, tweaks panel

const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showCharacter": true,
  "bannerVariant": 0,
  "senior": false,
  "cardLayout": "grid",
  "pinkIntensity": "default"
}/*EDITMODE-END*/;

function App() {
  const [page, setPage] = React.useState("home");
  const [tab, setTab] = React.useState("home");
  const [authMode, setAuthMode] = React.useState("login");
  const [payProduct, setPayProduct] = React.useState(null);
  const [tweaks, setTweak] = useTweaks(TWEAKS_DEFAULTS);
  const [toastNode, showToast] = useToast();

  const navigate = (id) => {
    // Tab dock items
    if (id === "home") { setPage("home"); setTab("home"); return; }
    if (id === "addsaju") { setPage("saju"); setTab("addsaju"); return; }
    if (id === "free") { setPage("free"); setTab("free"); return; }
    if (id === "chatroom") { setPage("chat"); setTab("chatroom"); return; }
    if (id === "vault") { setPage("vault"); setTab("vault"); return; }

    if (id === "login") { setAuthMode("login"); setPage("auth"); return; }
    if (id === "signup") { setAuthMode("signup"); setPage("auth"); return; }
    if (id === "pay") { setPage("pay"); return; }

    // Card targets
    const map = {
      today: "today",
      tarot: "tarot",
      saju: "saju",
      gunghap: "gunghap",
      zodiac: "zodiac",
      consult: "chat",
      daewoon: "daewoon",
      taekil: "taekil",
    };
    const target = map[id];
    if (target) {
      setPage(target);
      // Update tab indicator
      if (target === "today" || target === "tarot" || target === "zodiac") setTab("free");
      else if (target === "chat") setTab("chatroom");
      else setTab("home");
    } else {
      showToast("준비 중이에요");
    }
  };

  const openPay = (product) => {
    setPayProduct(product);
    setPage("pay");
  };

  React.useEffect(() => {
    const h = (e) => openPay(e.detail);
    window.addEventListener("openpay", h);
    return () => window.removeEventListener("openpay", h);
  }, []);

  const back = () => { setPage("home"); setTab("home"); };

  const seniorClass = tweaks.senior ? "senior" : "";
  const pinkClass = tweaks.pinkIntensity === "soft" ? "pink-soft"
                  : tweaks.pinkIntensity === "bold" ? "pink-bold" : "";

  return (
    <div className="stage">
      <div className={`app ${seniorClass} ${pinkClass}`}>
        {page === "home" && <AppHeader showToast={showToast} onLogin={() => navigate("login")} />}
        <div className="main">
          {page === "home" && <HomePage onNavigate={navigate} tweaks={tweaks} />}
          {page === "today" && <TodayPage onBack={back} />}
          {page === "tarot" && <TarotPage onBack={back} />}
          {page === "saju" && <SajuPage onBack={back} />}
          {page === "gunghap" && <GunghapPage onBack={back} />}
          {page === "zodiac" && <ZodiacPage onBack={back} />}
          {page === "chat" && <ChatPage onBack={back} />}
          {page === "vault" && <VaultPage onBack={back} />}
          {page === "free" && <FreePage onBack={back} onNavigate={navigate} />}
          {page === "daewoon" && <DaewoonPage onBack={back} />}
          {page === "taekil" && <TaekilPage onBack={back} />}
          {page === "pay" && <PayPage onBack={back} onNavigate={navigate} product={payProduct} />}
          {page === "auth" && <AuthPage onBack={back} mode={authMode}
            onSuccess={() => { showToast("환영해요!"); back(); }} />}
        </div>
        <Dock active={tab} onTab={navigate} />
        {toastNode}

        <TweaksPanel title="Tweaks">
          <TweakSection title="홈 화면">
            <TweakToggle label="캐릭터 표시" value={tweaks.showCharacter}
              onChange={(v) => setTweak("showCharacter", v)} />
            <TweakRadio label="메인 배너" value={tweaks.bannerVariant}
              options={[{ value: 0, label: "이번 주 띠" }, { value: 1, label: "오늘 한 줄" }, { value: 2, label: "별자리" }]}
              onChange={(v) => setTweak("bannerVariant", v)} />
            <TweakRadio label="홈 카드 레이아웃" value={tweaks.cardLayout}
              options={[{ value: "grid", label: "2열 카드" }, { value: "list", label: "리스트" }]}
              onChange={(v) => setTweak("cardLayout", v)} />
          </TweakSection>
          <TweakSection title="시각 톤">
            <TweakRadio label="핑크 강도" value={tweaks.pinkIntensity}
              options={[{ value: "soft", label: "절제" }, { value: "default", label: "기본" }, { value: "bold", label: "진하게" }]}
              onChange={(v) => setTweak("pinkIntensity", v)} />
            <TweakToggle label="시니어 모드 (큰 글자)" value={tweaks.senior}
              onChange={(v) => setTweak("senior", v)} />
          </TweakSection>
        </TweaksPanel>
      </div>
    </div>
  );
}

function AppHeader({ showToast, onLogin }) {
  return (
    <div className="app-header">
      <div className="brand">
        <div className="brand-mark"/>
        <div className="brand-name">달빛인생</div>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={() => showToast("알림 준비 중이에요")}>
          <Icon.Bell />
        </button>
        <button className="login-btn" onClick={onLogin}>로그인</button>
        <button className="icon-btn" onClick={() => showToast("메뉴 준비 중이에요")}>
          <Icon.Menu />
        </button>
      </div>
    </div>
  );
}

function Dock({ active, onTab }) {
  const items = [
    { k: "home", l: "홈", I: Icon.Home },
    { k: "addsaju", l: "사주추가", I: Icon.Plus },
    { k: "free", l: "무료운세", I: Icon.Sparkle, fab: true },
    { k: "chatroom", l: "대화방", I: Icon.Chat },
    { k: "vault", l: "보관함", I: Icon.Bookmark },
  ];
  return (
    <nav className="dock">
      {items.map(it => {
        if (it.fab) {
          return (
            <button key={it.k} className={`nav-item nav-fab ${active === it.k ? "active" : ""}`} onClick={() => onTab(it.k)}>
              <div className="fab"><it.I/></div>
              <div className="nav-label" style={{ marginTop: 4 }}>{it.l}</div>
            </button>
          );
        }
        return (
          <button key={it.k} className={`nav-item ${active === it.k ? "active" : ""}`} onClick={() => onTab(it.k)}>
            <it.I/>
            <div className="nav-label">{it.l}</div>
          </button>
        );
      })}
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
