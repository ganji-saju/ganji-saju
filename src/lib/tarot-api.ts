import tarotCardData from '@/data/tarot-card-data.json';

export type TarotOrientation = 'upright' | 'reversed';
export type TarotQuestionTone = 'daily' | 'relationship' | 'choice' | 'direction';
export type TarotDeckSource = 'api' | 'local';
export type TarotSuit = 'cups' | 'pentacles' | 'swords' | 'wands';
export type TarotQuestionDomain = 'daily' | 'relationship' | 'career' | 'money';
export type TarotQuestionSubject = 'self' | 'other' | 'relationship' | 'situation';
export type TarotQuestionIntent =
  | 'general'
  | 'feelings'
  | 'contact'
  | 'reconciliation'
  | 'decision'
  | 'timing';
export type TarotQuestionMood = 'steady' | 'anxious' | 'hopeful' | 'tired' | 'urgent';

export interface TarotApiCard {
  type: 'major' | 'minor';
  name_short: string;
  name: string;
  value: string;
  value_int: number;
  meaning_up: string;
  meaning_rev: string;
  desc: string;
  suit?: TarotSuit;
}

export interface TarotReading {
  card: TarotApiCard;
  displayName: string;
  shortName: string;
  arcanaLabel: string;
  cardMarker: string;
  orientation: TarotOrientation;
  tone: TarotQuestionTone;
  toneLabel: string;
  theme: string;
  subtitle: string;
  keyword: string;
  questionInsight: string;
  answer: string;
  psychologyLabel: string;
  psychology: string;
  guidance: string;
  sajuBlend: string;
  action: string;
  source: TarotDeckSource;
  meaningExcerpt: string;
}

export interface TarotSpreadCard {
  position: string;
  reading: TarotReading;
}

export interface TarotPickerCard {
  slot: number;
  card: TarotApiCard;
  orientation: TarotOrientation;
}

export interface TarotPickerDeck {
  cards: TarotPickerCard[];
  source: TarotDeckSource;
  tone: TarotQuestionTone;
  toneLabel: string;
}

interface TarotQuestionContext {
  normalizedQuestion: string;
  tone: TarotQuestionTone;
  domain: TarotQuestionDomain;
  subject: TarotQuestionSubject;
  intent: TarotQuestionIntent;
  mood: TarotQuestionMood;
}

interface TarotCardTheme {
  theme: string;
  focus: string;
  action: string;
  sajuElement: string;
}

const TAROT_API_CARDS_URL = 'https://tarotapi.dev/api/v1/cards';
const REVALIDATE_SECONDS = 60 * 60 * 12;
const TAROT_API_TIMEOUT_MS = 2_500;
const SUITS = ['cups', 'pentacles', 'swords', 'wands'] as const;
const FALLBACK_PAYLOAD = tarotCardData as unknown as { cards?: unknown };
const FALLBACK_CARDS = normalizeCards(FALLBACK_PAYLOAD.cards);

const TONE_LABELS: Record<TarotQuestionTone, string> = {
  daily: '오늘의 메시지',
  relationship: '관계 질문',
  choice: '선택 질문',
  direction: '방향 질문',
};

const MAJOR_CARD_NAMES: Record<string, string> = {
  'The Fool': '바보',
  'The Magician': '마법사',
  'The High Priestess': '여사제',
  'The Empress': '여황제',
  'The Emperor': '황제',
  'The Hierophant': '교황',
  'The Lovers': '연인',
  'The Chariot': '전차',
  Fortitude: '힘',
  'Wheel Of Fortune': '운명의 수레바퀴',
  Justice: '정의',
  'The Hanged Man': '매달린 사람',
  Death: '변화',
  Temperance: '절제',
  'The Devil': '악마',
  'The Tower': '탑',
  'The Star': '별',
  'The Moon': '달',
  'The Sun': '태양',
  'The Last Judgment': '심판',
  'The World': '세계',
};

const MAJOR_THEMES: Record<
  string,
  {
    theme: string;
    focus: string;
    action: string;
    sajuElement: string;
  }
