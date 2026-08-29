// 2026-08-29 회귀 가드 — 스티키 서브헤더(뒤로가기+제목)가 상단 메뉴 밑으로 파고들어 반쯤 잘리던 버그.
//   원인은 `top: 3.25rem` 처럼 헤더 높이를 상수로 박아둔 것이었다. app-shell.css 의
//   min-height 를 보고 쓴 값인데 readability.css 가 헤더를 3.95rem 으로 키우면서
//   상수는 따라가지 않았다. 실측 헤더는 64/69/77px(모바일/태블릿/PC)에 '읽기 크기'로도 변한다.
//   이 테스트는 "스티키 오프셋은 상수가 아니라 실측 변수를 본다" 하나만 지킨다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** 셀렉터에 `.gangi-sub-header` 가 들어간 룰들의 `top:` 선언값. */
function stickyTops(css: string): string[] {
  const tops: string[] = [];
  for (const m of css.matchAll(/([^{}]*\.gangi-sub-header[^{}]*)\{([^}]*)\}/g)) {
    const top = m[2]!.match(/(?:^|\n)\s*top:\s*([^;]+);/)?.[1]?.trim();
    if (top) tops.push(top);
  }
  return tops;
}

describe('스티키 서브헤더 오프셋', () => {
  it('헤더 높이를 상수로 박지 않고 --app-header-height 를 본다', () => {
    const tops = stickyTops(read('src/app/styles/subpages.css'));
    expect(tops.length).toBeGreaterThan(0);
    for (const value of tops) expect(value).toContain('--app-header-height');
  });

  it('--app-header-height 를 실제 헤더 높이로 채우는 코드가 붙어 있다', () => {
    const source = read('src/shared/layout/sticky-header-offset.tsx');
    expect(source).toContain('--app-header-height');
    // offsetHeight 는 정수 반올림 → 0.x px 파고듦. rect 로 재야 한다.
    expect(source).toContain('getBoundingClientRect');
    // 헤더는 PC(mega-nav)/모바일(app-top-header)이 번갈아 뜬다 — 둘 다 후보여야 한다.
    expect(source).toContain('.mega-nav-root');
    expect(source).toContain('.app-top-header');
    expect(read('src/shared/layout/app-shell.tsx')).toContain('<StickyHeaderOffset />');
  });
});
