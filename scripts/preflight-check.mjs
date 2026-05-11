#!/usr/bin/env node
/**
 * preflight-check.mjs
 * 코드 개선 작업 전 자동 사전 점검 스크립트
 * 실행: node scripts/preflight-check.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let errorCount = 0;
let warnCount = 0;

function pass(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg) { console.warn(`  \x1b[33m⚠\x1b[0m ${msg}`); warnCount++; }
function fail(msg) { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); errorCount++; }
function section(title) { console.log(`\n\x1b[36m[ ${title} ]\x1b[0m`); }
function indent(msg) { console.log(`    ${msg}`); }

function grep(pattern, dir, opts = '') {
  try {
    return execSync(
      `grep -rn ${opts} "${pattern}" "${dir}" --include="*.tsx" --include="*.ts" 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
  } catch {
    return '';
  }
}

function exec(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim() };
  } catch (e) {
    return { ok: false, output: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

// ─────────────────────────────────────────
// 1. Git 상태
// ─────────────────────────────────────────
section('1. Git 상태 확인');
const gitStatus = exec('git status --porcelain');
if (gitStatus.ok && gitStatus.output) {
  const lines = gitStatus.output.split('\n').filter(Boolean);
  warn(`uncommitted 변경사항 ${lines.length}개 있음 — 먼저 commit 또는 stash 후 진행 권장`);
  lines.slice(0, 8).forEach(l => indent(l));
  if (lines.length > 8) indent(`... 외 ${lines.length - 8}개`);
} else {
  pass('워킹 트리 클린');
}

const tagResult = exec('git tag --list "refactor-start-*"');
if (tagResult.ok && tagResult.output) {
  pass(`안전 태그 존재: ${tagResult.output.split('\n')[0]}`);
} else {
  warn('안전 태그 없음 — 시작 전 실행: git tag refactor-start-$(date +%Y%m%d)');
}

// ─────────────────────────────────────────
// 2. middleware.ts / proxy.ts 상태
// ─────────────────────────────────────────
section('2. Middleware 상태 확인');
const mwExists = existsSync(resolve(ROOT, 'src/middleware.ts'));
const proxyExists = existsSync(resolve(ROOT, 'src/proxy.ts'));

if (!mwExists && proxyExists) {
  warn('src/proxy.ts는 있지만 src/middleware.ts가 없음');
  indent('→ proxy.ts 안의 auth redirect 로직이 실제로 작동하지 않는 상태');
  indent('→ 이 파일을 삭제하거나 수정하면 안 됨 (잠재적 버그 별도 수정 필요)');
} else if (mwExists) {
  pass('src/middleware.ts 존재 — 정상');
} else {
  pass('proxy.ts 없음, middleware.ts 없음 — 미들웨어 미사용 프로젝트');
}

// ─────────────────────────────────────────
// 3. 삭제 예정 파일의 import 재확인
// ─────────────────────────────────────────
section('3. 삭제 예정 파일 import 재확인');
const deleteCandidates = [
  { file: 'src/components/site-header.tsx',  pattern: 'components/site-header' },
  { file: 'src/lib/site-navigation.ts',      pattern: 'lib/site-navigation' },
  { file: 'src/lib/home-content.ts',         pattern: 'lib/home-content' },
];

// 삭제 예정 파일 경로 목록 (상호 참조 필터링에 사용)
const deletePaths = deleteCandidates.map(c => c.file);

for (const { file, pattern } of deleteCandidates) {
  if (!existsSync(resolve(ROOT, file))) {
    pass(`${file}: 이미 삭제됨`);
    continue;
  }
  const hits = grep(pattern, resolve(ROOT, 'src'))
    .split('\n')
    .filter(Boolean)
    .filter(l => !l.includes(file))
    // 같이 삭제할 파일끼리의 상호 참조는 무시
    .filter(l => !deletePaths.some(p => l.includes(p)));

  if (hits.length > 0) {
    fail(`${file}: ${hits.length}곳에서 여전히 참조됨 — 삭제 금지`);
    hits.slice(0, 3).forEach(l => indent(l));
  } else {
    pass(`${file}: 참조 없음 — 삭제 안전`);
  }
}

// ─────────────────────────────────────────
// 4. features/home 섹션 page.tsx 참조 확인
// ─────────────────────────────────────────
section('4. features/home 섹션 page.tsx 참조 확인');
const homeSections = [
  'hero-section', 'service-entry-section', 'membership-section',
  'seo-entry-section', 'tarot-section', 'service-intake-preview-section',
  'compatibility-section',
];

for (const s of homeSections) {
  const hits = grep(`features/home/${s}`, resolve(ROOT, 'src/app'))
    .split('\n').filter(Boolean);

  if (hits.length > 0) {
    fail(`features/home/${s}: app/ 에서 ${hits.length}곳 참조됨 — 삭제 금지`);
    hits.forEach(l => indent(l));
  } else {
    pass(`features/home/${s}: app/ 미참조`);
  }
}

// content.ts의 HOUR_OPTIONS 참조 확인 (유지 대상)
const hourOpts = grep('HOUR_OPTIONS', resolve(ROOT, 'src'), '--include="*.tsx" --include="*.ts"')
  .split('\n').filter(Boolean)
  .filter(l => !l.includes('content.ts'));
if (hourOpts.length > 0) {
  pass(`features/home/content.ts의 HOUR_OPTIONS: ${hourOpts.length}곳에서 사용 중 — content.ts 유지 필수`);
  hourOpts.forEach(l => indent(l));
}

// ─────────────────────────────────────────
// 5. readString 중복 정의 현황
// ─────────────────────────────────────────
section('5. 중복 함수 현황');
// "function readString(" 패턴 — readStringValue는 제외, api-utils.ts 자체도 제외
const rsHits = grep('function readString(', resolve(ROOT, 'src'), '--include="*.ts" --include="*.tsx"')
  .split('\n').filter(Boolean)
  .filter(l => !l.includes('.test.'))
  .filter(l => !l.includes('api-utils.ts'));  // 정의 파일 자체는 허용

if (rsHits.length > 1) {
  warn(`readString: ${rsHits.length}곳에 중복 정의 — STEP 1 대상`);
  rsHits.forEach(l => indent(l));
} else if (rsHits.length === 0) {
  pass('readString: 중복 없음 (이미 정리됨)');
} else {
  pass('readString: 1곳 — 정상');
}

const kcyHits = grep('function getCurrentKoreaYear', resolve(ROOT, 'src'))
  .split('\n').filter(Boolean)
  .filter(l => !l.includes('.test.'));

if (kcyHits.length > 1) {
  warn(`getCurrentKoreaYear: ${kcyHits.length}곳에 중복 정의 — STEP 1 대상`);
} else {
  pass(`getCurrentKoreaYear: ${kcyHits.length}곳 — 정상`);
}

// ─────────────────────────────────────────
// 6. @/lib/saju/report passthrough 참조 확인
// ─────────────────────────────────────────
section('6. import 경로 혼용 확인');
const libSajuReportHits = grep("from '@/lib/saju/report'", resolve(ROOT, 'src'))
  .split('\n').filter(Boolean)
  .filter(l => !l.includes('.test.') && !l.includes('lib/saju/report.ts'));

if (libSajuReportHits.length > 0) {
  warn(`@/lib/saju/report 경유 import: ${libSajuReportHits.length}곳 — STEP 4 대상`);
  libSajuReportHits.forEach(l => indent(l));
} else {
  pass('@/lib/saju/report 경유 import: 없음');
}

// ─────────────────────────────────────────
// 7. TypeScript 컴파일
// ─────────────────────────────────────────
section('7. TypeScript 컴파일 확인');
console.log('  (시간이 걸릴 수 있습니다...)');
const tscResult = exec('npx tsc --noEmit --pretty false --incremental false -p tsconfig.json 2>&1');
if (tscResult.ok) {
  pass('tsc 오류 없음');
} else {
  const tscLines = tscResult.output.split('\n').filter(Boolean);
  fail(`tsc 오류 ${tscLines.length}줄`);
  tscLines.slice(0, 15).forEach(l => indent(l));
  if (tscLines.length > 15) indent(`... 외 ${tscLines.length - 15}줄`);
}

// ─────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────
console.log('\n' + '='.repeat(55));
if (errorCount > 0) {
  console.error(`\x1b[31m사전 점검 실패 — 오류 ${errorCount}개, 경고 ${warnCount}개\x1b[0m`);
  console.error('위 오류를 해결한 후 개선 작업을 시작하세요.');
  process.exit(1);
} else if (warnCount > 0) {
  console.warn(`\x1b[33m사전 점검 경고 ${warnCount}개 — 내용 확인 후 진행하세요\x1b[0m`);
  process.exit(0);
} else {
  console.log('\x1b[32m모든 사전 점검 통과 ✓ — 개선 작업을 시작해도 안전합니다\x1b[0m');
  process.exit(0);
}
