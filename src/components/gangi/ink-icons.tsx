// 2026-09-01 — 앱 전역 이모지를 대체하는 **먹선 아이콘 세트**.
//
// 왜 세트인가: 이모지는 기기·OS 마다 다른 그림으로 렌더돼 한지·먹 톤과 절대 어울리지 않고,
//   124종이 제각기라 화면마다 손끝이 달랐다. 그림(민화)은 40px 이상에서만 살아나므로
//   14~28px 칩·라벨 자리는 **1~3획 먹선**이 정답이다 — currentColor 로 주변 색을 따르고,
//   배율에 무관하게 또렷하며, 네트워크 요청이 0이다.
//
// 규약:
//   · 데이터는 이모지 글리프가 아니라 **아이콘 이름**을 든다(`icon: 'love'`).
//   · 24x24 viewBox, stroke 기반, fill 없음 — 굵기는 size 에 비례해 자동 보정.
//   · 40px 이상 큰 자리는 이 세트가 아니라 민화 그림 자산을 쓴다(띠·별자리·궁합 관계).
import type { ReactNode } from 'react';

export interface InkIconProps {
  size?: number;
  className?: string;
}

function S({ size = 16, className = '', children }: InkIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      // 작을수록 획이 두꺼워야 형태가 뭉개지지 않는다.
      strokeWidth={size <= 16 ? 1.9 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    >
      {children}
    </svg>
  );
}

/* ── 관계 상태 ───────────────────────────────────────────── */
const Solo = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5.5 20c1.2-3.4 3.6-5.1 6.5-5.1s5.3 1.7 6.5 5.1" />
  </S>
);
const Dating = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 20s-7-4.3-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.7 12 20 12 20Z" />
  </S>
);
const Married = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="9" cy="14.5" r="4.5" />
    <circle cx="15" cy="14.5" r="4.5" opacity={0.6} />
    <path d="M12 4.5 13.8 7h-3.6Z" />
  </S>
);
const Parted = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 20s-7-4.3-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.7 12 20 12 20Z" />
    <path d="M12 6.5v13" strokeDasharray="2 2.4" />
  </S>
);

/* ── 직업 ───────────────────────────────────────────────── */
const Office = (p: InkIconProps) => (
  <S {...p}>
    <rect x="3.2" y="7.5" width="17.6" height="12" rx="2" />
    <path d="M9 7.5V5.8c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6v1.7M3.2 12.5h17.6" />
  </S>
);
const SelfEmployed = (p: InkIconProps) => (
  <S {...p}>
    <path d="M14.5 6.2a4 4 0 0 1 5.3 5.3L9.4 21.9a2.1 2.1 0 0 1-3-3Z" />
    <path d="M4.6 4.2 8 7.6M8 4.2 4.6 7.6" opacity={0.65} />
  </S>
);
const Student = (p: InkIconProps) => (
  <S {...p}>
    <path d="M3 7.6 12 4l9 3.6-9 3.6Z" />
    <path d="M6.6 9.6v4.6c0 1.9 2.4 3.2 5.4 3.2s5.4-1.3 5.4-3.2V9.6" />
  </S>
);
const Home = (p: InkIconProps) => (
  <S {...p}>
    <path d="M4 10.6 12 4l8 6.6V20H4Z" />
    <path d="M9.6 20v-5.4h4.8V20" opacity={0.7} />
  </S>
);
const JobSeeking = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="10.6" cy="10.6" r="6.1" />
    <path d="M15.2 15.2 20 20" />
  </S>
);

