// Redesign 2026-05-13 (Claude Design / screens-b.jsx ScreenMembership):
// 멤버십 (/membership) — pink-strong 가격 hero + 플랜 2-col 카드 + 혜택 list
// + 소액 풀이 + 보관형 리포트 + ink-dark CTA. 데이터·라우팅 무수정.
import Link from 'next/link';
import type { Metadata } from 'next';
import { SafetyNotice } from '@/components/common/safety-notice';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { PLAN_BLUEPRINT, TASTE_PRODUCTS } from '@/content/moonlight';
import {
  formatPaymentPackagePrice,
  getMembershipPackage,
} from '@/lib/payments/catalog';
// 2026-05-16 — 활성 멤버십을 표시하기 위해 구독 + 인증 조회 추가.
import { getManagedSubscription } from '@/lib/subscription';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

const LIFETIME_REPORT_PACKAGE = getMembershipPackage('lifetime');
const LIFETIME_REPORT_PRICE = LIFETIME_REPORT_PACKAGE
  ? formatPaymentPackagePrice(LIFETIME_REPORT_PACKAGE)
  : '49,000원';

const COLLECTIBLE_REPORTS: ReadonlyArray<{
  slug: string;
  title: string;
  price: string;
  summary: string;
  href: string;
  zodiac: ZodiacKey;
}> = [
  {
    slug: 'life-standard',
    title: '보관형 사주 리포트',
    price: LIFETIME_REPORT_PRICE,
    summary: '타고난 성향, 올해 흐름, 선택 힌트를 한 번에 정리합니다.',
    href: '/saju/new?plan=lifetime',
    zodiac: 'dragon',
  },
  {
    slug: 'yearly-2026',
    title: '올해 흐름 리포트',
    price: '준비 중',
    summary: '진행하기 좋은 달, 확인할 달, 쉬어갈 달을 먼저 봅니다.',
    href: '/saju/new?focus=year',
    zodiac: 'tiger',
  },
  {
    slug: 'relationship-standard',
    title: '궁합 보관 리포트',
    price: '준비 중',
    summary: '두 사람의 속도, 거리감, 반복되는 갈등을 정리합니다.',
    href: '/compatibility/input?product=relationship-standard',
    zodiac: 'sheep',
  },
  {
    slug: 'family-report',
    title: '가족 흐름 리포트',
    price: '준비 중',
    summary: '가족 안에서 반복되는 역할과 부딪힘을 함께 봅니다.',
    href: '/membership?focus=family-report',
    zodiac: 'pig',
  },
];

const TASTE_ZODIACS: ZodiacKey[] = ['rooster', 'rabbit', 'snake', 'dragon', 'monkey', 'tiger'];

// 멤버십 플랜 — PLAN_BLUEPRINT 중 lifetime 제외 (basic / premium)
const DIALOGUE_PLANS = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');

