import {
  loadSajuDataV2,
  type SajuDataV1,
  type SajuDataV2,
} from '@/domain/saju/engine';
import { buildSajuReport } from '@/domain/saju/report/build-report';
import { COMPATIBILITY_RESULT_LABELS, type CompatibilityRelationshipSlug } from '@/content/moonlight';
import { CONTROLS, ELEMENT_INFO, GENERATES, getLuckyElementsFromSajuData } from '@/lib/saju/elements';
import { branchCharToKorean, stemCharToKorean } from '@/lib/saju/ganzi-korean';
import { josa } from '@/lib/saju/pdf-report-maps';
import type { BirthInput, Branch, Element, Stem } from '@/lib/saju/types';

// 2026-05-23: naming-policy §5 (본문 한자 0개) + 받침 조사 정합.
//   궁합 본문은 simplifySajuCopy 를 거치지 않으므로, 일간(천간)·일지(지지)를 한글로
//   노출하고 동적 조사는 josa() 로 붙인다. 戊(무)·己(기)·癸(계) 등 받침 없는 일간 뒤에
//   '과/은/을' 이 붙던 버그(예: "戊과 己은")를 정정.
function stemKo(stem: Stem): string {
  return stemCharToKorean(stem);
}
function branchKo(branch: Branch): string {
  return branchCharToKorean(branch);
}

const STEM_SEQUENCE: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCH_SEQUENCE: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const STEM_COMBINATIONS = new Map<string, string>([
  ['甲-己', '토'],
  ['乙-庚', '금'],
  ['丙-辛', '수'],
  ['丁-壬', '목'],
  ['戊-癸', '화'],
]);

const STEM_CLASHES = new Set<string>(['甲-庚', '乙-辛', '丙-壬', '丁-癸']);

const BRANCH_SIX_HARMONIES = new Map<string, string>([
  ['子-丑', '토'],
  ['寅-亥', '목'],
  ['卯-戌', '화'],
  ['辰-酉', '금'],
  ['巳-申', '수'],
  ['午-未', '토'],
]);

const BRANCH_CLASHES = new Set<string>(['子-午', '丑-未', '寅-申', '卯-酉', '辰-戌', '巳-亥']);
const BRANCH_HARMS = new Set<string>(['子-未', '丑-午', '寅-巳', '卯-辰', '申-亥', '酉-戌']);
const BRANCH_BREAKS = new Set<string>(['子-酉', '卯-午', '辰-丑', '未-戌', '寅-亥', '巳-申']);
const BRANCH_PUNISHMENTS = new Set<string>([
  '寅-巳',
  '巳-申',
  '寅-申',
  '丑-未',
  '未-戌',
  '丑-戌',
  '子-卯',
  '辰-辰',
  '午-午',
  '酉-酉',
  '亥-亥',
]);

const HALF_HARMONIES = new Map<string, string>([
  ['申-子', '수 반합'],
  ['子-辰', '수 반합'],
  ['亥-卯', '목 반합'],
  ['卯-未', '목 반합'],
  ['寅-午', '화 반합'],
  ['午-戌', '화 반합'],
  ['巳-酉', '금 반합'],
  ['酉-丑', '금 반합'],
]);

const RELATIONSHIP_LENS: Record<
  CompatibilityRelationshipSlug,
  {
    title: string;
    positive: string;
    caution: string;
    practice: string;
  }
> = {
  lover: {
    title: '감정의 속도와 말투',
    positive: '좋아하는 마음을 주고받는 온도와 가까워지는 속도를 함께 봅니다.',
    caution: '서운함이 커질 때 누가 바로 말하고, 누가 시간을 벌고 싶어 하는지 확인하는 것이 중요합니다.',
    practice: '감정 확인, 연락 빈도, 말할 타이밍을 맞추는 쪽으로 풀어가면 관계가 훨씬 안정됩니다.',
  },
  family: {
    title: '역할 기대와 말의 무게',
    positive: '정과 책임이 이미 깔린 관계라, 기본 인연이 이어지는 힘을 먼저 봅니다.',
    caution: '가까운 사이일수록 충고와 간섭이 한 덩어리로 들릴 수 있어 말의 무게를 조절해야 합니다.',
    practice: '가르치려는 말보다 확인과 공감의 말을 먼저 두는 편이 가족 관계에는 더 잘 맞습니다.',
  },
  friend: {
    title: '편안함과 거리감의 균형',
    positive: '편하게 이어지는 관계는 리듬이 맞고 서로 부담이 적은 지점이 분명합니다.',
    caution: '친한 사이라도 기대가 말보다 앞서면 서운함이 쌓이기 쉽습니다.',
    practice: '연락 빈도, 부탁의 선, 돈 이야기의 타이밍을 분명히 할수록 오래 갑니다.',
  },
  partner: {
    title: '역할 분담과 결정 속도',
    positive: '함께 일하는 궁합은 누가 앞에서 열고 누가 뒤에서 정리하는지가 맞을 때 힘이 납니다.',
    caution: '판단 속도와 돈을 보는 감각이 다르면 신뢰보다 피로가 먼저 쌓일 수 있습니다.',
    practice: '의사결정 원칙, 책임 범위, 돈 흐름을 초반에 분명히 나누는 것이 핵심입니다.',
  },
};

const RELATIONSHIP_HINTS = [
  '생년월일은 두 사람 모두 필수입니다.',
  '태어난 시간은 속마음, 생활 리듬, 세부 충돌 포인트를 더 정밀하게 봐줍니다.',
  '출생지와 분 정보가 있으면 경도 보정까지 반영해 더 정확하게 읽을 수 있습니다.',
  '관계 유형을 함께 알아야 같은 궁합도 연인, 가족, 친구, 동업 관계에 맞게 다르게 풀이할 수 있습니다.',
] as const;

export interface CompatibilityPerson {
  name: string;
  birthInput: BirthInput;
}

export interface CompatibilityEvidenceItem {
  title: string;
  body: string;
}

export interface CompatibilityPracticalCard {
  key: 'conflict' | 'communication' | 'money' | 'distance';
  eyebrow: string;
  title: string;
  summary: string;
  practice: string;
  tone: 'coral' | 'sky' | 'gold' | 'jade';
}

/**
 * 2026-05-23 — 유료 §8 "깊은 풀이" 섹션. 무료 화면(§4~6)은 "두 사람이 어떤지"(summary)
 * 까지만 보여주고, 결제 후에는 각 축의 "그래서 어떻게 하면 되는지"(practice)를
 * 커플별로 풀어준다. 관계유형별 정적 텍스트가 아니라 두 명식에서 파생되므로 커플마다 다르다.
 * (②-b: 플래그 ON 시 LLM 이 더 깊은 버전으로 이 배열을 대체한다. 이것이 그 fallback.)
 */
