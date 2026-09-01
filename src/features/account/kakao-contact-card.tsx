// 카카오 알림톡 수신용 전화번호 + 광고(친구톡) 수신동의 카드. /my/settings 에 배치.
// GET /api/kakao/contact 로 현재값 로드, POST 로 저장. 서버가 번호 정규화/검증.
//
// 🔴 2026-09-01 — 이 카드는 "번호를 등록하면 결제 완료·구독 만료 안내를 알림톡으로 받을 수
//   있어요" 라고 약속하고 **34명에게서 휴대폰 번호를 받아뒀는데**, 프로덕션
//   `kakao_message_log` 는 **0행**이었다(실결제 35건이 있었는데도). 발송 트리거가
//   `if (kakaoConfig.templates.paymentComplete)` 로 게이트돼 있어 템플릿 코드가 없으면
//   호출조차 안 된다 — 즉 한 건도 나간 적이 없다.
//   그래서 발송 가능 여부(sendingLive)를 서버에서 받아, 불가능하면 **약속을 하지 않고
//   신규 수집도 멈춘다**. 이미 등록한 사람에게는 지울 수 있게 폼을 남긴다.
//   env(SOLAPI_* + KAKAO_TPL_*)를 채우면 자동으로 원래 문구로 돌아온다.
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KakaoChannelAddButton } from '@/features/account/kakao-channel-add-button';

interface KakaoContactCardProps {
  /** 알림톡 발송이 실제로 가능한 상태인지(서버 판정: Solapi 키 + 승인 템플릿 코드). */
  sendingLive: boolean;
}

export function KakaoContactCard({ sendingLive }: KakaoContactCardProps) {
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

  // 발송이 불가능한데 등록된 번호도 없으면 카드 자체를 띄우지 않는다 —
  //   못 지키는 약속으로 개인정보를 더 받지 않는다. (로드 전에도 깜빡임 없이 숨긴다.)
  if (!sendingLive && (!ready || !phone)) return null;

  return (
    <article
      id="kakao-contact"
      className="mt-2 rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
        {sendingLive ? '카카오 알림 받기' : '등록된 휴대폰 번호'}
      </div>
      <p
        className="mt-1 text-[13.8px] leading-[1.6] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {sendingLive
          ? '휴대폰 번호를 등록하면 결제 완료·구독 만료 안내를 카카오 알림톡으로 받을 수 있어요.'
          : '카카오 알림톡 발송은 아직 준비 중이라, 지금은 이 번호로 아무것도 발송되지 않아요. 지우시려면 비운 뒤 저장해 주세요.'}
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

      {/* 광고(친구톡) 동의 — 발송이 살아 있을 때만 새로 받는다. 준비 중일 땐 이미 동의한
          사람의 해제 경로만 남긴다(동의는 언제든 뺄 수 있어야 한다). */}
      {sendingLive || adConsent ? (
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
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={!ready || saving}
        className="mt-3 w-full rounded-[10px] px-3 py-2.5 text-[15px] font-extrabold text-white disabled:opacity-60"
        style={{ background: 'var(--app-pink-strong)' }}
      >
        저장
      </button>

      {/* 친구톡(광고) 소식은 채널 친구에게만 도달 → 채널 추가 유도. 채널 ID 없으면 버튼 자체가
          렌더 안 됨. 발송이 준비 중이면 '소식 받기' 도 거짓말이라 감춘다. */}
      {sendingLive ? <KakaoChannelAddButton /> : null}
    </article>
  );
}
