// 2026-08-24 전면 개편 Phase 1 — 종합사주 리포트(bundle_comprehensive) 17항목 목차 업셀.
//   만신령 벤치마크의 "무료 ✓ + 잠금 🔒 리스트" 구조: "결과가 얼마나 자세하지?"에
//   말이 아니라 목차로 답한다(수정요청 PPT 1차 의문 ③④).
//
//   ⚠️ 정직성 계약: 아래 17항목은 전부 **실존 화면·콘텐츠**에 1:1 매핑된다.
//     무료 4 = overview/nature/elements/deep 무료 챕터.
//     잠김 13 = score-total(종합점수+F1~F5) 6개 + today-detail 실섹션 4개
//       (ScoreReveal·IljinBreakdown·CategoryReadings·LuckyPackage) + money-pattern ·
//       work-flow · year-core. 없는 콘텐츠를 항목으로 약속하면 안 된다 —
//       comprehensive-toc.test.ts 가 개수(4+13=17)와 구성 상품 정합을 고정한다.
//
//   순수 표시 컴포넌트(server). 노출 계측은 페이지가 after()로 logPaywallImpression.

import Link from 'next/link';
import {
  COMPREHENSIVE_FREE_ITEMS,
  COMPREHENSIVE_LOCKED_ITEMS,
} from './comprehensive-toc-items';

export interface ComprehensiveTocProps {
  slug: string;
  /** 개인화 훅 — 예: "다음 대운 전환은 49세". null 이면 훅 줄 생략. */
  hookLine?: string | null;
  /** 현재가 라벨(예: '9,900원') — 페이지가 priceLabelFromMap 으로 계산해 전달(리졸버 반영). */
  priceLabel: string;
  /** 취소선 라벨(예: '33,000원') — compareLabelFromMap. null 이면 취소선 줄 생략. */
  compareLabel?: string | null;
  className?: string;
}


export function ComprehensiveToc({ slug, hookLine, priceLabel, compareLabel, className = '' }: ComprehensiveTocProps) {
  const checkoutHref = `/membership/checkout?product=bundle_comprehensive&slug=${encodeURIComponent(
    slug
  )}&from=saju-toc`;

  return (
    <section
      aria-label="종합사주 리포트 안내"
      className={`rounded-[20px] border border-[var(--app-line)] bg-white p-5 ${className}`.trim()}
    >
      <p className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        종합사주 리포트
      </p>
      <h2 className="mt-1 text-[20.7px] font-extrabold leading-snug text-[var(--app-ink)]">
        무료 분석에서 보신 건 17항목 중 4개예요
      </h2>

      <ul className="m-0 mt-4 grid list-none gap-1.5 p-0">
        {COMPREHENSIVE_FREE_ITEMS.map((item) => (
          <li
            key={item.title}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--app-line)] bg-white px-3.5 py-2.5"
          >
            <span className="min-w-0">
              <span className="block text-[15.2px] font-extrabold text-[var(--app-ink)]">
                {item.title}
              </span>
              <span className="block text-[12.8px] text-[var(--app-copy-soft)]">{item.desc}</span>
            </span>
            <span className="shrink-0 text-[12.8px] font-extrabold text-[var(--app-jade)]">
              확인 완료 ✓
            </span>
          </li>
        ))}
        {COMPREHENSIVE_LOCKED_ITEMS.map((item) => (
          <li
            key={item.title}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--app-line)] px-3.5 py-2.5"
            style={{ background: 'var(--app-pink-soft)' }}
          >
            <span className="min-w-0">
              <span className="block text-[15.2px] font-extrabold text-[var(--app-ink)]">
                {item.title}
              </span>
              <span className="block text-[12.8px] text-[var(--app-copy-soft)]">{item.desc}</span>
            </span>
            <span aria-label="잠김" className="shrink-0 text-[15px]">
              🔒
            </span>
          </li>
        ))}
      </ul>

      {hookLine ? (
        <p className="mt-4 rounded-[12px] bg-[var(--app-ink)] px-4 py-3 text-center text-[15.2px] font-bold leading-relaxed text-white">
          {hookLine}
        </p>
      ) : null}

      <div className="mt-4 text-center">
        <p className="text-[13.5px] text-[var(--app-copy-soft)]">
          출시 기념가
          {compareLabel ? (
            <>
              {' '}
              <span className="font-bold line-through">{compareLabel}</span>
            </>
          ) : null}
        </p>
        <Link
          href={checkoutHref}
          className="mt-2 inline-flex w-full items-center justify-center rounded-[14px] bg-[var(--app-pink)] px-5 py-3.5 text-[17.3px] font-extrabold text-white"
        >
          {priceLabel}으로 잠긴 13항목 열기
        </Link>
        <p className="mt-2 text-[12.8px] text-[var(--app-copy-soft)]">
          열람 전엔 전액 환불 · 이미 구매한 항목은 중복 결제하지 않아요
        </p>
      </div>
    </section>
  );
}
