// 2026-05-15 PR-M: TermsConsentModal showcase client wrapper.
'use client';

import { useState } from 'react';
import { TermsConsentModal } from '@/components/notifications/terms-consent-modal';

const SAMPLE_ITEMS = [
  { id: 'service', label: '서비스 이용약관', required: true, href: '/terms' },
  { id: 'privacy', label: '개인정보 처리방침', required: true, href: '/privacy' },
  { id: 'marketing', label: '마케팅 정보 수신', required: false },
];

export function TermsModalShowcaseClient() {
  const [open, setOpen] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  return (
    <>
      <div
        className="rounded-[18px] border bg-white p-5"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          trigger
        </div>
        <h2
          className="mt-1 text-[19.5px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          약관 동의 모달 미리보기
        </h2>
        <p
          className="mt-1.5 text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          전체 동의 row + 3 항목(서비스/개인정보/마케팅 — 마케팅만 선택). 필수 둘이 모두 체크되어야 "동의하고 계속" 활성화.
        </p>

        <button
          type="button"
          onClick={() => {
            setLastEvent(null);
            setOpen(true);
          }}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--app-pink)] px-5 text-[15.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
        >
          모달 열기
        </button>

        {lastEvent ? (
          <div
            className="mt-3 rounded-[10px] border px-3 py-2 text-[13.2px] leading-[1.55]"
            style={{
              borderColor: 'var(--app-pink-line)',
              background: 'var(--app-pink-soft)',
              color: 'var(--app-pink-strong)',
            }}
          >
            마지막 이벤트: <code>{lastEvent}</code>
          </div>
        ) : null}
      </div>

      <TermsConsentModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(consents) => {
          setOpen(false);
          setLastEvent(`confirmed · ${JSON.stringify(consents)}`);
        }}
        items={SAMPLE_ITEMS}
      />
    </>
  );
}