export interface CompatibilityDeepSection {
  key: string;
  title: string;
  body: string;
  /**
   * 이 축 풀이의 사주 근거 한 줄. 결정론 경로에서만 채운다.
   * LLM 경로(compatibility-interpretation-types.ts)와 동형 유지를 위해 옵셔널.
   */
  evidence?: string;
}

export interface CompatibilityInterpretation {
  relationship: CompatibilityRelationshipSlug;
  label: string;
  score: number;
  scoreLabel: string;
  selfData: SajuDataV1 | SajuDataV2;
  partnerData: SajuDataV1 | SajuDataV2;
  headline: string;
  summary: string;
  supportiveSummary: string;
  cautionSummary: string;
  practiceSummary: string;
  currentFlowSummary: string;
  evidence: CompatibilityEvidenceItem[];
  practicalCards: CompatibilityPracticalCard[];
  deepSections: CompatibilityDeepSection[];
  dataNote: string | null;
  relationshipLensTitle: string;
  relationshipLensBody: string;
}

const COMMUNICATION_STYLES: Record<
  Element,
  { label: string; summary: string; need: string; caution: string }
> = {
  목: {
    label: '방향부터 먼저 꺼내는 편',
    summary: '핵심 방향과 가능성을 먼저 말해야 답답함이 풀리는 타입입니다.',
    need: '결론이 아직 아니어도 어디로 가는 이야기인지 먼저 알려주면 마음이 놓입니다.',
    caution: '상대가 천천히 정리하는 타입이면 다그친다고 느껴질 수 있습니다.',
  },
  화: {
    label: '반응과 온도가 빠른 편',
    summary: '표정과 말투의 온도를 빨리 읽고, 반응도 바로 돌아오길 바라는 타입입니다.',
    need: '짧게라도 바로 반응해 주면 마음이 풀립니다.',
    caution: '답이 늦거나 무덤덤하면 내용보다 태도에 먼저 서운함이 올라오기 쉽습니다.',
  },
  토: {
    label: '정리와 안정이 먼저인 편',
    summary: '감정만 앞세우기보다 현실적인 원칙과 생활 맥락을 함께 확인해야 편안해지는 타입입니다.',
    need: '말의 뜻과 앞으로의 원칙을 같이 들으면 신뢰가 생깁니다.',
    caution: '상대는 공감이 필요한데 원칙만 말하면 차갑게 들릴 수 있습니다.',
  },
  금: {
    label: '원칙과 결론을 분명히 하려는 편',
    summary: '말을 길게 돌리기보다 핵심과 원칙을 선명하게 잡을 때 안심하는 타입입니다.',
    need: '중요한 대화일수록 조건, 약속, 범위를 문장으로 남기면 편합니다.',
    caution: '좋은 뜻으로 정리한 말도 상대에게는 평가나 지적으로 들릴 수 있습니다.',
  },
  수: {
    label: '생각을 모은 뒤 말하는 편',
    summary: '겉반응보다 속마음을 먼저 정리하고 나서 말을 꺼내는 타입입니다.',
    need: '바로 답을 요구하기보다 생각할 시간을 주면 오히려 더 진솔해집니다.',
    caution: '말수가 줄면 무심해 보일 수 있어, 침묵의 뜻을 오해받기 쉽습니다.',
  },
};

const MONEY_STYLES: Record<Element, { label: string; summary: string; caution: string }> = {
  목: {
    label: '성장과 확장 쪽에 돈을 쓰는 편',
    summary: '배움, 기회, 사람 연결처럼 앞으로 늘어날 가능성이 보이면 지출을 긍정적으로 보는 흐름입니다.',
    caution: '좋은 명분이 많아질수록 실제 유지 비용 점검이 늦어질 수 있습니다.',
  },
  화: {
    label: '속도와 체감이 있는 곳에 돈을 쓰는 편',
    summary: '바로 체감되는 만족, 관계의 분위기, 눈에 띄는 변화에 돈이 움직이기 쉬운 흐름입니다.',
    caution: '기분이 올라간 날의 결제가 반복되면 생각보다 지출 피로가 빨리 쌓일 수 있습니다.',
  },
  토: {
    label: '안정과 생활 기반을 먼저 보는 편',
    summary: '생활비, 고정비, 집안의 기반처럼 오래 유지될 구조에 돈을 두는 쪽이 마음이 놓이는 흐름입니다.',
    caution: '안전을 중시하다 필요한 변화나 투자까지 너무 늦출 수 있습니다.',
  },
  금: {
    label: '원칙과 효율을 따져 돈을 쓰는 편',
    summary: '가격, 품질, 조건, 약속이 선명해야 지출 결정을 편하게 내리는 흐름입니다.',
    caution: '선택이 분명한 만큼 상대는 계산적이거나 차갑다고 느낄 수 있습니다.',
  },
  수: {
    label: '비교와 유보를 거쳐 돈을 쓰는 편',
    summary: '자료를 더 모으고 흐름을 한 번 더 보면서 지출을 늦추는 쪽이 기본값에 가깝습니다.',
    caution: '판단을 오래 미루면 필요한 결제까지 타이밍을 놓치거나 답답함을 살 수 있습니다.',
  },
};

const DISTANCE_STYLES: Record<Element, { label: string; summary: string; caution: string }> = {
  목: {
    label: '자주 움직이며 연결될 때 안정되는 편',
    summary: '연락과 만남의 흐름이 너무 끊기지 않아야 관계가 살아 있다고 느끼는 편입니다.',
    caution: '연결이 뜸해지면 생각보다 빨리 관계 온도가 식었다고 받아들일 수 있습니다.',
  },
  화: {
    label: '반응과 말이 가까울수록 안심하는 편',
    summary: '마음이 보이는 말과 빠른 반응이 있을 때 관계의 온도를 신뢰하는 편입니다.',
    caution: '말이 줄면 실제 거리보다 훨씬 멀어졌다고 느끼기 쉽습니다.',
  },
  토: {
    label: '정해진 리듬이 있을 때 편안한 편',
    summary: '자주가 아니라도 꾸준한 패턴이 있으면 관계를 안정적으로 느끼는 편입니다.',
    caution: '약속된 리듬이 깨지면 작은 변화도 크게 불안하게 읽을 수 있습니다.',
  },
  금: {
    label: '개인 공간이 있어야 편안한 편',
    summary: '가까워도 각자 정리할 시간과 선이 남아 있어야 관계가 오래 간다고 느끼는 편입니다.',
    caution: '상대가 자주 확인받고 싶어 하면 차갑거나 벽이 있다고 보일 수 있습니다.',
  },
  수: {
    label: '감정을 가라앉힐 여백이 필요한 편',
    summary: '바로 붙어서 해결하기보다 생각과 감정을 정리할 시간이 있을 때 더 편안해지는 편입니다.',
    caution: '시간을 달라는 뜻이 회피처럼 보이면 서운함이 길게 남을 수 있습니다.',
  },
};

