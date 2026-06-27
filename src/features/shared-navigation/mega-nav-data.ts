// 2026-05-16 PR #155 — PC 메가 메뉴 데이터.
// 첨부 desktop.jsx MEGA_NAV 를 바탕으로 우리 실제 라우트에 맞춰 정리.

import type { ZodiacKey } from '@/components/gangi/zodiac-chip';

export interface MegaNavItem {
  label: string;
  desc: string;
  href: string;
  zodiac?: ZodiacKey;
  tag?: 'FREE' | 'VIP' | 'TOP' | string;
}

export interface MegaNavFeatured {
  title: string;
  description: string;
  cta: string;
  href: string;
}

export interface MegaNavGroup {
  /** 메뉴 라벨 (운세 / 사주 / 대화 / 멤버십). */
  label: string;
  /** href 가 있으면 simple 링크 (메가 패널 미노출). */
  simple?: boolean;
  href?: string;
  /** 메가 패널 c1 — 좌측 큰 grid (2열). */
  c1?: { heading: string; items: MegaNavItem[] };
  /** 메가 패널 c2 — 중간 list. */
  c2?: { heading: string; items: MegaNavItem[] };
  /** 메가 패널 c3 — 우측 featured 카드. */
  c3?: MegaNavFeatured;
}

export const MEGA_NAV: MegaNavGroup[] = [
  {
    label: '운세',
    c1: {
      heading: '무료 운세',
      items: [
        { label: '오늘운세 · 오늘소선생', desc: '지금 핵심 한 줄', href: '/today-fortune?concern=general', zodiac: 'rooster', tag: 'FREE' },
        { label: '타로 세 장 · 타로토선생', desc: '마음이 시키는 카드', href: '/tarot/daily', zodiac: 'rabbit', tag: 'FREE' },
        { label: '띠운세 · 엠지쥐선생', desc: '내 띠 오늘 흐름', href: '/zodiac', zodiac: 'horse', tag: 'FREE' },
        { label: '별자리 · 별닭선생', desc: '12자리 메시지', href: '/star-sign', zodiac: 'pig', tag: 'FREE' },
      ],
    },
    c2: {
      heading: '인기 운세',
      items: [
        { label: '꿈해몽 · 꿈뱀선생', desc: '한 단어 검색', href: '/dream' },
        { label: '12×12 별자리 궁합', desc: '한눈에 매트릭스', href: '/star-sign/compat' },
        { label: '좋은 날 · 길일말선생', desc: '큰 결정 D-day', href: '/taekil' },
      ],
    },
    c3: {
      title: '2026년 신년 운세',
      description: '올해의 흐름을 미리 받아보세요',
      cta: '무료로 시작',
      href: '/today-fortune',
    },
  },
  {
    label: '사주',
    c1: {
      heading: '사주 풀이',
      items: [
        { label: '내 사주 · 사주용선생', desc: '생년월일로 시작', href: '/saju/new', zodiac: 'dragon', tag: '9,900원' },
        { label: '깊은 풀이', desc: '평생 리포트', href: '/saju/new', zodiac: 'snake', tag: 'VIP' },
        { label: '궁합 · 궁합양선생', desc: '두 사람의 흐름', href: '/compatibility', zodiac: 'sheep' },
        { label: '별자리 × 사주', desc: '동서양 크로스', href: '/star-sign', zodiac: 'tiger' },
      ],
    },
    c2: {
      heading: '전문 분야',
      items: [
        { label: '재물 풀이', desc: '돈이 새는 패턴', href: '/saju/new' },
        { label: '연애 풀이', desc: '감정과 타이밍', href: '/saju/new' },
        { label: '직장 풀이', desc: '성과·이직 판단', href: '/saju/new' },
        { label: '택일', desc: '좋은 날 고르기', href: '/taekil' },
      ],
    },
    c3: {
      title: '평생 리포트 49,000원',
      description: '대운 30년 · 1:1 30분 포함',
      cta: 'VIP 자세히',
      href: '/pricing',
    },
  },
  {
    label: '대화',
    c1: {
      // 2026-06-28 — 홈 8캐릭터 카드 대응 8명 + 별자리(별닭선생) = 9명 노출. /dialogue 허브
      //   (MENU_DIALOGUE_EXPERTS)와 동일 구성. 나머지 3명(엠지쥐 성향·관상원 관상·복돼지 행운)은
      //   /dialogue/<id> 라우트는 유지하고 이 메뉴에서만 숨긴다.
      heading: '선생님과 대화',
      items: [
        { label: '사주용선생', desc: '내 흐름 보기 · 사주', href: '/dialogue/dragon', zodiac: 'dragon' },
        { label: '명리호선생', desc: '조금 더 깊게 · 명리', href: '/dialogue/tiger', zodiac: 'tiger', tag: 'TOP' },
        { label: '길일말선생', desc: '좋은 날 고르기 · 택일', href: '/dialogue/horse', zodiac: 'horse' },
        { label: '궁합양선생', desc: '상대와의 합 · 궁합', href: '/dialogue/sheep', zodiac: 'sheep' },
        { label: '꿈뱀선생', desc: '마음 신호 · 꿈해몽', href: '/dialogue/snake', zodiac: 'snake' },
        { label: '상담멍선생', desc: '편하게 고민 · 상담', href: '/dialogue/dog', zodiac: 'dog' },
        { label: '타로토선생', desc: '지금 마음 보기 · 타로', href: '/dialogue/rabbit', zodiac: 'rabbit' },
        { label: '오늘소선생', desc: '오늘 루틴 · 생활 조언', href: '/dialogue/ox', zodiac: 'ox' },
        { label: '별닭선생', desc: '별자리 흐름 · 별자리', href: '/dialogue/rooster', zodiac: 'rooster' },
      ],
    },
    c2: {
      heading: '상담 유형',
      items: [
        { label: '1:1 채팅', desc: '무료로 시작', href: '/dialogue' },
        { label: '대화 기록', desc: '예전 대화 다시 보기', href: '/dialogue/history' },
        { label: '예약 상담', desc: '캘린더에서 선택', href: '/dialogue/appointment' },
      ],
    },
    c3: {
      title: '1:1 상담 첫 30분',
      description: '가입 코인 100개로 무료',
      cta: '대화방 열기',
      href: '/dialogue',
    },
  },
  {
    label: '멤버십',
    simple: true,
    href: '/membership',
  },
];

/** pathname 으로 현재 active group label 판정. 운세 default. */
export function resolveActiveGroup(pathname: string): string {
  if (
    pathname.startsWith('/today-fortune') ||
    pathname.startsWith('/tarot') ||
    pathname.startsWith('/zodiac') ||
    pathname.startsWith('/star-sign') ||
    pathname.startsWith('/dream') ||
    pathname.startsWith('/taekil')
  ) {
    return '운세';
  }
  if (
    pathname.startsWith('/saju') ||
    pathname.startsWith('/compatibility') ||
    pathname.startsWith('/pricing')
  ) {
    return '사주';
  }
  if (pathname.startsWith('/dialogue')) {
    return '대화';
  }
  if (pathname.startsWith('/membership')) {
    return '멤버십';
  }
  return '운세'; // 홈/기본은 운세 활성
}
