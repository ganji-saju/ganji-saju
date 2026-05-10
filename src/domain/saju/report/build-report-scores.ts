import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { BirthInput } from '@/lib/saju/types';
import type { FocusTopic, ReportEvidenceCard, ReportScore } from './types';
import {
  compactStrings,
  describeCurrentLuckHighlight,
  getElementEntries,
  getOrreryExtension,
  getReportProfile,
  getSupportElementLabels,
  stripTopicLead,
} from './build-report-copy';

export const SCORE_LABELS: Record<ReportScore['key'], string> = {
  overall: '총운',
  love: '연애',
  wealth: '재물',
  career: '직장',
  relationship: '관계',
};

export const TOPIC_SCORE_KEYS: Record<FocusTopic, ReportScore['key']> = {
  today: 'overall',
  love: 'love',
  wealth: 'wealth',
  career: 'career',
  relationship: 'relationship',
};

export function clampScore(value: number) {
  return Math.max(48, Math.min(92, Math.round(value)));
}

export function buildScoreSummary(key: ReportScore['key'], score: number, data: SajuDataV1) {
  const profile = getReportProfile(data);
  const isHigh = score >= 80;
  const isMid = score >= 70;
  const roleLabel = profile.role?.label ?? `${profile.day.label} 쪽이 먼저 반응하는 편`;

  switch (key) {
    case 'love':
      if (isHigh) return `연애는 ${stripTopicLead(profile.support.love)} ${roleLabel}이라 먼저 부드럽게 열면 반응이 좋습니다.`;
      if (isMid) return `연애는 마음 확인보다 ${profile.weakest.label}을 채우는 말투가 더 중요합니다.`;
      return `연애는 서두르지 말고 ${stripTopicLead(profile.support.love)}.`;
    case 'wealth':
      if (isHigh) return `재물은 ${stripTopicLead(profile.support.wealth)} 손에 남는 돈을 만들기 좋습니다.`;
      if (isMid) return `재물은 ${profile.dominant.label}보다 ${profile.support.label}을 챙길 때 흐름이 안정됩니다.`;
      return `재물은 새 결제보다 고정비, 정산, 금액 확인을 먼저 보세요.`;
    case 'career':
      if (isHigh) return `직장은 ${stripTopicLead(profile.support.career)} 성과가 밖으로 보이기 쉽습니다.`;
      if (isMid) return `직장은 ${profile.role?.strength ?? profile.support.gift}을 일의 순서로 옮기면 안정됩니다.`;
      return `직장은 넓히기보다 맡은 업무와 보고 순서를 먼저 정리하세요.`;
    case 'relationship':
      if (isHigh) return `관계는 ${stripTopicLead(profile.support.relationship)} 먼저 말을 열기 좋습니다.`;
      if (isMid) return `관계는 말의 순서와 확인을 맞추면 오해가 줄어듭니다.`;
      return `관계는 바로 결론내기보다 거리와 표현을 천천히 맞추세요.`;
    case 'overall':
    default:
      if (isHigh) return `${profile.dominant.gift}이 살아 있어 ${profile.support.action}`;
      if (isMid) return `${roleLabel}이라 ${profile.support.action}`;
      return `${profile.weakest.label}이 비기 쉬워 오늘은 ${profile.support.action}`;
  }
}

