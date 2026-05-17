#!/usr/bin/env node
/**
 * lifetime-report (49,000원) idempotency + 매출/환불 audit.
 *
 * 배경 (사용자 후속 작업 2번):
 *   audit-business-activity 가 lifetime-report 8 events / 4 users (MEDIUM) 검출.
 *   49,000원 = 가장 비싼 단일 상품 → 회귀 발생 시 사용자 환불 부담 큼.
 *   detail_report 회귀 (PR #199) 후 9 코인 환불 처리 — 비슷한 패턴 lifetime 에서
 *   재발 시 환불액 ~10배 (1 회 49,000원).
 *
 * 검증 항목:
 *   1. 같은 user + 같은 scope (reading) 에 2+ entitlement row — 회귀 의심
 *   2. 매출 총액 (gross) / 환불액 / 순매출
 *   3. 환불 row (regression_refund 또는 status='refunded' 등) 추적
 *   4. 최근 결제 패턴 (last 30/90 days)
 *
 * 사용:
 *   node scripts/audit-lifetime-report.mjs                  # 전체 history
 *   node scripts/audit-lifetime-report.mjs --days 90
 *   node scripts/audit-lifetime-report.mjs --strict         # 회귀 1건 이상 exit 1
 *
 * 환경변수: SUPABASE_SERVICE_ROLE_KEY (.env.local)
 *
 * 환불 발생 시 절차 (PROGRESS.md §1.22 참조):
 *   1. 본 audit 로 회귀 행 식별 (rowId / userId / scope / 결제일)
 *   2. Toss 결제 환불 API (https://docs.tosspayments.com/reference) — paymentKey 로
 *      환불 요청 (전액 또는 부분).
 *   3. product_entitlements 의 해당 row status → 'refunded' (schema 추가 필요) 또는
 *      삭제 + audit row (regression_refund metadata) 기록.
 *   4. 사용자 알림 (이메일 또는 push) — 환불 사유 + 영수증.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSupabaseServiceClient,
  loadLocalEnv,
} from './lib/classics/upsert-classic-corpus.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadLocalEnv(projectRoot);

const args = process.argv.slice(2);
const strict = args.includes('--strict');
function getArgValue(name) {
  const idx = args.indexOf(`--${name}`);
  return idx === -1 ? null : args[idx + 1] ?? null;
}
const daysArg = getArgValue('days');
const since = daysArg ? new Date(Date.now() - parseInt(daysArg, 10) * 86_400_000).toISOString() : null;

const LIFETIME_AMOUNT_KRW = 49_000;
const PRODUCT_ID = 'lifetime-report';

console.log('');
console.log('═'.repeat(72));
console.log(`  Lifetime Report Audit (${PRODUCT_ID}, ${daysArg ? `last ${daysArg} days` : 'all history'})`);
console.log('═'.repeat(72));
console.log('');

const supabase = await createSupabaseServiceClient();

let query = supabase
  .from('product_entitlements')
  .select('id, user_id, scope_key, metadata, created_at, updated_at')
  .eq('product_id', PRODUCT_ID);
if (since) query = query.gte('created_at', since);
query = query.order('created_at', { ascending: true });

const { data: rows, error } = await query;
if (error) {
  console.error('  ❌ supabase query 실패:', error.message);
  process.exit(2);
}

const totalRows = rows?.length ?? 0;
const uniqueUsers = new Set((rows ?? []).map((r) => r.user_id)).size;
const uniqueScopes = new Set((rows ?? []).map((r) => `${r.user_id}|${r.scope_key}`)).size;
const grossKRW = totalRows * LIFETIME_AMOUNT_KRW;

console.log(`  총 결제 row: ${totalRows}`);
console.log(`  순결제 (user × scope 유니크): ${uniqueScopes}`);
console.log(`  unique users: ${uniqueUsers}`);
console.log(`  매출 (gross, KRW): ${grossKRW.toLocaleString()}`);
console.log('');

// 회귀 검출 — 같은 user + 같은 scope_key 2+ row
const groupMap = new Map();
for (const row of rows ?? []) {
  const key = `${row.user_id}|${row.scope_key ?? '-'}`;
  if (!groupMap.has(key)) groupMap.set(key, []);
  groupMap.get(key).push(row);
}

const duplicates = Array.from(groupMap.entries())
  .filter(([, items]) => items.length > 1)
  .map(([key, items]) => {
    const [userId, scope] = key.split('|');
    return {
      user_id: userId,
      scope_key: scope,
      count: items.length,
      ids: items.map((i) => i.id),
      times: items.map((i) => i.created_at),
    };
  });

if (duplicates.length === 0) {
  console.log('  ✅ 회귀 0건 — 같은 user + 같은 scope 2+ 결제 없음.');
  console.log('');
} else {
  const refundRequired = duplicates.reduce((sum, d) => sum + (d.count - 1) * LIFETIME_AMOUNT_KRW, 0);
  console.log(`  🔴 회귀 ${duplicates.length} 케이스 — 잠재 환불 ${refundRequired.toLocaleString()} KRW`);
  console.log('');
  for (const d of duplicates) {
    console.log(`  · user ${d.user_id.slice(0, 8)}... scope ${d.scope_key.slice(0, 30)} count=${d.count}`);
    for (const t of d.times) console.log(`      ${t}`);
  }
  console.log('');
}

// 환불 row 추적 — credit_transactions 의 lifetime-report 관련 refund metadata
const { data: refundRows } = await supabase
  .from('credit_transactions')
  .select('id, user_id, amount, type, metadata, created_at')
  .filter('metadata->>kind', 'eq', 'regression_refund')
  .ilike('metadata->>reason', `%${PRODUCT_ID}%`);

if (refundRows && refundRows.length > 0) {
  console.log(`  🪙 환불 history (regression_refund metadata 매치): ${refundRows.length}건`);
  for (const r of refundRows) {
    console.log(`  · ${r.user_id.slice(0, 8)}... ${r.created_at}  amount=${r.amount}  reason=${r.metadata?.reason ?? '-'}`);
  }
} else {
  console.log('  🪙 환불 history (lifetime-report): 0건');
}
console.log('');

console.log('  환불 발생 시 절차:');
console.log('    1) 본 audit 로 회귀 row 식별 (id / user_id / scope_key / 결제일).');
console.log('    2) Toss 결제 환불 API (paymentKey 로 환불 요청, 전액 또는 부분).');
console.log("    3) product_entitlements row status → 'refunded' (schema 추가) 또는 삭제 + audit row.");
console.log('    4) 사용자 알림 (이메일 / push).');
console.log('');

if (strict && duplicates.length > 0) {
  console.log('  --strict 모드: 회귀 1건 이상이므로 exit 1.');
  process.exit(1);
}
