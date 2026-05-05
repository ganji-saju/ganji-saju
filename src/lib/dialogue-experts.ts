export type DialogueExpertId =
  | 'rat'
  | 'ox'
  | 'tiger'
  | 'rabbit'
  | 'dragon'
  | 'snake'
  | 'horse'
  | 'sheep'
  | 'monkey'
  | 'rooster'
  | 'dog'
  | 'pig';

export interface DialogueExpertMeta {
  id: DialogueExpertId;
  glyph: string;
  animal: string;
  label: string;
  topic: string;
  description: string;
  answerFrame: string;
  keywords: readonly string[];
}

export const DEFAULT_DIALOGUE_EXPERT_ID: DialogueExpertId = 'dragon';

export const DIALOGUE_EXPERTS: readonly DialogueExpertMeta[] = [
  {
    id: 'rat',
    glyph: '鼠',
    animal: '쥐',
    label: '성향 풀이',
    topic: '성격, 말투, 관계 습관',
    description: '내가 왜 이렇게 반응하는지 성향과 마음 패턴을 짚습니다.',
    answerFrame: '성향과 심리 반응을 먼저 읽고, 관계에서 반복되는 말투와 행동 습관을 현실적으로 정리합니다.',
    keywords: ['성향', '말투', '심리', '반응', '습관'],
  },
  {
    id: 'ox',
    glyph: '牛',
    animal: '소',
    label: '오늘운',
    topic: '오늘의 조심점과 행동',
    description: '오늘 해야 할 일과 피해야 할 행동을 짧게 정리합니다.',
    answerFrame: '오늘의 컨디션, 말, 돈, 관계에서 바로 조절할 행동을 한 가지씩 좁혀 답합니다.',
    keywords: ['오늘', '하루', '컨디션', '루틴', '행동'],
  },
  {
    id: 'tiger',
    glyph: '虎',
    animal: '호랑이',
    label: '깊은 사주',
    topic: '타고난 흐름과 반복 패턴',
    description: '반복되는 선택, 흐름, 큰 방향을 깊게 봅니다.',
    answerFrame: '타고난 흐름과 반복 패턴을 생활 언어로 풀고, 장기적으로 무엇을 밀고 줄일지 답합니다.',
    keywords: ['사주', '흐름', '패턴', '방향', '반복'],
  },
  {
    id: 'rabbit',
    glyph: '兎',
    animal: '토끼',
    label: '타로 마음',
    topic: '지금 마음과 선택',
    description: '지금 마음이 어디에 걸려 있는지 카드식으로 읽습니다.',
    answerFrame: '정답을 단정하기보다 지금 마음이 붙잡고 있는 장면, 두려움, 선택의 감각을 중심으로 답합니다.',
    keywords: ['타로', '마음', '선택', '속마음', '감정'],
  },
  {
    id: 'dragon',
    glyph: '龍',
    animal: '용',
    label: '사주 종합',
    topic: '전체 운세와 핵심 판단',
    description: '사주, 오늘 흐름, 분야별 조언을 가장 균형 있게 봅니다.',
    answerFrame: '질문에 대한 결론을 먼저 말하고, 이유, 조심할 점, 지금 할 행동을 종합적으로 답합니다.',
    keywords: ['종합', '사주', '운세', '판단', '행동'],
  },
  {
    id: 'snake',
    glyph: '蛇',
    animal: '뱀',
    label: '꿈과 마음',
    topic: '꿈, 무의식, 마음 신호',
    description: '꿈에 남은 장면이나 마음의 신호를 부드럽게 풀이합니다.',
    answerFrame: '꿈이나 반복되는 생각을 미래 단정이 아니라 마음이 보내는 신호로 보고 현실 조언으로 연결합니다.',
    keywords: ['꿈', '무의식', '불안', '징조', '마음'],
  },
  {
    id: 'horse',
    glyph: '馬',
    animal: '말',
    label: '이동과 일',
    topic: '이직, 이동, 새 출발',
    description: '이직, 이사, 여행, 새 시도 타이밍을 봅니다.',
    answerFrame: '움직여도 되는 시점과 아직 확인해야 할 조건을 나누어 답하고, 결정 전 점검할 기준을 제시합니다.',
    keywords: ['이직', '이사', '이동', '직장', '시작'],
  },
  {
    id: 'sheep',
    glyph: '羊',
    animal: '양',
    label: '궁합과 관계',
    topic: '연애, 가족, 인간관계',
    description: '상대와의 거리감, 말투, 다시 이어질 가능성을 봅니다.',
    answerFrame: '상대와 나의 속도 차이, 표현 방식, 서운함이 생기는 지점을 먼저 짚고 관계 조언으로 답합니다.',
    keywords: ['연애', '궁합', '가족', '관계', '상대'],
  },
  {
    id: 'monkey',
    glyph: '猿',
    animal: '원숭이',
    label: '인상과 이미지',
    topic: '첫인상, 이미지, 사회적 분위기',
    description: '사람들에게 어떻게 보이는지와 이미지 운용을 봅니다.',
    answerFrame: '외모 판단을 단정하지 않고, 말투와 태도, 첫인상 관리, 사회적 이미지 활용법으로 답합니다.',
    keywords: ['관상', '이미지', '첫인상', '평판', '분위기'],
  },
  {
    id: 'rooster',
    glyph: '鶏',
    animal: '닭',
    label: '재물운',
    topic: '돈, 지출, 수입, 사업',
    description: '돈이 들어오고 새는 패턴을 현실적으로 짚습니다.',
    answerFrame: '돈이 모이는 방식보다 먼저 새는 구멍, 협상, 정산, 지출 습관을 짚고 현실 행동으로 답합니다.',
    keywords: ['돈', '재물', '수입', '지출', '사업'],
  },
  {
    id: 'dog',
    glyph: '犬',
    animal: '개',
    label: '생활 습관',
    topic: '몸 상태, 습관, 생활 리듬',
    description: '무리하지 않는 생활 리듬과 컨디션 관리 관점으로 봅니다.',
    answerFrame: '의료 판단은 하지 않고, 피로가 쌓이는 습관과 생활 리듬에서 먼저 조절할 부분을 답합니다.',
    keywords: ['건강', '생활', '습관', '피로', '리듬'],
  },
  {
    id: 'pig',
    glyph: '猪',
    animal: '돼지',
    label: '행운과 기회',
    topic: '기회, 작은 행운, 좋은 타이밍',
    description: '작게 시도해볼 일과 기회를 잡는 방식을 봅니다.',
    answerFrame: '막연한 행운보다 지금 잡기 좋은 작은 기회, 사람, 연락, 제안의 타이밍을 중심으로 답합니다.',
    keywords: ['행운', '기회', '타이밍', '제안', '복'],
  },
] as const;

