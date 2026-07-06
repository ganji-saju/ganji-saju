// 2026-07-06 — 자체 쿠키/분석 동의 배너.
//   첫 방문(미선택) 시 하단에 노출. 동의→Consent Mode granted, 거부→denied(둘 다 저장해
//   재노출 안 함). GA4/GTM 은 layout 에서 기본 denied 로 로드되므로, 이 선택 전까지는
//   쿠키·식별자 없이 익명 상태다. 하단 고정은 StickyBottomBar(body portal — 조상 transform
//   에 안 막힘, 메모리 project_fixed-cta-needs-body-portal).
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StickyBottomBar } from '@/components/ui/sticky-bottom-bar';
import {
  applyConsent,
  readConsent,
  CONSENT_REOPEN_EVENT,
  type ConsentChoice,
} from './analytics-consent';

export function AnalyticsConsentBanner() {
  // 저장된 선택이 없을 때만 노출(SSR/최초엔 숨김 → 깜빡임 없음).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setVisible(true);
    // 푸터 '쿠키 설정'에서 재노출(이미 선택한 사용자의 재선택·철회 경로).
    const reopen = () => setVisible(true);
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const choose = (choice: ConsentChoice) => {
    applyConsent(choice);
    setVisible(false);
  };

  return (
    <StickyBottomBar
      variant="above-dock"
      className="z-50"
      innerClassName="max-w-[34rem] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p
        className="text-[12.5px] leading-relaxed text-[var(--app-copy-soft)]"
        role="region"
        aria-label="쿠키 동의"
      >
        간지사주는 서비스 개선과 방문 분석을 위해 쿠키 및 유사 기술을 사용합니다. 동의하시면
        Google Analytics 등 분석·마케팅 쿠키가 함께 사용되며, 거부하셔도 서비스 이용에는 지장이
        없습니다.{' '}
        <Link href="/privacy" className="font-semibold text-[var(--app-ink)] underline">
          개인정보처리방침
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => choose('denied')}
          className="rounded-[10px] border border-[var(--app-line)] px-4 py-2 text-[13px] font-bold text-[var(--app-copy-soft)] hover:bg-[var(--app-line)]/30"
        >
          거부
        </button>
        <button
          type="button"
          onClick={() => choose('granted')}
          className="rounded-[10px] bg-[var(--app-ink)] px-4 py-2 text-[13px] font-bold text-white hover:opacity-90"
        >
          동의
        </button>
      </div>
    </StickyBottomBar>
  );
}
