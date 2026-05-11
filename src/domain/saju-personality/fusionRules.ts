import type {
  FusionFacts,
  PersonalityFacts,
  SajuPersonalityFactSignal,
  SajuPersonalityFusionPattern,
  SajuPersonalityFusionPatternKey,
  SajuPersonalityLifeArea,
  SajuPersonalityScoreAxis,
  SajuPersonalityFacts,
} from './sajuPersonality.types';

interface LifeAreaRule {
  title: string;
  focus: string;
  scoreAxis: SajuPersonalityScoreAxis;
  actionHint: string;
}

const LIFE_AREA_RULES: Record<SajuPersonalityLifeArea, LifeAreaRule> = {
  basic: {
    title: '기본 성향',
    focus: '타고난 결과 평소 선택 습관을 함께 읽는 것',
    scoreAxis: 'innerEnergyScore',
    actionHint: '오늘 자주 반복되는 선택 하나를 관찰해보세요.',
  },
  love: {
    title: '연애',
    focus: '마음이 열리는 속도와 표현 방식의 차이를 알아차리는 것',
    scoreAxis: 'relationshipSensitivityScore',
    actionHint: '상대에게 바라는 것을 결론보다 느낌으로 먼저 정리해보세요.',
  },
  relationships: {
    title: '인간관계',
    focus: '편한 거리감과 소통 리듬을 조절하는 것',
    scoreAxis: 'relationshipSensitivityScore',
    actionHint: '가까워지고 싶은 사람에게 부담 없는 확인 질문을 하나 건네보세요.',
  },
  work: {
    title: '일',
    focus: '일을 시작하고 끝내는 방식의 강점과 피로 지점을 나누는 것',
    scoreAxis: 'executionRhythmScore',
    actionHint: '가장 작은 다음 행동을 하나만 정해 실행해보세요.',
  },
  money_achievement: {
    title: '돈과 성취',
    focus: '현실 감각, 추진력, 지속 루틴의 균형을 잡는 것',
    scoreAxis: 'executionRhythmScore',
    actionHint: '이번 주 돈이나 성취와 관련된 기준 하나를 숫자로 정리해보세요.',
  },
  year: {
    title: '올해',
    focus: '올해의 흐름 안에서 키울 점과 덜어낼 점을 구분하는 것',
    scoreAxis: 'growthDirectionScore',
    actionHint: '올해 붙잡을 키워드 하나와 내려놓을 습관 하나를 적어보세요.',
  },
  today: {
    title: '오늘',
    focus: '지금 바로 실행 가능한 작은 선택으로 흐름을 바꾸는 것',
    scoreAxis: 'growthDirectionScore',
    actionHint: '오늘 안에 끝낼 수 있는 10분짜리 행동을 먼저 해보세요.',
  },
};

const PATTERN_TITLES: Record<SajuPersonalityFusionPatternKey, string> = {
  energyPattern: '에너지 패턴',
  expressionPattern: '표현 패턴',
  decisionPattern: '결정 패턴',
  executionPattern: '실행 패턴',
  relationshipPattern: '관계 패턴',
  growthPattern: '성장 패턴',
  cautionPattern: '주의 패턴',
};

export function getLifeAreaRule(lifeArea: SajuPersonalityLifeArea): LifeAreaRule {
  return LIFE_AREA_RULES[lifeArea];
}

