// 2026-05-16 PR #155 — PC 메가 메뉴 데이터.
// 첨부 desktop.jsx MEGA_NAV 를 바탕으로 우리 실제 라우트에 맞춰 정리.

import type { ZodiacKey } from '@/components/gangi/zodiac-chip';
import { isMenuHiddenHref, isPaywallLockdown, keepVisible } from '@/lib/paywall-lockdown';
import type { NavIconName } from './nav-icons';
import type { PriceKey } from '@/lib/payments/price-display-shared';

export interface MegaNavItem {
  label: string;
  desc: string;
  href: string;
  zodiac?: ZodiacKey;
  tag?: 'FREE' | 'VIP' | 'TOP' | string;
  /** 2026-07-07 Phase 2 — 지정 시 tag 를 리졸버 가격(admin product_prices)으로 렌더. */
  tagPriceKey?: PriceKey;
  /** 2026-08-28 — 내용을 가리키는 아이콘. 인장(zodiac)은 대화 그룹 전용이다. */
  icon?: NavIconName;
}

export interface MegaNavFeatured {
  title: string;
  description: string;
  cta: string;
  href: string;
  /** 2026-07-07 Phase 2 — 지정 시 title 뒤에 리졸버 가격을 덧붙여 렌더. */
  titlePriceKey?: PriceKey;
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

const ALL_MEGA_NAV: MegaNavGroup[] = [
  {
    label: '운세',
    c1: {
      // 2026-08-25 — 유료는 타로·대화상담(질문 3회)만 990원. 간단운세·꿈해몽·띠·별자리 무료
      //   (같은 날 재확정 — 처음 4종 유료화에서 축소).
      heading: '운세',
      items: [
        { label: '오늘운세', desc: '지금 핵심 한 줄', href: '/today-fortune?concern=general', icon: 'today', tag: 'FREE' },
        { label: '타로 세 장', desc: '마음이 시키는 카드', href: '/tarot/daily', icon: 'tarot', tag: '990원', tagPriceKey: 'taste_tarot_daily' },
        { label: '띠운세', desc: '내 띠 오늘 흐름', href: '/zodiac', icon: 'zodiac', tag: 'FREE' },
        { label: '별자리', desc: '12자리 메시지', href: '/star-sign', icon: 'star', tag: 'FREE' },
      ],
    },
    c2: {
      heading: '인기 운세',
      items: [
        { label: '꿈해몽', desc: '한 단어 검색', href: '/dream', tag: 'FREE' },
        { label: '12×12 별자리 궁합', desc: '한눈에 매트릭스', href: '/star-sign/compat' },
        { label: '좋은 날', desc: '큰 결정 D-day', href: '/taekil' },
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
        { label: '내 사주', desc: '생년월일로 시작', href: '/saju/new', icon: 'saju', tag: '9,900원', tagPriceKey: 'saju_entry' },
        { label: '깊은 풀이', desc: '평생 리포트', href: '/saju/new', icon: 'report', tag: 'VIP' },
        { label: '궁합', desc: '두 사람의 흐름', href: '/compatibility', icon: 'compat', tag: '3,300원', tagPriceKey: 'taste_compat_reading' },
        { label: '별자리 × 사주', desc: '동서양 크로스', href: '/star-sign', icon: 'cross' },
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
      title: '평생 리포트',
      titlePriceKey: 'lifetime_report',
      description: '대운 30년 · 평생 소장',
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
        { label: '사주선생', desc: '내 흐름 보기', href: '/dialogue/dragon', zodiac: 'dragon' },
        { label: '명리선생', desc: '조금 더 깊게', href: '/dialogue/tiger', zodiac: 'tiger', tag: 'TOP' },
        { label: '길일선생', desc: '좋은 날 고르기', href: '/dialogue/horse', zodiac: 'horse' },
        { label: '궁합선생', desc: '상대와의 합', href: '/dialogue/sheep', zodiac: 'sheep' },
        { label: '꿈해몽선생', desc: '마음 신호', href: '/dialogue/snake', zodiac: 'snake' },
        { label: '대화상담선생', desc: '편하게 고민', href: '/dialogue/dog', zodiac: 'dog' },
        { label: '타로선생', desc: '지금 마음 보기', href: '/dialogue/rabbit', zodiac: 'rabbit' },
        { label: '오늘운세선생', desc: '오늘 루틴', href: '/dialogue/ox', zodiac: 'ox' },
        { label: '별자리선생', desc: '별자리 흐름', href: '/dialogue/rooster', zodiac: 'rooster' },
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
      title: '선생님과 1:1 대화',
      description: '처음 3회 무료로 시작',
      cta: '대화방 열기',
      href: '/dialogue',
    },
  },
  {
    label: '멤버십',
    simple: true,
    href: '/membership',
  },
  {
    label: '사용방법',
    simple: true,
    href: '/guide',
  },
];

// 2026-08-11 전면 유료화 잠금 — 메가 메뉴 정리.
//   · (A)잠긴 링크 제거. c1 이 통째로 비면 그룹을 드롭한다 — c1 은 패널의 본 그리드라
//     그게 빈 메가 패널은 깨져 보인다.
//   · 'FREE' 배지와 '무료…' 카피는 전부 걷어낸다. 잠금 중엔 전부 빈말이 된다.
//     (섹션 heading '무료 운세'도 포함 — 남은 항목이 유료면 제목이 거짓말이 된다.)
function applyLockdown(groups: MegaNavGroup[]): MegaNavGroup[] {
  if (!isPaywallLockdown()) return groups;

  const cleanItems = (items: MegaNavItem[] | undefined) =>
    keepVisible(items ?? [], (item) => item.href).map(({ tag, ...item }) => ({
      ...item,
      desc: unfree(item.desc),
      // 'FREE' 배지는 떼고, 가격 배지(9,900원·VIP·TOP 등)는 그대로 둔다.
      ...(tag && tag !== 'FREE' ? { tag } : {}),
    }));

  const cleanColumn = (column: { heading: string; items: MegaNavItem[] } | undefined) => {
    const items = cleanItems(column?.items);
    if (!column || items.length === 0) return undefined;
    return { heading: unfreeHeading(column.heading), items };
  };

  return groups.flatMap((group) => {
    // simple 링크도 잠긴 경로(/free 등)면 숨긴다 — 죽은 링크 방지.
    if (group.simple) {
      return group.href && isMenuHiddenHref(group.href) ? [] : [group];
    }

    const c1 = cleanColumn(group.c1);
    if (!c1) return [];

    const c3 =
      group.c3 && !isMenuHiddenHref(group.c3.href)
        ? {
            ...group.c3,
            description: unfree(group.c3.description),
            cta: unfree(group.c3.cta),
          }
        : undefined;

    return [{ ...group, c1, c2: cleanColumn(group.c2), c3 }];
  });
}

/** '무료로 시작' 류 카피 → 잠금 중에도 참인 문구로 교체. */
function unfree(copy: string): string {
  return copy.includes('무료') ? '결제 후 이용' : copy;
}

/** 섹션 제목은 '무료 ' 수식만 떼어낸다('무료 운세' → '운세'). */
function unfreeHeading(heading: string): string {
  return heading.replace(/무료\s*/g, '').trim() || heading;
}

// 2026-08-28 — 모바일 시트 탭 순서를 상단바와 맞춘다. 그전엔 '운세'(무료 허브)가 첫 탭이라
//   메뉴를 열면 무료부터 보였고, 상단바(사주 우선)와도 어긋났다. 배열을 직접 옮기지 않고
//   순서표로 정렬한다 — 그룹 정의는 그대로 두고 순서만 한 곳에서 조인다.
const GROUP_ORDER = ['사주', '대화', '운세', '멤버십', '사용방법'];

function byMenuOrder(groups: MegaNavGroup[]): MegaNavGroup[] {
  return [...groups].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.label);
    const bi = GROUP_ORDER.indexOf(b.label);
    return (ai < 0 ? GROUP_ORDER.length : ai) - (bi < 0 ? GROUP_ORDER.length : bi);
  });
}

