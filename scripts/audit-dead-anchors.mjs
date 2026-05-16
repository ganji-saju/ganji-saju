#!/usr/bin/env node
/**
 * Dead anchor link audit — href="#xxx" 패턴이 페이지 어디에도 id="xxx" 정의가
 * 없는 경우 (작동 안 하는 anchor) 를 자동 검출.
 *
 * 사용자 보고 (2026-05-16, PR #182): 사주 상세 페이지의 hero 카드 3 버튼
 * (#yearly-chapter-1/2/3) 가 페이지 어디에도 정의되지 않아 클릭 무반응.
 * 이런 류 회귀를 사전 검출하기 위한 자동화.
 *
 * 사용법:
 *   node scripts/audit-dead-anchors.mjs                # 보고만
 *   node scripts/audit-dead-anchors.mjs --strict        # dead anchor 1건이라도 있으면 exit 1 (CI)
 *
 * 검출 범위: src/ 전체 *.tsx, *.ts, *.html 파일
 *
 * 한계:
 *   - DOM 에서 동적으로 만들어지는 id 는 못 잡음 (false positive 가능)
 *   - 외부 페이지로의 anchor 는 무시 (예: /foo#bar)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');
const strict = process.argv.includes('--strict');

// scan: 모든 src/**/*.tsx, *.ts, *.html
function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
      collectFiles(full, results);
    } else if (/\.(tsx|ts|jsx|js|html)$/.test(entry.name)) {
      // 테스트 파일은 제외 (mock anchor 가 의도된 경우 많음)
      if (/\.(test|spec)\.(tsx?|jsx?)$/.test(entry.name)) continue;
      results.push(full);
    }
  }
  return results;
}

// extract: href 문맥 (JSX prop 또는 객체 속성) 안 "#xxx" 패턴.
//   JSX: href="#xxx", href={'#xxx'}, href={`#xxx`}
//   data: { href: '#xxx', ... } — 사주 readingSteps 패턴
// 문맥 한정으로 hash 비교 literal (if hash === '#xxx') 등 false positive 차단.
// 첫 글자 알파벳 + hex color 추가 필터 (CSS hex 회피).
const ANCHOR_HREF_RE = /(?:href\s*[=:]\s*\{?\s*)["'`]#([a-zA-Z][a-zA-Z0-9_-]*)["'`]/g;
// extract: id="xxx" / id={'xxx'} / id={`xxx`}
const ID_DEF_RE = /\bid\s*=\s*(?:["']([a-zA-Z0-9_-]+)["']|\{["'`]([a-zA-Z0-9_-]+)["'`]\})/g;
// extract: <section id="xxx" / <div id="xxx" — DOM id only (props id 와 구분 어려움)

// CSS hex color (#fff, #fff7e6) — false positive 제외용.
const HEX_COLOR_RE = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

function extractAnchors(content) {
  const anchors = [];
  for (const match of content.matchAll(ANCHOR_HREF_RE)) {
    const target = match[1] || match[2];
    if (!target) continue;
    // hex color 는 anchor 아님 (예: #fff, #fde047).
    if (HEX_COLOR_RE.test(target)) continue;
    const lineNumber = content.slice(0, match.index).split('\n').length;
    anchors.push({ target, lineNumber });
  }
  return anchors;
}

function extractIds(content) {
  const ids = new Set();
  for (const match of content.matchAll(ID_DEF_RE)) {
    const id = match[1] || match[2];
    ids.add(id);
  }
  return ids;
}

const files = collectFiles(sourceRoot);

const allDefinedIds = new Set();
const anchorsByFile = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const id of extractIds(content)) allDefinedIds.add(id);
  const anchors = extractAnchors(content);
  if (anchors.length > 0) anchorsByFile.set(file, anchors);
}

// 검출: 정의 안 된 anchor target
const deadAnchors = [];
for (const [file, anchors] of anchorsByFile) {
  for (const { target, lineNumber } of anchors) {
    if (!allDefinedIds.has(target)) {
      deadAnchors.push({ file: path.relative(projectRoot, file), target, lineNumber });
    }
  }
}

// 출력
const totalAnchors = Array.from(anchorsByFile.values()).reduce((sum, a) => sum + a.length, 0);
console.log('');
console.log('═'.repeat(72));
console.log('  Dead Anchor Link Audit');
console.log('═'.repeat(72));
console.log(`  스캔 파일: ${files.length}`);
console.log(`  검출된 anchor href: ${totalAnchors}`);
console.log(`  정의된 id (전체 src): ${allDefinedIds.size}`);
console.log(`  Dead anchor: ${deadAnchors.length}`);
console.log('');

if (deadAnchors.length > 0) {
  console.log('  ⚠️ Dead anchor 목록 — 해당 id 가 src 어디에도 없음:');
  console.log('');
  for (const { file, target, lineNumber } of deadAnchors) {
    console.log(`    ${file}:${lineNumber}  →  href="#${target}"`);
  }
  console.log('');
  console.log('  해결: 1) href 를 실제 존재하는 anchor 로 변경');
  console.log('        2) 또는 해당 id 를 가진 요소 추가');
  console.log('');
  if (strict) {
    console.log('  --strict 모드: dead anchor 1건 이상이므로 exit 1.');
    process.exit(1);
  }
} else {
  console.log('  ✅ Dead anchor 없음 — 모든 #anchor href 가 src 안에 정의된 id 와 매칭.');
  console.log('');
}