> = {
  'The Fool': {
    theme: '새로운 시작과 가벼운 용기',
    focus: '완벽한 확신보다 첫 발걸음',
    action: '오늘 할 수 있는 가장 작은 시작 하나를 정해보세요.',
    sajuElement: '새 운을 받아들이는 움직임',
  },
  'The Magician': {
    theme: '의지와 실행력',
    focus: '이미 가진 도구를 꺼내 쓰는 태도',
    action: '미뤄둔 연락이나 제안을 한 가지 실행해보세요.',
    sajuElement: '타고난 재능을 현실로 옮기는 힘',
  },
  'The High Priestess': {
    theme: '직관과 조용한 통찰',
    focus: '겉말보다 마음의 결을 읽는 일',
    action: '바로 답하지 말고 마음이 먼저 반응하는 지점을 적어보세요.',
    sajuElement: '내면의 기운을 차분히 보존하는 힘',
  },
  'The Empress': {
    theme: '풍요와 돌봄',
    focus: '관계와 일에 따뜻한 여지를 주는 태도',
    action: '나와 가까운 사람에게 작은 친절을 먼저 건네보세요.',
    sajuElement: '기운을 키우고 결실로 만드는 힘',
  },
  'The Emperor': {
    theme: '질서와 책임',
    focus: '흔들리는 일을 구조화하는 태도',
    action: '오늘 결정해야 할 기준을 세 가지로 좁혀보세요.',
    sajuElement: '중심을 세우고 흐름을 붙드는 힘',
  },
  'The Hierophant': {
    theme: '원칙과 배움',
    focus: '검증된 조언과 오래된 지혜',
    action: '혼자 단정하지 말고 믿을 만한 기준을 하나 더 확인해보세요.',
    sajuElement: '전통과 경험에서 길을 찾는 힘',
  },
  'The Lovers': {
    theme: '선택과 조화',
    focus: '마음이 향하는 방향을 분명히 하는 일',
    action: '지키고 싶은 관계와 내려놓을 기대를 한 줄씩 써보세요.',
    sajuElement: '인연의 결을 고르는 힘',
  },
  'The Chariot': {
    theme: '전진과 통제',
    focus: '마음을 모아 한 방향으로 움직이는 태도',
    action: '오늘은 여러 길보다 가장 중요한 한 길을 먼저 해보세요.',
    sajuElement: '운의 속도를 조절하며 나아가는 힘',
  },
  Fortitude: {
    theme: '용기와 부드러운 힘',
    focus: '무리하기보다 다스리는 태도',
    action: '센 말보다 차분한 말로 상황을 안정시켜보세요.',
    sajuElement: '강한 기운을 온화하게 쓰는 힘',
  },
  'Wheel Of Fortune': {
    theme: '전환과 흐름',
    focus: '바뀌는 판을 읽고 맞춰 움직이는 태도',
    action: '계획 하나를 고집하기보다 대안을 함께 준비해보세요.',
    sajuElement: '시절의 흐름을 타는 감각',
  },
  Justice: {
    theme: '균형과 판단',
    focus: '감정과 사실을 나누어 보는 태도',
    action: '마음에 걸리는 일을 사실과 추측으로 나누어 정리해보세요.',
    sajuElement: '기운의 균형을 맞추는 판단력',
  },
  'The Hanged Man': {
    theme: '기다림과 관점 전환',
    focus: '서두르지 않고 다르게 바라보는 태도',
    action: '오늘은 답을 재촉하기보다 관점을 바꿔 다시 읽어보세요.',
    sajuElement: '멈춤 안에서 새 흐름을 찾는 힘',
  },
  Death: {
    theme: '정리와 재출발',
    focus: '끝처럼 보이는 장면 뒤의 새 시작',
    action: '묵은 방식 하나를 조용히 마무리해보세요.',
    sajuElement: '낡은 기운을 비우고 새 운을 들이는 힘',
  },
  Temperance: {
    theme: '조율과 회복',
    focus: '서로 다른 마음을 섞어 균형을 찾는 태도',
    action: '극단의 답보다 중간에서 살릴 수 있는 방법을 찾아보세요.',
    sajuElement: '오행의 균형을 맞추는 조화력',
  },
  'The Devil': {
    theme: '집착을 알아차리는 힘',
    focus: '나를 묶는 욕심과 불안을 부드럽게 풀어내는 일',
    action: '오늘은 꼭 붙들어야 할 것과 잠시 내려놓을 것을 구분해보세요.',
    sajuElement: '강한 욕망을 현실 감각으로 다루는 힘',
  },
  'The Tower': {
    theme: '각성과 재정비',
    focus: '흔들림 속에서 새 질서를 세우는 태도',
    action: '불편한 신호를 덮지 말고 고칠 수 있는 부분부터 손보세요.',
    sajuElement: '막힌 기운을 깨고 새 길을 내는 힘',
  },
  'The Star': {
    theme: '희망과 회복',
    focus: '멀리 있는 빛을 보며 마음을 회복하는 일',
    action: '오늘은 나를 살리는 작은 루틴 하나를 다시 시작해보세요.',
    sajuElement: '약해진 기운을 맑게 회복하는 힘',
  },
  'The Moon': {
    theme: '직관과 숨은 마음',
    focus: '보이지 않는 불안을 천천히 살피는 태도',
    action: '확인되지 않은 걱정은 잠시 내려두고 실제 신호만 보세요.',
    sajuElement: '감정의 물결을 읽는 감각',
  },
  'The Sun': {
    theme: '환함과 성취',
    focus: '감추지 않고 밝게 드러내는 태도',
    action: '감사나 칭찬, 반가운 마음을 한 번 더 표현해보세요.',
    sajuElement: '기운을 밖으로 펼쳐 결실을 부르는 힘',
  },
  'The Last Judgment': {
    theme: '부름과 재평가',
    focus: '지나온 일을 다시 보고 새 답을 듣는 태도',
    action: '오래 미뤘던 판단을 오늘의 눈으로 다시 살펴보세요.',
    sajuElement: '때가 되어 다시 깨어나는 운의 신호',
  },
  'The World': {
    theme: '완성과 통합',
    focus: '흩어진 경험을 하나의 결론으로 모으는 일',
    action: '마무리할 일 하나를 끝내고 다음 단계의 이름을 붙여보세요.',
    sajuElement: '운의 한 주기를 완성하는 힘',
  },
};

const SUIT_THEMES: Record<
  TarotSuit,
  {
    korean: string;
    marker: string;
    theme: string;
    focus: string;
    sajuElement: string;
  }
> = {
  cups: {
    korean: '컵',
    marker: '💧',
    theme: '감정과 관계',
    focus: '마음의 온도와 관계의 흐름',
    sajuElement: '수기처럼 흐르는 감정의 결',
  },
  pentacles: {
    korean: '펜타클',
    marker: '🪙',
    theme: '현실과 재물',
    focus: '손에 잡히는 안정과 생활의 기반',
    sajuElement: '토기처럼 쌓아가는 현실 감각',
  },
  swords: {
    korean: '소드',
    marker: '🌬',
    theme: '생각과 판단',
    focus: '말, 판단, 경계의 선',
    sajuElement: '금기처럼 분별하고 가르는 힘',
  },
  wands: {
    korean: '완드',
    marker: '🔥',
    theme: '의욕과 행동',
    focus: '움직임과 표현의 속도',
    sajuElement: '화기처럼 밖으로 뻗는 추진력',
  },
};

const VALUE_THEMES: Record<
  string,
  {
    korean: string;
    focus: string;
    action: string;
  }
