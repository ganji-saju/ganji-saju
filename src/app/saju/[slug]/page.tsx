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
import { SafetyNotice } from '@/components/common/safety-notice';
import { GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { TrackedLink } from '@/components/common/tracked-link';
import { SectionHeader } from '@/components/layout/section-header';
import { ReportOneMinuteSummary } from '@/components/report/report-one-minute-summary';
import FiveElementOrbitChart from '@/components/saju/five-element-orbit-chart';
import { SajuFactEvidencePanel } from '@/components/saju/saju-fact-evidence-panel';
import { Badge } from '@/components/ui/badge';
import DetailUnlock from '@/components/detail-unlock';
import { DALBIT_TEACHERS, TASTE_PRODUCTS } from '@/content/moonlight';
import { SajuResultViewTracker } from '@/features/saju-detail/saju-result-view-tracker';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { toSlug } from '@/lib/saju/pillars';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { Branch, Element, Stem } from '@/lib/saju/types';
import { isReadingId, resolveReading } from '@/lib/saju/readings';
import { buildPunchReading, buildSajuInterpretationGrounding, buildSajuReport } from '@/domain/saju/report';
import type { ReportEvidenceCard, ReportScore, SajuReport } from '@/domain/saju/report';
import { compareBirthInputWithKasi } from '@/domain/saju/validation/kasi-calendar';
import { buildFallbackInterpretation } from '@/server/ai/saju-interpretation';
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
  const timeLabel = input.hour !== undefined ? `${input.hour}시${minuteLabel}` : '태어난 시간 미입력';
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
  if (!currentLuck) return '요즘 흐름 준비 중';

  const parts = [
    currentLuck.currentMajorLuck ? '긴 흐름 확인됨' : null,
    currentLuck.saewoon ? '올해 분위기 확인됨' : null,
    currentLuck.wolwoon ? '이번 달 분위기 확인됨' : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '요즘 흐름 준비 중';
}

function getTimelineItem(report: SajuReport, label: string) {
  return report.timeline.find((item) => item.label === label) ?? null;
}

function uniqueNonEmpty(items: Array<string | null | undefined>, max = 3) {
  return [...new Set(items.filter((item): item is string => Boolean(item && item.trim().length > 0)))].slice(0, max);
}

function easyResultCopy(value: string | null | undefined, maxSentences?: number) {
  const cleaned = simplifySajuCopy(value)
    .replace(/[甲乙丙丁戊己庚辛壬癸]\s*타고난 기질은/gu, '이 사주는')
    .replace(/[甲乙丙丁戊己庚辛壬癸]\s*타고난 기질/gu, '타고난 기질')
    .replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/gu, '')
    .replace(/사주 구조/gu, '내 사주')
    .replace(/타고난 역할 흐름/gu, '반복되는 역할')
    .replace(/보완 기운/gu, '보완할 점')
    .replace(/기운의 균형/gu, '컨디션 균형')
    .replace(/이번 달 흐름/gu, '이번 달 분위기')
    .replace(/올해 흐름/gu, '올해 분위기')
    .replace(/큰 흐름/gu, '긴 흐름')
    .replace(/(올해 분위기|이번 달 분위기|긴 흐름)이/gu, '$1가')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!maxSentences) return cleaned;

  const sentences = cleaned
    .split(/(?<=[.!?。])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length > 0 ? sentences.slice(0, maxSentences).join(' ') : cleaned;
}

function easyResultList(items: Array<string | null | undefined>, max = 3) {
  return uniqueNonEmpty(items.map((item) => easyResultCopy(item, 1)), max);
}

function buildKeyThemes(report: SajuReport) {
  return easyResultList(report.summaryHighlights, 3);
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
  ).map((item) => easyResultCopy(item, 1));
}

function buildFavorableChoices(report: SajuReport) {
  return easyResultList(
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
    case 'year-core':
      return `/membership/checkout?product=${productSlug}&slug=${encodedSlug}&from=saju-result`;
    case 'monthly-calendar': {
      const now = new Date();
      const scope = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return `/membership/checkout?product=monthly-calendar&slug=${encodedSlug}&scope=${scope}&from=saju-result`;
    }
    default:
      return '/pricing';
  }
}

