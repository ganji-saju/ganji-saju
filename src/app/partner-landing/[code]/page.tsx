// 2026-10-04 인플루언서 전용 신년운세 랜딩(설계 §3-3). 간지사주 셸(헤더·메뉴) 없이 한 장.
// 호스트 전환은 src/proxy.ts → partnerLandingRewritePath. 마이그레이션 090 미적용이면 '이용 불가' 안내로 닫힌다.
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { formatWon, getPackage } from '@/lib/payments/catalog';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { applyPartnerPrice, getActivePartner, PARTNER_PACKAGE_ID } from '@/lib/partners/partner';
import { kstDateKey } from '@/lib/admin/analytics-rollup';
import { BUSINESS_INFO } from '@/lib/business-info';
import { CANONICAL_SITE_URL } from '@/lib/site';

export const metadata: Metadata = { title: '2027 신년운세', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// 사업자 정보 — site-footer.tsx 와 같은 BUSINESS_INFO(법정 표기 정본). 그 컴포넌트는 간지사주 링크·쿠키 버튼이 섞인 클라이언트라 데이터만 재사용한다.
const BUSINESS_LINES: string[] = [
  ['상호', BUSINESS_INFO.companyName],
  ['대표', BUSINESS_INFO.ceoName],
  ['사업자등록번호', BUSINESS_INFO.businessRegistrationNumber],
  ['통신판매업', BUSINESS_INFO.mailOrderRegistrationNumber],
  ['주소', BUSINESS_INFO.address],
  ['고객센터', BUSINESS_INFO.phone],
  ['이메일', BUSINESS_INFO.email],
  ['운영시간', BUSINESS_INFO.csHours],
]
  .filter(([, value]) => value)
  .map(([label, value]) => `${label}: ${value}`);

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const service = await createServiceClient();
  const partner = await getActivePartner(service, code);
  if (!partner) {
    return <main className="mx-auto max-w-[480px] px-4 py-16 text-center">지금은 이용할 수 없는 링크입니다.</main>;
  }
  // 집계 실패(테이블·함수 미적용 포함)는 랜딩을 막지 않는다.
  await Promise.resolve(
    service.rpc('increment_partner_visit', { p_code: partner.code, p_day: kstDateKey(new Date().toISOString()) }),
  ).then(() => undefined, () => undefined);
  const list = await resolvePackagePrice(getPackage(PARTNER_PACKAGE_ID)!.id);
  const price = applyPartnerPrice(list, partner);
  const buyHref = `${CANONICAL_SITE_URL}/partner/go?code=${encodeURIComponent(partner.code)}`;
  return (
    <main className="mx-auto max-w-[480px] px-4 pb-16 pt-10">
      {/* 브랜드 이름·로고·문구는 사용자 확정본으로 교체(설계 §7). 아래는 구조. */}
      <h1 className="text-[28px] font-extrabold">2027 신년운세</h1>
      <p className="mt-3 text-[16px] leading-[1.7]">재물·가족·일 — 새해 한 해의 흐름을 월별로 미리 봅니다. PDF로 저장해 다시 볼 수 있어요.</p>
      <div className="mt-6 rounded-[14px] border p-5">
        <p className="text-[15px] text-[var(--app-copy-muted)] line-through">{formatWon(list)}</p>
        <p className="text-[26px] font-extrabold">
          {formatWon(price.chargeAmount)} <span className="text-[16px]">({price.percent}% 할인)</span>
        </p>
        <a href={buyHref} className="mt-4 block rounded-[12px] bg-[var(--app-pink)] py-3 text-center font-extrabold text-white">
          지금 보기
        </a>
        <p className="mt-3 text-[13px] text-[var(--app-copy-muted)]">결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제 화면에 이 이름이 표시됩니다.</p>
      </div>
      <footer className="mt-10 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]" aria-label="사업자 정보">
        {BUSINESS_LINES.map((line) => (
          <p key={line} className="m-0">{line}</p>
        ))}
        <p className="m-0 mt-2">
          <a href="/terms">이용약관</a> | <a href="/privacy">개인정보처리방침</a>
        </p>
      </footer>
    </main>
  );
}
