// Redesign 2026-05-13: 사주 sub-tab '상세(premium)' 페이지 — PR6~PR10 디자인 언어로 통일.
// pink-soft hero + ZodiacChip + 깔끔한 챕터 intro + ink-dark upsell CTA.
// 결제·구독·entitlement 로직 / AI 패널 (LifetimeReportPanel/YearlyReportPanel/FortuneCalendarPanel)
// / 라우팅·트래킹 모두 무수정.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TrackedLink } from '@/components/common/tracked-link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
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
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake',
  午: 'horse', 未: 'sheep', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig',
};

const ZODIAC_KOR: Record<ZodiacKey, string> = {
  rat: '쥐띠', ox: '소띠', tiger: '범띠', rabbit: '토끼띠', dragon: '용띠', snake: '뱀띠',
  horse: '말띠', sheep: '양띠', monkey: '원숭이띠', rooster: '닭띠', dog: '개띠', pig: '돼지띠',
};

function getYearZodiac(data: SajuDataV1): ZodiacKey {
  const branch = data.pillars.year.branch;
  return BRANCH_TO_ZODIAC[branch] ?? 'dragon';
}

function canUseSubscriptionForPremiumReport(
  subscription: Awaited<ReturnType<typeof getManagedSubscription>>
) {
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

// Redesign helper — PR6~PR10 컴팩트 챕터 헤더.
function ChapterIntro({
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
    <section className="px-1">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)] sm:text-[20px]">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-[1.7] text-[var(--app-copy-muted)]">
        {description}
      </p>
      {aside ? (
        <p
          className="mt-3 inline-block rounded-full border px-3 py-1 text-[11px] font-bold text-[var(--app-pink-strong)]"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          {aside}
        </p>
      ) : null}
    </section>
  );
}