const RELATIONSHIP_PRACTICE_GUIDES: Record<
  CompatibilityRelationshipSlug,
  {
    conflict: string;
    communication: string;
    money: string;
    distance: string;
  }
> = {
  lover: {
    conflict: '감정이 올라온 날엔 답부터 요구하지 말고, 서운했던 장면 하나만 먼저 꺼내는 방식이 훨씬 잘 맞습니다.',
    communication: '연애에서는 큰 결론보다 짧은 확인과 따뜻한 말투가 먼저 들어가야 대화가 풀립니다.',
    money: '데이트 비용, 선물, 큰 지출은 분위기 따라 즉흥으로 정하지 말고 원칙을 짧게라도 미리 합의해 두는 편이 좋습니다.',
    distance: '연락 빈도와 혼자 쉬는 시간의 약속을 먼저 맞춰 두면 괜한 서운함이 크게 줄어듭니다.',
  },
  family: {
    conflict: '가족 관계는 맞는 말보다 듣기 쉬운 말이 더 중요합니다. 지적보다 부탁 형식으로 말하면 갈등이 훨씬 덜 커집니다.',
    communication: '가르치려는 말보다 확인과 공감을 먼저 두면 가족 사이의 말이 훨씬 부드럽게 들어갑니다.',
    money: '생활비, 지원, 선물, 회비처럼 반복되는 돈은 정과 의리만 믿고 넘기지 말고 원칙을 분명히 하는 편이 좋습니다.',
    distance: '가까운 사이라도 간섭의 빈도와 도움 요청의 선을 정해두면 관계가 오래 편안합니다.',
  },
  friend: {
    conflict: '친구 사이는 기대를 말로 바꾸는 순간이 중요합니다. 부탁과 서운함을 한 문장에 섞지 않는 편이 좋습니다.',
    communication: '친구 관계는 무거운 대화보다 가벼운 확인과 솔직한 한마디가 더 오래 갑니다.',
    money: '빌려주고 받는 돈, 회비, 선물, 여행비는 친하다는 이유로 흐리지 말고 먼저 맞추는 편이 안전합니다.',
    distance: '연락이 뜸해도 괜찮은 약속과 꼭 챙겨야 하는 순간을 나눠 두면 서운함이 적습니다.',
  },
  partner: {
    conflict: '함께 일하는 사이는 감정 토론보다 원칙 정리가 먼저입니다. 누가 무엇을 언제까지 맡는지 문장으로 남기세요.',
    communication: '업무 파트너 관계는 말의 온도보다 전달 순서와 결론의 명확함이 더 중요하게 작동합니다.',
    money: '비용 분담, 수익 조건, 정산 시점은 초반에 문서나 메모로 남겨야 신뢰가 오래 갑니다.',
    distance: '보고 주기와 개인 판단 범위를 정해두면 과한 간섭이나 방치처럼 느껴지는 일을 줄일 수 있습니다.',
  },
};

function canonicalPairKey<T extends string>(left: T, right: T, order: readonly T[]) {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  return leftIndex <= rightIndex ? `${left}-${right}` : `${right}-${left}`;
}

function clampScore(value: number) {
  return Math.max(52, Math.min(92, Math.round(value)));
}

function formatElementLabel(element: Element) {
  return ELEMENT_INFO[element].name;
}

function summarizeElementInteraction(selfData: SajuDataV1 | SajuDataV2, partnerData: SajuDataV1 | SajuDataV2) {
  const selfElement = selfData.dayMaster.element;
  const partnerElement = partnerData.dayMaster.element;

  if (selfElement === partnerElement) {
    return {
      label: '같은 성향의 일간',
      score: 6,
      summary: `두 분의 일간은 모두 ${formatElementLabel(selfElement)}이라 기본 기질과 반응 속도가 비슷한 편입니다.`,
      caution: '서로를 빨리 이해하는 대신, 비슷한 약점도 같이 커질 수 있습니다.',
    };
  }

  if (GENERATES[selfElement] === partnerElement) {
    return {
      label: '내가 상대를 북돋우는 흐름',
      score: 8,
      // 2026-05-23: formatElementLabel 이 이미 '… 기운' 포함 → ' 기운이' 덧붙이면
      //   '화 기운 기운이' 중복. 라벨 뒤 조사만(기운 받침ㄴ → 이).
      summary: `${formatElementLabel(selfElement)}이 ${formatElementLabel(partnerElement)}을 생하는 구조라, 내가 상대를 살려주는 흐름이 있습니다.`,
      caution: '한쪽이 늘 먼저 맞춰주면 피로가 누적될 수 있어 주고받는 균형을 봐야 합니다.',
    };
  }

  if (GENERATES[partnerElement] === selfElement) {
    return {
      label: '상대가 나를 북돋우는 흐름',
      score: 8,
      summary: `${formatElementLabel(partnerElement)}이 ${formatElementLabel(selfElement)}을 생해, 상대가 나를 받쳐주는 흐름이 있습니다.`,
      caution: '의지하는 쪽과 책임지는 쪽이 고정되면 관계 온도가 한쪽으로 기울 수 있습니다.',
    };
  }

  if (CONTROLS[selfElement] === partnerElement) {
    return {
      label: '내가 상대를 세게 누를 수 있는 흐름',
      score: -6,
      summary: `${formatElementLabel(selfElement)}이 ${formatElementLabel(partnerElement)}을 극하는 관계라, 내 말과 판단이 상대에게 압박으로 들리기 쉽습니다.`,
      caution: '의도는 좋아도 강하게 밀면 상대는 간섭이나 지적으로 받아들일 수 있습니다.',
    };
  }

  return {
    label: '상대가 나를 세게 누를 수 있는 흐름',
    score: -6,
    summary: `${formatElementLabel(partnerElement)}이 ${formatElementLabel(selfElement)}을 극하는 관계라, 상대의 방식이 내게는 답답함이나 통제로 느껴질 수 있습니다.`,
    caution: '속도와 약속 차이를 먼저 인정하지 않으면 작은 일도 금방 예민해질 수 있습니다.',
  };
}

