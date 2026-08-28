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
  /**
   * 2026-08-28 — 한 단계 하위 항목. 부모 바로 아래 들여쓴 행으로 렌더한다.
   * 부모가 잠겨 사라지면 자식도 함께 사라진다(applyLockdown).
   */
  children?: MegaNavItem[];
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

// 2026-08-28 — 사용자 지시로 **메뉴를 셋으로 압축**했다.
//   그전엔 사주 8개(전문 분야 4개 포함) + 대화 12개(선생 9명) + 운세 7개 = 27개였고,
//   그 대부분이 같은 라우트(/saju/new, /dialogue)로 떨어지는 이름만 다른 행이었다.
//   같은 곳으로 가는 항목을 늘리는 건 선택지가 아니라 소음이다.
//   · 사주 = **정체성 기반 유료 풀이**(내 사주·궁합·타로·별자리×사주)
//   · 대화 = 선생 목록 대신 **행동**(새 대화 / 지난 대화). 선생은 /dialogue 안에서 고른다.
//   · 운세 = 매일 보는 무료 4종. 12×12 별자리 궁합은 별자리의 하위 항목이다.
//   featured(c3) 카드는 전부 뺐다 — '2026년 신년 운세'(8월에 신년), '평생 리포트'(목록에서
//   내린 상품)처럼 셋 다 만료된 프로모였다.
const ALL_MEGA_NAV: MegaNavGroup[] = [
  {
    label: '사주',
    c1: {
      heading: '사주 풀이',
      items: [
        {
          label: '내 사주',
          desc: '생년월일로 시작',
          href: '/saju/new',
          icon: 'saju',
          tag: '9,900원',
          // 🔴 2026-08-28 — 'saju_entry' 였는데 그 키는 taste_today_detail(현재 3,300원
          //   이벤트가)로 매핑돼, 메뉴에 **3,300원**이 찍히고 궁합과 같은 값으로 보였다.
          //   홈 사주 카드와 같은 키를 쓴다 — 두 곳이 다른 상품을 가리키면 또 갈라진다.
          tagPriceKey: 'bundle_comprehensive',
        },
        {
          label: '궁합',
          desc: '두 사람의 흐름',
          href: '/compatibility',
          icon: 'compat',
          tag: '3,300원',
          tagPriceKey: 'taste_compat_reading',
        },
        {
          // 2026-08-28 — 타로가 있던 자리. 택일은 '큰 결정의 날짜를 고르는' 도구라
          //   가벼운 운세(운세 탭)가 아니라 정체성 기반 유료 풀이 쪽이 맞다.
          label: '택일',
          desc: '큰 결정 D-day',
          href: '/taekil',
          icon: 'day',
          tag: '3,300원',
          tagPriceKey: 'taste_taekil',
        },
        { label: '별자리 × 사주', desc: '동서양 크로스', href: '/star-sign', icon: 'cross' },
      ],
    },
  },
  {
    label: '대화',
    c1: {
      // 2026-08-28 — 선생 9명 목록을 걷어냈다. 전부 /dialogue/<id> 로 갈라지는 같은 대화방이고,
      //   고르는 일은 /dialogue 허브가 이미 한다. 메뉴는 '새로 걸까 / 지난 걸 볼까'만 묻는다.
      //   '예약 상담'은 뺐다 — 캘린더 예약은 아직 없다.
      heading: '대화',
      items: [
        { label: '1:1 채팅', desc: '선생님과 바로 대화', href: '/dialogue', icon: 'chat' },
        { label: '대화 기록', desc: '예전 대화 다시 보기', href: '/dialogue/history', icon: 'history' },
      ],
    },
  },
  {
    label: '운세',
    c1: {
      heading: '운세',
      items: [
        // 2026-08-28 — 타로를 이 탭 맨 앞으로. 990원이지만 '오늘 뭐 볼까' 로 들어오는
        //   사람이 가장 먼저 만나는 카드다(무료 4종과 나란히 두는 게 사용자 결정).
        {
          label: '타로카드',
          desc: '마음이 시키는 카드',
          href: '/tarot/daily',
          icon: 'tarot',
          tag: '990원',
          tagPriceKey: 'taste_tarot_daily',
        },
        { label: '오늘운세', desc: '지금 핵심 한 줄', href: '/today-fortune?concern=general', icon: 'today', tag: 'FREE' },
        { label: '띠운세', desc: '내 띠 오늘 흐름', href: '/zodiac', icon: 'zodiac', tag: 'FREE' },
        {
          label: '별자리',
          desc: '12자리 메시지',
          href: '/star-sign',
          icon: 'star',
          tag: 'FREE',
          children: [
            { label: '12×12 별자리 궁합', desc: '한눈에 매트릭스', href: '/star-sign/compat', icon: 'starcompat' },
          ],
        },
        { label: '꿈해몽', desc: '한 단어 검색', href: '/dream', icon: 'dream', tag: 'FREE' },
      ],
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

  const cleanItems = (items: MegaNavItem[] | undefined): MegaNavItem[] =>
    keepVisible(items ?? [], (item) => item.href).map(({ tag, children, ...item }) => ({
      ...item,
      desc: unfree(item.desc),
      // 'FREE' 배지는 떼고, 가격 배지(9,900원·VIP·TOP 등)는 그대로 둔다.
      ...(tag && tag !== 'FREE' ? { tag } : {}),
      // 하위 항목도 같은 규칙으로 거른다. 남는 게 없으면 키 자체를 뺀다 —
      // 빈 배열이 남으면 잠금 검사(JSON 문자열)엔 안 걸려도 렌더가 빈 들여쓰기를 그린다.
      ...(() => {
        const kept = cleanItems(children);
        return kept.length > 0 ? { children: kept } : {};
      })(),
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
