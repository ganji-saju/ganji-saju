// 2026-07-06 — 자체 쿠키/분석 동의 배너.
//   첫 방문(미선택) 시 하단에 노출. 동의→Consent Mode granted, 거부→denied(둘 다 저장해
//   재노출 안 함). GA4/GTM 은 layout 에서 기본 denied 로 로드되므로, 이 선택 전까지는
//   쿠키·식별자 없이 익명 상태다.
//
// 2026-07-20 — 하단 고정(StickyBottomBar above-dock) → **최상단 인플로우**로 전환(사용자 요청).
//   이유 둘: ① 결제 CTA 들이 같은 above-dock 자리를 쓰기 시작해 **서로 겹쳤다**
//   (사주 점수·대운·택일·궁합 결제 바). 하단은 매출 경로에 양보한다.
//   ② 고정 배너는 선택 전까지 콘텐츠를 계속 가리는데, 인플로우면 선택하는 순간
//   그 공간이 통째로 사라져 화면이 원래대로 돌아온다(사용자 표현: "해당 공간이 사라지도록").
//   ⚠️ 인플로우라 body portal 이 필요 없다 — 조상 transform 문제도 애초에 발생하지 않는다.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
    <div
      className="border-b bg-[var(--app-bg,#fff)] px-4 py-2.5"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="mx-auto flex max-w-[34rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* 2026-07-20 — 문구·글씨 축소(사용자 요청). ⚠️ 법적 고지라 **의미 요소 4개는 유지**한다:
          ① 쿠키를 쓴다 ② 목적(분석·마케팅) ③ 제3자(Google Analytics) ④ 거부해도 이용 가능.
          더 줄이려면 이 중 무엇을 뺄지 먼저 정할 것 — 길이만 보고 자르면 고지 의무가 깨진다. */}
      <p
        className="text-[12.6px] leading-[1.55] text-[var(--app-copy-soft)]"
        role="region"
        aria-label="쿠키 동의"
      >
        서비스 개선을 위해 분석·마케팅 쿠키(Google Analytics 등)를 사용합니다. 거부해도 이용에
        지장 없어요.{' '}
        <Link href="/privacy" className="font-semibold text-[var(--app-ink)] underline">
          개인정보처리방침
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => choose('denied')}
          className="rounded-[10px] border border-[var(--app-line)] px-3.5 py-2 text-[13.2px] font-bold text-[var(--app-copy-soft)] hover:bg-[var(--app-line)]/30"
        >
          거부
        </button>
        <button
          type="button"
          onClick={() => choose('granted')}
          className="rounded-[10px] bg-[var(--app-ink)] px-3.5 py-2 text-[13.2px] font-bold text-white hover:opacity-90"
        >
          동의
        </button>
      </div>
      </div>
    </div>
  );
}
