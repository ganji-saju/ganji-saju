// 결제 + 회원가입/로그인

function PayPage({ onBack, onNavigate, product }) {
  const [step, setStep] = React.useState("review"); // review | method | processing | done
  const [method, setMethod] = React.useState("card");

  const p = product || { title: "오늘 자세히 보기", price: 550, desc: "시간대별 흐름과 조심할 시각" };

  const proceed = () => {
    setStep("processing");
    setTimeout(() => setStep("done"), 1600);
  };

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title="결제" onBack={step === "review" ? onBack : () => setStep("review")} />

      {step === "review" && (
        <div className="page" style={{ padding: "24px 20px 40px" }}>
          <div className="rise card" style={{ padding: "20px 22px",
            background: "linear-gradient(135deg, #fff0f7, #fff)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-strong)", letterSpacing: "0.06em" }}>
              구매할 풀이
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 800, marginTop: 6 }}>
              {p.title}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 6 }}>{p.desc}</div>
            <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 800, color: "var(--pink-strong)" }}>{p.price}</span>
              <span style={{ fontSize: 14, color: "var(--ink-64)" }}>원</span>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 10 }}>결제 수단</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { k: "card", l: "신용/체크카드", sub: "한 번에 결제" },
                { k: "kakao", l: "카카오페이", sub: "간편결제", c: "#fee500" },
                { k: "naver", l: "네이버페이", sub: "포인트 사용 가능", c: "#03c75a" },
                { k: "bank", l: "계좌이체", sub: "실시간 이체" },
              ].map(m => (
                <button key={m.k} onClick={() => setMethod(m.k)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  background: "#fff",
                  border: method === m.k ? "1.5px solid var(--pink)" : "1px solid var(--line)",
                  borderRadius: 14, textAlign: "left",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: m.c || "var(--bg-soft)",
                    display: "grid", placeItems: "center",
                    fontSize: 11, fontWeight: 800,
                    color: m.c ? "#000" : "var(--ink-64)",
                  }}>
                    {m.k === "card" ? <Icon.Wallet style={{width:18,height:18}}/>
                    : m.k === "kakao" ? "K"
                    : m.k === "naver" ? "N"
                    : "₩"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{m.l}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-64)" }}>{m.sub}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: method === m.k ? "6px solid var(--pink)" : "1.5px solid var(--line)",
                    background: "#fff",
                  }}/>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, padding: "12px 14px", background: "#fafafb",
            borderRadius: 12, fontSize: 12, color: "var(--ink-64)", lineHeight: 1.6 }}>
            구매한 풀이는 보관함에서 언제든 다시 볼 수 있어요.
            결제 즉시 풀이가 열립니다.
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 24, height: 56, fontSize: 16 }}
            onClick={proceed}>
            {p.price.toLocaleString()}원 결제하기
          </button>
        </div>
      )}

      {step === "processing" && (
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto",
            border: "3px solid var(--line)",
            borderTop: "3px solid var(--pink)",
            borderRadius: "50%",
            animation: "spin-slow 1s linear infinite",
          }}/>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 24 }}>결제를 진행하고 있어요…</div>
          <div style={{ fontSize: 12, color: "var(--ink-64)", marginTop: 6 }}>창을 닫지 말고 잠시만 기다려주세요</div>
        </div>
      )}

      {step === "done" && (
        <div className="page" style={{ padding: "60px 20px 40px", textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--pink), var(--pink-strong))",
            display: "grid", placeItems: "center", color: "#fff",
            animation: "pop 500ms cubic-bezier(0.2,0.8,0.2,1) both",
            boxShadow: "0 12px 30px -10px rgba(216,27,114,0.4)",
          }}>
            <Icon.Check style={{ width: 40, height: 40, strokeWidth: 3 }}/>
          </div>
          <div className="rise" style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, marginTop: 24 }}>
            결제가 완료됐어요
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-64)", marginTop: 8 }}>
            {p.title} 풀이를 바로 열어드릴게요.
          </div>

          <div className="rise card" style={{ marginTop: 28, padding: "16px",
            textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10,
              background: "var(--pink-soft)", color: "var(--pink-strong)",
              display: "grid", placeItems: "center" }}>
              <Icon.Wallet style={{ width: 18, height: 18 }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--ink-64)" }}>결제 금액</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{p.price.toLocaleString()}원</div>
            </div>
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 24 }}
            onClick={() => onNavigate("vault")}>
            풀이 열어보기
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onBack}>
            홈으로
          </button>
        </div>
      )}
    </div>
  );
}

