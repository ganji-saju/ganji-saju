// 2026-05-20 Phase 8-E — 무료 SEO 콘텐츠 페이지 → 유료 상품 funnel (DRY).
//   Phase 8-B/C/D 에서 별자리/띠/꿈해몽 detail 의 마지막 CTA section 에 inline 으로
//   사주 + 궁합 link grid 가 추가됐는데, 동일 패턴을
//   today-fortune / tarot result 페이지에도 적용하면서 컴포넌트로 추출.
//
//   from 매개변수로 UTM 식별 (?from=star-sign | zodiac | dream | today-fortune | tarot).
//   tone variant 로 dark surface (별자리/띠) 와 light surface (꿈/오늘운세) 모두 지원.
//
// 2026-07-18 — 텍스트 리스트 → **썸네일 + 질문형 카피** 리스트로 교체
//   (20260718 PPTX slide9 "하단 메뉴가 헷갈림. 다른 메뉴처럼 보임, 텍스트 보다는 이미지").
//   기존 형태(작은 글씨 2줄 + 가격 pill)가 결과 페이지 하단에서 전역 내비게이션처럼 보여
//   "추천 상품"으로 읽히지 않았다. 인물 썸네일로 시각적 무게를 주고, 카피를 상품명이 아니라
//   **사용자가 품는 질문**("우리 사이는 몇점?")으로 바꿔 클릭 동기를 만든다.
//   가격 pill 은 시안대로 제거 — 여기서는 흥미 유발만 하고 금액은 각 상품 페이지에서 본다.
//   ⚠️ 이 파일 경로는 public-commercialization-copy.test.ts 의 정직성 스캔 대상이라 유지.

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface PaidFunnelGridProps {
  /** UTM source identifier — analytics 추적용 (?from={from}). */
  from: 'star-sign' | 'zodiac' | 'dream' | 'today-fortune' | 'tarot' | string;
  /**
   * 'dark' = 다크 배경 위 (별자리/띠 마지막 CTA section 안 — border white/16, bg white/8)
   * 'light' = 일반 라이트 배경 (꿈해몽/오늘운세 본문 — border var(--app-line))
   */
  tone?: 'dark' | 'light';
  /** 멤버십 link 도 함께 노출. 기본 false. */
  includeMembership?: boolean;
  /**
   * 섹션 제목. 기본 '이런 운세는 어때요?'.
   * false 면 제목 없이 리스트만 — 이미 자체 제목이 있는 CTA article 안(별자리/띠)에서 사용.
   */
  heading?: string | false;
  /** 추가 className (margin 등). */
  className?: string;
}

// 카피는 "상품 설명"이 아니라 "사용자가 품는 질문". 이미지는 홈 카드와 같은
//   /images/gangi/people 자산을 재사용해 메뉴 인지가 홈과 이어지게 한다.
// NOTE: 시안에는 '연도별 운세' 행도 있으나 우리 앱에는 해당 기능/라우트가 없다(대운의
//   year-core 와 동일 상품). 없는 메뉴를 만들지 않기 위해 제외 — 별도 상품이 생기면 추가.
// 2026-07-19 — `label`(메뉴 이름) 추가. 사용자 제보: "인물 사진 아래 사주·궁합·대운·택일·타로
//   같은 제목이 안 나와". 질문형 카피만으로는 그 행이 **어느 메뉴로 가는지** 알 수 없었다
//   ("우리 사이는 몇점?" → 궁합임을 추측해야 함). 카피는 클릭 동기라 그대로 두고,
//   식별용 메뉴 이름을 썸네일 아래에 별도로 붙인다(질문형 카피 ↔ 메뉴 식별, 역할 분리).
const ITEMS: ReadonlyArray<{
  key: string;
  href: string;
  image: string;
  /** 썸네일 아래 표기하는 메뉴 이름 — 홈 카드 제목과 동일 어휘. */
  label: string;
  title: string;
  body: string;
}> = [
  {
    key: 'saju',
    href: '/saju/new',
    image: 'saju',
    label: '사주',
    title: '친구나 가족의 사주도 궁금하다면?',
    body: '결과를 공유해줄 수 있어요!',
  },
  {
    key: 'gunghap',
    href: '/compatibility/input',
    image: 'gunghap',
    label: '궁합',
    title: '우리 사이는 몇점?',
    body: 'SNS에서 소문난 궁합 맛집',
  },
  {
    key: 'daewoon',
    href: '/daewoon',
    image: 'daewoon',
    label: '대운',
    title: '대운을 아직 모르신다구요?',
    body: '언제 물 들어오는지 한번 확인해보자구요',
  },
  {
    key: 'taekil',
    href: '/taekil',
    image: 'taekil',
    label: '택일',
    title: '중요한 일일수록 좋은 날에!',
    body: 'Top 3 길일을 골라드려요',
  },
  {
    key: 'tarot',
    href: '/tarot/daily',
    image: 'tarot',
    label: '타로',
    title: '지금 이 고민, 카드는 뭐라고 할까?',
    body: '3장으로 보는 오늘의 흐름',
  },
];

