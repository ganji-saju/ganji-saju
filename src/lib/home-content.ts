import type { FocusTopic } from './saju/report';

export const HOUR_OPTIONS = [
  { label: '모름', value: '' },
  { label: '00시 (자시)', value: '0' },
  { label: '01시 (축시)', value: '1' },
  { label: '02시 (축시)', value: '2' },
  { label: '03시 (인시)', value: '3' },
  { label: '04시 (인시)', value: '4' },
  { label: '05시 (묘시)', value: '5' },
  { label: '06시 (묘시)', value: '6' },
  { label: '07시 (진시)', value: '7' },
  { label: '08시 (진시)', value: '8' },
  { label: '09시 (사시)', value: '9' },
  { label: '10시 (사시)', value: '10' },
  { label: '11시 (오시)', value: '11' },
  { label: '12시 (오시)', value: '12' },
  { label: '13시 (미시)', value: '13' },
  { label: '14시 (미시)', value: '14' },
  { label: '15시 (신시)', value: '15' },
  { label: '16시 (신시)', value: '16' },
  { label: '17시 (유시)', value: '17' },
  { label: '18시 (유시)', value: '18' },
  { label: '19시 (술시)', value: '19' },
  { label: '20시 (술시)', value: '20' },
  { label: '21시 (해시)', value: '21' },
  { label: '22시 (해시)', value: '22' },
  { label: '23시 (자시)', value: '23' },
] as const;

export const QUESTION_CHIPS: Array<{ key: FocusTopic; label: string; hook: string }> = [
  { key: 'today', label: '오늘', hook: '지금 바로 흐름 보기' },
  { key: 'love', label: '연애', hook: '속마음과 연락 타이밍' },
  { key: 'wealth', label: '재물', hook: '소비와 기회 포착' },
  { key: 'career', label: '직장', hook: '이직·협업·성과' },
  { key: 'relationship', label: '관계', hook: '가까운 사람과의 거리감' },
];

export const TRUST_POINTS = [
  '태어난 시간 몰라도 시작 가능',
  '결과 자동 저장',
  '심화 리포트는 1코인부터',
];

export const FREE_EXPERIENCES = [
  {
    title: '오늘의 무료 타로',
    body: '질문 없이 한 장만 뽑아도 오늘의 기분과 흐름을 바로 읽을 수 있습니다.',
    status: '지금 보기',
    href: '/tarot/daily',
  },
  {
    title: '띠별 운세',
    body: '검색 유입용 가벼운 운세 메뉴. 로그인 없이 빠르게 훑어보는 입구입니다.',
    status: '지금 보기',
    href: '/zodiac',
  },
  {
    title: '별자리 운세',
    body: '생년월일 입력 전에 앱처럼 가볍게 소비하는 루틴형 콘텐츠로 확장합니다.',
    status: '지금 보기',
    href: '/star-sign',
  },
  {
    title: '꿈해몽',
    body: 'SEO 유입과 바이럴에 강한 메뉴. 짧은 설명과 연관 키워드 구조가 핵심입니다.',
    status: '지금 보기',
    href: '/dream-interpretation',
  },
] as const;

export const TAROT_CARDS = [
  {
    name: 'The Fool',
    theme: '시작',
    message: '새로운 흐름은 늘 작은 한 걸음에서 시작됩니다. 오늘은 너무 겁내지 말고 가볍게 문을 열어보세요.',
    focus: '생각만 하던 일을 작게라도 시작해보세요.',
  },
  {
    name: 'The Moon',
    theme: '직관',
    message: '겉으로 보이는 장면보다 숨은 마음과 분위기를 읽을수록 더 좋은 선택이 보이는 날입니다.',
    focus: '서두르지 말고 한 박자 쉬어 속뜻을 살피세요.',
  },
  {
    name: 'The Sun',
    theme: '표현',
    message: '숨기고 있던 매력을 드러낼수록 관계와 일 모두 활기를 얻는 날입니다.',
    focus: '먼저 말 걸고 먼저 제안하는 쪽이 유리합니다.',
  },
  {
    name: 'The Hermit',
    theme: '성찰',
    message: '사람들 사이의 소음보다 혼자 정리한 생각에서 더 정확한 답이 떠오르는 날입니다.',
    focus: '고요한 시간을 조금 확보해보세요.',
  },
  {
    name: 'The Lovers',
    theme: '선택',
    message: '누구와 무엇을 가까이 둘지 선명하게 정해야 마음도 가벼워집니다.',
    focus: '좋아하는 방향을 분명히 말할수록 관계가 편해집니다.',
  },
  {
    name: 'Death',
    theme: '변화',
    message: '정리해야 할 것을 정리하면 다음 흐름이 열립니다. 끝처럼 보여도 새 시작에 가깝습니다.',
    focus: '묵은 방식을 내려놓고 새 리듬을 받아들여보세요.',
  },
] as const;

export const TAROT_TOPICS = [
  { title: '속마음 타로', desc: '상대의 현재 감정선과 거리감을 짧게 읽는 테마형 리딩', status: '곧 오픈' },
  { title: '재회 타로', desc: '관계가 다시 움직일 여지가 있는지 시기와 감정 온도로 확인', status: '곧 오픈' },
  { title: '이직 타로', desc: '지금 떠나는 편이 맞는지, 조금 더 준비해야 하는지 판단 보조', status: '곧 오픈' },
] as const;

export const MEMBERSHIP_POINTS = [
  '광고 없이 보는 데일리 리포트',
  '월간 심화 리포트 2회',
  '결과 보관함과 운세 캘린더',
];

export function getCardOfTheDay() {
  const dayIndex = new Date().getDate() % TAROT_CARDS.length;
  return TAROT_CARDS[dayIndex];
}

function hashQuestion(question: string) {
  let value = 0;

  for (const char of question) {
    value = (value * 31 + char.charCodeAt(0)) % TAROT_CARDS.length;
  }

  return value;
}

export function getTarotCardForQuestion(question?: string) {
  const normalized = question?.trim();

  if (!normalized) {
    return getCardOfTheDay();
  }

  const todayKey = new Intl.DateTimeFormat('sv-SE').format(new Date());
  const index = hashQuestion(`${todayKey}:${normalized}`);
  return TAROT_CARDS[index];
}