> = {
  ace: {
    korean: '에이스',
    focus: '처음 솟는 가능성',
    action: '아직 작아도 시작 신호를 놓치지 마세요.',
  },
  two: {
    korean: '2',
    focus: '균형과 선택',
    action: '둘 중 무엇이 마음을 덜 소모시키는지 살펴보세요.',
  },
  three: {
    korean: '3',
    focus: '성장과 협력',
    action: '혼자 품기보다 함께 나눌 사람을 떠올려보세요.',
  },
  four: {
    korean: '4',
    focus: '기반과 안정',
    action: '오늘은 새 시도보다 기본을 단단히 다져보세요.',
  },
  five: {
    korean: '5',
    focus: '갈등과 조정',
    action: '불편함을 피하기보다 어디서 어긋났는지 부드럽게 확인해보세요.',
  },
  six: {
    korean: '6',
    focus: '회복과 주고받음',
    action: '받은 것과 줄 수 있는 것을 균형 있게 맞춰보세요.',
  },
  seven: {
    korean: '7',
    focus: '점검과 인내',
    action: '결과를 재촉하기보다 지금 쌓이는 과정을 확인해보세요.',
  },
  eight: {
    korean: '8',
    focus: '반복과 숙련',
    action: '잘 되는 방식을 한 번 더 반복해 흐름을 굳혀보세요.',
  },
  nine: {
    korean: '9',
    focus: '성숙과 결실',
    action: '이미 얻은 것을 인정하고 다음 욕심은 천천히 보세요.',
  },
  ten: {
    korean: '10',
    focus: '완성과 다음 단계',
    action: '마무리할 일과 이어갈 일을 나누어 정리해보세요.',
  },
  page: {
    korean: '페이지',
    focus: '소식과 배움',
    action: '새로 들어온 말이나 신호를 가볍게 흘리지 마세요.',
  },
  knight: {
    korean: '기사',
    focus: '움직임과 추진',
    action: '마음이 움직이는 방향을 작게라도 행동으로 옮겨보세요.',
  },
  queen: {
    korean: '여왕',
    focus: '수용과 보살핌',
    action: '상황을 품되 내 마음까지 소진하지 않게 경계를 세워보세요.',
  },
  king: {
    korean: '왕',
    focus: '주도권과 책임',
    action: '오늘은 피하지 말고 필요한 결정을 차분히 맡아보세요.',
  },
};

const TONE_FOCUS: Record<TarotQuestionTone, (theme: string, focus: string) => string> = {
  daily: (theme, focus) => `오늘 하루에는 ${theme}의 흐름이 올라옵니다. 특히 ${focus}을 차분히 살피면 하루의 결이 부드러워집니다.`,
  relationship: (theme, focus) => `관계에서는 ${theme}이 중요한 장면으로 보입니다. 상대의 말보다 ${focus}을 먼저 읽으면 마음의 거리를 더 정확히 잡을 수 있습니다.`,
  choice: (theme, focus) => `선택 앞에서는 ${theme}이 기준이 됩니다. 지금은 ${focus}을 기준으로 두면 흔들림이 줄어듭니다.`,
  direction: (theme, focus) => `앞으로의 방향은 ${theme}에서 실마리가 보입니다. 멀리 보려 하기보다 ${focus}부터 정리해보세요.`,
};

const OPEN_MAJOR_CARDS = new Set([
  'The Fool',
  'The Magician',
  'The Lovers',
  'The Star',
  'The Sun',
  'The Last Judgment',
  'The World',
]);

const INWARD_MAJOR_CARDS = new Set([
  'The High Priestess',
  'The Hermit',
  'The Hanged Man',
  'The Moon',
]);

const CONTROL_MAJOR_CARDS = new Set([
  'The Emperor',
  'The Hierophant',
  'The Chariot',
  'Justice',
  'Temperance',
]);

function analyzeQuestion(question: string): TarotQuestionContext {
  const normalizedQuestion = normalizeQuestion(question);
  const tone = detectQuestionTone(normalizedQuestion);
  const subject: TarotQuestionSubject = /(상대|그 사람|그사람|그분|그의|그녀|저 사람)/.test(normalizedQuestion)
    ? 'other'
    : /(우리|관계|사이|연애|썸|인연|재회)/.test(normalizedQuestion)
      ? 'relationship'
      : /(직장|회사|사업|진로|돈|금전|매출|투자|계약|방향|흐름)/.test(normalizedQuestion)
        ? 'situation'
        : 'self';
  const domain: TarotQuestionDomain = /(직장|회사|커리어|진로|이직|일)/.test(normalizedQuestion)
    ? 'career'
    : /(돈|금전|재물|투자|매출|정산|계약비|지출)/.test(normalizedQuestion)
      ? 'money'
      : tone === 'relationship'
        ? 'relationship'
        : 'daily';
  const intent: TarotQuestionIntent = /(마음|심리|생각|속마음|진심)/.test(normalizedQuestion)
    ? 'feelings'
    : /(연락|카톡|전화|답장|dm|문자)/i.test(normalizedQuestion)
      ? 'contact'
      : /(재회|다시 이어|다시 만|돌아오)/.test(normalizedQuestion)
        ? 'reconciliation'
        : /(언제|시기|타이밍|몇 월|몇주|가능성 언제)/.test(normalizedQuestion)
          ? 'timing'
          : tone === 'choice' || /(선택|결정|해야|말아|괜찮을까|갈까|할까)/.test(normalizedQuestion)
            ? 'decision'
            : 'general';
  const mood: TarotQuestionMood = /(불안|걱정|두렵|무섭|답답|초조|흔들)/.test(normalizedQuestion)
    ? 'anxious'
    : /(기대|바라|원하|좋아|보고 싶|희망)/.test(normalizedQuestion)
      ? 'hopeful'
      : /(지쳤|지치|피곤|힘들|소모)/.test(normalizedQuestion)
        ? 'tired'
        : /(당장|빨리|지금 바로|오늘 꼭)/.test(normalizedQuestion)
          ? 'urgent'
          : 'steady';

  return {
    normalizedQuestion,
    tone,
    domain,
    subject,
    intent,
    mood,
  };
}