const DIALOGUE_EXPERT_BY_ID = new Map(DIALOGUE_EXPERTS.map((expert) => [expert.id, expert]));

export function normalizeDialogueExpertId(value: unknown): DialogueExpertId | null {
  if (typeof value !== 'string') return null;
  return DIALOGUE_EXPERT_BY_ID.has(value as DialogueExpertId)
    ? (value as DialogueExpertId)
    : null;
}

export function inferDialogueExpertIdFromMessage(message: string): DialogueExpertId | null {
  if (/(돈|재물|금전|수입|지출|투자|사업|매출|정산)/.test(message)) return 'rooster';
  if (/(연애|애정|썸|고백|이별|결혼|소개팅|재회|궁합|상대|관계|가족|부모|친구|동료)/.test(message)) return 'sheep';
  if (/(직장|회사|업무|이직|승진|취업|커리어|면접|이사|이동|여행)/.test(message)) return 'horse';
  if (/(타로|카드|속마음|마음|선택)/.test(message)) return 'rabbit';
  if (/(꿈|무의식|잠|징조)/.test(message)) return 'snake';
  if (/(건강|피로|생활|습관|몸|리듬)/.test(message)) return 'dog';
  if (/(관상|인상|이미지|평판|분위기)/.test(message)) return 'monkey';
  if (/(행운|기회|복|타이밍|제안)/.test(message)) return 'pig';
  if (/(성향|성격|MBTI|말투|반응)/i.test(message)) return 'rat';
  if (/(깊게|전체|사주|운세|흐름|패턴)/.test(message)) return 'tiger';
  if (/(오늘|하루|지금|컨디션|루틴)/.test(message)) return 'ox';
  return null;
}

export function resolveDialogueExpertId(...values: Array<unknown>): DialogueExpertId {
  for (const value of values) {
    const normalized = normalizeDialogueExpertId(value);
    if (normalized) return normalized;
  }

  return DEFAULT_DIALOGUE_EXPERT_ID;
}

export function getDialogueExpertMeta(value: unknown): DialogueExpertMeta {
  const id = resolveDialogueExpertId(value);
  return DIALOGUE_EXPERT_BY_ID.get(id) ?? DIALOGUE_EXPERT_BY_ID.get(DEFAULT_DIALOGUE_EXPERT_ID)!;
}

export function buildDialogueExpertInstructions(expertId: DialogueExpertId) {
  const expert = getDialogueExpertMeta(expertId);

  return [
    `이번 답변의 전문 분야는 ${expert.animal}띠 ${expert.label}입니다.`,
    `주제 범위는 ${expert.topic}입니다.`,
    expert.answerFrame,
    `답변에서는 ${expert.keywords.join(', ')} 관점을 우선합니다.`,
    '대화 담당 선생의 성별이나 캐릭터 말투를 따로 연기하지 않습니다. 선택된 12간지 분야의 전문 판단으로 답합니다.',
  ];
}
