// Server-side assembly; ReportDocument imports this module only as a type.
import { buildLifetimePdfTimeline } from '@/lib/saju/lifetime-pdf-timeline';
import type { PriceKey } from '@/lib/payments/price-display-shared';
import type { SajuLifetimeReport } from '@/domain/saju/report';
import type { ReadingRecord } from '@/lib/saju/readings';
import type { SajuDataV1, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { Element, Stem, Branch } from '@/lib/saju/types';
import { detectComprehensiveSinsals } from '@/lib/today-fortune/sinsal-comprehensive';
import type { PdfNarrativeSection } from './pdf-report-pages';
import {
  PDF_COLORS,
  PDF_ELEMENT_COLORS,
  ELEMENT_HANJA,
  PDF_TEN_GOD_COLORS,
  TEN_GOD_HANJA,
  TEN_GOD_DESCRIPTIONS,
  STEM_PROFILES,
  BRANCH_PROFILES,
  buildPersonalityTraits,
  SINSAL_DISPLAY,
  josa,
} from '@/lib/saju/pdf-report-maps';
import { buildFallbackLifetimeInterpretation, type SajuLifetimeAiInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import {
  resolvePdfSubjectName,
  pickInterpretationText,
  firstSentences,
} from '@/lib/saju/pdf-report-text';


const DEEP_SECTION_LABELS: Array<{ key: string; label: string }> = [
  { key: 'coreIdentity', label: '타고난 성향' },
  { key: 'wealthStyle', label: '돈을 벌고 남기는 방식' },
  { key: 'careerDirection', label: '잘하는 일과 오래할 수 있는 일' },
  { key: 'relationshipPattern', label: '연애와 가까운 관계' },
  { key: 'strengthBalance', label: '부담과 회복의 균형' },
  { key: 'patternAndYongsin', label: '내 선택을 돕는 기준' },
  { key: 'healthRhythm', label: '생활과 회복의 방식' },
  { key: 'majorLuckTimeline', label: '10년 단위 큰 흐름' },
  { key: 'lifetimeStrategy', label: '평생 활용 전략' },
];


// 십성 분포 상위 5.
function getTenGodPercentages(data: SajuDataV1 | SajuDataV2) {
  const byType = data.tenGods?.byType;
  if (!byType) return [];
  const total = Object.values(byType).reduce((sum, v) => sum + v, 0);
  if (total === 0) return [];
  return Object.entries(byType)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({
      name: name as TenGodCode,
      value: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}


const GENDER_LABEL = (gender?: 'male' | 'female') =>
  gender === 'male' ? '남성' : gender === 'female' ? '여성' : '미입력';

// 시지(時支) 한글 이름 — 2시간 단위. index 0=자(23~01), 1=축(01~03), 2=인(03~05),
// 3=묘(05~07), 4=진(07~09), 5=사(09~11), 6=오(11~13), 7=미(13~15), 8=신(15~17),
// 9=유(17~19), 10=술(19~21), 11=해(21~23).
const HOUR_BRANCH_FULL = [
  '자시', '축시', '인시', '묘시', '진시', '사시',
  '오시', '미시', '신시', '유시', '술시', '해시',
] as const;

/** 시각을 "12:00 (오시)" 형태로 (시지 한글 띠 포함). hour 미입력 시 '시간 미입력'. */
function formatBirthTime(hour?: number, minute?: number) {
  if (hour === undefined) return '시간 미입력';
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute ?? 0).padStart(2, '0');
  // 23시부터 자시. (hour + 1) / 2 의 정수부 → 12로 모듈로.
  const idx = Math.floor(((hour + 1) % 24) / 2) % 12;
  const branchName = HOUR_BRANCH_FULL[idx] ?? '';
  return `${hh}:${mm}${branchName ? ` (${branchName})` : ''}`;
}


const AREA_META: Record<
  'love' | 'wealth' | 'career' | 'relationship',
  { label: string; hanja: string; sub: string; color: string }
> = {
  love: {
    label: '연애',
    hanja: '戀',
    sub: '타이밍과 말',
    color: '#ff6b6b',
  },
  wealth: {
    label: '재물',
    hanja: '財',
    sub: '관리와 분산',
    color: '#d99020',
  },
  career: {
    label: '직장',
    hanja: '業',
    sub: '성과와 결단',
    color: '#0f9f7a',
  },
  relationship: {
    label: '관계',
    hanja: '緣',
    sub: '거리와 온도',
    color: '#368ee8',
  },
};

const PILLAR_LABELS = ['시주', '일주', '월주', '연주'] as const;

// 한자 ganzi(庚午) → 2글자 한글(경오). STEM/BRANCH_PROFILES.korean 의 첫 음절 조합.

export function buildPdfModel(
  reading: ReadingRecord,
  report: SajuLifetimeReport,
  reportNo: string,
  targetYear: number,
  // 2026-05-25 — 결제한 LLM 깊은 풀이(본편). 있으면 서술 슬롯을 실제 풀이로 채우고,
  //   없으면(미생성/실패) 기존 결정론 generic 으로 폴백. 숫자/차트는 항상 실제 사주 기반.
  interpretation?: SajuLifetimeAiInterpretation | null
) {
  const sajuData = reading.sajuData;
  const input = reading.input;
  const hourPillar = !input.unknownTime && sajuData.input.hourKnown ? sajuData.pillars.hour : null;
  const dayStem = sajuData.pillars.day.stem;
  const dayBranch = sajuData.pillars.day.branch;
  const dayElement = sajuData.pillars.day.stemElement;

  // 사용자 이름 (subject). grounding 에 표시명이 없으면 '달빛이' 폴백 (목업과 동일 톤).
  const subjectName = resolvePdfSubjectName(
    input,
    reading.metadata as { displayName?: string } | undefined
  );

  // ── 사주팔자 4기둥 ─────────────────────────────
  const pillarSources = [
    hourPillar,
    sajuData.pillars.day,
    sajuData.pillars.month,
    sajuData.pillars.year,
  ];
  const pillars = pillarSources.map((p, i) => {
    if (!p) {
      return {
        label: PILLAR_LABELS[i],
        stem: '?',
        branch: '?',
        color: PDF_COLORS.inkMuted,
        branchColor: PDF_COLORS.inkMuted,
        god: '시간 미입력',
      };
    }
    const isDay = PILLAR_LABELS[i] === '일주';
    return {
      label: PILLAR_LABELS[i],
      stem: p.stem,
      branch: p.branch,
      color: PDF_ELEMENT_COLORS[p.stemElement],
      branchColor: PDF_ELEMENT_COLORS[p.branchElement],
      god: isDay ? '일원' : p.stemTenGod ?? '-',
    };
  });

  // ── 오행 분포 (도넛) ─────────────────────────────
  const elementOrder: Element[] = ['목', '화', '토', '금', '수'];
  const elementsRaw = elementOrder.map((el) => ({
    element: el,
    pct: Math.round(sajuData.fiveElements.byElement[el].percentage),
    color: PDF_ELEMENT_COLORS[el],
    count: sajuData.fiveElements.byElement[el].count,
  }));
  const elements = [...elementsRaw].sort((a, b) => b.pct - a.pct);
  // 도넛 conic-gradient (정렬된 순서대로 누적 각도).
  let acc = 0;
  const segments = elements.map((e) => {
    const start = acc;
    acc += (e.pct / 100) * 360;
    return `${e.color} ${start}deg ${acc}deg`;
  });
  const donutGradient = `conic-gradient(${segments.join(', ')})`;
  const dominantElement = sajuData.fiveElements.dominant;

  // 날짜별 운세 점수를 평생 점수처럼 제시하지 않는다. 이전 저장본의 필드는 계속 읽는다.
  const areaBars: Array<{ label: string; score: number }> = [];

  // ── 십성 분포 (상위 5) ─────────────────────────────
  const tenGods = getTenGodPercentages(sajuData).map((t) => ({
    name: t.name,
    hanja: TEN_GOD_HANJA[t.name],
    pct: t.value,
    color: PDF_TEN_GOD_COLORS[t.name],
    desc: TEN_GOD_DESCRIPTIONS[t.name],
  }));
  const topGod = tenGods[0];
  const secondGod = tenGods[1];

  // ── 신살 보유 판정 ─────────────────────────────
  const detected = detectComprehensiveSinsals({
    dayMaster: dayStem,
    yearBranch: sajuData.pillars.year.branch,
    monthBranch: sajuData.pillars.month.branch,
    dayBranch: sajuData.pillars.day.branch,
    hourBranch: hourPillar?.branch ?? null,
    dayGanziIndex: ganziIndexOf(dayStem, dayBranch),
  });
  const detectedNames = new Set(detected.map((d) => d.name));
  // 홍염살(紅艶煞)은 종합 신살 compute 미포함 → 일간 원칙 결정적 판정 추가.
  const hasHongyeom = HONGYEOM_BRANCH[dayStem]
    ? [
        sajuData.pillars.year.branch,
        sajuData.pillars.month.branch,
        sajuData.pillars.day.branch,
        hourPillar?.branch,
      ].includes(HONGYEOM_BRANCH[dayStem])
    : false;
  const sinsal = SINSAL_DISPLAY.map((s) => ({
    label: s.label,
    hanja: s.hanja,
    meaning: s.meaning,
    color: s.color,
    have:
      s.label === '홍염'
        ? hasHongyeom
        : s.names.some((nm) => detectedNames.has(nm)),
  }));
  const haveSinsalLabels = sinsal.filter((s) => s.have).map((s) => s.label);
  const sinsalPhrase =
    haveSinsalLabels.length >= 2
      ? `${haveSinsalLabels[0]}${josa(haveSinsalLabels[0], '과', '와')} ${haveSinsalLabels[1]}${josa(haveSinsalLabels[1], '이', '가')} 함께 있어`
      : haveSinsalLabels.length === 1
        ? `${haveSinsalLabels[0]}${josa(haveSinsalLabels[0], '이', '가')} 자리해`
        : '특별히 도드라지는 신살 없이 균형 잡힌 구조라';

  const tenGodFallback = topGod
    ? `${topGod.name}(${topGod.pct}%)${josa(topGod.name, '이', '가')} 가장 강해 ${TEN_GOD_DESCRIPTIONS[topGod.name].split('.')[0]}에 힘을 얻는 타입입니다.${
        secondGod ? ` ${secondGod.name}(${secondGod.pct}%)${josa(secondGod.name, '이', '가')} 더해져 추진과 균형을 함께 가져가요.` : ''
      } ${sinsalPhrase} 자기 강점을 꾸준히 다듬으면 흐름이 안정됩니다.`
    : '십성이 고르게 분포해 어느 한쪽으로 치우치지 않는 균형형입니다.';
  // LLM 본편의 '기운의 균형'(strengthBalance)이 있으면 실제 풀이로 대체. 고정 A4 슬롯 보호 위해 3문장 바운드.
  const tenGodSummary = firstSentences(
    pickInterpretationText(interpretation, 'strengthBalance', tenGodFallback),
    3
  );

  // ── 일주 캐릭터 (P3) ─────────────────────────────
  const sixty = reading.grounding.personalizationContext.sixtyGapja;
  const stemProfile = STEM_PROFILES[dayStem];
  const branchProfile = BRANCH_PROFILES[dayBranch];
  const iljuName = `${stemProfile.korean[0]}${branchProfile.korean[0]}일주`;
  const ilju = {
    ganzi: `${dayStem}${dayBranch}`,
    name: iljuName,
    headline:
      sixty?.core ??
      `${stemProfile.korean}${josa(stemProfile.korean, '과', '와')} ${branchProfile.korean}${josa(branchProfile.korean, '이', '가')} 만나 만들어진 일주`,
    stem: {
      hanja: dayStem,
      korean: stemProfile.korean,
      natureLine: stemProfile.natureLine,
      description: stemProfile.description,
      color: PDF_ELEMENT_COLORS[stemProfile.element],
    },
    branch: {
      hanja: dayBranch,
      korean: branchProfile.korean,
      natureLine: branchProfile.natureLine,
      description: branchProfile.description,
      color: PDF_ELEMENT_COLORS[branchProfile.element],
    },
    peers:
      (sixty?.strengths?.length
        ? `같은 ${iljuName}는 ${sixty.strengths.join(', ')}${josa(sixty.strengths.join(', '), '이', '가')} 돋보입니다. `
        : `같은 ${iljuName}는 결정의 자리에서 활약하는 경우가 많습니다. `) +
      (sixty?.actionCue ?? '강점을 살리되 한 가지를 끝까지 마무리하는 습관이 큰 흐름을 만듭니다.').replace(/오늘(?:은|의)?\s*/gu, '').replace('하루가 좋습니다', '방식이 좋습니다'),
  };

  // ── 성격 키워드 (결정적) ─────────────────────────────
  const elementCounts = elementOrder.reduce(
    (acc2, el) => {
      acc2[el] = sajuData.fiveElements.byElement[el].count;
      return acc2;
    },
    {} as Record<Element, number>
  );
  const traits = buildPersonalityTraits(dayElement, elementCounts);

  const timeline = buildLifetimePdfTimeline(reading, report, targetYear);

  // ── 분야별 종합 (P5) ─────────────────────────────
  const { wealthStyle: wealth, careerDirection: career, relationshipPattern: relationship } = report;
  const isMinor = targetYear - input.year < 19;
  const areaCards = [
    { key: 'wealth' as const, strength: wealth.earningStyle, weakness: wealth.spendingMistakes, advice: wealth.operatingStyle },
    { key: 'career' as const, strength: career.fitStructure, weakness: career.endureVsShine, advice: career.recognitionStyle },
    { key: 'love' as const, strength: relationship.distanceStyle, weakness: relationship.expressionStyle, advice: relationship.longevityGuide },
    { key: 'relationship' as const, strength: relationship.summary, weakness: relationship.conflictTriggers, advice: relationship.longevityGuide },
  ].map(({ key, strength, weakness, advice }) => ({
    ...AREA_META[key],
    score: null as number | null,
    strength: firstSentences(strength, 2),
    weakness: firstSentences(weakness, 1),
    advice: firstSentences(advice, 1),
  }));

  // ── 격국 (P6) ─────────────────────────────
  const patternName = sajuData.pattern?.name ?? '균형격';
  const gyeokguk = {
    name: `${patternName}${sajuData.pattern ? `(${gyeokgukHanja(patternName)})` : ''}`,
    desc:
      sajuData.pattern?.rationale?.[0] ??
      `${patternName}은 사주 전체 구조의 기본 골격입니다. 타고난 강점이 어디서 드러나는지 알려줘요.`,
    summary: firstSentences(
      pickInterpretationText(
        interpretation,
        'patternAndYongsin',
        `${patternName}이 ${sinsalPhrase} 사주의 기본 골격을 이룹니다. 강점이 어디서 드러나는지 보여주는 구조예요.`
      ),
      3
    ),
    tip: firstSentences(
      pickInterpretationText(
        interpretation,
        'careerDirection',
        '자기 의견을 단단히 가지되, 전달은 한 박자 부드럽게 하면 흐름이 훨씬 가벼워집니다.'
      ),
      2
    ),
  };

  // ── 마무리 (P8) ─────────────────────────────
  const closing = {
    intro: `${subjectName}님, 여기까지 ${iljuName}의 타고난 성향과 생애 흐름을 함께 살펴봤습니다. ${ELEMENT_INFO_NAME(dominantElement)}이 중심을 잡고 있는 사주에 강점과 보완점이 함께 담겨 있었어요.`,
    year: `${targetYear}년의 연도별 풀이${timeline.cycles.some((cycle) => cycle.isCurrent) ? '와 지금 지나고 있는 대운을 함께' : '를 생애 단계와 함께'} 읽어보세요. 실제 경험과 현재 상황에 맞는 작은 실천 한 가지를 정해두면 보고서를 다시 읽을 때 변화가 더 잘 보입니다.`,
    highlight: firstSentences(
      pickInterpretationText(interpretation, 'lifetimeStrategy', '오늘 한 가지를 끝까지 마무리하는 것'),
      1
    ),
  };

  // ── NEXT 추천 제품 (P8) ─────────────────────────────
  const nextProducts: Array<{
    title: string;
    sub: string;
    price: string;
    priceKey?: PriceKey;
    href: string;
  }> = [
    { title: '궁합 풀이', sub: '가까운 사람과의 흐름', price: '9,900원', priceKey: 'taste_love_question', href: '/compatibility' },
    { title: '좋은 날 캘린더', sub: '이번 달 좋은 날·조심할 날', price: '9,900원', priceKey: 'taste_monthly_calendar', href: '/saju/new?product=monthly-calendar' },
    { title: '오늘의 타로', sub: '세 장으로 보는 오늘', price: '무료', href: '/tarot/daily' },
    { title: '1:1 상담', sub: '간지사주 상담방에서 대화', price: '무료~', href: '/dialogue' },
  ];

  const fullReading = interpretation ?? buildFallbackLifetimeInterpretation(report);
  const questions: Record<string, Array<[string, string]>> = {
    wealthStyle: [
      [isMinor ? '원하는 것과 필요한 것을 어떻게 구분할까요?' : '어떤 방식으로 돈을 벌 때 강점이 드러날까요?', wealth.earningStyle],
      [isMinor ? '내 몫을 나누고 남기는 연습은 어떻게 할까요?' : '돈을 남기기 어렵다면 무엇을 살펴볼까요?', `${wealth.keepingStyle} ${wealth.spendingMistakes}`],
      [isMinor ? '혼자 고를 일과 도움받을 일은 어떻게 나눌까요?' : '안정과 확장 사이에서 무엇을 기준으로 정할까요?', wealth.operatingStyle],
    ],
    careerDirection: [
      [isMinor ? '잘하는 활동과 즐기는 활동은 어떻게 다를까요?' : '잘하는 일과 오래할 수 있는 일은 어떻게 다를까요?', `${career.fitStructure} ${career.endureVsShine}`],
      [isMinor ? '혼자 해보고 도움도 청하려면 무엇이 필요할까요?' : '조직과 독립 중 어떤 조건을 비교해야 할까요?', career.independenceStyle],
      [isMinor ? '배운 것을 어떻게 표현하고 격려할까요?' : '내 실력을 어떻게 보여줘야 할까요?', career.recognitionStyle],
    ],
    relationshipPattern: [
      ['가까워지고 싶은데 왜 표현이 엇갈릴까요?', `${relationship.distanceStyle} ${relationship.expressionStyle}`],
      ['비슷한 갈등이 반복되면 무엇을 살펴볼까요?', relationship.conflictTriggers],
      ['오래 이어갈 관계에서 어떤 기준이 필요할까요?', relationship.longevityGuide],
    ],
  };
  const sections: PdfNarrativeSection[] = DEEP_SECTION_LABELS.flatMap(({ key, label: defaultLabel }) => {
    const label = isMinor && questions[key] ? report[key as 'wealthStyle' | 'careerDirection' | 'relationshipPattern'].headline : defaultLabel;
    const text = (fullReading.sections as Record<string, string>)[key]?.trim() ?? '';
    if (!questions[key]) return text ? [{ label, text, chapter: label }] : [];
    const answers = questions[key].map(([question, answer]) => ({ label: question, text: answer, chapter: label }));
    // 정형 폴백과 정확히 같은 문장은 이미 질문의 답에 담겼다. 고유한 AI 해설은 모두 유지한다.
    const sentences = (value: string) => value.split(/(?<=[.!?。])\s+/).map((s) => s.trim()).filter(Boolean);
    const present = new Set(answers.flatMap((answer) => sentences(answer.text)));
    const extra = sentences(text).filter((sentence) => !present.has(sentence)).join(' ');
    return extra ? [...answers, { label: '종합 해설', text: extra, chapter: label }] : answers;
  });
  const deepReading = {
    opening: fullReading.opening?.trim() ?? '',
    sections,
    rememberRules: (fullReading.rememberRules ?? []).filter((r) => Boolean(r && r.trim())),
  };

  return {
    readingEdition: 'questions-v1' as const,
    reportNo,
    targetYear,
    subjectName,
    subjectTitle: `${subjectName}님의 깊은 사주풀이`,
    birth: {
      dateLabel: `${input.year}.${String(input.month).padStart(2, '0')}.${String(input.day).padStart(2, '0')} (양력)`,
      timeLabel: formatBirthTime(input.unknownTime ? undefined : input.hour, input.minute),
      genderLabel: GENDER_LABEL(input.gender),
    },
    pillars,
    oneLine: interpretation?.oneLineSummary?.trim() || report.cover.oneLineSummary,
    elements,
    donutGradient,
    dominantElement,
    areaBars,
    fieldNotes: [
      { label: '돈', text: '어떤 방식으로 벌고, 무엇을 기준으로 남길까요?' },
      { label: '일', text: '잘하는 일과 오래할 수 있는 일은 어떻게 다를까요?' },
      { label: '관계', text: '마음과 표현이 엇갈릴 때 무엇을 살펴볼까요?' },
    ],
    tenGods,
    tenGodSummary,
    sinsal,
    ilju,
    traits,
    areaCards,
    gyeokguk,
    closing,
    nextProducts,
    deepReading,
    timeline,
  };
}

// 격국명 → 한자 (흔한 격 일부만; 미상이면 빈 문자열).
function gyeokgukHanja(name: string): string {
  const map: Record<string, string> = {
    상관격: '傷官格',
    식신격: '食神格',
    정관격: '正官格',
    편관격: '偏官格',
    정인격: '正印格',
    편인격: '偏印格',
    정재격: '正財格',
    편재격: '偏財格',
    비견격: '比肩格',
    겁재격: '劫財格',
    건록격: '建祿格',
    양인격: '羊刃格',
  };
  return map[name] ?? '格';
}

// 오행 한국어 표기 ("금 기운" 등) — naming-policy 준수.
function ELEMENT_INFO_NAME(el: Element): string {
  return `${el} 기운`;
}

// 60갑자 인덱스 (甲子=0). 천간 10 / 지지 12 의 최소공배수 60 주기에서 유일 해.
const SINSAL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const SINSAL_BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function ganziIndexOf(stem: Stem, branch: Branch): number {
  const s = SINSAL_STEMS.indexOf(stem);
  const b = SINSAL_BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  return 0;
}

// 홍염살(紅艶煞) — 일간별 해당 지지 (전통 표). 사주 어느 지지든 있으면 보유.
const HONGYEOM_BRANCH: Partial<Record<Stem, Branch>> = {
  甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰',
  己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申',
};

export type PdfReportModel = ReturnType<typeof buildPdfModel>;
