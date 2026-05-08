import type { ReportEvidenceCard, SajuReport } from './types';
import type { Element } from '@/lib/saju/types';

export interface PunchReading {
  verdict: string;
  why: string;
  caution: string;
  action: string;
  evidence: string[];
  personalPoints: string[];
  tone?: 'sharp' | 'warm' | 'premium';
}

type ElementRatio = Partial<Record<Element, number>>;

const ELEMENT_LABELS: Record<Element, string> = {
  목: '성장',
  화: '표현',
  토: '안정',
  금: '정리',
  수: '생각',
};

const ELEMENT_ACTIONS: Record<Element, { strength: string; weak: string; support: string }> = {
  목: {
    strength: '새로 시작하는 힘',
    weak: '새 계획을 너무 미루지 않기',
    support: '오늘 할 일을 작게 시작하기',
  },
  화: {
    strength: '표현하고 드러내는 힘',
    weak: '마음을 너무 늦게 말하지 않기',
    support: '짧게라도 먼저 표현하기',
  },
  토: {
    strength: '붙잡고 정리하는 힘',
    weak: '생활 리듬을 흩트리지 않기',
    support: '돈과 일정을 한 번 정리하기',
  },
  금: {
    strength: '기준을 세우는 힘',
    weak: '결정을 흐리게 두지 않기',
    support: '우선순위를 두 개만 고르기',
  },
  수: {
    strength: '흐름을 읽는 힘',
    weak: '감정과 생각을 몰아두지 않기',
    support: '잠깐 멈추고 자료를 확인하기',
  },
};

const TEN_GOD_PUBLIC_LABELS: Record<string, string> = {
  비견: '내 기준이 뚜렷한 편',
  겁재: '가까운 사람과 역할을 나누는 편',
  식신: '꾸준히 만들어내는 편',
  상관: '표현과 아이디어가 빠른 편',
  편재: '기회와 사람을 넓게 보는 편',
  정재: '돈과 일을 안정적으로 쌓는 편',
  편관: '압박 속에서 집중력이 살아나는 편',
  정관: '책임과 기준을 중요하게 보는 편',
  편인: '혼자 깊게 파악하는 편',
  정인: '배움과 도움을 크게 쓰는 편',
};

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

function hasBatchim(value: string) {
  const lastChar = value.trim().charAt(value.trim().length - 1);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 !== 0;
}

function subjectParticle(value: string) {
  return `${value}${hasBatchim(value) ? '이' : '가'}`;
}

function evidenceLabel(card: ReportEvidenceCard) {
  if (card.key === 'strength' && card.computed.strength) {
    return `균형 ${card.computed.strength}`;
  }

  if (card.key === 'pattern' && card.computed.pattern) {
    const tenGod = card.computed.tenGod ? TEN_GOD_PUBLIC_LABELS[card.computed.tenGod] : null;
    return tenGod ? `반복 성향 ${tenGod}` : '반복 성향 확인';
  }

  if (card.key === 'yongsin' && card.computed.yongsin?.length) {
    return `보완 포인트 ${card.computed.yongsin.slice(0, 2).map(publicElementName).join(' · ')}`;
  }

  if (card.key === 'relations' && card.computed.relations?.length) {
    return `관계 단서 ${card.computed.relations.slice(0, 2).join(' · ')}`;
  }

  return card.label;
}

function getComputed(report: SajuReport) {
  return report.evidenceCards.find((card) => card.computed.dayMaster || card.computed.fiveElementRatio)?.computed;
}

function publicElementName(value: string | null | undefined) {
  const matched = (value ?? '').match(/[목화토금수]/u)?.[0] as Element | undefined;
  if (!matched) return cleanSentence(value) || '균형';
  return ELEMENT_LABELS[matched];
}

function getElementRatio(report: SajuReport): ElementRatio {
  return getComputed(report)?.fiveElementRatio ?? {};
}

function getElementEdges(ratio: ElementRatio) {
  const entries = (Object.entries(ratio) as [Element, number][])
    .filter(([, value]) => Number.isFinite(value))
    .sort((a, b) => b[1] - a[1]);

  const strongest = entries[0] ?? null;
  const weakest = entries.at(-1) ?? null;

  return { strongest, weakest };
}

function getDayElement(report: SajuReport): Element | null {
  return getComputed(report)?.dayMasterElement ?? null;
}

function getSupportElement(report: SajuReport): Element | null {
  const yongsin = getComputed(report)?.yongsin?.[0];
  const matched = yongsin?.match(/[목화토금수]/u)?.[0] as Element | undefined;
  return matched ?? null;
}

