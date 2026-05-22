// 2026-05-23 — 사주 리포트 PDF 저장 화면(8페이지) 전용 결정적(deterministic) 매핑.
//
// PDF 저장 화면은 사용자 목업(8장 A4)을 픽셀 단위로 복제한다. 엔진 데이터로 채울 수
// 없는 칸(천간/지지의 동물·방위·한 줄 설명, 일주 성격 키워드 4종, 신살 의미, 12개월
// 키워드/점수)은 모두 *결정적 매핑*으로 채운다 — 같은 사주 입력이면 항상 같은 출력
// (LLM·난수 사용 금지). 본 모듈은 그 매핑과 PDF 전용 색상 팔레트를 모은다.
//
// 어휘는 docs/claude-specs/02-naming-policy.md 준수: 오행은 "목/화/토/금/수" 표기,
// 한자는 8글자 카드·칩에만 노출, 추상 신조어("X의 결") 금지.

import type { Element, Stem, Branch } from './types';
import type { TenGodCode } from '@/domain/saju/engine/saju-data-v1';

// ──────────────────────────────────────────────────────────────────────────
// 받침(종성) 기반 조사 선택 — 동적 값(신살/십성 라벨 등) 뒤 조사를 정확히.
// ──────────────────────────────────────────────────────────────────────────