function AuthPage({ onBack, mode = "login", onSwitch, onSuccess }) {
  const [m, setM] = React.useState(mode);
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [step, setStep] = React.useState("phone");
  const [agree, setAgree] = React.useState({ all: false, terms: false, privacy: false, marketing: false });

  const submit = () => {
    setStep("processing");
    setTimeout(() => onSuccess && onSuccess(), 1200);
  };

  const sendCode = () => {
    if (phone.length < 10) return;
    setStep("code");
  };

  return (
    <div className="page" style={{ minHeight: "100%" }}>
      <PageHeader title={m === "login" ? "로그인" : "회원가입"} onBack={onBack} />

      {step === "phone" && (
        <div className="page" style={{ padding: "32px 20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #fff8d9 0%, #ffd479 45%, #f5b740 100%)",
              boxShadow: "0 8px 24px -10px rgba(245, 183, 64, 0.5)",
              animation: "float-y 3.6s ease-in-out infinite",
            }}/>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35, textAlign: "center" }}>
            {m === "login" ? "다시 만나서 반가워요" : "달빛인생에 오신 걸\n환영해요"}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8, textAlign: "center" }}>
            휴대폰 번호로 {m === "login" ? "로그인" : "가입"}해요.
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>휴대폰 번호</div>
            <NumField placeholder="01012345678" value={phone} onChange={setPhone} maxLength={11} />
          </div>

          <button className="btn btn-pink btn-block" style={{ marginTop: 24, height: 52 }}
            onClick={sendCode} disabled={phone.length < 10}>
            인증번호 받기
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "28px 0 18px" }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
            <span style={{ fontSize: 12, color: "var(--ink-44)" }}>또는</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }}/>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button style={{
              height: 52, borderRadius: 12, border: 0,
              background: "#fee500", color: "#1a1a1a",
              fontWeight: 700, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>카카오로 시작</button>
            <button style={{
              height: 52, borderRadius: 12, border: "1px solid var(--line)",
              background: "#fff", color: "var(--ink)",
              fontWeight: 700, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>Apple로 시작</button>
          </div>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--ink-64)" }}>
            {m === "login" ? "아직 회원이 아니라면" : "이미 가입했다면"}
            <button onClick={() => setM(m === "login" ? "signup" : "login")}
              style={{ background: "transparent", border: 0, color: "var(--pink-strong)",
                fontWeight: 700, fontSize: 13, marginLeft: 4 }}>
              {m === "login" ? "회원가입" : "로그인"}
            </button>
          </div>
        </div>
      )}

      {step === "code" && (
        <div className="page" style={{ padding: "32px 20px 40px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, lineHeight: 1.35 }}>
            인증번호를 입력해주세요
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-64)", marginTop: 8 }}>
            {phone.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-$2-$3")}로 보냈어요
          </div>
          <div style={{ marginTop: 28 }}>
            <NumField placeholder="6자리 숫자" value={code} onChange={setCode} maxLength={6} />
          </div>
          <button onClick={() => setStep("processing")} style={{ background: "transparent", border: 0,
            color: "var(--pink-strong)", fontSize: 13, fontWeight: 700, marginTop: 12 }}>
            인증번호 다시 받기
          </button>

          {m === "signup" && (
            <>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-64)", marginBottom: 8 }}>이름</div>
                <SimpleInput value={name} onChange={setName} placeholder="이름을 입력해주세요" />
              </div>

              <div style={{ marginTop: 24, padding: "16px",
                background: "#fafafb", borderRadius: 14, border: "1px solid var(--line)" }}>
                <Check label="모두 동의합니다" checked={agree.all}
                  onChange={(v) => setAgree({ all: v, terms: v, privacy: v, marketing: v })} bold />
                <div style={{ height: 1, background: "var(--line)", margin: "10px 0" }}/>
                <Check label="(필수) 이용약관 동의" checked={agree.terms}
                  onChange={(v) => setAgree(a => ({ ...a, terms: v }))} />
                <Check label="(필수) 개인정보 처리방침" checked={agree.privacy}
                  onChange={(v) => setAgree(a => ({ ...a, privacy: v }))} />
                <Check label="(선택) 마케팅 알림 수신" checked={agree.marketing}
                  onChange={(v) => setAgree(a => ({ ...a, marketing: v }))} />
              </div>
            </>
          )}

          <button className="btn btn-pink btn-block" style={{ marginTop: 24, height: 52 }}
            onClick={submit}
            disabled={code.length < 4 || (m === "signup" && (!name || !agree.terms || !agree.privacy))}>
            {m === "login" ? "로그인" : "가입 완료"}
          </button>
        </div>
      )}

      {step === "processing" && (
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, margin: "0 auto",
            border: "3px solid var(--line)",
            borderTop: "3px solid var(--pink)",
            borderRadius: "50%",
            animation: "spin-slow 1s linear infinite",
          }}/>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 20 }}>잠시만 기다려주세요…</div>
        </div>
      )}
    </div>
  );
}

function Check({ label, checked, onChange, bold }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "6px 0",
      background: "transparent", border: 0, textAlign: "left",
      cursor: "pointer",
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: checked ? "var(--pink)" : "#fff",
        border: checked ? 0 : "1.5px solid var(--line-strong)",
        display: "grid", placeItems: "center",
        flexShrink: 0,
      }}>
        {checked && <Icon.Check style={{ width: 14, height: 14, color: "#fff" }}/>}
      </div>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600,
        color: bold ? "var(--ink)" : "var(--ink-64)" }}>{label}</span>
    </button>
  );
}

window.PayPage = PayPage;
window.AuthPage = AuthPage;