export const metadata: Metadata = {
  title: '멤버십',
  description: '달빛인생의 소액 풀이, 보관형 리포트, 대화 멤버십을 한 화면에서 비교하세요.',
  alternates: {
    canonical: '/membership',
  },
};

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const focus = resolvedSearchParams.focus;

  // mockup 가격 hero — 가장 강조할 가격은 premium plan
  const featuredPlan = DIALOGUE_PLANS.find((p) => p.slug === 'premium') ?? DIALOGUE_PLANS[0];

  // 2026-05-16 — 활성 멤버십 plan 조회. plan 카드에 "이용 중" 배지 표시 + 결제 링크 비활성.
  let activeMembershipPlan: string | null = null;
  if (hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const subscription = await getManagedSubscription(user.id);
      if (subscription && subscription.status === 'active') {
        activeMembershipPlan = subscription.plan;
      }
    }
  }
  // plan slug ('basic'/'premium') → subscriptionPlan ('plus_monthly'/'premium_monthly') 매핑.
  const planSlugToSubscription = {
    basic: 'plus_monthly',
    premium: 'premium_monthly',
  } as const;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="멤버십" backHref="/" />

        <section className="space-y-5 px-1">
          {/* §1 Hero — eyebrow + 가격 강조 헤드라인 */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              달빛 클럽
            </div>
            <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              매일 가볍게,
              <br />
              <span className="text-[var(--app-pink-strong)]">{featuredPlan?.price ?? '월 9,900원'}</span>
            </h1>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
              광고 없이 데일리 리포트와 대화·보관함이 자유로워집니다.
            </p>
          </div>

          {/* §2 Plan 2-col 카드 (basic / premium).
              2026-05-16 — 활성 멤버십이면 "이용 중" 배지 + 결제 링크 비활성. */}
          <section>
            <div className="grid grid-cols-2 gap-2">
              {DIALOGUE_PLANS.map((plan) => {
                const isPremium = plan.slug === 'premium';
                const subscriptionPlanId =
                  plan.slug === 'basic' || plan.slug === 'premium'
                    ? planSlugToSubscription[plan.slug]
                    : null;
                const isActive =
                  subscriptionPlanId !== null && activeMembershipPlan === subscriptionPlanId;
                const cardStyle = isPremium
                  ? {
                      background: 'var(--app-pink-soft)',
                      border: '2px solid var(--app-pink)',
                    }
                  : {
                      background: '#fff',
                      border: '1px solid var(--app-line)',
                    };
                const cardInner = (
                  <>
                    <div className="flex items-center justify-between">
                      <div
                        className="text-[12px] font-extrabold uppercase tracking-[0.04em]"
                        style={{
                          color: isPremium
                            ? 'var(--app-pink-strong)'
                            : 'var(--app-copy-soft)',
                        }}
                      >
                        {plan.badge}
                      </div>
                      {isActive ? (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold text-white"
                          style={{ background: 'var(--app-jade)' }}
                        >
                          이용 중
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 text-[18px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {plan.price}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                      {plan.title}
                    </div>
                  </>
                );
                if (isActive) {
                  // 활성 멤버십은 결제 link 대신 결제내역 link 로.
                  return (
                    <Link
                      key={plan.slug}
                      href="/my/billing"
                      className="block rounded-[16px] p-3.5 transition"
                      style={cardStyle}
                    >
                      {cardInner}
                    </Link>
                  );
                }
                return (
                  <Link
                    key={plan.slug}
                    href={`/membership/checkout?plan=${plan.slug}&from=membership`}
                    className="block rounded-[16px] p-3.5 transition"
                    style={cardStyle}
                  >
                    {cardInner}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* §3 Benefits — featured plan.opens */}
          {featuredPlan ? (
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">포함된 혜택</h2>
              <ul className="mt-3 grid gap-2.5">
                {featuredPlan.opens.slice(0, 5).map((benefit, index) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[14px] font-extrabold"
                      style={{
                        background: 'var(--app-pink-soft)',
                        color: 'var(--app-pink-strong)',
                      }}
                      aria-hidden="true"
                    >
                      {['✦', '◆', '☰', '⌘', '✶'][index] ?? '·'}
                    </div>
                    <p className="text-[13px] font-medium leading-[1.5] text-[var(--app-ink)]">
                      {benefit}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          {/* §4 후기 한 줄 — pink-soft 카드 */}
          <article
            className="rounded-[14px] border p-4"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[var(--app-pink-strong)]">
              <span>★★★★★</span>
              <span className="text-[var(--app-ink)]">4.8</span>
              <span className="font-medium text-[var(--app-copy-soft)]">· 멤버 후기</span>
            </div>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy)]">
              &ldquo;매일 아침 가볍게 한 줄 보고 출근해요. 광고 없으니 진짜 깔끔.&rdquo;
            </p>
            <div className="mt-1.5 text-[11px] text-[var(--app-copy-soft)]">— 닭띠 · 1991</div>
          </article>

          {/* §5 소액 풀이 — TASTE_PRODUCTS */}
          <section>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              소액 풀이
            </div>
            <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
              궁금한 것 하나만 먼저
            </h2>
            <p className="mt-1 text-[12px] text-[var(--app-copy-muted)]">
              큰 결제 전에 오늘 궁금한 질문 하나를 짧게 확인하는 입구입니다.
            </p>
            <div className="mt-3 grid gap-2.5">
              {TASTE_PRODUCTS.map((product, index) => (
                <Link
                  key={product.slug}
                  href={product.href}
                  className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                >
                  <ZodiacChip
                    kind={TASTE_ZODIACS[index % TASTE_ZODIACS.length]}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {product.title}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--app-copy-soft)]">
                      {product.question}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--app-pink-strong)]"
                    style={{
                      background: 'var(--app-pink-soft)',
                      border: '1px solid var(--app-pink-line)',
                    }}
                  >
                    {product.price}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* §6 보관형 리포트 — COLLECTIBLE_REPORTS */}
          <section>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              보관형 풀이
            </div>
            <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
              오래 다시 볼 내용은 리포트로
            </h2>
            <div className="mt-3 grid gap-2.5">
              {COLLECTIBLE_REPORTS.map((report) => (
                <Link
                  key={report.slug}
                  href={report.href}
                  className="flex items-center gap-3 rounded-[14px] border bg-white p-3.5"
                  style={{
                    borderColor:
                      focus === report.slug ? 'var(--app-pink-line)' : 'var(--app-line)',
                    background:
                      focus === report.slug ? 'var(--app-pink-soft)' : '#fff',
                  }}
                  data-active={focus === report.slug ? 'true' : undefined}
                >
                  <ZodiacChip kind={report.zodiac} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {report.title}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--app-copy-soft)]">
                      {report.summary}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--app-pink-strong)]"
                    style={{
                      background: 'var(--app-pink-soft)',
                      border: '1px solid var(--app-pink-line)',
                    }}
                  >
                    {report.price}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* §7 Bottom CTA — full-width pink */}
          <div>
            <Link
              href={`/membership/checkout?plan=${featuredPlan?.slug ?? 'premium'}&from=membership`}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3.5 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              {featuredPlan?.price ?? '월 9,900원'} 시작 →
            </Link>
            <p className="mt-3 text-center text-[11.5px] leading-[1.5] text-[var(--app-copy-soft)]">
              7일 무료 체험 · 언제든 해지 가능
            </p>
          </div>

          <SafetyNotice variant="general" />
        </section>
      </AppPage>
    </AppShell>
  );
}
