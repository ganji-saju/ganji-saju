import Link from 'next/link';
import type { SajuLifetimeReport } from '@/domain/saju/report';
import type { ReadingRecord } from '@/lib/saju/readings';
import type { SajuDataV1, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { Element, Stem, Branch } from '@/lib/saju/types';
import { detectComprehensiveSinsals } from '@/lib/today-fortune/sinsal-comprehensive';
import {
  computeSajuAreaScores,
  type SajuAreaKey,
} from '@/lib/today-fortune/compute-saju-area-scores';
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
  MONTH_KEYWORDS,
  buildMonthlyScores,
  pickBestMonth,
  monthEnLabel,
} from '@/lib/saju/pdf-report-maps';

// 2026-05-23 사주 리포트 PDF 8페이지 문서 (표현 전용 컴포넌트).
//   실제 인쇄 화면(premium/print)과 /dev 미리보기가 동일 마크업을 공유한다.
//   데이터 갭은 src/lib/saju/pdf-report-maps.ts 의 결정적 매핑으로 채움.

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

/** 발행일 — "2026.05.23" 숫자 포맷. */
function issuedDateLabel() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}.${m}.${d}`;
}

// ── 공통 페이지 조각 ─────────────────────────────────────────────────────────

const FOOTER_COPY = '© 2026 푸꼬컴퍼니 · 간지사주(달빛인생)';

/** P2~P8 상단 running header (REPORT NO · 이름 + 干支). */
function RunningHeader({ reportNo, subjectName }: { reportNo: string; subjectName: string }) {
  return (
    <div className="rp-runhead">
      <span>
        {reportNo} · {subjectName} 사주 리포트
      </span>
      <span className="rp-runhead-mark">干支</span>
    </div>
  );
}

/** 모든 페이지 하단 footer (© + PAGE n / 8). */
function PageFooter({ page }: { page: number }) {
  return (
    <div className="rp-foot">
      <span>{FOOTER_COPY}</span>
      <span className="rp-foot-page">
        PAGE {page} / 8
      </span>
    </div>
  );
}

/** 챕터 헤더 (CHAPTER 0n + 2줄 제목 + 리드). */
function ChapterHead({
  no,
  titleLines,
  lead,
}: {
  no: string;
  titleLines: [string, string];
  lead: string;
}) {
  return (
    <div className="rp-chaphead">
      <div className="rp-eyebrow">CHAPTER {no}</div>
      <h2 className="rp-chaptitle">
        {titleLines[0]}
        <br />
        {titleLines[1]}
      </h2>
      <p className="rp-chaplead">{lead}</p>
    </div>
  );
}

// ── 차트 (순수 CSS/SVG, 차트 라이브러리 없음) ────────────────────────────────

interface ChartPoint {
  value: number; // 0~100
}

/** 대운 8포인트 라인 차트 (값 라벨 + 현재 노드 강조). */
function LineChart({
  points,
  width,
  height,
  showValues,
}: {
  points: Array<ChartPoint & { isCurrent?: boolean }>;
  width: number;
  height: number;
  showValues?: boolean;
}) {
  const padX = 18;
  const padTop = 26;
  const padBottom = 8;
  const n = points.length;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const minV = 40;
  const maxV = 100;
  const x = (i: number) => padX + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) =>
    padTop + innerH - (innerH * (Math.max(minV, Math.min(maxV, v)) - minV)) / (maxV - minV);
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const areaPath = `${linePath} L ${x(n - 1)} ${padTop + innerH} L ${x(0)} ${padTop + innerH} Z`;
  return (
    <svg
      className="rp-svg"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="대운 흐름 그래프"
    >
      <defs>
        <linearGradient id="rpLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(216,27,114,0.18)" />
          <stop offset="100%" stopColor="rgba(216,27,114,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#rpLineFill)" />
      <path d={linePath} fill="none" stroke={PDF_COLORS.pinkStrong} strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          {showValues ? (
            <text
              x={x(i)}
              y={y(p.value) - 10}
              textAnchor="middle"
              fontSize={p.isCurrent ? 12 : 10}
              fontWeight={p.isCurrent ? 800 : 700}
              fill={p.isCurrent ? PDF_COLORS.pink : PDF_COLORS.inkMuted}
            >
              {p.value}
            </text>
          ) : null}
          <circle
            cx={x(i)}
            cy={y(p.value)}
            r={p.isCurrent ? 7 : 4.5}
            fill={p.isCurrent ? PDF_COLORS.pinkStrong : '#fff'}
            stroke={PDF_COLORS.pinkStrong}
            strokeWidth={2}
          />
        </g>
      ))}
    </svg>
  );
}

/** 12개월 라인 차트 (best 월 ★, peak 월 ●). */
function MonthChart({
  scores,
  bestMonth,
  peakMonth,
  width,
  height,
}: {
  scores: Array<{ month: number; score: number }>;
  bestMonth: number;
  peakMonth: number;
  width: number;
  height: number;
}) {
  const padX = 14;
  const padTop = 28;
  const padBottom = 6;
  const n = scores.length;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const minV = 45;
  const maxV = 98;
  const x = (i: number) => padX + (innerW * i) / (n - 1);
  const y = (v: number) =>
    padTop + innerH - (innerH * (Math.max(minV, Math.min(maxV, v)) - minV)) / (maxV - minV);
  const linePath = scores.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s.score)}`).join(' ');
  return (
    <svg
      className="rp-svg"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="12개월 흐름 그래프"
    >
      <path d={linePath} fill="none" stroke="rgba(216,27,114,0.55)" strokeWidth={1.6} />
      {scores.map((s, i) => {
        const isBest = s.month === bestMonth;
        const isPeak = s.month === peakMonth;
        return (
          <g key={s.month}>
            <circle
              cx={x(i)}
              cy={y(s.score)}
              r={isBest ? 3.4 : 2.4}
              fill={isBest ? PDF_COLORS.pink : isPeak ? PDF_COLORS.pinkStrong : 'rgba(216,27,114,0.5)'}
            />
            {isBest ? (
              <text x={x(i)} y={y(s.score) - 8} textAnchor="middle" fontSize={10} fill={PDF_COLORS.pink}>
                ★
              </text>
            ) : isPeak ? (
              <text
                x={x(i)}
                y={y(s.score) - 8}
                textAnchor="middle"
                fontSize={10}
                fill={PDF_COLORS.pinkStrong}
              >
                ●
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ── PDF 데이터 모델 빌더 (모든 8페이지 데이터를 결정적으로 조립) ─────────────────

const AREA_META: Record<
  Exclude<SajuAreaKey, 'condition' | 'overall'>,
  { label: string; hanja: string; sub: string; color: string; strength: string; weakness: string; advice: string }
> = {
  love: {
    label: '연애',
    hanja: '戀',
    sub: '타이밍과 표현',
    color: '#ff6b6b',
    strength: '먼저 마음을 여는 용기',
    weakness: '감정을 다루는 인내',
    advice: '중요한 대화는 오전 시간에. 늦은 밤 결정은 보류하세요.',
  },
  wealth: {
    label: '재물',
    hanja: '財',
    sub: '관리와 분산',
    color: '#d99020',
    strength: '장기 계획 능력',
    weakness: '충동적 지출',
    advice: '큰 한 방보다 새는 작은 지출 점검이 체감 이익으로 이어집니다.',
  },
  career: {
    label: '직장',
    hanja: '業',
    sub: '성과와 결단',
    color: '#0f9f7a',
    strength: '실력으로 인정받음',
    weakness: '협업의 유연성',
    advice: '역할을 먼저 명확히 정리. 회의는 짧게 끊는 습관이 도움이 됩니다.',
  },
  relationship: {
    label: '관계',
    hanja: '緣',
    sub: '거리와 온도',
    color: '#368ee8',
    strength: '필요할 때의 신뢰감',
    weakness: '먼저 다가가는 친화력',
    advice: '결론보다 질문을 먼저. 말의 톤만 조정해도 체감 차이가 큽니다.',
  },
};

const PILLAR_LABELS = ['시주', '일주', '월주', '연주'] as const;

// 한자 ganzi(庚午) → 2글자 한글(경오). STEM/BRANCH_PROFILES.korean 의 첫 음절 조합.
function ganziToKorean(ganzi: string): string {
  const stem = ganzi[0] as Stem | undefined;
  const branch = ganzi[1] as Branch | undefined;
  const stemKo = stem && STEM_PROFILES[stem] ? STEM_PROFILES[stem].korean[0] : '';
  const branchKo = branch && BRANCH_PROFILES[branch] ? BRANCH_PROFILES[branch].korean[0] : '';
  return `${stemKo}${branchKo}`;
}

export function buildPdfModel(
  reading: ReadingRecord,
  report: SajuLifetimeReport,
  reportNo: string,
  targetYear: number
) {
  const sajuData = reading.sajuData;
  const input = reading.input;
  const dayStem = sajuData.pillars.day.stem;
  const dayBranch = sajuData.pillars.day.branch;
  const dayElement = sajuData.pillars.day.stemElement;

  // 사용자 이름 (subject). grounding 에 표시명이 없으면 '달빛이' 폴백 (목업과 동일 톤).
  const subjectName =
    (reading.metadata as { displayName?: string } | undefined)?.displayName?.trim() || '달빛이';

  // ── 사주팔자 4기둥 ─────────────────────────────
  const pillarSources = [
    sajuData.pillars.hour,
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

  // ── 분야별 점수 (운세 페이지와 1:1 일치) ─────────────
  const areaScores = computeSajuAreaScores(input, sajuData);
  const scoreOf = (key: SajuAreaKey) =>
    Math.max(0, Math.min(100, Math.round(areaScores.find((s) => s.key === key)?.score ?? 0)));
  const areaBars = [
    { label: '총운', score: scoreOf('overall') },
    { label: '연애', score: scoreOf('love') },
    { label: '재물', score: scoreOf('wealth') },
    { label: '직장', score: scoreOf('career') },
    { label: '관계', score: scoreOf('relationship') },
  ];

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
    hourBranch: sajuData.pillars.hour?.branch ?? null,
    dayGanziIndex: ganziIndexOf(dayStem, dayBranch),
  });
  const detectedNames = new Set(detected.map((d) => d.name));
  // 홍염살(紅艶煞)은 종합 신살 compute 미포함 → 일간 기준 결정적 판정 추가.
  const hasHongyeom = HONGYEOM_BRANCH[dayStem]
    ? [
        sajuData.pillars.year.branch,
        sajuData.pillars.month.branch,
        sajuData.pillars.day.branch,
        sajuData.pillars.hour?.branch,
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
      ? `${haveSinsalLabels[0]}과 ${haveSinsalLabels[1]}이 함께 있어`
      : haveSinsalLabels.length === 1
        ? `${haveSinsalLabels[0]}이 자리해`
        : '특별히 도드라지는 신살 없이 균형 잡힌 구조라';

  const tenGodSummary = topGod
    ? `${topGod.name}(${topGod.pct}%)이 가장 강해 ${TEN_GOD_DESCRIPTIONS[topGod.name].split('.')[0]}에 힘을 얻는 타입입니다.${
        secondGod ? ` ${secondGod.name}(${secondGod.pct}%)이 더해져 추진과 균형을 함께 가져가요.` : ''
      } ${sinsalPhrase} 학문·문서·관계에서 좋은 흐름이 자주 옵니다.`
    : '십성이 고르게 분포해 어느 한쪽으로 치우치지 않는 균형형입니다.';

  // ── 일주 캐릭터 (P3) ─────────────────────────────
  const sixty = reading.grounding.personalizationContext.sixtyGapja;
  const stemProfile = STEM_PROFILES[dayStem];
  const branchProfile = BRANCH_PROFILES[dayBranch];
  const iljuName = `${stemProfile.korean[0]}${branchProfile.korean[0]}일주`;
  const ilju = {
    ganzi: `${dayStem}${dayBranch}`,
    name: iljuName,
    headline: sixty?.core ?? `${stemProfile.korean}과 ${branchProfile.korean}이 만나 만들어진 일주`,
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
        ? `같은 ${iljuName}는 ${sixty.strengths.join(', ')}이 돋보입니다. `
        : `같은 ${iljuName}는 결정의 자리에서 활약하는 경우가 많습니다. `) +
      (sixty?.actionCue ?? '강점을 살리되 한 가지를 끝까지 마무리하는 습관이 큰 흐름을 만듭니다.'),
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

  // ── 대운 (P1 row + P4 chart/list) ─────────────────────
  const cycles = report.majorLuckTimeline.cycles.slice(0, 8);
  const startAge = (c: { ageLabel: string }) => {
    const m = c.ageLabel.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  };
  const daewoon = cycles.map((c) => ({
    age: startAge(c),
    ganzi: c.ganzi,
    isCurrent: c.isCurrent,
  }));
  // 대운 그래프 점수 — 결정적: phase 별 기준값 (목업 곡선과 유사한 산 모양).
  const PHASE_VALUE: Record<string, number> = {
    성장기: 70,
    표현기: 88,
    기반기: 78,
    결정기: 74,
    준비기: 66,
    전환기: 72,
  };
  const daewoonChart = cycles.map((c) => ({
    value: PHASE_VALUE[c.phase] ?? 72,
    isCurrent: c.isCurrent,
  }));
  const currentCycle = cycles.find((c) => c.isCurrent) ?? cycles[Math.min(3, cycles.length - 1)];
  const currentDaewoon = currentCycle
    ? {
        ganzi: currentCycle.ganzi,
        ganziKo: ganziToKorean(currentCycle.ganzi),
        age: startAge(currentCycle),
        summary: currentCycle.chapterBody?.split('. ')[0]
          ? `${currentCycle.chapterBody.split('. ')[0]}.`
          : currentCycle.summary,
      }
    : null;
  // 대운 phase → 짧은 키워드 + 한 줄 설명 (목업 톤; 긴 summary 대신 사용).
  const PHASE_BRIEF: Record<string, { key: string; desc: string }> = {
    성장기: { key: '배움과 도약', desc: '새 배움과 인맥이 열리는 시기' },
    표현기: { key: '표현과 성과', desc: '실력을 드러내고 평판이 커지는 시기' },
    기반기: { key: '안정과 책임', desc: '가정과 일의 기반을 다지는 시기' },
    결정기: { key: '정리와 결실', desc: '선택과 기준이 또렷해지는 시기' },
    준비기: { key: '준비와 전환', desc: '다음 방향을 조용히 준비하는 시기' },
    전환기: { key: '변화와 적응', desc: '환경이 바뀌며 새로 적응하는 시기' },
  };
  const daewoonPeriods = cycles
    .filter((c) => startAge(c) >= 20 && startAge(c) <= 50)
    .map((c) => ({
      ageLabel: `${startAge(c)}-${startAge(c) + 10}`,
      ganzi: c.ganzi,
      phase: PHASE_BRIEF[c.phase]?.key ?? c.phase,
      desc: PHASE_BRIEF[c.phase]?.desc ?? c.summary,
      isCurrent: c.isCurrent,
    }));

  // ── 분야별 종합 (P5) ─────────────────────────────
  const areaCards = (['love', 'wealth', 'career', 'relationship'] as const).map((key) => ({
    ...AREA_META[key],
    score: scoreOf(key),
  }));

  // ── 격국 (P6) ─────────────────────────────
  const patternName = sajuData.pattern?.name ?? '균형격';
  const gyeokguk = {
    name: `${patternName}${sajuData.pattern ? `(${gyeokgukHanja(patternName)})` : ''}`,
    desc:
      sajuData.pattern?.rationale?.[0] ??
      `${patternName}은 사주 전체 구조의 기본 골격입니다. 타고난 강점이 어디서 드러나는지 알려줘요.`,
    summary: `${patternName}이 ${sinsalPhrase} 표현과 관계, 문서·학문의 영역에서 좋은 흐름이 자주 옵니다. 전반적으로 글·말·콘텐츠처럼 드러내는 일과 잘 맞아요.`,
    tip: `${patternName}의 사람은 권위와 살짝 부딪힐 수 있어요. 자기 의견을 단단히 가지되, 전달은 한 박자 부드럽게 하면 흐름이 훨씬 가벼워집니다.`,
  };

  // ── 12개월 (P7) — 결정적 점수 + 고정 키워드 ───────────
  const monthScores = buildMonthlyScores(sajuData.pillars.day.ganzi);
  const bestMonthRaw = pickBestMonth(monthScores);
  const bestMonth = {
    month: bestMonthRaw.month,
    score: bestMonthRaw.score,
    en: monthEnLabel(bestMonthRaw.month),
  };
  const monthKeywords = MONTH_KEYWORDS;

  // ── 마무리 (P8) ─────────────────────────────
  const closing = {
    intro: `${subjectName}님, 여기까지 ${iljuName}의 여덟 페이지를 함께 살펴봤습니다. ${ELEMENT_INFO_NAME(dominantElement)}이 중심을 잡고 있는 사주에 강점과 보완점이 함께 담겨 있었어요.`,
    year: `올해는 ${bestMonth.month}월의 정점을 가지고 있습니다. 큰 결정은 ${bestMonth.month}월 전후로 검토하시면 가장 안정적이에요.`,
    highlight: '오늘 한 가지를 끝까지 마무리하는 것',
  };

  // ── NEXT 추천 제품 (P8) ─────────────────────────────
  const nextProducts = [
    { title: '궁합 풀이', sub: '가까운 사람과의 흐름', price: '990원', href: '/compatibility' },
    { title: '택일', sub: '중요한 날 직접 고르기', price: '1,900원', href: '/saju/new?product=monthly-calendar' },
    { title: '재회 타로', sub: '관계의 다음 흐름', price: '990원', href: '/tarot/daily' },
    { title: '1:1 상담', sub: '달빛선생과 30분 대화', price: '무료~', href: '/dialogue' },
  ];

  return {
    reportNo,
    targetYear,
    subjectName,
    subjectTitle: report.cover.headline || `${subjectName}님의 사주 풀이`,
    birth: {
      dateLabel: `${input.year}.${String(input.month).padStart(2, '0')}.${String(input.day).padStart(2, '0')} (양력)`,
      timeLabel: formatBirthTime(input.unknownTime ? undefined : input.hour, input.minute),
      genderLabel: GENDER_LABEL(input.gender),
    },
    pillars,
    oneLine: report.cover.oneLineSummary,
    elements,
    donutGradient,
    dominantElement,
    areaBars,
    fieldNotes: [
      { label: '연애', text: AREA_META.love.advice },
      { label: '재물', text: AREA_META.wealth.advice },
      { label: '직장', text: AREA_META.career.advice },
      { label: '관계', text: AREA_META.relationship.advice },
    ],
    daewoon,
    daewoonChart,
    currentDaewoon,
    daewoonPeriods,
    tenGods,
    tenGodSummary,
    sinsal,
    ilju,
    traits,
    areaCards,
    gyeokguk,
    monthScores,
    monthKeywords,
    bestMonth,
    closing,
    nextProducts,
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

/** 8페이지 사주 리포트 문서 (표지 + 챕터 02~08). */
export function ReportDocument({
  data,
  issuedAt,
}: {
  data: PdfReportModel;
  issuedAt: string;
}) {
  return (
            <article className="report-doc" aria-label="사주 리포트 PDF 미리보기">
              {/* ─────────────── PAGE 1 · 표지 / 요약 ─────────────── */}
              <section className="report-page" data-page="1">
                <span className="rp-watermark" aria-hidden="true">干支</span>

                <header className="rp-cover-head">
                  <div className="rp-brand">
                    <span className="rp-logo" aria-hidden="true">干</span>
                    <span className="rp-brand-text">
                      <span className="rp-brand-title">간지사주</span>
                      <span className="rp-brand-sub">달빛인생 · 사주 리포트</span>
                    </span>
                  </div>
                  <div className="rp-cover-meta">
                    <span>
                      REPORT NO. <strong>{data.reportNo}</strong>
                    </span>
                    <br />
                    <span>발행일 {issuedAt} · v1.0</span>
                  </div>
                </header>

                {/* SUBJECT */}
                <div className="rp-subject">
                  <div className="rp-eyebrow">SUBJECT</div>
                  <h1 className="rp-subject-title">{data.subjectTitle}</h1>
                  <div className="rp-subject-info">
                    <span>
                      <strong>생년월일</strong> {data.birth.dateLabel}
                    </span>
                    <span>
                      <strong>시각</strong> {data.birth.timeLabel}
                    </span>
                    <span>
                      <strong>성별</strong> {data.birth.genderLabel}
                    </span>
                  </div>
                </div>

                {/* 四柱八字 */}
                <div className="rp-block">
                  <div className="rp-eyebrow">四柱八字</div>
                  <h3 className="rp-block-title">네 기둥과 여덟 글자</h3>
                  <div className="rp-pillars">
                    {data.pillars.map((p) => (
                      <div key={p.label} className="rp-pillar">
                        <div className="rp-pillar-label">{p.label}</div>
                        <div className="rp-pillar-stem" style={{ color: p.color }}>
                          {p.stem}
                        </div>
                        <div className="rp-pillar-branch" style={{ color: p.branchColor }}>
                          {p.branch}
                        </div>
                        <div className="rp-pillar-god">{p.god}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 한 줄 요약 */}
                <div className="rp-summary">
                  <div className="rp-eyebrow">한 줄 요약</div>
                  <p>{data.oneLine}</p>
                </div>

                {/* 2-col: 五行 균형 | 분야별 흐름 */}
                <div className="rp-twocol">
                  <div className="rp-card">
                    <div className="rp-eyebrow">五行 균형</div>
                    <div className="rp-donut-row">
                      <div className="rp-donut" style={{ background: data.donutGradient }}>
                        <span
                          className="rp-donut-hole"
                          style={{ color: PDF_ELEMENT_COLORS[data.dominantElement] }}
                        >
                          {ELEMENT_HANJA[data.dominantElement]}
                        </span>
                      </div>
                      <ul className="rp-elem-legend">
                        {data.elements.map((e) => (
                          <li key={e.element}>
                            <span className="rp-elem-dot" style={{ background: e.color }} />
                            <span className="rp-elem-name">
                              {e.element}({ELEMENT_HANJA[e.element]})
                            </span>
                            <strong className="rp-elem-pct">
                              {e.pct}
                              <span>%</span>
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rp-card">
                    <div className="rp-eyebrow">분야별 흐름</div>
                    <div className="rp-bars">
                      {data.areaBars.map((bar) => (
                        <div key={bar.label} className="rp-bar-row">
                          <div className="rp-bar-head">
                            <span>{bar.label}</span>
                            <span>{bar.score}</span>
                          </div>
                          <div className="rp-bar-track">
                            <span className="rp-bar-fill" style={{ width: `${bar.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 분야별 풀이 2-col cards */}
                <div className="rp-block">
                  <div className="rp-eyebrow">해석</div>
                  <h3 className="rp-block-title">분야별 풀이</h3>
                  <div className="rp-fld-grid">
                    {data.fieldNotes.map((note) => (
                      <div key={note.label} className="rp-fld-card">
                        <div className="rp-fld-label">{note.label}</div>
                        <p>{note.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 大運 10년 단위 row */}
                <div className="rp-block">
                  <div className="rp-eyebrow">大運 · 10년 단위</div>
                  <div className="rp-daewoon-row">
                    {data.daewoon.map((c) => (
                      <div
                        key={c.age}
                        className={`rp-daewoon-cell${c.isCurrent ? ' is-current' : ''}`}
                      >
                        <div className="rp-daewoon-age">
                          {c.age}
                          <span>세</span>
                        </div>
                        <div className="rp-daewoon-ganzi">{c.ganzi}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-cover-foot">
                  <p>
                    본 리포트는 운세 콘텐츠로 참고용입니다. 의료·법률·투자·위기 판단은 전문
                    기준을 우선하세요.
                    <br />
                    {FOOTER_COPY} · ganjisaju.kr
                  </p>
                  <span className="rp-foot-page">PAGE 1 / 8</span>
                </div>
              </section>

              {/* ─────────────── PAGE 2 · 십성 ─────────────── */}
              <section className="report-page" data-page="2">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="02"
                  titleLines={['십성(十星)으로 보는', '기운의 분포']}
                  lead="십성은 일간(나)을 기준으로 다른 글자들과의 관계를 10가지로 분류한 것입니다. 나를 둘러싼 기운을 보는 가장 직관적인 방법이에요."
                />

                <div className="rp-tengod-list">
                  {data.tenGods.map((t) => (
                    <div key={t.name} className="rp-tengod-row">
                      <span className="rp-tengod-chip" style={{ background: t.color }}>
                        {t.hanja}
                      </span>
                      <div className="rp-tengod-body">
                        <div className="rp-tengod-head">
                          <span className="rp-tengod-name">
                            {t.name} <em>({t.hanja})</em>
                          </span>
                          <strong style={{ color: t.color }}>
                            {t.pct}
                            <span>%</span>
                          </strong>
                        </div>
                        <p>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 신살 */}
                <div className="rp-block">
                  <div className="rp-eyebrow">신살(神煞)</div>
                  <h3 className="rp-block-title">내 사주에 자리잡은 작은 별</h3>
                  <div className="rp-sinsal-grid">
                    {data.sinsal.map((s) => (
                      <div
                        key={s.label}
                        className={`rp-sinsal-cell${s.have ? '' : ' is-absent'}`}
                      >
                        <div className="rp-sinsal-name">{s.label}</div>
                        <div className="rp-sinsal-meaning">{s.have ? s.meaning : '없음'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 종합 해석 */}
                <div className="rp-interp">
                  <div className="rp-eyebrow">종합 해석</div>
                  <p>{data.tenGodSummary}</p>
                </div>

                <PageFooter page={2} />
              </section>

              {/* ─────────────── PAGE 3 · 일주 ─────────────── */}
              <section className="report-page" data-page="3">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="03"
                  titleLines={['일주(日柱)', '당신을 보여주는 두 글자']}
                  lead="일주는 사주에서 ‘나’를 의미합니다. 일간(나의 본질)과 일지(나의 환경)가 만나 만들어진 캐릭터예요."
                />

                <div className="rp-ilju-hero">
                  <span className="rp-ilju-hero-glyph">{data.ilju.ganzi}</span>
                  <div className="rp-ilju-hero-text">
                    <div className="rp-eyebrow rp-on-pink">ILJU · 일주</div>
                    <div className="rp-ilju-hero-name">{data.ilju.name}</div>
                    <p>{data.ilju.headline}</p>
                  </div>
                </div>

                <div className="rp-twocol">
                  <div className="rp-card rp-ilju-card">
                    <div className="rp-eyebrow rp-faint">일간 · 나의 본질</div>
                    <div className="rp-ilju-card-head">
                      <span
                        className="rp-ilju-chip"
                        style={{ background: data.ilju.stem.color }}
                      >
                        {data.ilju.stem.hanja}
                      </span>
                      <div>
                        <div className="rp-ilju-card-name">
                          {data.ilju.stem.korean}({data.ilju.stem.hanja})
                        </div>
                        <div className="rp-ilju-card-nature">{data.ilju.stem.natureLine}</div>
                      </div>
                    </div>
                    <p>{data.ilju.stem.description}</p>
                  </div>

                  <div className="rp-card rp-ilju-card">
                    <div className="rp-eyebrow rp-faint">일지 · 나의 환경</div>
                    <div className="rp-ilju-card-head">
                      <span
                        className="rp-ilju-chip"
                        style={{ background: data.ilju.branch.color }}
                      >
                        {data.ilju.branch.hanja}
                      </span>
                      <div>
                        <div className="rp-ilju-card-name">
                          {data.ilju.branch.korean}({data.ilju.branch.hanja})
                        </div>
                        <div className="rp-ilju-card-nature">{data.ilju.branch.natureLine}</div>
                      </div>
                    </div>
                    <p>{data.ilju.branch.description}</p>
                  </div>
                </div>

                <div className="rp-block">
                  <div className="rp-eyebrow">PERSONALITY · 성격 키워드</div>
                  <div className="rp-trait-grid">
                    {data.traits.map((t) => (
                      <div key={t.label} className="rp-trait-card">
                        <span className="rp-trait-score" style={{ background: t.color }}>
                          {t.score}
                        </span>
                        <div>
                          <div className="rp-trait-label">{t.label}</div>
                          <div className="rp-trait-sub">{t.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-summary">
                  <div className="rp-eyebrow">같은 {data.ilju.name}의 사람들</div>
                  <p>{data.ilju.peers}</p>
                </div>

                <PageFooter page={3} />
              </section>

              {/* ─────────────── PAGE 4 · 대운 ─────────────── */}
              <section className="report-page" data-page="4">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="04"
                  titleLines={['대운(大運)', '10년 단위로 보는 큰 흐름']}
                  lead="태어난 사주는 변하지 않지만, 대운은 10년마다 새로운 환경을 가져옵니다. 인생의 큰 챕터를 미리 그려보세요."
                />

                <div className="rp-chart-card">
                  <LineChart points={data.daewoonChart} width={507} height={220} showValues />
                  <div className="rp-chart-axis">
                    {data.daewoon.map((c) => (
                      <div
                        key={c.age}
                        className={`rp-axis-cell${c.isCurrent ? ' is-current' : ''}`}
                      >
                        <div className="rp-axis-age">
                          {c.age}
                          <span>세</span>
                        </div>
                        <div className="rp-axis-ganzi">{c.ganzi}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {data.currentDaewoon ? (
                  <div className="rp-now-hero">
                    <span className="rp-now-glyph">{data.currentDaewoon.ganzi}</span>
                    <div className="rp-now-text">
                      <div className="rp-eyebrow rp-now-eyebrow">
                        NOW · {data.currentDaewoon.age}세 ~ {data.currentDaewoon.age + 10}세
                      </div>
                      <div className="rp-now-name">{data.currentDaewoon.ganziKo} 대운</div>
                      <p>{data.currentDaewoon.summary}</p>
                    </div>
                  </div>
                ) : null}

                <div className="rp-block">
                  <div className="rp-eyebrow">시기별 요약</div>
                  <div className="rp-period-list">
                    {data.daewoonPeriods.map((row) => (
                      <div
                        key={row.ageLabel}
                        className={`rp-period-row${row.isCurrent ? ' is-current' : ''}`}
                      >
                        <span className="rp-period-age">{row.ageLabel}</span>
                        <span className="rp-period-ganzi">{row.ganzi}</span>
                        <div className="rp-period-body">
                          <div className="rp-period-key">{row.phase}</div>
                          <div className="rp-period-desc">{row.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <PageFooter page={4} />
              </section>

              {/* ─────────────── PAGE 5 · 분야별 종합 ─────────────── */}
              <section className="report-page" data-page="5">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="05"
                  titleLines={['분야별 종합', '네 영역의 깊은 흐름']}
                  lead={`${data.ilju.name}의 강점은 분야마다 다르게 드러납니다. 어느 영역에서 더 무게를 두면 좋을지 짚어봤어요.`}
                />

                <div className="rp-area-grid">
                  {data.areaCards.map((a) => (
                    <div key={a.label} className="rp-area-card">
                      <div className="rp-area-head">
                        <span className="rp-area-icon" style={{ background: a.color }}>
                          {a.hanja}
                        </span>
                        <div className="rp-area-title">
                          <div className="rp-area-name">{a.label}</div>
                          <div className="rp-area-sub">{a.sub}</div>
                        </div>
                        <div className="rp-area-score">
                          <strong style={{ color: a.color }}>{a.score}</strong>
                          <span>/ 100</span>
                        </div>
                      </div>
                      <div className="rp-area-sw">
                        <div>
                          <div className="rp-area-sw-label" style={{ color: '#0f9f7a' }}>
                            강점
                          </div>
                          <div className="rp-area-sw-text">{a.strength}</div>
                        </div>
                        <div>
                          <div className="rp-area-sw-label" style={{ color: a.color }}>
                            약점
                          </div>
                          <div className="rp-area-sw-text">{a.weakness}</div>
                        </div>
                      </div>
                      <div className="rp-area-tip">
                        <div className="rp-area-tip-label" style={{ color: a.color }}>
                          💡 조언
                        </div>
                        <p>{a.advice}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <PageFooter page={5} />
              </section>

              {/* ─────────────── PAGE 6 · 신살·격국 ─────────────── */}
              <section className="report-page" data-page="6">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="06"
                  titleLines={['신살과 격국', '사주에 자리잡은 별']}
                  lead="신살은 사주의 특수한 별들이고, 격국은 전체 구조의 기본 골격입니다. 두 개를 함께 보면 타고난 성향을 더 또렷이 알 수 있어요."
                />

                <div className="rp-gyeokguk-hero">
                  <div className="rp-eyebrow rp-on-pink">GYEOKGUK · 격국</div>
                  <div className="rp-gyeokguk-name">{data.gyeokguk.name}</div>
                  <p>{data.gyeokguk.desc}</p>
                </div>

                <div className="rp-block">
                  <div className="rp-eyebrow">SINSAL · 신살 (사주에 자리한 별)</div>
                  <div className="rp-sinsal-grid rp-sinsal-grid-lg">
                    {data.sinsal.map((s) => (
                      <div
                        key={s.label}
                        className={`rp-sinsal-lg${s.have ? '' : ' is-absent'}`}
                      >
                        <span className="rp-sinsal-hanja" style={{ color: s.color }}>
                          {s.hanja}
                        </span>
                        <div className="rp-sinsal-lg-text">
                          <div className="rp-sinsal-lg-name">
                            {s.label}
                            {s.have ? <em className="rp-have">HAVE</em> : null}
                          </div>
                          <div className="rp-sinsal-lg-meaning">{s.meaning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-interp">
                  <div className="rp-eyebrow">종합 해석</div>
                  <p>{data.gyeokguk.summary}</p>
                </div>
                <div className="rp-tip">
                  <span aria-hidden="true">💡</span>
                  <p>{data.gyeokguk.tip}</p>
                </div>

                <PageFooter page={6} />
              </section>

              {/* ─────────────── PAGE 7 · 12개월 ─────────────── */}
              <section className="report-page" data-page="7">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="07"
                  titleLines={[`${data.targetYear} · 12개월 흐름`, '월별 캘린더']}
                  lead="올해 어느 달이 좋고, 어느 달은 조심해야 할지 미리 확인하세요. 큰 결정은 흐름이 가벼운 달로 미루는 것이 좋아요."
                />

                <div className="rp-chart-card">
                  <MonthChart
                    scores={data.monthScores}
                    bestMonth={data.bestMonth.month}
                    peakMonth={5}
                    width={507}
                    height={150}
                  />
                  <div className="rp-month-axis">
                    {data.monthScores.map((m) => (
                      <div
                        key={m.month}
                        className={`rp-month-acell${m.month === data.bestMonth.month ? ' is-best' : ''}`}
                      >
                        <div className="rp-month-anum">
                          {m.month}
                          <span>월</span>
                        </div>
                        <div className="rp-month-aval">{m.score}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-best-hero">
                  <span className="rp-best-chip">
                    <strong>{data.bestMonth.month}</strong>
                    <span>{data.bestMonth.en}</span>
                  </span>
                  <div className="rp-best-text">
                    <div className="rp-eyebrow rp-on-pink">BEST · 정점의 달</div>
                    <div className="rp-best-name">
                      {data.bestMonth.month}월 ({data.bestMonth.score}점)
                    </div>
                    <p>
                      올해의 큰 결정 — 이직, 이사, 계약, 사업 시작 — 은 {data.bestMonth.month}월
                      전후로 검토하시면 가장 좋아요.
                    </p>
                  </div>
                </div>

                <div className="rp-block">
                  <div className="rp-eyebrow">월별 키워드 요약</div>
                  <div className="rp-monthkey-grid">
                    {data.monthKeywords.map((m) => (
                      <div
                        key={m.month}
                        className={`rp-monthkey-row${m.month === data.bestMonth.month ? ' is-best' : ''}`}
                      >
                        <span className="rp-monthkey-num">
                          {m.month}
                          <span>월</span>
                        </span>
                        <span className="rp-monthkey-key">{m.keyword}</span>
                        <span className="rp-monthkey-desc">{m.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <PageFooter page={7} />
              </section>

              {/* ─────────────── PAGE 8 · 마무리 ─────────────── */}
              <section className="report-page" data-page="8">
                <RunningHeader reportNo={data.reportNo} subjectName={data.subjectName} />
                <ChapterHead
                  no="08"
                  titleLines={['마무리', '그리고 다음 한 걸음']}
                  lead="여기까지 함께해 주셔서 감사합니다. 사주는 절대적 예언이 아니라 흐름의 참고예요. 한 줄만 기억해도 충분합니다."
                />

                <div className="rp-closing">
                  <p>{data.closing.intro}</p>
                  <p>{data.closing.year}</p>
                  <p>
                    마지막으로 한 가지만 더 기억해주세요.{' '}
                    <strong>{data.closing.highlight}</strong>, 그 작은 결정이 큰 흐름을 바꿉니다.
                  </p>
                  <div className="rp-sign">
                    <span className="rp-sign-han">達光</span>
                    <span className="rp-sign-name">달빛선생 드림</span>
                  </div>
                </div>

                <div className="rp-block">
                  <div className="rp-eyebrow">NEXT · 이어볼 풀이</div>
                  <div className="rp-next-grid">
                    {data.nextProducts.map((p) => (
                      <Link key={p.title} href={p.href} className="rp-next-card">
                        <span className="rp-next-arrow" aria-hidden="true">
                          →
                        </span>
                        <div className="rp-next-body">
                          <div className="rp-next-title">{p.title}</div>
                          <div className="rp-next-sub">{p.sub}</div>
                        </div>
                        <span className="rp-next-price">{p.price}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rp-notice">
                  <div className="rp-notice-label">⚠ 안내 사항</div>
                  <p>
                    본 리포트는 운세 콘텐츠로, 삶의 흐름을 참고하기 위한 자료입니다.
                    의료·법률·투자·위기 상황의 판단은 반드시 해당 분야 전문가의 도움을 우선해
                    주세요.
                  </p>
                </div>

                <div className="rp-final-foot">
                  <div className="rp-final-brand">
                    <span className="rp-logo rp-logo-sm" aria-hidden="true">
                      干
                    </span>
                    <span className="rp-final-brand-text">
                      <span className="rp-final-brand-title">간지사주</span>
                      <span className="rp-final-brand-sub">달빛인생 · ganjisaju.kr</span>
                    </span>
                  </div>
                  <div className="rp-final-meta">
                    <span>REPORT NO. {data.reportNo}</span>
                    <br />
                    <span>ISSUED {issuedAt} · v1.0</span>
                  </div>
                </div>

                <PageFooter page={8} />
              </section>
            </article>
  );
}