/* ── 고민·주제 ──────────────────────────────────────────── */
const Wealth = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.6v8.8M9.6 9.8h3.6a1.9 1.9 0 0 1 0 3.8H9.6h4.2" />
  </S>
);
const Career = (p: InkIconProps) => (
  <S {...p}>
    <path d="M4 19.4V9.2l5.6-3.4v3.4L20 5.4v14Z" />
    <path d="M13 19.4v-4.2h3.4v4.2" opacity={0.7} />
  </S>
);
const Relationship = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="8.6" cy="8.6" r="3.2" />
    <circle cx="15.6" cy="8.6" r="3.2" opacity={0.6} />
    <path d="M3.4 19.4c.9-2.7 2.8-4.1 5.2-4.1s4.3 1.4 5.2 4.1M15 15.6c2 .2 3.5 1.5 4.3 3.8" />
  </S>
);
const Family = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="7.6" cy="8" r="2.8" />
    <circle cx="16.4" cy="8" r="2.8" opacity={0.6} />
    <path d="M3 19.6c.7-2.5 2.3-3.8 4.6-3.8s3.9 1.3 4.6 3.8M13.4 19.6c.6-1.9 1.8-2.9 3.6-2.9s3 1 3.6 2.9" />
    <circle cx="12" cy="14.4" r="1.9" opacity={0.75} />
  </S>
);
const Health = (p: InkIconProps) => (
  <S {...p}>
    <path d="M3.6 12h3.6l1.8-4.2 3 9 2.1-5.4 1.5 2.6h4.8" />
  </S>
);
const Business = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 3.4c3.4 2.4 5.2 5.4 5.2 8.9 0 2.1-.7 3.9-2 5.4H8.8c-1.3-1.5-2-3.3-2-5.4 0-3.5 1.8-6.5 5.2-8.9Z" />
    <path d="M9.6 20.6h4.8" opacity={0.7} />
  </S>
);
const Today = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" opacity={0.7} />
  </S>
);
const Love = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 20.2s-7.4-4.5-7.4-9.7A4.1 4.1 0 0 1 12 7.9a4.1 4.1 0 0 1 7.4 2.6c0 5.2-7.4 9.7-7.4 9.7Z" />
  </S>
);
const Mind = (p: InkIconProps) => (
  <S {...p}>
    <path d="M9 4.6a4 4 0 0 0-3.6 5.8A4 4 0 0 0 7.8 17c.5 1.6 1.9 2.6 3.6 2.6V4.6Z" />
    <path d="M15 4.6a4 4 0 0 1 3.6 5.8A4 4 0 0 1 16.2 17c-.5 1.6-1.9 2.6-3.6 2.6V4.6Z" opacity={0.6} />
  </S>
);
const Etc = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="5.4" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18.6" cy="12" r="1.5" />
  </S>
);

/* ── 메뉴·네비게이션 ────────────────────────────────────── */
const Moon = (p: InkIconProps) => (
  <S {...p}>
    <path d="M16.8 3.8a8.5 8.5 0 1 0 4 11.3A9.1 9.1 0 0 1 16.8 3.8Z" />
  </S>
);
const Sparkle = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 3.4 13.8 9 19.4 12 13.8 15 12 20.6 10.2 15 4.6 12l5.6-3Z" />
  </S>
);
const Chat = (p: InkIconProps) => (
  <S {...p}>
    <path d="M20.2 15.4a2 2 0 0 1-2 2H8.4L4.4 21V6.6a2 2 0 0 1 2-2h11.8a2 2 0 0 1 2 2Z" />
  </S>
);
const Archive = (p: InkIconProps) => (
  <S {...p}>
    <path d="M6.4 3.8h11.2v17l-5.6-3.9-5.6 3.9Z" />
  </S>
);
const Chart = (p: InkIconProps) => (
  <S {...p}>
    <path d="M4 20h16" />
    <path d="M7.4 20v-6.2M12 20V7.6M16.6 20v-9" />
  </S>
);
const Compass = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M15.2 8.8 13.4 13.4 8.8 15.2l1.8-4.6Z" />
  </S>
);
const Bell = (p: InkIconProps) => (
  <S {...p}>
    <path d="M17.6 16.4V11a5.6 5.6 0 1 0-11.2 0v5.4L4.8 18.6h14.4Z" />
    <path d="M10.2 18.6a1.9 1.9 0 0 0 3.6 0" opacity={0.7} />
  </S>
);
const Gear = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 3.2v2.4M12 18.4v2.4M20.8 12h-2.4M5.6 12H3.2M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7M18.2 18.2l-1.7-1.7M7.5 7.5 5.8 5.8" opacity={0.75} />
  </S>
);
const Pen = (p: InkIconProps) => (
  <S {...p}>
    <path d="M18.8 4.2 20.6 6l-11 11-2.8.9.9-2.8Z" />
    <path d="M4 20h6.6" opacity={0.7} />
  </S>
);
const Lock = (p: InkIconProps) => (
  <S {...p}>
    <rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2" />
    <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
  </S>
);
const Doc = (p: InkIconProps) => (
  <S {...p}>
    <path d="M13.4 3.6H6.8v16.8h10.4V7.4Z" />
    <path d="M13.4 3.6v3.8h3.8M9.6 12.4h4.8M9.6 16h4.8" opacity={0.7} />
  </S>
);
const Card = (p: InkIconProps) => (
  <S {...p}>
    <rect x="3.2" y="5.8" width="17.6" height="12.4" rx="2" />
    <path d="M3.2 10.2h17.6M6.8 14.6h3.4" opacity={0.7} />
  </S>
);
const Question = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.5v.4" />
    <path d="M12 17.1v.1" strokeWidth={2.4} />
  </S>
);
const Lantern = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 3v1.6M8.4 7.2h7.2v6.2a3.6 3.6 0 0 1-7.2 0Z" />
    <path d="M9.8 20h4.4M12 17v3" opacity={0.7} />
  </S>
);
const Clover = (p: InkIconProps) => (
  <S {...p}>
    <path d="M12 12c-2.6-2.6-5.6-1.7-5.6.6S9 15.6 12 12Zm0 0c2.6-2.6 5.6-1.7 5.6.6S15 15.6 12 12Zm0 0c-2.6 2.6-1.7 5.6.6 5.6S15.6 15 12 12Zm0 0c-2.6-2.6-1.7-5.6.6-5.6S15.6 9 12 12Z" />
  </S>
);
const Crystal = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="10.6" r="6.2" />
    <path d="M6.6 19.6h10.8" />
    <path d="M9.4 8.6a3.4 3.4 0 0 1 2.6-2.2" opacity={0.65} />
  </S>
);

