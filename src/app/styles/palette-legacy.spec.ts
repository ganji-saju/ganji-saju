// 2026-08-29 — 개편(2026-08-25) 전 팔레트가 되돌아오지 못하게 막는다.
//
//   사이트는 한지(#FBF7EE) + 인주(#B3372A) 톤인데, 개편 뒤에도 개편 전 색이 322곳 남아
//   있었다. 흔한 형태는 "버튼 몸통은 var(--app-pink)(인주)인데 **그림자만 옛 핫핑크**" —
//   토큰을 쓰는 것처럼 보여서 눈으로는 잘 안 잡힌다. 값으로 잡는다.
//
//   새 색을 쓰고 싶으면 tokens.css 에 토큰을 만들어 쓰고, 여기 목록에 넣지 마라.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** 개편 전 브랜드 값 → 지금 무엇을 써야 하는지. */
const RETIRED: Array<{ pattern: RegExp; was: string; use: string }> = [
  { pattern: /rgba?\(\s*255,\s*79,\s*154/i, was: '구 hot-pink', use: 'var(--app-pink) / rgba(179,55,42,α)' },
  { pattern: /rgba?\(\s*216,\s*27,\s*114/i, was: '구 magenta', use: 'var(--app-pink-strong) / rgba(142,42,32,α)' },
  { pattern: /rgba?\(\s*236,\s*72,\s*153/i, was: 'tailwind pink-500', use: 'var(--app-pink)' },
  { pattern: /rgba?\(\s*15,\s*23,\s*42/i, was: '슬레이트 먹', use: 'rgba(28,26,23,α) (브랜드 먹)' },
  { pattern: /#ec4899\b/i, was: 'tailwind pink-500', use: 'var(--app-pink)' },
  { pattern: /#ff7bb8\b/i, was: '구 pink-bright', use: '#c9553f' },
  { pattern: /#e6549a\b/i, was: '구 지표 핑크', use: 'var(--app-pink)' },
  { pattern: /#e05298\b/i, was: '구 오행 화(火) 핑크', use: '#B3372A (적) / var(--app-coral)' },
  { pattern: /#1a0a2e\b/i, was: '구 보라 잉크', use: '#1c1a17 (브랜드 먹)' },
  { pattern: /#2e1156\b/i, was: '구 보라 중간', use: '#2a2622' },
  { pattern: /#45178a\b/i, was: '구 보라 밝음', use: '#3f352b' },
];

const SKIP_DIRS = new Set(['node_modules', '.next']);
const SKIP_FILE = /\.(spec|test)\.(ts|tsx)$/;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.(css|ts|tsx)$/.test(entry.name) && !SKIP_FILE.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe('개편 전 팔레트 잔재', () => {
  const files = sourceFiles(path.join(process.cwd(), 'src'));

  it('스캔 대상 파일이 실제로 잡힌다(가드가 헛돌지 않게)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  for (const retired of RETIRED) {
    it(`${retired.was} 는 남아 있지 않다`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        text.split('\n').forEach((line, i) => {
          if (retired.pattern.test(line)) {
            hits.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
          }
        });
      }
      expect(hits, `${retired.was} 발견 → ${retired.use} 를 쓰세요\n  ${hits.slice(0, 8).join('\n  ')}`).toEqual([]);
    });
  }
});
