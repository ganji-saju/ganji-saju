// 2026-05-15 — 별자리 × 사주 크로스 합성.
// 서양 별자리 (element fire/earth/air/water + quality cardinal/fixed/mutable)
// × 동양 일간 (10 천간 → 오행 목/화/토/금/수 + yin/yang)
// 두 시스템의 키워드를 합성해 "내 성격의 두 축" 을 한 페이지로 보여준다.
//
// 알고리즘:
// 1. sign element ↔ stem element 관계 분석 (생/극/조화)
// 2. quality ↔ yin/yang 관계
// 3. 결합 키워드, 시너지/충돌, 행동 제안 생성

import type { Element, Stem, YinYang } from '@/lib/saju/types';
import {
  STAR_SIGN_CONTENT,
  type SignElement,
  type SignQuality,
  type StarSignSlug,
} from './sign-content';

// 서양 element ↔ 동양 오행 매핑 (의미 유사도 기반).
const SIGN_ELEMENT_TO_STEM_ELEMENT: Record<SignElement, Element> = {
  fire: '화', // 표현 기운 — 같은 불
  earth: '토', // 안정 기운 — 흙은 동서양 공통 안정
  air: '목', // 성장·확장 — 공기와 목이 가장 가까움 (둘 다 외향적 확장)
  water: '수', // 생각/감정 — 같은 물
};

const STEM_TO_ELEMENT: Record<Stem, Element> = {
  '甲': '목', '乙': '목',
  '丙': '화', '丁': '화',
  '戊': '토', '己': '토',
  '庚': '금', '辛': '금',
  '壬': '수', '癸': '수',
};

const STEM_TO_YINYANG: Record<Stem, YinYang> = {
  '甲': '양', '乙': '음',
  '丙': '양', '丁': '음',
  '戊': '양', '己': '음',
  '庚': '양', '辛': '음',
  '壬': '양', '癸': '음',
};

// 오행 상생: 목 → 화 → 토 → 금 → 수 → 목
const GENERATES: Record<Element, Element> = {
  '목': '화', '화': '토', '토': '금', '금': '수', '수': '목',
};
// 오행 상극: 목 → 토, 화 → 금, 토 → 수, 금 → 목, 수 → 화
const CONTROLS: Record<Element, Element> = {
  '목': '토', '화': '금', '토': '수', '금': '목', '수': '화',
};

const ELEMENT_LABEL_KO: Record<Element, string> = {
  '목': '나무 (성장)',
  '화': '불 (표현)',
  '토': '흙 (안정)',
  '금': '쇠 (정리)',
  '수': '물 (생각)',
};

const SIGN_ELEMENT_LABEL_KO: Record<SignElement, string> = {
  fire: '불',
  earth: '땅',
  air: '공기',
  water: '물',
};

const STEM_LABEL_KO: Record<Stem, string> = {
  '甲': '갑 (큰 나무)',
  '乙': '을 (어린 풀)',
  '丙': '병 (큰 불)',
  '丁': '정 (작은 불)',
  '戊': '무 (큰 흙)',
  '己': '기 (작은 흙)',
  '庚': '경 (큰 쇠)',
  '辛': '신 (작은 쇠)',
  '壬': '임 (큰 물)',
  '癸': '계 (이슬)',
};

export type CrossRelation = 'identical' | 'generate' | 'generated' | 'control' | 'controlled' | 'neutral';

const RELATION_LABEL: Record<CrossRelation, { label: string; tone: 'best' | 'good' | 'mid' | 'caution' }> = {
  identical: { label: '같은 결', tone: 'best' },
  generate: { label: '내가 키우는 결', tone: 'good' },
  generated: { label: '나를 키우는 결', tone: 'good' },
  control: { label: '내가 누르는 결', tone: 'caution' },
  controlled: { label: '나를 누르는 결', tone: 'caution' },
  neutral: { label: '중립', tone: 'mid' },
};

function elementRelation(westElem: Element, eastElem: Element): CrossRelation {
  if (westElem === eastElem) return 'identical';
  if (GENERATES[westElem] === eastElem) return 'generate';
  if (GENERATES[eastElem] === westElem) return 'generated';
  if (CONTROLS[westElem] === eastElem) return 'control';
  if (CONTROLS[eastElem] === westElem) return 'controlled';
  return 'neutral';
}

