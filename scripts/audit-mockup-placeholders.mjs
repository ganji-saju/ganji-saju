#!/usr/bin/env node
/**
 * Mockup placeholder audit — redesign 컴포넌트에서 mockup placeholder 가
 * dynamic binding 없이 hardcoded 로 남은 회귀를 자동 검출.
 *
 * 사용자 보고 (2026-05-17, PR #194): /credits 의 ink-dark 잔액 카드가
 *   `✦ —` + "로그인 후 잔액과 충전 내역이 표시됩니다" 를 모든 사용자에게
 *   동일하게 노출. 2026-05-13 redesign 시 mockup placeholder 가 hardcoded
 *   그대로 남고 isLoggedIn / credits state 분기 자체가 없었음.
 *
 * 사용법:
 *   node scripts/audit-mockup-placeholders.mjs                # 보고만
 *   node scripts/audit-mockup-placeholders.mjs --strict        # 의심 1건이라도 있으면 exit 1 (CI)
 *
 * 검출 범위: src/ 의 모든 *.tsx, *.ts 파일
 *
 * 검출 룰 (JSX text 노드 한정 — string literal 또는 ternary 안의 mockup 은 정상):
 *   - Rule 1: `>✦ —<` / `>✦ -<` — 코인 prefix + dash 단독 (PR #194 의 회귀 패턴)
 *   - Rule 2: `>✦ …<` / `>✦ ...<` — 코인 prefix + ellipsis 단독
 *   - Rule 3: `>로그인 후 ...<` — 분기 없는 "로그인 후" 시작 hardcoded 안내
 *
 * 의도된 leading-dash typography (예: `<strong>label</strong> — 설명`, 후기 "— 닉네임")
 * 는 검출 안 함 — false positive 가 너무 많음. 향후 회귀 발견 시 정교한 룰 추가.
 *
 * Inline ignore — 의도된 mockup 표시 (예: 비로그인 분기 fallback):
 *   - 직전 라인에 `// audit-mockup: intentional` 코멘트
 *   - 또는 같은 라인 끝에 `{/* audit-mockup: intentional *\/}`
 *
 * 한계:
 *   - JSX 구조를 정규식으로 파싱 — 복잡한 nested expression 은 false positive 가능
 *   - dash/ellipsis 가 의미상 정상인 경우 (구분자 등) 도 검출. inline ignore 로 mute.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const strict = process.argv.includes('--strict');

// scan: 모든 src/**/*.tsx, *.ts (테스트 / spec 제외)
function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
      collectFiles(full, results);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      if (/\.(test|spec)\.(tsx?|jsx?)$/.test(entry.name)) continue;
      results.push(full);
    }
  }
  return results;
}

// JSX text node 안 mockup placeholder 패턴.
// `>` 와 `<` 사이의 텍스트만 매치 — string literal ('✦ —') 이나 ternary 안 string 은 skip.
const RULES = [
  {
    id: 'coin-dash',
    label: '코인 prefix + dash 단독 (✦ —)',
    // > [whitespace] ✦ [whitespace] (em-dash / en-dash / hyphen) [whitespace] <
    re: />\s*✦\s*[—–\-]\s*</g,
  },
  {
    id: 'coin-ellipsis',
    label: '코인 prefix + ellipsis 단독 (✦ … / ✦ ...)',
    re: />\s*✦\s*(?:…|\.{3,})\s*</g,
  },
  {
    id: 'login-required-hardcoded',
    label: '"로그인 후" 시작 hardcoded 안내 (분기 없음)',
    // > [whitespace] 로그인 후 [...텍스트 (no nested JSX expression)] <
    re: />\s*로그인 후 [^<{}]*</g,
  },
];

const INLINE_IGNORE_MARKER = 'audit-mockup: intentional';

function shouldIgnoreLine(lines, lineIndex) {
  // 같은 라인에 marker
  if (lines[lineIndex]?.includes(INLINE_IGNORE_MARKER)) return true;
  // 직전 라인에 marker (코멘트 라인)
  if (lineIndex > 0 && lines[lineIndex - 1]?.includes(INLINE_IGNORE_MARKER)) return true;
  return false;
}

function auditFile(file, content) {
  const findings = [];
  const lines = content.split('\n');

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const match of content.matchAll(rule.re)) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      const lineIndex = lineNumber - 1;
      if (shouldIgnoreLine(lines, lineIndex)) continue;
      const snippet = match[0].trim().replace(/\s+/g, ' ');
      findings.push({ rule: rule.id, label: rule.label, lineNumber, snippet });
    }
  }

  return findings;
}

const files = collectFiles(sourceRoot);
const findingsByFile = new Map();
let totalFindings = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const findings = auditFile(file, content);
  if (findings.length > 0) {
    findingsByFile.set(file, findings);
    totalFindings += findings.length;
  }
}

// 출력
console.log('');
console.log('═'.repeat(72));
console.log('  Mockup Placeholder Audit');
console.log('═'.repeat(72));
console.log(`  스캔 파일: ${files.length}`);
console.log(`  의심 패턴: ${totalFindings}`);
console.log('');

if (totalFindings > 0) {
  console.log('  ⚠️ Mockup placeholder 의심 (binding 누락 가능):');
  console.log('');
  for (const [file, findings] of findingsByFile) {
    const rel = path.relative(projectRoot, file);
    for (const { rule, label, lineNumber, snippet } of findings) {
      console.log(`    ${rel}:${lineNumber}  [${rule}]  ${snippet}`);
      console.log(`      → ${label}`);
    }
  }
  console.log('');
  console.log('  해결:');
  console.log('    1) 분기 추가 (예: {isLoggedIn === false ? "✦ —" : `✦ ${credits}`})');
  console.log(`    2) 의도된 mockup 이면 inline marker — 같은 라인 또는 직전 라인에:`);
  console.log(`         // ${INLINE_IGNORE_MARKER}`);
  console.log(`         또는 {/* ${INLINE_IGNORE_MARKER} */}`);
  console.log('');
  if (strict) {
    console.log('  --strict 모드: 의심 1건 이상이므로 exit 1.');
    process.exit(1);
  }
} else {
  console.log('  ✅ Mockup placeholder 의심 없음 — 모든 JSX text 노드에 dynamic binding 또는 의도된 mockup marker.');
  console.log('');
}