function SmallQuestionProducts({
  encodedSlug,
  targetYear,
}: {
  encodedSlug: string;
  targetYear: number;
}) {
  return (
    <section className="px-1">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
        작은 질문
      </div>
      <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
        궁금한 것 하나만 먼저 봐도 좋아요
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {TASTE_PRODUCTS.map((product) => (
          <Link
            key={product.slug}
            href={getTasteProductHref(product.slug, encodedSlug, targetYear)}
            className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5 transition-colors hover:border-[var(--app-pink-line)] hover:bg-[var(--app-pink-soft)]"
          >
            <div className="text-[11px] font-extrabold text-[var(--app-pink-strong)]">
              {product.price}
            </div>
            <div className="mt-1.5 text-[14px] font-extrabold leading-snug text-[var(--app-ink)]">
              {product.title}
            </div>
            <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]">
              {product.result}
            </p>
          </Link>
        ))}
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
        getTasteProductEntitlement(
          user.id,
          'year-core',
          buildYearCoreScopeKey(readingKey, targetYear)
        ),
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
            note: '올해의 큰 주제부터 봅니다.',
          },
          {
            label: '달력',
            title: '달별 흐름',
            description: '월간 타이밍과 해금한 달을 다시 확인합니다.',
            href: '#yearly-chapter-2',
            status: '연결',
            note: '해금한 월은 다시 차감 없이 확인합니다.',
          },
          {
            label: '확장',
            title: '자세한 사주풀이',
            description: '타고난 성향과 큰 흐름을 더 자세히 봅니다.',
            href: '#yearly-chapter-3',
            status: '선택',
            note: '올해 운의 바탕을 따로 보관합니다.',
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

  const yearZodiac = getYearZodiac(sajuData);
  const yearZodiacLabel = ZODIAC_KOR[yearZodiac];
  const dayMasterPillar = `${sajuData.pillars.day.ganzi}일주`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
          <GangiPageHeader title="상세" backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="premium" />

          {/* §1 Hero — PR6~PR10 패턴 */}
          <article
            className="rounded-[18px] border border-[var(--app-line)] p-5"
            style={{ background: 'var(--app-pink-soft)' }}
          >
            <div className="flex items-center gap-3">
              <ZodiacChip kind={yearZodiac} size="lg" />
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  {dayMasterPillar} · {yearZodiacLabel} · {heroLabel}
                </div>
                <h1 className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
                  {heroTitle}
                </h1>
                <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]">
                  {heroDescription}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {readingSteps.map((step) => (
                <Link
                  key={step.href}
                  href={step.href}
                  className="rounded-full border border-[var(--app-line)] bg-white px-2 py-2 text-center text-[12px] font-bold text-[var(--app-copy-muted)] transition-colors hover:border-[var(--app-pink-line)] hover:text-[var(--app-pink-strong)]"
                >
                  {step.label} 보기
                </Link>
              ))}
            </div>

            {hasLifetimeAccess ? (
              <TrackedLink
                href={`/saju/${slug}/premium/print`}
                eventName="report_pdf_click"
                eventParams={{ slug, from: 'premium_hero', status: 'available' }}
                className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                PDF로 저장하기
              </TrackedLink>
            ) : null}
          </article>

          {hasLifetimeAccess ? (
            <>
              <ChapterIntro
                eyebrow="1장"
                title="내 성향과 큰 흐름"
                description="타고난 성향, 관계, 일의 흐름을 먼저 봅니다."
              />
              <div id="premium-lifetime" className="scroll-mt-28">
                <LifetimeReportPanel slug={slug} targetYear={targetYear} />
              </div>
              <ChapterIntro
                eyebrow="2장"
                title={`${targetYear}년에 무엇을 조절할지 봅니다`}
                description="올해의 일, 돈, 관계, 생활 리듬을 짧게 나눠 봅니다."
              />
              <div id="premium-yearly" className="scroll-mt-28">
                <YearlyReportPanel slug={slug} targetYear={targetYear} />
              </div>
              <ChapterIntro
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
              <ChapterIntro
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
              <ChapterIntro
                eyebrow="안내"
                title="어떤 내용이 열리는지 먼저 봅니다"
                description="잠긴 본문을 길게 보여주기보다 핵심만 짧게 보여드립니다."
                aside="결제 전 확인"
              />

              <section id="premium-guide" className="scroll-mt-28 px-1">
                <article className="rounded-[18px] border border-[var(--app-line)] bg-white p-5">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    열리는 내용
                  </div>
                  <p className="mt-2.5 text-[14px] leading-[1.7] text-[var(--app-copy)]">
                    이 사주는 {sajuData.dayMaster.metaphor ?? '자연의 상징'}처럼 드러나는 기질을
                    중심으로 봅니다. 겉으로 보이는 모습과 안쪽에서 오래 반복되는 마음의 결을 함께
                    확인합니다.
                  </p>

                  <div
                    className="relative mt-4 overflow-hidden rounded-[14px] border border-[var(--app-line)] px-4 py-4"
                    style={{ background: 'var(--app-surface-muted, rgba(0,0,0,0.02))' }}
                  >
                    <div className="select-none blur-[5px] opacity-65">
                      <p className="text-[13px] leading-[1.7] text-[var(--app-copy)]">
                        자세한 풀이에서는 표현 방식, 관계에서 피로가 쌓이는 지점, 큰 흐름 안에서
                        오래 가져갈 힌트를 이어서 보여드립니다.
                      </p>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white"
                        style={{ background: 'rgba(17,17,20,0.78)' }}
                      >
                        🔒 결제 후 열림
                      </span>
                    </div>
                  </div>

                  <ul className="mt-4 grid gap-1.5">
                    {SAJU_PREMIUM_SECTIONS.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 text-[13px] leading-[1.55] text-[var(--app-copy)]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--app-pink)' }}
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              </section>

              <article
                className="rounded-[18px] p-5 text-white"
                style={{
                  background: 'var(--app-ink)',
                  boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                    style={{ background: 'var(--app-pink)' }}
                  >
                    VIP
                  </span>
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ opacity: 0.7 }}
                  >
                    PREMIUM
                  </span>
                </div>
                <h2 className="mt-2 text-[19px] font-extrabold leading-snug tracking-tight">
                  깊은 사주풀이
                  <br />
                  내 인생 흐름 잡기
                </h2>
                <ul className="mt-3 grid gap-1.5">
                  {SAJU_PREMIUM_VALUE_POINTS.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[12.5px] leading-[1.55]"
                      style={{ color: 'rgba(255,255,255,0.82)' }}
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: 'var(--app-pink)' }}
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-end gap-2.5">
                  <div className="text-[23px] font-extrabold tracking-tight">49,000원</div>
                  <div
                    className="mb-1.5 text-[11px] line-through"
                    style={{ opacity: 0.5 }}
                  >
                    69,000원
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={`/membership/checkout?plan=lifetime&slug=${encodedSlug}&from=saju-premium`}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                  >
                    풀이 열기 →
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/membership/checkout?plan=premium&slug=${encodedSlug}&from=saju-premium`}
                      className="inline-flex items-center justify-center rounded-full border border-white/24 px-3 py-2.5 text-[12.5px] font-bold text-white/85"
                    >
                      멤버십으로 먼저
                    </Link>
                    <Link
                      href={REPORT_SAMPLE_HREF}
                      className="inline-flex items-center justify-center rounded-full border border-white/24 px-3 py-2.5 text-[12.5px] font-bold text-white/85"
                    >
                      샘플 보기
                    </Link>
                  </div>
                </div>
              </article>

              <ChapterIntro
                eyebrow="달별 흐름"
                title="월별 흐름도 함께 볼 수 있어요"
                description="좋은 달, 확인할 달, 차분히 정리할 달을 나눠 봅니다."
              />
              <div id="premium-calendar" className="scroll-mt-28">
                <FortuneCalendarPanel
                  slug={slug}
                  targetYear={targetYear}
                  hasLifetimeAccess={false}
                />
              </div>
            </>
          )}

          {/* §last 안심 정보 — trust signals */}
          <section className="px-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              안심하고 보기
            </div>
            <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
              무섭게 단정하지 않고, 다시 볼 수 있게 남깁니다
            </h2>
            <div className="mt-3 grid gap-2.5 md:grid-cols-2">
              {TRUST_SIGNALS.map((signal) => (
                <article
                  key={signal.title}
                  className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                >
                  <div className="text-[13px] font-extrabold text-[var(--app-ink)]">
                    {signal.title}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]">
                    {signal.body}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