export interface CrossSynthesis {
  /** 별자리 element. */
  signElement: SignElement;
  signElementLabel: string;
  /** 일간 천간. */
  dayMaster: Stem;
  dayMasterLabel: string;
  /** 일간 오행. */
  dayMasterElement: Element;
  dayMasterElementLabel: string;
  /** 일간 음양. */
  yinYang: YinYang;
  /** 두 element 관계. */
  relation: CrossRelation;
  relationLabel: string;
  relationTone: 'best' | 'good' | 'mid' | 'caution';
  /** 키워드 합집합 (서양 강점 + 동양 일간 키워드). */
  combinedKeywords: string[];
  /** 시너지 한 줄. */
  synergyLine: string;
  /** 충돌 한 줄. */
  tensionLine: string;
  /** 통합 한 줄 — 가장 중요. */
  integratedInsight: string;
  /** 행동 제안 3개. */
  actionSuggestions: string[];
}

const STEM_KEYWORDS: Record<Stem, string[]> = {
  '甲': ['추진력', '리더십', '독립', '곧음'],
  '乙': ['유연성', '섬세함', '예술', '관계'],
  '丙': ['활기', '주목', '사교', '표현'],
  '丁': ['집중', '전문', '내면', '몰입'],
  '戊': ['책임', '신뢰', '중심', '안정'],
  '己': ['실용', '분석', '꼼꼼', '현실'],
  '庚': ['결단', '정의', '추진', '의리'],
  '辛': ['완벽', '통찰', '예민', '미감'],
  '壬': ['포용', '기획', '확장', '유연'],
  '癸': ['직관', '감성', '공감', '깊이'],
};

const RELATION_SYNERGY: Record<CrossRelation, string> = {
  identical: '서양과 동양이 같은 결 — 강점이 곱셈으로 작동합니다',
  generate: '내 별자리가 일간을 키워주는 흐름 — 표현과 안정이 자연스럽게 이어집니다',
  generated: '일간이 내 별자리를 키워주는 흐름 — 내면이 외면을 받쳐줍니다',
  control: '내 별자리가 일간을 누르는 결 — 추진력은 있지만 무리하기 쉽습니다',
  controlled: '일간이 내 별자리를 누르는 결 — 안정감은 있으나 답답함을 느낄 수 있습니다',
  neutral: '두 시스템이 따로 작동 — 각각의 결을 따로 챙기면 균형이 잡힙니다',
};

const RELATION_TENSION: Record<CrossRelation, string> = {
  identical: '같은 결이라 단점도 곱절 — 약점 한 가지에 갇히지 않게 주의하세요',
  generate: '주는 쪽이 지치지 않게, 자기 회복도 챙기세요',
  generated: '받기만 하지 말고 외부 표현을 함께 늘려보세요',
  control: '강한 의지가 주변과 부딪칠 수 있으니 톤 조절이 키입니다',
  controlled: '눌리는 답답함을 풀 출구를 평소에 만들어두세요',
  neutral: '두 결이 따로 놀 때 정체성이 흔들릴 수 있어요',
};

const QUALITY_YINYANG_INTEGRATION: Record<`${SignQuality}-${YinYang}`, string> = {
  'cardinal-양': '시작하는 별자리 + 양의 일간 — 새로운 일을 가장 먼저 끌고 나가는 추진형',
  'cardinal-음': '시작하는 별자리 + 음의 일간 — 새로운 일을 조용히 설계하는 기획형',
  'fixed-양': '고정 별자리 + 양의 일간 — 한 번 정한 길을 강하게 밀어붙이는 지속형',
  'fixed-음': '고정 별자리 + 음의 일간 — 깊이 쌓아 올리는 정밀형',
  'mutable-양': '변통 별자리 + 양의 일간 — 빠르게 적응하며 외부와 연결하는 확산형',
  'mutable-음': '변통 별자리 + 음의 일간 — 유연하게 흐름을 읽는 적응형',
};

