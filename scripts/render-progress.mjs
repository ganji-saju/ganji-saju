#!/usr/bin/env node
// PROGRESS.md → PROGRESS.html 렌더 (하이브리드 워크플로우)
//   원본 로그는 Markdown(.md, git 친화·에이전트 친화)으로 유지하고,
//   "보기 좋은 리포트"가 필요할 때만 이 스크립트로 HTML 을 생성한다.
//   - 의존성: pandoc (brew install pandoc / 이미 설치돼 있으면 그대로)
//   - 사용:   node scripts/render-progress.mjs [--in PROGRESS.md] [--out PROGRESS.html]
//   - 결과:   목차(TOC) + 브랜드 톤 스타일이 적용된 self-contained HTML 1개.
//   생성물(PROGRESS.html)은 git 에 커밋하지 말 것(브라우저 확인용 산출물).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const inPath = arg('--in', 'PROGRESS.md');
const outPath = arg('--out', 'PROGRESS.html');

if (!existsSync(inPath)) {
  console.error(`✗ 입력 파일 없음: ${inPath}`);
  process.exit(1);
}

try {
  execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('✗ pandoc 이 필요합니다. 설치: brew install pandoc');
  process.exit(1);
}

// 제목: 첫 번째 "# " 헤딩 → 없으면 파일명
const firstH1 = readFileSync(inPath, 'utf8').split('\n').find((l) => /^#\s+/.test(l));
const title = firstH1 ? firstH1.replace(/^#\s+/, '').trim() : inPath;

// 브랜드 톤(간지사주 pink) 리포트 스타일. self-contained 를 위해 <style> 로 head 에 주입.
const css = `<style>
  :root { --ink:#16161a; --muted:#5b5d66; --line:#e7e7ec; --pink:#d81b72; --pink-soft:#fff0f7; --bg:#fff; }
  * { box-sizing: border-box; }
  body { max-width: 860px; margin: 0 auto; padding: 2.5rem 1.25rem 6rem;
    font-family: "Noto Sans KR","Apple SD Gothic Neo",system-ui,-apple-system,"Segoe UI",sans-serif;
    color: var(--ink); background: var(--bg); line-height: 1.75; font-size: 15.5px;
    -webkit-font-smoothing: antialiased; word-break: keep-all; }
  h1,h2,h3,h4 { line-height: 1.35; font-weight: 800; letter-spacing: -0.01em; }
  h1 { font-size: 1.9rem; margin: 0 0 1.2rem; padding-bottom: .6rem; border-bottom: 3px solid var(--pink); }
  h2 { font-size: 1.35rem; margin: 2.6rem 0 .9rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  h3 { font-size: 1.08rem; margin: 1.6rem 0 .6rem; color: var(--pink); }
  h4 { font-size: .98rem; margin: 1.1rem 0 .4rem; color: var(--muted); }
  a { color: var(--pink); text-decoration: none; }
  a:hover { text-decoration: underline; }
  p, li { color: var(--ink); }
  ul, ol { padding-left: 1.4rem; }
  li { margin: .25rem 0; }
  code { font-family: "SF Mono",ui-monospace,"JetBrains Mono",monospace; font-size: .86em;
    background: #f4f4f7; border: 1px solid var(--line); border-radius: 5px; padding: .1em .4em; }
  pre { background: #16161a; color: #f2f2f5; padding: 1rem 1.1rem; border-radius: 12px; overflow-x: auto; line-height: 1.55; }
  pre code { background: none; border: 0; color: inherit; padding: 0; font-size: .85em; }
  blockquote { margin: 1rem 0; padding: .6rem 1rem; border-left: 4px solid var(--pink);
    background: var(--pink-soft); border-radius: 0 8px 8px 0; color: #3a3b42; }
  blockquote p { margin: .3rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92em; }
  th, td { border: 1px solid var(--line); padding: .5rem .7rem; text-align: left; vertical-align: top; }
  th { background: #fafafb; font-weight: 700; }
  tr:nth-child(even) td { background: #fcfcfd; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 2.2rem 0; }
  /* pandoc --toc 목차 */
  nav#TOC { background: #fafafb; border: 1px solid var(--line); border-radius: 14px;
    padding: 1rem 1.25rem; margin: 0 0 2.2rem; font-size: .92em; }
  nav#TOC::before { content: "목차"; display: block; font-weight: 800; color: var(--ink); margin-bottom: .5rem; }
  nav#TOC ul { padding-left: 1.1rem; margin: .2rem 0; }
  nav#TOC > ul { padding-left: 0; list-style: none; }
  nav#TOC a { color: #3a3b42; }
  .meta { color: var(--muted); font-size: .85em; margin-top: -.6rem; margin-bottom: 1.6rem; }
</style>`;

const tmp = mkdtempSync(join(tmpdir(), 'progress-'));
const headerFile = join(tmp, 'header.html');
writeFileSync(headerFile, css, 'utf8');

try {
  execFileSync(
    'pandoc',
    [
      inPath,
      '-f', 'gfm',                 // GitHub-flavored markdown (테이블/체크박스 등)
      '-s',                        // standalone (full <html>)
      '--toc', '--toc-depth=2',    // 세션 단위 목차
      '--highlight-style=kate',
      '--metadata', `title=${title}`,
      '-H', headerFile,
      '-o', outPath,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );
  const bytes = readFileSync(outPath).length;
  console.log(`✓ ${inPath} → ${outPath} (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(`  열기: open ${outPath}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
