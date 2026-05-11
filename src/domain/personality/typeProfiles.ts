import type { PersonalityTypeCode, PersonalityTypeProfile } from './personality.types';

export const PERSONALITY_TYPE_PROFILES: Record<PersonalityTypeCode, PersonalityTypeProfile> = {
  ISTJ: {
    code: 'ISTJ',
    title: '차분한 기준형',
    communicationStyle: '약속, 순서, 사실을 확인하며 안정적으로 말합니다.',
    relationshipHint: '감정 표현은 작아도 책임감 있는 행동으로 마음을 보여주는 편입니다.',
    caution: '상대가 즉흥적으로 움직이면 답답함을 느끼기 쉽습니다.',
  },
  ISFJ: {
    code: 'ISFJ',
    title: '다정한 배려형',
    communicationStyle: '상대가 불편하지 않은지 살피며 부드럽게 말합니다.',
    relationshipHint: '작은 기억과 생활 속 배려가 관계의 힘이 됩니다.',
    caution: '혼자 참고 넘기다가 뒤늦게 서운함이 커질 수 있습니다.',
  },
  INFJ: {
    code: 'INFJ',
    title: '깊은 공감형',
    communicationStyle: '말의 표면보다 숨은 마음과 방향을 함께 봅니다.',
    relationshipHint: '진심이 느껴지는 대화에서 빠르게 가까워집니다.',
    caution: '기대가 말로 정리되지 않으면 상대가 알아차리기 어렵습니다.',
  },
  INTJ: {
    code: 'INTJ',
    title: '선명한 설계형',
    communicationStyle: '핵심과 구조를 먼저 잡고 효율적으로 말합니다.',
    relationshipHint: '관계에서도 앞으로의 방향과 기준이 보이면 안정됩니다.',
    caution: '감정 확인이 필요한 순간에 해결책부터 말하면 차갑게 보일 수 있습니다.',
  },
  ISTP: {
    code: 'ISTP',
    title: '담백한 해결형',
    communicationStyle: '필요한 말만 간결하게 하고 행동으로 확인합니다.',
    relationshipHint: '간섭보다 여유를 줄 때 편안함이 살아납니다.',
    caution: '반응이 짧아 상대가 무심하다고 느낄 수 있습니다.',
  },
  ISFP: {
    code: 'ISFP',
    title: '따뜻한 감각형',
    communicationStyle: '분위기와 감정을 조심스럽게 살피며 표현합니다.',
    relationshipHint: '강한 압박보다 편안한 경험을 함께할 때 마음이 열립니다.',
    caution: '불편함을 피하다가 필요한 대화를 미룰 수 있습니다.',
  },
  INFP: {
    code: 'INFP',
    title: '섬세한 의미형',
    communicationStyle: '말 안에 담긴 의미와 진심을 중요하게 봅니다.',
    relationshipHint: '있는 그대로 이해받는 느낌이 관계의 문을 엽니다.',
    caution: '상대의 가벼운 말도 크게 해석해 마음이 흔들릴 수 있습니다.',
  },
  INTP: {
    code: 'INTP',
    title: '느슨한 탐구형',
    communicationStyle: '정답보다 가능성과 이유를 차분히 따져봅니다.',
    relationshipHint: '생각할 시간을 존중받을 때 대화가 깊어집니다.',
    caution: '감정보다 분석이 앞서면 상대가 거리감을 느낄 수 있습니다.',
  },
  ESTP: {
    code: 'ESTP',
    title: '빠른 실행형',
    communicationStyle: '분위기를 보고 바로 반응하며 속도감 있게 말합니다.',
    relationshipHint: '함께 움직이고 경험하는 시간이 가까움을 만듭니다.',
    caution: '결론을 서두르면 상대의 감정 속도를 놓칠 수 있습니다.',
  },
  ESFP: {
    code: 'ESFP',
    title: '밝은 표현형',
    communicationStyle: '감정과 반응을 숨기지 않고 생생하게 나눕니다.',
    relationshipHint: '칭찬, 즐거움, 즉각적인 반응이 관계를 따뜻하게 합니다.',
    caution: '분위기를 살리려다 중요한 불편함을 가볍게 넘길 수 있습니다.',
  },
  ENFP: {
    code: 'ENFP',
    title: '활기찬 가능성형',
    communicationStyle: '아이디어와 감정을 넓게 열어두고 대화합니다.',
    relationshipHint: '새로운 시도와 응원이 관계의 설렘을 키웁니다.',
    caution: '관심이 넓어지면 상대가 우선순위에서 밀렸다고 느낄 수 있습니다.',
  },
  ENTP: {
    code: 'ENTP',
    title: '유연한 아이디어형',
    communicationStyle: '질문과 반전을 던지며 대화를 확장합니다.',
    relationshipHint: '가벼운 논쟁도 놀이처럼 받아주는 관계에서 활력이 납니다.',
    caution: '장난스러운 반박이 상대에게 공격처럼 들릴 수 있습니다.',
  },
  ESTJ: {
    code: 'ESTJ',
    title: '분명한 추진형',
    communicationStyle: '해야 할 일과 기준을 빠르게 정리해 말합니다.',
    relationshipHint: '역할과 약속이 명확할수록 믿음이 단단해집니다.',
    caution: '정리하려는 말투가 상대에게 지시처럼 들릴 수 있습니다.',
  },
  ESFJ: {
    code: 'ESFJ',
    title: '살피는 조율형',
    communicationStyle: '관계 분위기와 상대의 반응을 보며 맞춰갑니다.',
    relationshipHint: '고마움과 인정 표현이 관계 만족도를 크게 올립니다.',
    caution: '상대를 챙기다 자기 마음을 뒤로 미룰 수 있습니다.',
  },
  ENFJ: {
    code: 'ENFJ',
    title: '따뜻한 이끄는형',
    communicationStyle: '상대의 가능성을 보고 격려하며 방향을 제안합니다.',
    relationshipHint: '함께 성장한다는 느낌이 관계를 깊게 만듭니다.',
    caution: '좋은 방향으로 이끌려는 마음이 부담으로 느껴질 수 있습니다.',
  },
  ENTJ: {
    code: 'ENTJ',
    title: '큰 그림 추진형',
    communicationStyle: '목표와 결과를 보며 단호하게 대화를 이끕니다.',
    relationshipHint: '서로의 계획과 성취를 존중할 때 강한 팀처럼 움직입니다.',
    caution: '감정의 확인 없이 결론만 내면 상대가 밀린다고 느낄 수 있습니다.',
  },
};

export function isPersonalityTypeCode(value: unknown): value is PersonalityTypeCode {
  return typeof value === 'string' && value in PERSONALITY_TYPE_PROFILES;
}

export function getPersonalityTypeProfile(
  typeCode: PersonalityTypeCode
): PersonalityTypeProfile {
  return PERSONALITY_TYPE_PROFILES[typeCode];
}
