#!/usr/bin/env node
/**
 * ai_chat (3코인 dialogue) idempotency 검증.
 *
 * 배경 (사용자 후속 작업 1번):
 *   audit-business-activity 가 ai_chat 22 events / 3 users (MEDIUM) 검출.
 *   detail_report 와 달리 unlockCreditsOnce atomic RPC 미적용 — turn-count 기반
 *   idempotency 만 있음 (getAiChatSuccessfulTurns count → turnPlan). race condition
 *   시 같은 turn N 을 두 호출이 동시에 인식하면 둘 다 charged_bundle 로 두 번 차감.
 *
 * 검증 항목:
 *   1. metadata.turnNumber vs 실제 row 순서 일치 (turn count 무결성)
 *   2. charged_bundle position 정상 (turn 4, 7, 10, 13, ... = freeTurns + bundleSize * N)
 *   3. 같은 user 같은 created_at (초 단위) 에 2+ row — race 의심
 *   4. metadata.kind 가 'ai_chat_turn' 아닌 ai_chat row (deductCreditsAmount only)
 *
 * 사용:
 *   node scripts/audit-ai-chat-idempotency.mjs              # 기본 last 30 days
 *   node scripts/audit-ai-chat-idempotency.mjs --days 90
 *   node scripts/audit-ai-chat-idempotency.mjs --strict     # 회귀 1건이라도 exit 1
 *
 * 환경변수: SUPABASE_SERVICE_ROLE_KEY (.env.local)
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
const days = parseInt(getArgValue('days') ?? '30', 10);
const since = new Date(Date.now() - days * 86_400_000).toISOString();

const FREE_TURNS = 3;
const BUNDLE_SIZE = 3;
const BUNDLE_COST = 3;

console.log('');
console.log('═'.repeat(72));
console.log(`  AI Chat Idempotency Audit (last ${days} days)`);
console.log('═'.repeat(72));
console.log('');

const supabase = await createSupabaseServiceClient();
const { data: rows, error } = await supabase
  .from('credit_transactions')
  .select('id, user_id, amount, metadata, created_at')
  .eq('feature', 'ai_chat')
  .eq('type', 'use')
  .gte('created_at', since)
  .order('created_at', { ascending: true });

if (error) {
  console.error('  ❌ supabase query 실패:', error.message);
  process.exit(2);
}

// Group by user.
const byUser = new Map();
for (const row of rows ?? []) {
  if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
  byUser.get(row.user_id).push(row);
}

let totalRows = rows?.length ?? 0;
let issuesFound = 0;
const issues = [];

function expectedStatus(turnNumber) {
  if (turnNumber <= FREE_TURNS) return 'free_intro';
  const paid = turnNumber - FREE_TURNS;
  return paid % BUNDLE_SIZE === 1 ? 'charged_bundle' : 'bundle_included';
}

function expectedCostByTurn(turnNumber) {
  return expectedStatus(turnNumber) === 'charged_bundle' ? BUNDLE_COST : 0;
}

for (const [userId, userRows] of byUser) {
  // 각 row 의 metadata.turnNumber 와 실제 순서 비교.
  // 단 ai_chat 전체 누적 successful turns 가 기준 — 본 audit 의 since 이전 row 포함 안 함.
  // 따라서 since 이전 turns 도 supabase 로 가져와 누적 카운트.
  // (간단화: since 이전 row 만 카운트 — 정확한 검증은 시작점 정합성)
  const { count: priorCount } = await supabase
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'use')
    .eq('feature', 'ai_chat')
    .lt('created_at', since);

  let cumTurn = priorCount ?? 0;
  let prevCreatedAtMs = null;

  for (const row of userRows) {
    cumTurn += 1;
    const md = row.metadata ?? {};
    const recordedTurn = md.turnNumber;
    const recordedStatus = md.billingStatus;
    const expectStatus = expectedStatus(cumTurn);
    const expectCost = expectedCostByTurn(cumTurn);
    const actualCost = -row.amount;

    // Issue 1: turnNumber mismatch
    if (typeof recordedTurn === 'number' && recordedTurn !== cumTurn) {
      issues.push({
        type: 'turn-mismatch',
        user_id: userId,
        row_id: row.id,
        created_at: row.created_at,
        detail: `metadata.turnNumber=${recordedTurn}, expected=${cumTurn}`,
      });
      issuesFound++;
    }

    // Issue 2: cost mismatch (charged_bundle expected but cost 0, or vice versa)
    if (actualCost !== expectCost) {
      issues.push({
        type: 'cost-mismatch',
        user_id: userId,
        row_id: row.id,
        created_at: row.created_at,
        detail: `cost=${actualCost}, expected=${expectCost} (cum turn ${cumTurn}, status ${expectStatus})`,
      });
      issuesFound++;
    }

    // Issue 3: race — 2+ rows within 2 seconds for same user
    const createdMs = new Date(row.created_at).getTime();
    if (prevCreatedAtMs !== null && createdMs - prevCreatedAtMs < 2_000) {
      issues.push({
        type: 'race-suspect',
        user_id: userId,
        row_id: row.id,
        created_at: row.created_at,
        detail: `prev row ${createdMs - prevCreatedAtMs}ms ago (race condition 의심)`,
      });
      issuesFound++;
    }
    prevCreatedAtMs = createdMs;

    // Issue 4: status mismatch
    if (recordedStatus && recordedStatus !== expectStatus && recordedStatus !== 'result_intro_free') {
      issues.push({
        type: 'status-mismatch',
        user_id: userId,
        row_id: row.id,
        created_at: row.created_at,
        detail: `metadata.billingStatus=${recordedStatus}, expected=${expectStatus} (cum turn ${cumTurn})`,
      });
      issuesFound++;
    }
  }
}

console.log(`  검사 row: ${totalRows} (ai_chat use rows in last ${days} days)`);
console.log(`  검사 users: ${byUser.size}`);
console.log(`  발견된 issue: ${issuesFound}`);
console.log('');

if (issuesFound === 0) {
  console.log('  ✅ ai_chat idempotency 정상 — turn count 무결성 / cost 정확성 / race 의심 없음.');
  console.log('');
  process.exit(0);
}

console.log('  🔴 회귀 의심:');
console.log('');
const byType = new Map();
for (const issue of issues) {
  if (!byType.has(issue.type)) byType.set(issue.type, []);
  byType.get(issue.type).push(issue);
}
for (const [type, items] of byType) {
  console.log(`  · ${type}: ${items.length}건`);
  for (const it of items.slice(0, 5)) {
    console.log(`    ${it.user_id.slice(0, 8)}... ${it.created_at} — ${it.detail}`);
  }
  if (items.length > 5) console.log(`    (...${items.length - 5}건 더)`);
  console.log('');
}

console.log('  해결:');
console.log('    1) turn-mismatch / status-mismatch: 코드 분석 (race 또는 record path 누락)');
console.log('    2) cost-mismatch: deduct 누락 또는 잘못된 cost (charged turn 차감 실패).');
console.log('    3) race-suspect: ai_chat 에 unlockCreditsOnce 같은 atomic idempotency 적용 검토.');
console.log('');

if (strict) {
  console.log('  --strict 모드: 회귀 1건 이상이므로 exit 1.');
  process.exit(1);
}
