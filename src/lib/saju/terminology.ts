// 2026-05-14: 사주 용어를 요즘 세대가 쉽게 읽을 수 있는 일상어로 통일하는
// 중앙 글로서리. v2 interpretation builder, UI 컴포넌트, simplifySajuCopy
// 모두 여기서 정의한 매핑을 단일 소스로 사용한다.
//
// 원칙:
// 1) 단정형(반드시·100%·무조건) 표현 금지.
// 2) 한자어·전문 술어(용신·기신·격국·일간 등) → "내 기질", "도움 기운",
//    "조절할 기운" 같은 일상어로 교체.
// 3) "타고난"·"흐름"·"균형"·"기운"·"결" 같은 부드러운 단어를 우선 사용.
// 4) 정확도가 필요한 자리(검증 메시지)는 한자 술어 + 괄호 설명 병기.

import type { Element } from '@/lib/saju/types';

/** 한자/술어 → 일상어 매핑. simplifySajuCopy 가 사용. */
export const FRIENDLY_TERM_MAP: ReadonlyArray<[term: RegExp, replacement: string]> = [
  // §사주 구조 단위 (위계 큰 단어 먼저)
  [/팔자/gu, '내 사주'],
  [/원국/gu, '타고난 사주'],
  [/명식/gu, '내 사주표'],
  [/사주 구조/gu, '내 사주'],
  // 2026-05-19 B01 fix: 자기 출력 '내 사주표' 안의 '사주표' 재매치 → '내 내 내 사주표' 누적 차단
  [/(?<!내 )사주표/gu, '내 사주표'],

  // §4기둥
  [/년주/gu, '태어난 해'],
  [/월주/gu, '태어난 달'],
  [/일주(?!일)/gu, '태어난 날'],
  [/시주(?!의)/gu, '태어난 시간 묶음'],

  // §천간·지지
  [/일간(?!지)/gu, '내 핵심 기질'],
  [/일간지/gu, '태어난 날 묶음'],
  [/천간\s*십신/gu, '관계 역할'],
  [/천간/gu, '겉으로 드러나는 기운'],
  // 2026-05-19 B05 fix: 일반 동사 '커지지만' 의 '지지' 부분 매치 차단.
  //   앞에 한글이 있으면 단어 중간이므로 매치 안 함. 뒤는 조사(의/가/는 등) 허용.
  [/(?<![가-힣])지지(?!단)/gu, '안쪽 결'],
  [/지장간/gu, '숨은 기운'],

  // §운(luck)
  [/대운(?!의)/gu, '긴 흐름'],
  [/대운의 흐름/gu, '긴 흐름'],
  [/세운/gu, '올해 흐름'],
  [/월운/gu, '이번 달 흐름'],
  [/일운|일진/gu, '오늘 하루 흐름'],
  [/연운/gu, '올해 흐름'],

  // §강약/격국/용신/기신
  [/신강/gu, '에너지가 강한 편'],
  [/신약/gu, '에너지가 차분한 편'],
  [/중화(?!된)/gu, '균형이 잡힌 편'],
  [/강약 판정/gu, '컨디션 결'],
  [/강약/gu, '컨디션 균형'],
  [/격국/gu, '반복되는 삶의 역할'],
  [/조후|조후 보정/gu, '계절 균형 보정'],
  [/억부|억부 보정/gu, '강약 보정'],
  [/용신·보완축/gu, '도움이 되는 핵심 기운'],
  [/용신 후보/gu, '도움이 되는 기운 후보'],
  [/용신(?!의)/gu, '도움이 되는 핵심 기운'],
  [/희신/gu, '도움이 되는 보조 기운'],
  [/기신/gu, '조절할 기운'],

  // §십성/십신
  [/십신|십성|십성 구조/gu, '관계 역할'],
  [/정관|편관/gu, '책임·도전 역할'],
  [/정재|편재/gu, '돈·기회 역할'],
  [/식신|상관/gu, '표현·재능 역할'],
  [/정인|편인/gu, '배움·휴식 역할'],
  [/비견|겁재/gu, '동료·경쟁 역할'],

  // §관계·변화
  [/합충/gu, '만남과 변화 신호'],
  [/공망/gu, '비어있는 자리'],
  [/신살/gu, '작은 신호'],

  // §월령 등 시점
  [/월령/gu, '태어난 계절 기운'],
  [/생시 미상/gu, '태어난 시간 모를 때'],
  [/자시/gu, '한밤중 시간 구간'],
  [/주야/gu, '낮밤'],

  // §해석 부드럽게
  [/판단 기준/gu, '판단 힌트'],
  [/선택 기준/gu, '선택 힌트'],
  [/행동 기준/gu, '오늘 할 일'],
  [/풀이 기준/gu, '풀이 안내'],
  [/계산 기준/gu, '계산 정보'],
  [/명식 기준/gu, '사주 정보'],
  [/저장본 기준/gu, '저장된 정보'],
  [/기준으로는/gu, '정보로 보면'],
  [/기준으로/gu, '바탕으로'],
];