function summarizeStemInteraction(selfStem: Stem, partnerStem: Stem) {
  const selfKo = stemKo(selfStem);
  const partnerKo = stemKo(partnerStem);

  if (selfStem === partnerStem) {
    return {
      score: 4,
      title: '일간이 같은 관계',
      body: `두 분 모두 ${selfKo} 일간이라 세상을 읽는 기본 프레임이 비슷합니다. 공감은 빠르지만 양보하지 않는 지점도 닮아 있을 수 있습니다.`,
      kind: 'same' as const,
    };
  }

  const pairKey = canonicalPairKey(selfStem, partnerStem, STEM_SEQUENCE);
  const combined = STEM_COMBINATIONS.get(pairKey);

  if (combined) {
    return {
      score: 6,
      title: '일간 천간합이 잡히는 관계',
      body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 천간합으로 묶여 기본적으로 서로를 붙잡아 주는 힘이 있습니다. 관계를 이어가려는 의지는 비교적 강한 편입니다.`,
      kind: 'harmony' as const,
    };
  }

  if (STEM_CLASHES.has(pairKey)) {
    return {
      score: -5,
      title: '일간 충이 걸리는 관계',
      body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 생각을 진행하는 속도가 달라, 결정을 빨리 내릴수록 마찰이 생기기 쉽습니다.`,
      kind: 'clash' as const,
    };
  }

  return {
    score: 0,
    title: '일간의 성향은 다르지만 보완 여지가 있는 관계',
    body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 같은 방식으로 움직이지는 않지만, 차이를 이해하면 오히려 역할 분담이 선명해질 수 있습니다.`,
    kind: 'complement' as const,
  };
}

function summarizeBranchInteraction(selfBranch: Branch, partnerBranch: Branch) {
  const pairKey = canonicalPairKey(selfBranch, partnerBranch, BRANCH_SEQUENCE);
  const selfKo = branchKo(selfBranch);
  const partnerKo = branchKo(partnerBranch);
  const items: Array<{ label: string; detail: string; score: number }> = [];

  const sixHarmony = BRANCH_SIX_HARMONIES.get(pairKey);
  if (sixHarmony) {
    items.push({
      label: '육합',
      detail: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 육합으로 묶여 기본 정이 이어지는 편입니다.`,
      score: 12,
    });
  }

  if (BRANCH_CLASHES.has(pairKey)) {
    items.push({
      label: '충',
      detail: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 충이 있어 부딪힐 때 정면으로 맞서는 경향이 있습니다.`,
      score: -14,
    });
  }

  if (BRANCH_PUNISHMENTS.has(pairKey)) {
    items.push({
      label: '형',
      detail: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 형 관계가 있어 긴장과 압박이 누적되기 쉽습니다.`,
      score: -10,
    });
  }

  if (BRANCH_BREAKS.has(pairKey)) {
    items.push({
      label: '파',
      detail: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 파 관계라 기대가 어긋날 때 틈이 크게 느껴질 수 있습니다.`,
      score: -8,
    });
  }

  if (BRANCH_HARMS.has(pairKey)) {
    items.push({
      label: '해',
      detail: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 해 관계로 겉보다 속피로가 오래 남기 쉽습니다.`,
      score: -8,
    });
  }

  const halfHarmony = HALF_HARMONIES.get(pairKey);
  if (halfHarmony) {
    items.push({
      label: '반합',
      detail: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} ${halfHarmony}으로 이어져, 함께 움직일 때 자연스러운 합이 생길 수 있습니다.`,
      score: 8,
    });
  }

  if (items.length === 0) {
    return {
      totalScore: 0,
      supportive: null,
      caution: null,
      body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 큰 합충보다 생활 리듬과 말투 차이가 더 중요하게 작동하는 관계입니다.`,
    };
  }

  return {
    totalScore: items.reduce((sum, item) => sum + item.score, 0),
    supportive: items.find((item) => item.score > 0) ?? null,
    caution: items.find((item) => item.score < 0) ?? null,
    body: items.map((item) => `${item.label}: ${item.detail}`).join(' '),
  };
}

function summarizeElementBalance(selfData: SajuDataV1 | SajuDataV2, partnerData: SajuDataV1 | SajuDataV2) {
  const selfLucky = getLuckyElementsFromSajuData(selfData);
  const partnerLucky = getLuckyElementsFromSajuData(partnerData);
  const sharedLucky = selfLucky.filter((element) => partnerLucky.includes(element));
  const complement =
    selfData.fiveElements.weakest === partnerData.fiveElements.dominant ||
    partnerData.fiveElements.weakest === selfData.fiveElements.dominant;
  const sameWeakness = selfData.fiveElements.weakest === partnerData.fiveElements.weakest;

  let score = 0;
  const lines: string[] = [];

  if (sharedLucky.length > 0) {
    score += 5;
    // 2026-05-23: formatElementLabel 이 이미 '… 기운' 을 포함하므로 ' 기운을' 을
    //   덧붙이면 '수 기운 기운을' 중복이 된다. 라벨 뒤엔 조사만 붙인다.
    lines.push(`두 분 모두 ${sharedLucky.map(formatElementLabel).join(' · ')}을 살릴 때 관계가 편안해집니다.`);
  }

  if (complement) {
    score += 4;
    lines.push('한쪽의 강한 오행이 다른 쪽의 약한 부분을 메워주는 보완점이 있습니다.');
  }

  if (sameWeakness) {
    score -= 3;
    lines.push(`두 분 모두 ${formatElementLabel(selfData.fiveElements.weakest)} 축이 약해 같은 지점에서 함께 흔들릴 수 있습니다.`);
  }

  if (lines.length === 0) {
    lines.push('오행 분포는 한쪽이 압도적으로 끌고 가기보다 조율을 통해 균형을 맞추는 타입입니다.');
  }

  return {
    score,
    body: lines.join(' '),
  };
}

function inferCurrentFlowSummary(
  relationship: CompatibilityRelationshipSlug,
  selfInput: BirthInput,
  selfData: SajuDataV1 | SajuDataV2,
  partnerInput: BirthInput,
  partnerData: SajuDataV1 | SajuDataV2
) {
  const selfReport = buildSajuReport(selfInput, selfData, 'relationship');
  const partnerReport = buildSajuReport(partnerInput, partnerData, 'relationship');
  const average = Math.round(
    ((selfReport.scores.find((item) => item.key === 'relationship')?.score ?? 70) +
      (partnerReport.scores.find((item) => item.key === 'relationship')?.score ?? 70)) /
      2
  );

  const prefix =
    relationship === 'partner'
      ? '지금은 함께 일하는 흐름에서'
      : relationship === 'lover'
        ? '지금은 감정 교류의 흐름에서'
        : '지금은 관계의 흐름에서';

  return average >= 78
    ? `${prefix} 먼저 짧게 말을 건네도 답이 돌아오기 쉬운 때입니다. ${selfReport.primaryAction.description}`
    : `${prefix} 결론을 서두르기보다 온도와 속도를 먼저 맞추는 편이 좋습니다. ${partnerReport.cautionAction.description}`;
}

