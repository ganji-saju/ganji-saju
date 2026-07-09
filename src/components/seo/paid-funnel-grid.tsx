// 2026-05-20 Phase 8-E — 무료 SEO 콘텐츠 페이지 → 유료 상품 funnel grid (DRY).
//   Phase 8-B/C/D 에서 별자리/띠/꿈해몽 detail 의 마지막 CTA section 에 inline 으로
//   사주 (9,900원~) + 궁합 (990원) link grid 가 추가됐는데, 동일 패턴을
//   today-fortune / tarot result 페이지에도 적용하면서 컴포넌트로 추출.
//
//   from 매개변수로 UTM 식별 (?from=star-sign | zodiac | dream | today-fortune | tarot).
//   tone variant 로 dark surface (별자리/띠) 와 light surface (꿈/오늘운세) 모두 지원.

import Link from 'next/link';
import { Price } from '@/components/payments/price-provider';
import type { PriceKey } from '@/lib/payments/price-display-shared';

export interface PaidFunnelGridProps {
  /** UTM source identifier — analytics 추적용 (?from={from}). */
  from: 'star-sign' | 'zodiac' | 'dream' | 'today-fortune' | 'tarot' | string;
  /**
   * 'dark' = 다크 배경 위 (별자리/띠 마지막 CTA section 안 — border white/16, bg white/8)
   * 'light' = 일반 라이트 배경 (꿈해몽/오늘운세 본문 — border var(--app-line))
   */
  tone?: 'dark' | 'light';
  /** 멤버십 link 도 함께 노출. 기본 false (사주 + 궁합 2 grid). */
  includeMembership?: boolean;
  /** 추가 className (margin 등). */
  className?: string;
}

const ITEMS: ReadonlyArray<{
  key: string;
  href: string;
  eyebrow: string;
  body: string;
  price: string;
  priceKey?: PriceKey;
}> = [
  {
    key: 'saju',
    href: '/saju/new',
    eyebrow: '사주 상세 풀이',
    body: '14 섹션 · A4 5~7p 리포트',
    price: '9,900원',
    priceKey: 'saju_entry',
  },
  {
    key: 'gunghap',
    href: '/compatibility/input',
    eyebrow: '궁합 풀이',
    body: '두 사람 사주 결합 분석',
    price: '9,900원',
    priceKey: 'taste_love_question',
  },
  {
    key: 'membership',
    href: '/membership',
    eyebrow: '멤버십',
    body: '일 30회·월 120턴 공정사용',
    price: '월정액',
  },
];

export function PaidFunnelGrid({
  from,
  tone = 'light',
  includeMembership = false,
  className = '',
}: PaidFunnelGridProps) {
  const visibleItems = includeMembership ? ITEMS : ITEMS.slice(0, 2);
  const colsClass =
    visibleItems.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  // tone 별 스타일 — surface 와 일관성 유지.
  const cardStyle: React.CSSProperties =
    tone === 'dark'
      ? {
          borderColor: 'rgba(255,255,255,0.16)',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.90)',
        }
      : {
          borderColor: 'var(--app-line)',
          background: '#ffffff',
          color: 'var(--app-ink)',
        };
  const eyebrowColor =
    tone === 'dark' ? 'rgba(255,255,255,0.65)' : 'var(--app-copy-soft)';
  const bodyColor =
    tone === 'dark' ? 'rgba(255,255,255,0.90)' : 'var(--app-copy)';
  const pillStyle: React.CSSProperties =
    tone === 'dark'
      ? { background: 'rgba(236, 72, 153, 0.85)' }
      : { background: 'var(--app-pink)' };

  return (
    <div className={`grid gap-2 ${colsClass} ${className}`.trim()}>
      {visibleItems.map((item) => (
        <Link
          key={item.key}
          href={`${item.href}?from=${from}`}
          className="inline-flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-[13.8px] font-bold no-underline"
          style={cardStyle}
        >
          <span className="flex flex-col text-left">
            <span
              className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: eyebrowColor }}
            >
              {item.eyebrow}
            </span>
            <span className="mt-0.5" style={{ color: bodyColor }}>
              {item.body}
            </span>
          </span>
          <span
            className="ml-2 shrink-0 rounded-full px-2 py-1 text-[12.6px] font-extrabold text-white"
            style={pillStyle}
          >
            {item.priceKey ? <Price priceKey={item.priceKey} /> : item.price}
          </span>
        </Link>
      ))}
    </div>
  );
}
