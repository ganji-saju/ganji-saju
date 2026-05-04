import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { Element, Stem, SajuResult } from './types';

// 다섯 기운의 쉬운 표시 이름과 속성
export const ELEMENT_INFO: Record<Element, {
  name: string;
  color: string;
  traits: string[];
  keywords: string[];
}> = {
  목: {
    name: '성장 기운',
    color: '#4CAF50',
    traits: ['성장', '발전', '창의성', '인자함'],
    keywords: ['성장', '시작', '아이디어', '관계 확장', '봄'],
  },
  화: {
    name: '표현 기운',
    color: '#F44336',
    traits: ['열정', '예의', '표현력', '통찰력'],
    keywords: ['표현', '열정', '주목', '결정', '여름'],
  },
  토: {
    name: '안정 기운',
    color: '#FF9800',
    traits: ['신뢰', '안정', '중재력', '포용력'],
    keywords: ['안정', '정리', '중재', '신뢰', '기반'],
  },
  금: {
    name: '정리 기운',
    color: '#9E9E9E',
    traits: ['결단력', '의리', '정의감', '추진력'],
    keywords: ['정리', '판단', '마무리', '원칙', '가을'],
  },
  수: {
    name: '생각 기운',
    color: '#2196F3',
    traits: ['지혜', '유연성', '직관력', '깊이'],
    keywords: ['생각', '휴식', '유연함', '감정', '겨울'],
  },
};

// 오행 상생 관계 (생하는 방향)
export const GENERATES: Record<Element, Element> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
};

// 오행 상극 관계 (극하는 방향)
export const CONTROLS: Record<Element, Element> = {
  목: '토', 화: '금', 토: '수', 금: '목', 수: '화',
};

const ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];

// 일간 기반 성격 해석
const DAY_MASTER_PERSONALITY: Record<Stem, string> = {
  '甲': '곧고 강직한 성품으로 리더십이 강합니다. 독립적이며 추진력이 있지만, 고집스러울 수 있습니다.',
  '乙': '유연하고 적응력이 뛰어나며 섬세합니다. 예술적 감각이 있고 인간관계를 중시합니다.',
  '丙': '밝고 활발하며 사교적입니다. 표현력이 강하고 주변을 환하게 밝히는 존재감이 있습니다.',
  '丁': '세심하고 집중력이 뛰어납니다. 내면의 불꽃처럼 한 분야를 깊이 파고드는 전문가 기질이 있습니다.',
  '戊': '듬직하고 신뢰감이 높습니다. 책임감이 강하며 주변의 중심 역할을 자연스럽게 맡습니다.',
  '己': '섬세하고 현실적입니다. 꼼꼼한 분석력과 실용적 판단력이 뛰어납니다.',
  '庚': '강인하고 결단력이 있습니다. 정의감이 강하며 흑백이 분명한 성격입니다.',
  '辛': '예민하고 완벽을 추구합니다. 날카로운 통찰력과 섬세한 미적 감각을 지닙니다.',
  '壬': '진취적이고 포용력이 넓습니다. 큰 그림을 그리는 기획력과 유연한 적응력이 특징입니다.',
  '癸': '사려깊고 직관력이 뛰어납니다. 감성이 풍부하며 타인의 감정을 잘 읽습니다.',
};

export function getPersonalityByStem(stem: Stem): string {
  return DAY_MASTER_PERSONALITY[stem];
}

export function getPersonality(result: SajuResult): string {
  return getPersonalityByStem(result.dayMaster);
}

export function getPersonalityFromSajuData(data: SajuDataV1): string {
  return data.dayMaster.description ?? getPersonalityByStem(data.dayMaster.stem);
}

export function getElementBalance(elements: Record<Element, number>): string {
  const total = Object.values(elements).reduce((a, b) => a + b, 0);
  const lines: string[] = [];

  for (const [el, count] of Object.entries(elements) as [Element, number][]) {
    const pct = Math.round((count / total) * 100);
    lines.push(`${ELEMENT_INFO[el].name} ${pct}%`);
  }
  return lines.join(' · ');
}

export function getLuckyElements(result: SajuResult): Element[] {
  // 용신: 가장 약한 오행과 그것을 생하는 오행
  const weak = result.weakestElement;
  const support = (Object.entries(GENERATES) as [Element, Element][])
    .find(([, v]) => v === weak)?.[0];
  return support ? [weak, support] : [weak];
}

export function getElementCountsFromSajuData(
  data: SajuDataV1
): Record<Element, number> {
  return Object.fromEntries(
    ELEMENTS.map((element) => [element, data.fiveElements.byElement[element].count])
  ) as Record<Element, number>;
}

export function getLuckyElementsFromSajuData(data: SajuDataV1): Element[] {
  if (data.yongsin) {
    const fromYongsin = [data.yongsin.primary, ...data.yongsin.secondary]
      .flatMap((symbol) =>
        symbol.type === 'element' && isElement(symbol.value)
          ? [symbol.value]
          : []
      );

    if (fromYongsin.length > 0) {
      return [...new Set(fromYongsin)];
    }
  }

  const weak = data.fiveElements.weakest;
  const support = (Object.entries(GENERATES) as [Element, Element][])
    .find(([, value]) => value === weak)?.[0];

  return support ? [weak, support] : [weak];
}

function isElement(value: string): value is Element {
  return ELEMENTS.includes(value as Element);
}
