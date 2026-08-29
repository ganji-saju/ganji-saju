// 2026-08-30 회귀 가드 — "띠운세 보다가 로그인했는데 사주 페이지로 넘어간다"(사용자 제보).
//
//   /login 은 `next` 가 없으면 getSafeNext(null) → '/' 로 떨어지고,
//   getAfterLoginHref('/') 가 **무조건 '/saju/new'** 를 돌려준다. 즉 로그인 링크가
//   현재 경로를 안 넘기면 사용자는 보던 화면을 잃고 사주 입력폼으로 튄다.
//   SiteHeader 는 처음부터 pathname 을 넘기고 있었고, PC 메가내브·모바일 전체 메뉴·택일만
//   빠져 있어서 "어떤 버튼으로 로그인했느냐"에 따라 동작이 갈렸다 — 재현이 어려운 이유다.
//
//   새 로그인 링크를 만들 땐 반드시 next 를 붙여라. 붙이지 않아도 되는 경우
//   (계정 삭제 완료처럼 돌아갈 화면이 없는 경우)는 아래 ALLOWED 에 근거와 함께 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** next 없이 /login 으로 보내도 되는 자리 — 돌아갈 화면이 없는 곳만. */
const ALLOWED = new Set([
  // 계정을 지운 직후. 돌아갈 '보던 화면'이 존재하지 않는다.
  'src/app/my/settings/delete-account/page.tsx',
]);

const SKIP_DIRS = new Set(['node_modules', '.next']);

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, acc);
    else if (entry.name.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

describe('로그인 링크는 돌아갈 곳을 들고 간다', () => {
  it('next 없는 href="/login" 이 남아 있지 않다', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(path.join(process.cwd(), 'src'))) {
      const rel = path.relative(process.cwd(), file);
      if (rel.includes('/admin/') || rel.endsWith('app/login/page.tsx')) continue;
      if (ALLOWED.has(rel)) continue;
      const text = fs.readFileSync(file, 'utf8');
      text.split('\n').forEach((line, i) => {
        // href="/login" 정확일치. href={`/login?next=...`} 나 /login?mode=... 는 통과.
        if (/href=(["'])\/login\1/.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(
      offenders,
      `next 없이 /login 으로 보내면 로그인 뒤 /saju/new 로 튄다.\n` +
        `  현재 경로를 next 로 넘기거나, 돌아갈 화면이 없으면 ALLOWED 에 근거와 함께 등록하세요.\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  it('getAfterLoginHref 의 기본 목적지가 바뀌면 이 가드도 다시 본다', () => {
    const login = fs.readFileSync(path.join(process.cwd(), 'src/app/login/page.tsx'), 'utf8');
    // 이 전제가 깨지면(예: 기본을 '/'로 바꾸면) 위 가드의 근거가 사라진다.
    expect(login).toContain("if (next === '/' || next === '/login') return '/saju/new");
  });
});
