/**
 * <FeatureUnavailable /> — 출시 예정 / 점검 중 / 비활성 기능 안내 — Phase 5-A (2026-05-18).
 *
 * 사용자 directive: 실제 출시 예정 기능은 명확한 출시예정 컴포넌트로 분리,
 *   가격/결제 CTA 에서는 숨김. "준비 중", "TBD", "임시" 단순 표기 금지.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BUSINESS_INFO } from '@/lib/business-info';

interface FeatureUnavailableProps {
  /** 기능명 (예: "락스크린 위젯"). */
  featureName: string;
  /** 사유 — 'coming_soon' (출시 예정) | 'maintenance' (점검 중) | 'region_restricted' (지역 제한). */
  reason?: 'coming_soon' | 'maintenance' | 'region_restricted';
  /** 추가 안내 (선택). */
  detail?: string;
  /** 대체 경로 / CTA 영역. */
  alternate?: ReactNode;
  /** size — inline 한 줄, block 카드. */
  variant?: 'inline' | 'card';
}

const REASON_COPY: Record<NonNullable<FeatureUnavailableProps['reason']>, string> = {
  coming_soon: '곧 출시 예정인 기능입니다',
  maintenance: '일시 점검 중입니다',
  region_restricted: '현재 이용 지역에서는 지원하지 않는 기능입니다',
};

export function FeatureUnavailable({
  featureName,
  reason = 'coming_soon',
  detail,
  alternate,
  variant = 'card',
}: FeatureUnavailableProps) {
  if (variant === 'inline') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--app-copy-muted)]"
        data-feature-unavailable={reason}
      >
        <span aria-hidden="true">✦</span>
        <span>
          <strong className="font-bold text-[var(--app-copy)]">{featureName}</strong> ·{' '}
          {REASON_COPY[reason]}
        </span>
      </span>
    );
  }

  return (
    <section
      className="space-y-3 rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
      data-feature-unavailable={reason}
    >
      <header className="space-y-1">
        <h2 className="text-[14px] font-extrabold text-[var(--app-ink)]">{featureName}</h2>
        <p className="text-[12.5px] text-[var(--app-copy-muted)]">{REASON_COPY[reason]}</p>
      </header>
      {detail ? (
        <p
          className="text-[12.5px] leading-[1.7] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {detail}
        </p>
      ) : null}
      <footer className="flex flex-wrap gap-2 pt-1">
        {alternate}
        {BUSINESS_INFO.email ? (
          <a
            href={`mailto:${BUSINESS_INFO.email}?subject=${encodeURIComponent(`[기능 문의] ${featureName}`)}`}
            className="text-[11.5px] font-bold text-[var(--app-pink-strong)] underline"
          >
            문의하기
          </a>
        ) : null}
        <Link
          href="/legal"
          className="text-[11.5px] font-bold text-[var(--app-copy-muted)] underline"
        >
          정책 안내
        </Link>
      </footer>
    </section>
  );
}
