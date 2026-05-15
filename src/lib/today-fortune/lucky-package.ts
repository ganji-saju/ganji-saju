// 2026-05-15 PR 2 — 운세톡톡 벤치마크 (간지사주_무료일진운세_적용방안.md 3-5):
// 행운 패키지 12종 빌더. 사주 원국 + 오늘 일진 정보를 받아 룰 기반으로 행운 항목 산출.
//
// 입력:
//   - luckyElement: 사용자에게 가장 유리한 오행 (yongsin → fallback 최약 오행)
//   - unluckyElement: 가장 부담스러운 오행 (yongsin.kiyshin → fallback 최강 오행)
//   - todayBranch: 오늘 일진 지지 (없으면 안전 fallback)
//
// 결과: TodayLuckyPackage (운세톡톡 5종 + 간지사주 7종 + 피해야 할 4종)

import type { TodayLuckyPackage, TodayLuckyNumberCircle } from './types';

type Elem = '목' | '화' | '토' | '금' | '수';

const ELEMENT_COLORS_MAIN: Record<Elem, string[]> = {
  목: ['초록색', '연두색'],
  화: ['빨강색', '진분홍색'],
  토: ['노란색', '베이지'],
  금: ['흰색', '은색'],
  수: ['검정색', '남색'],
};

const ELEMENT_HEX: Record<Elem, string> = {
  목: '#3F8796',
  화: '#E05298',
  토: '#D59B2E',
  금: '#A6A6A6',
  수: '#3B4F6B',
};

// 河圖洛書 수리: 1·6=水, 2·7=火, 3·8=木, 4·9=金, 5·10=土.
const ELEMENT_NUMBERS: Record<Elem, number[]> = {
  목: [3, 8],
  화: [2, 7],
  토: [5, 10],
  금: [4, 9],
  수: [1, 6],
};

const ELEMENT_DIRECTIONS: Record<Elem, string[]> = {
  목: ['정동', '동남'],
  화: ['정남', '동남'],
  토: ['중앙', '서남'],
  금: ['정서', '서북'],
  수: ['정북', '북서'],
};

// 자음 → 오행 매핑 (한국 성씨 한자 운용 관례).
const ELEMENT_SURNAME_INITIALS: Record<Elem, string[]> = {
  목: ['ㄱ', 'ㅋ'],
  화: ['ㄴ', 'ㄷ', 'ㄹ', 'ㅌ'],
  토: ['ㅇ', 'ㅎ'],
  금: ['ㅅ', 'ㅈ', 'ㅊ'],
  수: ['ㅁ', 'ㅂ', 'ㅍ'],
};

const ELEMENT_TIME_WINDOWS: Record<Elem, string[]> = {
  목: ['이른 아침 (03~07시, 寅卯時)', '오전 시작 무렵'],
  화: ['오전 (09~13시, 巳午時)', '한낮'],
  토: ['오전·오후 환절기 (07~09시·15~17시 사이)', '정오 전후'],
  금: ['늦은 오후 (15~19시, 申酉時)', '해질녘'],
  수: ['밤 (21~01시, 亥子時)', '늦은 저녁'],
};

const ELEMENT_FOODS: Record<Elem, string[]> = {
  목: ['신맛 — 레몬·사과·식초', '잎채소·새싹'],
  화: ['쓴맛 — 커피·다크초콜릿·쓴 나물', '붉은 과일'],
  토: ['단맛 — 꿀·고구마·호박', '곡물·콩 요리'],
  금: ['매운맛 — 고추·마늘·후추', '흰 살 생선'],
  수: ['짠맛 — 해산물·미역·콩', '검은 음식 (검은콩·김)'],
};

const ELEMENT_AROMAS: Record<Elem, string[]> = {
  목: ['시트러스 — 베르가못·레몬그라스'],
  화: ['따뜻한 향 — 시나몬·로즈'],
  토: ['편안한 향 — 캐모마일·바닐라'],
  금: ['상쾌한 향 — 민트·유칼립투스'],
  수: ['진정 향 — 라벤더·샌들우드'],
};

const ELEMENT_GEMS: Record<Elem, string[]> = {
  목: ['에메랄드', '페리도트'],
  화: ['루비', '가넷'],
  토: ['시트린', '황수정'],
  금: ['다이아몬드', '문스톤'],
  수: ['사파이어', '아쿠아마린'],
};

const ELEMENT_MUSIC: Record<Elem, string[]> = {
  목: ['어쿠스틱', '인디 포크'],
  화: ['댄스', 'K-Pop 업비트'],
  토: ['재즈', '소울'],
  금: ['클래식', '오케스트라'],
  수: ['앰비언트', '재즈 블루스'],
};

// 한국어 지지 → 띠 라벨.
const BRANCH_TO_ZODIAC_LABEL: Record<string, string> = {
  子: '쥐(子)', 丑: '소(丑)', 寅: '범(寅)', 卯: '토끼(卯)', 辰: '용(辰)', 巳: '뱀(巳)',
  午: '말(午)', 未: '양(未)', 申: '원숭이(申)', 酉: '닭(酉)', 戌: '개(戌)', 亥: '돼지(亥)',
};

// 三合 그룹.
const SAMHAP_GROUPS: Array<{ element: Elem; branches: string[] }> = [
  { element: '수', branches: ['申', '子', '辰'] },
  { element: '화', branches: ['寅', '午', '戌'] },
  { element: '금', branches: ['巳', '酉', '丑'] },
  { element: '목', branches: ['亥', '卯', '未'] },
];