/**
 * 2026-05-15 PR 5 — 명리 용어 → 일상어 병기 사전 (50+ 항목).
 * 사주아이 reference: 풀이 본문에 명리 라벨을 살려둔 채 옆에 일상 비유를 병기.
 *  예: "비견 — 나와 비슷한 결의 사람과 함께 가는 자리. 주체성↑ 양보↓."
 * 빌더가 `term + glossaryHint(term)` 로 본문에 사용.
 *
 * 카테고리: 십성 10 + 오행 5 + 합·충·형·해 4 + 신살 6 + 12운성 12 + 격국 10 + 보조 5 = 52.
 */
export interface MyeongriGlossaryEntry {
  /** 한자 라벨. */
  hanja?: string;
  /** 일상어 한 줄 비유 (라벨 옆 ", " 뒤에 붙음). */
  plainCue: string;
  /** 분류 — UI 에서 색 분기 가능. */
  category:
    | 'tenGod'
    | 'element'
    | 'relations'
    | 'sinsal'
    | 'twelveStage'
    | 'pattern'
    | 'aux';
}

export const MYEONGRI_GLOSSARY: Record<string, MyeongriGlossaryEntry> = {
  // §십성 10
  비견: { hanja: '比肩', plainCue: '나와 비슷한 결의 사람과 함께 가는 자리 (주체성↑, 양보↓)', category: 'tenGod' },
  겁재: { hanja: '劫財', plainCue: '가까운 사람과 돈·기회를 나누다 갈등이 생기기 쉬운 결', category: 'tenGod' },
  식신: { hanja: '食神', plainCue: '꾸준히 만들어내는 힘 — 결과물·자녀·취미의 풍요', category: 'tenGod' },
  상관: { hanja: '傷官', plainCue: '재능과 표현은 강하지만 답답한 틀을 견디기 어려운 결', category: 'tenGod' },
  편재: { hanja: '偏財', plainCue: '기회와 사람을 넓게 보는 결 — 큰 돈이 드나들지만 흩어지기 쉬움', category: 'tenGod' },
  정재: { hanja: '正財', plainCue: '안정적으로 쌓는 재물 감각 — 한 번 정한 구조 오래 유지', category: 'tenGod' },
  편관: { hanja: '偏官', plainCue: '압박·책임·도전 속에서 단련되는 추진력 (긴장 누적 주의)', category: 'tenGod' },
  정관: { hanja: '正官', plainCue: '자리·책임·명예·질서를 중시하는 결 (스스로 무거워지기 쉬움)', category: 'tenGod' },
  편인: { hanja: '偏印', plainCue: '직관·깊이로 혼자 파고드는 힘 — 남다른 시각', category: 'tenGod' },
  정인: { hanja: '正印', plainCue: '돌봄·후원·배움의 결 — 누군가에게 받고 또 베푸는 인연', category: 'tenGod' },

  // §오행 5
  목: { hanja: '木', plainCue: '성장·시작·계획 — 새 일을 여는 힘', category: 'element' },
  화: { hanja: '火', plainCue: '표현·노출·인정 — 마음을 드러내는 힘', category: 'element' },
  토: { hanja: '土', plainCue: '안정·정리·기반 — 흩어진 일을 모으는 힘', category: 'element' },
  금: { hanja: '金', plainCue: '기준·결단·마무리 — 결정을 또렷이 하는 힘', category: 'element' },
  수: { hanja: '水', plainCue: '생각·휴식·정보 — 흐름을 읽고 정돈하는 힘', category: 'element' },

  // §관계 변화 합/충/형/해 4
  합: { hanja: '合', plainCue: '서로 끌어당기며 묶이는 결 — 협력·이동·결합', category: 'relations' },
  충: { hanja: '沖', plainCue: '서로 부딪치며 흔드는 결 — 변화·결단·이별', category: 'relations' },
  형: { hanja: '刑', plainCue: '갈등·송사·심리적 마찰의 결 — 안 풀리는 일', category: 'relations' },
  해: { hanja: '害', plainCue: '드러나지 않는 손해의 결 — 소모·균열', category: 'relations' },

  // §원진 (해 와 별개로 자주 사용)
  원진: { hanja: '怨嗔', plainCue: '이유 없는 서운함·날카로운 말싸움이 생기기 쉬운 결', category: 'relations' },

  // §신살 6
  양인살: { hanja: '羊刃殺', plainCue: '추진력이 엄청나지만 자칫 무리한 투자·다툼이 따르는 결', category: 'sinsal' },
  역마살: { hanja: '驛馬殺', plainCue: '이동수·해외·장거리 — 자리에서 변화가 잦은 결', category: 'sinsal' },
  도화살: { hanja: '桃花殺', plainCue: '매력·인기·사람을 끄는 힘 — 관계 빠르게 변할 수 있음', category: 'sinsal' },
  화개살: { hanja: '華蓋殺', plainCue: '예술·종교·학문 — 혼자 깊이 파고드는 결', category: 'sinsal' },
  백호살: { hanja: '白虎殺', plainCue: '큰 책임과 강한 실행력 — 사고·건강 주의 신호', category: 'sinsal' },
  괴강살: { hanja: '魁罡殺', plainCue: '강한 카리스마와 단호함 — 부드러움이 부족할 수 있음', category: 'sinsal' },

  // §12운성 12
  장생: { hanja: '長生', plainCue: '새로 태어나 자라기 시작하는 결 — 시작·시도', category: 'twelveStage' },
  목욕: { hanja: '沐浴', plainCue: '사회적으로 주목받고 매력을 발산하는 결', category: 'twelveStage' },
  관대: { hanja: '冠帶', plainCue: '책임을 처음 입어보는 결 — 자기 자리 잡기', category: 'twelveStage' },
  건록: { hanja: '建祿', plainCue: '본격적으로 자기 자리를 차지하는 결 — 안정된 힘', category: 'twelveStage' },
  제왕: { hanja: '帝旺', plainCue: '에너지가 가장 강한 정점의 결 — 과한 자신감 주의', category: 'twelveStage' },
  쇠: { hanja: '衰', plainCue: '정점 이후 힘이 가라앉기 시작하는 결 — 정리 시기', category: 'twelveStage' },
  병: { hanja: '病', plainCue: '몸과 마음이 약해지기 쉬운 결 — 회복·점검 시기', category: 'twelveStage' },
  사: { hanja: '死', plainCue: '한 챕터의 끝 — 비워내고 다음을 준비하는 결', category: 'twelveStage' },
  묘: { hanja: '墓', plainCue: '쌓아둔 것을 갈무리하는 결 — 저장·은둔', category: 'twelveStage' },
  절: { hanja: '絶', plainCue: '단절·휴지기 — 결이 끊기고 다음을 기다리는 시기', category: 'twelveStage' },
  태: { hanja: '胎', plainCue: '아직 형태가 없는 결 — 잉태·기획의 초기', category: 'twelveStage' },
  양: { hanja: '養', plainCue: '천천히 키워가는 결 — 안전한 성장기', category: 'twelveStage' },

  // §격국 10 (정격 위주)
  정관격: { hanja: '正官格', plainCue: '자리·책임을 중심으로 풀려가는 결 — 안정형', category: 'pattern' },
  편관격: { hanja: '偏官格', plainCue: '도전·압박을 추진력으로 쓰는 결 — 강한 실행형', category: 'pattern' },
  정재격: { hanja: '正財格', plainCue: '꾸준히 쌓는 재물형 — 안정 축적', category: 'pattern' },
  편재격: { hanja: '偏財格', plainCue: '큰 기회·움직이는 재물형 — 확장형', category: 'pattern' },
  식신격: { hanja: '食神格', plainCue: '꾸준한 표현·결과물 중심의 결', category: 'pattern' },
  상관격: { hanja: '傷官格', plainCue: '재능과 표현의 결 — 프레임 깨는 힘', category: 'pattern' },
  정인격: { hanja: '正印格', plainCue: '배움·도움·후원 중심의 결', category: 'pattern' },
  편인격: { hanja: '偏印格', plainCue: '직관·전문성·고독한 깊이의 결', category: 'pattern' },
  비견격: { hanja: '比肩格', plainCue: '자기 색이 강한 결 — 협력보다 주도', category: 'pattern' },
  건록격: { hanja: '建祿格', plainCue: '본인 자리에 단단히 서는 결 — 안정·자립', category: 'pattern' },

  // §보조 5 (자주 함께 등장)
  재다신약: { hanja: '財多身弱', plainCue: '재물 기회는 많지만 본인 에너지가 약한 결 — 파트너십 필요', category: 'aux' },
  식신생재: { hanja: '食神生財', plainCue: '꾸준한 표현이 돈으로 이어지는 결 — 일과 수익이 연결', category: 'aux' },
  관살혼잡: { hanja: '官殺混雜', plainCue: '책임과 도전이 한꺼번에 들어오는 복잡한 결 — 우선순위 필요', category: 'aux' },
  비겁태왕: { hanja: '比劫太旺', plainCue: '주체성이 너무 강해 양보와 협력이 어려운 결', category: 'aux' },
  병신합: { hanja: '丙辛合', plainCue: '한 가지에 꽂히면 끝장을 봐야 하는 집중력의 결', category: 'aux' },
};

