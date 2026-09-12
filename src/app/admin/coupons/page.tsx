// 할인쿠폰(전단) 관리 — super_admin. 등급 요율 · 대량 발급 · 배치 현황/회수/되살리기/만료 · 귀속 해제.
// 설계 docs/discount-coupon-design.md §11·§12, 사용자 결정 2026-09-13(PROGRESS.md).
// 🔴 쿠폰 행 원본(코드 평문)은 클라이언트로 내리지 않는다 — 집계(couponTierStats·couponBatchStats)만 넘긴다.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import {
  adminCouponEnv,
  COUPON_EXPIRY_MAX_DAYS,
  COUPON_ISSUE_MAX,
  COUPON_MIN_CAP_WON,
  CouponAdminError,
  couponBatchStats,
  couponTierStats,
  loadCouponAdminData,
  type CouponBatchStat,
  type CouponTierStat,
} from '@/lib/coupons/coupon-admin';
import { couponEnvForHost } from '@/lib/coupons/coupon-charge';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { CouponAdminClient } from './coupon-admin-client';

export const metadata: Metadata = {
  title: '할인쿠폰 관리 (admin)',
  description: '오프라인 전단 할인쿠폰의 요율·발급·회수·귀속 해제.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CouponsAdminPage() {
  const guard = await getCurrentAdminRole(await createClient());
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  const env = adminCouponEnv(couponEnvForHost((await headers()).get('host')), process.env.VERCEL_ENV);
  let view: { tiers: CouponTierStat[]; batches: CouponBatchStat[] } | null = null;
  if (hasSupabaseServiceEnv) {
    try {
      const data = await loadCouponAdminData(await createServiceClient());
      view = { tiers: couponTierStats(data.tiers, data.rows), batches: couponBatchStats(data.rows, data.orders, new Date()) };
    } catch (err) {
      // 태우기 감지 지표가 조용히 0 이면 거짓 안심이 된다 — 0 대신 실패 카드를 그린다.
      console.error('[admin/coupons] 현황 로드 실패', err instanceof CouponAdminError ? err.message : err instanceof Error ? err.name : 'unknown');
    }
  }

  return (
    <AdminPage
      title="할인쿠폰(전단)"
      description="등급 요율과 발급·회수를 관리합니다. 쿠폰 코드는 현금 증서라 화면에 보이지 않고 CSV 로만 받습니다."
    >
      <CouponAdminClient
        env={env}
        view={view}
        limits={{ issueMax: COUPON_ISSUE_MAX, minCapWon: COUPON_MIN_CAP_WON, expiryMaxDays: COUPON_EXPIRY_MAX_DAYS }}
      />
    </AdminPage>
  );
}
