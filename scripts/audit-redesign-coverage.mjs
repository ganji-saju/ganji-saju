#!/usr/bin/env node
/**
 * Redesign coverage audit — 구스타일 페이지가 신스타일로 안 옮겨진 케이스 자동 검출.
 *
 * 사용자 보고 (2026-05-17): /saju/[slug]/today-detail 가 구스타일 디자인.
 * BOARD_MANIFEST 는 IMPLEMENTED 로 표시하나 실제로는 `gangi-today-detail-*` 같은
 * 구스타일 named CSS class 를 그대로 사용. 사용자가 first detector 가 되는
 * 패턴 차단.
 *
 * 사용법:
 *   node scripts/audit-redesign-coverage.mjs                # 보고만
 *   node scripts/audit-redesign-coverage.mjs --strict        # 의심 1건이라도 있으면 exit 1
 *
 * 검출 룰:
 *   - Rule 1 (CRITICAL): 구스타일 named CSS class 사용 (예: gangi-today-detail-*,
 *     gangi-paid-detail-*, gangi-detail-kicker). 신스타일 페이지는 inline +
 *     Tailwind + design token 패턴 (var(--app-*), rounded-[18px] 등).
 *   - Rule 2 (WARNING): page.tsx / layout.tsx 에 `// Redesign 2026-05-` 주석 없음.
 *     redesign 마커가 없다 = 신스타일로 옮겨졌다는 흔적 없음 (단, 작은 stub 페이지
 *     또는 admin 페이지는 의도된 케이스 — inline marker 로 mute).
 *
 * Inline ignore — 의도된 케이스 (admin / stub / 신규 redesign-X 페이지) mute:
 *   - 같은 라인 또는 직전 라인에 `// audit-redesign: skip`
 *
 * 검출 범위: src/app/**\/page.tsx, src/app/**\/layout.tsx (Next.js entry points).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src/app');
const strict = process.argv.includes('--strict');

const INLINE_IGNORE_MARKER = 'audit-redesign: skip';

// 운영용 / API / 디자인 무관 디렉토리는 audit 제외.
const EXCLUDED_DIRS = new Set(['admin', 'api', 'verification']);

// 카테고리별 skip path patterns — redesign 영향 없는 entry (auth / legal / utility / onboarding).
// 명시적 카테고리화로 audit baseline 의 noise 제거.
const SKIP_PATTERNS = [
  // auth flow — 별도 redesign track (form 단순)
  /\/auth\/page\.tsx$/,
  /\/login\/page\.tsx$/,
  /\/signup\/page\.tsx$/,
  /\/forgot-password\/page\.tsx$/,
  /\/reset-password\/page\.tsx$/,
  // legal text pages — text-only, redesign 무관
  /\/privacy\/page\.tsx$/,
  /\/terms\/page\.tsx$/,
  // utility / redirect / lock — UI 거의 없음
  /\/safe-redirect\/page\.tsx$/,
  /\/lock-screen\/page\.tsx$/,
  /\/about-engine\/page\.tsx$/,
  // info / help / FAQ
  /\/help\/page\.tsx$/,
  /\/guide\/page\.tsx$/,
  /\/support\/faq\/page\.tsx$/,
  /\/support\/contact\/page\.tsx$/,
  // onboarding step pages (linear flow — 별도 redesign track)
  /\/onboarding\/page\.tsx$/,
  /\/saju\/new\/consent\/page\.tsx$/,
  /\/saju\/new\/empathy\/page\.tsx$/,
  /\/saju\/new\/nickname\/page\.tsx$/,
  // notification utility (mini widget — embedded view)
  /\/notifications\/widget\/page\.tsx$/,
];

function isSkippedPath(relPath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(relPath));
}

// Content-based wrapper detection — UI 거의 없는 thin wrapper / redirect-only 자동 skip.
// 사주 메인 / today-fortune / 홈 등의 entry page 가 실제 UI 는 별도 client component 에
// 위임하는 경우 page.tsx 자체는 redesign 무관 — false positive.
function isWrapperContent(content) {
  // Pattern 1: redirect-only — `redirect()` from next/navigation 가 main body.
  if (
    /from\s+['"]next\/navigation['"][^;]*\bredirect\b/.test(content) &&
    /\bredirect\(/.test(content)
  ) {
    return true;
  }
  // Pattern 2: thin wrapper — 짧은 file + JSX component 1-2개만 (page.tsx 가 client 컴포넌트
  // 1개를 AppShell 안에 import 하는 패턴). 50줄 미만 + 사용자가 보는 큰 UI 구조 없음.
  const lineCount = content.split('\n').filter((l) => l.trim().length > 0).length;
  if (lineCount <= 40) {
    const jsxComponents = content.match(/<[A-Z][a-zA-Z][a-zA-Z0-9]*\b/g) || [];
    // AppShell / AppPage 같은 wrapper 제외하고 사용자 UI 의미하는 component 가 ≤ 2개.
    const semanticComponents = jsxComponents.filter(
      (m) => !/^<(AppShell|AppPage|SiteHeader|Suspense|GangiPageHeader)\b/.test(m),
    );
    if (semanticComponents.length <= 2) return true;
  }
  return false;
}

// Next.js entry 파일만 (page.tsx). layout.tsx 는 대부분 wrapper 라 제외.
function collectEntryPages(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectEntryPages(full, results);
    } else if (entry.name === 'page.tsx') {
      const relPath = path.relative(projectRoot, full);
      if (isSkippedPath(relPath)) continue;
      results.push(full);
    }
  }
  return results;
}

// 구스타일 named CSS class 패턴.
// `gangi-today-detail-*`, `gangi-paid-detail-*` 등 — 신스타일은 inline + utility.
// `gangi-page-header`, `gangi-loading-overlay` 같은 공통 wrapper 는 의도된 사용 — 제외.
//
// 마지막 char 가 word char (\w) 강제 — 주석 안의 `gangi-today-detail-*` 같은
// reference (trailing `-` 또는 `*`) 는 false positive 차단.
const LEGACY_CLASS_PATTERN =
  /\bgangi-(?:today-detail|paid-detail|detail-chip|result-flow)-[a-z][a-zA-Z0-9_-]*[a-zA-Z0-9_]\b|\bgangi-detail-kicker\b/g;

const REDESIGN_MARKER = /\/\/\s*Redesign\s+2026-0[1-9]/;

function shouldIgnoreFile(content) {
  // 파일 상단 (첫 10줄) 안에 `audit-redesign: skip` marker 가 있으면 전체 skip.
  const head = content.split('\n').slice(0, 10).join('\n');
  return head.includes(INLINE_IGNORE_MARKER);
}

function shouldIgnoreLine(lines, lineIndex) {
  if (lines[lineIndex]?.includes(INLINE_IGNORE_MARKER)) return true;
  if (lineIndex > 0 && lines[lineIndex - 1]?.includes(INLINE_IGNORE_MARKER)) return true;
  return false;
}

function auditFile(file, content) {
  const findings = [];
  const relPath = path.relative(projectRoot, file);

  if (shouldIgnoreFile(content)) return findings;
  if (isWrapperContent(content)) return findings;

  // Rule 1 (CRITICAL): 구스타일 named CSS class.
  const lines = content.split('\n');
  LEGACY_CLASS_PATTERN.lastIndex = 0;
  const seenClasses = new Set();
  for (const match of content.matchAll(LEGACY_CLASS_PATTERN)) {
    const lineNumber = content.slice(0, match.index).split('\n').length;
    const lineIndex = lineNumber - 1;
    if (shouldIgnoreLine(lines, lineIndex)) continue;
    const className = match[0];
    const dedupeKey = `${className}:${lineNumber}`;
    if (seenClasses.has(dedupeKey)) continue;
    seenClasses.add(dedupeKey);
    findings.push({
      file: relPath,
      severity: 'CRITICAL',
      rule: 'legacy-css-class',
      lineNumber,
      detail: className,
    });
  }

  // Rule 2 (WARNING): page.tsx / layout.tsx 에 redesign 마커 없음.
  // (Rule 1 이 CRITICAL 인 경우 중복 보고 안 함 — 같은 페이지)
  const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
  if (!hasCritical && !REDESIGN_MARKER.test(content)) {
    findings.push({
      file: relPath,
      severity: 'WARNING',
      rule: 'missing-redesign-marker',
      lineNumber: 1,
      detail: 'Redesign 2026-05-* 주석 없음 — 신스타일 토큰화 안 됐을 가능성',
    });
  }

  return findings;
}

const files = collectEntryPages(sourceRoot);
const allFindings = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  allFindings.push(...auditFile(file, content));
}

const critical = allFindings.filter((f) => f.severity === 'CRITICAL');
const warning = allFindings.filter((f) => f.severity === 'WARNING');

console.log('');
console.log('═'.repeat(72));
console.log('  Redesign Coverage Audit');
console.log('═'.repeat(72));
console.log(`  스캔 page.tsx / layout.tsx: ${files.length}`);
console.log(`  CRITICAL (구스타일 CSS class): ${critical.length}`);
console.log(`  WARNING (redesign 마커 없음): ${warning.length}`);
console.log('');

if (critical.length > 0) {
  console.log('  🔴 CRITICAL — 구스타일 named CSS class 사용:');
  console.log('');
  // 파일별 그룹
  const byFile = new Map();
  for (const f of critical) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  for (const [file, items] of byFile) {
    console.log(`    ${file}`);
    for (const { lineNumber, detail } of items) {
      console.log(`      :${lineNumber}  →  ${detail}`);
    }
    console.log('');
  }
}

if (warning.length > 0) {
  console.log('  🟡 WARNING — redesign 마커 없음 (신스타일 토큰화 검토 권장):');
  console.log('');
  for (const { file, detail } of warning) {
    console.log(`    ${file}`);
    console.log(`      → ${detail}`);
  }
  console.log('');
}

if (critical.length === 0 && warning.length === 0) {
  console.log('  ✅ 모든 entry page 가 신스타일 토큰화 + redesign 마커 보유.');
  console.log('');
}

console.log('  해결:');
console.log('    1) CRITICAL: 구스타일 CSS class 를 inline + Tailwind + design token 으로 교체.');
console.log('       (참고: src/app/credits/success/page.tsx 의 CenteredCard 패턴)');
console.log('    2) WARNING: 신스타일 옮긴 후 파일 상단에 `// Redesign 2026-MM-DD ...` 주석 추가.');
console.log(`    3) 의도된 케이스 (admin / stub) 는 파일 상단 또는 해당 라인에:`);
console.log(`         // ${INLINE_IGNORE_MARKER}`);
console.log('');

if (strict && critical.length > 0) {
  console.log('  --strict 모드: CRITICAL 1건 이상이므로 exit 1.');
  process.exit(1);
}
