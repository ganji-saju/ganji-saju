// Redesign 2026-05-13 (Claude Design / screens-f.jsx ScreenPaymentResult success):
// 96px pink ✓ + "결제가 완료됐어요" + 주문 내역 카드 + 풀이 보기 / 결제 내역.
// 라우팅·결제 redirect 무수정.
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { COMPLETE_PLAN_GUIDE, type PlanSlug } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{ plan?: string; slug?: string; payment?: string }>;
}

const PLAN_LABELS: Record<string, string> = {
  basic: '라이트 대화 멤버십',
  premium: '프리미엄 대화 멤버십',
  lifetime: '보관형 사주 리포트',
};

const PLAN_ZODIAC: Record<string, ZodiacKey> = {
  basic: 'rabbit',
  premium: 'dragon',
  lifetime: 'rooster',
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '결제 완료',
    description: '결제가 완료된 뒤 첫 이용 흐름을 안내하는 화면입니다.',
  };
}

export default async function MembershipCompletePage({ searchParams }: Props) {
  const { plan, slug, payment } = await searchParams;
  const planSlug = ((plan as PlanSlug | undefined) ?? 'premium') as PlanSlug;
  const planLabel = PLAN_LABELS[planSlug] ?? PLAN_LABELS.premium;
  const planZodiac: ZodiacKey = PLAN_ZODIAC[planSlug] ?? 'dragon';
  const completeGuide = COMPLETE_PLAN_GUIDE[planSlug] ?? COMPLETE_PLAN_GUIDE.premium;
  const shouldOpenPremiumResult =
    payment === 'confirmed' && slug && (planSlug === 'lifetime' || planSlug === 'premium');

  if (shouldOpenPremiumResult) {
    redirect(`/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&plan=${planSlug}`);
  }

  const primaryHref =
    slug && (planSlug === 'lifetime' || planSlug === 'premium')
      ? `/saju/${slug}/premium`
      : completeGuide.primaryHref;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="결제 완료" backHref="/" />

        <section className="space-y-5 px-1">
          {/* §1 success hero — 96px pink circle + ✓ */}
          <div className="text-center pt-2">
            <div
              className="mx-auto grid h-24 w-24 place-items-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                boxShadow: '0 16px 40px rgba(216,27,114,0.32)',
              }}
              aria-hidden="true"
            >
              <span className="text-[55.2px] font-extrabold leading-none text-white">✓</span>
            </div>
            <h1 className="mt-5 text-[25.3px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              결제가 완료됐어요
            </h1>
            <p className="mt-2 px-4 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
              {planLabel} 이용이 시작되었습니다.
              <br />
              {completeGuide.welcome}
            </p>
          </div>

          {/* §2 주문 내역 */}
          <article
            className="rounded-[18px] border p-5 text-left"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              주문 내역
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <ZodiacChip kind={planZodiac} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-[16.1px] font-extrabold leading-snug text-[var(--app-ink)]">
                  {planLabel}
                </div>
                <p className="mt-1 text-[13.2px] text-[var(--app-copy-soft)]">
                  {completeGuide.giftTitle}
                </p>
              </div>
            </div>
            <div
              className="mt-3.5 flex items-center justify-between border-t pt-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <span className="text-[15px] text-[var(--app-copy)]">결제 상태</span>
              <span
                className="text-[14.4px] font-extrabold"
                style={{ color: 'var(--app-jade)' }}
              >
                ● 정상 처리
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13.8px] text-[var(--app-copy-soft)]">결제 수단</span>
              <span className="text-[13.8px] font-bold text-[var(--app-copy)]">토스페이</span>
            </div>
          </article>

          {/* §3 환영 선물 + 다음 단계 */}
          <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-5">
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              환영 선물
            </div>
            <h2 className="mt-1 text-[17.8px] font-extrabold text-[var(--app-ink)]">
              {completeGuide.giftTitle}
            </h2>
            <p className="mt-1.5 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
              {completeGuide.giftBody}
            </p>
            <ul className="mt-3 grid gap-1.5">
              {completeGuide.nextSteps.map((item, index) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[14.4px] leading-[1.55] text-[var(--app-copy)]"
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11.5px] font-extrabold"
                    style={{
                      background: 'var(--app-pink-soft)',
                      color: 'var(--app-pink-strong)',
                    }}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </article>

          {/* §4 CTAs */}
          <div className="grid gap-2">
            <Link
              href={primaryHref}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.7px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              {slug && planSlug === 'lifetime' ? '열린 보관형 리포트 보기 →' : `${completeGuide.primaryLabel} →`}
            </Link>
            <Link
              href="/my/billing"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[15px] font-bold text-[var(--app-copy-muted)]"
            >
              결제 내역 보기
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 w-full items-center justify-center text-[14.4px] font-medium text-[var(--app-copy-soft)] underline underline-offset-4"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}