function formatCurrentLuckBody(currentLuck: SajuCurrentLuck | null, report?: SajuReport) {
  if (!currentLuck) {
    return '요즘 흐름을 아직 정리하지 못했습니다. 정보가 연결되면 이 자리에 지금 시점의 조언이 표시됩니다.';
  }

  const enriched = report
    ? [
        getTimelineItem(report, '대운 흐름')?.body,
        getTimelineItem(report, '이번 달')?.body,
      ].filter(Boolean)
    : [];

  if (enriched.length > 0) return easyResultCopy(enriched.join(' '), 3);

  const notes = [
    ...(currentLuck.currentMajorLuck?.notes ?? []).slice(0, 2),
    ...(currentLuck.saewoon?.notes ?? []).slice(0, 1),
    ...(currentLuck.wolwoon?.notes ?? []).slice(0, 1),
  ];

  return notes.length > 0
    ? easyResultCopy(notes.join(' '), 2)
    : '요즘 흐름은 준비됐고, 곧 더 쉽게 정리해드릴게요.';
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
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--app-pink-line)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--app-ink)] opacity-0 shadow-[0_12px_32px_rgba(216,27,114,0.16)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {hint}
      </span>
    </span>
  );
}

function formatLuckDescriptorTitle(label: string, descriptor: SajuLuckDescriptor | null) {
  if (!descriptor) return `${label} 준비 중`;

  const dateLabel =
    descriptor.month !== null
      ? `${descriptor.year}년 ${descriptor.month}월`
      : descriptor.year !== null
        ? `${descriptor.year}년`
        : null;

  return [label, dateLabel].filter(Boolean).join(' · ');
}

function formatLuckDescriptorBody(descriptor: SajuLuckDescriptor | null) {
  if (!descriptor) return '아직 정리된 내용이 없습니다.';

  return descriptor.notes.length > 0
    ? easyResultCopy(descriptor.notes.join(' '), 2)
    : '기본 정보는 준비됐고, 곧 더 쉽게 정리해드릴게요.';
}

function formatMajorLuckWindow(cycle: SajuMajorLuckCycle) {
  if (cycle.startAge === null || cycle.endAge === null) return '시작 나이 계산 준비 중';
  return `${cycle.startAge}세 ~ ${cycle.endAge}세`;
}

