#!/usr/bin/env node
/**
 * 결제 idempotency 회귀 모니터링 — 같은 user + 같은 KST 일에 today-fortune
 * detail_report 가 2+ 차감된 row 가 있는지 자동 검사.
 *
 * 배경:
 *   PR #196 / #199 / #200 / #201 으로 4-tier idempotency + client marker 적용.
 *   audit baseline (2026-05-17): 회귀 0건. 본 script 는 정기 모니터링으로
 *   회귀 재발 시 즉시 감지 (사용자가 first detector 되는 패턴 차단).
 *
 * 사용:
 *   node scripts/audit-payment-idempotency.mjs                    # 기본 last 7 days
 *   node scripts/audit-payment-idempotency.mjs --days 30          # 지정 일수
 *   node scripts/audit-payment-idempotency.mjs --strict           # 회귀 1건이라도 있으면 exit 1
 *   node scripts/audit-payment-idempotency.mjs --since 2026-05-17 # 특정 날짜 이후
 *
 * 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 출력:
 *   - 회귀 row 표 (user_id, kst_date, daily_charges, overcharged)
 *   - 총 overcharged 코인 (잠재 환불 대상)
 *   - --strict 모드: 1건 이상 시 exit 1
 *
 * 권장 운영:
 *   - 주 1회 manual 실행 (배포 후 첫 7일 / 30일 monitoring)
 *   - 회귀 감지 시 supabase MCP 로 추가 evidence 수집 + 환불 절차
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
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const days = parseInt(getArgValue('days') ?? '7', 10);
const sinceArg = getArgValue('since');

const since = sinceArg
  ? new Date(`${sinceArg}T00:00:00+09:00`)
  : new Date(Date.now() - days * 86_400_000);

console.log('');
console.log('═'.repeat(72));
console.log('  Payment Idempotency Audit (PR #196~#201 회귀 모니터링)');
console.log('═'.repeat(72));
console.log(`  검사 범위: ${since.toISOString()} ~ 현재`);
console.log(`  Strict 모드: ${strict ? 'ON (exit 1 on 회귀)' : 'OFF (보고만)'}`);
console.log('');

const supabase = await createSupabaseServiceClient();

// 같은 user + 같은 KST 일에 today-fortune detail_report 2+ 차감 row 검사.
// PR #199 의 daily idempotency 룰 — 같은 KST 일 = 1회만 차감되어야 함.
const { data, error } = await supabase.rpc('audit_payment_idempotency_duplicates', {
  p_since: since.toISOString(),
});

let rows;
if (error) {
  // RPC 미설치 시 fallback — raw query 직접 호출.
  // (RPC 는 본 audit 만을 위해 만들 필요 없음. 미설치이면 client-side aggregation.)
  const { data: rawRows, error: rawError } = await supabase
    .from('credit_transactions')
    .select('user_id, created_at, metadata, id')
    .eq('feature', 'detail_report')
    .eq('type', 'use')
    .eq('amount', -1)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (rawError) {
    console.error('  ❌ supabase query 실패:', rawError.message);
    process.exit(2);
  }

  // Client-side group by (user_id, KST date).
  const groupMap = new Map();
  for (const row of rawRows ?? []) {
    const kstDate = new Date(
      new Date(row.created_at).toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
    )
      .toISOString()
      .slice(0, 10);
    const key = `${row.user_id}|${kstDate}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { user_id: row.user_id, kst_date: kstDate, charges: [] });
    }
    groupMap.get(key).charges.push(row);
  }

  rows = Array.from(groupMap.values())
    .filter((g) => g.charges.length > 1)
    .map((g) => ({
      user_id: g.user_id,
      kst_date: g.kst_date,
      daily_charges: g.charges.length,
      overcharged: g.charges.length - 1,
      kinds: [...new Set(g.charges.map((c) => c.metadata?.kind ?? null))],
      times: g.charges.map((c) => c.created_at),
    }))
    .sort((a, b) => {
      if (a.kst_date !== b.kst_date) return a.kst_date < b.kst_date ? 1 : -1;
      return b.daily_charges - a.daily_charges;
    });
} else {
  rows = data ?? [];
}

if (rows.length === 0) {
  console.log('  ✅ 회귀 0건 — 같은 user + 같은 KST 일 2+ 차감 row 없음.');
  console.log('     PR #196~#201 의 4-tier idempotency + client marker 정상 작동.');
  console.log('');
  process.exit(0);
}

const totalOvercharged = rows.reduce((sum, r) => sum + r.overcharged, 0);

console.log(`  🔴 회귀 ${rows.length} 케이스 — 총 overcharged ${totalOvercharged} 코인`);
console.log('');
console.log(
  `  ${'user_id'.padEnd(38)} ${'kst_date'.padEnd(12)} ${'charges'.padStart(8)} ${'overcharged'.padStart(12)}  kinds`,
);
console.log(`  ${'-'.repeat(70)}`);
for (const r of rows) {
  const userShort = r.user_id.slice(0, 36);
  const kinds = (r.kinds || []).filter(Boolean).join(', ') || '-';
  console.log(
    `  ${userShort.padEnd(38)} ${r.kst_date.padEnd(12)} ${String(r.daily_charges).padStart(8)} ${String(r.overcharged).padStart(12)}  ${kinds}`,
  );
}
console.log('');
console.log('  해결:');
console.log('    1) supabase MCP 로 추가 evidence — 어떤 sourceSessionId / readingKey 매치 깨졌는지 확인.');
console.log('    2) 환불 — affected user 의 user_credits.balance += overcharged + audit row.');
console.log('    3) 코드 fix — 4-tier idempotency 의 어떤 path 가 못 잡았는지 분석 + 추가 fallback.');
console.log('');

if (strict) {
  console.log('  --strict 모드: 회귀 1건 이상이므로 exit 1.');
  process.exit(1);
}