function getCardFlowState(card: TarotApiCard, orientation: TarotOrientation) {
  if (orientation === 'reversed') return 'blocked' as const;

  if (card.type === 'major') {
    if (OPEN_MAJOR_CARDS.has(card.name)) return 'open' as const;
    if (INWARD_MAJOR_CARDS.has(card.name)) return 'inward' as const;
    if (CONTROL_MAJOR_CARDS.has(card.name)) return 'steady' as const;
    return 'turning' as const;
  }

  if (card.suit === 'cups' || card.suit === 'wands') return 'open' as const;
  if (card.suit === 'pentacles') return 'steady' as const;
  if (card.suit === 'swords') return 'guarded' as const;

  return 'turning' as const;
}

function getSubjectLabel(context: TarotQuestionContext) {
  switch (context.subject) {
    case 'other':
      return '상대';
    case 'relationship':
      return '두 사람 사이';
    case 'situation':
      return '지금 상황';
    case 'self':
    default:
      return '선생님 마음';
  }
}

function buildQuestionInsight(context: TarotQuestionContext) {
  const moodLine =
    context.mood === 'anxious'
      ? '답을 빨리 알아 마음을 진정시키고 싶은 마음이 깔려 있습니다.'
      : context.mood === 'hopeful'
        ? '좋은 가능성이 아직 살아 있는지 확인하고 싶은 기대가 섞여 있습니다.'
        : context.mood === 'tired'
          ? '더 상처받거나 소모되지 않는 쪽을 찾고 싶은 피로가 느껴집니다.'
          : context.mood === 'urgent'
            ? '시간을 더 끌기보다 지금 움직여도 되는지 확인하고 싶은 조급함이 보입니다.'
            : '겉질문보다 실제 마음의 방향을 분명히 하고 싶은 상태에 가깝습니다.';

  switch (context.intent) {
    case 'feelings':
      return `이 질문은 단순히 결과를 묻는 것이 아니라, ${getSubjectLabel(context)}이 아직 열려 있는지 확인하고 싶은 질문입니다. ${moodLine}`;
    case 'contact':
      return `겉으로는 연락해도 되는지를 묻고 있지만, 실제로는 지금 말을 건넸을 때 상처가 덜한 타이밍인지 확인하고 싶은 질문입니다. ${moodLine}`;
    case 'reconciliation':
      return `이 질문은 다시 이어질 수 있는지만이 아니라, 예전의 상처와 방식이 얼마나 정리되었는지를 함께 묻는 질문입니다. ${moodLine}`;
    case 'decision':
      return `이 질문은 무엇이 맞는지보다, 지금 바로 진행해도 되는지 아니면 한 번 더 보고 가야 하는지를 확인하려는 질문입니다. ${moodLine}`;
    case 'timing':
      return `이 질문은 결과보다 흐름의 타이밍을 보려는 질문입니다. ${moodLine}`;
    case 'general':
    default:
      return `지금 질문에는 단순한 궁금증보다, 현재 흐름을 오해 없이 읽고 싶다는 마음이 들어 있습니다. ${moodLine}`;
  }
}

function buildPsychologyCopy(
  card: TarotApiCard,
  orientation: TarotOrientation,
  context: TarotQuestionContext
) {
  const flow = getCardFlowState(card, orientation);
  const subjectLabel = getSubjectLabel(context);
  const label =
    context.subject === 'other'
      ? '상대 심리'
      : context.subject === 'relationship'
        ? '관계 심리'
        : '지금 마음';

  let summary = '';

  if (context.subject === 'other' && context.intent === 'feelings') {
    if (flow === 'open') {
      summary = `${subjectLabel}는 완전히 닫힌 쪽보다 감정이 아직 살아 있는 쪽에 가깝습니다. 다만 마음이 있어도 바로 크게 표현하기보다 반응을 살피며 움직일 가능성이 큽니다.`;
    } else if (flow === 'steady') {
      summary = `${subjectLabel}는 감정이 없어서라기보다 현실 가능성과 안정성을 먼저 보려는 심리가 강합니다. 마음보다 상황 정리가 먼저여야 움직이기 쉬운 타입으로 읽힙니다.`;
    } else if (flow === 'guarded') {
      summary = `${subjectLabel}는 지금 감정보다 생각과 경계가 앞서 있습니다. 상처를 되풀이하지 않으려는 마음이 있어, 쉽게 속마음을 드러내지 않을 수 있습니다.`;
    } else if (flow === 'blocked') {
      summary = `${subjectLabel}는 마음이 아예 없는 것보다, 지금은 감정과 상황이 뒤엉켜 표현이 막혀 있는 상태에 가깝습니다. 당장 확답을 기대하면 더 움츠러들 수 있습니다.`;
    } else {
      summary = `${subjectLabel}는 마음의 방향이 완전히 정해졌다기보다 큰 전환점 위에 서 있는 모습입니다. 지금은 한 번에 단정하기보다 흐름을 더 지켜보는 편이 맞습니다.`;
    }
  } else if (context.subject === 'other' && context.intent === 'contact') {
    if (flow === 'open') {
      summary = `${subjectLabel}는 말을 끊고 싶은 상태보다는, 부담이 크지 않은 접점이라면 받아볼 여지가 있는 쪽으로 읽힙니다.`;
    } else if (flow === 'blocked') {
      summary = `${subjectLabel}는 지금 연락 자체보다 마음의 정리와 여유가 먼저 필요한 상태에 가깝습니다. 바로 깊은 대화를 열면 방어가 올라올 수 있습니다.`;
    } else {
      summary = `${subjectLabel}는 반응을 아예 끊고 싶은 것보다, 지금은 속도와 수위를 조절하고 싶은 심리가 더 크게 보입니다.`;
    }
  } else {
    if (flow === 'open') {
      summary = `${subjectLabel}은 답을 알고 싶다는 마음과 함께 직접 움직여 보고 싶은 기운도 함께 올라와 있습니다. 다만 조급함보다 자연스러운 흐름을 타는 편이 더 좋습니다.`;
    } else if (flow === 'steady') {
      summary = `${subjectLabel}은 감정만으로 결정하기보다 기준과 안전선을 먼저 확인하고 싶어 합니다. 그래서 느려 보여도 생각이 없는 상태는 아닙니다.`;
    } else if (flow === 'guarded') {
      summary = `${subjectLabel}은 감정이 없는 것이 아니라, 먼저 판단하고 상처를 피하려는 방어가 앞서 있습니다. 말보다 속뜻을 정리하는 시간이 필요합니다.`;
    } else if (flow === 'blocked') {
      summary = `${subjectLabel}은 지금 결과를 내기보다 불안과 피로를 먼저 가라앉혀야 하는 상태에 가깝습니다. 서두르면 마음이 더 꼬일 수 있습니다.`;
    } else {
      summary = `${subjectLabel}은 지금 하나의 결론보다 큰 흐름의 전환점을 지나고 있습니다. 그래서 평소보다 작은 신호도 크게 느껴질 수 있습니다.`;
    }
  }

  return { label, summary };
}

