#!/usr/bin/env node
/**
 * 2026-06-22 — Supabase 마이그레이션 번호 중복 가드.
 *
 * 배경 (PR #448): `049` 번호를 두 PR(#401 tarot / #402 admin)이 충돌 사용 →
 * supabase 는 버전 문자열(`049`)을 키로 적용 여부를 판단하므로, 먼저 적용된
 * 049(admin)가 기록되면 같은 049(tarot)는 "이미 적용"으로 **영구 skip** →
 * tarot_result_snapshots 테이블이 원격에 미생성. 코드가 에러를 삼켜
 * (console.warn→null/[]) 타로 보관함이 **에러 없이 조용히 데드**였음.
 *
 * 이 가드는 그 무성(無聲) 회귀를 PR 단계에서 차단한다.
 *
 * 검출 위반:
 *   1. DUPLICATE  — 동일 버전 문자열을 가진 파일 2+ (supabase 가 키로 쓰는 값.
 *                   #401/#402 의 정확한 버그. 두 번째 파일이 영구 skip 됨).
 *   2. AMBIGUOUS  — 숫자값은 같으나 문자열이 다른 zero-pad 충돌 (예: 049 vs 0049).
 *                   supabase 는 둘 다 적용하지만 정렬/의도가 깨짐(footgun).
 *   3. MALFORMED  — `<숫자>_` 로 시작하지 않는 .sql (버전 파싱 불가).
 *
 * 의도적으로 자릿수(3 vs 4)는 강제하지 않는다 — 기존 적용 파일이
 * 3자리(001~053)와 4자리(0060/0061)를 혼용하므로 자릿수 규칙은 깨뜨림.
 * 가드의 책임은 "고유성"이지 "포맷 통일"이 아니다.
 *
 * 사용:
 *   node scripts/audit-migration-numbers.mjs            # 리포트만 (exit 0)
 *   node scripts/audit-migration-numbers.mjs --strict   # 위반 시 exit 1 (CI)
 *   node scripts/audit-migration-numbers.mjs --dir <경로> # 디렉토리 지정(테스트용)
 *
 * src/ import 없이 standalone. Node 20+ 에서 실행.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = path.join(projectRoot, 'supabase', 'migrations');

function parseArgs(argv) {
  const args = { strict: false, dir: DEFAULT_DIR };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--strict') {
      args.strict = true;
    } else if (argv[i] === '--dir' && argv[i + 1]) {
      args.dir = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

/** 마이그레이션 디렉토리 스캔 → [{ file, version, numeric }] (.sql 만). */
function scanMigrations(dir) {
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();

  return files.map((file) => {
    const match = /^(\d+)_/.exec(file);
    return {
      file,
      version: match ? match[1] : null, // supabase 가 키로 쓰는 버전 문자열
      numeric: match ? Number.parseInt(match[1], 10) : null,
    };
  });
}

/** 위반 검출 — 순수 함수(테스트/재사용 가능). */
function findViolations(entries) {
  const violations = [];

  // MALFORMED: 버전 파싱 불가
  for (const e of entries) {
    if (e.version === null) {
      violations.push({ type: 'MALFORMED', files: [e.file], detail: '<숫자>_ 로 시작해야 함' });
    }
  }

  const parsed = entries.filter((e) => e.version !== null);

  // 1. DUPLICATE: 동일 버전 문자열 2+
  const byVersion = new Map();
  for (const e of parsed) {
    if (!byVersion.has(e.version)) byVersion.set(e.version, []);
    byVersion.get(e.version).push(e.file);
  }
  for (const [version, files] of byVersion) {
    if (files.length > 1) {
      violations.push({
        type: 'DUPLICATE',
        files: files.sort(),
        detail: `버전 "${version}" 를 ${files.length}개 파일이 공유 → 첫 파일만 적용, 나머지 영구 skip`,
      });
    }
  }

  // 2. AMBIGUOUS: 숫자값 동일하나 버전 문자열이 다름(zero-pad 모호성)
  const byNumeric = new Map();
  for (const e of parsed) {
    if (!byNumeric.has(e.numeric)) byNumeric.set(e.numeric, new Set());
    byNumeric.get(e.numeric).add(e.version);
  }
  for (const [numeric, versionSet] of byNumeric) {
    if (versionSet.size > 1) {
      const variants = [...versionSet].sort();
      const files = parsed
        .filter((e) => e.numeric === numeric)
        .map((e) => e.file)
        .sort();
      violations.push({
        type: 'AMBIGUOUS',
        files,
        detail: `숫자값 ${numeric} 를 다른 표기로 사용: ${variants.join(' vs ')} (zero-pad 충돌 — 정렬/의도 붕괴)`,
      });
    }
  }

  return violations;
}

function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.dir)) {
    console.error(`마이그레이션 디렉토리 없음: ${args.dir}`);
    process.exit(1);
  }

  const entries = scanMigrations(args.dir);
  const violations = findViolations(entries);

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Supabase 마이그레이션 번호 중복 가드 (PR #448 회귀 차단)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  스캔: ${path.relative(projectRoot, args.dir) || args.dir} — ${entries.length}개 .sql`);

  if (violations.length === 0) {
    console.log(`\n  ✅ 위반 0건 — 모든 버전 문자열 고유, zero-pad 충돌 없음`);
    console.log('═══════════════════════════════════════════════════════');
    return;
  }

  console.log(`\n  ❌ 위반 ${violations.length}건:`);
  for (const v of violations) {
    console.log(`\n  [${v.type}] ${v.detail}`);
    for (const f of v.files) console.log(`     - ${f}`);
  }
  console.log('\n  ▸ 해결: 충돌 파일 중 하나를 다음 가용 번호로 리네임(git mv) 후');
  console.log('         supabase db push 로 적용. (예: PR #448)');
  console.log('═══════════════════════════════════════════════════════');

  if (args.strict) {
    process.exit(1);
  }
}

main();
