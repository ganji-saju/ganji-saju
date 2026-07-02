// 카카오 알림톡 수신용 전화번호 + 광고(친구톡) 수신동의 카드. /my/settings 에 배치.
// GET /api/kakao/contact 로 현재값 로드, POST 로 저장. 서버가 번호 정규화/검증.
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function KakaoContactCard() {
  const [phone, setPhone] = useState('');
  const [adConsent, setAdConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/kakao/contact')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.ok) return;
        if (typeof d.phone === 'string') setPhone(d.phone);
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
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/kakao/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, adConsent }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) {
        toast.success('저장했어요');
        if (typeof d.phone === 'string' || d.phone === null) setPhone(d.phone ?? '');
        setAdConsent(Boolean(d.adConsent));
      } else if (d?.error === 'invalid_phone') {
        toast.error('휴대폰 번호 형식을 확인해 주세요 (010-0000-0000)');
      } else if (res.status === 401) {
        toast.error('로그인이 필요해요');
      } else {
        toast.error('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      }
    } catch {
      toast.error('저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className="mt-2 rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
        카카오 알림 받기
      </div>
      <p
        className="mt-1 text-[13.8px] leading-[1.6] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        휴대폰 번호를 등록하면 결제 완료·구독 만료 안내를 카카오 알림톡으로 받을 수 있어요.
      </p>

      <label className="mt-3 block text-[12.6px] font-bold text-[var(--app-copy)]" htmlFor="kakao-phone">
        휴대폰 번호
      </label>
      <input
        id="kakao-phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="010-0000-0000"
        value={phone}
        disabled={!ready || saving}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-1 w-full rounded-[10px] border px-3 py-2.5 text-[15px] text-[var(--app-ink)]"
        style={{ borderColor: 'var(--app-line)' }}
      />

      <label className="mt-3 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={adConsent}
          disabled={!ready || saving}
          onChange={(e) => setAdConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span
          className="text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          (선택) 오늘의 운세·이벤트 등 광고성 정보 수신에 동의합니다. 동의는 언제든 여기서 해제할 수 있어요.
        </span>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={!ready || saving}
        className="mt-3 w-full rounded-[10px] px-3 py-2.5 text-[15px] font-extrabold text-white disabled:opacity-60"
        style={{ background: 'var(--app-pink-strong)' }}
      >
        저장
      </button>
    </article>
  );
}