export function buildSummaryHighlights(
  data: SajuDataV1,
  topic: FocusTopic,
  _scoreMap: Record<ReportScore['key'], number>,
  dominant: string,
  weakest: string,
  _evidenceCards: ReportEvidenceCard[]
) {
  const profile = getReportProfile(data);
  const supportLabels = getSupportElementLabels(data) || profile.support.label || dominant;
  const currentLuck = describeCurrentLuckHighlight(data.currentLuck);
  const roleLine = profile.role
    ? `${profile.role.label}이라 ${profile.role.strength}이 오늘 선택에 먼저 드러납니다.`
    : `${profile.day.label} 쪽으로 먼저 반응하는 편이라, 하루의 첫 선택이 중요합니다.`;
  const balanceLine = `${profile.dominant.label}은 충분히 살아 있고 ${profile.weakest.label}은 비기 쉬워, ${supportLabels}을 챙길수록 하루가 덜 흔들립니다.`;
  const cautionLine = `${weakest || profile.weakest.label} 쪽이 약해질 때는 ${profile.weakest.avoid}`;

  switch (topic) {
    case 'love':
      return compactStrings([
        roleLine,
        `연애는 상대가 답하기 쉬운 표현부터 시작하면 마음의 온도가 더 부드럽게 맞춰집니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'wealth':
      return compactStrings([
        balanceLine,
        `재물은 고정비, 정산, 금액 확인처럼 손에 남는 흐름을 먼저 보면 안정됩니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'career':
      return compactStrings([
        roleLine,
        `직장은 업무 순서, 보고 방식, 성과가 보이는 장면을 먼저 정리하면 흐름이 살아납니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'relationship':
      return compactStrings([
        balanceLine,
        `관계는 말의 순서와 확인이 핵심입니다. 가까운 사람일수록 결론보다 안부와 일정 확인이 먼저입니다.`,
        currentLuck || cautionLine,
      ]).slice(0, 3);
    case 'today':
    default:
      return compactStrings([
        roleLine,
        balanceLine,
        currentLuck || cautionLine,
      ]).slice(0, 3);
  }
}

export function buildScores(input: BirthInput, data: SajuDataV1): ReportScore[] {
  const entries = getElementEntries(data);
  const strongest = entries[0]?.[1] ?? 0;
  const weakest = entries.at(-1)?.[1] ?? 0;
  const spread = strongest - weakest;
  const uniqueCount = entries.filter(([, count]) => count > 0).length;
  const hourBonus = data.pillars.hour ? 4 : 0;
  const datePulse = ((input.day + input.month) % 7) - 3;
  const yearPulse = (input.year % 6) - 2;
  const balanceBase = 66 + uniqueCount * 3 - spread * 4 + hourBonus;

  const overall = clampScore(balanceBase + datePulse);
  const love = clampScore(balanceBase + datePulse + (uniqueCount >= 4 ? 4 : 1) + (input.day % 5) - 2);
  const wealth = clampScore(balanceBase + yearPulse + strongest * 2 - weakest);
  const career = clampScore(balanceBase + hourBonus + (input.month % 5) - 1 + (strongest >= 2 ? 3 : 0));
  const relations = getOrreryExtension(data)?.relations ?? [];
  const supportRelations = relations.filter((relation) =>
    ['천간합', '육합', '반합', '삼합', '방합'].includes(relation.label)
  ).length;
  const tensionRelations = relations.filter((relation) =>
    ['충', '형', '해', '파', '천간충'].includes(relation.label)
  ).length;
  const relationship = clampScore(
    balanceBase +
      (uniqueCount >= 4 ? 3 : 0) +
      Math.min(supportRelations, 2) * 3 -
      Math.min(tensionRelations, 2) * 2 +
      ((input.year + input.day) % 5) -
      2
  );

  const summaries: Record<ReportScore['key'], string> = {
    overall: buildScoreSummary('overall', overall, data),
    love: buildScoreSummary('love', love, data),
    wealth: buildScoreSummary('wealth', wealth, data),
    career: buildScoreSummary('career', career, data),
    relationship: buildScoreSummary('relationship', relationship, data),
  };

  return [
    { key: 'overall', label: SCORE_LABELS.overall, score: overall, summary: summaries.overall },
    { key: 'love', label: SCORE_LABELS.love, score: love, summary: summaries.love },
    { key: 'wealth', label: SCORE_LABELS.wealth, score: wealth, summary: summaries.wealth },
    { key: 'career', label: SCORE_LABELS.career, score: career, summary: summaries.career },
    { key: 'relationship', label: SCORE_LABELS.relationship, score: relationship, summary: summaries.relationship },
  ];
}