function buildPersonalVerdict(report: SajuReport) {
  const ratio = getElementRatio(report);
  const { strongest, weakest } = getElementEdges(ratio);
  const dayElement = getDayElement(report);
  const supportElement = getSupportElement(report);
  const focusLabel = report.focusLabel;

  if (strongest && weakest && supportElement) {
    return `${subjectParticle(ELEMENT_LABELS[strongest[0]])} 강하고 ${subjectParticle(ELEMENT_LABELS[weakest[0]])} 약해, ${focusLabel}은 ${ELEMENT_ACTIONS[supportElement].support}부터 좋아요.`;
  }

  if (dayElement && supportElement) {
    return `${ELEMENT_LABELS[dayElement]} 기질에 ${ELEMENT_LABELS[supportElement]} 보완이 필요해, 오늘은 ${ELEMENT_ACTIONS[supportElement].support}가 좋아요.`;
  }

  if (dayElement) {
    return `${ELEMENT_LABELS[dayElement]} 기질이 먼저 보여요. 오늘은 한 가지 기준만 잡아도 흐름이 편해집니다.`;
  }

  return '';
}

function buildPersonalWhy(report: SajuReport) {
  const ratio = getElementRatio(report);
  const { strongest, weakest } = getElementEdges(ratio);
  const computed = getComputed(report);
  const tenGodTone = computed?.tenGod ? TEN_GOD_PUBLIC_LABELS[computed.tenGod] : null;
  const dayElement = getDayElement(report);

  return firstNonEmpty(
    [
      strongest && weakest
        ? `${ELEMENT_LABELS[strongest[0]]} 흐름이 ${Math.round(strongest[1])}%로 가장 강하고, ${ELEMENT_LABELS[weakest[0]]} 흐름은 ${Math.round(weakest[1])}%라 선택의 균형이 여기서 갈립니다.`
        : null,
      dayElement ? `${ELEMENT_LABELS[dayElement]} 기질은 상황을 ${ELEMENT_ACTIONS[dayElement].strength}으로 풀어가려는 편입니다.` : null,
      tenGodTone ? `반복 성향은 ${tenGodTone}으로 보입니다.` : null,
    ],
    ''
  );
}

function buildPersonalCaution(report: SajuReport) {
  const ratio = getElementRatio(report);
  const { weakest } = getElementEdges(ratio);
  const supportElement = getSupportElement(report);

  return firstNonEmpty(
    [
      weakest
        ? `${subjectParticle(ELEMENT_LABELS[weakest[0]])} 약해질 때는 ${ELEMENT_ACTIONS[weakest[0]].weak}가 중요합니다.`
        : null,
      supportElement ? `${ELEMENT_LABELS[supportElement]} 보완을 놓치면 같은 고민을 오래 붙잡기 쉽습니다.` : null,
    ],
    ''
  );
}

function buildPersonalAction(report: SajuReport) {
  const supportElement = getSupportElement(report);
  const dayElement = getDayElement(report);
  const element = supportElement ?? dayElement;

  if (!element) return '';
  return `${ELEMENT_LABELS[element]} 보완: ${ELEMENT_ACTIONS[element].support}`;
}

function buildPersonalPoints(report: SajuReport) {
  const ratio = getElementRatio(report);
  const { strongest, weakest } = getElementEdges(ratio);
  const computed = getComputed(report);
  const dayElement = getDayElement(report);
  const supportElement = getSupportElement(report);
  const points = [
    dayElement ? `기질 ${ELEMENT_LABELS[dayElement]}` : null,
    strongest ? `강점 ${ELEMENT_LABELS[strongest[0]]} ${Math.round(strongest[1])}%` : null,
    weakest ? `보완 ${ELEMENT_LABELS[weakest[0]]} ${Math.round(weakest[1])}%` : null,
    supportElement ? `오늘 힌트 ${ELEMENT_LABELS[supportElement]}` : null,
    computed?.tenGod ? TEN_GOD_PUBLIC_LABELS[computed.tenGod] : null,
  ];

  return [...new Set(points.filter((point): point is string => Boolean(point)))].slice(0, 4);
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
      buildPersonalVerdict(report),
      report.primaryAction.title,
      report.headline,
      report.scores.find((score) => score.key === report.focusScoreKey)?.summary,
    ],
    '오늘은 먼저 확인할 때입니다.'
  );

  const why = firstNonEmpty(
    [
      buildPersonalWhy(report),
      primaryEvidence?.plainSummary,
      primaryEvidence?.body,
      report.dayMasterSummary,
      report.summary,
    ],
    '지금은 판단보다 기준 정리가 먼저 보입니다.'
  );

  const caution = firstNonEmpty(
    [
      buildPersonalCaution(report),
      report.cautionAction.title,
      report.cautionAction.description,
      secondaryEvidence?.plainSummary,
      secondaryEvidence?.body,
    ],
    '서두르면 같은 문제가 반복될 수 있습니다.'
  );

  const action = firstNonEmpty(
    [
      buildPersonalAction(report),
      report.primaryAction.title,
      report.primaryAction.description,
      ...(primaryEvidence?.practicalActions ?? []),
    ],
    '중요한 선택은 한 번 적고 다시 확인하세요.'
  );

  const evidence = [...new Set(evidenceCards.map(evidenceLabel).filter(Boolean))].slice(0, 3);

  return {
    verdict: compact(verdict, 42),
    why: compact(why, 64),
    caution: compact(caution, 48),
    action: compact(action, 48),
    evidence,
    personalPoints: buildPersonalPoints(report),
    tone: report.focusTopic === 'today' ? 'warm' : 'sharp',
  };
}