/** 명리 용어에 일상 비유를 ", " 뒤에 붙여 반환. 미등록 용어는 그대로. */
export function glossaryHint(term: string): string {
  const entry = MYEONGRI_GLOSSARY[term];
  if (!entry) return term;
  return `${term}(${entry.plainCue})`;
}

/** 검증·로그 메시지에서는 한자 술어 + 친절 설명을 병기한다. */
export const FRIENDLY_VERIFICATION_LABEL: Record<string, string> = {
  pillars: '4 기둥(태어난 해·달·날·시간)',
  'pillars.year': '태어난 해 묶음',
  'pillars.month': '태어난 달 묶음',
  'pillars.day': '태어난 날 묶음',
  'pillars.hour': '태어난 시간 묶음',
  dayMaster: '내 핵심 기질',
  'dayMaster.stem': '내 핵심 기질(천간)',
  'dayMaster.element': '내 핵심 기질의 오행',
  fiveElements: '다섯 가지 기운(목·화·토·금·수)',
  'fiveElements.dominant': '가장 강한 기운',
  'fiveElements.weakest': '가장 약한 기운',
  'fiveElements.byElement': '다섯 기운 분포',
  strength: '컨디션 균형(강약)',
  'strength.score': '컨디션 점수',
  'strength.level': '컨디션 단계',
  yongsin: '도움이 되는 핵심 기운',
  'yongsin.primary': '1순위 도움 기운',
  'yongsin.candidates': '도움 기운 후보',
  'yongsin.confidence': '풀이 확신도',
  'yongsin.kiyshin': '조절할 기운',
  majorLuck: '긴 흐름(10년 단위)',
  currentLuck: '지금 흐르는 운',
  'metadata.calculatedAt': '계산한 시각',
  interpretation: '풀이 본문',
};

