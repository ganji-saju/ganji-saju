import type { SajuDataV1, SajuMajorLuckCycle } from '@/domain/saju/engine/saju-data-v1';
import {
  ELEMENT_INFO,
  getLuckyElementsFromSajuData,
  getPersonalityFromSajuData,
} from '@/lib/saju/elements';
import type { BirthInput, Element } from '@/lib/saju/types';
import { buildSajuReport } from './build-report';
import { buildYearlyReport } from './build-yearly-report';
import type {
  LifetimeKeyword,
  LifetimeLuckPhase,
  LifetimeMajorLuckCycle as LifetimeMajorLuckCycleRow,
  SajuLifetimeReport,
} from './lifetime-types';

function compactStrings(values: Array<string | null | undefined | false>) {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

function formatElementName(element: Element) {
  return ELEMENT_INFO[element].name.split(' ')[0] ?? element;
}

function formatSymbolList(symbols: Array<{ label: string }> | null | undefined) {
  return symbols && symbols.length > 0 ? symbols.map((symbol) => symbol.label).join(' · ') : '';
}

function formatLuckRange(cycle: { startAge: number | null; endAge: number | null }) {
  if (cycle.startAge === null && cycle.endAge === null) return '나이 미산정';
  if (cycle.startAge !== null && cycle.endAge !== null) return `${cycle.startAge}-${cycle.endAge}세`;
  if (cycle.startAge !== null) return `${cycle.startAge}세 이후`;
  return `${cycle.endAge}세 이전`;
}

function deriveLuckPhase(cycle: SajuMajorLuckCycle, isCurrent: boolean): LifetimeLuckPhase {
  const note = cycle.notes.join(' ');

  if (isCurrent || /전환|재편|이동|변화|조정/.test(note)) return '전환기';
  if (/확장|성과|표현|인정|노출|성장|기회/.test(note)) return '확장기';
  return '정리기';
}

function getCurrentKoreaYear() {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
  const parsed = Number.parseInt(formatted, 10);

  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

function buildKeywords(input: {
  dayMasterStem: string;
  dayMasterMetaphor: string | null | undefined;
  dominant: string;
  weakest: string;
  supportLabels: string;
  currentMajorLuck: string | null;
}): LifetimeKeyword[] {
  return [
    {
      label: `${input.dayMasterStem} 일간`,
      reason: input.dayMasterMetaphor
        ? `${input.dayMasterMetaphor}의 상징으로 반응 속도와 자기 표현의 결을 읽습니다.`
        : `${input.dayMasterStem} 일간의 반응 방식이 삶 전체의 기준이 됩니다.`,
    },
    {
      label: `보완 축 ${input.supportLabels}`,
      reason: '평생 운은 강한 기운을 더 키우기보다, 이 보완 축을 생활 안에 안정적으로 들이는 쪽에서 좋아집니다.',
    },
    {
      label: `강한 축 ${input.dominant}`,
      reason: '잘 쓰면 장점이 빠르게 드러나지만, 과속하면 같은 기운이 피로와 고집으로 바뀌기 쉽습니다.',
    },
    {
      label: `약한 축 ${input.weakest}`,
      reason: '무너지기 쉬운 패턴은 대개 약한 축을 방치할 때 드러납니다. 보완 루틴을 먼저 잡아야 합니다.',
    },
    {
      label: input.currentMajorLuck ? `현재 ${input.currentMajorLuck} 대운` : '현재 대운',
      reason: '원국의 본질은 고정값이고, 대운은 그 본질이 어느 장면에서 크게 드러나는지를 바꾸는 배경입니다.',
    },
  ];
}

function buildMajorLuckCycles(
  cycles: SajuMajorLuckCycle[] | null | undefined,
  currentMajorLuckGanzi: string | null
): LifetimeMajorLuckCycleRow[] {
  if (!cycles || cycles.length === 0) {
    return [
      {
        ganzi: '대운 미산정',
        ageLabel: '정보 부족',
        phase: '전환기',
        summary: '성별 또는 생시 정보가 부족해 대운 시작 시점을 세밀하게 산정하지 못했습니다.',
        task: '생시와 출생지를 보완하면 10년 흐름 지도를 더 선명하게 다시 볼 수 있습니다.',
        isCurrent: false,
      },
    ];
  }

  return cycles.slice(0, 10).map((cycle) => {
    const isCurrent = currentMajorLuckGanzi === cycle.ganzi;
    const note = cycle.notes.slice(0, 2).join(' ') || '이 시기의 대운 과제는 세부 해석 보강 대상입니다.';
    const phase = deriveLuckPhase(cycle, isCurrent);

    return {
      ganzi: cycle.ganzi,
      ageLabel: formatLuckRange(cycle),
      phase,
      summary: isCurrent
        ? `${note} 지금은 이 대운의 성격이 현재 선택과 관계 조정에 직접 작동합니다.`
        : note,
      task:
        phase === '확장기'
          ? '기회가 들어와도 기준 없이 넓히지 말고, 실력이 가장 잘 붙는 분야를 먼저 키우는 편이 좋습니다.'
          : phase === '정리기'
            ? '정리와 재배치, 역할 조정, 관계 정돈을 미루지 않는 것이 다음 흐름을 가볍게 만듭니다.'
            : '자리, 역할, 판단 기준이 바뀌기 쉬운 구간이라 서두르기보다 이유와 순서를 먼저 확인해야 합니다.',
      isCurrent,
    };
  });
}

export function buildLifetimeReport(
  input: BirthInput,
  sajuData: SajuDataV1,
  targetYear = getCurrentKoreaYear()
): SajuLifetimeReport {
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');
  const yearlyReport = buildYearlyReport(input, sajuData, targetYear);
  const evidenceByKey = Object.fromEntries(
    todayReport.evidenceCards.map((card) => [card.key, card])
  );

  const dominant = formatElementName(sajuData.fiveElements.dominant);
  const weakest = formatElementName(sajuData.fiveElements.weakest);
  const supportElements = getLuckyElementsFromSajuData(sajuData).map(formatElementName);
  const supportLabels = supportElements.join(' · ') || dominant;
  const personality = getPersonalityFromSajuData(sajuData);
  const pillars = {
    year: sajuData.pillars.year.ganzi,
    month: sajuData.pillars.month.ganzi,
    day: sajuData.pillars.day.ganzi,
    hour: sajuData.pillars.hour?.ganzi ?? null,
  };
  const strength = evidenceByKey.strength;
  const pattern = evidenceByKey.pattern;
  const yongsin = evidenceByKey.yongsin;
  const relations = evidenceByKey.relations;
  const gongmang = evidenceByKey.gongmang;
  const specialSals = evidenceByKey.specialSals;
  const yongsinLabels = sajuData.yongsin
    ? formatSymbolList([sajuData.yongsin.primary, ...sajuData.yongsin.secondary])
    : yongsin?.title ?? supportLabels;
  const kiyshinLabels =
    sajuData.yongsin && sajuData.yongsin.kiyshin.length > 0
      ? formatSymbolList(sajuData.yongsin.kiyshin)
      : weakest;
  const currentMajorLuck = sajuData.currentLuck?.currentMajorLuck ?? null;
  const todayTimeline = todayReport.timeline.find((item) => item.label === '오늘') ?? null;
  const monthTimeline = todayReport.timeline.find((item) => item.label === '이번 달') ?? null;
  const majorTimeline = todayReport.timeline.find((item) => item.label === '대운 흐름') ?? null;
  const majorLuckCycles = buildMajorLuckCycles(
    sajuData.majorLuck,
    currentMajorLuck?.ganzi ?? null
  );
  const firstCurrentCycle = majorLuckCycles.find((cycle) => cycle.isCurrent) ?? majorLuckCycles[0];
  const elementHighlights = Object.entries(sajuData.fiveElements.byElement).map(
    ([element, value]) =>
      `${formatElementName(element as Element)} ${value.percentage}% · ${value.state} · ${value.score}점`
  );
  const rememberRules = [
    `강한 ${dominant} 기운은 무리하게 쓰기보다 방향을 정하고 쓸 때 오래 갑니다.`,
    `${supportLabels} 기운을 생활 루틴으로 만들수록 명식의 장점이 안정적으로 살아납니다.`,
    `${weakest} 축이 약해지는 날에는 속도보다 리듬을 먼저 바로잡는 편이 좋습니다.`,
    '관계와 일에서 서운함이나 조급함을 결론처럼 말하기보다, 사실과 기준을 먼저 정리해야 합니다.',
    `지금의 ${currentMajorLuck?.ganzi ?? '대운'}은 단기 반응보다 장기 기준을 바로 세울수록 힘을 실어줍니다.`,
  ];

  return {
    targetYear,
    pillars,
    cover: {
      headline: `${sajuData.pillars.day.ganzi} 일주 기준 깊은 사주풀이`,
      oneLineSummary: `이 사주는 ${supportLabels} 기운을 삶의 기준으로 들일 때 실력이 가장 안정적으로 오래 갑니다.`,
      keywords: buildKeywords({
        dayMasterStem: sajuData.dayMaster.stem,
        dayMasterMetaphor: sajuData.dayMaster.metaphor,
        dominant,
        weakest,
        supportLabels,
        currentMajorLuck: currentMajorLuck?.ganzi ?? null,
      }),
      lifetimeRule: `${sajuData.dayMaster.stem} 일간의 추진력과 ${dominant} 기운의 장점은 이미 충분합니다. 평생 운을 살리는 기준은 더 세게 몰아가는 것이 아니라, ${supportLabels} 보완 축을 반복 가능한 습관과 선택 기준으로 만드는 데 있습니다.`,
      basis: compactStrings([
        `원국: ${[pillars.year, pillars.month, pillars.day, pillars.hour ?? '시주 미입력'].join(' · ')}`,
        strength?.title ? `강약 기준: ${strength.title}` : null,
        pattern?.title ? `격국 기준: ${pattern.title}` : null,
        yongsin?.title ? `용신 기준: ${yongsin.title}` : null,
      ]),
    },
    coreIdentity: {
      headline: '원국의 본질',
      summary: `${personality} ${todayReport.summaryHighlights[0] ?? ''}`.trim(),
      reactionStyle:
        todayReport.dayMasterSummary ||
        `${sajuData.dayMaster.stem} 일간은 반응이 빠른 편이며, 한 번 기준이 잡히면 스스로 방향을 만들려는 힘이 강합니다.`,
      bestEnvironment: `${supportLabels} 기운이 살아나는 구조, 즉 속도만 빠른 자리보다 기준과 리듬이 함께 있는 환경에서 강점이 가장 크게 드러납니다.`,
      weakPattern: `${weakest} 축이 비거나 ${dominant} 기운이 과속할 때, 장점이 곧 피로와 고집으로 바뀌기 쉽습니다. 특히 서둘러 결론을 내리거나 감정을 바로 행동으로 옮길 때 무너지기 쉽습니다.`,
      basis: compactStrings([
        todayReport.headline,
        personality,
        todayReport.summaryHighlights[0],
        todayReport.summaryHighlights[1],
      ]),
    },
    strengthBalance: {
      headline: '강약 / 오행 균형',
      summary:
        strength?.body ??
        `${dominant} 기운이 앞에 서고 ${weakest} 기운은 의식적으로 보완해야 하는 구조입니다.`,
      strongAxis: `${dominant} 기운은 타고난 장점이자 즉시 반응하는 힘입니다. 이 축이 살아나면 추진력, 존재감, 판단 속도가 자연스럽게 드러납니다.`,
      weakAxis: `${weakest} 기운은 몸과 마음의 균형을 잡는 약한 축입니다. 방치하면 피로가 누적되고, 감정이나 재정, 생활 리듬에서 빈틈이 생기기 쉽습니다.`,
      energyDrain:
        todayReport.cautionAction.description ||
        `${dominant} 기운만 앞세우면 오래 버티는 힘보다 단기 반응이 앞서서 에너지가 쉽게 샙니다.`,
      recovery:
        todayReport.primaryAction.description ||
        `${supportLabels} 기운을 살리는 루틴을 만들수록 회복 속도가 빨라지고, 강한 축도 안정적으로 오래 갑니다.`,
      balanceGuide: [
        ...(strength?.practicalActions ?? []),
        ...(yongsin?.practicalActions ?? []),
      ].slice(0, 5),
      elementHighlights,
      basis: compactStrings([
        strength?.title ? `강약 기준: ${strength.title}` : null,
        `강한 오행: ${dominant}`,
        `약한 오행: ${weakest}`,
      ]),
    },
    patternAndYongsin: {
      headline: '격국 / 용신',
      summary:
        yongsin?.body ??
        `이 명식은 ${yongsinLabels} 기운을 보완 축으로 쓰는 것이 평생 선택의 기준입니다.`,
      patternRole:
        pattern?.body ??
        '격국은 이 사람이 어떤 역할 구조에서 실력이 붙는지, 어디에서 책임과 반응이 반복되는지를 읽는 기준입니다.',
      yongsinDirection:
        yongsin?.body ??
        `${yongsinLabels} 기운을 꾸준히 들이면 명식의 장점이 균형 있게 살아납니다.`,
      choiceRule: `${supportLabels} 보완 축이 살아나는 선택은 길게 보면 명식을 살리고, ${kiyshinLabels} 기운이 과해지는 선택은 짧게는 편해도 오래 가면 균형을 흐릴 가능성이 큽니다.`,
      supportSymbols: compactStrings([
        yongsinLabels,
        supportLabels,
      ]),
      cautionSymbols: compactStrings([
        kiyshinLabels,
        weakest,
      ]),
      practicalActions: [
        ...(yongsin?.practicalActions ?? []),
        ...(pattern?.practicalActions ?? []),
      ].slice(0, 5),
      detailLines: compactStrings([
        ...(yongsin?.details ?? []).slice(0, 4),
        ...(pattern?.details ?? []).slice(0, 2),
      ]),
      basis: compactStrings([
        pattern?.title ? `격국: ${pattern.title}` : null,
        yongsin?.title ? `용신: ${yongsin.title}` : null,
        yongsin?.details.find((detail) => detail.includes('후보')),
      ]),
    },
    relationshipPattern: {
      headline: '관계 패턴',
      summary:
        relationshipReport.summaryHighlights[0] ??
        '관계는 친밀감 자체보다 거리감 조절 방식에서 성패가 갈리는 명식입니다.',
      distanceStyle:
        relationshipReport.primaryAction.description ||
        '가까운 사람일수록 한 번에 결론을 내리기보다, 말의 속도와 순서를 조절하는 편이 좋습니다.',
      expressionStyle:
        loveReport.primaryAction.description ||
        '감정은 깊어도 표현은 늦게 나올 수 있어, 짧고 분명한 확인이 관계를 오래 가게 합니다.',
      conflictTriggers:
        relationshipReport.cautionAction.description ||
        '서운함을 판단처럼 말하거나, 상대의 반응을 기다리기 전에 먼저 마음이 닫히는 방식이 갈등의 시작점이 되기 쉽습니다.',
      longevityGuide:
        loveReport.summaryHighlights[1] ??
        '관계를 오래 가게 하는 힘은 큰 이벤트보다, 확인과 감사, 거리감 조절 같은 작은 루틴에 있습니다.',
      basis: compactStrings([
        relationshipReport.headline,
        relationshipReport.summary,
        loveReport.summary,
        relations?.title ? `합충 기준: ${relations.title}` : relations?.body,
      ]),
    },
    wealthStyle: {
      headline: '재물 감각',
      summary:
        wealthReport.summaryHighlights[0] ??
        '재물운은 한 번의 대박보다 돈을 다루는 구조와 판단 습관을 읽는 편이 더 정확합니다.',
      earningStyle:
        wealthReport.primaryAction.description ||
        '돈을 버는 방식은 흐름을 읽고 정리하는 쪽에서 힘이 납니다.',
      keepingStyle:
        wealthReport.summaryHighlights[1] ??
        '벌어들이는 힘 못지않게, 약속된 금액과 반복 지출을 점검하는 습관이 재물운을 지켜줍니다.',
      spendingMistakes:
        wealthReport.cautionAction.description ||
        '감정이 올라온 날의 결제, 지인 말만 믿고 움직이는 지출, 비교 없이 서두르는 선택이 재물 피로를 키우기 쉽습니다.',
      operatingStyle:
        wealthReport.summary ||
        `${supportLabels} 기운이 살아나는 방식, 즉 자료 확인과 기준 정리, 반복 가능한 운영 습관이 맞는 재물 체질입니다.`,
      basis: compactStrings([
        wealthReport.headline,
        formatSymbolList(sajuData.yongsin ? [sajuData.yongsin.primary, ...sajuData.yongsin.secondary] : []),
        strength?.title ? `강약 기준: ${strength.title}` : null,
      ]),
    },
    careerDirection: {
      headline: '직업 방향',
      summary:
        careerReport.summaryHighlights[0] ??
        '직업운은 당장 붙는 자리보다 오래 버틸 수 있는 역할 구조를 봐야 정확합니다.',
      fitStructure:
        careerReport.primaryAction.description ||
        '기준과 책임선이 분명한 구조에서 실력이 붙기 쉽습니다.',
      endureVsShine:
        careerReport.summaryHighlights[1] ??
        '버티는 일과 빛나는 일의 차이는 속도보다 역할의 적합도에서 갈립니다.',
      independenceStyle:
        pattern?.body ??
        '독립과 조직 중 무엇이 맞느냐보다, 기준을 스스로 세울 수 있는 권한이 있는지가 더 중요합니다.',
      recognitionStyle:
        careerReport.cautionAction.description ||
        '인정은 한 번의 강한 인상보다, 반복되는 신뢰와 기준 있는 결과물로 쌓이는 명식입니다.',
      basis: compactStrings([
        careerReport.headline,
        careerReport.summary,
        pattern?.title ? `격국 기준: ${pattern.title}` : null,
      ]),
    },
    healthRhythm: {
      headline: '건강 리듬',
      summary: `${weakest} 축의 리듬이 흐트러지면 몸이 먼저 무너진다기보다 생활 전체의 템포가 어긋나기 쉬운 명식입니다.`,
      warningSignals:
        monthTimeline?.body ??
        '수면, 식사, 회복 순서가 깨질 때 작은 피로가 오래 남고 예민함이 커지기 쉽습니다.',
      recoveryRoutine:
        todayReport.primaryAction.description ||
        `${supportLabels} 기운이 살아나는 생활 루틴, 특히 휴식과 정리, 속도 조절이 회복의 핵심입니다.`,
      habitPoints: [
        ...(strength?.practicalActions ?? []),
        ...(gongmang?.practicalActions ?? []),
      ].slice(0, 4),
      basis: compactStrings([
        strength?.title ? `강약 기준: ${strength.title}` : null,
        gongmang?.title ? `공망 기준: ${gongmang.title}` : gongmang?.body,
        monthTimeline?.headline,
      ]),
    },
    majorLuckTimeline: {
      headline: '대운 10년 흐름 지도',
      summary:
        majorTimeline?.body ??
        '대운은 사건 하나를 맞히는 표가 아니라, 어느 시기에 확장·정리·전환 과제가 커지는지 읽는 장기 지도입니다.',
      currentMeaning: firstCurrentCycle
        ? `${firstCurrentCycle.ganzi} 대운은 지금 ${firstCurrentCycle.phase}의 과제가 커지는 구간입니다. ${firstCurrentCycle.summary}`
        : '현재 대운의 의미를 읽을 수 있는 데이터가 아직 부족합니다.',
      cycles: majorLuckCycles,
      basis: compactStrings([
        currentMajorLuck ? `현재 대운: ${currentMajorLuck.ganzi}` : null,
        ...(currentMajorLuck?.notes ?? []).slice(0, 2),
        majorTimeline?.headline,
      ]),
    },
    lifetimeStrategy: {
      headline: '평생 활용 전략',
      summary: `이 사주는 성향 해설보다 사용법이 더 중요합니다. ${supportLabels} 기운을 언제 살리고, ${weakest} 축이 흔들릴 때 무엇을 먼저 지킬지 아는 사람이 결국 흐름을 안정적으로 씁니다.`,
      useWhenStrong: compactStrings([
        todayReport.primaryAction.description,
        wealthReport.primaryAction.description,
        careerReport.primaryAction.description,
      ]).slice(0, 4),
      defendWhenShaken: compactStrings([
        todayReport.cautionAction.description,
        relationshipReport.cautionAction.description,
        wealthReport.cautionAction.description,
      ]).slice(0, 4),
      rememberRules,
      basis: compactStrings([
        specialSals?.title ? `신살 기준: ${specialSals.title}` : specialSals?.body,
        relations?.title ? `합충 기준: ${relations.title}` : relations?.body,
        majorTimeline?.body,
      ]),
    },
    yearlyAppendix: {
      year: targetYear,
      yearLabel: yearlyReport.yearLabel,
      yearGanji: yearlyReport.annualContext.yearGanji,
      headline: yearlyReport.overview.headline,
      oneLineSummary: yearlyReport.oneLineSummary,
      firstHalf: yearlyReport.firstHalf.summary,
      secondHalf: yearlyReport.secondHalf.summary,
      goodPeriods: yearlyReport.goodPeriods.map(
        (window) => `${window.months.map((month) => `${month}월`).join(', ')} · ${window.reason}`
      ),
      cautionPeriods: yearlyReport.cautionPeriods.map(
        (window) => `${window.months.map((month) => `${month}월`).join(', ')} · ${window.reason}`
      ),
      actionAdvice: [
        ...yearlyReport.actionGuide.useWhenStrong,
        ...yearlyReport.actionGuide.defendWhenWeak,
      ].slice(0, 4),
      ctaLabel: `${targetYear} 올해 전략서 전체 보기`,
      ctaAnchor: '#yearly-report',
      basis: compactStrings([
        yearlyReport.overview.summary,
        yearlyReport.firstHalf.opportunity,
        yearlyReport.secondHalf.caution,
      ]),
    },
    evidenceCards: todayReport.evidenceCards,
  };
}
