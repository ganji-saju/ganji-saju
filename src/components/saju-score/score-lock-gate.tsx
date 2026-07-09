// 2026-06-07 — 사주 종합점수 블러-락 게이트(단일 9,900원 언락, score-total).
//   해제: children(SajuScoreCard+ScoreBreakdownCard) 그대로.
//   잠금: ⚠️ children 을 렌더하지 않는다(실제 숫자가 DOM 에 남지 않도록 — #311 교훈).
//        등급명 + 장식 블러 스켈레톤(가짜 형태, 숫자 없음) + 중앙 결제 CTA 만.
//   서버 컴포넌트: 잠금 분기가 서버에서 결정되어 민감값(총점/요소 숫자)이 번들에 미포함.
import type { ReactNode } from 'react';
import { Price } from '@/components/payments/price-provider';

interface ScoreLockGateProps {
  isUnlocked: boolean;
  /** 현재 사주 결과 slug — 결제 scope 연결용. */
  slug: string;
  /** 잠금 시 노출할 등급명(예: '안정·양호'). 숫자는 노출하지 않음. */
  gradeLabel: string;
  /**
   * 2026-07-07 Phase 2 — 미전달 시 리졸버(admin product_prices)의 score-total 가격을 렌더.
   *   문자열을 넘기면 그대로 사용(레거시 호환).
   */
  price?: string;
  children: ReactNode;
}

export function ScoreLockGate({
  isUnlocked,
  slug,
  gradeLabel,
  price,
  children,
}: ScoreLockGateProps) {
  if (isUnlocked) return <>{children}</>;

  const checkoutHref = `/membership/checkout?product=score-total&slug=${encodeURIComponent(
    slug
  )}&from=saju-result`;

  return (
    <section
      aria-label="사주 점수 (잠금)"
      className="relative overflow-hidden rounded-2xl border bg-white p-6"
      style={{ borderColor: 'var(--app-line)' }}
    >
      {/* 장식 블러 스켈레톤 — 실제 점수/요소 숫자 없음(가짜 형태). */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[3px]"
      >
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-[6px]"
          style={{ borderColor: 'var(--app-pink-soft)' }}
        >
          <span className="text-4xl font-bold text-[var(--app-copy-soft)]">●●</span>
        </div>
        <p className="mt-3 text-center text-[15px] font-bold text-[var(--app-copy-soft)]">
          {gradeLabel}
        </p>
        <div className="mt-4 grid gap-2.5">
          {[68, 82, 74, 60, 88].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[var(--app-pink-soft)]" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 중앙 결제 오버레이 */}
      <div className="absolute inset-0 z-20 grid place-items-center p-5">
        <div
          className="w-full max-w-xs rounded-[22px] border bg-white/90 p-5 text-center backdrop-blur-sm shadow-[0_18px_48px_rgba(17,17,20,0.18)]"
          style={{ borderColor: 'var(--app-pink-line)' }}
        >
          <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            {gradeLabel} 등급
          </div>
          <h3
            className="mt-1 text-[20.7px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            내 사주 종합점수 공개
          </h3>
          <p
            className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            종합점수와 일주·격국·용신·오행·신살 5요소 산출 내역을 한 번에 열어 드려요.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2.5">
            <span className="rounded-full bg-[var(--app-pink-soft)] px-3 py-1.5 text-[15px] font-bold text-[var(--app-pink-strong)]">
              {price ?? <Price priceKey="taste_score_total" />}
            </span>
            <a
              href={checkoutHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              점수 공개하고 보기
            </a>
          </div>
          <p className="mt-3 text-[15px] text-[var(--app-copy-soft)]">
            결제 후 보관함에서 다시 볼 수 있어요
          </p>
        </div>
      </div>
    </section>
  );
}