function buildDirectAnswer(
  card: TarotApiCard,
  orientation: TarotOrientation,
  context: TarotQuestionContext
) {
  const flow = getCardFlowState(card, orientation);
  const theme = getCardTheme(card);
  const cardLead = buildCardLead(card, orientation, theme);
  const withCardLead = (body: string) => `${cardLead} ${body}`;

  if (context.intent === 'feelings') {
    if (flow === 'open') {
      return withCardLead('마음이 완전히 식었다기보다, 아직 반응할 여지와 감정의 온도가 남아 있는 쪽에 가깝습니다.');
    }

    if (flow === 'steady') {
      return withCardLead('마음이 없다고 단정하기보다, 감정보다 현실과 안정성을 먼저 따지는 흐름이 더 강하게 보입니다.');
    }

    if (flow === 'guarded') {
      return withCardLead('관심의 유무보다 경계와 판단이 먼저 올라와 있어, 속마음이 있어도 쉽게 드러나지 않을 수 있습니다.');
    }

    return withCardLead('지금은 마음의 유무를 단정하기보다, 감정과 상황이 정리되지 않아 표현이 막혀 있는 흐름으로 보는 편이 더 맞습니다.');
  }

  if (context.intent === 'contact') {
    if (flow === 'open') {
      return withCardLead('큰 확인보다 가벼운 안부 정도는 닿을 수 있는 흐름입니다. 다만 무거운 결론을 바로 꺼내는 방식은 피하는 편이 좋습니다.');
    }

    if (flow === 'blocked') {
      return withCardLead('바로 답을 받으려는 연락은 부담이 될 수 있습니다. 짧고 가벼운 접점부터 열거나, 한 템포 두는 쪽이 더 낫습니다.');
    }

    return withCardLead('연락 자체가 문제라기보다 수위와 타이밍이 중요합니다. 확인받으려는 말보다 부담 없는 말이 더 잘 맞습니다.');
  }

  if (context.intent === 'reconciliation') {
    if (flow === 'open' || flow === 'turning') {
      return withCardLead('다시 이어질 여지는 남아 있지만, 예전 방식 그대로 돌아가기보다 관계의 방식이 달라져야 길이 열립니다.');
    }

    return withCardLead('재회 가능성을 단정히 닫을 단계는 아니지만, 지금은 감정보다 정리되지 않은 문제를 먼저 보는 흐름입니다.');
  }

  if (context.intent === 'decision' || context.tone === 'choice') {
    if (flow === 'open') {
      return withCardLead('진행해도 됩니다. 다만 감정만 믿고 크게 가기보다, 작게 시험해 보며 반응을 확인하는 방식이 가장 좋습니다.');
    }

    if (flow === 'steady') {
      return withCardLead('진행은 가능하지만 조건 점검이 먼저입니다. 기준과 현실선을 확인한 뒤 움직이면 후회가 줄어듭니다.');
    }

    if (flow === 'guarded' || flow === 'blocked') {
      return withCardLead('지금은 바로 결론을 내리기보다 한 박자 보류가 더 맞습니다. 서두르면 마음보다 피로가 커질 수 있습니다.');
    }

    return withCardLead('방향은 열려 있지만 서두를 때보다 관점을 한 번 바꿔 본 뒤 움직일 때 더 잘 맞는 흐름입니다.');
  }

  if (context.domain === 'career') {
    return withCardLead(
      flow === 'blocked'
        ? '일과 방향은 아직 무리하게 키우기보다 정리와 재정비가 먼저입니다.'
        : '일의 흐름은 열려 있습니다. 다만 속도보다 기준을 세운 전진이 더 오래 갑니다.'
    );
  }

  if (context.domain === 'money') {
    return withCardLead(
      flow === 'open'
        ? '돈은 움직일 수 있지만, 지금은 큰 승부보다 작고 확실한 선택이 더 맞습니다.'
        : '재물 흐름은 공격보다 점검이 먼저입니다. 새 지출보다 기존 구조를 정리하는 편이 안전합니다.'
    );
  }

  return withCardLead(
    flow === 'blocked'
      ? '지금은 억지로 답을 만들기보다 마음과 상황을 한 번 정리하고 보는 흐름입니다.'
      : '흐름은 나쁘지 않습니다. 오늘은 작게 움직이며 반응을 보는 쪽이 가장 맞습니다.'
  );
}