/** 오행의 일상어 라벨 (한자 병기 없이 부드럽게). */
export const FRIENDLY_ELEMENT_LABEL: Record<Element, string> = {
  목: '나무 기운',
  화: '불 기운',
  토: '땅 기운',
  금: '쇠 기운',
  수: '물 기운',
};

/** 오행 한 줄 키워드 — 사용자가 "이게 뭐예요" 했을 때 1초로 이해되는 문장.
 *  2026-05-16 — 본문과 자연스럽게 이어지도록 동사형으로 다듬음. */
export const FRIENDLY_ELEMENT_HINT: Record<Element, string> = {
  목: '새로 시작하고 추진하는 힘',
  화: '마음을 꺼내고 활력을 더하는 힘',
  토: '흔들리지 않게 중심을 잡는 힘',
  금: '결단하고 매듭짓는 힘',
  수: '깊이 사고하고 유연하게 흐르는 힘',
};

/** 강도 라벨. SajuStrength.level 의 친절 버전. */
export const FRIENDLY_STRENGTH_LABEL: Record<'신강' | '중화' | '신약', string> = {
  신강: '에너지가 강한 편',
  중화: '균형이 잡힌 편',
  신약: '에너지가 차분한 편',
};

/**
 * 2026-05-14: 경계값 근접 표기.
 * - 신강 임계 score >= 67, 신약 임계 score <= 43.
 * - 중화 안에서도 60~66 은 "신강에 가까운 중화", 44~50 은 "신약에 가까운 중화"
 *   라고 표기해 사용자가 결을 더 정확히 인식할 수 있도록 한다.
 */