function buildHeadline(
  relationship: CompatibilityRelationshipSlug,
  label: string,
  score: number,
  selfName: string,
  partnerName: string
) {
  const relationshipWord =
    relationship === 'lover'
      ? '감정선'
      : relationship === 'family'
        ? '가족 같은 분위기'
        : relationship === 'friend'
          ? '사람 사이의 호흡'
          : '함께 움직이는 힘';

  if (score >= 80) {
    return `${selfName}님과 ${partnerName}님은 ${relationshipWord}이 비교적 잘 맞는 편입니다.`;
  }

  if (score >= 70) {
    return `${selfName}님과 ${partnerName}님은 다름이 있지만 맞춰갈 여지가 충분한 관계입니다.`;
  }

  return `${selfName}님과 ${partnerName}님은 성향이 달라 조율이 중요하게 작동하는 관계입니다.`;
}

function buildScoreLabel(score: number) {
  if (score >= 84) return '잘 맞는 흐름';
  if (score >= 78) return '편하게 맞춰갈 흐름';
  if (score >= 70) return '다름을 조율하면 좋아지는 흐름';
  if (score >= 62) return '속도 조절이 중요한 흐름';
  return '원칙을 정하면 안정되는 흐름';
}

function buildRelationshipSummaries(
  relationship: CompatibilityRelationshipSlug,
  elementInteraction: ReturnType<typeof summarizeElementInteraction>,
  branchInteraction: ReturnType<typeof summarizeBranchInteraction>,
  balanceInteraction: ReturnType<typeof summarizeElementBalance>
) {
  const lens = RELATIONSHIP_LENS[relationship];
  const supportiveSummary = `${elementInteraction.summary} ${lens.positive} ${balanceInteraction.body}`;
  const cautionSummary = branchInteraction.caution
    ? `${branchInteraction.caution.detail} ${lens.caution}`
    : `${elementInteraction.caution} ${lens.caution}`;
  const relationshipLensBody = `${lens.positive} ${lens.caution} ${lens.practice}`;

  return {
    supportiveSummary,
    cautionSummary,
    relationshipLensTitle: lens.title,
    relationshipLensBody,
  };
}

function buildPlainRelationshipSummary(
  relationship: CompatibilityRelationshipSlug,
  selfName: string,
  partnerName: string,
  score: number,
  elementInteraction: ReturnType<typeof summarizeElementInteraction>,
  branchInteraction: ReturnType<typeof summarizeBranchInteraction>
) {
  const relationshipLabel =
    relationship === 'lover'
      ? '마음 전달과 연락의 속도'
      : relationship === 'family'
        ? '말의 무게와 기대 역할'
        : relationship === 'partner'
          ? '책임 분담과 결정 원칙'
          : '편안함과 거리감';
  const strength =
    score >= 78
      ? '처음부터 완전히 같은 방식은 아니어도, 서로의 장점을 살릴 여지가 분명합니다.'
      : score >= 68
        ? '잘 맞는 부분과 신경 써야 할 부분이 함께 있어, 원칙을 정하면 관계가 훨씬 편해집니다.'
        : '서로의 속도와 말투가 다르게 느껴질 수 있어, 초반부터 원칙을 짧게 맞추는 편이 좋습니다.';
  const caution = branchInteraction.caution
    ? '특히 서운함이 생겼을 때 바로 결론을 내리기보다, 어느 장면에서 마음이 걸렸는지부터 나누는 편이 좋습니다.'
    : '큰 충돌보다 작은 기대 차이가 쌓이지 않게, 연락·돈·약속의 선을 미리 맞추는 편이 좋습니다.';

  return `${selfName}님과 ${partnerName}님은 ${relationshipLabel}에서 관계의 체감이 크게 달라집니다. ${strength} ${caution} ${elementInteraction.caution}`;
}

function getReportScore(
  report: ReturnType<typeof buildSajuReport>,
  key: 'overall' | 'love' | 'wealth' | 'career' | 'relationship'
) {
  return report.scores.find((item) => item.key === key)?.score ?? 70;
}

function resolveConnectionTopic(relationship: CompatibilityRelationshipSlug) {
  if (relationship === 'lover') return 'love' as const;
  if (relationship === 'partner') return 'career' as const;
  return 'relationship' as const;
}

function buildConflictCard(
  relationship: CompatibilityRelationshipSlug,
  stemInteraction: ReturnType<typeof summarizeStemInteraction>,
  elementInteraction: ReturnType<typeof summarizeElementInteraction>,
  branchInteraction: ReturnType<typeof summarizeBranchInteraction>
): CompatibilityPracticalCard {
  const guide = RELATIONSHIP_PRACTICE_GUIDES[relationship].conflict;

  if (branchInteraction.caution?.label === '충') {
    return {
      key: 'conflict',
      eyebrow: '갈등 포인트',
      title: '정면으로 부딪히는 말싸움이 커지기 쉽습니다',
      summary: `${branchInteraction.caution.detail} 서로 맞는 말부터 세우면 감정이 더 상하기 쉽고, 먼저 강한 말이 나간 쪽이 오래 후회할 수 있습니다.`,
      practice: guide,
      tone: 'coral',
    };
  }

  if (branchInteraction.caution?.label === '형') {
    return {
      key: 'conflict',
      eyebrow: '갈등 포인트',
      title: '쌓아두다 예민해지는 방식의 마찰을 조심하셔야 합니다',
      summary: `${branchInteraction.caution.detail} 당장 큰 싸움이 아니어도 작은 압박이 반복되면 갑자기 날카롭게 터질 수 있는 구조입니다.`,
      practice: guide,
      tone: 'coral',
    };
  }

  if (branchInteraction.caution?.label === '파' || branchInteraction.caution?.label === '해') {
    return {
      key: 'conflict',
      eyebrow: '갈등 포인트',
      title: '사소한 기대 어긋남이 생각보다 크게 남을 수 있습니다',
      summary: `${branchInteraction.caution.detail} 겉으로는 넘어간 듯 보여도 속피로나 실망감이 길게 남기 쉬워, 작은 약속일수록 더 분명히 하는 편이 낫습니다.`,
      practice: guide,
      tone: 'coral',
    };
  }

  if (elementInteraction.label.includes('누를 수 있는 흐름')) {
    return {
      key: 'conflict',
      eyebrow: '갈등 포인트',
      title: '한쪽의 속도와 약속가 다른 쪽에 압박으로 느껴질 수 있습니다',
      summary: `${elementInteraction.summary} 의도는 좋아도 말과 판단의 강도가 세지면 관계가 쉽게 피곤해질 수 있습니다.`,
      practice: guide,
      tone: 'coral',
    };
  }

  if (stemInteraction.title.includes('일간이 같은')) {
    return {
      key: 'conflict',
      eyebrow: '갈등 포인트',
      title: '닮은 고집이 맞부딪힐 때 한 발도 안 물러날 수 있습니다',
      summary: `${stemInteraction.body} 서로 이해는 빠르지만, “내가 아는 방식이 맞다”는 마음이 동시에 올라오면 오래 끌 수 있습니다.`,
      practice: guide,
      tone: 'coral',
    };
  }

  return {
    key: 'conflict',
    eyebrow: '갈등 포인트',
    title: '큰 충돌보다 생활 약속을 맞추는 과정이 더 중요합니다',
    summary: `${stemInteraction.body} 크게 부딪히는 구조는 아니어도 기대치와 말의 순서를 맞추지 않으면 피로가 쌓일 수 있습니다.`,
    practice: guide,
    tone: 'coral',
  };
}

