// 2026-06-27 — 로그인/회원가입 폼 모바일 가로 overflow 회귀 게이트.
//   배경: #498~#500 까지 4번 재발한 만성 버그. 기존 readability-visual 게이트는
//     documentElement.scrollWidth 기반이라 카드의 overflow-x-clip 에 가려진
//     '콘텐츠 잘림'(폼이 화면 밖으로 삐져나가지만 페이지 스크롤은 0)을 못 잡았다.
//   근본: .unified-birth-form(grid)이 base 에 grid-template-columns 없어 암묵적
//     auto 트랙 → max-content(~843px)로 부풀어 카드를 뚫음. .gangi-subpage 에만
//     minmax(0,1fr) 오버라이드가 있고 login 은 .gangi-login-subpage 라 안 닿았다.
//   이 게이트는 '뷰포트 밖으로 나가는 요소(가로 스크롤 컨테이너 자식 제외)'를 직접
//     검출 → clip 으로 숨겨도 회귀를 잡는다.
import { test, expect } from '@playwright/test';

const MODES = [
  { name: 'signup', path: '/login?mode=signup', ready: '기본 사주 정보' },
  { name: 'gateway', path: '/login', ready: '카카오 로그인' },
];

// 좁은 폭일수록 잘 터진다. 아이폰15 Pro(393)·SE(375)·소형 안드로이드(360).
const WIDTHS = [393, 375, 360];

for (const m of MODES) {
  for (const w of WIDTHS) {
    test(`login ${m.name} no overflow @ ${w}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: w, height: 852 });
      await page.goto(m.path, { waitUntil: 'domcontentloaded' });
      await page
        .locator(`text=${m.ready}`)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => {});
      await page.waitForTimeout(500);

      const offenders = await page.evaluate((vw) => {
        // 가로 스크롤이 의도된 컨테이너(presets 등 overflow-x:auto/scroll) 자식은 제외.
        function hasScrollableAncestor(el: Element): boolean {
          let p = el.parentElement;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
            p = p.parentElement;
          }
          return false;
        }
        const bad: Array<{ tag: string; cls: string; right: number; over: number }> = [];
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.right > vw + 1 && !hasScrollableAncestor(el)) {
            bad.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 60),
              right: Math.round(r.right),
              over: Math.round(r.right - vw),
            });
          }
        }
        return bad;
      }, w);

      expect(
        offenders,
        `${m.name}@${w}px 뷰포트 밖으로 나가는 요소 ${offenders.length}개: ` +
          offenders
            .slice(0, 5)
            .map((o) => `<${o.tag} .${o.cls}> +${o.over}px`)
            .join(', ')
      ).toEqual([]);
    });
  }
}