const MEMBERSHIP_ITEM = {
  key: 'membership',
  href: '/membership',
  image: 'consult',
  label: '멤버십',
  title: '매일 물어보고 싶다면?',
  body: '멤버십으로 선생님과 계속 이어서 대화해요',
};

export function PaidFunnelGrid({
  from,
  tone = 'light',
  includeMembership = false,
  heading = '이런 운세는 어때요?',
  className = '',
}: PaidFunnelGridProps) {
  // 보고 있는 메뉴 자신은 목록에서 뺀다 — 타로 결과에서 "타로 보러가기"를 권하는 꼴을 막는다.
  //   그래서 `from` 은 UTM 값이면서 동시에 **자기 식별자**다(item.key 와 같은 어휘를 쓸 것).
  const base = ITEMS.filter((item) => item.key !== from);
  const visibleItems = includeMembership ? [...base, MEMBERSHIP_ITEM] : base;

  const dark = tone === 'dark';
  const rowStyle: React.CSSProperties = dark
    ? { borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)' }
    : { borderColor: 'var(--app-line)', background: '#ffffff' };
  const titleColor = dark ? '#fff' : 'var(--app-ink)';
  const bodyColor = dark ? 'rgba(255,255,255,0.72)' : 'var(--app-copy-soft)';

  return (
    <section className={className.trim()} aria-label="추천 운세">
      {heading === false ? null : (
        <h2
          className="px-1 text-[17.3px] font-extrabold"
          style={{ color: titleColor }}
        >
          {heading}
        </h2>
      )}
      <div className={heading === false ? 'grid gap-2' : 'mt-2.5 grid gap-2'}>
        {visibleItems.map((item) => (
          <Link
            key={item.key}
            href={`${item.href}?from=${from}`}
            className="flex items-center gap-3 rounded-[16px] border p-2.5 no-underline"
            style={rowStyle}
          >
            {/* 썸네일 + 그 아래 메뉴 이름. 홈 카드와 동일 자산·동일 어휘라 인지가 이어진다.
                object-top 으로 인물 얼굴이 잘리지 않게. */}
            <span className="flex shrink-0 flex-col items-center gap-1">
              <picture>
                <source srcSet={`/images/gangi/people/${item.image}.avif`} type="image/avif" />
                <source srcSet={`/images/gangi/people/${item.image}.webp`} type="image/webp" />
                <img
                  src={`/images/gangi/people/${item.image}.png`}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 rounded-[12px] object-cover object-top"
                  style={{ background: dark ? 'rgba(255,255,255,0.10)' : 'var(--app-pink-soft)' }}
                />
              </picture>
              <span
                className="block text-[12.4px] font-extrabold leading-none tracking-tight"
                style={{ color: titleColor }}
              >
                {item.label}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[15.2px] font-extrabold leading-[1.35] tracking-tight"
                style={{ color: titleColor }}
              >
                {item.title}
              </span>
              <span
                className="mt-0.5 block text-[13.2px] leading-[1.45]"
                style={{ color: bodyColor }}
              >
                {item.body}
              </span>
            </span>
            <ChevronRight
              className="h-5 w-5 shrink-0"
              style={{ color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(17,17,20,0.4)' }}
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
