// 2026-06-07 — 사주 종합점수 블러-락 게이트(단일 언락, score-total). 가격은 리졸버 렌더.
//   해제: children(SajuScoreCard+ScoreBreakdownCard) 그대로.
//   잠금: ⚠️ children 을 렌더하지 않는다(실제 숫자가 DOM 에 남지 않도록 — #311 교훈).
//        등급명 + 장식 블러 스켈레톤(가짜 형태, 숫자 없음) + 중앙 결제 CTA 만.
//   서버 컴포넌트: 잠금 분기가 서버에서 결정되어 민감값(총점/요소 숫자)이 번들에 미포함.
import type { ReactNode } from 'react';
import { ComparePrice, Price } from '@/components/payments/price-provider';
import { StickyBottomBar } from '@/components/ui/sticky-bottom-bar';

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
      {/* 장식 블러 스켈레톤 — 실제 점수/요소 숫자 없음(가짜 형태).
          2026-07-20 — 배경으로 내렸다(absolute). 예전엔 스켈레톤이 흐름에 있고 결제 카드가
          absolute 라 **카드가 커지면 섹션 밖으로 잘렸다**(버튼을 아래 줄로 내리자 실제로 잘림).
          이제 카드가 높이를 정하고 스켈레톤이 그 뒤를 채운다 — 카피가 길어져도 안 깨진다. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden p-6 blur-[3px]"
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

      {/* 중앙 결제 카드 — 이 요소가 섹션 높이를 결정한다. */}
      <div className="relative z-20 grid place-items-center">
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
          {/* 2026-07-20 — 취소선·가격·버튼을 한 줄에 넣었더니 좁은 화면(max-w-xs=320px)에서
              "9,90/0원", "점수/공개하고/보기" 처럼 글자가 쪼개졌다(사용자 제보).
              → 가격 줄과 버튼 줄을 분리하고, 가격은 nowrap 으로 묶어 절대 안 깨지게 한다. */}
          <div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
            {/* compareAt 을 카탈로그에만 넣고 렌더를 안 붙이면 "할인"이 화면에 전달되지 않는다.
                price prop 이 명시로 넘어오면 호출부가 표시를 통제하는 것이라 취소선을 붙이지 않는다. */}
            {price ? null : (
              <ComparePrice
                priceKey="taste_score_total"
                className="whitespace-nowrap text-[13.2px] font-bold text-[var(--app-copy-soft)] line-through"
              />
            )}
            <span className="whitespace-nowrap rounded-[10px] bg-[var(--app-pink-soft)] px-3 py-1 text-[17px] font-extrabold text-[var(--app-pink-strong)]">
              {price ?? <Price priceKey="taste_score_total" />}
            </span>
          </div>
          <a
            href={checkoutHref}
            className="mt-3 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-[12px] bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            점수 공개하고 보기
          </a>
          <p className="mt-3 text-[15px] text-[var(--app-copy-soft)]">
            결제 후 보관함에서 다시 볼 수 있어요
          </p>
        </div>
      </div>

      {/* 2026-07-20 — 결제 CTA 를 화면 하단에 상시 노출(사용자 요청).
          위 카드는 "무엇이 잠겼는지" 설명이고, 이 바는 스크롤 어디서든 결제로 갈 수 있는 경로다.
          ⚠️ 그냥 `fixed` 를 쓰면 안 된다 — 상위 page-transition 의 transform 이 containing block
          을 가로채 콘텐츠 끝에 붙는다. StickyBottomBar 가 body portal + dock 높이 실측을 처리한다
          (배경: 메모리 project_fixed-cta-needs-body-portal).
          ScoreLockGate 는 사주 결과 화면 1곳에서만 쓰여 바가 중복되지 않는다(전수 확인). */}
      <StickyBottomBar
            variant="above-dock"
            revealOn="scroll-down"
            innerClassName="flex items-center gap-3"
          >
        <span className="flex min-w-0 shrink-0 items-baseline gap-1.5">
          {price ? null : (
            <ComparePrice
              priceKey="taste_score_total"
              className="whitespace-nowrap text-[12.6px] font-bold text-[var(--app-copy-soft)] line-through"
            />
          )}
          <span className="whitespace-nowrap text-[17px] font-extrabold text-[var(--app-pink-strong)]">
            {price ?? <Price priceKey="taste_score_total" />}
          </span>
        </span>
        <a
          href={checkoutHref}
          className="inline-flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-[12px] bg-[var(--app-pink)] px-4 text-[16.1px] font-extrabold text-white shadow-[0_10px_24px_rgba(216,27,114,0.30)]"
        >
          점수 공개하고 보기
        </a>
      </StickyBottomBar>
    </section>
  );
}
