import type { ReportEvidenceCard, SajuReport } from './types';

export interface PunchReading {
  verdict: string;
  why: string;
  caution: string;
  action: string;
  evidence: string[];
  tone?: 'sharp' | 'warm' | 'premium';
}

function cleanSentence(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[·ㆍ\-–—]\s*/u, '')
    .trim();
}

function compact(value: string, maxLength: number) {
  const cleaned = cleanSentence(value);
  if (cleaned.length <= maxLength) return cleaned;

  const sliced = cleaned.slice(0, maxLength).replace(/[,.，。、\s]+$/u, '');
  return `${sliced}...`;
}

function firstNonEmpty(items: Array<string | null | undefined>, fallback: string) {
  return cleanSentence(items.find((item) => cleanSentence(item).length > 0)) || fallback;
}

function evidenceLabel(card: ReportEvidenceCard) {
  if (card.key === 'strength' && card.computed.strength) {
    return `균형 ${card.computed.strength}`;
  }

  if (card.key === 'pattern' && card.computed.pattern) {
    return `반복 패턴 ${card.computed.pattern}`;
  }

  if (card.key === 'yongsin' && card.computed.yongsin?.length) {
    return `보완 포인트 ${card.computed.yongsin.slice(0, 2).join(' · ')}`;
  }

  if (card.key === 'relations' && card.computed.relations?.length) {
    return `관계 단서 ${card.computed.relations.slice(0, 2).join(' · ')}`;
  }

  return card.label;
}

export function buildPunchReading(report: SajuReport): PunchReading {
  const focusEvidence = report.evidenceCards.filter((card) =>
    card.topicMapping.includes(report.focusTopic)
  );
  const evidenceCards = focusEvidence.length > 0 ? focusEvidence : report.evidenceCards;
  const primaryEvidence = evidenceCards[0];
  const secondaryEvidence = evidenceCards[1];

  const verdict = firstNonEmpty(
    [
      report.headline,
      report.primaryAction.title,
      report.scores.find((score) => score.key === report.focusScoreKey)?.summary,
    ],
    '오늘은 먼저 확인할 때입니다.'
  );

  const why = firstNonEmpty(
    [
      primaryEvidence?.plainSummary,
      primaryEvidence?.body,
      report.dayMasterSummary,
      report.summary,
    ],
    '지금은 판단보다 기준 정리가 먼저 보입니다.'
  );

  const caution = firstNonEmpty(
    [
      report.cautionAction.title,
      report.cautionAction.description,
      secondaryEvidence?.plainSummary,
      secondaryEvidence?.body,
    ],
    '서두르면 같은 문제가 반복될 수 있습니다.'
  );

  const action = firstNonEmpty(
    [
      report.primaryAction.title,
      report.primaryAction.description,
      ...(primaryEvidence?.practicalActions ?? []),
    ],
    '중요한 선택은 한 번 적고 다시 확인하세요.'
  );

  const evidence = [...new Set(evidenceCards.map(evidenceLabel).filter(Boolean))].slice(0, 3);

  return {
    verdict: compact(verdict, 32),
    why: compact(why, 64),
    caution: compact(caution, 48),
    action: compact(action, 48),
    evidence,
    tone: report.focusTopic === 'today' ? 'warm' : 'sharp',
  };
}
