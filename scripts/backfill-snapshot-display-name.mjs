#!/usr/bin/env node
/**
 * Backfill — 과거 today_fortune_result_snapshots 의 free_result_json.userName 교정.
 *
 * 배경: 전 결제 이름 fix(PR #398) 이전에 저장된 스냅샷은 빌드 시점에 이름이 없어
 *   free_result_json.userName = null 로 굳었고, 상세 hero 가 '달빛이' 로 렌더된다.
 *   이 스크립트가 각 행의 user_id 로 현재 프로필(display_name) → 소셜 메타데이터 순으로
 *   이름을 다시 해석해, 실명이 있으면 free_result_json.userName 만 패치한다.
 *
 * 결정 규칙은 src/lib/today-fortune/backfill-snapshot-name.ts(resolveBackfillUserName)와
 *   동일하며 그 테스트가 스펙이다. (이미 실명이면 보존, null/빈/'달빛이'만 교정, 없으면 유지)
 *
 * 사용:
 *   node scripts/backfill-snapshot-display-name.mjs            # dry-run(미적용, 기본)
 *   node scripts/backfill-snapshot-display-name.mjs --apply    # 실제 update
 *
 * 환경변수 (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSupabaseServiceClient,
  loadLocalEnv,
} from './lib/classics/upsert-classic-corpus.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadLocalEnv(projectRoot);

const APPLY = process.argv.includes('--apply');
const MOONLIGHT_FALLBACK_DISPLAY_NAME = '달빛이';
const AUTH_NAME_KEYS = ['name', 'full_name', 'nickname', 'user_name'];
const BATCH = 500;

/** src/lib/today-fortune/backfill-snapshot-name.ts 와 동일 규칙. */
function resolveBackfillUserName(currentUserName, resolvedName) {
  const current = (currentUserName ?? '').trim();
  if (current && current !== MOONLIGHT_FALLBACK_DISPLAY_NAME) return null;
  const resolved = (resolvedName ?? '').trim();
  if (resolved && resolved !== current) return resolved;
  return null;
}

/**
 * 2026-08-31 — 이 스냅샷이 **계정 주인 본인의 사주**인지 확인한다.
 *   가족 사주 스냅샷(userName 이 비어 있는 과거 행 포함)에 계정 주인 이름을 각인하면
 *   되돌릴 수 없다(본문 문자열·LLM 산문에 굳음). 확인 못 하면 건드리지 않는다.
 *   정체성 엔진 대신 생년월일시·성별 원시 비교를 쓴다(스크립트에 TS 엔진을 끌어오지 않음).
 *   ⚠️ profiles 는 사용자가 입력한 **원본**(음력 가능) 날짜를 저장하고 스냅샷 input_json 은
 *   **양력 변환 후** 값이라, 음력 가입자는 원시 비교가 성립하지 않는다 → 확인 불가로 보고 skip
 *   한다(각인하지 않는 쪽이 안전). 그 계정을 백필하려면 음력→양력 변환을 붙여야 한다.
 */
function isOwnersOwnSaju(inputJson, profile) {
  if (!inputJson || !profile) return false;
  // 음력 저장 프로필은 양력 스냅샷과 직접 비교 불가 — 확인 불가로 처리.
  if (profile.birth_calendar_type === 'lunar') return false;
  const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : null);
  const same = (a, b) => a !== null && b !== null && a === b;
  if (!same(num(inputJson.year), num(profile.birth_year))) return false;
  if (!same(num(inputJson.month), num(profile.birth_month))) return false;
  if (!same(num(inputJson.day), num(profile.birth_day))) return false;
  if (num(inputJson.hour) !== num(profile.birth_hour)) return false;
  const gender = typeof inputJson.gender === 'string' ? inputJson.gender : null;
  return Boolean(gender) && gender === profile.gender;
}

/** profile.display_name → 소셜 메타데이터(name/full_name/nickname/user_name) 순으로 이름 해석. */
async function resolveUserName(supabase, userId, cache, profileCache) {
  if (cache.has(userId)) return cache.get(userId);
  let resolved = '';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, birth_year, birth_month, birth_day, birth_hour, gender, birth_calendar_type')
      .eq('user_id', userId)
      .maybeSingle();
    profileCache.set(userId, profile ?? null);
    const displayName = (profile?.display_name ?? '').trim();
    if (displayName) resolved = displayName;
  } catch {
    // 비차단 — 소셜 메타로 진행.
  }
  if (!resolved) {
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      const meta = data?.user?.user_metadata ?? {};
      for (const key of AUTH_NAME_KEYS) {
        const value = meta[key];
        if (typeof value === 'string' && value.trim()) {
          resolved = value.trim();
          break;
        }
      }
    } catch {
      // 비차단 — 이름 없으면 '달빛이' fallback 유지.
    }
  }
  cache.set(userId, resolved);
  return resolved;
}

async function main() {
  const supabase = createSupabaseServiceClient();
  const nameCache = new Map();
  const profileCache = new Map();
  let scanned = 0;
  let patched = 0;
  let skipped = 0;
  let foreign = 0;
  let offset = 0;

  console.log(`\n[backfill] ${APPLY ? '*** APPLY (실제 update) ***' : 'dry-run (미적용)'} — today_fortune_result_snapshots\n`);

  for (;;) {
    const { data: rows, error } = await supabase
      .from('today_fortune_result_snapshots')
      .select('id, user_id, free_result_json, input_json')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (error) throw new Error(`스냅샷 조회 실패: ${error.message}`);
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const freeResult = row.free_result_json ?? {};
      const current = typeof freeResult.userName === 'string' ? freeResult.userName : null;

      // 이미 실명이면 이름 해석 없이 빠르게 스킵.
      if (current && current.trim() && current.trim() !== MOONLIGHT_FALLBACK_DISPLAY_NAME) {
        skipped += 1;
        continue;
      }
      if (!row.user_id) {
        skipped += 1;
        continue;
      }

      const resolved = await resolveUserName(supabase, row.user_id, nameCache, profileCache);
      // 계정 주인 본인의 사주로 확인된 행만 각인한다(가족 스냅샷 오염 방지).
      if (!isOwnersOwnSaju(row.input_json, profileCache.get(row.user_id))) {
        foreign += 1;
        skipped += 1;
        continue;
      }
      const nextName = resolveBackfillUserName(current, resolved);
      if (!nextName) {
        skipped += 1;
        continue;
      }

      console.log(`${APPLY ? '[적용]' : '[dry] '} ${row.id}  userName: ${current ?? 'null'} → ${nextName}`);

      if (APPLY) {
        const { error: updateError } = await supabase
          .from('today_fortune_result_snapshots')
          .update({ free_result_json: { ...freeResult, userName: nextName } })
          .eq('id', row.id);
        if (updateError) {
          console.error(`  ✗ update 실패 ${row.id}: ${updateError.message}`);
          continue;
        }
      }
      patched += 1;
    }

    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  console.log(
    `\n[backfill] 완료 — 스캔 ${scanned} · 교정 ${patched} · 스킵 ${skipped}(본인 사주로 확인 안 됨 ${foreign} — 가족 사주이거나 음력 프로필) ${APPLY ? '(적용됨)' : '(dry-run: 미적용)'}`
  );
  if (!APPLY && patched > 0) {
    console.log('적용하려면: node scripts/backfill-snapshot-display-name.mjs --apply\n');
  }
}

main().catch((error) => {
  console.error('[backfill] 실패:', error);
  process.exit(1);
});
