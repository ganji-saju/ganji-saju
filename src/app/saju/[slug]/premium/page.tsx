import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TrackedLink } from '@/components/common/tracked-link';
import { Badge } from '@/components/ui/badge';
import FortuneCalendarPanel from '@/components/ai/fortune-calendar-panel';
import LifetimeReportPanel from '@/components/ai/lifetime-report-panel';
import YearlyReportPanel from '@/components/ai/yearly-report-panel';
import {
  REPORT_SAMPLE_HREF,
  REPORT_PREVIEW_VALUE_POINTS,
  SAJU_PREMIUM_SECTIONS,
  SAJU_PREMIUM_PREVIEW,
  SAJU_PREMIUM_VALUE_POINTS,
  TASTE_PRODUCTS,
  TRUST_SIGNALS,
} from '@/content/moonlight';
import { buildSajuReport } from '@/domain/saju/report';
import {
  ELEMENT_INFO,
  getLuckyElementsFromSajuData,
  getPersonalityFromSajuData,
} from '@/lib/saju/elements';
import { toSlug } from '@/lib/saju/pillars';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  buildReadingProductScopeKey,
  getTasteProductEntitlement,
} from '@/lib/product-entitlements';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

type ReadingRecord = NonNullable<Awaited<ReturnType<typeof resolveReading>>>;

interface PremiumReportSection {
  eyebrow: string;
  title: string;
  lead: string;
  decision: string;
  paragraphs: string[];
  keyPoints?: string[];
  actionItems?: string[];
  highlights?: string[];
}

function compactStrings(strings: Array<string | null | undefined>) {
  return strings.filter((item): item is string => Boolean(item && item.trim().length > 0));
}