function buildSpreadPositions(context: TarotQuestionContext) {
  if (context.intent === 'feelings') {
    return ['겉으로 보이는 마음', '속으로 남은 감정', '관계를 움직일 한 수'];
  }

  if (context.intent === 'contact') {
    return ['지금 거리감', '연락했을 때의 반응', '가장 나은 접근'];
  }

  if (context.intent === 'reconciliation') {
    return ['끊어진 이유', '아직 남은 인연', '다시 이어질 조건'];
  }

  if (context.intent === 'decision') {
    return ['지금 기준', '밀면 얻는 것', '지금 피할 점'];
  }

  if (context.domain === 'career' || context.tone === 'direction') {
    return ['현재 위치', '막히는 이유', '다음 한 걸음'];
  }

  if (context.domain === 'money') {
    return ['지금 돈 흐름', '새는 지점', '지켜야 할 기준'];
  }

  return ['현재 흐름', '숨은 원인', '오늘의 조언'];
}

export async function getTarotDeck(): Promise<{ cards: TarotApiCard[]; source: TarotDeckSource }> {
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(TAROT_API_TIMEOUT_MS)
        : undefined;

    const response = await fetch(TAROT_API_CARDS_URL, {
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
      next: { revalidate: REVALIDATE_SECONDS },
    } as RequestInit & { next: { revalidate: number } });

    if (response.ok) {
      const payload = (await response.json()) as { cards?: unknown };
      const cards = normalizeCards(payload.cards);

      if (cards.length === 78) {
        return { cards, source: 'api' };
      }
    }
  } catch {
    // The local deck below keeps daily readings available when the public API is unavailable.
  }

  return { cards: FALLBACK_CARDS, source: 'local' };
}

export async function getTodayTarotPreview() {
  const deck = await getTarotDeck();
  const seed = `${getKoreaDateKey()}:daily-preview`;
  const card = pickCard(deck.cards, seed);
  const orientation = pickOrientation(`${seed}:${card.name_short}`);

  return buildTarotReading({
    card,
    orientation,
    question: '오늘 하루 어떤 메시지가 있을까',
    source: deck.source,
  });
}

export async function getTarotReadingForQuestion({
  question,
  cardId,
  orientation,
}: {
  question?: string;
  cardId?: string;
  orientation?: string;
}) {
  const deck = await getTarotDeck();
  const normalizedQuestion = normalizeQuestion(question);
  const seed = buildQuestionSeed(normalizedQuestion);
  const fallbackCard = pickCard(deck.cards, seed);
  const card = deck.cards.find((item) => item.name_short === cardId) ?? fallbackCard;
  const normalizedOrientation = normalizeOrientation(orientation);

  return buildTarotReading({
    card,
    orientation: normalizedOrientation ?? pickOrientation(`${seed}:${card.name_short}`),
    question: normalizedQuestion,
    source: deck.source,
  });
}

export async function getTarotPickerDeck(question?: string): Promise<TarotPickerDeck> {
  const deck = await getTarotDeck();
  const normalizedQuestion = normalizeQuestion(question);
  const seed = buildQuestionSeed(normalizedQuestion);
  const cards = shuffleCards(deck.cards, `${seed}:picker`);
  const tone = detectQuestionTone(normalizedQuestion);

  return {
    cards: cards.map((card, index) => ({
      slot: index + 1,
      card,
      orientation: pickOrientation(`${seed}:picker:${index}:${card.name_short}`),
    })),
    source: deck.source,
    tone,
    toneLabel: TONE_LABELS[tone],
  };
}

export async function getTarotSpreadForQuestion(question?: string): Promise<TarotSpreadCard[]> {
  const deck = await getTarotDeck();
  const normalizedQuestion = normalizeQuestion(question);
  const seed = buildQuestionSeed(normalizedQuestion);
  const usedCards = new Set<string>();
  const positions = buildSpreadPositions(analyzeQuestion(normalizedQuestion));

  return positions.map((position, index) => {
    const card = pickCard(deck.cards, `${seed}:spread:${index}`, usedCards);
    usedCards.add(card.name_short);

    return {
      position,
      reading: buildTarotReading({
        card,
        orientation: pickOrientation(`${seed}:spread:${index}:${card.name_short}`),
        question: normalizedQuestion,
        source: deck.source,
      }),
    };
  });
}

export function normalizeQuestion(question?: string) {
  return question?.trim() || '오늘 하루 어떤 메시지가 있을까';
}

function buildTarotReading({
  card,
  orientation,
  question,
  source,
}: {
  card: TarotApiCard;
  orientation: TarotOrientation;
  question: string;
  source: TarotDeckSource;
}): TarotReading {
  const context = analyzeQuestion(question);
  const tone = context.tone;
  const theme = getCardTheme(card);
  const meaning = orientation === 'upright' ? card.meaning_up : card.meaning_rev;
  const orientationAdvice =
    orientation === 'upright'
      ? '이 힘은 비교적 바깥으로 드러나 있으니 작은 행동으로 흐름을 살릴 수 있습니다.'
      : '다만 지금은 이 힘이 안쪽으로 접혀 있으니 서두르기보다 조절과 확인이 먼저입니다.';
  const psychology = buildPsychologyCopy(card, orientation, context);
  const directAnswer = buildDirectAnswer(card, orientation, context);
  const questionInsight = buildQuestionInsight(context);
  const action = buildCardAction(card, orientation, context, theme);

  return {
    card,
    displayName: getDisplayName(card),
    shortName: card.name_short.toUpperCase(),
    arcanaLabel: getArcanaLabel(card),
    cardMarker: getCardMarker(card),
    orientation,
    tone,
    toneLabel: TONE_LABELS[tone],
    theme: theme.theme,
    subtitle: theme.focus,
    keyword: getKeyword(card, theme),
    questionInsight,
    answer: directAnswer,
    psychologyLabel: psychology.label,
    psychology: psychology.summary,
    guidance: buildGuidanceCopy(card, orientation, tone, theme, orientationAdvice),
    sajuBlend: buildSajuBlendCopy(theme, context),
    action,
    source,
    meaningExcerpt: compactMeaning(meaning),
  };
}

