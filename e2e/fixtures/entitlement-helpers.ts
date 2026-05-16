// 2026-05-16 Phase 2C — entitlement seed/cleanup helpers.
//
// E2E 가 결제 차단 9곳 (PR #177/#178) 을 검증하려면 test user 에게 4 종류
// entitlement 를 임시 부여해야 한다. 본 helper 가 service_role 로 직접 DB 조작.
//
// 패턴: test.beforeAll(seed) + test.afterAll(cleanup). 각 spec describe 가
// 자체 격리된 entitlement state 갖도록.
//
// 안전장치:
// - 모든 함수가 test user 의 user_id 만 받음 (다른 사용자 데이터 절대 미접근)
// - cleanup 은 항상 정확한 (user_id, product_id, scope_key) 매칭으로만 DELETE
// - subscription cleanup 은 status='expired' 로 mark (DELETE 가 아닌 safe)

import { getSupabaseAdmin } from './supabase-admin';

export type SubscriptionPlan = 'plus_monthly' | 'premium_monthly';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** auth.users.email → user_id 조회. */
export async function resolveTestUserId(email: string): Promise<string> {
  const admin = getSupabaseAdmin();
  // listUsers 페이지네이션으로 email 매칭. test 환경의 user 수는 작아 1 page 로 충분.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`auth.users 조회 실패: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`auth.users 에 ${email} 없음 — test 계정 사전 생성 필요`);
  return user.id;
}

// ---------- subscriptions ----------

export async function seedSubscription(userId: string, plan: SubscriptionPlan): Promise<void> {
  const admin = getSupabaseAdmin();
  const renewsAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'active',
        plan,
        renews_at: renewsAt,
      },
      { onConflict: 'user_id' }
    );
  if (error) throw new Error(`subscriptions seed 실패: ${error.message}`);
}

export async function cleanupSubscription(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  // status='expired' 로 mark — DELETE 보다 안전 (다른 환경 영향 최소화).
  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'expired', renews_at: null })
    .eq('user_id', userId);
  if (error) throw new Error(`subscriptions cleanup 실패: ${error.message}`);
}

// ---------- product_entitlements ----------

export async function seedProductEntitlement(
  userId: string,
  productId: string,
  scopeKey: string
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('product_entitlements').upsert(
    {
      user_id: userId,
      product_id: productId,
      scope_key: scopeKey,
      metadata: {
        kind: 'phase-2c-e2e-seed',
        productId,
        scopeKey,
        seededAt: new Date().toISOString(),
      },
    },
    { onConflict: 'user_id,product_id,scope_key' }
  );
  if (error) throw new Error(`product_entitlements seed 실패: ${error.message}`);
}

export async function cleanupProductEntitlement(
  userId: string,
  productId: string,
  scopeKey: string
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('product_entitlements')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('scope_key', scopeKey);
  if (error) throw new Error(`product_entitlements cleanup 실패: ${error.message}`);
}

// ---------- scope key builders (src/lib/payments/product-scope.ts 와 동기화) ----------
// 본 helper 는 e2e/ 만 사용. src/ 의 builder 를 import 하면 next 의 client/server
// component 경계 + tsconfig path 문제로 깨질 수 있어 e2e 단독 사본 유지. 변경 시
// src/lib/payments/product-scope.ts 와 함께 갱신 (정렬 invariant test 추가 권장).

export function buildLifetimeReportScopeKey(readingKey: string): string {
  return `lifetime:${readingKey}`;
}

export function buildTodayDetailScopeKey(sourceSessionId: string): string {
  return `today:${sourceSessionId}`;
}

export function buildMonthlyCalendarScopeKey(
  readingKey: string,
  year: number,
  month: number
): string {
  return `calendar:${readingKey}:${year}-${String(month).padStart(2, '0')}`;
}