function buildCommunicationCard(
  relationship: CompatibilityRelationshipSlug,
  self: CompatibilityPerson,
  selfData: SajuDataV1 | SajuDataV2,
  selfConnectionReport: ReturnType<typeof buildSajuReport>,
  partner: CompatibilityPerson,
  partnerData: SajuDataV1 | SajuDataV2,
  partnerConnectionReport: ReturnType<typeof buildSajuReport>
): CompatibilityPracticalCard {
  const selfStyle = COMMUNICATION_STYLES[selfData.dayMaster.element];
  const partnerStyle = COMMUNICATION_STYLES[partnerData.dayMaster.element];
  const connectionKey = resolveConnectionTopic(relationship);
  const selfScore = getReportScore(
    selfConnectionReport,
    connectionKey === 'career' ? 'career' : connectionKey === 'love' ? 'love' : 'relationship'
  );
  const partnerScore = getReportScore(
    partnerConnectionReport,
    connectionKey === 'career' ? 'career' : connectionKey === 'love' ? 'love' : 'relationship'
  );
  const scoreGap = Math.abs(selfScore - partnerScore);
  const guide = RELATIONSHIP_PRACTICE_GUIDES[relationship].communication;

  const title =
    selfData.dayMaster.element === partnerData.dayMaster.element
      ? '말이 통하는 리듬이 비교적 비슷한 편입니다'
      : scoreGap >= 12
        ? '대화의 속도 차이를 먼저 인정해야 오해가 줄어듭니다'
        : '말의 출발점이 달라 중간 확인이 필요합니다';

  const summary = `${self.name}님은 ${selfStyle.label}이라 ${selfStyle.summary} ${partner.name}님은 ${partnerStyle.label}이라 ${partnerStyle.summary} 그래서 한 번에 다 해결하려 하기보다 ${selfStyle.need} ${partnerStyle.need}`;

  return {
    key: 'communication',
    eyebrow: '대화 방식',
    title,
    summary,
    practice: `${guide} ${selfStyle.caution} ${partnerStyle.caution}`,
    tone: 'sky',
  };
}

function buildMoneyCard(
  relationship: CompatibilityRelationshipSlug,
  self: CompatibilityPerson,
  selfData: SajuDataV1 | SajuDataV2,
  selfWealthReport: ReturnType<typeof buildSajuReport>,
  partner: CompatibilityPerson,
  partnerData: SajuDataV1 | SajuDataV2,
  partnerWealthReport: ReturnType<typeof buildSajuReport>
): CompatibilityPracticalCard {
  const selfStyle = MONEY_STYLES[selfData.fiveElements.dominant];
  const partnerStyle = MONEY_STYLES[partnerData.fiveElements.dominant];
  const selfScore = getReportScore(selfWealthReport, 'wealth');
  const partnerScore = getReportScore(partnerWealthReport, 'wealth');
  const scoreGap = Math.abs(selfScore - partnerScore);
  const guide = RELATIONSHIP_PRACTICE_GUIDES[relationship].money;

  const title =
    selfData.fiveElements.dominant === partnerData.fiveElements.dominant || scoreGap <= 6
      ? '돈을 보는 기본 원칙은 비교적 비슷한 편입니다'
      : scoreGap >= 14
        ? '지출 허용선과 불안선이 꽤 다를 수 있습니다'
        : '한쪽은 기회를 보고, 한쪽은 안전을 먼저 봅니다';

  const summary = `${self.name}님은 ${selfStyle.label}이라 ${selfStyle.summary} ${partner.name}님은 ${partnerStyle.label}이라 ${partnerStyle.summary} 재물 감각 점수 차이가 ${scoreGap}점 수준이라, 돈 이야기는 감정이 좋을 때보다 원칙이 맑을 때 하는 편이 낫습니다.`;

  return {
    key: 'money',
    eyebrow: '돈 감각 차이',
    title,
    summary,
    practice: `${guide} ${selfStyle.caution} ${partnerStyle.caution}`,
    tone: 'gold',
  };
}

function buildDistanceCard(
  relationship: CompatibilityRelationshipSlug,
  self: CompatibilityPerson,
  selfData: SajuDataV1 | SajuDataV2,
  partner: CompatibilityPerson,
  partnerData: SajuDataV1 | SajuDataV2,
  branchInteraction: ReturnType<typeof summarizeBranchInteraction>
): CompatibilityPracticalCard {
  const selfStyle = DISTANCE_STYLES[selfData.dayMaster.element];
  const partnerStyle = DISTANCE_STYLES[partnerData.dayMaster.element];
  const guide = RELATIONSHIP_PRACTICE_GUIDES[relationship].distance;
  const fastElements: Element[] = ['목', '화'];
  const slowElements: Element[] = ['금', '수'];

  let title = '관계의 리듬을 맞추는 원칙이 필요합니다';

  if (selfData.dayMaster.element === partnerData.dayMaster.element) {
    title = '가까워지는 리듬이 비슷해 맞춰가기 쉬운 편입니다';
  } else if (
    (fastElements.includes(selfData.dayMaster.element) &&
      slowElements.includes(partnerData.dayMaster.element)) ||
    (fastElements.includes(partnerData.dayMaster.element) &&
      slowElements.includes(selfData.dayMaster.element))
  ) {
    title = '한쪽은 빠른 연결을, 다른 쪽은 여백을 더 원할 수 있습니다';
  } else if (branchInteraction.supportive) {
    title = '붙는 힘은 있는데 유지 방식의 차이를 맞추는 것이 중요합니다';
  }

  const supportiveLine = branchInteraction.supportive
    ? `${branchInteraction.supportive.detail} 다만 붙는 힘이 있다고 늘 같은 속도로 편한 것은 아닙니다.`
    : '';

  return {
    key: 'distance',
    eyebrow: '거리감 조절',
    title,
    summary: `${self.name}님은 ${selfStyle.label}이라 ${selfStyle.summary} ${partner.name}님은 ${partnerStyle.label}이라 ${partnerStyle.summary} ${supportiveLine}`.trim(),
    practice: `${guide} ${selfStyle.caution} ${partnerStyle.caution}`,
    tone: 'jade',
  };
}