function formatElementName(element: keyof typeof ELEMENT_INFO) {
  return ELEMENT_INFO[element].name.split(' ')[0];
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

function formatMajorLuckLine(cycle: NonNullable<ReadingRecord['sajuData']['majorLuck']>[number]) {
  const note = cycle.notes.slice(0, 2).join(' ') || '이 시기의 큰 흐름은 세부 풀이 보강 대상입니다.';
  return `${formatLuckRange(cycle)} · ${cycle.ganzi}: ${note}`;
}

function getTimelineItem(report: ReturnType<typeof buildSajuReport>, label: string) {
  return report.timeline.find((item) => item.label === label) ?? null;
}

function compactList(items: Array<string | null | undefined>, max = 4) {
  return [...new Set(compactStrings(items))].slice(0, max);
}

function formatScoreFocus(report: ReturnType<typeof buildSajuReport>) {
  const focused = report.scores.find((score) => score.key === report.focusScoreKey);
  return focused ? `${report.focusLabel} ${focused.score}점 · ${focused.summary}` : '';
}

function buildUnlockedReportSections(reading: ReadingRecord): PremiumReportSection[] {
  const { input, sajuData } = reading;
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');
  const evidenceByKey = Object.fromEntries(
    todayReport.evidenceCards.map((card) => [card.key, card])
  );
  const dominant = formatElementName(sajuData.fiveElements.dominant);
  const weakest = formatElementName(sajuData.fiveElements.weakest);
  const supportLabels =
    getLuckyElementsFromSajuData(sajuData).map(formatElementName).join(' · ') || dominant;
  const pillars = [
    `년주 ${sajuData.pillars.year.ganzi}`,
    `월주 ${sajuData.pillars.month.ganzi}`,
    `일주 ${sajuData.pillars.day.ganzi}`,
    sajuData.pillars.hour ? `시주 ${sajuData.pillars.hour.ganzi}` : '시주 미입력',
  ];
  const strength = evidenceByKey.strength;
  const pattern = evidenceByKey.pattern;
  const yongsin = evidenceByKey.yongsin;
  const relations = evidenceByKey.relations;
  const gongmang = evidenceByKey.gongmang;
  const specialSals = evidenceByKey.specialSals;
  const majorLuckHighlights = sajuData.majorLuck?.slice(0, 10).map(formatMajorLuckLine) ?? [];
  const currentMajor = sajuData.currentLuck?.currentMajorLuck;
  const saewoon = sajuData.currentLuck?.saewoon;
  const wolwoon = sajuData.currentLuck?.wolwoon;
  const todayFlow = getTimelineItem(todayReport, '오늘');
  const monthlyFlow = getTimelineItem(todayReport, '이번 달');
  const majorFlow = getTimelineItem(todayReport, '대운 흐름');
  const yongsinLabel = sajuData.yongsin
    ? formatSymbolList([sajuData.yongsin.primary, ...sajuData.yongsin.secondary])
    : yongsin?.title ?? '';

  return [
    {
      eyebrow: '타고난 결',
      title: '1. 일주와 기본 성향',
      lead: compactStrings([
        `선생님의 일주는 ${sajuData.pillars.day.ganzi}입니다.`,
        sajuData.dayMaster.metaphor
          ? `${sajuData.dayMaster.stem} 일간은 ${sajuData.dayMaster.metaphor}의 결을 지녀 삶의 방향을 읽을 때 이 상징을 먼저 봅니다.`
          : null,
      ]).join(' '),
      decision: `${sajuData.dayMaster.stem} 일간은 타고난 반응 속도와 자기 표현 방식의 중심입니다. 이 리포트에서는 성격 묘사보다 “어떤 환경에서 실력이 잘 나오는가”를 먼저 봅니다.`,
      paragraphs: compactStrings([
        getPersonalityFromSajuData(sajuData),
        todayReport.summaryHighlights[0],
      ]),
      keyPoints: compactList([
        `사주 기본표: ${pillars.join(' · ')}`,
        `태어난 달 흐름: ${sajuData.pillars.month.ganzi}`,
        `일간 상징: ${sajuData.dayMaster.metaphor ?? sajuData.dayMaster.stem}`,
      ]),
      actionItems: compactList([
        '내가 빨리 반응하는 상황과 늦게 결정해야 하는 상황을 구분하세요.',
        '성향을 장점/단점으로만 보지 말고 잘 맞는 환경을 찾는 힌트로 쓰세요.',
      ], 2),
    },
    {
      eyebrow: '균형 진단',
      title: '2. 오행 분포와 기운의 균형',
      lead: `${dominant} 기운이 가장 앞에 있고, ${weakest} 기운을 어떻게 보완하느냐가 평생 균형의 핵심입니다.`,
      decision: strength?.body ?? `${dominant}은 쓰기 쉬운 장점이고, ${weakest}은 의식적으로 보완해야 하는 약한 축입니다.`,
      paragraphs: compactStrings([
        strength?.title ? `기운 균형은 ${strength.title} 흐름입니다.` : null,
        todayReport.summaryHighlights[1],
      ]),
      keyPoints: compactList([
        strength ? `${strength.title} · ${strength.confidence}` : null,
        `강한 오행: ${dominant}`,
        `보완 오행: ${weakest}`,
      ]),
      actionItems: strength?.practicalActions?.slice(0, 3),
      highlights: Object.entries(sajuData.fiveElements.byElement).map(
        ([element, value]) => `${formatElementName(element as keyof typeof ELEMENT_INFO)} ${value.percentage}% · ${value.state}`
      ),
    },
    {
      eyebrow: '사주 구조',
      title: '3. 역할 흐름과 보완 힌트',
      lead: compactStrings([
        pattern ? `${pattern.title} 흐름으로 반복되는 역할과 관계 패턴을 먼저 읽습니다.` : null,
        yongsinLabel ? `보완 축은 ${yongsinLabel}입니다.` : null,
      ]).join(' '),
      decision: yongsin?.body ?? `이 사주는 ${supportLabels} 기운을 어떻게 쓰느냐가 균형의 핵심입니다.`,
      paragraphs: compactStrings([
        pattern?.title ? `역할 흐름은 ${pattern.title}입니다.` : null,
        yongsin?.title ? `보완 축 메모: ${yongsin.title}` : null,
        `평생 운을 볼 때는 타고난 구조를 고정값으로 단정하기보다, ${supportLabels} 기운을 생활 환경과 선택 안에 얼마나 안정적으로 들이는지가 중요합니다.`,
      ]),
      keyPoints: compactList([
        pattern ? `역할 흐름: ${pattern.title}` : null,
        yongsinLabel ? `보완 축: ${yongsinLabel}` : null,
        yongsin?.details.find((detail) => detail.includes('후보')),
      ]),
      actionItems: compactList([
        ...(yongsin?.practicalActions ?? []),
        ...(pattern?.practicalActions ?? []),
      ], 4),
    },
    {
      eyebrow: '인생 큰 흐름',
      title: '4. 10년 단위로 보는 큰 흐름',
      lead: currentMajor
        ? `현재는 ${currentMajor.ganzi} 큰 흐름 안에 있어 ${formatLuckRange(currentMajor)} 구간의 선택이 다음 흐름을 여는 힌트가 됩니다.`
        : '10년 단위 흐름은 삶의 배경이 바뀌는 큰 흐름입니다.',
      decision: majorFlow?.body ?? '큰 흐름은 사건 하나를 맞히는 항목이 아니라, 선택의 배경과 장기 과제를 읽는 항목입니다.',
      paragraphs: compactStrings([
        majorFlow?.headline,
        '아래 목록은 특정 사건을 단정하기보다, 어느 시기에 확장·정리·관계 조율의 과제가 커지는지 보는 장기 지도입니다.',
      ]),
      keyPoints: majorFlow?.points,
      actionItems: compactList([
        majorFlow?.points?.find((point) => point.startsWith('장기 실행')),
        '올해 결정은 지금의 장기 과제와 맞는지 먼저 확인하세요.',
      ], 2),
      highlights: majorLuckHighlights.length > 0
        ? majorLuckHighlights
        : ['성별 또는 생시 정보가 부족해 큰 흐름의 시작 시점은 아직 산정되지 않았습니다.'],
    },
    {
      eyebrow: '현재 운',
      title: '5. 올해와 이번 달 흐름',
      lead: compactStrings([
        saewoon?.ganzi ? `${saewoon.ganzi} 올해 흐름` : null,
        wolwoon?.ganzi ? `${wolwoon.ganzi} 이번 달 흐름` : null,
      ]).join(' · ') || '현재 올해와 이번 달 흐름은 기본 흐름 중심으로 해석합니다.',
      decision: compactStrings([
        todayFlow?.body,
        monthlyFlow?.body,
      ]).join(' ') || '현재 운은 올해와 이번 달 흐름을 함께 놓고 오늘의 선택 속도와 이번 달 루틴을 조절하는 방식으로 봅니다.',
      paragraphs: compactStrings([
        saewoon?.notes.join(' '),
        wolwoon?.notes.join(' '),
      ]),
      keyPoints: compactList([
        todayFlow?.headline,
        monthlyFlow?.headline,
        majorFlow?.headline,
      ]),
      actionItems: compactList([
        ...(todayFlow?.points ?? []),
        ...(monthlyFlow?.points ?? []),
      ], 4),
    },
    {
      eyebrow: '생활 분야',
      title: '6. 재물·연애·직장·관계',
      lead: '깊은 사주풀이에서는 한 분야만 따로 떼어 보지 않고, 돈·마음·역할·사람 사이의 균형을 함께 봅니다.',
      decision: '유료 상세에서는 분야별 운을 길게 늘어놓기보다, 지금 실제로 판단해야 할 우선순위를 나눠 보여줍니다.',
      paragraphs: compactStrings([
        `재물: ${wealthReport.primaryAction.description}`,
        `연애: ${loveReport.primaryAction.description}`,
        `직장: ${careerReport.primaryAction.description}`,
        `관계: ${relationshipReport.primaryAction.description}`,
      ]),
      keyPoints: compactList([
        formatScoreFocus(wealthReport),
        formatScoreFocus(loveReport),
        formatScoreFocus(careerReport),
        formatScoreFocus(relationshipReport),
      ]),
      actionItems: compactList([
        wealthReport.cautionAction.description,
        loveReport.cautionAction.description,
        careerReport.cautionAction.description,
        relationshipReport.cautionAction.description,
      ]),
    },
    {
      eyebrow: '활용 전략',
      title: '7. 합충·공망·신살을 반영한 평생 조언',
      lead: `좋은 운은 ${supportLabels} 기운을 현실의 루틴으로 만들 때 오래 갑니다.`,
      decision: '합충·공망·신살은 겁을 주는 장식이 아니라, 어디서 속도가 붙고 어디서 확인 절차가 필요한지 알려주는 보조 신호입니다.',
      paragraphs: compactStrings([
        relations?.body,
        gongmang?.body,
        specialSals?.body,
        '운의 강한 구간에서는 속도를 내되, 약한 축이 드러나는 시기에는 결정을 늦추고 확인 절차를 늘리는 방식이 가장 현실적인 보완책입니다.',
      ]),
      keyPoints: compactList([
        relations ? `합충: ${relations.title}` : null,
        gongmang ? `공망: ${gongmang.title}` : null,
        specialSals ? `신살: ${specialSals.title}` : null,
      ]),
      actionItems: compactList([
        ...(relations?.practicalActions ?? []),
        ...(gongmang?.practicalActions ?? []),
        ...(specialSals?.practicalActions ?? []),
      ], 4),
    },
  ];
}

function canUseSubscriptionForPremiumReport(subscription: Awaited<ReturnType<typeof getManagedSubscription>>) {
  return (
    subscription?.status === 'active' &&
    (subscription.plan === 'plus_monthly' || subscription.plan === 'premium_monthly')
  );
}

function getTasteProductHref(productSlug: string, encodedSlug: string, targetYear: number) {
  if (productSlug === 'monthly-calendar') {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return `/membership/checkout?product=monthly-calendar&slug=${encodedSlug}&scope=${targetYear}-${month}&from=saju-premium`;
  }

  if (productSlug === 'year-core') {
    return `/membership/checkout?product=year-core&slug=${encodedSlug}&from=saju-premium`;
  }

  if (productSlug === 'love-question') {
    return '/membership/checkout?product=love-question&from=saju-premium';
  }

  if (productSlug === 'money-pattern' || productSlug === 'work-flow') {
    return `/membership/checkout?product=${productSlug}&slug=${encodedSlug}&from=saju-premium`;
  }

  if (productSlug === 'today-detail') {
    return `/membership/checkout?product=today-detail&slug=${encodedSlug}&scope=general&from=saju-premium`;
  }

  return '/pricing';
}

type PremiumReadingStep = {
  label: string;
  title: string;
  description: string;
  href: string;
  status: string;
  note: string;
};

function PremiumReadingMap({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: PremiumReadingStep[];
}) {
  return (
    <section className="app-panel p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <div className="app-caption">리포트 핵심</div>
          <h2 className="mt-3 text-2xl text-[var(--app-ivory)]">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
            {description}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="group flex min-h-[168px] flex-col rounded-[1.15rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 transition-colors hover:border-[var(--app-gold)]/32 hover:bg-[var(--app-gold)]/8"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-sm font-semibold text-[var(--app-gold-text)]">
                  {index + 1}
                </span>
                <span className="rounded-full border border-[var(--app-line)] px-2.5 py-1 text-[11px] text-[var(--app-copy-soft)]">
                  {step.status}
                </span>
              </div>
              <div className="mt-4 app-caption text-[var(--app-gold-soft)]">{step.label}</div>
              <div className="mt-2 text-base font-semibold leading-6 text-[var(--app-ivory)]">
                {step.title}
              </div>
              <p className="mt-2 flex-1 text-sm leading-6 text-[var(--app-copy-muted)]">
                {step.description}
              </p>
              <p className="mt-3 text-xs leading-5 text-[var(--app-copy-soft)]">
                {step.note}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PremiumSectionIntro({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: string;
}) {
  return (
    <section className="rounded-[1.4rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.028)] px-5 py-5 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.42fr] lg:items-end">
        <div>
          <div className="app-caption text-[var(--app-gold-soft)]">{eyebrow}</div>
          <h2 className="mt-3 text-2xl text-[var(--app-ivory)] sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">
            {description}
          </p>
        </div>
        {aside ? (
          <div className="rounded-[1rem] border border-[var(--app-gold)]/16 bg-[var(--app-gold)]/8 px-4 py-3 text-sm leading-6 text-[var(--app-gold-text)]">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '깊은 사주풀이',
    description: '사주 깊은 사주풀이와 연간 부록의 미리보기 및 열람 화면입니다.',
    robots: { index: false, follow: false },
  };
}

export default async function SajuPremiumPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { sajuData } = reading;
  const readingKey = toSlug(reading.input);
  const encodedSlug = encodeURIComponent(slug);
  let hasLifetimeAccess = false;
  let yearlyAccessLabel: string | null = null;

  if (hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [entitlement, subscription, yearCoreEntitlement] = await Promise.all([
        getLifetimeReportEntitlement(user.id, readingKey, [slug]),
        getManagedSubscription(user.id),
        getTasteProductEntitlement(user.id, 'year-core', buildReadingProductScopeKey(readingKey)),
      ]);

      if (entitlement) {
        hasLifetimeAccess = true;
        yearlyAccessLabel = '평생 소장 권한';
      } else if (subscription && canUseSubscriptionForPremiumReport(subscription)) {
        yearlyAccessLabel = subscription.plan === 'premium_monthly' ? 'Premium 이용권' : '라이트 이용권';
      } else if (yearCoreEntitlement) {
        yearlyAccessLabel = '올해 핵심 구매';
      }
    }
  }

  const targetYear = new Date().getFullYear();
  const heroLabel = hasLifetimeAccess
    ? '깊은 사주풀이 · 전체 열람'
    : yearlyAccessLabel
      ? `${targetYear} 올해 전략서 · 전체 열람`
      : '깊은 사주풀이 · 미리보기';
  const heroTitle = hasLifetimeAccess
    ? '내 깊은 사주풀이'
    : yearlyAccessLabel
      ? `${targetYear} 올해 전략서`
      : '내 깊은 사주풀이 미리보기';
  const heroDescription = hasLifetimeAccess
    ? '타고난 사주를 먼저 확인하고, 올해 흐름과 월간 달력을 이어봅니다.'
    : yearlyAccessLabel
      ? '올해 흐름과 월간 타이밍을 먼저 확인하고, 필요하면 평생 소장 풀이로 확장합니다.'
      : '결제 전에는 실제로 어떤 답을 얻을 수 있는지 먼저 보고, 필요한 경우 소장권으로 이어집니다.';
  const readingSteps: PremiumReadingStep[] = hasLifetimeAccess
    ? [
        {
          label: '풀이',
          title: '깊은 사주풀이 본문',
          description: '타고난 구조와 평생 흐름을 먼저 확인합니다.',
          href: '#premium-lifetime',
          status: '열림',
          note: '처음 읽는 장입니다.',
        },
        {
          label: '올해',
          title: `${targetYear} 올해 전략서`,
          description: '올해 주제와 분야별 선택 힌트를 이어봅니다.',
          href: '#premium-yearly',
          status: '열림',
          note: '풀이를 올해 선택으로 옮깁니다.',
        },
        {
          label: '달별',
          title: '달별 흐름',
          description: '월간 타이밍과 해금한 달을 다시 확인합니다.',
          href: '#premium-calendar',
          status: '연결',
          note: '실행 날짜를 고르는 부록입니다.',
        },
      ]
    : yearlyAccessLabel
      ? [
          {
            label: '올해',
            title: `${targetYear} 올해 전략서`,
            description: '구독 권한으로 열린 올해 흐름을 먼저 확인합니다.',
            href: '#premium-yearly',
            status: '열림',
            note: '올해의 큰 주제부터 봅니다.',
          },
          {
            label: '달별',
            title: '달별 흐름',
            description: '월간 타이밍과 해금한 달을 다시 확인합니다.',
            href: '#premium-calendar',
            status: '연결',
            note: '해금한 월은 다시 차감 없이 확인합니다.',
          },
          {
            label: '확장',
            title: '평생 소장 풀이',
            description: '타고난 사주와 큰 흐름을 오래 남기는 상품입니다.',
            href: '#premium-upgrade',
            status: '선택',
            note: '올해 운의 바탕을 따로 보관합니다.',
          },
        ]
      : [
          {
            label: '미리보기',
            title: '풀이 미리보기',
            description: '결제 전 본문 구성과 소장 가치를 확인합니다.',
            href: '#premium-preview',
            status: '공개',
          note: '구매 전 결과의 밀도를 봅니다.',
          },
          {
            label: '달별',
            title: '달별 흐름',
            description: '월간 흐름 구조를 먼저 살펴봅니다.',
            href: '#premium-calendar',
            status: '일부',
            note: '월간 달력의 형태를 확인합니다.',
          },
          {
            label: '샘플',
            title: '샘플 풀이',
            description: '완성형 리포트의 실제 풀이를 봅니다.',
            href: REPORT_SAMPLE_HREF,
            status: '보기',
            note: '완성본의 밀도를 비교합니다.',
          },
        ];
  const readingMapDescription = hasLifetimeAccess
    ? '깊은 사주풀이는 타고난 바탕, 올해 전략, 달별 실행이 한 흐름으로 이어지도록 정리했습니다.'
    : yearlyAccessLabel
      ? '구독 권한에서는 올해 전략과 달별 흐름을 먼저 보고, 필요한 경우 타고난 사주풀이를 별도 소장으로 확장합니다.'
      : '아직 결제 전이라면 미리보기, 달별 흐름, 샘플 풀이에서 실제로 남는 내용을 먼저 확인하시면 됩니다.';

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <SajuScreenNav slug={slug} current="premium" />

        <section className="gangi-report-panel p-7 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <Badge className="border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
                {heroLabel}
              </Badge>
              <h1 className="mt-5 text-4xl text-[var(--app-ivory)] sm:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--app-copy)]">
                {heroDescription}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">
                지금 궁금한 선택, 올해 흐름, 다시 볼 내용을 한 화면에서 바로 확인할 수 있게 정리했습니다.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {readingSteps.map((step) => (
                  <Link
                    key={step.href}
                    href={step.href}
                    className="gangi-secondary-button"
                  >
                    {step.label} 보기
                  </Link>
                ))}
                {hasLifetimeAccess ? (
                  <TrackedLink
                    href={`/saju/${slug}/premium/print`}
                    eventName="report_pdf_click"
                    eventParams={{ slug, from: 'premium_hero', status: 'available' }}
                    className="gangi-primary-button"
                  >
                    PDF로 저장하기
                  </TrackedLink>
                ) : null}
              </div>
            </div>
            <aside className="rounded-[1.35rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.035)] p-5">
              <div className="app-caption">지금 바로 볼 내용</div>
              <div className="mt-4 grid gap-3">
                {readingSteps.map((step, index) => (
                  <Link
                    key={step.title}
                    href={step.href}
                    className="group rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 transition-colors hover:border-[var(--app-gold)]/30 hover:bg-[var(--app-gold)]/8"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-sm font-semibold text-[var(--app-gold-text)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[var(--app-ivory)]">
                            {step.title}
                          </span>
                          <span className="shrink-0 rounded-full border border-[var(--app-line)] px-2.5 py-1 text-[11px] text-[var(--app-copy-soft)]">
                            {step.status}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-[var(--app-copy-muted)]">
                          {step.description}
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <PremiumReadingMap
          title="핵심은 바로 보고, 필요한 내용만 깊게 봅니다"
          description={readingMapDescription}
          steps={readingSteps}
        />

        <section className="app-panel p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div>
              <div className="app-caption">결제 전 확인</div>
              <h2 className="mt-3 text-2xl text-[var(--app-ivory)] sm:text-3xl">
                결제 전에는 받을 내용을 먼저 확인합니다
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {REPORT_PREVIEW_VALUE_POINTS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4"
                >
                  <div className="text-sm font-semibold text-[var(--app-ivory)]">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!hasLifetimeAccess ? (
          <section className="app-panel p-5 sm:p-6">
            <div className="app-caption">작은 맛보기</div>
            <h2 className="mt-3 text-2xl text-[var(--app-ivory)] sm:text-3xl">
              풀이가 부담스러우면 작은 질문부터 열어봅니다
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {TASTE_PRODUCTS.map((product) => (
                <Link
                  key={product.slug}
                  href={getTasteProductHref(product.slug, encodedSlug, targetYear)}
                  className="rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 transition-colors hover:border-[var(--app-gold)]/30 hover:bg-[var(--app-gold)]/8"
                >
                  <div className="text-xs font-semibold text-[var(--app-gold-text)]">{product.price}</div>
                  <div className="mt-2 text-base font-semibold leading-6 text-[var(--app-ivory)]">{product.title}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">{product.result}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {hasLifetimeAccess ? (
          <>
            <PremiumSectionIntro
              eyebrow="1장 · 평생 힌트"
              title="내 사주의 큰 흐름을 먼저 확인합니다"
              description="타고난 성향, 관계와 일의 결을 먼저 훑은 뒤 올해 운으로 넘어가면 같은 문장도 덜 흩어져 보입니다."
            />
            <div id="premium-lifetime" className="scroll-mt-28">
              <LifetimeReportPanel slug={slug} targetYear={targetYear} />
            </div>
            <PremiumSectionIntro
              eyebrow="2장 · 올해 전략"
              title={`${targetYear}년에 실제로 무엇을 조절할지 봅니다`}
              description="평생 풀이에서 잡은 성향과 보완 방향을 올해의 일, 돈, 관계, 생활 리듬으로 옮긴 부록입니다."
            />
            <div id="premium-yearly" className="scroll-mt-28">
              <YearlyReportPanel slug={slug} targetYear={targetYear} />
            </div>
            <PremiumSectionIntro
              eyebrow="3장 · 월간 실행"
              title="월별 흐름은 다시 열어보는 실행 달력입니다"
              description="이미 해금한 월간 흐름은 일정 판단을 다시 할 때 꺼내보는 영역입니다. 좋은 날과 확인할 날은 이곳에서 이어집니다."
            />
            <div id="premium-calendar" className="scroll-mt-28">
              <FortuneCalendarPanel slug={slug} targetYear={targetYear} hasLifetimeAccess />
            </div>
          </>
        ) : yearlyAccessLabel ? (
          <>
            <PremiumSectionIntro
              eyebrow="1장 · 올해 전략"
              title="구독 권한으로 열린 올해 흐름부터 읽습니다"
              description="지금은 올해 주제와 월별 타이밍이 중심입니다. 평생 풀이는 별도 소장 상품이므로 타고난 성향과 큰 흐름은 아래에서 확장합니다."
            />
            <div id="premium-yearly" className="scroll-mt-28">
              <YearlyReportPanel slug={slug} targetYear={targetYear} />
            </div>
            <PremiumSectionIntro
              eyebrow="2장 · 월간 실행"
              title="해금한 월간 흐름은 실행 전에 다시 봅니다"
              description="월별 달력은 올해 전략을 실제 날짜 감각으로 옮기는 영역입니다. 이미 열린 항목은 같은 사주에서 다시 확인하는 흐름으로 이어집니다."
            />
            <div id="premium-calendar" className="scroll-mt-28">
              <FortuneCalendarPanel slug={slug} targetYear={targetYear} hasLifetimeAccess={false} />
            </div>
            <PremiumSectionIntro
              eyebrow="3장 · 소장 확장"
              title="올해 운의 바탕이 되는 풀이를 별도로 남깁니다"
              description="연간 전략을 반복해서 읽다 보면 결국 타고난 사주 흐름이 필요해집니다. 이 영역은 결제 상품과 링크를 그대로 유지한 확장 카드입니다."
            />
            <section id="premium-upgrade" className="grid scroll-mt-28 gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <article className="gangi-report-panel p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                    {yearlyAccessLabel}
                  </Badge>
                  <Badge className="border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] text-[var(--app-copy-soft)]">
                    풀이 본문은 별도 권한
                  </Badge>
                </div>
                <h2 className="mt-4 text-3xl text-[var(--app-gold-text)]">
                  올해 전략서는 열려 있고, 깊은 사주풀이는 별도로 보관합니다
                </h2>
                <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
                  지금 권한으로는 올해 흐름과 월별 타이밍을 모두 읽을 수 있습니다. 다만 평생 소장권은 타고난
                  성향, 관계 패턴, 재물 체질, 직업 방향, 건강 리듬, 10년 단위 큰 흐름을
                  장기 풀이로 보관하는 별도 상품입니다.
                </p>
                <div className="mt-6 grid gap-3">
                  {SAJU_PREMIUM_SECTIONS.map((item) => (
                    <div key={item} className="gangi-payment-row px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
                      {item}
                    </div>
                  ))}
                </div>
              </article>
              <article className="gangi-plan-card p-6" data-featured="true">
                <div className=" text-2xl text-[var(--app-gold-text)]">
                  평생 소장 풀이로 확장하기
                </div>
                <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
                  올해 전략서가 “올해의 흐름”이라면, 평생 소장 풀이는 “내 사주의 원본 해설서”입니다.
                  같은 단서를 쓰더라도 역할이 다르기 때문에, 타고난 사주 중심 풀이는 별도의 보관형 본문으로
                  나뉘어야 합니다.
                </p>
                <div className="mt-5 grid gap-3">
                  {SAJU_PREMIUM_VALUE_POINTS.map((item) => (
                    <div key={item} className="gangi-payment-row px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-[1.2rem] border border-[var(--app-gold)]/18 bg-[rgba(255,255,255,0.02)] px-5 py-5 text-center">
                  <div className=" text-2xl text-[var(--app-gold-text)]">깊은 사주풀이 · 49,000원</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                    풀이 본문과 올해 부록을 함께 열고, 같은 사주로 다시 들어와도 계속
                    읽으실 수 있습니다.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <Link
                      href={`/membership/checkout?plan=lifetime&slug=${encodedSlug}&from=saju-premium`}
                      className="gangi-primary-button"
                    >
                      풀이 열기
                    </Link>
                    <Link
                      href={`/saju/${slug}`}
                      className="gangi-secondary-button"
                    >
                      기본 결과로 돌아가기
                    </Link>
                  </div>
                </div>
              </article>
            </section>
          </>
        ) : (
        <>
        <PremiumSectionIntro
          eyebrow="미리보기 · 결제 전"
          title="풀이에서 실제로 무엇이 남는지 먼저 확인합니다"
          description="잠긴 본문을 길게 보여주기보다, 첫 섹션의 톤과 소장 상품의 핵심을 빠르게 확인하도록 정리했습니다."
          aside="결제 링크와 상품 ID는 변경하지 않았습니다."
        />
        <section id="premium-preview" className="grid scroll-mt-28 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="gangi-report-panel p-6">
            <div className="app-caption">결제 전 미리보기</div>
            <div className="mt-4 text-2xl text-[var(--app-ivory)]">
              ① 풀이 첫 섹션 미리보기
            </div>
            <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
              선생님의 일주는 {sajuData.pillars.day.ganzi}입니다. {sajuData.dayMaster.metaphor ?? '자연의 상징'}이
              깊은 밤의 물결과 만나는 형상처럼, 밖으로는 밝고 따뜻하시지만 안쪽에는 사유의
              결이 함께 흐르는 모습입니다.
            </p>

            <div className="relative mt-6 overflow-hidden rounded-[1.3rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-5">
              <div className="select-none blur-[5px] opacity-65">
                <p className="text-sm leading-8 text-[var(--app-copy)]">
                  이 일간의 세부 풀이에서는 타고난 표현 방식, 관계에서 피로가 쌓이는 지점,
                  큰 흐름 안에서 오래 가져갈 힌트를 이어서 정리합니다. 본문은 개인의 사주 흐름으로
                  다시 쓰이며, 같은 풀이에서 다시 열람할 수 있습니다.
                </p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full border border-[var(--app-gold)]/30 bg-[rgba(7,19,39,0.78)] px-4 py-2 text-sm font-semibold text-[var(--app-gold-text)]">
                  잠긴 본문
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {SAJU_PREMIUM_PREVIEW.map((item) => (
                <div
                  key={item.title}
                  className="gangi-payment-row px-4 py-4"
                >
                  <div className="text-sm font-medium text-[var(--app-ivory)]">{item.title}</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--app-copy-muted)]">{item.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="gangi-plan-card p-6" data-featured="true">
            <div className=" text-2xl text-[var(--app-gold-text)]">
              7개 섹션 완성형 풀이
            </div>
            <div className="mt-5 grid gap-2">
              {SAJU_PREMIUM_SECTIONS.map((item) => (
                <div
                  key={item}
                  className="gangi-payment-row px-4 py-3 text-sm text-[var(--app-copy)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.2rem] border border-[var(--app-gold)]/18 bg-[rgba(255,255,255,0.02)] px-5 py-5">
              <div className="app-caption">왜 여기서 풀이로 넘어가실까요?</div>
              <div className="mt-4 space-y-3">
                {SAJU_PREMIUM_VALUE_POINTS.map((item) => (
                  <div key={item} className="text-sm leading-7 text-[var(--app-copy)]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-5">
              <div className="app-caption">소장 가치</div>
              <div className="mt-4 grid gap-3">
                {[
                  '요약과 본문이 함께 남는 PDF 저장본',
                  'MY 보관함에서 다시 여는 풀이 본문',
                  '업데이트 반영본을 나중에 다시 확인하는 재열람 구조',
                ].map((item) => (
                  <div key={item} className="text-sm leading-7 text-[var(--app-copy)]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[1.2rem] border border-[var(--app-gold)]/18 bg-[rgba(255,255,255,0.02)] px-5 py-5 text-center">
              <div className=" text-2xl text-[var(--app-gold-text)]">깊은 사주풀이 · 49,000원</div>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
                오늘 바로 7개 섹션 본문과 PDF 저장, MY 보관함 재열람, 이후 업데이트 반영이 함께 열립니다.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/membership/checkout?plan=lifetime&slug=${encodedSlug}&from=saju-premium`}
                  className="gangi-primary-button"
                >
                  풀이 열기
                </Link>
                <Link
                  href={`/membership/checkout?plan=premium&slug=${encodedSlug}&from=saju-premium`}
                  className="gangi-secondary-button"
                >
                  멤버십으로 먼저 보기
                </Link>
                <Link
                  href={REPORT_SAMPLE_HREF}
                  className="gangi-secondary-button"
                >
                  샘플 풀이 다시 보기
                </Link>
              </div>
            </div>
          </article>
        </section>
        <PremiumSectionIntro
          eyebrow="부록 · 달별 흐름"
          title="월간 달력은 풀이를 열기 전에도 구조를 볼 수 있습니다"
          description="월별 흐름은 긴 풀이를 대신하는 실행 보조 영역입니다. 실제 해금과 재열람 정책은 기존 달력 로직을 그대로 따릅니다."
        />
        <div id="premium-calendar" className="scroll-mt-28">
          <FortuneCalendarPanel slug={slug} targetYear={targetYear} hasLifetimeAccess={false} />
        </div>
        </>
        )}

        <section className="app-panel p-5 sm:p-6">
          <div className="app-caption">달빛인생의 약속</div>
          <h2 className="mt-3 text-2xl text-[var(--app-ivory)] sm:text-3xl">
            무섭게 맞힌다는 말보다, 다시 확인할 수 있는 풀이를 남깁니다
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {TRUST_SIGNALS.map((signal) => (
              <div
                key={signal.title}
                className="rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4"
              >
                <div className="text-sm font-semibold text-[var(--app-ivory)]">{signal.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">{signal.body}</p>
              </div>
            ))}
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}
