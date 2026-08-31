// 2026-08-31 — 관리자 수동 부여 이용권 목록 + 회수 대상 판정.
//
//   부여(#726)만 있고 되돌리는 경로가 없었다. 환불은 결제 건에 붙는데 수동 부여는
//   주문이 없어서, 잘못 주면 DB 직접 수정이었다.
//
//   🔴 회수 대상은 **수동 부여분만**이다. 결제분을 여기서 지우면 PG 취소 없이 이용권만
//      사라져 "돈은 받고 상품은 뺏은" 상태가 된다 — 결제분은 반드시 환불 경로로.
//      수동 부여의 서명: order_id 와 payment_key 가 **둘 다 null**. 결제 경로(fulfillment)는
//      단품·묶음 모두 orderId 를 반드시 넘긴다(묶음 구성품은 amount=null 이지만 order_id 는 있다).
//      amount 로 가르면 안 되는 이유: 묶음 구성품(amount=null·결제분)과 수동 묶음 부여
//      (amount=null·무결제)가 같은 값이다.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { resolveProductEntitlementName } from '@/lib/billing/payment-history';

export interface EntitlementSignatureRow {
  order_id: string | null;
  payment_key: string | null;
}

/** 순수: 결제 흔적이 전혀 없는 행만 수동 부여로 본다. */
export function isAdminGrantedEntitlement(row: EntitlementSignatureRow): boolean {
  return row.order_id == null && row.payment_key == null;
}

export interface AdminGrantedEntitlement {
  id: string;
  productId: string;
  productName: string;
  /** 저장된 scope_key 그대로('global' 포함). 회수 시 같은 값으로 지운다. */
  scopeKey: string;
  packageId: string | null;
  createdAt: string;
}

interface GrantedRow extends EntitlementSignatureRow {
  id: string;
  product_id: string;
  scope_key: string;
  package_id: string | null;
  created_at: string;
}

/** 이 회원의 수동 부여 이용권(최근순). service env 없으면 빈 배열. */
export async function listAdminGrantedEntitlements(userId: string): Promise<AdminGrantedEntitlement[]> {
  if (!userId || !hasSupabaseServiceEnv) return [];
  const service = await createServiceClient();
  const { data, error } = await service
    .from('product_entitlements')
    .select('id, product_id, scope_key, order_id, payment_key, package_id, created_at')
    .eq('user_id', userId)
    .is('order_id', null)
    .is('payment_key', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return (data as GrantedRow[]).filter(isAdminGrantedEntitlement).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: resolveProductEntitlementName(row.product_id),
    scopeKey: row.scope_key,
    packageId: row.package_id,
    createdAt: row.created_at,
  }));
}
