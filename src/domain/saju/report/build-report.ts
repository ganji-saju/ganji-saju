import type {
  SajuDataV1,
  SajuSymbolRef,
  SajuYongsinCandidate,
  TenGodCode,
  YongsinConfidence,
} from '@/domain/saju/engine/saju-data-v1';
import type { OrreryRelation } from '@/domain/saju/engine/orrery-adapter';
import {
  ELEMENT_INFO,
  getLuckyElementsFromSajuData,
  getPersonalityFromSajuData,
} from '@/lib/saju/elements';
import {
  limitSajuSentences,
  simplifySajuCopy,
  simplifySajuCopyList,
} from '@/lib/saju/public-copy';
import type { BirthInput, Element } from '@/lib/saju/types';
import type {
  FocusTopic,
  FocusTopicMeta,
  FocusTopicOption,
  ReportEvidenceCard,
  ReportEvidenceComputed,
  ReportEvidenceKey,
  ReportInsight,
  ReportScore,
  ReportTimelineItem,
  SajuReport,
} from './types';
import {
  getInterpretationScoreBand,
  getTopicInterpretationRule,
  selectEvidenceCard,
  toEvidenceSnippet,
} from './interpretation-rule-table';
import { getEvidenceSource, getEvidenceTopicMapping } from './topic-rule-table';
import {
  CORE_TERM_EXPLAINERS,
  EVIDENCE_ACTIONS,
  FOCUS_TOPIC_META,
  STRENGTH_INTERPRETATION,
  buildDates,
  buildInsights,
  buildTimeline,
  buildTopicActions,
  compactStrings,
  formatPublicSymbolList,
  getDayMasterSummary,
  getElementEntries,
  getHeadline,
  getOrreryExtension,
  getSpecialSalGroups,
  toPublicReport,
} from './build-report-copy';
import { TOPIC_SCORE_KEYS, buildScores, buildSummaryHighlights } from './build-report-scores';
export { FOCUS_TOPIC_META, FOCUS_TOPIC_OPTIONS } from './build-report-copy';

function buildFiveElementRatio(data: SajuDataV1): ReportEvidenceComputed['fiveElementRatio'] {
  return (Object.keys(data.fiveElements.byElement) as Element[]).reduce<
    NonNullable<ReportEvidenceComputed['fiveElementRatio']>
  >((accumulator, element) => {
    accumulator[element] = data.fiveElements.byElement[element].percentage;
    return accumulator;
  }, {});
}

function buildBaseComputed(data: SajuDataV1): ReportEvidenceComputed {
  return {
    dayMaster: data.dayMaster.stem,
    dayMasterElement: data.dayMaster.element,
    monthPillar: data.pillars.month.ganzi,
    fiveElementRatio: buildFiveElementRatio(data),
    strength: data.strength?.level ?? null,
    strengthScore: data.strength?.score ?? null,
    pattern: data.pattern?.name ?? null,
    tenGod: data.pattern?.tenGod ?? data.tenGods?.dominant ?? null,
    yongsin: data.yongsin
      ? [data.yongsin.primary, ...data.yongsin.secondary].map((symbol) => symbol.label)
      : [],
    currentLuck: compactStrings([
      data.currentLuck?.currentMajorLuck?.ganzi
        ? `${data.currentLuck.currentMajorLuck.ganzi} 대운`
        : null,
      data.currentLuck?.saewoon?.ganzi ? `${data.currentLuck.saewoon.ganzi} 세운` : null,
      data.currentLuck?.wolwoon?.ganzi ? `${data.currentLuck.wolwoon.ganzi} 월운` : null,
    ]),
  };
}

