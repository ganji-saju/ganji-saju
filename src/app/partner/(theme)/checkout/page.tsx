// 올해운 노트 — 결제 페이지(설계 §3-5). 파트너판만 다룬다.
//   금액은 /membership/checkout·prepare 와 같은 resolveChargeForUser(같은 getUser 결과) → 화면 금액 = order.amount = PG 청구액.
//   이용권 판정은 신년운세 화면과 같은 resolveNewYearAccess(사주 정체성 + 신년운세·평생 이용권).
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import TossMembershipCheckout from '@/components/membership/toss-membership-checkout';
import { couponEnvForHost, resolveChargeForUser } from '@/lib/coupons/coupon-charge';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { getActivePartner, PARTNER_COOKIE, PARTNER_PACKAGE_ID } from '@/lib/partners/partner';
import { formatWon, getPackage, NEW_YEAR_TARGET_YEAR } from '@/lib/payments/catalog';
import { getPaymentProvider } from '@/lib/payments/provider';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { NOTE_CARD, NOTE_PRIMARY_BUTTON, NOTE_TITLE_STYLE, NoteNotice } from '@/features/partner-theme/note-theme';

export const dynamic = 'force-dynamic';

const UNAVAILABLE = <NoteNotice title="지금은 이용할 수 없는 링크입니다." />;

export default async function PartnerCheckoutPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const slug = (await searchParams).slug?.trim();
  const partner = hasSupabaseServiceEnv
    ? await getActivePartner(await createServiceClient(), (await cookies()).get(PARTNER_COOKIE)?.value)
    : null;
  if (!partner) return UNAVAILABLE;
  if (!slug) redirect('/partner/start');

  const access = await resolveNewYearAccess(slug, NEW_YEAR_TARGET_YEAR);
  if (!access.reading) redirect('/partner/start');
  if (!access.user) redirect(`/partner/login?next=${encodeURIComponent(`/partner/checkout?slug=${slug}`)}`);
  if (!access.isOwner) {
    return (
      <NoteNotice title="이 계정에서 만든 사주가 아니에요">
        <a href="/partner/start" className="underline">생년월일 다시 넣기</a>
      </NoteNotice>
    );
  }
  if (access.hasAccess) {
    return (
      <NoteNotice title="이미 받은 운세가 있어요">
        <a href={`/saju/${encodeURIComponent(slug)}/new-year/${NEW_YEAR_TARGET_YEAR}`} className={`${NOTE_PRIMARY_BUTTON} mt-2`}>풀이 보러 가기</a>
      </NoteNotice>
    );
  }

  const pkg = getPackage(PARTNER_PACKAGE_ID)!;
  const quote = await resolveChargeForUser(pkg, access.user, null, {
    env: couponEnvForHost((await headers()).get('host')),
    partner,
  });
  // 파트너 할인이 빠진 계산(비활성 직전 경합 등)으로 정가를 청구하지 않는다. prepare 의 409 가 최종 방어.
  if (!quote.partner) return UNAVAILABLE;

  return (
    <>
      <h1 style={NOTE_TITLE_STYLE} className="text-[26px] font-extrabold leading-[1.35]">2027 운세</h1>
      <section className={`${NOTE_CARD} mt-5`}>
        <p className="text-[15px] text-[var(--note-muted)] line-through">{formatWon(quote.listAmount)}</p>
        <p className="text-[28px] font-extrabold">
          {formatWon(quote.chargeAmount)} <span className="text-[16px] text-[var(--note-coral-ink)]">({quote.percent}% 할인)</span>
        </p>
        <div className="mt-4">
          <TossMembershipCheckout
            provider={getPaymentProvider()}
            packageId={pkg.id}
            plan="premium"
            product="new-year"
            amount={quote.chargeAmount}
            orderName={pkg.name}
            slug={slug}
            entrySource="partner"
          />
        </div>
        <p className="mt-3 text-[13px] leading-[1.6] text-[var(--note-muted)]">
          결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제창과 카드 명세서에 이 이름이 표시됩니다.
        </p>
      </section>
      {/* 화면 하단에 고정되는 결제 바(약 130px)가 사업자 정보를 덮지 않도록 */}
      <div aria-hidden className="h-40" />
    </>
  );
}