function buildDataNote(selfInput: BirthInput, partnerInput: BirthInput) {
  const missing: string[] = [];

  if (selfInput.hour === undefined || partnerInput.hour === undefined) {
    missing.push('태어난 시간이 한쪽 또는 양쪽에서 빠져 있어 속마음과 생활 리듬 해석은 참고 수준으로 봅니다.');
  }

  if (!selfInput.birthLocation || !partnerInput.birthLocation) {
    missing.push('출생지가 빠진 쪽은 경도 보정 없이 일반 시각 바탕으로 계산했습니다.');
  }

  return missing.length > 0 ? missing.join(' ') : null;
}

// 2026-05-23 — 유료 §8 deepSections(결정론 버전 = LLM fallback).
//   무료 §4~6 은 각 축의 "어떤지(summary)" 까지만 노출한다. 결제 후에는 같은 축을
//   "그래서 어떻게 풀면 좋은지(practice)" 로 한 단계 더 풀어, 두 명식에 맞는 구체적
//   실천을 제시한다. practice 는 두 사람의 기운/관계유형에서 파생되므로 커플마다 다르다
//   (관계유형별 정적 텍스트였던 기존 premiumExpansion.preview 의 "모든 커플 동일" 문제 해소).
type StemInteractionKind = 'same' | 'harmony' | 'clash' | 'complement';

// 점수대 5단계 — buildCompatibilityInterpretation 의 라벨 산출(>=84/78/70/62)과 동일 기준.
// band 0 = 최상 … 4 = 가장 약함.
function resolveScoreBand(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score >= 84) return 0;
  if (score >= 78) return 1;
  if (score >= 70) return 2;
  if (score >= 62) return 3;
  return 4;
}

// 한국어 첫 문장만 추출(근거 한 줄용). "…다." 단위. 없으면 전체.
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const idx = trimmed.indexOf('다.');
  return idx >= 0 ? trimmed.slice(0, idx + 2) : trimmed;
}

// 관계유형(4) × 점수대(5) = 20셀 프레이밍 오프너. 축 공통 톤.
// 하우스 스타일: "~경향/~편/~수 있습니다" — 단정·과장·보장 표현 금지(의료광고법 가드).
const DEEP_SECTION_FRAME: Record<StemInteractionKind, [string, string, string, string, string]> = {
  same: [
    '두 분은 기본 결이 닮아 말이 잘 통하는 편이라, 이 강점을 살리면 관계가 더 단단해질 수 있습니다.',
    '비슷한 기질 덕에 공감이 빠른 편이니, 닮은 약점만 함께 챙기면 흐름이 좋아질 수 있습니다.',
    '닮은 점이 많아 편안하지만, 같은 지점에서 부딪히기도 쉬운 관계입니다.',
    '비슷한 성향이 양보 없는 고집으로 겹치면 거리가 생길 수 있는 관계입니다.',
    '닮은 만큼 같은 약점이 동시에 커지기 쉬워, 역할을 의식적으로 나눌 필요가 있는 관계입니다.',
  ],
  harmony: [
    '서로를 붙잡아 주는 힘이 강해, 방향만 맞추면 오래 이어질 가능성이 높은 관계입니다.',
    '기본적으로 끌어당기는 힘이 있어, 작은 차이를 조율하면 안정적으로 흐를 수 있습니다.',
    '묶이는 힘은 있지만 생활 리듬 차이가 변수로 작동하는 관계입니다.',
    '끌리는 마음과 달리 현실 조건에서 엇갈리기 쉬워 합의가 필요한 관계입니다.',
    '서로를 원하는 마음은 있어도 부딪히는 지점이 많아 인내가 필요한 관계입니다.',
  ],
  clash: [
    '속도 차이가 있지만 그만큼 서로를 자극해 키워 주는 힘으로 쓸 수 있는 관계입니다.',
    '부딪힘이 있는 편이나, 차이를 인정하면 보완 관계로 바뀔 여지가 있습니다.',
    '결정 속도와 시각 차이로 마찰이 생기기 쉬운 관계입니다.',
    '같은 사안을 다르게 읽어 갈등이 반복되기 쉬워 규칙이 필요한 관계입니다.',
    '기본 방향이 자주 충돌해, 거리와 역할을 분명히 해야 피로가 줄어드는 관계입니다.',
  ],
  complement: [
    '움직이는 방식은 달라도 역할 분담이 선명해, 차이가 강점이 되는 관계입니다.',
    '서로 다른 결이 빈 곳을 채워 주어, 차이를 이해할수록 편해지는 관계입니다.',
    '다른 성향이 때로 보완으로, 때로 오해로 작동하는 관계입니다.',
    '차이가 클 때는 서로의 기준을 설명하는 과정이 필요한 관계입니다.',
    '서로 다른 방향이 자주 어긋나, 기대를 미리 맞춰야 서운함이 줄어드는 관계입니다.',
  ],
};

const DEEP_SECTION_AXIS_LEAD: Record<CompatibilityPracticalCard['key'], string> = {
  conflict: '갈등이 올라올 때는',
  communication: '대화가 어긋난다 싶을 때는',
  money: '돈 이야기를 꺼낼 때는',
  distance: '거리와 연락의 리듬을 정할 때는',
};

interface DeepSectionContext {
  stemInteraction: ReturnType<typeof summarizeStemInteraction>;
  elementInteraction: ReturnType<typeof summarizeElementInteraction>;
  branchInteraction: ReturnType<typeof summarizeBranchInteraction>;
  balanceInteraction: ReturnType<typeof summarizeElementBalance>;
  score: number;
  selfName: string;
  partnerName: string;
}

// 축 → 근거 소스 매핑(기존 evidence[] 4종과 대칭). 근거는 첫 문장만 발췌.
function buildAxisEvidence(
  key: CompatibilityPracticalCard['key'],
  ctx: DeepSectionContext
): string {
  switch (key) {
    case 'conflict':
      return `근거 — 일간 신호: ${firstSentence(ctx.stemInteraction.body)}`;
    case 'communication':
      return `근거 — 오행 흐름: ${firstSentence(ctx.elementInteraction.summary)}`;
    case 'money':
      return `근거 — 오행 보완·겹침: ${firstSentence(ctx.balanceInteraction.body)}`;
    case 'distance':
      return `근거 — 일지 신호: ${firstSentence(ctx.branchInteraction.body)}`;
  }
}

