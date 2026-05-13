import type { FocusTopic } from '@/lib/saju/report';

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
  { key: 'today', label: '오늘', hook: '지금 체감되는 흐름 먼저 보기' },
  { key: 'love', label: '연애', hook: '연락 타이밍과 감정 온도' },
  { key: 'wealth', label: '재물', hook: '지출, 기회, 수입 흐름' },
  { key: 'career', label: '직장', hook: '성과, 협업, 이직 판단' },
  { key: 'relationship', label: '관계', hook: '가까운 사람과의 거리감' },
];

export const TRUST_POINTS = [
  '태어난 시간 몰라도 시작 가능',
  '결과 자동 저장',
  '심화 리포트는 코인으로 확장',
];

export const HERO_REPORT_PREVIEW: Record<
  FocusTopic,
  { score: number; summary: string; signal: string; action: string }
> = {
  today: {
    score: 82,
    summary: '오늘은 한 번에 많은 결정을 하기보다, 먼저 해야 할 한 가지를 선명하게 잡는 편이 유리합니다.',
    signal: '총운이 부드럽게 올라오는 날',
    action: '늦은 오후 전에 중요한 연락을 먼저 여세요.',
  },
  love: {
    score: 78,
    summary: '감정 표현을 아끼기보다 타이밍을 맞춰 꺼낼수록 관계가 자연스럽게 움직입니다.',
    signal: '연애운이 회복 국면으로 들어갑니다',
    action: '먼저 답장을 미루지 않는 쪽이 흐름을 가져갑니다.',
  },
  wealth: {
    score: 74,
    summary: '큰 한 방보다 새는 지출을 정리하는 쪽이 체감 이익으로 이어질 가능성이 높습니다.',
    signal: '재물운은 정리형 접근이 유리합니다',
    action: '오늘은 소비 전 체크리스트를 꼭 한 번 더 보세요.',
  },
  career: {
    score: 80,
    summary: '직장운은 꾸준히 올라오고 있고, 협업에서 역할을 먼저 정리할수록 피로가 줄어듭니다.',
    signal: '직장운은 안정적 상승 흐름입니다',
    action: '애매한 업무 경계는 오전에 먼저 정리해 두세요.',
  },
  relationship: {
    score: 76,
    summary: '관계운은 말의 톤을 조금만 부드럽게 조정해도 체감 차이가 크게 나는 날입니다.',
    signal: '관계는 속도보다 온도 조절이 중요합니다',
    action: '감정이 올라오면 결론보다 질문을 먼저 던지세요.',
  },
};

export const SERVICE_ENTRY_CARDS = [
  {
    eyebrow: 'Core Report',
    title: '정통 사주 리포트',
    body: '생년월일만으로 먼저 총운, 연애, 재물, 직장을 요약 카드 형태로 받아보는 핵심 시작선입니다.',
    cta: '사주 시작',
    href: '/saju/new',
  },
  {
    eyebrow: 'Compatibility Lite',
    title: '궁합은 가볍게 먼저',
    body: '상대와의 템포, 감정 거리, 주의 포인트를 Lite 구조로 먼저 보고 필요할 때 상세로 이어갑니다.',
    cta: '궁합 구조 보기',
    href: '/#compatibility-lab',
  },
  {
    eyebrow: 'Retention',
    title: '저장과 다시보기',
    body: '결과 보관함, 코인, 멤버십을 묶어 단발성 조회가 아니라 반복 효용이 생기는 서비스로 바꿉니다.',
    cta: 'MY 보기',
    href: '/my',
  },
] as const;

export const FREE_EXPERIENCES = [
  {
    title: '오늘의 운세',
    body: '검색에서 가장 먼저 닿는 무료 입구입니다. 짧고 빠른 오늘 운세로 첫 경험을 만듭니다.',
    status: 'SEO 입구',
    href: '/today-fortune',
  },
  {
    title: '오늘의 무료 타로',
    body: '질문 없이 한 장만 뽑아도 오늘의 기분과 흐름을 바로 읽을 수 있는 무입력 콘텐츠입니다.',
    status: '무입력',
    href: '/tarot/daily',
  },
  {
    title: '띠별 · 별자리',
    body: '로그인 없이 가볍게 훑어보는 루틴형 콘텐츠로, 홈의 본 서비스보다 한 단계 뒤에 두는 유입선입니다.',
    status: '가벼운 보기',
    href: '/zodiac',
  },
  {
    title: '꿈해몽',
    body: 'SEO와 바이럴에 강한 메뉴입니다. 짧은 답과 연관 키워드 구조가 핵심입니다.',
    status: '검색 유입',
    href: '/dream-interpretation',
  },
] as const;

export const TAROT_TOPICS = [
  {
    title: '속마음 타로',
    desc: '상대의 현재 감정선과 거리감을 짧게 읽는 테마형 리딩',
    status: '곧 오픈',
  },
  {
    title: '재회 타로',
    desc: '관계가 다시 움직일 여지가 있는지 시기와 감정 온도로 확인',
    status: '곧 오픈',
  },
  {
    title: '이직 타로',
    desc: '지금 떠나는 편이 맞는지, 조금 더 준비해야 하는지 판단을 돕는 타로 확장선',
    status: '곧 오픈',
  },
] as const;

export const MEMBERSHIP_POINTS = [
  '광고 없이 보는 데일리 리포트',
  '월간 심화 리포트 2회',
  '결과 보관함과 운세 캘린더',
];

export const MOBILE_HOME_DOCK_ITEMS = [
  { label: '사주 시작', href: '/saju/new', tone: 'service' },
  { label: '궁합', href: '/#compatibility-lab', tone: 'service' },
  { label: '코인', href: '/credits', tone: 'service' },
  { label: '무료운세', href: '/today-fortune', tone: 'acquisition' },
] as const;
