import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TrackedLink } from '@/components/common/tracked-link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { Badge } from '@/components/ui/badge';
import FortuneCalendarPanel from '@/components/ai/fortune-calendar-panel';
import LifetimeReportPanel from '@/components/ai/lifetime-report-panel';
import YearlyReportPanel from '@/components/ai/yearly-report-panel';
import {
  REPORT_SAMPLE_HREF,
  SAJU_PREMIUM_SECTIONS,
  SAJU_PREMIUM_VALUE_POINTS,
  TASTE_PRODUCTS,
  TRUST_SIGNALS,
} from '@/content/moonlight';
import { toSlug } from '@/lib/saju/pillars';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { buildYearCoreScopeKey } from '@/lib/payments/product-scope';
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
    return `/membership/checkout?product=year-core&slug=${encodedSlug}&scope=${targetYear}&from=saju-premium`;
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

function SmallQuestionProducts({
  encodedSlug,
  targetYear,
}: {
  encodedSlug: string;
  targetYear: number;
}) {
  return (
    <section className="rounded-[1.4rem] border border-[var(--app-line)] bg-white px-5 py-5 sm:px-6">
      <div className="app-caption text-[var(--app-pink-strong)]">작은 질문</div>
      <h2 className="mt-3 text-2xl text-[var(--app-ink)] sm:text-3xl">
        궁금한 것 하나만 먼저 볼 수도 있어요
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {TASTE_PRODUCTS.map((product) => (
          <Link
            key={product.slug}
            href={getTasteProductHref(product.slug, encodedSlug, targetYear)}
            className="rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 transition-colors hover:border-[var(--app-pink-line)] hover:bg-[var(--app-pink-soft)]"
          >
            <div className="text-xs font-semibold text-[var(--app-pink-strong)]">{product.price}</div>
            <div className="mt-2 text-base font-semibold leading-6 text-[var(--app-ink)]">{product.title}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">{product.result}</p>
          </Link>
        ))}
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
    <section className="rounded-[1.4rem] border border-[var(--app-line)] bg-white px-5 py-5 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.42fr] lg:items-end">
        <div>
          <div className="app-caption text-[var(--app-gold-soft)]">{eyebrow}</div>
          <h2 className="mt-3 text-2xl text-[var(--app-ink)] sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy-muted)]">
            {description}
          </p>
        </div>
        {aside ? (
          <div className="rounded-[1rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-4 py-3 text-sm leading-6 text-[var(--app-pink-strong)]">
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
    description: '사주 깊은 사주풀이와 연간 흐름 열람 화면입니다.',
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
  const targetYear = new Date().getFullYear();
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
        getTasteProductEntitlement(user.id, 'year-core', buildYearCoreScopeKey(readingKey, targetYear)),
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

  const heroLabel = hasLifetimeAccess
    ? '깊은 풀이 · 열림'
    : yearlyAccessLabel
      ? `${targetYear} 올해 흐름 · 열림`
      : '깊은 풀이 · 안내';
  const heroTitle = hasLifetimeAccess
    ? '내 사주를 자세히 봅니다'
    : yearlyAccessLabel
      ? `${targetYear} 올해 흐름`
      : '깊은 풀이로 이어보기';
  const heroDescription = hasLifetimeAccess
    ? '타고난 성향, 올해 흐름, 월별 타이밍을 차례로 봅니다.'
    : yearlyAccessLabel
      ? '올해의 큰 주제와 월별 타이밍을 먼저 확인합니다.'
      : '열리는 내용을 짧게 확인하고 필요한 풀이만 고릅니다.';
  const readingSteps: PremiumReadingStep[] = hasLifetimeAccess
    ? [
        {
          label: '풀이',
          title: '자세한 사주풀이',
          description: '타고난 성향과 큰 흐름을 확인합니다.',
          href: '#premium-lifetime',
          status: '열림',
          note: '처음 읽는 장입니다.',
        },
        {
          label: '올해',
          title: `${targetYear} 올해 흐름`,
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
          title: `${targetYear} 올해 흐름`,
          description: '열려 있는 올해 흐름을 확인합니다.',
            href: '#yearly-chapter-1',
            status: '열림',
            note: '올해의 큰 주제부터 봅니다.'
          },
          {
            label: '달력',
            title: '달별 흐름',
            description: '월간 타이밍과 해금한 달을 다시 확인합니다.',
            href: '#yearly-chapter-2',
            status: '연결',
            note: '해금한 월은 다시 차감 없이 확인합니다.'
          },
          {
            label: '확장',
            title: '자세한 사주풀이',
            description: '타고난 성향과 큰 흐름을 더 자세히 봅니다.',
            href: '#yearly-chapter-3',
            status: '선택',
            note: '올해 운의 바탕을 따로 보관합니다.'
          },
        ]
      : [
          {
            label: '안내',
            title: '열리는 내용',
            description: '결제 전에 열리는 구성을 확인합니다.',
            href: '#premium-guide',
            status: '공개',
            note: '구매 전 구성을 봅니다.',
          },
          {
            label: '달력',
            title: '달별 흐름',
            description: '월간 흐름 구조를 먼저 살펴봅니다.',
            href: '#premium-calendar',
            status: '일부',
            note: '월간 달력의 형태를 확인합니다.',
          },
          {
            label: '샘플',
            title: '샘플',
            description: '예시 화면을 봅니다.',
            href: REPORT_SAMPLE_HREF,
            status: '보기',
            note: '완성본의 밀도를 비교합니다.',
          },
        ];

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-readable-page space-y-6 pb-24">
        <GangiPageHeader title="깊게 보기" backHref={`/saju/${slug}`} />
        <SajuScreenNav slug={slug} current="premium" />

        <section className="rounded-[1.6rem] border border-[var(--app-line)] bg-white p-6 shadow-[0_16px_44px_rgba(17,17,20,0.06)] sm:p-7">
          <div className="max-w-4xl">
            <Badge className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              {heroLabel}
            </Badge>
            <h1 className="mt-5 text-2xl font-semibold leading-tight text-[var(--app-ink)] sm:text-3xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--app-copy)]">
              {heroDescription}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-xl">
              {readingSteps.map((step) => (
                <Link
                  key={step.href}
                  href={step.href}
                  className="gangi-secondary-button min-w-0 justify-center whitespace-nowrap px-2 text-center text-xs sm:text-sm"
                >
                  {step.label} 보기
                </Link>
              ))}
            </div>
            {hasLifetimeAccess ? (
              <div className="mt-3 sm:max-w-xs">
                <TrackedLink
                  href={`/saju/${slug}/premium/print`}
                  eventName="report_pdf_click"
                  eventParams={{ slug, from: 'premium_hero', status: 'available' }}
                  className="gangi-primary-button w-full justify-center"
                >
                  PDF로 저장하기
                </TrackedLink>
              </div>
            ) : null}
          </div>
        </section>

        {hasLifetimeAccess ? (
          <>
            <PremiumSectionIntro
              eyebrow="1장"
              title="내 성향과 큰 흐름"
              description="타고난 성향, 관계, 일의 흐름을 먼저 봅니다."
            />
            <div id="premium-lifetime" className="scroll-mt-28">
              <LifetimeReportPanel slug={slug} targetYear={targetYear} />
            </div>
            <PremiumSectionIntro
              eyebrow="2장"
              title={`${targetYear}년에 무엇을 조절할지 봅니다`}
              description="올해의 일, 돈, 관계, 생활 리듬을 짧게 나눠 봅니다."
            />
            <div id="premium-yearly" className="scroll-mt-28">
              <YearlyReportPanel slug={slug} targetYear={targetYear} />
            </div>
            <PremiumSectionIntro
              eyebrow="3장"
              title="월별 흐름"
              description="좋은 달, 확인할 달, 차분히 정리할 달을 다시 봅니다."
            />
            <div id="premium-calendar" className="scroll-mt-28">
              <FortuneCalendarPanel slug={slug} targetYear={targetYear} hasLifetimeAccess />
            </div>
          </>
        ) : yearlyAccessLabel ? (
          <>
            <PremiumSectionIntro
              eyebrow="1장"
              title="올해 흐름부터 봅니다"
              description="올해의 주제와 월별 타이밍을 먼저 확인합니다."
            />
            <div id="premium-yearly" className="scroll-mt-28">
              <YearlyReportPanel slug={slug} targetYear={targetYear} />
            </div>
            <SmallQuestionProducts encodedSlug={encodedSlug} targetYear={targetYear} />
          </>
        ) : (
        <>
        <PremiumSectionIntro
          eyebrow="안내"
          title="어떤 내용이 열리는지 먼저 확인합니다"
          description="잠긴 본문을 길게 보여주기보다 핵심만 짧게 보여드립니다."
          aside="결제 전 확인"
        />
        <section id="premium-guide" className="grid scroll-mt-28 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="gangi-report-panel p-6">
            <div className="app-caption">안내</div>
            <div className="mt-4 text-2xl text-[var(--app-ink)]">
              열리는 내용
            </div>
            <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">
              이 사주는 {sajuData.dayMaster.metaphor ?? '자연의 상징'}처럼 드러나는 기질을 중심으로 봅니다.
              겉으로 보이는 모습과 안쪽에서 오래 반복되는 마음의 결을 함께 확인합니다.
            </p>

            <div className="relative mt-6 overflow-hidden rounded-[1.3rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-5">
              <div className="select-none blur-[5px] opacity-65">
                <p className="text-sm leading-8 text-[var(--app-copy)]">
                  자세한 풀이에서는 표현 방식, 관계에서 피로가 쌓이는 지점,
                  큰 흐름 안에서 오래 가져갈 힌트를 이어서 보여드립니다.
                </p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full border border-[var(--app-gold)]/30 bg-[rgba(7,19,39,0.78)] px-4 py-2 text-sm font-semibold text-[var(--app-gold-text)]">
                  더 보기
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-5 text-sm leading-7 text-[var(--app-copy)]">
              성향, 올해 흐름, 월별 흐름을 열어 필요한 부분만 이어서 볼 수 있습니다.
            </div>
          </article>

          <article className="gangi-plan-card p-6" data-featured="true">
            <div className=" text-2xl text-[var(--app-gold-text)]">
              열리는 내용
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
              <div className="app-caption">왜 볼까요?</div>
              <div className="mt-4 space-y-3">
                {SAJU_PREMIUM_VALUE_POINTS.map((item) => (
                  <div key={item} className="text-sm leading-7 text-[var(--app-copy)]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-5">
              <div className="app-caption">다시 보기</div>
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
          eyebrow="달별 흐름"
          title="월별 흐름도 함께 볼 수 있어요"
          description="좋은 달, 확인할 달, 차분히 정리할 달을 나눠 봅니다."
        />
        <div id="premium-calendar" className="scroll-mt-28">
          <FortuneCalendarPanel slug={slug} targetYear={targetYear} hasLifetimeAccess={false} />
        </div>
        </>
        )}

        <section className="app-panel p-5 sm:p-6">
          <div className="app-caption">안심하고 보기</div>
          <h2 className="mt-3 text-2xl text-[var(--app-ink)] sm:text-3xl">
            무섭게 단정하지 않고, 다시 볼 수 있게 남깁니다
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