export const STRENGTH_BOUNDARY = {
  STRONG_THRESHOLD: 67,
  WEAK_THRESHOLD: 43,
  NEAR_STRONG_MIN: 60,
  NEAR_WEAK_MAX: 50,
} as const;

export type StrengthBucket =
  | '신강'
  | '신강에 가까운 중화'
  | '중화'
  | '신약에 가까운 중화'
  | '신약';

export function classifyStrengthBucket(
  level: '신강' | '중화' | '신약',
  score: number
): StrengthBucket {
  if (level === '신강') return '신강';
  if (level === '신약') return '신약';
  // level === '중화'
  if (score >= STRENGTH_BOUNDARY.NEAR_STRONG_MIN) return '신강에 가까운 중화';
  if (score <= STRENGTH_BOUNDARY.NEAR_WEAK_MAX) return '신약에 가까운 중화';
  return '중화';
}

export const FRIENDLY_STRENGTH_BUCKET_LABEL: Record<StrengthBucket, string> = {
  신강: '에너지가 강한 편',
  '신강에 가까운 중화': '균형이지만 강한 편에 가까움',
  중화: '균형이 잡힌 편',
  '신약에 가까운 중화': '균형이지만 차분한 편에 가까움',
  신약: '에너지가 차분한 편',
};

/** 화면 노출용 (한자 술어 + 친근 표현 병기). UI 가 두 줄 또는 괄호로 쓸 수 있게. */
export function formatStrengthDisplay(level: '신강' | '중화' | '신약', score: number) {
  const bucket = classifyStrengthBucket(level, score);
  return {
    bucket,
    /** 한자 술어 풀어 쓴 형태 — 본문 들어가는 자연어 */
    label: bucket, // 예: "신강에 가까운 중화"
    /** 친근 표현 — pill / 배지에 쓰는 짧은 라벨 */
    friendly: FRIENDLY_STRENGTH_BUCKET_LABEL[bucket],
    score,
  };
}