// 沖 쌍 (반대편).
const CHUNG_PAIRS: Record<string, string> = {
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
};

// 怨嗔 쌍.
const WONJIN_PAIRS: Record<string, string> = {
  子: '未', 未: '子',
  丑: '午', 午: '丑',
  寅: '酉', 酉: '寅',
  卯: '申', 申: '卯',
  辰: '亥', 亥: '辰',
  巳: '戌', 戌: '巳',
};

function getZodiacFriendsFromBranch(todayBranch: string | null): string[] {
  if (!todayBranch) return [];
  const group = SAMHAP_GROUPS.find((g) => g.branches.includes(todayBranch));
  if (!group) return [];
  // 같은 三合 그룹의 다른 두 지지 → 친화 띠.
  return group.branches
    .filter((b) => b !== todayBranch)
    .map((b) => BRANCH_TO_ZODIAC_LABEL[b] ?? b)
    .filter(Boolean);
}

function getAvoidZodiacsFromBranch(todayBranch: string | null): string[] {
  if (!todayBranch) return [];
  const chung = CHUNG_PAIRS[todayBranch];
  const wonjin = WONJIN_PAIRS[todayBranch];
  const set = new Set<string>();
  if (chung) set.add(`${BRANCH_TO_ZODIAC_LABEL[chung] ?? chung} (충)`);
  if (wonjin) set.add(`${BRANCH_TO_ZODIAC_LABEL[wonjin] ?? wonjin} (원진)`);
  return Array.from(set);
}

// 로또 번호 6개 — date seed + day pillar seed 로 매일 다르게.
function buildLottoNumbers(seed: number, luckyElement: Elem): TodayLuckyNumberCircle[] {
  // mulberry32 PRNG — deterministic per seed.
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const picks = new Set<number>();
  // 첫 1개는 luckyElement 의 수에서 보장 — sajuChart 와의 자연스러운 시각 일치.
  const luckyNums = ELEMENT_NUMBERS[luckyElement];
  const firstPick = luckyNums[Math.floor(rand() * luckyNums.length)] ?? 1;
  // 0~45 안으로 조정.
  let candidate = firstPick;
  while (candidate > 45) candidate -= 10;
  if (candidate < 1) candidate = 1;
  picks.add(candidate);

  // 나머지 5개 균일 분포.
  while (picks.size < 6) {
    const n = Math.floor(rand() * 45) + 1;
    picks.add(n);
  }

  const ordered = Array.from(picks).sort((a, b) => a - b);

  return ordered.map((number) => {
    const elementForNumber = numberToElement(number);
    return {
      number,
      element: elementForNumber,
      color: ELEMENT_HEX[elementForNumber],
    };
  });
}

function numberToElement(n: number): Elem {
  // 河圖 수리 mod: 1·6=水, 2·7=火, 3·8=木, 4·9=金, 5·0=土.
  const m = n % 10;
  if (m === 1 || m === 6) return '수';
  if (m === 2 || m === 7) return '화';
  if (m === 3 || m === 8) return '목';
  if (m === 4 || m === 9) return '금';
  return '토';
}

interface BuildOptions {
  luckyElement: Elem;
  unluckyElement: Elem | null;
  todayBranch: string | null;
  /** YYYY-MM-DD — 매일 다른 로또 번호 보장용. */
  dateKey: string;
  /** 일주 ganzi — date 와 결합해 사용자별 시드. */
  dayGanzi: string | null;
}

export function buildTodayLuckyPackage(opts: BuildOptions): TodayLuckyPackage {
  const { luckyElement, unluckyElement, todayBranch, dateKey, dayGanzi } = opts;

  // 시드: dateKey + dayGanzi codepoint 합 → 매일·사용자별 다른 시드.
  const seedSource = `${dateKey}::${dayGanzi ?? 'unknown'}`;
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
  }

  return {
    luckyElement,
    unluckyElement,
    colors: ELEMENT_COLORS_MAIN[luckyElement],
    numbers: ELEMENT_NUMBERS[luckyElement],
    directions: ELEMENT_DIRECTIONS[luckyElement],
    surnameInitials: ELEMENT_SURNAME_INITIALS[luckyElement],
    lottoNumbers: buildLottoNumbers(seed, luckyElement),
    timeWindows: ELEMENT_TIME_WINDOWS[luckyElement],
    foods: ELEMENT_FOODS[luckyElement],
    aromas: ELEMENT_AROMAS[luckyElement],
    gemstones: ELEMENT_GEMS[luckyElement],
    zodiacFriends: getZodiacFriendsFromBranch(todayBranch),
    musicGenres: ELEMENT_MUSIC[luckyElement],
    avoidColors: unluckyElement ? ELEMENT_COLORS_MAIN[unluckyElement] : [],
    avoidDirections: unluckyElement ? ELEMENT_DIRECTIONS[unluckyElement] : [],
    avoidTimeWindows: unluckyElement ? ELEMENT_TIME_WINDOWS[unluckyElement] : [],
    avoidZodiacs: getAvoidZodiacsFromBranch(todayBranch),
  };
}

// 외부 노출용 헬퍼 — 컴포넌트가 hex 색을 다시 매핑할 때 사용.
export function getElementHex(element: Elem): string {
  return ELEMENT_HEX[element];
}
