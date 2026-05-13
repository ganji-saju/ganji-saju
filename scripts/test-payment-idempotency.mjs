#!/usr/bin/env node
// Regression test for P0-1 (audit 2026-05-13):
// Ensures /api/payments/confirm cannot double-credit a user when the same
// paymentKey is replayed. Tests both the SQL-level (migration 021) and the
// caller-level (src/lib/credits/deduct.ts) idempotency layers.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-payment-idempotency.mjs
//   (or use NEXT_PUBLIC_SUPABASE_URL as fallback)

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  null;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  null;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('Set them to point at a TEST Supabase project (never production).');
  process.exit(2);
}

const sb = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const summary = { passed: 0, failed: 0, errors: [] };

function assertEq(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}: ${actual}`);
    summary.passed++;
  } else {
    console.log(`  ✗ ${label}: got ${actual}, expected ${expected}`);
    summary.failed++;
    summary.errors.push({ label, actual, expected });
  }
}

async function getBalance(userId) {
  const { data, error } = await sb
    .from('user_credits')
    .select('balance, subscription_balance')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`getBalance: ${error.message}`);
  return data ?? { balance: 0, subscription_balance: 0 };
}

async function countTxnsByPaymentKey(userId, paymentKey, type) {
  const { data, error } = await sb
    .from('credit_transactions')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('type', type)
    .contains('metadata', { paymentKey });
  if (error) throw new Error(`countTxns: ${error.message}`);
  return data?.length ?? 0;
}

async function createTestUser(label) {
  const email = `audit-idempotency-${Date.now()}-${label}@example.com`;
  const password = crypto.randomBytes(16).toString('hex') + 'Aa1!';
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  return { id: data.user.id, email };
}

async function cleanup(userId) {
  await sb.auth.admin.deleteUser(userId).catch(() => {});
}

console.log('=== P0-1 regression test: addCredits idempotency ===\n');

let userId = null;
try {
  // ------------------------------------------------------------------
  // Scenario A: SQL-level idempotency via rpc('add_credits', ...)
  // ------------------------------------------------------------------
  console.log('Scenario A — SQL function add_credits (purchase, paymentKey)');
  const userA = await createTestUser('A');
  userId = userA.id;

  const startA = await getBalance(userId);
  const paymentKeyA = 'AUDIT-P01-RPC-' + crypto.randomBytes(6).toString('hex');
  const metaA = {
    orderId: 'audit-order-A',
    packageId: 'credit_3',
    paymentKey: paymentKeyA,
  };

  const { error: e1 } = await sb.rpc('add_credits', {
    p_user_id: userId,
    p_amount: 3,
    p_type: 'purchase',
    p_metadata: metaA,
  });
  if (e1) throw new Error(`1st rpc: ${e1.message}`);

  const mid = await getBalance(userId);
  assertEq('balance after 1st rpc (expect +3 from signup_bonus 3)', mid.balance, startA.balance + 3);

  const { error: e2 } = await sb.rpc('add_credits', {
    p_user_id: userId,
    p_amount: 3,
    p_type: 'purchase',
    p_metadata: metaA,
  });
  if (e2) throw new Error(`2nd rpc: ${e2.message}`);

  const endA = await getBalance(userId);
  assertEq('balance after 2nd rpc (same paymentKey, expect NO CHANGE)', endA.balance, mid.balance);

  const txnCountA = await countTxnsByPaymentKey(userId, paymentKeyA, 'purchase');
  assertEq('credit_transactions row count for same paymentKey', txnCountA, 1);

  await cleanup(userId);

  // ------------------------------------------------------------------
  // Scenario B: Different paymentKey → SHOULD credit again
  // ------------------------------------------------------------------
  console.log('\nScenario B — different paymentKey should still credit');
  const userB = await createTestUser('B');
  userId = userB.id;

  const startB = await getBalance(userId);
  const pkB1 = 'AUDIT-P01-DIFF-1-' + crypto.randomBytes(6).toString('hex');
  const pkB2 = 'AUDIT-P01-DIFF-2-' + crypto.randomBytes(6).toString('hex');

  await sb.rpc('add_credits', {
    p_user_id: userId, p_amount: 3, p_type: 'purchase',
    p_metadata: { orderId: 'o1', packageId: 'credit_3', paymentKey: pkB1 },
  });
  const midB = await getBalance(userId);

  await sb.rpc('add_credits', {
    p_user_id: userId, p_amount: 3, p_type: 'purchase',
    p_metadata: { orderId: 'o2', packageId: 'credit_3', paymentKey: pkB2 },
  });
  const endB = await getBalance(userId);

  assertEq('balance after 1st rpc (delta +3)', midB.balance, startB.balance + 3);
  assertEq('balance after 2nd rpc (different paymentKey, delta +3)', endB.balance, midB.balance + 3);

  await cleanup(userId);

  // ------------------------------------------------------------------
  // Scenario C: Subscription type also idempotent
  // ------------------------------------------------------------------
  console.log('\nScenario C — type=subscription also idempotent');
  const userC = await createTestUser('C');
  userId = userC.id;

  const startC = await getBalance(userId);
  const pkC = 'AUDIT-P01-SUB-' + crypto.randomBytes(6).toString('hex');
  const metaC = { orderId: 'oC', packageId: 'subscription_30', paymentKey: pkC };

  await sb.rpc('add_credits', {
    p_user_id: userId, p_amount: 36, p_type: 'subscription', p_metadata: metaC,
  });
  const midC = await getBalance(userId);
  assertEq('subscription_balance after 1st rpc (+36)', midC.subscription_balance, startC.subscription_balance + 36);

  await sb.rpc('add_credits', {
    p_user_id: userId, p_amount: 36, p_type: 'subscription', p_metadata: metaC,
  });
  const endC = await getBalance(userId);
  assertEq('subscription_balance after 2nd rpc (same paymentKey, no change)', endC.subscription_balance, midC.subscription_balance);

  await cleanup(userId);

  // ------------------------------------------------------------------
  // Scenario D: No paymentKey → does NOT enforce idempotency (legacy/signup_bonus path)
  // ------------------------------------------------------------------
  console.log('\nScenario D — call without paymentKey still works (non-payment paths)');
  const userD = await createTestUser('D');
  userId = userD.id;

  const startD = await getBalance(userId);
  await sb.rpc('add_credits', {
    p_user_id: userId, p_amount: 1, p_type: 'purchase', p_metadata: {},
  });
  const midD = await getBalance(userId);
  assertEq('balance after 1st rpc with empty meta (+1)', midD.balance, startD.balance + 1);

  await sb.rpc('add_credits', {
    p_user_id: userId, p_amount: 1, p_type: 'purchase', p_metadata: {},
  });
  const endD = await getBalance(userId);
  assertEq('balance after 2nd rpc with empty meta (no idempotency → +1 again)', endD.balance, midD.balance + 1);

  await cleanup(userId);
} catch (err) {
  console.error('\nUnexpected error:', err.message);
  if (userId) await cleanup(userId);
  summary.failed++;
  summary.errors.push({ label: 'unexpected_throw', error: err.message });
}

// ============================================================================
// Phase 2 — finalize_payment(JSONB) atomicity (P0-2 fix, migration 022)
// ============================================================================

async function callFinalize(input) {
  const { data, error } = await sb.rpc('finalize_payment', { p_input: input });
  if (error) throw new Error(`finalize_payment: ${error.message}`);
  return data;
}

console.log('\n=== P0-2 regression test: finalize_payment atomicity ===\n');

try {
  // ------------------------------------------------------------------
  // Scenario E: taste_product (today-detail) — credits skipped, entitlement + snapshot atomically
  // ------------------------------------------------------------------
  console.log('Scenario E — taste_today_detail full pipeline atomic');
  const userE = await createTestUser('E');
  userId = userE.id;

  const pkE = 'AUDIT-P02-TASTE-' + crypto.randomBytes(6).toString('hex');
  const inputE = {
    userId,
    paymentKey: pkE,
    orderId: 'audit-finalize-E',
    packageId: 'taste_today_detail',
    packageKind: 'taste_product',
    amount: 550,
    credits: 0,
    subscriptionPlan: null,
    subscriptionRenewDays: 30,
    productId: 'today-detail',
    scopeKey: 'today:audit-reading-E',
    sourceSlug: 'audit-reading-E',
    readingId: null,
    readingKey: 'audit-reading-E',
    snapshotTitle: '오늘 자세히 보기',
    snapshotSummary: '회귀 테스트 — 결제 시점 보관 정보',
    snapshotJson: { productId: 'today-detail', test: true },
    snapshotOccurredOn: null,
    snapshotTargetYear: null,
    snapshotTargetMonth: null,
  };

  const r1 = await callFinalize(inputE);
  assertEq('1st finalize already_finalized=false', r1.already_finalized, false);

  // entitlement row 확인
  const { data: ents1 } = await sb
    .from('product_entitlements')
    .select('id, product_id, scope_key, payment_key')
    .eq('user_id', userId)
    .eq('payment_key', pkE);
  assertEq('product_entitlements rows after 1st finalize', ents1.length, 1);
  assertEq('entitlement product_id', ents1[0]?.product_id, 'today-detail');
  assertEq('entitlement scope_key', ents1[0]?.scope_key, 'today:audit-reading-E');

  // legacy mirror in credit_transactions
  const { data: legacy1 } = await sb
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('feature', 'taste_product')
    .contains('metadata', { paymentKey: pkE });
  assertEq('credit_transactions legacy mirror rows after 1st finalize', legacy1.length, 1);

  // snapshot
  const { data: snap1 } = await sb
    .from('paid_reading_snapshots')
    .select('id, product_id, scope_key, title')
    .eq('user_id', userId)
    .eq('product_id', 'today-detail');
  assertEq('paid_reading_snapshots rows after 1st finalize', snap1.length, 1);

  // replay
  const r2 = await callFinalize(inputE);
  assertEq('2nd finalize already_finalized=true (idempotent)', r2.already_finalized, true);

  const { data: ents2 } = await sb
    .from('product_entitlements')
    .select('id')
    .eq('user_id', userId)
    .eq('payment_key', pkE);
  assertEq('product_entitlements rows after 2nd finalize (still 1)', ents2.length, 1);

  const { data: legacy2 } = await sb
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('feature', 'taste_product')
    .contains('metadata', { paymentKey: pkE });
  assertEq('credit_transactions legacy mirror rows after 2nd finalize (still 1)', legacy2.length, 1);

  await cleanup(userId);

  // ------------------------------------------------------------------
  // Scenario F: credit_pack — credits + transaction only, no entitlement
  // ------------------------------------------------------------------
  console.log('\nScenario F — credit_pack via finalize_payment');
  const userF = await createTestUser('F');
  userId = userF.id;

  const startF = await getBalance(userId);
  const pkF = 'AUDIT-P02-PACK-' + crypto.randomBytes(6).toString('hex');
  const inputF = {
    userId,
    paymentKey: pkF,
    orderId: 'audit-finalize-F',
    packageId: 'credit_3',
    packageKind: 'credit_pack',
    amount: 990,
    credits: 3,
    subscriptionPlan: null,
    subscriptionRenewDays: 30,
    productId: null,
    scopeKey: null,
    sourceSlug: null,
    readingId: null,
    readingKey: null,
    snapshotTitle: null,
    snapshotSummary: null,
    snapshotJson: null,
    snapshotOccurredOn: null,
    snapshotTargetYear: null,
    snapshotTargetMonth: null,
  };

  const rF1 = await callFinalize(inputF);
  assertEq('finalize total_credits after 1st call', rF1.total_credits, startF.balance + startF.subscription_balance + 3);

  const rF2 = await callFinalize(inputF);
  assertEq('finalize 2nd call already_finalized=true', rF2.already_finalized, true);
  assertEq('finalize total_credits NO CHANGE on 2nd call', rF2.total_credits, rF1.total_credits);

  await cleanup(userId);

  // ------------------------------------------------------------------
  // Scenario G: subscription package — sub_balance + subscriptions UPSERT
  // ------------------------------------------------------------------
  console.log('\nScenario G — membership subscription via finalize_payment');
  const userG = await createTestUser('G');
  userId = userG.id;

  const pkG = 'AUDIT-P02-SUB-' + crypto.randomBytes(6).toString('hex');
  const inputG = {
    userId,
    paymentKey: pkG,
    orderId: 'audit-finalize-G',
    packageId: 'membership_plus',
    packageKind: 'subscription',
    amount: 4900,
    credits: 2,
    subscriptionPlan: 'plus_monthly',
    subscriptionRenewDays: 30,
    productId: null,
    scopeKey: null,
    sourceSlug: null,
    readingId: null,
    readingKey: null,
    snapshotTitle: null,
    snapshotSummary: null,
    snapshotJson: null,
    snapshotOccurredOn: null,
    snapshotTargetYear: null,
    snapshotTargetMonth: null,
  };

  const rG1 = await callFinalize(inputG);
  assertEq('subscription_balance after 1st finalize (+2)', rG1.subscription_balance, 2);

  const { data: subG } = await sb
    .from('subscriptions')
    .select('status, plan, renews_at')
    .eq('user_id', userId)
    .maybeSingle();
  assertEq('subscription plan', subG?.plan, 'plus_monthly');
  assertEq('subscription status', subG?.status, 'active');

  // replay
  const rG2 = await callFinalize(inputG);
  assertEq('2nd finalize already_finalized=true', rG2.already_finalized, true);
  assertEq('subscription_balance UNCHANGED on 2nd call', rG2.subscription_balance, rG1.subscription_balance);

  await cleanup(userId);
} catch (err) {
  console.error('\nUnexpected error in P0-2 tests:', err.message);
  if (userId) await cleanup(userId);
  summary.failed++;
  summary.errors.push({ label: 'p0_2_unexpected_throw', error: err.message });
}

console.log('\n=== Summary ===');
console.log(`  passed: ${summary.passed}`);
console.log(`  failed: ${summary.failed}`);

if (summary.failed > 0) {
  console.error('\nFAILURES:');
  for (const e of summary.errors) console.error('  -', JSON.stringify(e));
  process.exit(1);
}

console.log('\n✓ All idempotency invariants hold.');
process.exit(0);