export const MEGA_NAV: MegaNavGroup[] = applyLockdown(byMenuOrder(ALL_MEGA_NAV));

// 2026-08-25 전면 개편 — 데스크톱 상단 바 간소화(도령 벤치마크): 드롭다운 패널 없이
//   단순 링크 5개. 하단 dock 데스크톱 상시 노출로 패널의 탐색 역할이 중복돼서다.
//   ⚠️ MEGA_NAV(패널 데이터)는 모바일 햄버거 시트(mobile-nav-sheet)가 계속 쓴다 —
//   여기만 바꾸고 MEGA_NAV 를 건드리면 모바일 메뉴가 텅 빈다(2026-08-25 실회귀 경험).
// 2026-08-28 — 순서를 **상품 축**으로 다시 잡았다. 근거:
//   · 하단 dock 이 이미 '어디로 가나'(홈·보관함·사주추가·대화방)를 담당한다 — 상단이
//     같은 축으로 정렬되면 3개가 겹친다. 상단은 '무엇을 사러 왔나'로 나눈다.
//   · 홈 카드가 곧 사용자가 정한 우선순위다: 사주(HOT·9,900) → 궁합(추천·3,300) →
//     대화상담(990). 상단바 순서를 여기에 맞춘다.
//   · 🔴 궁합은 홈에서 '추천' 배지를 단 2번째 상품인데 **상단 진입로가 아예 없었다**.
//     /compatibility 는 잠금 대상도 아니다(결제 CTA 랜딩) — 넣지 않을 이유가 없었다.
//   · '운세'(/free)는 무료 허브라 뒤로 뺀다. 잠금 ON 이면 applyLockdown 이 통째로
//     지우므로, 앞자리에 두면 환경마다 첫 메뉴가 달라진다(프로덕션은 잠금 기본 ON).
//   · '사용방법'은 도움말이라 마지막. 데스크톱 링크 존재를 단언하는 spec 이 있어 뺴지 않는다.
export const MEGA_NAV_BAR: MegaNavGroup[] = applyLockdown([
  { label: '사주', simple: true, href: '/saju/new' },
  { label: '궁합', simple: true, href: '/compatibility' },
  { label: '대화', simple: true, href: '/dialogue' },
  { label: '운세', simple: true, href: '/free' },
  { label: '멤버십', simple: true, href: '/membership' },
  { label: '사용방법', simple: true, href: '/guide' },
]);