function buildCardLead(
  card: TarotApiCard,
  orientation: TarotOrientation,
  theme: TarotCardTheme
) {
  const name = getPlainCardName(card);

  if (card.type === 'major') {
    return orientation === 'upright'
      ? `${name} 카드는 ${theme.focus}을 먼저 보라고 말합니다.`
      : `${name} 카드가 거꾸로 나와, ${theme.focus}이 바로 풀리기보다 잠시 막힌 모습입니다.`;
  }

  const suit = card.suit ? SUIT_THEMES[card.suit] : SUIT_THEMES.cups;
  const value = VALUE_THEMES[card.value] ?? {
    korean: card.value,
    focus: '지금 필요한 균형',
    action: '오늘 눈에 들어오는 작은 신호를 놓치지 말고 정리해보세요.',
  };

  return orientation === 'upright'
    ? `${name} 카드는 ${suit.theme}에서 ${value.focus}이 핵심이라고 말합니다.`
    : `${name} 카드가 거꾸로 나와, ${suit.focus}에서 ${value.focus}이 어긋나기 쉽습니다.`;
}

function buildCardAction(
  card: TarotApiCard,
  orientation: TarotOrientation,
  context: TarotQuestionContext,
  theme: TarotCardTheme
) {
  if (orientation === 'reversed') {
    return `오늘은 ${theme.focus}을 바로 결론내기보다, 한 번 멈춰 확인하고 말과 행동을 줄이는 편이 좋습니다.`;
  }

  if (card.type === 'major') {
    return theme.action;
  }

  const suitAction =
    card.suit === 'cups'
      ? '감정 표현은 짧고 부드럽게 하되, 답을 재촉하지 마세요.'
      : card.suit === 'pentacles'
        ? '돈, 일정, 약속처럼 손에 잡히는 것부터 먼저 정리하세요.'
        : card.suit === 'swords'
          ? '생각이 많아질수록 사실과 추측을 나누어 적어보세요.'
          : card.suit === 'wands'
            ? '하고 싶은 일은 크게 벌리지 말고 10분짜리 행동으로 시작하세요.'
            : theme.action;

  if (context.intent === 'contact') {
    return card.suit === 'cups'
      ? '연락은 짧고 다정하게 보내세요. 답을 바로 확인하려는 말은 빼는 편이 좋습니다.'
      : suitAction;
  }

  if (context.domain === 'money' && card.suit !== 'pentacles') {
    return `${suitAction} 돈 문제는 새로 쓰기보다 지금 새는 곳을 먼저 확인하세요.`;
  }

  return suitAction;
}

function buildGuidanceCopy(
  card: TarotApiCard,
  orientation: TarotOrientation,
  tone: TarotQuestionTone,
  theme: TarotCardTheme,
  orientationAdvice: string
) {
  const name = getPlainCardName(card);
  return `${name}의 핵심은 ${theme.theme}입니다. ${TONE_FOCUS[tone](theme.theme, theme.focus)} ${orientationAdvice}`;
}

function buildSajuBlendCopy(
  theme: TarotCardTheme,
  context: TarotQuestionContext
) {
  const domainLine =
    context.domain === 'relationship'
      ? '타로는 지금 관계에서 마음이 어디에 걸려 있는지를 먼저 보여줍니다. 사주로 이어 보면 내가 관계에서 기대하고 물러서는 방식, 반복되는 거리감까지 더 길게 읽을 수 있습니다.'
      : context.domain === 'career'
        ? '타로는 오늘 일과 방향 앞에서 느끼는 망설임을 보여줍니다. 사주로 이어 보면 내가 일을 진행하는 방식, 버티는 힘, 바꾸기 좋은 시기를 함께 볼 수 있습니다.'
        : context.domain === 'money'
          ? '타로는 지금 돈과 선택 앞에서 생기는 긴장감을 보여줍니다. 사주로 이어 보면 재물을 모으고 쓰는 방식, 무리하기 쉬운 흐름, 지켜야 할 기준을 더 구체적으로 볼 수 있습니다.'
          : '타로는 오늘 마음에 남은 장면을 보여줍니다. 사주로 이어 보면 그 장면이 내 성향과 운의 리듬에서 왜 익숙하게 반복되는지 확인할 수 있습니다.';

  const moodLine =
    context.mood === 'anxious'
      ? '불안이 앞선 질문일수록 결과를 단정하기보다, 같은 불안이 반복되는 구조를 함께 보는 편이 좋습니다.'
      : context.mood === 'hopeful'
        ? '기대가 섞인 질문일수록 가능성만 보지 말고, 실제로 움직여도 되는 시기와 수위를 함께 봐야 합니다.'
        : context.mood === 'tired'
          ? '지친 상태에서 뽑은 카드라면 더 버티라는 말보다, 무엇을 줄여야 편해지는지를 먼저 살피는 쪽이 맞습니다.'
          : context.mood === 'urgent'
            ? '급한 마음이 올라온 질문일수록 바로 결론내기보다, 오늘 할 행동과 미룰 행동을 나누는 것이 안전합니다.'
            : '차분히 묻는 질문이라도 카드가 남긴 감정이 있다면, 사주에서는 그 감정이 오래 반복되는 이유를 더 넓게 봅니다.';

  return `${domainLine} ${moodLine} 이 카드의 핵심은 ${theme.theme}이며, 사주 상담에서는 ${theme.sajuElement} 관점으로 이어서 풀어볼 수 있습니다.`;
}

