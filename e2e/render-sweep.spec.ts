// 2026-08-31 — 렌더 스윕 게이트.
//
//   배경: 2026-08-30 하루에 "테스트는 초록인데 화면은 틀린" 버그가 세 번 나왔다
//   (min-width:auto 로 점수가 화면 밖 · 채움 막대가 선택자에 밀려 안 보임 ·
//    선택 버튼 글자가 @layer 순서로 먹색). 정적 검사로는 안 잡히는 종류라,
//   **실제로 그려서 값을 재는** 게이트를 둔다.
//
//   ⚠️ 넣기 전에 프로덕션에 대고 먼저 재봤다. **전 페이지 대비 스캔은 CI 게이트로 쓸 수 없다** —
//      24개 조합 중 12개가 걸렸는데 전부 오탐이었다:
//        · 이모지(🐭)는 color 와 무관하게 렌더된다
//        · 배경이 이미지/그라데이션/반투명 오버레이면 backgroundColor 로 못 읽는다
//        · 배경은 조상뿐 아니라 **형제·의사요소**에서도 온다 — 조상만 걸어서는 원리적으로 불완전
//      걸러내도 홈의 흰 글씨 8개가 남았다. 첫날부터 빨간 CI 는 결국 꺼진다.
//      → 대비는 **배경이 단색임이 확실한 폼 컨트롤 상태**만 본다(아래 마지막 테스트).
//         전면 대비 감사는 사람이 도구로 돌릴 일이지 게이트가 아니다.
import { test, expect } from '@playwright/test';

/** 인증 없이 열리는 공개 라우트(smoke.spec.ts 와 같은 기준). */
const ROUTES = ['/', '/pricing', '/membership', '/compatibility/input', '/saju/new'];
/** 좁을수록 터진다. 소형 안드로이드(360)·아이폰15 Pro(390). */
const WIDTHS = [360, 390];

for (const path of ROUTES) {
  for (const width of WIDTHS) {
    test(`가로 넘침 없음 ${path} @${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      // 가장 바깥에서 넘치는 요소를 같이 알려준다 — 숫자만 있으면 원인을 또 찾아야 한다.
      const culprit = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        for (const el of document.querySelectorAll<HTMLElement>('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= vw + 1) continue;
          // 가로 스크롤 컨테이너 안은 정상이다(캐러셀·칩 줄).
          let n: HTMLElement | null = el.parentElement;
          let inScroller = false;
          while (n) {
            if (/auto|scroll/.test(getComputedStyle(n).overflowX)) { inScroller = true; break; }
            n = n.parentElement;
          }
          if (inScroller) continue;
          return `${el.tagName}.${el.className.toString().split(' ').slice(0, 2).join('.')} right=${Math.round(r.right)} vw=${vw}`;
        }
        return null;
      });

      expect(overflow, `가로 넘침 ${overflow}px — 첫 원인: ${culprit ?? '(못 찾음)'}`).toBe(0);
    });

    test(`깨진 이미지 없음 ${path} @${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      // naturalWidth 0 = 404 이거나 디코딩 실패. 화면엔 빈 칸으로만 보여 눈으로 놓치기 쉽다.
      const broken = await page.evaluate(() =>
        [...document.querySelectorAll('img')]
          .filter((im) => im.complete && im.naturalWidth === 0)
          .map((im) => im.currentSrc || im.src)
      );
      expect(broken, `깨진 이미지:\n  ${broken.join('\n  ')}`).toEqual([]);
    });
  }
}

test('선택된 폼 컨트롤 글자가 배경 위에서 읽힌다 (/saju/new)', async ({ page }) => {
  // 2026-08-30 #716 회귀 게이트: 선택된 성별 버튼이 인주 배경에 먹색 글자(대비 2.89)였다.
  //   원인은 특이도가 아니라 **@layer 순서**(components.css 가 @layer components 라
  //   Tailwind utilities 가 뒤에 와서 무조건 이긴다) — CSS 만 봐서는 맞아 보인다.
  // 여기 버튼들은 배경이 단색이고 이모지도 없어 조상 탐색이 정확하다.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/saju/new', { waitUntil: 'domcontentloaded' });
  for (const name of ['양력', '여성', '서울']) {
    await page.getByRole('button', { name, exact: true }).first().click();
  }
  await page.waitForTimeout(300);

  const results = await page.evaluate(() => {
    const lum = (c: number[]) => {
      const s = c.map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * s[0]! + 0.7152 * s[1]! + 0.0722 * s[2]!;
    };
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const bgOf = (el: Element) => {
      let n: Element | null = el;
      while (n) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== 'none') return null; // 배경이 그림이면 판정 못 한다
        const m = (cs.backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
        if (m.length && !(m[3] !== undefined && m[3] < 1)) return m.slice(0, 3);
        n = n.parentElement;
      }
      return [255, 255, 255];
    };
    const out: Array<{ label: string; ratio: number; need: number }> = [];
    for (const el of document.querySelectorAll('.is-selected')) {
      const t =
        [...el.querySelectorAll('*')].find((n) => !n.children.length && n.textContent?.trim()) ?? el;
      const bg = bgOf(t);
      if (!bg) continue;
      const cs = getComputedStyle(t);
      const px = parseFloat(cs.fontSize);
      const big = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700);
      const a = lum(rgb(cs.color));
      const b = lum(bg);
      out.push({
        label: (t.textContent ?? '').trim().slice(0, 10),
        ratio: +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2),
        need: big ? 3 : 4.5,
      });
    }
    return out;
  });

  expect(results.length, '선택된 컨트롤을 못 찾았다 — 셀렉터가 UI 를 따라가야 한다').toBeGreaterThan(2);
  const failed = results.filter((r) => r.ratio < r.need);
  expect(
    failed,
    `대비 미달:\n  ${failed.map((f) => `"${f.label}" ${f.ratio}/${f.need}`).join('\n  ')}`
  ).toEqual([]);
});
