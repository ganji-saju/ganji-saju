// 결제 화면용 전화번호 수집(선택). 결제완료 알림톡(정보성) 도달률용.
// 기존 /api/kakao/contact 재사용. 광고동의(ad_consent)는 기존값을 보존해 덮어쓰지 않는다.
// 결제를 절대 막지 않음 — 번호 입력은 전적으로 선택.
'use client';

import { useEffect, useState } from 'react';

export function KakaoContactCheckoutField() {
  const [phone, setPhone] = useState('');
  const [adConsent, setAdConsent] = useState(false); // 기존값 보존용
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/kakao/contact')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.ok) return;
        if (typeof d.phone === 'string' && d.phone) setPhone(d.phone);
        setAdConsent(Boolean(d.adConsent));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!ready) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      setMsg(null);
      return; // 비어 있으면 저장 안 함(선택)
    }
    try {
      const res = await fetch('/api/kakao/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // adConsent 는 마이페이지에서 켠 값을 그대로 유지(결제화면이 덮어쓰지 않도록).
        body: JSON.stringify({ phone: trimmed, adConsent }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) setMsg({ ok: true, text: '결제 알림 번호가 저장됐어요' });
      else if (d?.error === 'invalid_phone')
        setMsg({ ok: false, text: '휴대폰 번호 형식을 확인해 주세요 (010-0000-0000)' });
      else if (res.status === 401) setMsg(null);
      else setMsg({ ok: false, text: '번호 저장에 실패했어요' });
    } catch {
      setMsg(null);
    }
  }

  return (
    <div
      className="rounded-[12px] border px-2.5 py-2.5"
      style={{ borderColor: 'var(--app-line)', background: 'var(--app-pink-soft)' }}
    >
      {/* 🔴 크기는 인라인으로만 준다. readability.css(@layer 밖)가 ① label·p 태그를 본문
          크기로 되돌리고 ② text-[12·13…] 로 시작하는 클래스를 !important 로 부양한다.
          클래스로 주면 조용히 17px 로 렌더된다(2026-09-09 실측). */}
      <label
        className="block font-bold text-[var(--app-ink)]"
        style={{ fontSize: '10px', lineHeight: 1.4 }}
        htmlFor="kakao-checkout-phone"
      >
        [선택] 카카오톡으로 결제 알림 받기
      </label>
      <p
        className="mt-0.5 text-[var(--app-copy-muted)]"
        style={{ fontSize: '9px', lineHeight: 1.45 }}
      >
        번호를 남기면 결제 완료·구독 만료 안내를 카카오 알림톡으로 받아요. 입력은 선택입니다.
      </p>
      <input
        id="kakao-checkout-phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="010-0000-0000"
        value={phone}
        disabled={!ready}
        onChange={(e) => setPhone(e.target.value)}
        onBlur={save}
        // ⚠️ 입력창 글자는 줄이지 않는다 — 16px 미만이면 iOS Safari 가 포커스 시 화면을
        //   자동 확대한다. 지금 17px(readability 부양)이라 안전하다. 높이만 줄인다.
        className="mt-1.5 w-full rounded-[10px] border bg-white px-2.5 py-1.5 text-[var(--app-ink)]"
        style={{ borderColor: 'var(--app-line)' }}
      />
      {msg ? (
        <p
          className="mt-1"
          style={{
            fontSize: '9px',
            lineHeight: 1.4,
            color: msg.ok ? 'var(--app-jade)' : 'var(--app-coral)',
          }}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