const RELATION_ACTIONS: Record<CrossRelation, string[]> = {
  identical: [
    '같은 결이 곱절로 강해지는 장점을 살릴 환경을 고르세요',
    '약점 한 가지에 매몰되지 않게 의식적으로 다양성을 챙기세요',
    '한 가지 분야에서 깊이를 만드세요',
  ],
  generate: [
    '내가 가진 에너지를 일간이 자라는 데 쓰세요',
    '주는 쪽이 지치지 않도록 회복 루틴을 만드세요',
    '강점을 도울 사람을 옆에 두면 시너지가 큽니다',
  ],
  generated: [
    '내면의 안정을 외부로 표현하는 연습을 늘리세요',
    '받는 만큼 도전해야 균형이 잡힙니다',
    '잠재력을 끌어낼 멘토·롤모델을 찾아보세요',
  ],
  control: [
    '강한 의지를 가지되 말과 톤을 한 단계 부드럽게 하세요',
    '내가 누르는 사람·일을 의식하고 배려를 더하세요',
    '추진력의 방향을 자신에게 돌려 자기관리에 쓰세요',
  ],
  controlled: [
    '눌리는 답답함을 풀 출구 — 운동·예술·여행 — 를 만드세요',
    '약점을 인정하고 도움을 청하는 용기를 가지세요',
    '나의 페이스를 지키는 경계선을 분명히 그으세요',
  ],
  neutral: [
    '두 결을 각각 다른 영역에서 활용하세요 (일/관계)',
    '정체성이 흔들릴 때는 둘 중 하나에 우선순위를 두세요',
    '두 시스템의 키워드 중 가장 끌리는 단어를 매일 한 번 떠올리세요',
  ],
};

/**
 * 별자리 + 일간 → 합성 인사이트.
 */
export function synthesizeCross(signSlug: StarSignSlug, dayMaster: Stem): CrossSynthesis {
  const content = STAR_SIGN_CONTENT[signSlug];
  const signElement = content.element;
  const stemElement = STEM_TO_ELEMENT[dayMaster];
  const yinYang = STEM_TO_YINYANG[dayMaster];
  const mappedWestElem = SIGN_ELEMENT_TO_STEM_ELEMENT[signElement];
  const relation = elementRelation(mappedWestElem, stemElement);
  const relationMeta = RELATION_LABEL[relation];

  const combinedKeywords = Array.from(
    new Set([...content.strengths.slice(0, 3), ...STEM_KEYWORDS[dayMaster]])
  );

  const integratedInsight =
    QUALITY_YINYANG_INTEGRATION[`${content.quality}-${yinYang}`] ?? '두 시스템이 균형있게 작동합니다';

  return {
    signElement,
    signElementLabel: SIGN_ELEMENT_LABEL_KO[signElement],
    dayMaster,
    dayMasterLabel: STEM_LABEL_KO[dayMaster],
    dayMasterElement: stemElement,
    dayMasterElementLabel: ELEMENT_LABEL_KO[stemElement],
    yinYang,
    relation,
    relationLabel: relationMeta.label,
    relationTone: relationMeta.tone,
    combinedKeywords,
    synergyLine: RELATION_SYNERGY[relation],
    tensionLine: RELATION_TENSION[relation],
    integratedInsight,
    actionSuggestions: RELATION_ACTIONS[relation],
  };
}

/** 별자리 slug 만 알 때 추정 (개인화 없이) — 일간 미지정. */
export function summarizeCrossOverview(signSlug: StarSignSlug) {
  const content = STAR_SIGN_CONTENT[signSlug];
  const mappedElem = SIGN_ELEMENT_TO_STEM_ELEMENT[content.element];
  return {
    signElement: content.element,
    signElementLabel: SIGN_ELEMENT_LABEL_KO[content.element],
    mappedEastElement: mappedElem,
    mappedEastElementLabel: ELEMENT_LABEL_KO[mappedElem],
    hint: `${SIGN_ELEMENT_LABEL_KO[content.element]} 별자리는 동양의 ${ELEMENT_LABEL_KO[mappedElem]}와 가장 가까운 결을 가집니다.`,
  };
}
