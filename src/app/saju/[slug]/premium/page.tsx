// Redesign 2026-05-14: 깊은 풀이 화면 ‘돋보이게’ 리디자인.
// (이전 2026-05-13: pink-soft hero + ZodiacChip + 챕터 intro 의 골격은 유지)
// 추가/강화:
//   · 명찰 hero: 결제 권한 라벨(평생/올해/멤버십)을 명확한 ✓ 배지로.
//   · 풀이 chapter intro 가 평이한 텍스트 → "큰 흐름/올해/월별" 토큰 컬러
//     hero 카드(jade/amber/indigo) + 번호 배지 + 한 줄 강조 카피.
//   · AI 패널(LifetimeReportPanel/YearlyReportPanel/FortuneCalendarPanel)을
//     <div className="premium-ai-panel"> 로 감싸 readability CSS 적용.
//   · 결제·구독·entitlement 로직 / AI 패널 내부 / 라우팅·트래킹 모두 무수정.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TrackedLink } from '@/components/common/tracked-link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import FortuneCalendarPanel from '@/components/ai/fortune-calendar-panel';
import LifetimeReportPanel from '@/components/ai/lifetime-report-panel';
import YearlyReportPanel from '@/components/ai/yearly-report-panel';
// 2026-05-16 PR #181 — 6 영역 카드 통일 (사주 메인/오늘 운세와 동일).
import { EntitlementRefresher } from '@/components/saju/entitlement-refresher';
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
import {
  getTasteProductEntitlement,
  hasAnyMonthlyCalendarForReading,
} from '@/lib/product-entitlements';
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
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
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