/** pathname 으로 현재 active group label 판정. 첫 메가 그룹 default. */
export function resolveActiveGroup(pathname: string): string {
  if (
    pathname.startsWith('/today-fortune') ||
    pathname.startsWith('/tarot') ||
    pathname.startsWith('/zodiac') ||
    pathname.startsWith('/star-sign') ||
    pathname.startsWith('/dream') ||
    pathname.startsWith('/taekil')
  ) {
    // 잠금으로 '운세' 그룹이 사라졌으면 하이라이트할 대상이 없다 → 아무것도 강조하지 않는다.
    return MEGA_NAV.some((group) => group.label === '운세') ? '운세' : '';
  }
  // 2026-08-28 — 궁합이 독립 메뉴가 됐다. 단 MEGA_NAV(모바일 시트)에는 '궁합' 그룹이
  //   없으므로, 없으면 '사주'로 떨어뜨린다('운세' 잠금 폴백과 같은 방식) — 안 그러면
  //   모바일 시트에서 아무 것도 활성화되지 않는다.
  if (pathname.startsWith('/compatibility')) {
    const hasCompat =
      MEGA_NAV_BAR.some((group) => group.label === '궁합') ||
      MEGA_NAV.some((group) => group.label === '궁합');
    return hasCompat ? '궁합' : '사주';
  }
  if (pathname.startsWith('/saju') || pathname.startsWith('/pricing')) {
    return '사주';
  }
  if (pathname.startsWith('/dialogue')) {
    return '대화';
  }
  if (pathname.startsWith('/membership')) {
    return '멤버십';
  }
  if (pathname.startsWith('/guide')) {
    return '사용방법';
  }
  // 2026-08-28 — 홈에서는 **아무것도 강조하지 않는다**. 그전엔 '첫 메가 그룹'을 기본값으로
  //   돌려줘 홈에서 '운세'가 칠해져 있었다 — 상단바를 상품 축으로 재정렬하면서 '운세'는
  //   4번째 메뉴가 됐고, 홈은 어느 메뉴에도 속하지 않으므로 거짓 강조다.
  return '';
}
