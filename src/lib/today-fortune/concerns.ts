import type { ReportScore } from '@/domain/saju/report';
import type { ConcernId, TodayConcernDefinition, TodayFortuneFreeResult } from './types';

export const TODAY_CONCERNS: readonly TodayConcernDefinition[] = [
  {
    id: 'love_contact',
    label: '오늘 연락해도 될까?',
    hanja: '💗',
    shortLabel: '연락',
    prompt: '연락과 재회 흐름',
    focusTopic: 'love',
    staticUpsellCopy: '오늘 먼저 연락하면 흐름이 어떻게 갈지 확인',
    followUpQuestions: [
      '왜 오늘은 연락을 조심해야 하나요?',
      '지금 먼저 연락하면 어떤 톤이 좋을까요?',
      '재회 이야기를 꺼내도 되는 흐름인가요?',
    ],
  },
  {
    id: 'money_spend',
    label: '돈이 새는 날일까?',
    hanja: '💰',
    shortLabel: '지출',
    prompt: '지출과 결제 흐름',
    focusTopic: 'wealth',
    staticUpsellCopy: '돈이 새는 시간대와 피해야 할 결제 확인',
    followUpQuestions: [
      '오늘 돈이 새는 행동은 무엇인가요?',
      '결제를 미루는 편이 좋은 시간대가 있나요?',
      '지출보다 정산을 먼저 해야 하는 이유가 뭔가요?',
    ],
  },
  {
    id: 'work_meeting',
    label: '미팅·계약 괜찮을까?',
    hanja: '💼',
    shortLabel: '미팅',
    prompt: '협상과 계약 흐름',
    focusTopic: 'career',
    staticUpsellCopy: '오늘 협상·계약에 유리한 시간 확인',
    followUpQuestions: [
      '오후 미팅에서 어떤 말을 피해야 하나요?',
      '오늘 계약은 바로 진행해도 괜찮을까요?',
      '미팅에서 먼저 꺼내면 좋은 포인트는 무엇인가요?',
    ],
  },
  {
    id: 'relationship_conflict',
    label: '말실수 조심해야 할까?',
    hanja: '💬',
    shortLabel: '구설',
    prompt: '관계와 말의 흐름',
    focusTopic: 'relationship',
    staticUpsellCopy: '말실수 피하는 대화 문장 확인',
    followUpQuestions: [
      '오늘은 왜 말실수를 조심해야 하나요?',
      '가까운 사람과 대화할 때 어떤 표현을 줄여야 하나요?',
      '오해를 줄이는 한마디는 어떤 식이 좋을까요?',
    ],
  },
  {
    id: 'energy_health',
    label: '무리해도 되는 날일까?',
    hanja: '🌿',
    shortLabel: '컨디션',
    prompt: '컨디션과 생활 리듬',
    focusTopic: 'today',
    staticUpsellCopy: '무리해도 되는 시간과 쉬어야 할 구간 확인',
    followUpQuestions: [
      '오늘은 어느 시간대에 쉬는 편이 좋나요?',
      '무리하면 바로 티 나는 부분이 어디인가요?',
      '컨디션을 살리는 생활 루틴은 무엇인가요?',
    ],
  },
  {
    id: 'general',
    label: '가볍게 오늘 흐름',
    hanja: '✨',
    shortLabel: '총운',
    prompt: '오늘 전체 흐름',
    focusTopic: 'today',
    staticUpsellCopy: '오늘 심화풀이 1코인으로 열기',
    followUpQuestions: [
      '오늘은 무엇부터 하는 편이 좋나요?',
      '지금 가장 약한 흐름은 어디인가요?',
      '오늘 하루를 무리 없이 쓰는 기준을 알려주세요.',
    ],
  },
] as const;

export const TODAY_CONCERN_MAP = Object.fromEntries(
  TODAY_CONCERNS.map((concern) => [concern.id, concern])
) as Record<ConcernId, TodayConcernDefinition>;

export function getTodayConcern(concernId: ConcernId) {
  return TODAY_CONCERN_MAP[concernId];
}

export function getTodayConcernEntries(expanded: boolean) {
  // 2026-05-14: 더 보기 / 접기 토글 시 기존 4개 카드가 자리를 바꾸지 않도록
  // primary 순서를 유지하고 expanded 모드에서는 뒤에 추가 항목만 append.
  // (이전 구현은 expanded=true 시 TODAY_CONCERNS 원본 배열을 반환했는데
  //  원본 순서가 primary 와 달라서 general 이 1번→6번으로 이동하는 등
  //  모든 카드 위치가 바뀌는 문제가 있었다.)
  const primaryIds: ConcernId[] = ['general', 'love_contact', 'money_spend', 'work_meeting'];
  const primary = primaryIds.map((id) => TODAY_CONCERN_MAP[id]);
  if (!expanded) return primary;

  const primarySet = new Set<ConcernId>(primaryIds);
  const additional = TODAY_CONCERNS.filter((concern) => !primarySet.has(concern.id));
  return [...primary, ...additional];
}

export function normalizeConcernId(value: unknown): ConcernId {
  return typeof value === 'string' && value in TODAY_CONCERN_MAP
    ? (value as ConcernId)
    : 'general';
}

const UPSell_SCORE_TO_CONCERN: Array<{
  key: ReportScore['key'] | 'condition';
  concernId: Exclude<ConcernId, 'general'>;
}> = [
  { key: 'love', concernId: 'love_contact' },
  { key: 'wealth', concernId: 'money_spend' },
  { key: 'career', concernId: 'work_meeting' },
  { key: 'relationship', concernId: 'relationship_conflict' },
  { key: 'condition', concernId: 'energy_health' },
];

export function pickLowestConcernFromScores(
  scores: TodayFortuneFreeResult['scores']
): Exclude<ConcernId, 'general'> {
  const ranked = scores
    .filter((score) => score.key !== 'overall')
    .sort((a, b) => a.score - b.score);
  const lowest = ranked[0];

  return (
    UPSell_SCORE_TO_CONCERN.find((item) => item.key === lowest?.key)?.concernId ??
    'money_spend'
  );
}