function getYearZodiac(data: SajuDataV1 | SajuDataV2): ZodiacKey {
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

// Redesign 2026-05-14 — 평이한 챕터 텍스트 대신 토큰 컬러 hero 카드.
// number/jade/amber/indigo/pink 의 시각적 강조로 "비싼 풀이임" 을 즉시 인지.
const CHAPTER_TONES = {
  jade: {
    bg: '#e8f5ee',
    accent: 'var(--app-jade)',
    border: 'rgba(45,135,88,0.22)',
    shadow: '0 18px 44px -28px rgba(45,135,88,0.42)',
  },
  amber: {
    bg: '#fdf6e7',
    accent: '#b87a14',
    border: 'rgba(184,122,20,0.24)',
    shadow: '0 18px 44px -28px rgba(184,122,20,0.42)',
  },
  indigo: {
    bg: '#eef0fb',
    accent: '#4a5cb8',
    border: 'rgba(74,92,184,0.24)',
    shadow: '0 18px 44px -28px rgba(74,92,184,0.42)',
  },
  pink: {
    bg: 'var(--app-pink-soft)',
    accent: 'var(--app-pink-strong)',
    border: 'var(--app-pink-line)',
    shadow: '0 18px 44px -28px rgba(216,27,114,0.42)',
  },
} as const;

function ChapterIntro({
  number,
  tone = 'pink',
  eyebrow,
  title,
  description,
  highlight,
  aside,
}: {
  number?: number;
  tone?: keyof typeof CHAPTER_TONES;
  eyebrow: string;
  title: string;
  description: string;
  highlight?: string;
  aside?: string;
}) {
  const palette = CHAPTER_TONES[tone];
  return (
    <section className="px-1">
      <article
        className="relative overflow-hidden rounded-[20px] border p-5"
        style={{
          background: palette.bg,
          borderColor: palette.border,
          boxShadow: palette.shadow,
        }}
      >
        {/* deco half-circle */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-50"
          style={{
            background: `radial-gradient(circle, ${palette.accent}28, transparent 70%)`,
          }}
        />

        <div className="relative flex items-start gap-3">
          {number ? (
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[18px] font-extrabold text-white"
              style={{
                background: palette.accent,
                boxShadow: `0 8px 18px ${palette.accent}40`,
                fontFamily: 'var(--font-han)',
              }}
              aria-hidden="true"
            >
              {number}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.06em]"
              style={{ color: palette.accent }}
            >
              {eyebrow}
            </div>
            <h2
              className="mt-1 text-[20px] font-extrabold leading-[1.35] tracking-tight text-[var(--app-ink)] sm:text-[22px]"
              style={{ wordBreak: 'keep-all' }}
            >
              {title}
            </h2>
            <p
              className="mt-2 text-[13.5px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {description}
            </p>
            {highlight ? (
              <p
                className="mt-2.5 inline-block rounded-full border px-3 py-1 text-[11.5px] font-extrabold"
                style={{
                  background: '#fff',
                  borderColor: palette.border,
                  color: palette.accent,
                }}
              >
                ✦ {highlight}
              </p>
            ) : null}
            {aside ? (
              <p
                className="mt-2.5 inline-block rounded-full border px-3 py-1 text-[11px] font-extrabold"
                style={{
                  background: 'var(--app-pink-soft)',
                  borderColor: 'var(--app-pink-line)',
                  color: 'var(--app-pink-strong)',
                }}
              >
                {aside}
              </p>
            ) : null}
          </div>
        </div>
      </article>
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
  // 2026-05-16 PR #182 — hero card 의 "달력" 버튼 anchor 타깃.
  //   이전엔 #yearly-chapter-2 라는 미존재 id 였음 (사용자 보고: 버튼 클릭 안 됨).
  return (
    <section id="premium-monthly" className="scroll-mt-28 px-1">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
        작은 질문
      </div>
      <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
        궁금한 것 하나만 먼저 봐도 좋아요
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {TASTE_PRODUCTS.filter((product) => !product.compatibilityOnly).map((product) => (
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
  // 2026-05-18 — 1,900원 monthly-calendar 단독 구매자도 상세 화면(캘린더 + 잠금 1·2 preview)
  //   로 진입하도록 추가. lifetime / yearly 보다 우선순위 낮음.
  let monthlyAccessLabel: string | null = null;
  // 2026-05-16 — 활성 멤버십 plan 을 추적해 plan=premium 결제 CTA 가 중복 결제로
  //   이어지지 않도록 분기. checkout 단계에서도 차단되지만 진입 button 에서도 안내.
  let activeMembershipPlan: string | null = null;

  if (hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [entitlement, subscription, yearCoreEntitlement, hasMonthlyCalendar] = await Promise.all([
        getLifetimeReportEntitlement(user.id, readingKey, [slug]),
        getManagedSubscription(user.id),
        getTasteProductEntitlement(
          user.id,
          'year-core',
          buildYearCoreScopeKey(readingKey, targetYear)
        ),
        hasAnyMonthlyCalendarForReading(user.id, readingKey),
      ]);

      if (entitlement) {
        hasLifetimeAccess = true;
        yearlyAccessLabel = '평생 소장 권한';
      } else if (subscription && canUseSubscriptionForPremiumReport(subscription)) {
        yearlyAccessLabel = subscription.plan === 'premium_monthly' ? 'Premium 이용권' : '라이트 이용권';
      } else if (yearCoreEntitlement) {
        yearlyAccessLabel = '올해 핵심 구매';
      } else if (hasMonthlyCalendar) {
        monthlyAccessLabel = '월간 달력 구매';
      }
      if (subscription && subscription.status === 'active') {
        activeMembershipPlan = subscription.plan;
      }
    }
  }

  const heroLabel = hasLifetimeAccess
    ? '깊은 풀이 · 열림'
    : yearlyAccessLabel
      ? `${targetYear} 올해 흐름 · 열림`
      : monthlyAccessLabel
        ? '월별 흐름 · 열림'
        : '깊은 풀이 · 안내';
  const heroTitle = hasLifetimeAccess
    ? '내 사주를 자세히 봅니다'
    : yearlyAccessLabel
      ? `${targetYear} 올해 흐름`
      : monthlyAccessLabel
        ? '이번 달 흐름부터 봅니다'
        : '깊은 풀이로 이어보기';
  const heroDescription = hasLifetimeAccess
    ? '타고난 성향, 올해 흐름, 월별 타이밍을 차례로 봅니다.'
    : yearlyAccessLabel
      ? '올해의 큰 주제와 월별 타이밍을 먼저 확인합니다.'
      : monthlyAccessLabel
        ? '월별 타이밍부터 보고, 큰 흐름과 올해 흐름은 잠금 미리보기로 둘러봅니다.'
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
    : monthlyAccessLabel
      ? [
          {
            label: '달별',
            title: '월별 흐름',
            description: '해금한 달과 다음 달 타이밍을 봅니다.',
            href: '#premium-calendar',
            status: '열림',
            note: '먼저 보는 장입니다.',
          },
          {
            label: '큰 흐름',
            title: '자세한 사주풀이 (잠금)',
            description: '결제 후 큰 흐름이 함께 열립니다.',
            href: '#premium-locked-lifetime',
            status: '잠금',
            note: '미리보기로 구성을 봅니다.',
          },
          {
            label: '올해',
            title: `${targetYear} 올해 흐름 (잠금)`,
            description: '올해의 큰 주제는 결제 후 열립니다.',
            href: '#premium-locked-yearly',
            status: '잠금',
            note: '미리보기로 구성을 봅니다.',
          },
        ]
      : yearlyAccessLabel
      ? [
          {
            label: '올해',
            title: `${targetYear} 올해 흐름`,
            description: '열려 있는 올해 흐름을 확인합니다.',
            // 2026-05-16 PR #182 — 미존재 #yearly-chapter-1 fix.
            //   yearly 분기의 YearlyReportPanel 컨테이너 id 와 매핑.
            href: '#premium-yearly',
            status: '열림',
            note: '올해의 큰 주제부터 봅니다.',
          },
          {
            label: '달력',
            title: '달별 흐름',
            description: '월간 타이밍과 해금한 달을 다시 확인합니다.',
            // 2026-05-16 PR #182 — 미존재 #yearly-chapter-2 fix.
            //   yearly 분기 하단 SmallQuestionProducts 의 monthly-calendar 상품으로 이동.
            href: '#premium-monthly',
            status: '연결',
            note: '해금한 월은 다시 차감 없이 확인합니다.',
          },
          {
            label: '확장',
            title: '자세한 사주풀이',
            description: '타고난 성향과 큰 흐름을 더 자세히 봅니다.',
            // 2026-05-16 PR #182 — 미존재 #yearly-chapter-3 fix.
            //   yearly 분기에는 lifetime 콘텐츠 없음 → 업셀 결제 페이지로.
            href: `/membership/checkout?plan=lifetime&slug=${encodedSlug}&from=saju-premium-extend`,
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
          {/* 2026-05-16 A7 — 다른 탭/창에서 결제 완료 후 본 페이지로 돌아오면
              focus 이벤트 → /api/payments/entitlement 재요청 → server SSR 결과와
              다르면 router.refresh() 로 페이지 전체 재렌더 (hero / sections / CTAs
              일괄 갱신). 페이지 자체는 server component 로 유지하면서 실시간 반영. */}
          <EntitlementRefresher
            productId="lifetime-report"
            slug={slug}
            initialHasEntitlement={hasLifetimeAccess}
          />
          <GangiPageHeader title="상세" backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="premium" />

          {/* 2026-05-22 — '오늘의 분야별 흐름'(SajuAreaCardsSection)은 사주 메인 페이지에만 노출.
             상세(이 페이지)에서 중복 렌더되어 같은 내용 반복으로 느껴져 제거(메인 요약 유지). */}
          {/* 2026-05-22 — 사주 점수 상세는 총평 탭(per-factor LockGate 모델)으로 이전. 프리미엄 점수 카드 제거. */}

          {/* §1 Hero — 2026-05-14 강화: 결제 권한이 있으면 ✓ 배지 + 부각 그라데이션. */}
          <article
            className="relative overflow-hidden rounded-[20px] border p-5"
            style={{
              background:
                hasLifetimeAccess || yearlyAccessLabel || monthlyAccessLabel
                  ? 'linear-gradient(135deg, var(--app-pink-soft) 0%, #fff 60%, var(--app-pink-soft) 100%)'
                  : 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
              boxShadow: '0 20px 48px -28px rgba(216,27,114,0.32)',
            }}
          >
            {/* deco ring */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,79,154,0.18), transparent 70%)',
              }}
            />

            <div className="relative flex items-start gap-3">
              <ZodiacChip kind={yearZodiac} size="lg" />
              <div className="min-w-0 flex-1">
                {/* 결제 권한 ✓ 배지 (paid 일 때만) */}
                {hasLifetimeAccess || yearlyAccessLabel || monthlyAccessLabel ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold text-white"
                    style={{
                      background: 'var(--app-pink)',
                      boxShadow: '0 6px 14px rgba(216,27,114,0.28)',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {hasLifetimeAccess ? '평생 소장' : yearlyAccessLabel ?? monthlyAccessLabel}
                  </span>
                ) : null}
                <div className="mt-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  {dayMasterPillar} · {yearZodiacLabel}
                </div>
                <h1
                  className="mt-1 text-[22px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {heroTitle}
                </h1>
                <p
                  className="mt-2 text-[13px] leading-[1.65] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {heroDescription}
                </p>
              </div>
            </div>

            {/* 읽을 챕터 chips — 더 큰 hit area + 활성 강조 */}
            <div className="relative mt-4 grid grid-cols-3 gap-1.5">
              {readingSteps.map((step, index) => (
                <Link
                  key={step.href}
                  href={step.href}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-[12px] border bg-white px-2 py-2.5 text-center transition-colors hover:border-[var(--app-pink-line)]"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[12.5px] font-extrabold text-[var(--app-ink)]">
                    {step.label}
                  </span>
                </Link>
              ))}
            </div>

            {hasLifetimeAccess ? (
              <TrackedLink
                href={`/saju/${slug}/premium/print`}
                eventName="report_pdf_click"
                eventParams={{ slug, from: 'premium_hero', status: 'available' }}
                className="relative mt-3 inline-flex w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                📄 PDF로 저장하기
              </TrackedLink>
            ) : null}
          </article>

          {hasLifetimeAccess ? (
            <>
              <ChapterIntro
                number={1}
                tone="jade"
                eyebrow="1장 · 큰 흐름"
                title="10년 단위 대운으로 인생의 결을 봅니다"
                description="타고난 성향과 관계·일의 패턴을 먼저 정리하고, 그 위에 10년씩 흐르는 큰 운(대운)을 차례로 짚어드립니다. 평생 한 번 정리해 두면 매년 흐름을 가벼운 마음으로 읽게 됩니다."
                highlight="평생 활용 · 다시 볼 수 있게 보관"
              />
              <div id="premium-lifetime" className="premium-ai-panel scroll-mt-28">
                <LifetimeReportPanel slug={slug} targetYear={targetYear} />
              </div>
              <ChapterIntro
                number={2}
                tone="amber"
                eyebrow={`2장 · ${targetYear} 올해 흐름`}
                title={`${targetYear}년에 어떤 선택이 가벼울지 봅니다`}
                description="올해의 큰 주제와 분야별(일·돈·관계·생활) 선택 힌트를 정리합니다. 무엇을 먼저 할지, 무엇을 미뤄도 좋을지 한 줄로 정리해 드립니다."
                highlight="올해의 결정 타이밍"
              />
              <div id="premium-yearly" className="premium-ai-panel scroll-mt-28">
                <YearlyReportPanel slug={slug} targetYear={targetYear} />
              </div>
              <ChapterIntro
                number={3}
                tone="indigo"
                eyebrow="3장 · 월별 흐름"
                title="12개월을 좋은 달 · 확인할 달 · 정리할 달로 나눕니다"
                description="월별로 어떤 흐름이 들어오는지 한 줄씩 봅니다. 큰일을 잡기 좋은 달, 잠시 쉬는 달, 정리만 하는 달을 골라 일정을 가볍게 잡으세요."
                highlight="월별 타이밍 캘린더"
              />
              <div id="premium-calendar" className="premium-ai-panel scroll-mt-28">
                <FortuneCalendarPanel slug={slug} targetYear={targetYear} hasLifetimeAccess />
              </div>
            </>
          ) : yearlyAccessLabel ? (
            <>
              <ChapterIntro
                number={1}
                tone="amber"
                eyebrow={`1장 · ${targetYear} 올해 흐름`}
                title={`${targetYear}년 어떤 결정이 가벼울지 먼저 봅니다`}
                description="올해의 큰 주제와 월별 타이밍을 한자리에서 봅니다. 분야별(일·돈·관계·생활)로 무엇을 먼저 할지 결정에 도움이 되는 한 줄을 정리해 드립니다."
                highlight="올해 핵심 + 월별 흐름"
              />
              <div id="premium-yearly" className="premium-ai-panel scroll-mt-28">
                <YearlyReportPanel slug={slug} targetYear={targetYear} />
              </div>
              <SmallQuestionProducts encodedSlug={encodedSlug} targetYear={targetYear} />
            </>
          ) : monthlyAccessLabel ? (
            <>
              {/* 2026-05-18 Branch D — 월간달력(1,900원) 단독 구매자: 캘린더 우선 + 1·2장 잠금 미리보기. */}
              <ChapterIntro
                tone="indigo"
                eyebrow="월별 흐름"
                title="해금한 달의 흐름부터 봅니다"
                description="달별 좋은 흐름·확인할 흐름·정리할 흐름을 살펴봅니다. 결제하지 않은 달은 1,900원으로 하나씩 열거나, 49,000원 풀팩으로 한꺼번에 보실 수 있어요."
                highlight="월별 타이밍 캘린더"
              />
              <div id="premium-calendar" className="premium-ai-panel scroll-mt-28">
                <FortuneCalendarPanel
                  slug={slug}
                  targetYear={targetYear}
                  hasLifetimeAccess={false}
                />
              </div>

              <ChapterIntro
                number={1}
                tone="jade"
                eyebrow="1장 · 큰 흐름 (잠금)"
                title="10년 단위 대운으로 인생의 결을 봅니다"
                description="타고난 성향과 관계·일의 패턴을 정리한 뒤, 10년씩 흐르는 큰 운을 차례로 짚어드립니다. 결제 후 본문이 열립니다."
                aside="49,000원 풀팩에 포함"
              />
              <section id="premium-locked-lifetime" className="scroll-mt-28 px-1">
                <article className="relative overflow-hidden rounded-[18px] border border-[var(--app-line)] bg-white p-5">
                  <div className="select-none blur-[5px] opacity-65">
                    <p className="text-[13px] leading-[1.7] text-[var(--app-copy)]">
                      자세한 풀이에서는 타고난 성향, 관계 패턴, 일·돈의 결을 정리한 뒤
                      10년 단위로 흐르는 큰 운을 차례로 보여드립니다. 평생 한 번 정리해
                      두면 매년 흐름을 가볍게 읽게 됩니다.
                    </p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white"
                      style={{ background: 'rgba(17,17,20,0.78)' }}
                    >
                      🔒 49,000원 결제 후 열림
                    </span>
                  </div>
                </article>
              </section>

              <ChapterIntro
                number={2}
                tone="amber"
                eyebrow={`2장 · ${targetYear} 올해 흐름 (잠금)`}
                title={`${targetYear}년 어떤 선택이 가벼울지 먼저 봅니다`}
                description="올해의 큰 주제와 분야별(일·돈·관계·생활) 선택 힌트를 정리합니다. 결제 후 본문이 열립니다."
                aside="3,900원 단독 또는 49,000원 풀팩"
              />
              <section id="premium-locked-yearly" className="scroll-mt-28 px-1">
                <article className="relative overflow-hidden rounded-[18px] border border-[var(--app-line)] bg-white p-5">
                  <div className="select-none blur-[5px] opacity-65">
                    <p className="text-[13px] leading-[1.7] text-[var(--app-copy)]">
                      올해의 큰 주제와 월별 타이밍을 한자리에서 봅니다. 분야별로 무엇을
                      먼저 할지, 무엇을 미뤄도 좋을지 결정에 도움이 되는 한 줄을
                      정리해 드립니다.
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
                  큰 흐름 + 올해 흐름까지
                  <br />
                  한 번에 열기
                </h2>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  월별 흐름은 이미 열려 있어요. 49,000원 풀팩으로 큰 흐름과 올해 흐름이
                  바로 함께 열립니다.
                </p>
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
                    href={`/membership/checkout?plan=lifetime&slug=${encodedSlug}&from=saju-premium-monthly`}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                  >
                    1·2장 함께 열기 →
                  </Link>
                  <Link
                    href={`/membership/checkout?product=year-core&slug=${encodedSlug}&scope=${targetYear}&from=saju-premium-monthly`}
                    className="inline-flex items-center justify-center rounded-full border border-white/24 px-3 py-2.5 text-[12.5px] font-bold text-white/85"
                  >
                    올해 흐름만 3,900원
                  </Link>
                </div>
              </article>
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
                    {/* 2026-05-16 — 활성 프리미엄 멤버십이면 결제 link 대신 결제내역 link. */}
                    {activeMembershipPlan === 'premium_monthly' ? (
                      <Link
                        href="/my/billing"
                        className="inline-flex items-center justify-center rounded-full border border-white/24 px-3 py-2.5 text-[12.5px] font-bold text-white/85"
                      >
                        ✓ 멤버십 이용 중
                      </Link>
                    ) : (
                      <Link
                        href={`/membership/checkout?plan=premium&slug=${encodedSlug}&from=saju-premium`}
                        className="inline-flex items-center justify-center rounded-full border border-white/24 px-3 py-2.5 text-[12.5px] font-bold text-white/85"
                      >
                        멤버십으로 먼저
                      </Link>
                    )}
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
                tone="indigo"
                eyebrow="월별 흐름 미리보기"
                title="월별 흐름도 함께 볼 수 있어요"
                description="좋은 달, 확인할 달, 차분히 정리할 달을 나눠 봅니다. 결제 후 잠긴 달이 모두 열립니다."
              />
              <div id="premium-calendar" className="premium-ai-panel scroll-mt-28">
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
            {/* 2026-05-15 — TRUST_SIGNALS title+body 가 중간 길이 본문. 1열 stack. */}
            <div className="mt-3 grid gap-2.5">
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