function buildStrengthEvidenceCard(data: SajuDataV1): ReportEvidenceCard {
  const strength = data.strength;
  const computed = buildBaseComputed(data);
  const key = 'strength';

  if (!strength) {
    return {
      key,
      label: '강약',
      title: '강약 계산 준비 중',
      body: '현재 저장본은 seed 데이터라 강약 점수와 근거가 아직 비어 있습니다.',
      details: ['강약 계산이 연결되면 일간을 돕는 힘과 누르는 힘의 균형을 이 카드에서 먼저 보여줍니다.'],
      computed,
      source: getEvidenceSource(key),
      confidence: '참고',
      topicMapping: getEvidenceTopicMapping(key),
    };
  }

  return {
    key,
    label: '강약',
    title: `${strength.level} · ${strength.score}점`,
    body: STRENGTH_INTERPRETATION[strength.level],
    details: strength.rationale.length > 0
      ? strength.rationale.slice(0, 3)
      : ['강약 점수는 계산되었고, 세부 근거 문장은 다음 단계에서 보강됩니다.'],
    plainSummary: `강약 메모: ${strength.level} · ${strength.score}점`,
    technicalSummary: '전문적으로는 월령의 계절 보정, 일간을 돕는 오행, 일간을 소모시키는 오행, 지지의 뿌리를 함께 계산합니다.',
    practicalActions: EVIDENCE_ACTIONS.strength[strength.level],
    explainers: CORE_TERM_EXPLAINERS.strength,
    computed,
    source: getEvidenceSource(key),
    confidence: '확정',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildPatternEvidenceCard(data: SajuDataV1): ReportEvidenceCard {
  const pattern = data.pattern;
  const computed = buildBaseComputed(data);
  const key = 'pattern';

  if (!pattern) {
    return {
      key,
      label: '격국',
      title: '격국 계산 준비 중',
      body: '격국 필드가 비어 있어도 카드 자리는 유지합니다.',
      details: ['월령과 십신 기준의 rule-based 계산이 들어오면 격국 근거가 이 카드로 정리됩니다.'],
      computed,
      source: getEvidenceSource(key),
      confidence: '참고',
      topicMapping: getEvidenceTopicMapping(key),
    };
  }

  return {
    key,
    label: '격국',
    title: pattern.tenGod ? `${pattern.name} · ${pattern.tenGod}` : pattern.name,
    body: pattern.tenGod
      ? `${pattern.tenGod}의 역할감과 관계 패턴이 해석의 첫 기준으로 올라옵니다. 쉽게 말하면 삶에서 반복해서 맡게 되는 자리와 반응 방식을 보는 항목입니다.`
      : '월령의 성격을 기준으로 명식의 큰 구조를 먼저 읽습니다.',
    details: pattern.rationale.length > 0
      ? pattern.rationale.slice(0, 3)
      : ['격국명은 준비되었고 상세 근거 문장은 다음 단계에서 보강됩니다.'],
    plainSummary: pattern.tenGod
      ? `격국 메모: ${pattern.name} · ${pattern.tenGod}`
      : `격국 메모: ${pattern.name}`,
    technicalSummary: '전문적으로는 월지의 주기운과 지장간을 일간 기준 십신으로 환산해 격국명을 정합니다.',
    practicalActions: EVIDENCE_ACTIONS.pattern,
    explainers: CORE_TERM_EXPLAINERS.pattern,
    computed,
    source: getEvidenceSource(key),
    confidence: '확정',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildYongsinEvidenceCard(data: SajuDataV1): ReportEvidenceCard {
  const yongsin = data.yongsin;
  const computed = buildBaseComputed(data);
  const key = 'yongsin';

  if (!yongsin) {
    return {
      key,
      label: '용신',
      title: '용신 계산 준비 중',
      body: '용신과 기신 자리가 열려 있습니다.',
      details: ['조후와 억부 판정이 채워지면 보완해야 할 기운과 피해야 할 기운을 분리해 보여줍니다.'],
      computed,
      source: getEvidenceSource(key),
      confidence: '참고',
      topicMapping: getEvidenceTopicMapping(key),
    };
  }

  const yongsinLabel = formatSymbolList([yongsin.primary, ...yongsin.secondary]);
  const kiyshinLabel = yongsin.kiyshin.length > 0 ? formatSymbolList(yongsin.kiyshin) : '기신 미기재';
  const publicYongsinLabel = formatPublicSymbolList([yongsin.primary, ...yongsin.secondary]);
  const publicKiyshinLabel = yongsin.kiyshin.length > 0 ? formatPublicSymbolList(yongsin.kiyshin) : '';
  const candidateDetails = yongsin.candidates?.slice(0, 3).map(formatYongsinCandidateDetail) ?? [];
  const confidenceLabel = yongsin.confidence ?? '중간';

  return {
    key,
    label: '용신',
    title: publicYongsinLabel ? `${publicYongsinLabel}을 챙기는 흐름` : `1순위 ${yongsin.primary.label}`,
    body: `${publicYongsinLabel || '균형'} 쪽을 생활 속에서 챙기면 선택이 덜 흔들립니다. ${
      publicKiyshinLabel
        ? `${publicKiyshinLabel} 쪽이 과해질 때는 속도와 감정을 한 번 늦추세요.`
        : '과속하거나 한쪽으로 치우친 선택은 한 번 더 조절하는 편이 좋습니다.'
    }`,
    details: [
      yongsin.technicalSummary ?? `${yongsin.method} 기준으로 ${yongsinLabel}을 보완 축으로 봅니다.`,
      `주의해서 볼 기운: ${kiyshinLabel}. 이 기운은 무조건 나쁘다는 뜻이 아니라, 이미 과하거나 균형을 흐릴 때 조절이 필요하다는 뜻입니다.`,
      ...candidateDetails,
      ...yongsin.rationale.slice(0, 2),
    ].filter(Boolean),
    plainSummary: yongsin.plainSummary,
    technicalSummary: yongsin.technicalSummary,
    practicalActions: yongsin.practicalActions,
    explainers: yongsin.terms?.map((term) => ({
      term: term.term,
      hanja: term.hanja,
      meaning: term.meaning,
    })),
    computed,
    source: getEvidenceSource(key),
    confidence: yongsin.method === 'legacy-placeholder' ? '참고' : mapYongsinConfidence(confidenceLabel),
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function mapYongsinConfidence(confidence: YongsinConfidence): ReportEvidenceCard['confidence'] {
  if (confidence === '높음') return '확정';
  if (confidence === '낮음') return '참고';
  return '보통';
}

function formatYongsinCandidateDetail(candidate: SajuYongsinCandidate) {
  const roleLabel = candidate.role === 'primary' ? '1순위' : candidate.role === 'support' ? '보조' : '참고';
  const secondary = candidate.secondary.length > 0 ? `, 보조 ${formatSymbolList(candidate.secondary)}` : '';
  return `${roleLabel} 후보: ${candidate.method} ${candidate.primary.label}${secondary} · ${candidate.score}점`;
}

function formatRelationEvidenceLine(relation: OrreryRelation) {
  const pair = relation.target ? `${relation.source}-${relation.target}` : relation.source;
  return `${pair}: ${relation.label}${relation.detail ? ` · ${relation.detail}` : ''}`;
}

function buildRelationEvidenceCard(data: SajuDataV1): ReportEvidenceCard {
  const key = 'relations';
  const relations = getOrreryExtension(data)?.relations ?? [];
  const tension = relations.find((relation) =>
    ['충', '형', '해', '파', '천간충'].includes(relation.label)
  );
  const support = relations.find((relation) =>
    ['천간합', '육합', '반합', '삼합', '방합'].includes(relation.label)
  );
  const selected = [tension, support, ...relations].filter(
    (relation, index, array): relation is OrreryRelation =>
      Boolean(relation) && array.findIndex((item) => item === relation) === index
  ).slice(0, 4);
  const labels = [...new Set(selected.map((relation) => relation.label))];
  const computed = {
    ...buildBaseComputed(data),
    relations: selected.map(formatRelationEvidenceLine),
  };

  return {
    key,
    label: '합충',
    title: labels.length > 0 ? labels.join(' · ') : '합충 근거 없음',
    body: selected.length > 0
      ? '합충은 명식 안에서 기운이 묶이거나 부딪히는 지점을 보는 근거입니다. 쉽게 말하면 관계, 이동, 결정의 압력이 어디서 생기는지 보는 항목입니다.'
      : '현재 명식에서 화면에 우선 표시할 합충 관계는 아직 확인되지 않았습니다.',
    details: selected.length > 0
      ? selected.map(formatRelationEvidenceLine)
      : ['합충 데이터가 들어오면 어떤 글자끼리 작용하는지 이 카드에 분리해 표시됩니다.'],
    plainSummary: selected.length > 0
      ? `합충 메모: ${labels.join(' · ')}`
      : '합충 메모: 확인된 흐름 없음',
    technicalSummary: '전문적으로는 천간합, 천간충, 육합, 삼합, 방합, 충·형·해·파를 분리해 봅니다.',
    practicalActions: EVIDENCE_ACTIONS.relations,
    explainers: CORE_TERM_EXPLAINERS.relations,
    computed,
    source: getEvidenceSource(key),
    confidence: selected.length > 0 ? '보통' : '참고',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function formatPillarSlot(slot: string) {
  switch (slot) {
    case 'year':
      return '년주';
    case 'month':
      return '월주';
    case 'day':
      return '일주';
    case 'hour':
      return '시주';
    default:
      return slot;
  }
}

function buildGongmangEvidenceCard(data: SajuDataV1): ReportEvidenceCard {
  const key = 'gongmang';
  const gongmang = getOrreryExtension(data)?.gongmang;
  const branches = gongmang?.branches?.join('·') ?? '';
  const slots = gongmang?.pillarSlots.map(formatPillarSlot) ?? [];
  const computed = {
    ...buildBaseComputed(data),
    gongmang: gongmang?.branches ?? [],
  };

  return {
    key,
    label: '공망',
    title: branches ? `${branches} 공망` : '공망 근거 없음',
    body: branches
      ? '공망은 비어 보이거나 지연되기 쉬운 축을 확인해 약속, 일정, 마무리 방식을 조정하는 근거입니다. 쉽게 말하면 기대가 바로 채워지지 않는 자리를 미리 확인하는 항목입니다.'
      : '현재 저장본에서 공망 값은 아직 확인되지 않았습니다.',
    details: slots.length > 0
      ? [`작용 위치: ${slots.join(' · ')}`]
      : ['공망 글자가 특정 주에 닿으면 이곳에 작용 위치가 함께 표시됩니다.'],
    plainSummary: branches
      ? `공망 메모: ${branches} 공망`
      : '공망 메모: 확인된 흐름 없음',
    technicalSummary: '전문적으로는 일주 기준 공망 글자를 잡고, 그 글자가 년·월·일·시 어느 자리에 닿는지 확인합니다.',
    practicalActions: EVIDENCE_ACTIONS.gongmang,
    explainers: CORE_TERM_EXPLAINERS.gongmang,
    computed,
    source: getEvidenceSource(key),
    confidence: branches ? '보통' : '참고',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildSpecialSalsEvidenceCard(data: SajuDataV1): ReportEvidenceCard {
  const key = 'specialSals';
  const { supportive, cautionary } = getSpecialSalGroups(data);
  const names = [...supportive, ...cautionary];
  const details = compactStrings([
    supportive.length > 0 ? `도움: ${supportive.join(' · ')}` : null,
    cautionary.length > 0 ? `주의: ${cautionary.join(' · ')}` : null,
  ]);
  const computed = {
    ...buildBaseComputed(data),
    specialSals: names,
  };

  return {
    key,
    label: '신살',
    title: names.length > 0 ? names.slice(0, 5).join(' · ') : '주요 신살 없음',
    body: names.length > 0
      ? '신살은 도움을 받는 통로와 주의해야 할 속도를 함께 보는 보조 근거입니다. 쉽게 말하면 이 명식에서 눈에 띄는 보너스 표지와 주의 표지를 나누어 보는 항목입니다.'
      : '현재 명식에서 우선 표시할 주요 신살은 아직 확인되지 않았습니다.',
    details: details.length > 0 ? details : ['신살 데이터가 들어오면 도움/주의 흐름을 나누어 표시합니다.'],
    plainSummary: names.length > 0
      ? `신살 메모: ${names.slice(0, 5).join(' · ')}`
      : '신살 메모: 주요 표지 없음',
    technicalSummary: '전문적으로는 일간·일지·연지 등을 기준으로 귀인, 도화, 양인, 백호 같은 보조 표지를 대조합니다.',
    practicalActions: EVIDENCE_ACTIONS.specialSals,
    explainers: CORE_TERM_EXPLAINERS.specialSals,
    computed,
    source: getEvidenceSource(key),
    confidence: '참고',
    topicMapping: getEvidenceTopicMapping(key),
  };
}

function buildEvidenceCards(data: SajuDataV1): ReportEvidenceCard[] {
  return [
    buildStrengthEvidenceCard(data),
    buildPatternEvidenceCard(data),
    buildYongsinEvidenceCard(data),
    buildRelationEvidenceCard(data),
    buildGongmangEvidenceCard(data),
    buildSpecialSalsEvidenceCard(data),
  ];
}

export function normalizeFocusTopic(value?: string): FocusTopic {
  if (!value) return 'today';
  if (value in FOCUS_TOPIC_META) return value as FocusTopic;
  return 'today';
}

export function buildSajuReport(
  input: BirthInput,
  data: SajuDataV1,
  topicValue?: string
): SajuReport {
  const focusTopic = normalizeFocusTopic(topicValue);
  const meta = FOCUS_TOPIC_META[focusTopic];
  const scores = buildScores(input, data);
  const scoreMap = Object.fromEntries(scores.map((score) => [score.key, score.score])) as Record<
    ReportScore['key'],
    number
  >;
  const focusScoreKey = TOPIC_SCORE_KEYS[focusTopic];
  const supportElements = getLuckyElementsFromSajuData(data);
  const dominant = ELEMENT_INFO[data.fiveElements.dominant].name.split(' ')[0];
  const weakest = ELEMENT_INFO[data.fiveElements.weakest].name.split(' ')[0];
  const evidenceCards = buildEvidenceCards(data);
  const { primaryAction, cautionAction } = buildTopicActions(
    data,
    focusTopic,
    supportElements,
    scoreMap,
    evidenceCards
  );
  const { luckyDates, cautionDates } = buildDates(input, data);

  const dayMasterSummary = getDayMasterSummary(data);
  const summaryHighlights = buildSummaryHighlights(
    data,
    focusTopic,
    scoreMap,
    dominant,
    weakest,
    evidenceCards
  );

  return toPublicReport({
    focusTopic,
    focusLabel: meta.label,
    focusBadge: meta.badge,
    focusScoreKey,
    headline: getHeadline(focusTopic, scoreMap, data),
    dayMasterSummary,
    summary: compactStrings([dayMasterSummary, ...summaryHighlights]).join(' '),
    summaryHighlights,
    evidenceCards,
    scores,
    primaryAction,
    cautionAction,
    insights: buildInsights(data, focusTopic, evidenceCards),
    timeline: buildTimeline(data, focusTopic),
    luckyDates,
    cautionDates,
    supportElements,
  });
}

function formatSymbolList(symbols: SajuSymbolRef[]) {
  return symbols.map((symbol) => symbol.label).join(' · ');
}
