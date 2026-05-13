import type {
  PersonalityAxis,
  PersonalityAxisPole,
  PersonalityAxisScores,
  PersonalityCheckAnswer,
  PersonalityCheckQuestion,
  PersonalityCheckResult,
  PersonalityTypeCode,
} from './personality.types';

const AXIS_POSITIVE_POLE: Record<PersonalityAxis, PersonalityAxisPole> = {
  IE: 'E',
  SN: 'N',
  TF: 'F',
  JP: 'P',
};

const AXIS_NEGATIVE_POLE: Record<PersonalityAxis, PersonalityAxisPole> = {
  IE: 'I',
  SN: 'S',
  TF: 'T',
  JP: 'J',
};

export const PERSONALITY_SELF_CHECK_QUESTIONS: readonly PersonalityCheckQuestion[] = [
  {
    id: 'energy-after-meeting',
    axis: 'IE',
    title: '사람을 만나고 난 뒤 보통 어떤 쪽에 가까운가요?',
    options: [
      {
        value: 'quiet-reset',
        label: '혼자 쉬면서 다시 충전돼요',
        pole: 'I',
        score: -2,
      },
      {
        value: 'talk-reset',
        label: '이야기를 나누면 더 살아나요',
        pole: 'E',
        score: 2,
      },
    ],
  },
  {
    id: 'conversation-start',
    axis: 'IE',
    title: '대화를 시작할 때 더 편한 방식은 무엇인가요?',
    options: [
      {
        value: 'listen-first',
        label: '먼저 듣고 천천히 말해요',
        pole: 'I',
        score: -1,
      },
      {
        value: 'open-first',
        label: '먼저 말을 꺼내며 분위기를 열어요',
        pole: 'E',
        score: 1,
      },
    ],
  },
  {
    id: 'information-focus',
    axis: 'SN',
    title: '상황을 볼 때 먼저 들어오는 것은 무엇인가요?',
    options: [
      {
        value: 'facts-now',
        label: '지금 보이는 사실과 경험',
        pole: 'S',
        score: -2,
      },
      {
        value: 'meaning-next',
        label: '그 안의 의미와 다음 가능성',
        pole: 'N',
        score: 2,
      },
    ],
  },
  {
    id: 'advice-style',
    axis: 'SN',
    title: '조언을 들을 때 더 와닿는 말은 무엇인가요?',
    options: [
      {
        value: 'specific-step',
        label: '오늘 바로 할 수 있는 구체적인 방법',
        pole: 'S',
        score: -1,
      },
      {
        value: 'bigger-direction',
        label: '앞으로의 방향과 큰 흐름',
        pole: 'N',
        score: 1,
      },
    ],
  },
  {
    id: 'decision-standard',
    axis: 'TF',
    title: '결정을 내릴 때 더 크게 보는 것은 무엇인가요?',
    options: [
      {
        value: 'reason-standard',
        label: '이유와 기준이 맞는지',
        pole: 'T',
        score: -2,
      },
      {
        value: 'heart-standard',
        label: '마음이 상하지 않고 괜찮은지',
        pole: 'F',
        score: 2,
      },
    ],
  },
  {
    id: 'conflict-response',
    axis: 'TF',
    title: '갈등이 생기면 먼저 하고 싶은 쪽은 무엇인가요?',
    options: [
      {
        value: 'solve-cause',
        label: '원인을 정리하고 해결책을 찾아요',
        pole: 'T',
        score: -1,
      },
      {
        value: 'check-feeling',
        label: '서로의 마음을 먼저 확인해요',
        pole: 'F',
        score: 1,
      },
    ],
  },
  {
    id: 'schedule-comfort',
    axis: 'JP',
    title: '약속이나 일정은 어느 쪽이 편한가요?',
    options: [
      {
        value: 'planned',
        label: '미리 정해두면 편해요',
        pole: 'J',
        score: -2,
      },
      {
        value: 'flexible',
        label: '상황에 맞게 바꿀 여지가 좋아요',
        pole: 'P',
        score: 2,
      },
    ],
  },
  {
    id: 'unfinished-task',
    axis: 'JP',
    title: '마무리되지 않은 일이 있을 때 어떤 편인가요?',
    options: [
      {
        value: 'finish-first',
        label: '끝내야 마음이 놓여요',
        pole: 'J',
        score: -1,
      },
      {
        value: 'keep-open',
        label: '조금 남겨둬도 괜찮아요',
        pole: 'P',
        score: 1,
      },
    ],
  },
];

function getQuestionById(questionId: string): PersonalityCheckQuestion | null {
  return PERSONALITY_SELF_CHECK_QUESTIONS.find((question) => question.id === questionId) ?? null;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function calculatePersonalityAxisScores(
  answers: readonly PersonalityCheckAnswer[]
): PersonalityAxisScores {
  const scores: PersonalityAxisScores = {
    IE: 0,
    SN: 0,
    TF: 0,
    JP: 0,
  };

  for (const answer of answers) {
    const question = getQuestionById(answer.questionId);
    if (!question) continue;

    const option = question.options.find((item) => item.value === answer.value);
    if (!option) continue;

    scores[question.axis] += option.score;
  }

  return scores;
}

export function buildPersonalityTypeCode(axisScores: PersonalityAxisScores): PersonalityTypeCode {
  const code = (['IE', 'SN', 'TF', 'JP'] as const)
    .map((axis) => {
      if (axisScores[axis] > 0) return AXIS_POSITIVE_POLE[axis];
      return AXIS_NEGATIVE_POLE[axis];
    })
    .join('');

  return code as PersonalityTypeCode;
}

export function calculatePersonalityConfidence(
  answers: readonly PersonalityCheckAnswer[],
  axisScores: PersonalityAxisScores
): number {
  const answeredQuestionIds = new Set(
    answers
      .filter((answer) => {
        const question = getQuestionById(answer.questionId);
        return question?.options.some((option) => option.value === answer.value) ?? false;
      })
      .map((answer) => answer.questionId)
  );
  const completeness = answeredQuestionIds.size / PERSONALITY_SELF_CHECK_QUESTIONS.length;
  const axisMargins = (Object.keys(axisScores) as PersonalityAxis[]).map((axis) =>
    Math.min(1, Math.abs(axisScores[axis]) / 3)
  );
  const averageMargin =
    axisMargins.reduce((total, margin) => total + margin, 0) / axisMargins.length;

  return clampConfidence(0.35 + completeness * 0.4 + averageMargin * 0.25);
}

export function estimatePersonalityType(
  answers: readonly PersonalityCheckAnswer[]
): PersonalityCheckResult {
  const axisScores = calculatePersonalityAxisScores(answers);
  const typeCode = buildPersonalityTypeCode(axisScores);
  const answeredQuestionIds = new Set(
    answers
      .filter((answer) => {
        const question = getQuestionById(answer.questionId);
        return question?.options.some((option) => option.value === answer.value) ?? false;
      })
      .map((answer) => answer.questionId)
  );
  const missingQuestionIds = PERSONALITY_SELF_CHECK_QUESTIONS.filter(
    (question) => !answeredQuestionIds.has(question.id)
  ).map((question) => question.id);

  return {
    typeCode,
    confidence: calculatePersonalityConfidence(answers, axisScores),
    axisScores,
    answeredCount: answeredQuestionIds.size,
    missingQuestionIds,
  };
}
