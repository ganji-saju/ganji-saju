#!/usr/bin/env node
/**
 * 결제 진입점 9곳 (PR #177/#178) production 검증용 entitlement 진단 도구.
 *
 * 사용:
 *   node scripts/audit-user-entitlements.mjs <user-id-or-email>
 *   node scripts/audit-user-entitlements.mjs kym@richdoc.kr
 *   node scripts/audit-user-entitlements.mjs 11111111-2222-3333-4444-555555555555
 *
 * 출력:
 *   1) auth.users 행 (id / email)
 *   2) subscriptions 행 (활성 여부 + plan)
 *   3) product_entitlements 행 (lifetime / taste 전체)
 *   4) credit_transactions 행 (legacy entitlement audit)
 *   5) **9 진입점 예상 동작** — "차단" / "결제 가능" 각각의 이유
 *
 * 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSupabaseServiceClient,
  loadLocalEnv,
} from './lib/classics/upsert-classic-corpus.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadLocalEnv(projectRoot);

const TASTE_PRODUCT_IDS = [
  'today-detail',
  'love-question',
  'money-pattern',
  'work-flow',
  'monthly-calendar',
  'year-core',
];

const LEGACY_FEATURES = ['taste_product', 'lifetime_report'];

function fmt(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function section(title) {
  console.log('');
  console.log('═'.repeat(72));
  console.log(`  ${title}`);
  console.log('═'.repeat(72));
}

function row(label, value) {
  console.log(`  ${label.padEnd(22)} ${fmt(value)}`);
}

async function resolveUser(supabase, identifier) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
    const { data, error } = await supabase.auth.admin.getUserById(identifier);
    if (error) throw new Error(`getUserById 실패: ${error.message}`);
    if (!data?.user) throw new Error(`해당 user_id 가 존재하지 않습니다: ${identifier}`);
    return { id: data.user.id, email: data.user.email ?? null };
  }
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers 실패: ${error.message}`);
  const found = data?.users?.find((u) => u.email?.toLowerCase() === identifier.toLowerCase());
  if (!found) throw new Error(`이메일로 사용자를 찾지 못했습니다: ${identifier}`);
  return { id: found.id, email: found.email ?? null };
}

async function readSubscription(supabase, userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan, renews_at, created_at, updated_at, toss_billing_key')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`subscriptions 조회 실패: ${error.message}`);
  return data ?? null;
}

async function readProductEntitlements(supabase, userId) {
  const { data, error } = await supabase
    .from('product_entitlements')
    .select('id, product_id, scope_key, order_id, payment_key, package_id, amount, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`product_entitlements 조회 실패: ${error.message}`);
  return data ?? [];
}

async function readLegacyEntitlements(supabase, userId) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id, type, feature, amount, metadata, created_at')
    .eq('user_id', userId)
    .in('feature', LEGACY_FEATURES)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`credit_transactions 조회 실패: ${error.message}`);
  return data ?? [];
}

function summarizeSubscription(sub) {
  if (!sub) return { hasActive: false, plan: null, isExpired: false };
  const isExpired =
    sub.renews_at !== null && new Date(sub.renews_at).getTime() <= Date.now();
  const hasActive = sub.status === 'active' && !isExpired;
  return { hasActive, plan: sub.plan, isExpired, renewsAt: sub.renews_at };
}

function groupEntitlements(rows) {
  const byProduct = new Map();
  for (const row of rows) {
    const key = row.product_id ?? '(unknown)';
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(row);
  }
  return byProduct;
}

function printEntryPointVerdicts(subSummary, productMap, legacyRows) {
  section('9 결제 진입점 예상 동작 (활성 계정 검증 매트릭스)');

  // 1. /membership/checkout — 활성 구독자 진입 시 차단
  console.log('  [1] /membership/checkout (PR #177)');
  if (subSummary.hasActive) {
    row('   예상', `🟢 차단 (이미 ${subSummary.plan} 이용 중)`);
  } else {
    row('   예상', '⚪ 결제 가능 (활성 구독 없음)');
  }

  // 2. /membership plan 카드 — 활성 구독자에게 "이용 중" 뱃지
  console.log('  [2] /membership plan 카드 (PR #177)');
  row('   예상', subSummary.hasActive
    ? `🟢 "이용 중" 뱃지 노출 (${subSummary.plan})`
    : '⚪ 모든 plan 결제 button 노출');

  // 3. /pricing plan 카드 — 활성 구독자에게 "✓ 이용 중 · 결제 내역" 버튼
  console.log('  [3] /pricing plan 카드 (PR #177)');
  row('   예상', subSummary.hasActive
    ? `🟢 "✓ 이용 중 · 결제 내역" 버튼 (${subSummary.plan})`
    : '⚪ 모든 plan 결제 button 노출');

  // 4. /saju/[slug]/deep — lifetime-report entitlement 보유 시 차단
  const lifetimeEnts = productMap.get('lifetime-report') ?? [];
  const lifetimeLegacy = legacyRows.filter((r) => r.feature === 'lifetime_report');
  console.log('  [4] /saju/[slug]/deep lifetime CTA (PR #177)');
  row('   product_entitlements', `${lifetimeEnts.length}건`);
  row('   credit_transactions (legacy)', `${lifetimeLegacy.length}건`);
  if (lifetimeEnts.length > 0 || lifetimeLegacy.length > 0) {
    row('   예상', '🟢 보유 slug 별로 "✓ 구매한 풀이 보기" 노출');
  } else {
    row('   예상', '⚪ 결제 가능 (보유 없음)');
  }

  // 5. /saju/[slug]/premium — premium 멤버십 button + lifetime 분기
  console.log('  [5] /saju/[slug]/premium (PR #177)');
  const isPremiumActive = subSummary.hasActive && subSummary.plan === 'premium_monthly';
  row('   premium 멤버십 button',
    isPremiumActive ? '🟢 "✓ 멤버십 이용 중"' : '⚪ 결제 가능');
  row('   lifetime CTA',
    lifetimeEnts.length > 0 || lifetimeLegacy.length > 0
      ? '🟢 "✓ 구매한 풀이 보기"' : '⚪ 결제 가능');

  // 6. premium-lock-card (today-detail 550원, PR #178)
  const todayEnts = productMap.get('today-detail') ?? [];
  console.log('  [6] premium-lock-card today-detail 550원 (PR #178)');
  row('   product_entitlements', `${todayEnts.length}건`);
  if (todayEnts.length > 0) {
    const scopes = todayEnts.map((e) => e.scope_key).filter(Boolean);
    row('   보유 scope_key', scopes.slice(0, 5).join(', ') + (scopes.length > 5 ? ' …' : ''));
    row('   예상', '🟢 해당 scope 진입 시 "✓ 이미 구매한 풀이"');
  } else {
    row('   예상', '⚪ 결제 button 노출 (coin unlock 별도 확인 필요)');
  }

  // 7. compatibility/result manual (love-question 990원, PR #178)
  const loveEnts = productMap.get('love-question') ?? [];
  console.log('  [7] /compatibility/result manual love-question 990원 (PR #178)');
  row('   product_entitlements', `${loveEnts.length}건`);
  row('   예상', loveEnts.length > 0
    ? '🟢 manual 분기에서 결제 link 제거 + 보유 노출'
    : '⚪ 결제 가능');

  // 8. fortune-calendar-panel (monthly-calendar 1,900원, PR #178)
  const calendarEnts = productMap.get('monthly-calendar') ?? [];
  console.log('  [8] fortune-calendar-panel monthly-calendar 1,900원 (PR #178)');
  row('   product_entitlements', `${calendarEnts.length}건`);
  if (calendarEnts.length > 0) {
    const scopes = calendarEnts.map((e) => e.scope_key).filter(Boolean);
    row('   보유 scope_key', scopes.slice(0, 5).join(', ') + (scopes.length > 5 ? ' …' : ''));
    row('   예상', '🟢 선택한 월이 보유 scope 와 일치 시 "✓ 이미 구매한 N월 캘린더 열기"');
  } else {
    row('   예상', '⚪ 결제 가능');
  }

  // 9. /api/notifications/feed subscription-expiring 분기
  console.log('  [9] /api/notifications/feed subscription-expiring (PR #178)');
  row('   예상', subSummary.hasActive
    ? `🟢 알림 href = /my/billing (${subSummary.plan} 활성)`
    : '⚪ 알림 href = /membership/checkout?plan=plus&from=expiring');
}

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('사용법: node scripts/audit-user-entitlements.mjs <user-id-or-email>');
    process.exit(1);
  }

  const supabase = createSupabaseServiceClient();

  section(`Entitlement 진단 시작: ${identifier}`);
  const user = await resolveUser(supabase, identifier);
  row('user_id', user.id);
  row('email', user.email);

  const [sub, productEnts, legacyEnts] = await Promise.all([
    readSubscription(supabase, user.id),
    readProductEntitlements(supabase, user.id),
    readLegacyEntitlements(supabase, user.id),
  ]);

  section('subscriptions 테이블');
  if (sub) {
    row('status', sub.status);
    row('plan', sub.plan);
    row('renews_at', sub.renews_at);
    row('created_at', sub.created_at);
    row('updated_at', sub.updated_at);
    row('toss_billing_key', sub.toss_billing_key ? '(있음)' : '(없음)');
  } else {
    row('상태', '⚠️ 구독 행 없음');
  }
  const subSummary = summarizeSubscription(sub);
  row('→ 활성 여부', subSummary.hasActive ? '🟢 active' : '⚪ 비활성');
  if (subSummary.isExpired) {
    row('→ 주의', '⚠️ renews_at 이 과거 — DB 상태가 expired 로 갱신되어야 함');
  }

  section(`product_entitlements 테이블 (총 ${productEnts.length}건)`);
  if (productEnts.length === 0) {
    console.log('  (행 없음)');
  } else {
    for (const ent of productEnts) {
      console.log('  ─'.repeat(36));
      row('product_id', ent.product_id);
      row('scope_key', ent.scope_key);
      row('package_id', ent.package_id);
      row('amount', ent.amount);
      row('order_id', ent.order_id);
      row('created_at', ent.created_at);
    }
  }

  section(`credit_transactions 테이블 (legacy entitlement audit, ${legacyEnts.length}건)`);
  if (legacyEnts.length === 0) {
    console.log('  (legacy entitlement 행 없음)');
  } else {
    for (const tx of legacyEnts) {
      console.log('  ─'.repeat(36));
      row('type', tx.type);
      row('feature', tx.feature);
      row('amount', tx.amount);
      row('metadata.scopeKey', tx.metadata?.scopeKey ?? '-');
      row('metadata.productId', tx.metadata?.productId ?? '-');
      row('metadata.readingKey', tx.metadata?.readingKey ?? '-');
      row('created_at', tx.created_at);
    }
  }

  const productMap = groupEntitlements(productEnts);
  printEntryPointVerdicts(subSummary, productMap, legacyEnts);

  section('진단 완료');
  console.log('  → 위 매트릭스를 production browser 에서 직접 클릭하며 일치 여부 확인.');
  console.log('  → 🟢 = 차단/이용중 표시 기대 / ⚪ = 결제 button 노출 기대');
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('❌ 오류:', err.message);
  console.error(err.stack);
  process.exit(1);
});
