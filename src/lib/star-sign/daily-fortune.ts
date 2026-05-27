// 2026-05-15 — 별자리 일별 운세 산출.
// 별자리 + 날짜 시드로 결정적 PRNG (Mulberry32) 를 돌려 분야별 점수 + 한 줄 메시지 산출.
// 같은 별자리 + 같은 날 → 항상 같은 결과. 자정 지나면 변화.

import type { StarSignSlug } from './sign-content';
import { STAR_SIGN_CONTENT } from './sign-content';

export interface DailyFortune {
  dateKey: string;
  scores: {
    overall: number;
    love: number;
    work: number;
    health: number;
    money: number;
    study: number;
  };
  /** 오늘의 한 줄. */
  highlight: string;
  /** 도움이 되는 한 줄 (부스터). */
  boost: string;
  /** 조심할 한 줄 (challenge). */
  caution: string;
  /** 오늘의 럭키. */
  luckyOfDay: {
    color: { name: string; hex: string };
    number: number;
    direction: string;
    time: string;
  };
  /** 분위기. */
  mood: 'warm' | 'calm' | 'dynamic' | 'sensitive';
  moodLabel: string;
}

// Mulberry32 — 결정적 PRNG.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromSignAndDate(slug: StarSignSlug, dateKey: string): number {
  let h = 2166136261; // FNV-1a 32bit
  const input = `${slug}|${dateKey}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

/** KST 시간 YYYY-MM-DD. */
export function toKstDateKey(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const HIGHLIGHT_TEMPLATES: Array<Record<StarSignSlug, string[]>> = [
  // 슬롯 0 — 모든 sign 의 highlight 후보 (각 4-5개).
  {
    aries: [
      '먼저 움직이는 쪽이 결과를 가져갑니다',
      '망설임 한 박자가 오늘 차이를 만듭니다',
      '직진보다 한 호흡 고를 때 길이 보입니다',
      '에너지를 한 곳에 모으면 단번에 풀립니다',
    ],
    taurus: [
      '꾸준함 위에 오늘의 작은 결실이 쌓입니다',
      '천천히 가는 발걸음이 정답입니다',
      '익숙한 루틴이 오히려 마음을 지킵니다',
      '가치 있는 한 가지에 시간을 쓰세요',
    ],
    gemini: [
      '대화 속에서 좋은 힌트가 떠오릅니다',
      '여러 정보를 한 줄로 정리하면 답이 보입니다',
      '평소 안 만나던 사람과의 연락이 키입니다',
      '메모 한 줄이 내일의 기회로 이어집니다',
    ],
    cancer: [
      '마음 가까운 사람과의 시간이 회복을 줍니다',
      '집·가족·고향이 키워드가 됩니다',
      '직감이 잘 맞는 날입니다',
      '내가 챙겨준 마음이 오늘 돌아옵니다',
    ],
    leo: [
      '주목받는 자리에서 내 색을 분명히 보여주세요',
      '자신감 있게 말하면 분위기가 잡힙니다',
      '오늘은 작은 박수도 큰 동력이 됩니다',
      '내가 빛날 무대를 골라 서세요',
    ],
    virgo: [
      '디테일 한 줄이 신뢰를 만듭니다',
      '정리·점검이 가장 빠른 진전입니다',
      '완벽보다 80점에서 출발해도 충분합니다',
      '꼼꼼한 자기 점검이 약점을 메웁니다',
    ],
    libra: [
      '균형을 잡는 사람이 오늘 중심이 됩니다',
      '둘 다 만족할 중간 지점을 먼저 제안하세요',
      '관계 조율이 가장 큰 무기가 됩니다',
      '심미적인 선택이 행운을 부릅니다',
    ],
    scorpio: [
      '깊이 들어가야 답이 보입니다',
      '한 가지에 집중할 때 진가가 드러납니다',
      '직감이 정확한 날 — 신호를 받아들이세요',
      '말 못 한 진심을 정리해두면 변화가 옵니다',
    ],
    sagittarius: [
      '경계를 넘는 시도가 오늘 유리합니다',
      '낯선 길에서 좋은 기회가 들어옵니다',
      '큰 그림을 다시 그려보기 좋은 날입니다',
      '솔직함이 거리를 가깝게 만듭니다',
    ],
    capricorn: [
      '오늘의 한 걸음이 1년 뒤 큰 차이를 만듭니다',
      '책임감 있는 모습이 신뢰를 부릅니다',
      '시간 약속을 정확히 지키면 운이 따릅니다',
      '장기 계획 한 줄을 정리해보세요',
    ],
    aquarius: [
      '다른 시각으로 보는 사람이 정답을 찾습니다',
      '익숙함을 한 번 깨면 변화가 시작됩니다',
      '예측 못 한 연락이 좋은 흐름을 만듭니다',
      '미래의 나에게 도움이 될 한 가지를 시작하세요',
    ],
    pisces: [
      '직감을 믿어도 좋은 날입니다',
      '예술적인 한 줄이 마음을 정리해줍니다',
      '공감이 가장 큰 힘이 됩니다',
      '꿈에서 본 단서를 그냥 흘려보내지 마세요',
    ],
  },
];

const BOOST_TEMPLATES = [
  '평소보다 한 박자 더 빠르게 행동해보세요',
  '주변 사람의 짧은 칭찬을 솔직하게 받아주세요',
  '오전 시간을 가장 중요한 일에 먼저 쓰세요',
  '운동·산책 같은 가벼운 움직임이 흐름을 바꿉니다',
  '깊은 호흡과 정리된 책상이 오늘의 베이스가 됩니다',
  '말로만 끝낼 일을 짧은 메모로 남기세요',
  '음악을 바꿔보면 무드가 환기됩니다',
  '오랜 친구에게 안부 한 줄을 보내보세요',
];

const CAUTION_TEMPLATES = [
  '감정이 격해질 때는 한 박자 쉬고 결정하세요',
  '확신 없는 약속은 오늘 미루는 편이 좋습니다',
  '오늘은 큰 지출보다 작은 정리에 집중하세요',
  '예민해질 수 있으니 무리한 일정은 피하세요',
  '말의 강도를 한 톤만 낮추면 오해를 줄입니다',
  '집중이 흩어지면 일을 더 늘리지 마세요',
  '지나친 비교는 자신감을 갉아먹습니다',
  '몸이 보내는 신호를 가볍게 보지 마세요',
];

const DIRECTIONS = ['동쪽', '서쪽', '남쪽', '북쪽', '동남쪽', '서남쪽', '동북쪽', '서북쪽'];
const TIME_SLOTS = [
  '오전 9-11시',
  '오전 10-12시',
  '오후 1-3시',
  '오후 2-4시',
  '오후 4-6시',
  '저녁 6-8시',
  '저녁 7-9시',
];
const MOOD_LABELS: Record<DailyFortune['mood'], string> = {
  warm: '따뜻한 흐름',
  calm: '차분한 흐름',
  dynamic: '활기찬 흐름',
  sensitive: '예민한 흐름',
};

const ELEMENT_MOOD: Record<string, DailyFortune['mood']> = {
  fire: 'dynamic',
  earth: 'calm',
  air: 'warm',
  water: 'sensitive',
};

/** 별자리 + 날짜로 일별 운세 생성. */
export function getDailyFortune(slug: StarSignSlug, dateKey?: string): DailyFortune {
  const key = dateKey ?? toKstDateKey();
  const seed = seedFromSignAndDate(slug, key);
  const rng = mulberry32(seed);

  // 점수 50-95 사이. element 따라 baseline 살짝 변화.
  const content = STAR_SIGN_CONTENT[slug];
  const elementBoost = content.element === 'fire' ? 5 : content.element === 'water' ? -2 : 0;
  const pickScore = (offset = 0) => {
    const r = rng();
    return Math.max(50, Math.min(95, Math.round(60 + r * 35 + elementBoost + offset)));
  };

  const scores = {
    overall: pickScore(),
    love: pickScore(),
    work: pickScore(),
    health: pickScore(),
    money: pickScore(),
    study: pickScore(),
  };

  const highlightCandidates = HIGHLIGHT_TEMPLATES[0]![slug];
  const highlight = highlightCandidates[Math.floor(rng() * highlightCandidates.length)]!;
  const boost = BOOST_TEMPLATES[Math.floor(rng() * BOOST_TEMPLATES.length)]!;
  const caution = CAUTION_TEMPLATES[Math.floor(rng() * CAUTION_TEMPLATES.length)]!;

  // 럭키 — 별자리 콘텐츠와 일별 PRNG 조합.
  const luckyNumber = content.luckyNumbers[Math.floor(rng() * content.luckyNumbers.length)]!;
  const direction = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)]!;
  const time = TIME_SLOTS[Math.floor(rng() * TIME_SLOTS.length)]!;

  const mood = ELEMENT_MOOD[content.element] ?? 'calm';

  return {
    dateKey: key,
    scores,
    highlight,
    boost,
    caution,
    luckyOfDay: {
      color: content.luckyColor,
      number: luckyNumber,
      direction,
      time,
    },
    mood,
    moodLabel: MOOD_LABELS[mood],
  };
}