function formatHiddenStems(pillar: SajuPillar) {
  if (pillar.hiddenStems.length === 0) return null;
  return pillar.hiddenStems.map((item) => item.stem).join(' · ');
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
    { label: '년', pillar: sajuData.pillars.year },
    { label: '월', pillar: sajuData.pillars.month },
    { label: '일', pillar: sajuData.pillars.day },
    { label: '시', pillar: sajuData.pillars.hour },
  ];
  const majorLuckPreview = sajuData.majorLuck?.slice(0, 6) ?? [];
  const currentMajorIndex = sajuData.currentLuck?.currentMajorLuck?.index ?? null;
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
  const punchReading = buildPunchReading(report);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <SajuResultViewTracker slug={slug} />

        <div className="space-y-5 sm:space-y-6">
        <GangiPageHeader title="사주풀이" backHref="/saju/new" />
        <GangiIntro
          eyebrow={report.focusBadge}
          title={
            <>
              지금 내 흐름을
              <br />
              쉽게 풀어드릴게요
            </>
          }
          description={formatBirthSummary(input)}
        />
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
                <div className="app-caption text-[var(--app-pink-strong)]">한 줄 풀이</div>
                <h1 className="dalbit-result-title">{easyResultCopy(punchReading.verdict, 1)}</h1>
                <p className="dalbit-result-lead">{easyResultCopy(punchReading.why, 1)}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--app-copy-muted)]">
                  {formatBirthSummary(input)}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="dalbit-result-action-card">
                  <div className="app-caption text-[var(--app-coral)]">조심</div>
                  <h2>{easyResultCopy(punchReading.caution, 1)}</h2>
                </div>
                <div className="dalbit-result-action-card">
                  <div className="app-caption text-[var(--app-jade)]">액션</div>
                  <h2>{easyResultCopy(punchReading.action, 1)}</h2>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="dalbit-result-evidence-card">
                <div className="app-caption text-[var(--app-pink-strong)]">다음 선택</div>
                <h2>더 보고 싶은 부분만 이어보세요</h2>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <TrackedLink
                    href={`/saju/${slug}/premium`}
                    eventName="report_deep_report_click"
                    eventParams={{ slug, from: 'result_first_card' }}
                    className="gangi-primary-button"
                  >
                    긴 사주풀이 보기
                  </TrackedLink>
                  <TrackedLink
                    href="/dialogue"
                    eventName="report_dialogue_continue_click"
                    eventParams={{ slug, from: 'result_first_card' }}
                    className="gangi-secondary-button"
                  >
                    이어서 묻기
                  </TrackedLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="dalbit-section-heading mb-0">
            <h2 className="text-2xl">더 궁금한 부분만 이어보세요</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <h3>{easyResultCopy(product.title, 1)}</h3>
                <p>{easyResultCopy(product.result, 1)}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="result-summary" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="요약"
            title="한눈에 보는 핵심"
            titleClassName="text-2xl sm:text-3xl"
          />
            <section className="space-y-4">
              <ReportOneMinuteSummary
                headline={easyResultCopy(report.headline, 1)}
                keyThemes={keyThemes}
                cautionPatterns={cautionPatterns}
                favorableChoices={favorableChoices}
                isTimeUnknown={isTimeUnknown}
              />
            </section>
        </section>

        <section id="result-topics" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="분야"
            title="궁금한 분야만 골라보기"
            titleClassName="text-2xl sm:text-3xl"
          />
            <section className="app-panel p-6 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="app-caption">분야별 풀이</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ink)]">
                지금 가장 궁금한 것부터 보세요
              </h2>
            </div>
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
                    'gangi-card-panel group relative overflow-hidden rounded-[24px] border p-5 shadow-[0_18px_48px_rgba(216,27,114,0.08)]',
                    visual.panel,
                    isFocusedScore ? 'ring-1 ring-[var(--app-pink)]/45' : ''
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
                    <p className="mt-4 text-sm leading-7 text-[var(--app-copy)]">{easyResultCopy(score.summary, 1)}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 text-xs">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 transition-colors',
                          isFocusedScore
                            ? 'border-[var(--app-pink)]/35 bg-[var(--app-pink)]/14 text-[var(--app-pink-strong)]'
                            : 'border-[var(--app-line)] bg-white/70 text-[var(--app-copy-soft)] group-hover:border-[var(--app-pink-line)] group-hover:text-[var(--app-ink)]'
                        )}
                      >
                        {isFocusedScore ? '현재 해석' : '눌러서 보기'}
                      </span>
                      <span
                        className={cn(
                          'text-sm transition-all duration-200',
                          isFocusedScore
                            ? 'translate-x-0 text-[var(--app-pink-strong)]'
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

          <div className="gangi-card-panel mt-4 overflow-hidden rounded-[24px] border-[var(--app-pink)]/22">
            <div className="grid gap-0 lg:grid-cols-2">
              <div className="p-4 sm:p-5">
                <div className="app-caption">{report.focusLabel} 실행 포인트</div>
                <div className="mt-2 text-lg font-semibold leading-7 text-[var(--app-ink)]">
                  {easyResultCopy(report.primaryAction.title, 1)}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{easyResultCopy(report.primaryAction.description, 2)}</p>
              </div>
              <div className="border-t border-[var(--app-line)] p-4 sm:p-5 lg:border-l lg:border-t-0">
                <div className="app-caption">{report.focusLabel} 주의 포인트</div>
                <div className="mt-2 text-lg font-semibold leading-7 text-[var(--app-ink)]">
                  {easyResultCopy(report.cautionAction.title, 1)}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{easyResultCopy(report.cautionAction.description, 2)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="gangi-card-panel p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-caption">올해 흐름</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ink)]">
                월별로 밀어도 되는 때와 쉬어갈 때를 따로 볼 수 있어요.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/saju/${slug}/premium#yearly-report`}
                className="rounded-full border border-[var(--app-pink)]/35 bg-[var(--app-pink)]/14 px-5 py-3 text-sm font-semibold text-[var(--app-pink-strong)] transition-colors hover:bg-[var(--app-pink)]/20"
              >
                올해 흐름 보기
              </Link>
            </div>
          </div>
        </section>

        </section>

        <section id="result-flow" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="시간 흐름"
            title="오늘, 이번 달, 앞으로의 흐름"
            titleClassName="text-2xl sm:text-3xl"
          />
            <section className="grid gap-4 lg:grid-cols-3">
          {report.timeline.map((item) => (
            <article key={item.label} className="app-panel p-6">
              <div className="app-caption">{item.label}</div>
              <h2 className="mt-3 text-2xl font-semibold leading-8 text-[var(--app-ink)]">{easyResultCopy(item.headline, 1)}</h2>
              <p className="app-body-copy mt-4 text-sm">{easyResultCopy(item.body, 2)}</p>
              {item.points && item.points.length > 0 ? (
                <div className="mt-5 grid gap-2">
                  {item.points.map((point) => (
                    <div
                      key={`${item.label}-${point}`}
                      className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm leading-7 text-[var(--app-copy)]"
                    >
                      {easyResultCopy(point, 1)}
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
            eyebrow="사주표"
            title="필요할 때만 기본 정보를 열어보세요"
            titleClassName="text-2xl sm:text-3xl"
          />
            <details className="rounded-[24px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--app-copy)]">
                내 사주표와 입력 정보 보기
              </summary>
              <div className="mt-4">
                <SajuFactEvidencePanel
                  grounding={grounding}
                  kasiComparison={kasiComparison}
                  showDecisionTrace={false}
                />
              </div>
            </details>
        </section>

        <section id="result-detail" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="더 보기"
            title="필요한 분야만 더 보기"
            titleClassName="text-2xl sm:text-3xl"
          />
            <div>
          <DetailUnlock
            slug={slug}
            premiumAccessLabel={premiumAccessLabel}
            premiumHref={premiumHref}
            referenceChildren={
              <section className="space-y-4">
                <div>
                  <div>
                    <div className="app-caption">분야별 풀이</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-ink)]">읽고 싶은 부분만 펼쳐보세요</h2>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {report.evidenceCards.map((card) => (
                    <article
                      key={card.key}
                      className={cn(
                        'gangi-evidence-card p-5',
                        shouldEvidenceCardUseFullRow(card) ? 'md:col-span-2' : undefined
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="app-caption">{easyResultCopy(card.label, 1)}</div>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">{easyResultCopy(card.title, 1)}</h3>
                      <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">
                        {easyResultCopy(card.body, 2)}
                      </p>

                      <details className="mt-4 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3">
                        <summary className="cursor-pointer list-none text-sm font-medium text-[var(--app-pink-strong)]">
                          한 줄 더 보기
                        </summary>

                        <div className="mt-4 space-y-4">
                          {card.plainSummary ? (
                            <div className="rounded-2xl border border-[var(--app-line)] bg-white px-3 py-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-copy-soft)]">
                                덧붙임
                              </div>
                              <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{easyResultCopy(card.plainSummary, 2)}</p>
                            </div>
                          ) : null}

                          {card.practicalActions && card.practicalActions.length > 0 ? (
                            <div className="border-t border-[var(--app-line)] pt-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-copy-soft)]">
                                오늘 해볼 것
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {card.practicalActions.map((action) => (
                                  <span
                                    key={`${card.key}-${action}`}
                                    className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs leading-5 text-[var(--app-copy)]"
                                  >
                                    {easyResultCopy(action, 1)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            }
          >
            <details className="rounded-[28px] border border-[var(--app-line)] bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.06)]">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="app-caption">사주표</div>
                    <h2 className="mt-2 text-lg font-semibold text-[var(--app-ink)]">내 사주표 보기</h2>
                  </div>
                  <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                    열기
                  </Badge>
                </div>
              </summary>

              <div className="mt-5 rounded-[24px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">

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
                      label === '일' ? (
                        <span className="rounded-full border border-[var(--app-pink)]/30 bg-[var(--app-pink)]/10 px-2 py-0.5 text-[11px] text-[var(--app-pink-strong)]">
                          나
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

              <div className="mt-1 grid grid-cols-4 gap-2 text-center">
                {pillars.map(({ label, pillar }) => (
                  <div key={label} className="flex h-16 items-center justify-center sm:h-20">
                    {pillar ? (
                      <HanjaHint
                        character={pillar.stem}
                        hint={formatStemHint(pillar)}
                        color={ELEMENT_INFO[pillar.stemElement].color}
                        className=" text-[3rem] font-bold leading-none sm:text-[3.45rem]"
                      />
                    ) : (
                      <span className="text-xs text-[var(--app-copy-muted)]">시간</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2 border-t border-b border-[var(--app-line)] py-1 text-center">
                {pillars.map(({ label, pillar }) => (
                  <div key={label} className="flex h-16 items-center justify-center sm:h-20">
                    {pillar ? (
                      <HanjaHint
                        character={pillar.branch}
                        hint={formatBranchHint(pillar)}
                        color={ELEMENT_INFO[pillar.branchElement].color}
                        className=" text-[3rem] font-bold leading-none sm:text-[3.45rem]"
                      />
                    ) : (
                      <span className="text-xs text-[var(--app-copy-muted)]">미입력</span>
                    )}
                  </div>
                ))}
              </div>

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
                                className=" text-base font-medium leading-none"
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

              <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--app-line)] pt-4">
                {(Object.entries(ELEMENT_INFO) as [Element, typeof ELEMENT_INFO[Element]][]).map(([el, info]) => (
                  <span key={el} className="flex items-center gap-1.5 text-xs text-[var(--app-copy-muted)]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
                    {info.name.split(' ')[0]}
                  </span>
                ))}
              </div>
              </div>
            </details>

            <section className="grid gap-3">
              <div className="flex flex-col gap-3 rounded-[22px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 lg:flex-row lg:items-center">
                <div className="min-w-40 text-sm font-semibold text-[var(--app-ink)]">오늘 균형을 돕는 기운</div>
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
                    <div className="text-sm font-semibold text-[var(--app-ink)]">기운 균형</div>
                    <p className="mt-2 text-sm leading-7 text-[var(--app-copy-muted)]">
                      다섯 기운은 점수보다 어디에 힘이 몰리고, 어디를 보완하면 좋은지 보는 그림입니다.
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
                      강한 쪽 · {ELEMENT_INFO[sajuData.fiveElements.dominant].name}
                    </span>
                    <span
                      className="rounded-full border px-3 py-1 text-sm"
                      style={{
                        borderColor: `${ELEMENT_INFO[sajuData.fiveElements.weakest].color}55`,
                        backgroundColor: `${ELEMENT_INFO[sajuData.fiveElements.weakest].color}16`,
                        color: ELEMENT_INFO[sajuData.fiveElements.weakest].color,
                      }}
                    >
                      채울 쪽 · {ELEMENT_INFO[sajuData.fiveElements.weakest].name}
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
                      <div key={element} className="rounded-[18px] border border-[var(--app-line)] bg-white px-4 py-4">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: ELEMENT_INFO[element].color }}
                        >
                          {ELEMENT_INFO[element].name}
                        </div>
                        <div className="mt-2 text-xl font-semibold text-[var(--app-ink)]">
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
                <div className="app-caption">요즘 흐름</div>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--app-ink)]">
                  {formatCurrentLuckTitle(sajuData.currentLuck)}
                </h2>
                <p className="app-body-copy mt-4 text-sm">{formatCurrentLuckBody(sajuData.currentLuck, report)}</p>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">앞으로 이어질 흐름</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--app-ink)]">
                      {sajuData.currentLuck?.currentMajorLuck
                        ? formatMajorLuckWindow(sajuData.currentLuck.currentMajorLuck)
                        : '성별 정보가 있으면 앞으로의 흐름을 더 자세히 볼 수 있습니다.'}
                    </div>
                    <p className="app-body-copy mt-2 text-sm">
                      {easyResultCopy(
                        currentMajorFlow?.body ??
                          '현재 저장본에는 큰 흐름 범위가 아직 비어 있습니다.',
                        2
                      )}
                    </p>
                    {currentMajorFlow?.points && currentMajorFlow.points.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentMajorFlow.points.map((point) => (
                          <span
                            key={`current-major-${point}`}
                            className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1 text-xs leading-5 text-[var(--app-copy-muted)]"
                          >
                            {easyResultCopy(point, 1)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">올해 분위기</div>
                      <div className="mt-2 text-lg font-semibold text-[var(--app-ink)]">
                        {formatLuckDescriptorTitle('올해 분위기', sajuData.currentLuck?.saewoon ?? null)}
                      </div>
                      <p className="app-body-copy mt-2 text-sm">
                        {formatLuckDescriptorBody(sajuData.currentLuck?.saewoon ?? null)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--app-copy-soft)]">이번 달 분위기</div>
                      <div className="mt-2 text-lg font-semibold text-[var(--app-ink)]">
                        {formatLuckDescriptorTitle('이번 달 분위기', sajuData.currentLuck?.wolwoon ?? null)}
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
                    <div className="app-caption">긴 흐름</div>
                    <h2 className="mt-3 text-2xl font-semibold text-[var(--app-ink)]">앞으로의 흐름 지도</h2>
                  </div>
                  <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                    간단 보기
                  </Badge>
                </div>

                {majorLuckPreview.length > 0 ? (
                  <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {majorLuckPreview.map((cycle) => {
                        const isCurrent = currentMajorIndex === cycle.index;

                        return (
                          <div
                            key={`${cycle.index}-${cycle.startAge}-${cycle.endAge}`}
                            className={cn(
                              'rounded-2xl border p-4 transition-colors',
                              isCurrent
                                ? 'border-[var(--app-pink)]/40 bg-[var(--app-pink)]/10'
                                : 'border-[var(--app-line)] bg-[var(--app-surface-muted)]'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-lg font-semibold text-[var(--app-ink)]">흐름 {cycle.index + 1}</div>
                              {isCurrent ? (
                                <Badge className="border-[var(--app-pink)]/35 bg-[var(--app-pink)]/14 text-[var(--app-pink-strong)]">
                                  현재
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm text-[var(--app-copy)]">{formatMajorLuckWindow(cycle)}</div>
                            <p className="app-body-copy mt-3 text-sm">{easyResultCopy(cycle.notes.slice(0, 2).join(' '), 2)}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="app-body-copy mt-4 text-sm">
                      {sajuData.majorLuck && sajuData.majorLuck.length > majorLuckPreview.length
                        ? `전체 흐름은 ${sajuData.majorLuck.length}개 구간으로 이어지고, 화면에는 먼저 보기 쉬운 앞부분만 보여드립니다.`
                        : '지금 확인 가능한 흐름을 먼저 보여드립니다.'}
                    </p>
                  </>
                ) : (
                  <p className="app-body-copy mt-5 text-sm">
                    성별 정보가 있으면 앞으로의 흐름을 더 자세히 볼 수 있습니다.
                  </p>
                )}
              </article>
            </section>
          </DetailUnlock>
            </div>
        </section>

        <section id="result-next" className="space-y-4 scroll-mt-24">
          <SectionHeader
            eyebrow="건강"
            title="몸과 마음은 실제 상태를 우선하세요"
            titleClassName="text-2xl sm:text-3xl"
          />
            <SafetyNotice variant="health" />

            <div className="text-center">
              <Link
                href="/saju/new"
                className="text-sm font-semibold text-[var(--app-pink-strong)] underline underline-offset-4 hover:text-[var(--app-ink)]"
              >
                다른 생년월일로 다시 보기
              </Link>
            </div>
        </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
