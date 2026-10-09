// 2026-10-04 인플루언서 전용 신년운세 랜딩(설계 §3-3) · 2026-10-09 올해운 노트 테마(partner-theme-flow 설계 §3-2).
// 호스트 전환은 src/proxy.ts → partnerLandingRewritePath. 마이그레이션 090 미적용이면 '이용 불가' 안내로 닫힌다.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { formatWon, getPackage } from '@/lib/payments/catalog';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { applyPartnerPrice, getActivePartner, PARTNER_PACKAGE_ID } from '@/lib/partners/partner';
import { kstDateKey } from '@/lib/admin/analytics-rollup';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { shouldCountPartnerVisit } from '@/lib/partners/partner-host';
import { NOTE_CARD, NOTE_METADATA, NOTE_PRIMARY_BUTTON, NOTE_TITLE_STYLE, NoteNotice, NoteShell } from '@/features/partner-theme/note-theme';

export const metadata: Metadata = { ...NOTE_METADATA, title: { absolute: '올해운 노트 — 2027 운세' } };
export const dynamic = 'force-dynamic';

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const service = await createServiceClient();
  const partner = await getActivePartner(service, code);
  if (!partner) {
    return <NoteShell><NoteNotice title="지금은 이용할 수 없는 링크입니다." /></NoteShell>;
  }
  // 봇·미리보기 크롤러는 세지 않는다. 집계 실패(테이블·함수 미적용 포함)는 랜딩을 막지 않는다.
  if (shouldCountPartnerVisit((await headers()).get('user-agent'))) {
    await Promise.resolve(
      service.rpc('increment_partner_visit', { p_code: partner.code, p_day: kstDateKey(new Date().toISOString()) }),
    ).then(() => undefined, () => undefined);
  }
  const list = await resolvePackagePrice(getPackage(PARTNER_PACKAGE_ID)!.id);
  const price = applyPartnerPrice(list, partner);
  const buyHref = `${CANONICAL_SITE_URL}/partner/go?code=${encodeURIComponent(partner.code)}`;
  return (
    <NoteShell>
      {/* 2026-10-04 랜딩 문구 B안(사용자 선택) */}
      <h1 style={NOTE_TITLE_STYLE} className="text-[30px] font-extrabold leading-[1.3]">내년 내 운, 미리 열어볼까요?</h1>
      <p className="mt-3 text-[17px] leading-[1.7] text-[var(--note-muted)]">생년월일만 넣으면 2027년 한 해가 달별로 정리돼요.</p>
      <ul className="mt-5 grid gap-2 text-[16px] leading-[1.6]">
        <li>✓ 돈·사람·일, 신경 쓰이는 흐름 한눈에</li>
        <li>✓ 달마다 &ldquo;이번 달 할 일&rdquo; 한 줄 정리</li>
        <li>✓ 저장해 두고 새해 내내 꺼내 보기</li>
      </ul>
      <section className={`${NOTE_CARD} mt-7`}>
        <p className="text-[15px] text-[var(--note-muted)] line-through">{formatWon(list)}</p>
        <p className="text-[28px] font-extrabold">
          {formatWon(price.chargeAmount)} <span className="text-[16px] text-[var(--note-coral-ink)]">({price.percent}% 할인)</span>
        </p>
        <a href={buyHref} className={`${NOTE_PRIMARY_BUTTON} mt-4`}>2027 운세 열기</a>
        <p className="mt-3 text-[13px] leading-[1.6] text-[var(--note-muted)]">결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제 화면에 이 이름이 표시됩니다.</p>
      </section>
    </NoteShell>
  );
}