function buildDeterministicDeepSections(
  practicalCards: CompatibilityPracticalCard[],
  ctx: DeepSectionContext
): CompatibilityDeepSection[] {
  const band = resolveScoreBand(ctx.score);
  const frame = DEEP_SECTION_FRAME[ctx.stemInteraction.kind][band];

  return practicalCards.map((card) => {
    const coupleLine =
      `${ctx.selfName}님과 ${ctx.partnerName}님은 ${DEEP_SECTION_AXIS_LEAD[card.key]} ${card.practice}`.trim();
    const body = [frame, coupleLine].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    return {
      key: card.key,
      title: card.title,
      body,
      evidence: buildAxisEvidence(card.key, ctx),
    };
  });
}

// 2026-05-23 — ① 궁합 per-couple 1회권용 커플 키.
//   결제 CTA(클라이언트)와 권한 게이트(서버)가 동일한 키를 산출해야 per-couple scope 가
//   맞물리므로 node:crypto 미사용(브라우저 비호환) — 순수 JS FNV-1a 2-스트림(약 64bit).
//   엔타이틀먼트 식별용 식별자일 뿐(보안 해시 아님). 두 사람을 정렬해 순서 무관.
function normalizePersonForCoupleKey(birth: BirthInput): string {
  return [birth.year, birth.month, birth.day, birth.hour ?? 'x', birth.gender ?? 'x'].join('.');
}

function fnv1aPair(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x5bd1e995;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code + 0x9e), 0x01000193);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

export function buildCompatibilityCoupleKey(self: BirthInput, partner: BirthInput): string {
  const pair = [normalizePersonForCoupleKey(self), normalizePersonForCoupleKey(partner)].sort();
  return fnv1aPair(pair.join('|'));
}

export function buildCompatibilityScopeKey(coupleKey: string): string {
  return `compat:${coupleKey}`;
}

export function getCompatibilityDataRequirements() {
  return [...RELATIONSHIP_HINTS];
}

export function inferCompatibilityRelationshipSlug(
  relationship: string | null | undefined
): CompatibilityRelationshipSlug {
  const value = (relationship ?? '').trim();

  if (/배우자|연인|남편|아내|부부|재회|썸/.test(value)) return 'lover';
  if (/부모|엄마|아빠|어머니|아버지|자녀|아들|딸|며느리|사위|시어머니|장모|가족/.test(value)) {
    return 'family';
  }
  if (/동료|파트너|동업|상사|부하|팀원|거래처/.test(value)) return 'partner';
  return 'friend';
}

export function resolveProfileDisplayName(
  displayName: string | null | undefined,
  email?: string | null
) {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;

  const fallback = email?.split('@')[0]?.trim();
  return fallback || '선생님';
}

export function buildCompatibilityInterpretation(
  relationship: CompatibilityRelationshipSlug,
  self: CompatibilityPerson,
  partner: CompatibilityPerson
): CompatibilityInterpretation {
  const selfData = loadSajuDataV2(self.birthInput, null, {
    location: self.birthInput.birthLocation?.label ?? null,
  });
  const partnerData = loadSajuDataV2(partner.birthInput, null, {
    location: partner.birthInput.birthLocation?.label ?? null,
  });

  const stemInteraction = summarizeStemInteraction(selfData.dayMaster.stem, partnerData.dayMaster.stem);
  const elementInteraction = summarizeElementInteraction(selfData, partnerData);
  const branchInteraction = summarizeBranchInteraction(
    selfData.pillars.day.branch,
    partnerData.pillars.day.branch
  );
  const balanceInteraction = summarizeElementBalance(selfData, partnerData);
  const connectionTopic = resolveConnectionTopic(relationship);
  const selfConnectionReport = buildSajuReport(self.birthInput, selfData, connectionTopic);
  const partnerConnectionReport = buildSajuReport(partner.birthInput, partnerData, connectionTopic);
  const selfWealthReport = buildSajuReport(self.birthInput, selfData, 'wealth');
  const partnerWealthReport = buildSajuReport(partner.birthInput, partnerData, 'wealth');

  const score = clampScore(
    70 + stemInteraction.score + elementInteraction.score + branchInteraction.totalScore + balanceInteraction.score
  );

  const label =
    score >= 84
      ? COMPATIBILITY_RESULT_LABELS[0]
      : score >= 78
        ? COMPATIBILITY_RESULT_LABELS[1]
        : score >= 70
          ? COMPATIBILITY_RESULT_LABELS[2]
          : score >= 62
            ? COMPATIBILITY_RESULT_LABELS[3]
            : COMPATIBILITY_RESULT_LABELS[4];

  const headline = buildHeadline(relationship, label, score, self.name, partner.name);
  const { supportiveSummary, cautionSummary, relationshipLensTitle, relationshipLensBody } =
    buildRelationshipSummaries(relationship, elementInteraction, branchInteraction, balanceInteraction);

  const summary = buildPlainRelationshipSummary(
    relationship,
    self.name,
    partner.name,
    score,
    elementInteraction,
    branchInteraction
  );

  const practicalCards: CompatibilityPracticalCard[] = [
    buildConflictCard(relationship, stemInteraction, elementInteraction, branchInteraction),
    buildCommunicationCard(
      relationship,
      self,
      selfData,
      selfConnectionReport,
      partner,
      partnerData,
      partnerConnectionReport
    ),
    buildMoneyCard(
      relationship,
      self,
      selfData,
      selfWealthReport,
      partner,
      partnerData,
      partnerWealthReport
    ),
    buildDistanceCard(relationship, self, selfData, partner, partnerData, branchInteraction),
  ];

  return {
    relationship,
    label,
    score,
    scoreLabel: buildScoreLabel(score),
    selfData,
    partnerData,
    headline,
    summary,
    supportiveSummary,
    cautionSummary,
    practiceSummary: RELATIONSHIP_LENS[relationship].practice,
    currentFlowSummary: inferCurrentFlowSummary(
      relationship,
      self.birthInput,
      selfData,
      partner.birthInput,
      partnerData
    ),
    practicalCards,
    deepSections: buildDeterministicDeepSections(practicalCards, {
      stemInteraction,
      elementInteraction,
      branchInteraction,
      balanceInteraction,
      score,
      selfName: self.name,
      partnerName: partner.name,
    }),
    evidence: [
      {
        title: '일간의 기본 성향',
        body: stemInteraction.body,
      },
      {
        title: '오행 상호작용',
        body: `${elementInteraction.summary} ${elementInteraction.caution}`,
      },
      {
        title: '일지에서 보이는 관계 신호',
        body: branchInteraction.body,
      },
      {
        title: '오행 보완과 겹침',
        body: balanceInteraction.body,
      },
    ],
    dataNote: buildDataNote(self.birthInput, partner.birthInput),
    relationshipLensTitle,
    relationshipLensBody,
  };
}
