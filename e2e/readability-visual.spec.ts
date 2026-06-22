// 2026-06-22 — 가독성 표면별 크기 상향 회귀 하니스.
//   설계: docs/superpowers/specs/2026-06-22-readability-surface-upsize-design.md
//   핵심: 폰트 크기 상향은 픽셀이 의도적으로 바뀌므로 픽셀 회귀는 무의미.
//     → 자동 게이트 = 레이아웃 깨짐(가로 오버플로) 검출. 스크린샷 = before/after
//        갤러리(사람 검토용 fullPage, 픽셀 단언 아님).
//   실행:
//     SHOT_PHASE=before npx playwright test readability-visual --project=chromium
//     (코드모드 후) SHOT_PHASE=after  npx playwright test readability-visual --project=chromium
//   인증 표면 확대: E2E_SEED_SLUG + storageState(auth-setup) 후 SURFACES.auth 추가.
import { test, expect } from '@playwright/test';

const PHASE = process.env.SHOT_PHASE ?? 'before';

// 1차(unauth 파일럿): creds 불필요. 결과 표면은 E2E_SEED_SLUG 설정 시 확대.
const SEED = process.env.E2E_SEED_SLUG;
const SURFACES: { name: string; path: string }[] = [
  { name: 'home', path: '/' },
  { name: 'today-input', path: '/today-fortune' },
  { name: 'compat-input', path: '/compatibility/input' },
  { name: 'pricing', path: '/membership' },
  { name: 'dream', path: '/dream' },
  ...(SEED ? [{ name: 'saju-result', path: `/saju/${SEED}` }] : []),
];

const VIEWPORTS = [
  { t: 'mobile', w: 390, h: 844 },
  { t: 'desktop', w: 1280, h: 900 },
];

for (const s of SURFACES) {
  for (const v of VIEWPORTS) {
    test(`readability ${s.name} ${v.t}`, async ({ page }) => {
      await page.setViewportSize({ width: v.w, height: v.h });
      await page.goto(s.path, { waitUntil: 'networkidle' }).catch(() => page.goto(s.path));
      await page.waitForTimeout(400); // 폰트/레이아웃 안정화

      // (1) 자동 게이트 — 가로 오버플로(글자 커지며 가로 스크롤 생기면 = 레이아웃 깨짐)
      const health = await page.evaluate(() => {
        const de = document.documentElement;
        const horiz = de.scrollWidth - de.clientWidth;
        const clipped = Array.from(document.querySelectorAll('p, span, div, h1, h2, h3, li, button'))
          .filter((el) => {
            const cs = getComputedStyle(el);
            return (
              (cs.overflowX === 'hidden' || cs.overflow === 'hidden') &&
              cs.textOverflow !== 'ellipsis' &&
              (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 2
            );
          }).length;
        return { horiz, clipped };
      });

      // (2) 캡처 — before/after 갤러리(사람 검토)
      await page.screenshot({
        path: `e2e/readability-shots/${PHASE}/${s.name}-${v.t}.png`,
        fullPage: true,
      });

      // 게이트: 모바일 가로 오버플로 = 핵심 회귀 신호. 1px 허용(반올림).
      expect(health.horiz, `${s.name}/${v.t} 가로 오버플로(px)`).toBeLessThanOrEqual(1);
      // clipped 는 리포트(텍스트 줄임 의존 컴포넌트 존재) — 콘솔로만 남김.
      if (health.clipped > 0) console.log(`  ⚠️ ${s.name}/${v.t} clipped 의심 ${health.clipped}곳`);
    });
  }
}