/** YongsinConfidence("높음"|"중간"|"낮음") → 친절 표현. */
export const FRIENDLY_CONFIDENCE_LABEL: Record<string, string> = {
  높음: '꽤 확실',
  중간: '비교적 확실',
  낮음: '참고용',
};

/** UI 에서 자주 쓰는 블록/배지 라벨. v2 interpretation 의 block 라벨 통일용. */
export const FRIENDLY_BLOCK_LABEL = {
  foundation: '내 타고난 결',
  balance: '다섯 기운 균형',
  yongsin: '잘 풀리게 도와주는 기운',
  luck: '지금 흐르는 운',
} as const;

/** v2 panel 의 evidence 패널, claims 패널 등에 쓰이는 보조 라벨. */
export const FRIENDLY_UI_LABEL = {
  evidenceShow: '왜 그렇게 풀이됐는지 보기',
  evidenceHide: '풀이 근거 닫기',
  evidenceCount: (n: number) => `왜 그런지 보기 · ${n}개 근거`,
  confidenceLabel: '이 풀이의 확신도',
  nextStepsTitle: '오늘부터 작게 해볼 일',
  disclaimers: '읽기 전에 알아두세요',
  verificationPass: '풀이 점검 통과',
  verificationWarning: '풀이 점검 — 작은 경고',
  verificationFail: '풀이 점검 실패',
  caveatPrefix: '주의해서 읽기',
  antiClaimsTitle: '이렇게 말하진 않아요',
  blockDefaultEyebrow: '풀이 한 줄',
} as const;

/** 한자 path 를 일상어 라벨로 변환. */
export function getFriendlyVerificationLabel(path: string, fallbackLabel?: string): string {
  return FRIENDLY_VERIFICATION_LABEL[path] ?? fallbackLabel ?? path;
}

/** 단정형·위험 단어 패턴 — interpretation builder 에서 사용 금지. */
export const PROHIBITED_TERMS = [
  '반드시',
  '100%',
  '무조건',
  '결정적',
  '확실히 일어',
  '죽음',
  '수명',
  '암 확정',
  '합격 보장',
  '당첨 보장',
  '투자 수익 보장',
];

/** 오행별 "오늘부터 작게 해볼 일" — 친근하고 행동 단위로. */
export const FRIENDLY_ELEMENT_ACTIONS: Record<Element, string[]> = {
  목: [
    '작은 새 일 한 가지를 가볍게 시작하기',
    '책·강의·산책 같은 자라는 시간을 캘린더에 고정하기',
    '스트레칭이나 짧은 산책으로 몸의 시동 켜기',
  ],
  화: [
    '오늘 할 말을 3문장으로 미리 정리하기',
    '아침 햇빛 보기 · 짧은 유산소로 기운 끌어올리기',
    '작게 잘된 일을 가까운 사람에게 가볍게 공유하기',
  ],
  토: [
    '할 일·돈·약속을 한 화면에 모아두기',
    '반복되는 일을 체크리스트로 만들어 머리 비우기',
    '관계·일에서 "여기까지" 선을 한 줄로 정리해두기',
  ],
  금: [
    '우선순위를 오늘 3개 이하로만 좁히기',
    '필요 없어진 일·관계·물건을 정리하는 짧은 시간 두기',
    '내일 할 일을 자기 전에 한 번만 검토하고 자기',
  ],
  수: [
    '잠 자는 시간을 먼저 잡고 나머지를 끼워 넣기',
    '큰 결정 전에 자료를 정리해 두고 하루 묵히기',
    '혼자 조용히 생각할 30분 블록을 미리 빼두기',
  ],
};
