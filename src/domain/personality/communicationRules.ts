import type {
  PersonalityAxis,
  PersonalityAxisPole,
  PersonalityCommunicationRule,
} from './personality.types';

export const PERSONALITY_COMMUNICATION_RULES: Record<
  PersonalityAxisPole,
  PersonalityCommunicationRule
> = {
  I: {
    axis: 'IE',
    pole: 'I',
    title: '천천히 여는 쪽',
    prefers: '생각을 정리할 시간과 조용한 대화 흐름을 선호합니다.',
    carePoint: '대답이 느려도 관심이 없는 뜻은 아닐 수 있습니다.',
  },
  E: {
    axis: 'IE',
    pole: 'E',
    title: '말하며 가까워지는 쪽',
    prefers: '바로 반응하고 함께 이야기하며 에너지를 얻습니다.',
    carePoint: '빠른 반응이 상대에게 압박처럼 느껴지지 않게 속도를 맞추면 좋습니다.',
  },
  S: {
    axis: 'SN',
    pole: 'S',
    title: '현실 확인이 편한 쪽',
    prefers: '지금 보이는 사실, 일정, 경험을 바탕으로 이야기합니다.',
    carePoint: '큰 가능성보다 오늘 할 수 있는 행동으로 풀어주면 안정됩니다.',
  },
  N: {
    axis: 'SN',
    pole: 'N',
    title: '의미와 가능성을 보는 쪽',
    prefers: '숨은 의미, 앞으로의 방향, 새로운 가능성을 함께 봅니다.',
    carePoint: '현실적인 확인 없이 상상만 길어지면 상대가 막막할 수 있습니다.',
  },
  T: {
    axis: 'TF',
    pole: 'T',
    title: '이유가 선명해야 편한 쪽',
    prefers: '감정보다 이유, 기준, 해결 순서를 먼저 확인합니다.',
    carePoint: '맞는 말이어도 감정 확인 한마디가 먼저 필요할 때가 있습니다.',
  },
  F: {
    axis: 'TF',
    pole: 'F',
    title: '마음 확인이 먼저인 쪽',
    prefers: '말의 온도, 배려, 관계의 안정감을 중요하게 봅니다.',
    carePoint: '분위기를 지키려다 필요한 결정을 너무 미루지 않게 조심하면 좋습니다.',
  },
  J: {
    axis: 'JP',
    pole: 'J',
    title: '정리가 되어야 편한 쪽',
    prefers: '약속, 일정, 역할이 정리되어 있을 때 마음이 놓입니다.',
    carePoint: '계획을 세우는 말이 상대에게 통제처럼 들리지 않게 선택지를 남겨주세요.',
  },
  P: {
    axis: 'JP',
    pole: 'P',
    title: '여지를 두면 편한 쪽',
    prefers: '상황에 맞게 바꾸고 여유를 두는 흐름을 선호합니다.',
    carePoint: '너무 열어두면 상대가 불안할 수 있으니 최소한의 기준은 정해두면 좋습니다.',
  },
};

export function getCommunicationRule(
  pole: PersonalityAxisPole
): PersonalityCommunicationRule {
  return PERSONALITY_COMMUNICATION_RULES[pole];
}

export function getAxisCommunicationRules(
  axis: PersonalityAxis
): [PersonalityCommunicationRule, PersonalityCommunicationRule] {
  if (axis === 'IE') return [PERSONALITY_COMMUNICATION_RULES.I, PERSONALITY_COMMUNICATION_RULES.E];
  if (axis === 'SN') return [PERSONALITY_COMMUNICATION_RULES.S, PERSONALITY_COMMUNICATION_RULES.N];
  if (axis === 'TF') return [PERSONALITY_COMMUNICATION_RULES.T, PERSONALITY_COMMUNICATION_RULES.F];
  return [PERSONALITY_COMMUNICATION_RULES.J, PERSONALITY_COMMUNICATION_RULES.P];
}