/* ── 평가·피드백 ────────────────────────────────────────── */
const FaceGood = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M8.6 14c.9 1.3 2 2 3.4 2s2.5-.7 3.4-2" />
    <path d="M9.4 9.6v.1M14.6 9.6v.1" strokeWidth={2.4} />
  </S>
);
const FaceSo = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M8.8 14.6h6.4" />
    <path d="M9.4 9.6v.1M14.6 9.6v.1" strokeWidth={2.4} />
  </S>
);
const FaceBad = (p: InkIconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M8.6 15.6c.9-1.3 2-2 3.4-2s2.5.7 3.4 2" />
    <path d="M9.4 9.6v.1M14.6 9.6v.1" strokeWidth={2.4} />
  </S>
);
const Star = (p: InkIconProps) => (
  <S {...p}>
    <path d="m12 3.6 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8Z" />
  </S>
);


/* ── 추가 세트(2차 스윕) ─────────────────────────────────── */
const User = (p: InkIconProps) => (
  <S {...p}><circle cx="12" cy="8.2" r="3.7" /><path d="M5.4 20c1.2-3.4 3.6-5.2 6.6-5.2s5.4 1.8 6.6 5.2" /></S>
);
const Gem = (p: InkIconProps) => (
  <S {...p}><path d="M7.4 4h9.2l3.4 5.2L12 20.4 4 9.2Z" /><path d="M4 9.2h16M9.4 9.2 12 20.4l2.6-11.2" opacity={0.65} /></S>
);
const Calendar = (p: InkIconProps) => (
  <S {...p}><rect x="3.6" y="5.6" width="16.8" height="14.8" rx="2" /><path d="M3.6 10h16.8M8.4 3.4v4M15.6 3.4v4" /></S>
);
const Sun = (p: InkIconProps) => (
  <S {...p}><circle cx="12" cy="12" r="4.4" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" opacity={0.7} /></S>
);
const Shop = (p: InkIconProps) => (
  <S {...p}><path d="M4.4 9.6h15.2v10.8H4.4Z" /><path d="M3.4 9.6 5.4 4.6h13.2l2 5" /><path d="M9.6 20.4v-5.2h4.8v5.2" opacity={0.7} /></S>
);
const MoveHouse = (p: InkIconProps) => (
  <S {...p}><path d="M3.6 11 12 4.4 20.4 11v9.4H3.6Z" /><path d="M9 20.4v-5.6h6v5.6" opacity={0.6} /><path d="M14.6 8.4h4M17 6.2l2.2 2.2L17 10.6" opacity={0.75} /></S>
);
const Contract = (p: InkIconProps) => (
  <S {...p}><path d="M6.4 3.6h8l3.6 3.8v13H6.4Z" /><path d="M9.6 11.4h5.2M9.6 15h3.4" opacity={0.7} /></S>
);
const Travel = (p: InkIconProps) => (
  <S {...p}><path d="M3.4 13.4 20.6 6.2 13 20.4l-2.4-5.6Z" /><path d="M10.6 14.8 6.6 12.8" opacity={0.7} /></S>
);
const Bless = (p: InkIconProps) => (
  <S {...p}><path d="M12 20.4c-3.4-1.6-5.6-4.4-5.6-7.6V6.6L12 4l5.6 2.6v6.2c0 3.2-2.2 6-5.6 7.6Z" /><path d="M9.6 12.2 11.4 14l3.4-3.6" opacity={0.7} /></S>
);
const Lot = (p: InkIconProps) => (
  <S {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.6 8.6v.1M15.4 8.6v.1M8.6 15.4v.1M15.4 15.4v.1M12 12v.1" strokeWidth={2.6} /></S>
);
const Palette = (p: InkIconProps) => (
  <S {...p}><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.2 0 1.8-.8 1.8-1.7 0-1.5 1-2.1 2.3-2.1h1.3a3 3 0 0 0 3-3A8.4 8.4 0 0 0 12 3.6Z" /><path d="M8 10.4v.1M12 8.2v.1M15.8 10.4v.1" strokeWidth={2.4} /></S>
);
const Numbers = (p: InkIconProps) => (
  <S {...p}><path d="M9.4 4 7.6 20M16.4 4l-1.8 16M4.6 9h15M4 15h15" /></S>
);
const Meal = (p: InkIconProps) => (
  <S {...p}><path d="M7 3.6v8.2M7 11.8V20.4M4.6 3.6v5.2a2.4 2.4 0 0 0 4.8 0V3.6" /><path d="M16.4 20.4V3.8c2 .8 3 2.9 3 5.6s-1 4.2-3 4.6" opacity={0.75} /></S>
);
const Flower = (p: InkIconProps) => (
  <S {...p}><circle cx="12" cy="12" r="2.4" /><path d="M12 9.6c0-3 1.4-4.6 3-4.6s2.2 2.4-.6 4.6M14.4 12c3 0 4.6 1.4 4.6 3s-2.4 2.2-4.6-.6M12 14.4c0 3-1.4 4.6-3 4.6s-2.2-2.4.6-4.6M9.6 12c-3 0-4.6-1.4-4.6-3s2.4-2.2 4.6.6" opacity={0.8} /></S>
);
const Music = (p: InkIconProps) => (
  <S {...p}><path d="M9.4 18.4V5.6l9.2-1.8v12.6" /><circle cx="6.8" cy="18.4" r="2.6" /><circle cx="16" cy="16.4" r="2.6" opacity={0.75} /></S>
);
const TarotCard = (p: InkIconProps) => (
  <S {...p}><rect x="5.6" y="3.4" width="12.8" height="17.2" rx="2.2" /><path d="M12 8.2 13.4 11l2.8.4-2 2 .5 2.8-2.7-1.4-2.7 1.4.5-2.8-2-2 2.8-.4Z" opacity={0.8} /></S>
);

const ICONS = {
  // 관계 상태
  solo: Solo, dating: Dating, married: Married, parted: Parted,
  // 직업
  office: Office, 'self-employed': SelfEmployed, student: Student,
  homemaker: Home, 'job-seeking': JobSeeking,
  // 고민·주제
  wealth: Wealth, career: Career, relationship: Relationship, family: Family,
  health: Health, business: Business, today: Today, love: Love, mind: Mind, etc: Etc,
  // 메뉴·네비
  moon: Moon, sparkle: Sparkle, chat: Chat, archive: Archive, chart: Chart,
  compass: Compass, bell: Bell, gear: Gear, pen: Pen, lock: Lock, doc: Doc,
  card: Card, question: Question, lantern: Lantern, clover: Clover, crystal: Crystal,
  // 2차 스윕
  user: User, gem: Gem, calendar: Calendar, sun: Sun, shop: Shop,
  'move-house': MoveHouse, contract: Contract, travel: Travel, bless: Bless,
  lot: Lot, palette: Palette, numbers: Numbers, meal: Meal, flower: Flower,
  music: Music, 'tarot-card': TarotCard,
  // 평가
  'face-good': FaceGood, 'face-so': FaceSo, 'face-bad': FaceBad, star: Star,
} as const;

export type InkIconName = keyof typeof ICONS;

export function isInkIconName(value: unknown): value is InkIconName {
  return typeof value === 'string' && value in ICONS;
}

/** 이름으로 먹선 아이콘을 렌더한다. 모르는 이름이면 아무것도 그리지 않는다(빈 자리가 깨진 글리프보다 낫다). */
export function InkIcon({ name, size = 16, className }: InkIconProps & { name: string }) {
  const Cmp = ICONS[name as InkIconName];
  return Cmp ? <Cmp size={size} className={className} /> : null;
}