function getCardTheme(card: TarotApiCard) {
  if (card.type === 'major') {
    return (
      MAJOR_THEMES[card.name] ?? {
        theme: '큰 흐름과 전환',
        focus: '지금 삶의 큰 장면',
        action: '오늘 마음에 가장 크게 남는 신호를 하나만 붙들어보세요.',
        sajuElement: '큰 운의 방향을 읽는 감각',
      }
    );
  }

  const suitTheme = card.suit ? SUIT_THEMES[card.suit] : SUIT_THEMES.cups;
  const valueTheme = VALUE_THEMES[card.value] ?? {
    korean: card.value,
    focus: '지금 필요한 균형',
    action: '오늘 눈에 들어오는 작은 신호를 놓치지 말고 정리해보세요.',
  };

  return {
    theme: `${valueTheme.focus}, 그리고 ${suitTheme.theme}`,
    focus: `${suitTheme.focus} 안에서 ${valueTheme.focus}`,
    action: valueTheme.action,
    sajuElement: suitTheme.sajuElement,
  };
}

function getPlainCardName(card: TarotApiCard) {
  if (card.type === 'major') {
    return MAJOR_CARD_NAMES[card.name] ?? card.name;
  }

  const suit = card.suit ? SUIT_THEMES[card.suit] : SUIT_THEMES.cups;
  const value = VALUE_THEMES[card.value]?.korean ?? card.value;

  return `${value} ${suit.korean}`;
}

function getDisplayName(card: TarotApiCard) {
  if (card.type === 'major') {
    const korean = MAJOR_CARD_NAMES[card.name];
    return korean ? `${korean} · ${card.name}` : card.name;
  }

  const suit = card.suit ? SUIT_THEMES[card.suit] : SUIT_THEMES.cups;
  const value = VALUE_THEMES[card.value]?.korean ?? card.value;

  return `${value} ${suit.korean} · ${card.name}`;
}

function getKeyword(card: TarotApiCard, theme: { theme: string; focus: string }) {
  const base = card.type === 'major' ? theme.theme : theme.focus;
  return `${base}을 오늘의 언어로 부드럽게 읽어보세요.`;
}

function getCardMarker(card: TarotApiCard) {
  if (card.type === 'major') {
    return '✦';
  }

  return card.suit ? SUIT_THEMES[card.suit].marker : '🌙';
}

function getArcanaLabel(card: TarotApiCard) {
  if (card.type === 'major') {
    return 'Major Arcana';
  }

  return `${card.suit ? SUIT_THEMES[card.suit].korean : 'Minor'} Arcana`;
}

function detectQuestionTone(question: string): TarotQuestionTone {
  if (/(관계|연애|사랑|상대|마음|재회|인연)/.test(question)) {
    return 'relationship';
  }

  if (/(선택|결정|해야|말아|괜찮|갈까|할까)/.test(question)) {
    return 'choice';
  }

  if (/(앞으로|방향|미래|진로|흐름|계획|직장|회사|이직|돈|금전|재물|투자|사업)/.test(question)) {
    return 'direction';
  }

  return 'daily';
}

function pickCard(cards: TarotApiCard[], seed: string, excluded = new Set<string>()) {
  const availableCards = cards.filter((card) => !excluded.has(card.name_short));
  const pool = availableCards.length > 0 ? availableCards : cards;
  return pool[stableHash(seed) % pool.length];
}

function pickOrientation(seed: string): TarotOrientation {
  return stableHash(seed) % 100 < 22 ? 'reversed' : 'upright';
}

function shuffleCards(cards: TarotApiCard[], seed: string) {
  return cards
    .map((card) => ({
      card,
      order: stableHash(`${seed}:${card.name_short}`),
    }))
    .sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.card.name_short.localeCompare(right.card.name_short);
    })
    .map(({ card }) => card);
}

function normalizeOrientation(value?: string): TarotOrientation | null {
  return value === 'upright' || value === 'reversed' ? value : null;
}

function buildQuestionSeed(question: string) {
  return `${getKoreaDateKey()}:${question}`;
}

function getKoreaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function compactMeaning(meaning: string) {
  const normalized = meaning.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trim()}...`;
}

function normalizeCards(value: unknown): TarotApiCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((card) => {
    const normalized = normalizeCard(card);
    return normalized ? [normalized] : [];
  });
}

function normalizeCard(value: unknown): TarotApiCard | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type === 'major' || value.type === 'minor' ? value.type : null;
  const nameShort = typeof value.name_short === 'string' ? value.name_short : null;
  const name = typeof value.name === 'string' ? value.name : null;
  const meaningUp = typeof value.meaning_up === 'string' ? value.meaning_up : null;
  const meaningRev = typeof value.meaning_rev === 'string' ? value.meaning_rev : null;
  const desc = typeof value.desc === 'string' ? value.desc : '';

  if (!type || !nameShort || !name || !meaningUp || !meaningRev) {
    return null;
  }

  const valueText = typeof value.value === 'string' ? value.value : String(value.value ?? '');
  const valueInt =
    typeof value.value_int === 'number' ? value.value_int : Number.parseInt(valueText, 10) || 0;
  const suit = typeof value.suit === 'string' && isTarotSuit(value.suit) ? value.suit : undefined;

  return {
    type,
    name_short: nameShort,
    name,
    value: valueText,
    value_int: valueInt,
    meaning_up: meaningUp,
    meaning_rev: meaningRev,
    desc,
    ...(suit ? { suit } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTarotSuit(value: string): value is TarotSuit {
  return (SUITS as readonly string[]).includes(value);
}
