#!/usr/bin/env node
/**
 * Business activity audit — production traffic proxy 데이터 추출.
 *
 * 사용자 후속 작업 3번 — "사용자 traffic 기반 추가 우선순위 발굴".
 *
 * 배경:
 *   - PV 데이터 (Vercel Analytics 등) 없음 / payment_funnel_events 비어있음.
 *   - business action (reading 생성 / credit 차감 / entitlement 구매 / feedback /
 *     appointment) 빈도 = user activity proxy.
 *   - 정기 실행으로 페이지/상품별 우선순위 재산정 (회귀 모니터링 / UX 개선 후보).
 *
 * 사용:
 *   node scripts/audit-business-activity.mjs                 # 기본 last 30 days
 *   node scripts/audit-business-activity.mjs --days 7
 *
 * 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 출력:
 *   - 이벤트 카테고리별 events + unique users
 *   - 우선순위 권고 (Top — 회귀 모니터링 1순위 / Medium — UX 검토 / Low — defer)
 *
 * 권장 운영:
 *   - 월 1회 또는 분기 1회 실행
 *   - 결과 변동 시 PROGRESS.md §3 의 우선순위 갱신
 *   - audit-payment-idempotency 와 같이 manual 정기 도구 (CI 통합 X)
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
function getArgValue(name) {
  const idx = args.indexOf(`--${name}`);
  return idx === -1 ? null : args[idx + 1] ?? null;
}
const days = parseInt(getArgValue('days') ?? '30', 10);
const since = new Date(Date.now() - days * 86_400_000).toISOString();

console.log('');
console.log('═'.repeat(72));
console.log(`  Business Activity Audit (last ${days} days, since ${since.slice(0, 10)})`);
console.log('═'.repeat(72));
console.log('');

const supabase = await createSupabaseServiceClient();

async function countBy({ table, where, groupBy }) {
  const cols = ['user_id', 'created_at', groupBy].filter(Boolean).join(', ');
  let query = supabase.from(table).select(cols, { count: 'exact' });
  query = query.gte('created_at', since);
  for (const [k, v] of Object.entries(where ?? {})) {
    query = query.eq(k, v);
  }
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);

  if (!groupBy) {
    return [
      {
        product: '-',
        events: data?.length ?? 0,
        unique_users: new Set((data ?? []).map((r) => r.user_id)).size,
      },
    ];
  }

  const map = new Map();
  for (const row of data ?? []) {
    const key = row[groupBy] ?? '-';
    if (!map.has(key)) map.set(key, { product: String(key), events: 0, users: new Set() });
    const entry = map.get(key);
    entry.events += 1;
    if (row.user_id) entry.users.add(row.user_id);
  }
  return Array.from(map.values())
    .map((e) => ({ product: e.product, events: e.events, unique_users: e.users.size }))
    .sort((a, b) => b.events - a.events);
}

const buckets = [
  {
    event: 'reading_created',
    rows: await countBy({ table: 'readings' }),
  },
  {
    event: 'credit_deduct',
    rows: await countBy({
      table: 'credit_transactions',
      where: { type: 'use' },
      groupBy: 'feature',
    }),
  },
  {
    event: 'entitlement_purchased',
    rows: await countBy({ table: 'product_entitlements', groupBy: 'product_id' }),
  },
  {
    event: 'fortune_feedback',
    rows: await countBy({ table: 'fortune_feedback', groupBy: 'concern_id' }),
  },
  {
    event: 'appointment_booked',
    rows: await countBy({ table: 'appointments' }),
  },
];

// 페이지/상품별 합산 활성도.
const allRows = buckets.flatMap((b) => b.rows.map((r) => ({ event: b.event, ...r })));
allRows.sort((a, b) => b.events - a.events);

console.log(`  ${'event'.padEnd(24)} ${'product'.padEnd(32)} ${'events'.padStart(8)}  unique_users`);
console.log(`  ${'-'.repeat(80)}`);
for (const r of allRows) {
  console.log(
    `  ${r.event.padEnd(24)} ${r.product.padEnd(32)} ${String(r.events).padStart(8)}  ${r.unique_users}`,
  );
}
console.log('');

// 자동 우선순위 분류 — events 임계값 기준.
const top = allRows.filter((r) => r.events >= 30);
const medium = allRows.filter((r) => r.events >= 5 && r.events < 30);
const low = allRows.filter((r) => r.events < 5);

console.log('  📊 우선순위 자동 분류:');
console.log('');
console.log(`  🔴 TOP (events ≥ 30) — 회귀 모니터링 1순위, 영향 가장 큼`);
for (const r of top) console.log(`     · ${r.event} / ${r.product}: ${r.events} events, ${r.unique_users} users`);
if (top.length === 0) console.log('     (해당 없음)');
console.log('');

console.log(`  🟡 MEDIUM (5 ≤ events < 30) — UX 개선 / 다음 분기 redesign 검토`);
for (const r of medium) console.log(`     · ${r.event} / ${r.product}: ${r.events} events, ${r.unique_users} users`);
if (medium.length === 0) console.log('     (해당 없음)');
console.log('');

console.log(`  🟢 LOW (events < 5) — 우선순위 낮음, defer`);
for (const r of low) console.log(`     · ${r.event} / ${r.product}: ${r.events} events, ${r.unique_users} users`);
if (low.length === 0) console.log('     (해당 없음)');
console.log('');

console.log('  권장 후속:');
console.log('    1) TOP 항목 관련 페이지의 audit (redesign-coverage / mockup-placeholders) 통과 여부 우선 검증.');
console.log('    2) MEDIUM 항목 → 다음 분기 UX/redesign 작업 후보 (사용자 보고 우선순위).');
console.log('    3) LOW 항목 → 회귀 발생 시 fix, 사전 작업 defer.');
console.log('');