export function buildFusionFacts(input: {
  sajuFacts: SajuPersonalityFacts;
  personalityFacts: PersonalityFacts;
  lifeArea: SajuPersonalityLifeArea;
}): FusionFacts {
  const { sajuFacts, personalityFacts, lifeArea } = input;
  const lifeAreaRule = getLifeAreaRule(lifeArea);
  const strengthSignals = sajuFacts.strengthSignals ?? [];
  const cautionSignals = [...(sajuFacts.cautionSignals ?? []), ...(personalityFacts.cautionSignals ?? [])];
  const preferenceSignals = personalityFacts.preferenceSignals ?? [];
  const timingSignals = sajuFacts.timingSignals ?? [];
  const alignmentSignals = [
    ...takeSignals(strengthSignals, 2),
    ...takeSignals(preferenceSignals, 2),
    createFusionSignal(
      'fusion:life-area-focus',
      lifeAreaRule.title,
      `${lifeAreaRule.focus}에 초점을 둡니다.`,
      0.74
    ),
  ];
  const frictionSignals = takeSignals(cautionSignals, 3);
  const growthSignals = [
    createFusionSignal(
      'fusion:growth-focus',
      '성장 초점',
      `${lifeAreaRule.title}에서는 ${lifeAreaRule.focus}이 도움이 됩니다.`,
      0.76
    ),
    ...takeSignals(timingSignals, 1),
  ];

  return {
    lifeArea,
    energyPattern: createPattern(
      'energyPattern',
      [
        firstSignal(strengthSignals),
        findSignal(preferenceSignals, 'personality:energy'),
      ],
      '타고난 기운의 밀도와 일상에서 에너지를 회복하는 방식이 만나는 지점입니다.',
      '에너지가 올라오는 시간대와 소모되는 상황을 나눠 기록해보세요.'
    ),
    expressionPattern: createPattern(
      'expressionPattern',
      [
        findSignal(strengthSignals, 'saju:day-master'),
        findSignal(preferenceSignals, 'personality:expression'),
      ],
      '안쪽의 결은 비교적 일정하지만, 밖으로 드러나는 말과 반응은 성향의 영향을 크게 받습니다.',
      '바로 표현할 말과 조금 정리한 뒤 말할 내용을 구분해보세요.'
    ),
    decisionPattern: createPattern(
      'decisionPattern',
      [
        findSignal(preferenceSignals, 'personality:decision'),
        findSignal(strengthSignals, 'saju:dominant'),
      ],
      '판단 기준은 사주의 기본 결 위에 성향의 정보 처리 방식이 얹혀 만들어집니다.',
      '결정 전 기준, 마음, 현실 조건을 한 줄씩 분리해보세요.'
    ),
    executionPattern: createPattern(
      'executionPattern',
      [
        findSignal(preferenceSignals, 'personality:execution'),
        firstSignal(timingSignals),
      ],
      '실행은 의지보다 리듬의 영향을 받기 쉬워, 현재 흐름에 맞는 작은 단위가 중요합니다.',
      lifeAreaRule.actionHint
    ),
    relationshipPattern: createPattern(
      'relationshipPattern',
      [
        findSignal(preferenceSignals, 'personality:relationship'),
        findSignal(strengthSignals, 'saju:strength'),
      ],
      '관계에서는 타고난 반응 속도와 성향상 편한 거리감이 함께 나타납니다.',
      '편한 거리와 필요한 확인 표현을 미리 정해두면 흔들림이 줄어듭니다.'
    ),
    growthPattern: createPattern(
      'growthPattern',
      growthSignals,
      `${lifeAreaRule.title} 영역에서는 강점을 더 쓰는 것만큼 피로 신호를 빨리 알아차리는 것이 중요합니다.`,
      lifeAreaRule.actionHint
    ),
    cautionPattern: createPattern(
      'cautionPattern',
      frictionSignals,
      '반복해서 지치는 지점은 성향의 약점 하나가 아니라 기질, 습관, 현재 리듬이 겹칠 때 커집니다.',
      '불편함이 커지기 전 멈춤 신호를 하나 정해두세요.'
    ),
    strongestAxis: lifeAreaRule.scoreAxis,
    lowestAxis: 'decisionScore',
    alignmentSignals,
    frictionSignals,
    growthSignals,
    recommendedFocus: lifeAreaRule.focus,
    raw: {
      lifeAreaTitle: lifeAreaRule.title,
      ruleVersion: 'saju-personality-fusion-rules/v1',
    },
  };
}

function createPattern(
  key: SajuPersonalityFusionPatternKey,
  signals: readonly (SajuPersonalityFactSignal | null | undefined)[],
  summary: string,
  actionHint: string
): SajuPersonalityFusionPattern {
  const compactSignals = signals.filter(
    (signal): signal is SajuPersonalityFactSignal => Boolean(signal)
  );

  return {
    key,
    title: PATTERN_TITLES[key],
    summary,
    signals: compactSignals,
    actionHint,
    confidence: estimatePatternConfidence(compactSignals),
  };
}

function createFusionSignal(
  key: string,
  label: string,
  description: string,
  confidence: number
): SajuPersonalityFactSignal {
  return {
    key,
    label,
    description,
    source: 'fusion',
    confidence,
  };
}

function firstSignal(
  signals: readonly SajuPersonalityFactSignal[]
): SajuPersonalityFactSignal | null {
  return signals[0] ?? null;
}

function findSignal(
  signals: readonly SajuPersonalityFactSignal[],
  keyPrefix: string
): SajuPersonalityFactSignal | null {
  return signals.find((signal) => signal.key.startsWith(keyPrefix)) ?? null;
}

function takeSignals(
  signals: readonly SajuPersonalityFactSignal[],
  count: number
): SajuPersonalityFactSignal[] {
  return signals.slice(0, count);
}

function estimatePatternConfidence(signals: readonly SajuPersonalityFactSignal[]): number {
  if (signals.length === 0) return 0.5;
  const average =
    signals.reduce((sum, signal) => sum + (signal.confidence ?? 0.7), 0) / signals.length;
  return Math.max(0, Math.min(1, Number(average.toFixed(2))));
}
