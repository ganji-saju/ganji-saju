// 2026-08-28 — 모바일 메뉴 시트 항목 아이콘.
//
//   그전엔 12지신 인장(ZodiacChip)을 **내용과 무관하게** 돌려 붙이고 있었다:
//   오늘운세=닭 · 타로=토끼 · 띠운세=말 · 별자리=돼지. 별자리에 돼지 인장은 아무 뜻이 없고,
//   같은 인장이 '띠운세'와 '대화 선생'에서 다른 의미로 쓰여 오히려 규칙을 깨뜨렸다.
//
//   ⚠️ 인장은 **대화 그룹에만** 남긴다 — 거기선 선생 = 그 띠의 수호신이라 인장이 곧 정체성이다.
//   나머지는 내용을 가리키는 선 아이콘을 쓴다.
export type NavIconName =
  | 'today'
  | 'tarot'
  | 'zodiac'
  | 'star'
  | 'dream'
  | 'saju'
  | 'report'
  | 'compat'
  | 'cross'
  | 'day'
  | 'money'
  | 'love'
  | 'work'
  | 'chat'
  | 'history'
  | 'appointment'
  | 'starcompat';

const PATHS: Record<NavIconName, React.ReactNode> = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  tarot: <><rect x="4" y="3" width="10" height="15" rx="2" /><path d="M17 6l3 1.5-3.5 9.5" /></>,
  zodiac: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" /></>,
  star: <><path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 15.9 6.8 19l1.4-5.9-4.6-4 6-.5z" /></>,
  dream: <><path d="M20 14a8 8 0 1 1-9-9 6.5 6.5 0 0 0 9 9z" /><path d="M15 4.5h2M16 3.5v2" /></>,
  saju: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 12h18" /></>,
  report: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></>,
  compat: <><path d="M8.5 20C4 16.5 2 13.9 2 11a4 4 0 0 1 6.5-3.1" /><path d="M15.5 20C20 16.5 22 13.9 22 11a4 4 0 0 0-6.5-3.1" /><path d="M12 8.5v11" /></>,
  cross: <><circle cx="9" cy="9" r="5" /><path d="M15 15l5 5M13.5 6.5l4-4M17.5 6.5h-4v-4" /></>,
  day: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M10 15l1.5 1.5L15 13" /></>,
  money: <><circle cx="12" cy="12" r="9" /><path d="M9 9h6M9 12h6M12 9v8M10 6l2 3 2-3" /></>,
  love: <><path d="M12 20S3.5 14.5 3.5 9A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2c0 5.5-8.5 11-8.5 11z" /></>,
  work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" /></>,
  chat: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4.5l3 1.8" /></>,
  appointment: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15.5" r="2.5" /><path d="M12 14.3v1.4l1 .6" /></>,
  starcompat: <><path d="M8 3l1.4 3.2L13 6.7l-2.6 2.3.8 3.4L8 10.7l-3.2 1.7.8-3.4L3 6.7l3.6-.5z" /><path d="M16.5 12.5l.9 2.1 2.3.3-1.7 1.5.5 2.2-2-1.1-2 1.1.5-2.2-1.7-1.5 2.3-.3z" /></>,
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <span className="mobile-nav-sheet-item-icon" aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[name]}
      </svg>
    </span>
  );
}
