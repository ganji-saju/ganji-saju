import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type {
  SajuCurrentLuck,
  SajuLuckDescriptor,
  SajuMajorLuckCycle,
  SajuPillar,
} from '@/domain/saju/engine/saju-data-v1';
import { SajuAiInterpretationPanel } from '@/components/ai/saju-ai-interpretation-panel';
import { ClassicEvidencePanel } from '@/components/classics/classic-evidence-panel';
import { SafetyNotice } from '@/components/common/safety-notice';
import { TrackedLink } from '@/components/common/tracked-link';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { ReportKeepsakeSection } from '@/components/report/report-keepsake-section';
import { ReportOneMinuteSummary } from '@/components/report/report-one-minute-summary';
import FiveElementOrbitChart from '@/components/saju/five-element-orbit-chart';
import { GroundingDecisionTrace } from '@/components/saju/grounding-decision-trace';
import { SajuFactEvidencePanel } from '@/components/saju/saju-fact-evidence-panel';
import { Badge } from '@/components/ui/badge';
import DetailUnlock from '@/components/detail-unlock';
import { DALBIT_TEACHERS, TASTE_PRODUCTS, TRUST_SIGNALS } from '@/content/moonlight';
import { SajuResultViewTracker } from '@/features/saju-detail/saju-result-view-tracker';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { toSlug } from '@/lib/saju/pillars';
import type { Branch, Element, Stem } from '@/lib/saju/types';
import { isReadingId, resolveReading } from '@/lib/saju/readings';
import { buildSajuInterpretationGrounding, buildSajuReport, FOCUS_TOPIC_META } from '@/domain/saju/report';
import type { ReportEvidenceCard, ReportScore, SajuReport } from '@/domain/saju/report';
import { compareBirthInputWithKasi } from '@/domain/saju/validation/kasi-calendar';
import { buildFallbackInterpretation } from '@/server/ai/saju-interpretation';
import {
  getClassicConceptForEvidenceKey,
  getClassicEvidenceBundle,
  type ClassicEvidenceItem,
} from '@/server/classics/evidence';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
import { cn } from '@/lib/utils';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
}

export async function generateMetadata(_: Props): Promise<Metadata> {
  return {
    title: '사주 분석 결과',
    description: '개인 사주 분석 결과 페이지입니다.',
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

function formatBirthSummary(input: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  gender?: 'male' | 'female';
  birthLocation?: { label: string } | null;
  solarTimeMode?: string;
}) {
  const minuteLabel =
    input.hour !== undefined && input.minute !== undefined
      ? ` ${String(input.minute).padStart(2, '0')}분`
      : '';
  const timeLabel = input.hour !== undefined ? `${input.hour}시${minuteLabel} 기준` : '태어난 시간 미입력';
  const genderLabel = input.gender
    ? input.gender === 'male'
      ? '남성'
      : '여성'
    : '성별 미선택';
  const locationLabel = input.birthLocation?.label
    ? `${input.birthLocation.label}${input.solarTimeMode === 'longitude' ? ' 경도 보정' : ''}`
    : '출생 지역 미입력';
  return `${input.year}년 ${input.month}월 ${input.day}일 · ${timeLabel} · ${genderLabel} · ${locationLabel}`;
}

const EVIDENCE_CARD_FULL_WIDTH_THRESHOLD = 320;

function getCompactTextLength(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, '').length;
}

function shouldEvidenceCardUseFullRow(card: ReportEvidenceCard) {
  const textLength = [
    card.title,
    card.body,
    card.plainSummary,
    card.technicalSummary,
    ...card.details,
    ...(card.practicalActions ?? []),
    ...(card.explainers?.map((item) => `${item.term}${item.hanja ?? ''}${item.meaning}`) ?? []),
  ].reduce((total, item) => total + getCompactTextLength(item), 0);

  const supportingItemCount =
    card.details.length + (card.practicalActions?.length ?? 0) + (card.explainers?.length ?? 0);

  return textLength >= EVIDENCE_CARD_FULL_WIDTH_THRESHOLD || supportingItemCount >= 8;
}