/** 마지막 글자가 한글이고 종성(받침)이 있으면 true. */
export function hasBatchim(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const code = trimmed.charCodeAt(trimmed.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 받침 유무에 맞는 조사 반환 — 받침O consonantParticle, 받침X vowelParticle. */
export function josa(value: string, consonantParticle: string, vowelParticle: string): string {
  return hasBatchim(value) ? consonantParticle : vowelParticle;
}

// ──────────────────────────────────────────────────────────────────────────
// 색상 팔레트 — 목업에서 추출한 정확한 hex (앱 ELEMENT_INFO 와 별개의 리포트 전용 톤).
// ──────────────────────────────────────────────────────────────────────────

/** 리포트 기본 핑크 / 잉크 / 보조 톤. */
export const PDF_COLORS = {
  pink: '#d81b72',
  pinkStrong: '#ff4f9a',
  pinkBright: '#ff7bb8',
  pinkSoft: '#fff0f7',
  ink: '#111114',
  inkSoft: 'rgba(17,17,20,0.76)',
  inkMuted: 'rgba(17,17,20,0.56)',
  inkFaint: 'rgba(17,17,20,0.45)',
  cardBg: '#fafafb',
  line: 'rgba(17,17,20,0.10)',
  lineSoft: 'rgba(17,17,20,0.08)',
  letter: '#3a2a2a',
  amberInk: '#7a5a00',
} as const;

/** 오행 → 목업 도넛/한자 색상 (앱 ELEMENT_INFO.color 와 다른 리포트 전용 팔레트). */
export const PDF_ELEMENT_COLORS: Record<Element, string> = {
  목: '#0f9f7a',
  화: '#ff6b6b',
  토: '#d99020',
  금: '#9ba0a8',
  수: '#368ee8',
};

/** 오행 한자(도넛 중앙·칩). */
export const ELEMENT_HANJA: Record<Element, string> = {
  목: '木',
  화: '火',
  토: '土',
  금: '金',
  수: '水',
};

/** 십성 → 칩 색상 (목업 P2/P3 칩). */
export const PDF_TEN_GOD_COLORS: Record<TenGodCode, string> = {
  비견: '#5b58d6',
  겁재: '#d99020',
  식신: '#ff4f9a',
  상관: '#d81b72',
  편재: '#d99020',
  정재: '#0f9f7a',
  편관: '#ff6b6b',
  정관: '#0f9f7a',
  편인: '#c04de0',
  정인: '#0f9f7a',
};

export const TEN_GOD_HANJA: Record<TenGodCode, string> = {
  비견: '比肩',
  겁재: '劫財',
  식신: '食神',
  상관: '傷官',
  편재: '偏財',
  정재: '正財',
  편관: '偏官',
  정관: '正官',
  편인: '偏印',
  정인: '正印',
};

/** 십성 한 줄 설명 (P2 분포 칩). */
export const TEN_GOD_DESCRIPTIONS: Record<TenGodCode, string> = {
  비견: '자존과 독립. 자기 확신과 주체성. 협력보다 단독 행동에 강함.',
  겁재: '협업과 경쟁자. 재물 분담과 사회적 네트워크. 동등한 동료 관계.',
  식신: '표현과 먹을복. 여유·창의·기예. 안정된 결과물 만드는 능력.',
  상관: '재능과 표현. 기교·순발력. 틀을 벗어나는 자유로움.',
  편재: '큰 재물과 기회. 유동성·사업 감각. 흐름을 읽는 눈.',
  정재: '안정적인 재물과 근면. 꾸준함·관리력. 실속을 챙기는 힘.',
  편관: '도전과 외부 압력. 경쟁·시험·결단. 추진력의 원천이자 스트레스 요인.',
  정관: '책임과 명예. 체계·신뢰. 자리와 규범을 지키는 힘.',
  편인: '독창적 학습과 직관. 남다른 시각. 비주류 전문성.',
  정인: '배움과 도움받음. 학문·문서·어머니적 보호. 안정된 뒷받침.',
};

// ──────────────────────────────────────────────────────────────────────────
// 결정적 매핑 #1 — 천간(10) / 지지(12) → {오행·한국어명·동물/자연물·방위·한 줄}.
//   P3 일간(나의 본질) / 일지(나의 환경) 카드용.
// ──────────────────────────────────────────────────────────────────────────

export interface StemProfile {
  /** 한국어 표기 (예: 갑목). */
  korean: string;
  element: Element;
  /** 자연물·방위 요약 (예: '큰 나무 · 동방'). */
  natureLine: string;
  /** 한 줄 설명. */
  description: string;
}

export const STEM_PROFILES: Record<Stem, StemProfile> = {
  甲: {
    korean: '갑목',
    element: '목',
    natureLine: '큰 나무 · 동방',
    description: '곧게 자라는 큰 나무. 한 번 정하면 흔들리지 않고, 위로 향하는 추진력이 강해요.',
  },
  乙: {
    korean: '을목',
    element: '목',
    natureLine: '화초·덩굴 · 동방',
    description: '부드럽게 휘어 자라는 풀과 덩굴. 유연하고 적응이 빠르며 끈기 있게 자리를 넓혀요.',
  },
  丙: {
    korean: '병화',
    element: '화',
    natureLine: '태양 · 남방',
    description: '온 세상을 비추는 태양. 밝고 활달하며 주변을 환하게 만드는 존재감이 있어요.',
  },
  丁: {
    korean: '정화',
    element: '화',
    natureLine: '촛불·등불 · 남방',
    description: '한곳을 깊이 밝히는 불꽃. 세심하고 집중력이 좋아 한 분야를 끝까지 파고들어요.',
  },
  戊: {
    korean: '무토',
    element: '토',
    natureLine: '큰 산·대지 · 중앙',
    description: '넓고 듬직한 대지. 신뢰감이 크고 책임을 맡아 주변의 중심 역할을 해요.',
  },
  己: {
    korean: '기토',
    element: '토',
    natureLine: '논밭·정원 · 중앙',
    description: '곡식을 길러내는 기름진 흙. 섬세하고 현실적이며 꼼꼼한 살림 감각이 있어요.',
  },
  庚: {
    korean: '경금',
    element: '금',
    natureLine: '큰 쇠·바위 · 서방',
    description: '제련 전의 단단한 금속. 결단력과 정의감이 강하고 흑백이 분명해요.',
  },
  辛: {
    korean: '신금',
    element: '금',
    natureLine: '보석·세공 금속 · 서방',
    description: '잘 다듬어진 보석. 예민하고 완벽을 추구하며 날카로운 미적 감각이 있어요.',
  },
  壬: {
    korean: '임수',
    element: '수',
    natureLine: '큰 바다·강 · 북방',
    description: '넓게 흐르는 큰 물. 진취적이고 포용력이 넓으며 큰 그림을 그리는 기획력이 있어요.',
  },
  癸: {
    korean: '계수',
    element: '수',
    natureLine: '비·이슬·샘물 · 북방',
    description: '땅을 적시는 맑은 물. 사려 깊고 직관이 좋아 사람의 감정을 잘 읽어요.',
  },
};

export interface BranchProfile {
  /** 한국어 표기 (예: 신금). */
  korean: string;
  element: Element;
  /** 동물·방위 요약 (예: '원숭이 · 서방'). */
  natureLine: string;
  description: string;
}

export const BRANCH_PROFILES: Record<Branch, BranchProfile> = {
  子: {
    korean: '자수',
    element: '수',
    natureLine: '쥐 · 북방',
    description: '한밤의 깊은 물 같은 환경. 생각이 많고 부지런하며 비밀을 잘 지켜요.',
  },
  丑: {
    korean: '축토',
    element: '토',
    natureLine: '소 · 북동방',
    description: '추위를 견디는 언 땅 같은 환경. 묵묵히 버티는 끈기와 성실함이 강해요.',
  },
  寅: {
    korean: '인목',
    element: '목',
    natureLine: '호랑이 · 동방',
    description: '봄을 여는 큰 나무 같은 환경. 진취적이고 시작하는 힘이 좋아요.',
  },
  卯: {
    korean: '묘목',
    element: '목',
    natureLine: '토끼 · 동방',
    description: '돋아나는 새싹 같은 환경. 섬세하고 사교적이며 분위기를 부드럽게 풀어요.',
  },
  辰: {
    korean: '진토',
    element: '토',
    natureLine: '용 · 동남방',
    description: '물기를 머금은 봄 땅 같은 환경. 스케일이 크고 변화를 끌어안는 힘이 있어요.',
  },
  巳: {
    korean: '사화',
    element: '화',
    natureLine: '뱀 · 남방',
    description: '오를 듯한 불기운의 환경. 영민하고 계획적이며 속을 잘 드러내지 않아요.',
  },
  午: {
    korean: '오화',
    element: '화',
    natureLine: '말 · 남방',
    description: '한낮의 뜨거운 불 같은 환경. 활동적이고 표현이 시원시원해요.',
  },
  未: {
    korean: '미토',
    element: '토',
    natureLine: '양 · 남서방',
    description: '여름 끝 마른 땅 같은 환경. 온화하고 포용력이 있어 사람을 잘 품어요.',
  },
  申: {
    korean: '신금',
    element: '금',
    natureLine: '원숭이 · 서방',
    description: '영리하고 빠르게 판단하는 환경. 분석력과 임기응변에 강하지만 때로 차갑게 보일 수 있어요.',
  },
  酉: {
    korean: '유금',
    element: '금',
    natureLine: '닭 · 서방',
    description: '잘 벼린 칼 같은 환경. 깔끔하고 정확하며 마무리가 야무져요.',
  },
  戌: {
    korean: '술토',
    element: '토',
    natureLine: '개 · 서북방',
    description: '늦가을 마른 땅 같은 환경. 의리가 있고 한번 믿으면 끝까지 지켜요.',
  },
  亥: {
    korean: '해수',
    element: '수',
    natureLine: '돼지 · 북방',
    description: '겨울로 흐르는 큰 물 같은 환경. 속이 깊고 베푸는 마음이 넓어요.',
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 결정적 매핑 #2 — 일간 오행 → 성격 키워드 4종 (P3 PERSONALITY 2×2).
//   점수는 일간 오행 + 강한 오행 카운트로 결정적 산출 (같은 사주면 항상 동일).
// ──────────────────────────────────────────────────────────────────────────

export interface TraitSeed {
  label: string;
  sub: string;
  /** 점수 칩 색상 (목업 칩 색). */
  color: string;
}

/** 일간 오행별 4개 성격 키워드(라벨·부제·칩 색). 점수는 별도 산출. */
const TRAIT_SEEDS_BY_ELEMENT: Record<Element, TraitSeed[]> = {
  목: [
    { label: '추진력', sub: '쉬지 않고 앞으로', color: '#ff4f9a' },
    { label: '성장 욕구', sub: '계속 자라려는 힘', color: '#d99020' },
    { label: '기획력', sub: '큰 그림을 그림', color: '#0f9f7a' },
    { label: '인자함', sub: '품어주는 따뜻함', color: '#5b58d6' },
  ],
  화: [
    { label: '표현력', sub: '밝게 드러냄', color: '#ff4f9a' },
    { label: '열정', sub: '한번 붙으면 끝까지', color: '#d99020' },
    { label: '직관력', sub: '빠르게 알아챔', color: '#0f9f7a' },
    { label: '사교성', sub: '주변을 환하게', color: '#5b58d6' },
  ],
  토: [
    { label: '안정감', sub: '흔들리지 않는 중심', color: '#ff4f9a' },
    { label: '신뢰', sub: '믿고 맡길 수 있음', color: '#d99020' },
    { label: '포용력', sub: '두루 품어줌', color: '#0f9f7a' },
    { label: '중재력', sub: '갈등을 풀어냄', color: '#5b58d6' },
  ],
  금: [
    { label: '결단력', sub: '한 번 정하면 끝까지', color: '#ff4f9a' },
    { label: '추진력', sub: '쉬지 않고 앞으로', color: '#d99020' },
    { label: '분석력', sub: '본질을 보는 눈', color: '#0f9f7a' },
    { label: '독립성', sub: '혼자 해내는 힘', color: '#5b58d6' },
  ],
  수: [
    { label: '지혜', sub: '깊이 생각함', color: '#ff4f9a' },
    { label: '유연성', sub: '상황에 맞게', color: '#d99020' },
    { label: '통찰력', sub: '흐름을 읽음', color: '#0f9f7a' },
    { label: '공감력', sub: '마음을 잘 읽음', color: '#5b58d6' },
  ],
};

export interface TraitScore extends TraitSeed {
  score: number;
}

/**
 * 일간 오행 + 오행 카운트로 4개 성격 키워드 점수를 결정적으로 산출.
 * 같은 사주면 항상 같은 4개 점수 (80~96, 내림차순).
 */
export function buildPersonalityTraits(
  dayElement: Element,
  elementCounts: Record<Element, number>
): TraitScore[] {
  const seeds = TRAIT_SEEDS_BY_ELEMENT[dayElement];
  const total = Object.values(elementCounts).reduce((sum, n) => sum + n, 0) || 1;
  const dayPct = (elementCounts[dayElement] ?? 0) / total; // 0~1
  // 기준점 88 ± 일간 오행 비중. 비중이 큰 사주일수록 1번 키워드가 더 강함.
  const base = 84 + Math.round(dayPct * 12); // 84~96
  // 각 키워드는 base 에서 2씩 감산해 안정적 내림차순. 80 하한.
  return seeds.map((seed, i) => ({
    ...seed,
    score: Math.max(80, Math.min(96, base - i * 2)),
  }));
}

// ──────────────────────────────────────────────────────────────────────────
// 결정적 매핑 #3 — 신살 6종 한 줄 의미 (P2/P6). 보유 여부는 신살 compute 결과로 판단.
// ──────────────────────────────────────────────────────────────────────────

export interface SinsalMeaning {
  /** 신살 풀네임 (compute 결과의 name 과 매칭 — '살' 접미 포함/제외 모두). */
  names: string[];
  hanja: string;
  label: string;
  meaning: string;
  /** P6 신살 그리드 한자 색상. */
  color: string;
}

/** 목업에 노출되는 신살 6종 (천을귀인·문창귀인·역마·도화·화개·홍염). */
export const SINSAL_DISPLAY: SinsalMeaning[] = [
  { names: ['천을귀인'], hanja: '天乙', label: '천을귀인', meaning: '귀인의 도움', color: '#ff4f9a' },
  { names: ['문창귀인'], hanja: '文昌', label: '문창귀인', meaning: '학문·문서운', color: '#0f9f7a' },
  { names: ['역마', '역마살'], hanja: '驛馬', label: '역마', meaning: '이동·변동', color: '#d99020' },
  { names: ['도화', '도화살'], hanja: '桃花', label: '도화', meaning: '인기·매력', color: '#c04de0' },
  { names: ['화개', '화개살'], hanja: '華蓋', label: '화개', meaning: '예술·종교', color: '#5b58d6' },
  { names: ['홍염', '홍염살'], hanja: '紅艶', label: '홍염', meaning: '이성·매혹', color: '#d81b72' },
];

// ──────────────────────────────────────────────────────────────────────────
// 결정적 매핑 #4 — 12개월 키워드(고정) + 결정적 월별 점수 (P7).
// ──────────────────────────────────────────────────────────────────────────

export interface MonthKeyword {
  month: number;
  keyword: string;
  desc: string;
}

/** 12개월 위상(phase) 기반 고정 키워드 (목업 동일). */
export const MONTH_KEYWORDS: MonthKeyword[] = [
  { month: 1, keyword: '정리·계획', desc: '한 해의 큰 그림 그리기' },
  { month: 2, keyword: '준비', desc: '씨앗 뿌리는 시기' },
  { month: 3, keyword: '시작', desc: '새로운 흐름 진입' },
  { month: 4, keyword: '성장', desc: '결과가 조금씩 보임' },
  { month: 5, keyword: '활동', desc: '추진력 최고조' },
  { month: 6, keyword: '점검', desc: '중간 정리 필요' },
  { month: 7, keyword: '휴식', desc: '에너지 충전 시기' },
  { month: 8, keyword: '재시작', desc: '두 번째 도약 준비' },
  { month: 9, keyword: '정점', desc: '올해의 가장 좋은 흐름' },
  { month: 10, keyword: '확장', desc: '성과 확산 시기' },
  { month: 11, keyword: '주의', desc: '관계 갈등 가능' },
  { month: 12, keyword: '마무리', desc: '다음 해 준비' },
];

export interface MonthScore {
  month: number;
  score: number;
}

/**
 * 12개월 점수를 결정적으로 산출. 일주 ganzi 문자열을 시드로 사용 — 같은 사주면 항상
 * 같은 12개 점수. 위상 곡선(상반기 상승 → 정점 → 하반기 완만)에 시드 기반 미세 변동을
 * 더해 자연스러운 라인 차트를 만든다 (난수 없음, 순수 함수).
 */
export function buildMonthlyScores(daySeed: string): MonthScore[] {
  // 시드 해시 (문자 코드 합) — 결정적.
  let hash = 0;
  for (let i = 0; i < daySeed.length; i += 1) {
    hash = (hash * 31 + daySeed.charCodeAt(i)) % 997;
  }
  // 위상별 기준 곡선 (1~12월). 5월 활동·9월 정점이 봉우리.
  const baseCurve = [58, 64, 70, 76, 82, 70, 64, 74, 90, 78, 68, 64];
  return baseCurve.map((base, idx) => {
    const month = idx + 1;
    // 시드 기반 ±4 미세 변동 (월마다 다른 결정적 값).
    const wobble = ((hash + month * 37) % 9) - 4; // -4..+4
    const score = Math.max(45, Math.min(98, base + wobble));
    return { month, score };
  });
}

/** 점수 배열에서 최고점 월 (동점이면 앞 월). P7 BEST hero. */
export function pickBestMonth(scores: MonthScore[]): MonthScore {
  return scores.reduce((best, cur) => (cur.score > best.score ? cur : best), scores[0]);
}

const MONTH_EN = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function monthEnLabel(month: number): string {
  return MONTH_EN[Math.max(0, Math.min(11, month - 1))];
}