function formatCurrentLuckTitle(currentLuck: SajuCurrentLuck | null) {
  if (!currentLuck) return '현재 운 계산 준비 중';

  const parts = [
    currentLuck.currentMajorLuck?.ganzi ? `대운 ${currentLuck.currentMajorLuck.ganzi}` : null,
    currentLuck.saewoon?.ganzi ? `세운 ${currentLuck.saewoon.ganzi}` : null,
    currentLuck.wolwoon?.ganzi ? `월운 ${currentLuck.wolwoon.ganzi}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '현재 운 계산 준비 중';
}

function getTimelineItem(report: SajuReport, label: string) {
  return report.timeline.find((item) => item.label === label) ?? null;
}

function uniqueNonEmpty(items: Array<string | null | undefined>, max = 3) {
  return [...new Set(items.filter((item): item is string => Boolean(item && item.trim().length > 0)))].slice(0, max);
}

function buildKeyThemes(report: SajuReport) {
  return uniqueNonEmpty(report.summaryHighlights, 3);
}

function buildCautionPatterns(report: SajuReport) {
  const cautionCards = report.evidenceCards.filter((card) =>
    ['relations', 'gongmang', 'specialSals'].includes(card.key)
  );

  return uniqueNonEmpty(
    [
      report.cautionAction.description,
      ...cautionCards.map((card) => card.body),
    ],
    3
  );
}

function buildFavorableChoices(report: SajuReport) {
  return uniqueNonEmpty(
    [
      report.primaryAction.description,
      ...report.evidenceCards.flatMap((card) => card.practicalActions ?? []),
    ],
    3
  );
}

const SCORE_CARD_VISUALS: Record<
  ReportScore['key'],
  {
    panel: string;
    caption: string;
    score: string;
    bar: string;
    glow: string;
  }
> = {
  overall: {
    panel: 'border-pink-200 bg-[linear-gradient(145deg,#ffffff,#fff0f7)]',
    caption: 'text-[var(--app-pink-strong)]',
    score: 'text-[var(--app-ink)]',
    bar: 'bg-[var(--app-pink)]',
    glow: 'bg-pink-200/55',
  },
  love: {
    panel: 'border-rose-200 bg-[linear-gradient(145deg,#ffffff,#fff1f2)]',
    caption: 'text-rose-600',
    score: 'text-[var(--app-ink)]',
    bar: 'bg-rose-400',
    glow: 'bg-rose-200/55',
  },
  wealth: {
    panel: 'border-emerald-200 bg-[linear-gradient(145deg,#ffffff,#ecfdf5)]',
    caption: 'text-emerald-700',
    score: 'text-[var(--app-ink)]',
    bar: 'bg-emerald-400',
    glow: 'bg-emerald-200/55',
  },
  career: {
    panel: 'border-sky-200 bg-[linear-gradient(145deg,#ffffff,#eff6ff)]',
    caption: 'text-sky-700',
    score: 'text-[var(--app-ink)]',
    bar: 'bg-sky-400',
    glow: 'bg-sky-200/55',
  },
  relationship: {
    panel: 'border-fuchsia-200 bg-[linear-gradient(145deg,#ffffff,#fdf4ff)]',
    caption: 'text-fuchsia-700',
    score: 'text-[var(--app-ink)]',
    bar: 'bg-fuchsia-400',
    glow: 'bg-fuchsia-200/55',
  },
};

const TEACHER_BY_SLUG = new Map(DALBIT_TEACHERS.map((teacher) => [teacher.slug, teacher]));
const RESULT_TEACHER = TEACHER_BY_SLUG.get('saju-yong') ?? DALBIT_TEACHERS[0];

function buildResultTasteProductHref(productSlug: string, slug: string) {
  const encodedSlug = encodeURIComponent(slug);

  switch (productSlug) {
    case 'today-detail':
      return '/today-fortune?concern=general&product=today-detail&from=saju-result';
    case 'love-question':
      return '/membership/checkout?product=love-question&from=saju-result';
    case 'money-pattern':
    case 'work-flow':
      return `/membership/checkout?product=${productSlug}&slug=${encodedSlug}&from=saju-result`;
    default:
      return '/pricing';
  }
}

function formatCurrentLuckBody(currentLuck: SajuCurrentLuck | null, report?: SajuReport) {
  if (!currentLuck) {
    return '현재 대운과 세운, 월운을 아직 계산하지 못했습니다. 운 계산이 연결되면 이 자리에 현재 시점 해석이 표시됩니다.';
  }

  const enriched = report
    ? [
        getTimelineItem(report, '대운 흐름')?.body,
        getTimelineItem(report, '이번 달')?.body,
      ].filter(Boolean)
    : [];

  if (enriched.length > 0) return enriched.join(' ');

  const notes = [
    ...(currentLuck.currentMajorLuck?.notes ?? []).slice(0, 2),
    ...(currentLuck.saewoon?.notes ?? []).slice(0, 1),
    ...(currentLuck.wolwoon?.notes ?? []).slice(0, 1),
  ];

  return notes.length > 0
    ? notes.join(' ')
    : '현재 운 정보는 계산되었지만 설명 문장은 아직 비어 있습니다.';
}

const STEM_READINGS: Record<Stem, string> = {
  '甲': '갑',
  '乙': '을',
  '丙': '병',
  '丁': '정',
  '戊': '무',
  '己': '기',
  '庚': '경',
  '辛': '신',
  '壬': '임',
  '癸': '계',
};

const BRANCH_READINGS: Record<Branch, string> = {
  '子': '자',
  '丑': '축',
  '寅': '인',
  '卯': '묘',
  '辰': '진',
  '巳': '사',
  '午': '오',
  '未': '미',
  '申': '신',
  '酉': '유',
  '戌': '술',
  '亥': '해',
};

function formatStemHint(pillar: SajuPillar) {
  return `${pillar.stem} · ${STEM_READINGS[pillar.stem]} · ${pillar.yinYang}${ELEMENT_INFO[pillar.stemElement].name.split(' ')[0]}`;
}

function formatBranchHint(pillar: SajuPillar) {
  return `${pillar.branch} · ${BRANCH_READINGS[pillar.branch]} · ${ELEMENT_INFO[pillar.branchElement].name.split(' ')[0]}`;
}

function formatHiddenStemHint(stem: Stem, element: Element) {
  return `${stem} · ${STEM_READINGS[stem]} · ${ELEMENT_INFO[element].name.split(' ')[0]}`;
}

function HanjaHint({
  character,
  hint,
  color,
  className,
}: {
  character: string;
  hint: string;
  color: string;
  className: string;
}) {
  return (
    <span
      className="group relative inline-flex cursor-help items-center justify-center outline-none"
      tabIndex={0}
      title={hint}
      aria-label={hint}
    >
      <span className={className} style={{ color }}>
        {character}
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--app-line)] bg-[rgba(8,10,18,0.96)] px-3 py-1 text-[11px] font-medium text-[var(--app-ivory)] opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.3)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {hint}
      </span>
    </span>
  );
}

function formatLuckDescriptorTitle(label: string, descriptor: SajuLuckDescriptor | null) {
  if (!descriptor) return `${label} 계산 준비 중`;

  const dateLabel =
    descriptor.month !== null
      ? `${descriptor.year}년 ${descriptor.month}월`
      : descriptor.year !== null
        ? `${descriptor.year}년`
        : null;

  return [descriptor.ganzi, dateLabel].filter(Boolean).join(' · ');
}

function formatLuckDescriptorBody(descriptor: SajuLuckDescriptor | null) {
  if (!descriptor) return '운 정보가 아직 비어 있습니다.';

  return descriptor.notes.length > 0
    ? descriptor.notes.join(' ')
    : '기본 간지 계산은 완료되었고 설명 문장은 아직 비어 있습니다.';
}

function formatMajorLuckWindow(cycle: SajuMajorLuckCycle) {
  if (cycle.startAge === null || cycle.endAge === null) return '시작 나이 계산 준비 중';
  return `${cycle.startAge}세 ~ ${cycle.endAge}세`;
}

function formatHiddenStems(pillar: SajuPillar) {
  if (pillar.hiddenStems.length === 0) return null;
  return pillar.hiddenStems.map((item) => item.stem).join(' · ');
}

function getPrimaryClassicEvidenceConcept(report: ReturnType<typeof buildSajuReport>) {
  const primaryEvidence =
    report.evidenceCards.find((card) => card.key === 'yongsin') ?? report.evidenceCards[0];

  switch (primaryEvidence?.key) {
    case 'yongsin':
      return '용신';
    case 'pattern':
      return '격국';
    case 'strength':
      return '강약';
    case 'relations':
      return '합충';
    case 'gongmang':
      return '공망';
    case 'specialSals':
      return '신살';
    default:
      return '용신';
  }
}

function CardLinkedClassicEvidence({
  items,
}: {
  items: ClassicEvidenceItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="border-t border-[var(--app-line)] pt-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-soft)]">
        연결된 고전 문단
      </div>
      <div className="mt-3 grid gap-3">
        {items.slice(0, 1).map((item) => (
          <div
            key={item.passage.id}
            className="rounded-2xl border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--app-copy-soft)]">
              <span className="rounded-full border border-[var(--app-gold)]/22 bg-[var(--app-gold)]/10 px-2.5 py-1 text-[var(--app-gold-text)]">
                {item.work.titleKo}
              </span>
              <span>{item.section.path}</span>
              <span>{item.provenance.sourceRef}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--app-ivory)]">
              {item.passage.commentaryKo ??
                item.passage.literalKo ??
                `${item.work.titleKo} ${item.section.titleKo} 문단을 현재 ${item.provenance.verificationStatus === 'reviewed' ? '검수된' : '검수 전'} 고전 참고자료로 연결했습니다.`}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-[var(--app-gold-text)]">
                원문 확인
              </summary>
              <blockquote
                lang="zh-Hant"
                className="mt-3 break-words rounded-2xl border border-[var(--app-gold)]/14 bg-[rgba(8,10,18,0.32)] px-3 py-3 font-[var(--font-heading)] text-sm leading-7 text-[var(--app-gold-text)]"
              >
                {item.passage.originalZh}
              </blockquote>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

function canUseSubscriptionForPremiumReport(subscription: Awaited<ReturnType<typeof getManagedSubscription>>) {
  return (
    subscription?.status === 'active' &&
    (subscription.plan === 'plus_monthly' || subscription.plan === 'premium_monthly')
  );
}

async function getPremiumReportAccessLabel(slug: string, readingKey: string) {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [entitlement, subscription] = await Promise.all([
    getLifetimeReportEntitlement(user.id, readingKey, [slug]),
    getManagedSubscription(user.id),
  ]);

  if (entitlement) return '평생 소장 권한';
  if (canUseSubscriptionForPremiumReport(subscription)) {
    return subscription?.plan === 'premium_monthly' ? '프리미엄 이용권' : '라이트 이용권';
  }

  return null;
}

export default async function SajuResultPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { topic } = await searchParams;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { input, sajuData } = reading;
  const readingKey = toSlug(input);
  const report = buildSajuReport(input, sajuData, topic);
  const grounding = reading.grounding ?? buildSajuInterpretationGrounding(input, sajuData, report);

  const pillars = [
    { label: '년주', pillar: sajuData.pillars.year },
    { label: '월주', pillar: sajuData.pillars.month },
    { label: '일주', pillar: sajuData.pillars.day },
    { label: '시주', pillar: sajuData.pillars.hour },
  ];
  const majorLuckPreview = sajuData.majorLuck?.slice(0, 6) ?? [];
  const currentMajorIndex = sajuData.currentLuck?.currentMajorLuck?.index ?? null;
  const classicEvidenceConcept = getPrimaryClassicEvidenceConcept(report);
  const classicEvidenceBundle = await getClassicEvidenceBundle({
    concepts: report.evidenceCards.map((card) => getClassicConceptForEvidenceKey(card.key)),
    limit: 1,
  });
  const primaryClassicItems = classicEvidenceBundle[classicEvidenceConcept]?.items ?? [];
  const premiumAccessLabel = await getPremiumReportAccessLabel(slug, readingKey);
  const premiumHref = `/saju/${encodeURIComponent(slug)}/premium`;
  let kasiComparison = reading.kasiComparison;
  if (!kasiComparison && process.env.KASI_SERVICE_KEY) {
    try {
      kasiComparison = await compareBirthInputWithKasi(input, process.env.KASI_SERVICE_KEY);
    } catch {
      kasiComparison = null;
    }
  }
  const currentMajorFlow = getTimelineItem(report, '대운 흐름');
  const keyThemes = buildKeyThemes(report);
  const cautionPatterns = buildCautionPatterns(report);
  const favorableChoices = buildFavorableChoices(report);
  const isTimeUnknown = input.unknownTime === true || input.hour === undefined;
  const resultTasteProducts = TASTE_PRODUCTS.map((product) => ({
    ...product,
    href: buildResultTasteProductHref(product.slug, slug),
    teacher: TEACHER_BY_SLUG.get(product.teacherSlug),
  }));

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="saju-result-page space-y-5 sm:space-y-6">
        <SajuResultViewTracker slug={slug} />

        <div className="space-y-5 sm:space-y-6">
        <SajuScreenNav slug={slug} current="result" />

        <section className="dalbit-result-first-card">
          <div className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr] lg:items-start">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="dalbit-teacher-chip">
                  <span>{RESULT_TEACHER.zodiac}</span>
                  {RESULT_TEACHER.teacherName}
                </span>
                <span className="dalbit-mini-badge">{report.focusBadge}</span>
                <span className="dalbit-mini-badge">내 풀이 결과</span>
              </div>

              <div>
                <h1 className="dalbit-result-title">{report.headline}</h1>
                <p className="dalbit-result-lead">{report.dayMasterSummary}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--app-copy-muted)]">
                  {formatBirthSummary(input)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="dalbit-result-action-card">
                  <div className="app-caption text-[var(--app-jade)]">오늘 해볼 것</div>
                  <h2>{report.primaryAction.title}</h2>
                  <p>{report.primaryAction.description}</p>
                </div>
                <div className="dalbit-result-action-card dalbit-result-action-card-caution">
                  <div className="app-caption text-[var(--app-coral)]">오늘 조심할 것</div>
                  <h2>{report.cautionAction.title}</h2>
                  <p>{report.cautionAction.description}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="dalbit-section-heading mb-0">
                <h2 className="text-2xl">더 궁금한 부분만 이어보세요</h2>
                <p>
                  전체를 길게 읽기 전, 지금 마음에 걸리는 질문만 550원/990원 소액 풀이로 연결합니다.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {resultTasteProducts.map((product) => (
                  <Link key={product.slug} href={product.href} className="dalbit-price-card">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-[var(--app-pink-strong)]">
                        {product.price}
                      </span>
                      {product.teacher ? (
                        <span className="dalbit-product-teacher">
                          <span>{product.teacher.zodiac}</span>
                          {product.teacher.teacherName}
                        </span>
                      ) : null}
                    </div>
                    <h3>{product.title}</h3>
                    <p>{product.result}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SectionSurface surface="lunar" size="lg" className="moon-result-hero">
          <div className="grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-start">
            <div className="self-start">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]">
                  {RESULT_TEACHER.teacherName}
                </Badge>
                <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                  계산 기준 요약
                </Badge>
              </div>
              <p className="app-caption mt-5">{formatBirthSummary(input)}</p>
              <SectionHeader
                className="mt-3"
                title={report.headline}
                titleClassName="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
                description={report.dayMasterSummary}
                descriptionClassName="max-w-2xl sm:text-base"
              />
            </div>

            <div className="grid self-start gap-4 lg:border-l lg:border-[var(--app-line)] lg:pl-6">
              <div className="moon-lunar-panel p-5">
                <div className="app-caption">사주 원국</div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="font-[var(--font-heading)] text-2xl font-semibold text-[var(--app-gold-text)]">
                      {sajuData.dayMaster.stem} 일간
                    </div>
                    <p className="mt-1 text-sm text-[var(--app-copy-muted)]">
                      네 기둥 중 일주를 중심으로 오늘의 해석을 엮습니다.
                    </p>
                  </div>
                  <Badge className="border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
                    원국
                  </Badge>
                </div>
                <div className="moon-saju-grid mt-5">
                  {pillars.map(({ label, pillar }) => (
                    <div key={label} className="moon-saju-pillar" data-day={label === '일주'}>
                      <div className="text-xs text-[var(--app-copy-soft)]">{label.replace('주', '')}</div>
                      {pillar ? (
                        <>
                          <div className="mt-2">
                            <HanjaHint
                              character={pillar.stem}
                              hint={formatStemHint(pillar)}
                              color={ELEMENT_INFO[pillar.stemElement].color}
                              className="font-[var(--font-heading)] text-[2rem] font-semibold leading-none sm:text-[2.25rem]"
                            />
                          </div>
                          <div className="mt-1">
                            <HanjaHint
                              character={pillar.branch}
                              hint={formatBranchHint(pillar)}
                              color={ELEMENT_INFO[pillar.branchElement].color}
                              className="font-[var(--font-heading)] text-[1.8rem] font-semibold leading-none sm:text-[2rem]"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-5 text-xs text-[var(--app-copy-soft)]">시간 미입력</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 p-5">
                <div className="text-sm text-[var(--app-gold-soft)]">날짜 포인트</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">좋은 날짜</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {report.luckyDates.map((date) => (
                        <span key={date} className="rounded-full border border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 px-3 py-1 text-sm text-[var(--app-jade)]">
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">조심할 날짜</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {report.cautionDates.map((date) => (
                        <span key={date} className="rounded-full border border-[var(--app-coral)]/25 bg-[var(--app-coral)]/10 px-3 py-1 text-sm text-[var(--app-coral)]">
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionSurface>

        <section id="result-summary" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="요약"
            title="먼저 핵심과 오늘의 선택을 봅니다"
            titleClassName="text-2xl sm:text-3xl"
            description="결과를 처음 열었을 때 꼭 봐야 하는 한 줄, 조심할 패턴, 이어볼 행동만 먼저 모았습니다."
          />
            <section className="space-y-4">
              <ReportOneMinuteSummary
                headline={report.headline}
                keyThemes={keyThemes}
                cautionPatterns={cautionPatterns}
                favorableChoices={favorableChoices}
                isTimeUnknown={isTimeUnknown}
              />

              <GroundingDecisionTrace grounding={grounding} kasiComparison={kasiComparison} />

              <SectionSurface surface="panel">
            <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
              <div>
                <SectionHeader
                  eyebrow="다음 단계"
                  title="핵심을 확인하셨다면, 필요한 깊이만 바로 이어보실 수 있습니다"
                  titleClassName="text-3xl"
                  description="긴 사주풀이는 더 오래 볼 내용으로, 대화는 지금 막 확인한 결과를 이어 묻는 흐름으로 연결됩니다. PDF 저장은 보관형 리포트에서 바로 이어집니다."
                />
                <ActionCluster className="mt-6">
                  <TrackedLink
                    href={`/saju/${slug}/premium`}
                    eventName="report_deep_report_click"
                    eventParams={{ slug, from: 'result_next_actions' }}
                    className="moon-cta-primary"
                  >
                    긴 사주풀이 보기
                  </TrackedLink>
                  <TrackedLink
                    href={`/saju/${slug}/premium/print`}
                    eventName="report_pdf_click"
                    eventParams={{ slug, from: 'result_next_actions', status: 'print_page' }}
                    className="moon-action-muted"
                  >
                    PDF로 소장하기
                  </TrackedLink>
                  <TrackedLink
                    href="/dialogue"
                    eventName="report_dialogue_continue_click"
                    eventParams={{ slug, from: 'result_next_actions' }}
                    className="moon-action-secondary"
                  >
                    달빛인생에 이어서 묻기
                  </TrackedLink>
                </ActionCluster>
              </div>

              <ProductGrid columns={2}>
                <FeatureCard
                  surface="soft"
                  eyebrow="긴 사주풀이"
                  title="더 오래 볼 내용"
                  titleClassName="text-2xl"
                  description="원국, 격국, 용신, 대운과 주제별 해석을 한 권의 구조로 더 길게 확인합니다."
                />
                <FeatureCard
                  surface="soft"
                  eyebrow="PDF 소장"
                  title="다시 읽을 기준 남기기"
                  titleClassName="text-2xl"
                  description="보관형 사주 리포트를 열면 표지, 요약, 판단 단서, 본문을 인쇄용 화면에서 PDF로 저장할 수 있습니다."
                />
                <FeatureCard
                  surface="soft"
                  eyebrow="대화 연결"
                  title="지금 결과에서 바로 질문"
                  titleClassName="text-2xl"
                  description="방금 읽은 기준 위에서, 생활 질문이나 선택 고민을 이어서 묻는 흐름으로 연결됩니다."
                />
                <FeatureCard
                  surface="soft"
                  eyebrow="올해 전략"
                  title="올해 흐름까지 확장"
                  titleClassName="text-2xl"
                  description="월별 리듬, 기회 달, 조심할 달은 올해 전략서에서 같은 명리 기준 위로 이어집니다."
                  footer={
                    <Link
                      href={`/saju/${slug}/premium#yearly-report`}
                      className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      올해 전략서 바로 보기
                    </Link>
                  }
                />
              </ProductGrid>
            </div>
              </SectionSurface>
            </section>
        </section>

        <section id="result-topics" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="분야"
            title="분야별 흐름과 올해 전략서"
            titleClassName="text-2xl sm:text-3xl"
            description="오늘, 연애, 재물, 직장, 관계를 고르고 올해 전략으로 이어지는 화면입니다."
          />
            <section className="app-panel p-6 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="app-caption">분야별 흐름</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ivory)]">
                오늘, 연애, 재물, 직장, 관계를 한 흐름 안에서 이어 봅니다.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--app-copy-muted)]">
              위에서는 오늘의 큰 결을 보고, 아래에서는 분야를 고르면 실행 포인트와 주의 포인트가 바로 바뀝니다.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {report.scores.map((score) => {
              const isFocusedScore = report.focusScoreKey === score.key;
              const visual = SCORE_CARD_VISUALS[score.key];
              const topicKey = score.key === 'overall' ? 'today' : score.key;

              return (
                <Link
                  key={score.key}
                  href={`/saju/${slug}?topic=${topicKey}`}
                  scroll={false}
                  aria-current={isFocusedScore ? 'page' : undefined}
                  data-selected={isFocusedScore ? 'true' : 'false'}
                  className={cn(
                    'moon-topic-score-card group relative overflow-hidden rounded-[24px] border p-5 shadow-[0_18px_48px_rgba(216,27,114,0.08)]',
                    visual.panel,
                    isFocusedScore ? 'ring-1 ring-[var(--app-gold)]/45' : ''
                  )}
                >
                  <div className={cn('pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-3xl', visual.glow)} />
                  <div className="relative">
                    <div className={cn('text-xs font-semibold uppercase tracking-[0.2em]', visual.caption)}>
                      {score.label}
                    </div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className={cn('text-4xl font-semibold', visual.score)}>{score.score}</span>
                      <span className="pb-1 text-sm text-[var(--app-copy-soft)]">/ 100</span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/10">
                      <div className={cn('h-full rounded-full', visual.bar)} style={{ width: `${score.score}%` }} />
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[var(--app-copy)]">{score.summary}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 text-xs">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 transition-colors',
                          isFocusedScore
                            ? 'border-[var(--app-gold)]/35 bg-[var(--app-gold)]/14 text-[var(--app-gold-text)]'
                            : 'border-[var(--app-line)] bg-white/70 text-[var(--app-copy-soft)] group-hover:border-[var(--app-pink-line)] group-hover:text-[var(--app-ink)]'
                        )}
                      >
                        {isFocusedScore ? '현재 해석' : '눌러서 보기'}
                      </span>
                      <span
                        className={cn(
                          'text-sm transition-all duration-200',
                          isFocusedScore
                            ? 'translate-x-0 text-[var(--app-gold-text)]'
                            : 'text-[var(--app-copy-soft)] group-hover:translate-x-1 group-hover:text-[var(--app-ink)]'
                        )}
                      >
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="moon-lunar-panel mt-4 overflow-hidden rounded-[24px] border-[var(--app-gold)]/22">
            <div className="grid gap-0 lg:grid-cols-2">
              <div className="p-4 sm:p-5">
                <div className="app-caption">{report.focusLabel} 실행 포인트</div>
                <div className="mt-2 text-lg font-semibold leading-7 text-[var(--app-ivory)]">
                  {report.primaryAction.title}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{report.primaryAction.description}</p>
              </div>
              <div className="border-t border-[var(--app-line)] p-4 sm:p-5 lg:border-l lg:border-t-0">
                <div className="app-caption">{report.focusLabel} 주의 포인트</div>
                <div className="mt-2 text-lg font-semibold leading-7 text-[var(--app-ivory)]">
                  {report.cautionAction.title}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{report.cautionAction.description}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="moon-lunar-panel p-6 sm:p-7">
          <div className="app-starfield" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">올해 전략서 진입</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ivory)]">
                2026 올해 전략서로 들어가면 월별 판단 기준까지 길게 읽을 수 있습니다.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">
                총론, 상반기·하반기, 일·재물·연애·관계·건강·이동 흐름, 12개월 요약까지 한 번에 정리한
                올해 전략서를 보관형 사주 리포트 안에서 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/saju/${slug}/premium#yearly-report`}
                className="rounded-full border border-[var(--app-gold)]/35 bg-[var(--app-gold)]/14 px-5 py-3 text-sm font-semibold text-[var(--app-gold-text)] transition-colors hover:bg-[var(--app-gold)]/20"
              >
                2026 올해 전략서 보기
              </Link>
              <span className="text-xs text-[var(--app-copy-soft)]">
                보관형 사주 리포트 안의 올해 전략서로 이어집니다
              </span>
            </div>
          </div>
        </section>

        </section>

        <section id="result-flow" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="운 흐름"
            title="오늘과 이번 달, 대운 흐름"
            titleClassName="text-2xl sm:text-3xl"
            description="현재 시점에서 이어지는 시간 흐름을 한 화면으로 묶었습니다."
          />
            <section className="grid gap-4 lg:grid-cols-3">
          {report.timeline.map((item) => (
            <article key={item.label} className="app-panel p-6">
              <div className="app-caption">{item.label}</div>
              <h2 className="mt-3 text-2xl font-semibold leading-8 text-[var(--app-ivory)]">{item.headline}</h2>
              <p className="app-body-copy mt-4 text-sm">{item.body}</p>
              {item.points && item.points.length > 0 ? (
                <div className="mt-5 grid gap-2">
                  {item.points.map((point) => (
                    <div
                      key={`${item.label}-${point}`}
                      className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm leading-7 text-[var(--app-copy)]"
                    >
                      {point}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>

        </section>

        <section id="result-evidence" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="단서와 보관"
            title="왜 이렇게 보았는지와 다시 읽을 가치"
            titleClassName="text-2xl sm:text-3xl"
            description="풀이의 바탕이 된 단서와 PDF·보관함 가치를 별도 화면으로 모았습니다."
          />
            <SajuFactEvidencePanel
              grounding={grounding}
              kasiComparison={kasiComparison}
              primaryClassicItems={primaryClassicItems}
              showDecisionTrace={false}
            />

            <ReportKeepsakeSection pdfHref={`/saju/${slug}/premium/print`} />

            <SectionSurface surface="panel">
              <SectionHeader
                eyebrow="신뢰 장치"
                title="결과는 다시 확인할 수 있는 기준으로 남깁니다"
                titleClassName="text-3xl"
                description="사주풀이가 한 번 읽고 끝나지 않도록 저장, 재열람, 판단 단서, 시간·출생지 기준, 안전한 표현을 함께 노출합니다."
              />
              <ProductGrid columns={3} className="mt-6">
                {TRUST_SIGNALS.map((signal) => (
                  <FeatureCard
                    key={signal.title}
                    surface="soft"
                    title={signal.title}
                    titleClassName="text-xl"
                    description={signal.body}
                  />
                ))}
              </ProductGrid>
            </SectionSurface>
        </section>

        <section id="result-detail" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="기본 계산과 선택 심화"
            title="사주 명반은 먼저 보여드리고, 깊이보기는 선택으로 둡니다"
            titleClassName="text-2xl sm:text-3xl"
            description="명반, 오행, 현재 운 흐름은 기본 계산 결과로 먼저 확인하고, 재물·연애·직업·건강의 분야별 풀이만 필요할 때 1코인으로 펼칩니다."
          />
            <div>
          <DetailUnlock
            slug={slug}
            premiumAccessLabel={premiumAccessLabel}
            premiumHref={premiumHref}
            referenceChildren={
              <section className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="app-caption">왜 이렇게 읽는지</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ivory)]">
                      처음에는 쉬운 풀이만 보고, 필요할 때만 자세한 단서를 펼쳐보세요.
                    </h2>
                  </div>
                  <p className="max-w-xl text-sm leading-7 text-[var(--app-copy-muted)]">
                    강약, 격국, 용신과 합충·공망·신살은 해석의 배경입니다. 카드마다 먼저 쉬운 설명을 보여드리고,
                    자세한 계산과 용어는 아래에 접어두었습니다.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {report.evidenceCards.map((card) => (
                    <article
                      key={card.key}
                      className={cn(
                        'moon-orbit-card p-5',
                        shouldEvidenceCardUseFullRow(card) ? 'md:col-span-2' : undefined
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="app-caption">{card.label}</div>
                        <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px] text-[var(--app-copy-soft)]">
                          {card.confidence}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ivory)]">{card.title}</h3>
                      <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">
                        {card.body}
                      </p>

                      <details className="mt-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3">
                        <summary className="cursor-pointer list-none text-sm font-medium text-[var(--app-gold-text)]">
                          자세한 단서 보기
                        </summary>

                        <div className="mt-4 space-y-4">
                          {card.plainSummary || card.technicalSummary ? (
                            <div className="rounded-2xl border border-[var(--app-line)] bg-[rgba(8,10,18,0.32)] px-3 py-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-gold-soft)]">
                                기준 메모
                              </div>
                              <div className="mt-2 space-y-2">
                                {card.plainSummary ? (
                                  <p className="text-sm leading-7 text-[var(--app-copy)]">{card.plainSummary}</p>
                                ) : null}
                                {card.technicalSummary ? (
                                  <p className="text-sm leading-7 text-[var(--app-copy-muted)]">{card.technicalSummary}</p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          <p className="app-body-copy text-sm">{card.body}</p>

                          {card.explainers && card.explainers.length > 0 ? (
                            <div className="border-t border-[var(--app-line)] pt-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-soft)]">
                                한자 풀이
                              </div>
                              <div className="mt-3 grid gap-2">
                                {card.explainers.map((item) => (
                                  <div key={`${card.key}-${item.term}`} className="text-sm leading-7 text-[var(--app-copy)]">
                                    <span className="font-semibold text-[var(--app-ivory)]">
                                      {item.term}{item.hanja ? `(${item.hanja})` : ''}
                                    </span>
                                    <span className="text-[var(--app-copy-soft)]"> · {item.meaning}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {card.practicalActions && card.practicalActions.length > 0 ? (
                            <div className="border-t border-[var(--app-line)] pt-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-soft)]">
                                생활 적용
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {card.practicalActions.map((action) => (
                                  <span
                                    key={`${card.key}-${action}`}
                                    className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs leading-5 text-[var(--app-copy)]"
                                  >
                                    {action}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {card.source.map((source) => (
                              <span
                                key={`${card.key}-${source}`}
                                className="rounded-full border border-[var(--app-gold)]/20 bg-[var(--app-gold)]/8 px-2.5 py-1 text-[var(--app-gold-soft)]"
                              >
                                {source}
                              </span>
                            ))}
                            {card.topicMapping.map((topic) => (
                              <span
                                key={`${card.key}-${topic}`}
                                className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-[var(--app-copy-soft)]"
                              >
                                {FOCUS_TOPIC_META[topic].label}
                              </span>
                            ))}
                          </div>

                          <div className="grid gap-2">
                            {card.details.map((detail, index) => (
                              <div
                                key={`${card.key}-${index}-${detail}`}
                                className="rounded-2xl border border-[var(--app-line)] bg-[rgba(8,10,18,0.32)] px-3 py-2 text-sm leading-7 text-[var(--app-copy)]"
                              >
                                {detail}
                              </div>
                            ))}
                          </div>

                          <CardLinkedClassicEvidence
                            items={
                              classicEvidenceBundle[getClassicConceptForEvidenceKey(card.key)]?.items ?? []
                            }
                          />
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            }
          >
            <section className="app-panel p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--app-ivory)]">사주 명반</h2>
                <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                  사주팔자 원국
                </Badge>
              </div>

              {/* 주 레이블 */}
              <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                {pillars.map(({ label }) => (
                  <div key={label} className="text-[11px] font-medium tracking-widest text-[var(--app-copy-muted)]">
                    {label}
                  </div>
                ))}
              </div>

              {/* 십신 행 */}
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {pillars.map(({ label, pillar }) => (
                  <div key={label} className="flex h-7 items-center justify-center">
                    {pillar ? (
                      label === '일주' ? (
                        <span className="rounded-full border border-[var(--app-gold-soft)]/30 bg-[var(--app-gold-soft)]/10 px-2 py-0.5 text-[11px] text-[var(--app-gold-soft)]">
                          일간
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] text-[var(--app-copy-soft)]">
                          {pillar.stemTenGod}
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-[var(--app-copy-muted)]">—</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 천간 행 */}
              <div className="mt-1 grid grid-cols-4 gap-2 text-center">
                {pillars.map(({ label, pillar }) => (
                  <div key={label} className="flex h-16 items-center justify-center sm:h-20">
                    {pillar ? (
                      <HanjaHint
                        character={pillar.stem}
                        hint={formatStemHint(pillar)}
                        color={ELEMENT_INFO[pillar.stemElement].color}
                        className="font-[var(--font-heading)] text-[3rem] font-bold leading-none sm:text-[3.45rem]"
                      />
                    ) : (
                      <span className="text-xs text-[var(--app-copy-muted)]">시간</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 지지 행 */}
              <div className="grid grid-cols-4 gap-2 border-t border-b border-[var(--app-line)] py-1 text-center">
                {pillars.map(({ label, pillar }) => (
                  <div key={label} className="flex h-16 items-center justify-center sm:h-20">
                    {pillar ? (
                      <HanjaHint
                        character={pillar.branch}
                        hint={formatBranchHint(pillar)}
                        color={ELEMENT_INFO[pillar.branchElement].color}
                        className="font-[var(--font-heading)] text-[3rem] font-bold leading-none sm:text-[3.45rem]"
                      />
                    ) : (
                      <span className="text-xs text-[var(--app-copy-muted)]">미입력</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 지장간 행 (여기·중기 흐릿, 정기 강조) */}
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {pillars.map(({ label, pillar }) => (
                  <div key={label} className="flex min-h-[2rem] items-center justify-center">
                    {pillar && pillar.hiddenStems.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {pillar.hiddenStems.map((hs, i) => {
                          const isMain = i === pillar.hiddenStems.length - 1;
                          return (
                            <span
                              key={`${hs.stem}-${i}`}
                              className={`transition-opacity ${isMain ? 'opacity-100' : 'opacity-35'}`}
                            >
                              <HanjaHint
                                character={hs.stem}
                                hint={formatHiddenStemHint(hs.stem, hs.element)}
                                color={ELEMENT_INFO[hs.element].color}
                                className="font-[var(--font-heading)] text-base font-medium leading-none"
                              />
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--app-copy-muted)]">{pillar ? '—' : '미입력'}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 지지 십신 행 (정기 기준) */}
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {pillars.map(({ label, pillar }) => {
                  const mainHidden = pillar?.hiddenStems.at(-1);
                  return (
                    <div key={label} className="flex h-6 items-center justify-center">
                      {mainHidden?.tenGod ? (
                        <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)]/50 px-2 py-0.5 text-[11px] text-[var(--app-copy-muted)]">
                          {mainHidden.tenGod}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* 오행 범례 */}
              <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--app-line)] pt-4">
                {(Object.entries(ELEMENT_INFO) as [Element, typeof ELEMENT_INFO[Element]][]).map(([el, info]) => (
                  <span key={el} className="flex items-center gap-1.5 text-xs text-[var(--app-copy-muted)]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
                    {info.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex flex-col gap-3 rounded-[22px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 lg:flex-row lg:items-center">
                <div className="min-w-40 text-sm font-semibold text-[var(--app-ivory)]">이번 흐름을 돕는 오행</div>
                <div className="flex flex-wrap gap-2">
                  {report.supportElements.map((element) => (
                    <span
                      key={element}
                      className="rounded-full border px-3 py-1 text-sm"
                      style={{
                        borderColor: `${ELEMENT_INFO[element].color}50`,
                        backgroundColor: `${ELEMENT_INFO[element].color}15`,
                        color: ELEMENT_INFO[element].color,
                      }}
                    >
                      {ELEMENT_INFO[element].name} · {ELEMENT_INFO[element].keywords.slice(0, 2).join(' · ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-sm">
                    <div className="text-sm font-semibold text-[var(--app-ivory)]">오행 균형</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--app-copy-muted)]">
                      오행은 막대 합계보다 무엇이 중심을 잡고 무엇이 비어 있는지 먼저 읽는 편이 더 자연스럽습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="rounded-full border px-3 py-1 text-sm"
                      style={{
                        borderColor: `${ELEMENT_INFO[sajuData.fiveElements.dominant].color}55`,
                        backgroundColor: `${ELEMENT_INFO[sajuData.fiveElements.dominant].color}16`,
                        color: ELEMENT_INFO[sajuData.fiveElements.dominant].color,
                      }}
                    >
                      주도 · {ELEMENT_INFO[sajuData.fiveElements.dominant].name}
                    </span>
                    <span
                      className="rounded-full border px-3 py-1 text-sm"
                      style={{
                        borderColor: `${ELEMENT_INFO[sajuData.fiveElements.weakest].color}55`,
                        backgroundColor: `${ELEMENT_INFO[sajuData.fiveElements.weakest].color}16`,
                        color: ELEMENT_INFO[sajuData.fiveElements.weakest].color,
                      }}
                    >
                      보완 · {ELEMENT_INFO[sajuData.fiveElements.weakest].name}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                  <div className="mx-auto w-full max-w-[390px]">
                    <FiveElementOrbitChart
                      byElement={sajuData.fiveElements.byElement}
                      dominant={sajuData.fiveElements.dominant}
                      weakest={sajuData.fiveElements.weakest}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                    {(Object.entries(sajuData.fiveElements.byElement) as [Element, (typeof sajuData.fiveElements.byElement)[Element]][]).map(([element, value]) => (
                      <div key={element} className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: ELEMENT_INFO[element].color }}
                        >
                          {ELEMENT_INFO[element].name}
                        </div>
                        <div className="mt-2 text-xl font-semibold text-[var(--app-ivory)]">
                          {Math.round(value.percentage)}%
                        </div>
                        <div className="mt-1 text-xs text-[var(--app-copy-soft)]">{value.count}개</div>
                        <p className="mt-3 text-xs leading-6 text-[var(--app-copy-muted)]">
                          {ELEMENT_INFO[element].keywords.slice(0, 2).join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <SajuAiInterpretationPanel
              readingId={slug}
              topic={report.focusTopic}
              focusLabel={report.focusLabel}
              fallbackInterpretation={buildFallbackInterpretation(report, 'female', grounding)}
              cacheEnabled={isReadingId(slug)}
            />

            <section className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
              <article className="app-panel p-6">
                <div className="app-caption">현재 운 흐름</div>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--app-ivory)]">
                  {formatCurrentLuckTitle(sajuData.currentLuck)}
                </h2>
                <p className="app-body-copy mt-4 text-sm">{formatCurrentLuckBody(sajuData.currentLuck, report)}</p>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">현재 대운</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--app-ivory)]">
                      {sajuData.currentLuck?.currentMajorLuck
                        ? `${sajuData.currentLuck.currentMajorLuck.ganzi} · ${formatMajorLuckWindow(sajuData.currentLuck.currentMajorLuck)}`
                        : '성별이 있어야 대운 방향을 확정할 수 있습니다.'}
                    </div>
                    <p className="app-body-copy mt-2 text-sm">
                      {currentMajorFlow?.body ??
                        '현재 저장본에는 대운 범위가 아직 비어 있습니다.'}
                    </p>
                    {currentMajorFlow?.points && currentMajorFlow.points.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentMajorFlow.points.map((point) => (
                          <span
                            key={`current-major-${point}`}
                            className="rounded-full border border-[var(--app-line)] bg-[rgba(8,10,18,0.24)] px-3 py-1 text-xs leading-5 text-[var(--app-copy-muted)]"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">세운</div>
                      <div className="mt-2 text-lg font-semibold text-[var(--app-ivory)]">
                        {formatLuckDescriptorTitle('세운', sajuData.currentLuck?.saewoon ?? null)}
                      </div>
                      <p className="app-body-copy mt-2 text-sm">
                        {formatLuckDescriptorBody(sajuData.currentLuck?.saewoon ?? null)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">월운</div>
                      <div className="mt-2 text-lg font-semibold text-[var(--app-ivory)]">
                        {formatLuckDescriptorTitle('월운', sajuData.currentLuck?.wolwoon ?? null)}
                      </div>
                      <p className="app-body-copy mt-2 text-sm">
                        {formatLuckDescriptorBody(sajuData.currentLuck?.wolwoon ?? null)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              <article className="app-panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="app-caption">대운 10주기</div>
                    <h2 className="mt-3 text-2xl font-semibold text-[var(--app-ivory)]">인생 흐름 캘린더</h2>
                  </div>
                  <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                    기본 계산
                  </Badge>
                </div>

                {majorLuckPreview.length > 0 ? (
                  <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {majorLuckPreview.map((cycle) => {
                        const isCurrent = currentMajorIndex === cycle.index;

                        return (
                          <div
                            key={`${cycle.index}-${cycle.ganzi}`}
                            className={cn(
                              'rounded-2xl border p-4 transition-colors',
                              isCurrent
                                ? 'border-[var(--app-gold)]/40 bg-[var(--app-gold)]/10'
                                : 'border-[var(--app-line)] bg-[var(--app-surface-muted)]'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-lg font-semibold text-[var(--app-ivory)]">{cycle.ganzi}</div>
                              {isCurrent ? (
                                <Badge className="border-[var(--app-gold)]/35 bg-[var(--app-gold)]/14 text-[var(--app-gold-soft)]">
                                  현재
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm text-[var(--app-copy)]">{formatMajorLuckWindow(cycle)}</div>
                            <p className="app-body-copy mt-3 text-sm">{cycle.notes.slice(0, 2).join(' ')}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="app-body-copy mt-4 text-sm">
                      {sajuData.majorLuck && sajuData.majorLuck.length > majorLuckPreview.length
                        ? `저장본에는 총 ${sajuData.majorLuck.length}개 대운 주기가 들어 있고, 화면에는 현재 흐름 파악이 쉬운 앞부분만 먼저 보여줍니다.`
                        : '절기 일수 미세보정 전 기본 계산값을 먼저 노출하고 있습니다.'}
                    </p>
                  </>
                ) : (
                  <p className="app-body-copy mt-5 text-sm">
                    성별이 있어야 대운 순행·역행을 확정할 수 있어 현재 저장본에는 대운 주기가 비어 있습니다.
                  </p>
                )}
              </article>
            </section>
          </DetailUnlock>
            </div>
        </section>

        <section id="result-next" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="안내"
            title="안전 안내와 다음 리포트"
            titleClassName="text-2xl sm:text-3xl"
            description="의료·건강 안내와 고전 참고자료, 새 리포트 생성 링크를 마지막에 모았습니다."
          />
            <SafetyNotice variant="health" />

            <div className="text-center">
              <Link
                href="/saju/new"
                className="text-sm text-[var(--app-gold-soft)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
              >
                다른 생년월일로 새 리포트 만들기
              </Link>
            </div>

            <ClassicEvidencePanel concept={classicEvidenceConcept} />
        </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
