import { test, expect } from '@playwright/test';

// 2026-10-27 — 랜딩(/saju-report) 하단 고정 "풀이 신청하기" 버튼이 운영에서 안 보이던 회귀 차단(#970).
//
//   고정 버튼은 body 로 portal 되어 `.page` 밖에 붙는다. 색 토큰을 `.page` 에만 선언했더니
//   버튼이 var(--sr-seal) 을 못 받아 배경이 투명해지고 흰 글자만 남아 한지 위에 묻혔다.
//   CSS 가 빌드는 되고 요소도 "보이는" 상태라 toBeVisible 로는 못 잡는다 — 실제 칠해진 색을 잰다.

/** WCAG 상대 휘도. */
function luminance([r, g, b]: number[]) {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('랜딩 하단 고정 신청 버튼은 배경이 칠해져 있고 글자가 읽힌다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/saju-report');
  const button = page.locator('body > div a[href="#order"]').last();
  await expect(button).toBeVisible();

  const { bg, fg } = await button.evaluate((el) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const s = getComputedStyle(el);
    return { bg: parse(s.backgroundColor), fg: parse(s.color) };
  });

  // rgba(0, 0, 0, 0) = 투명. 알파가 없으면(rgb) 불투명.
  expect(bg[3] ?? 1, `버튼 배경이 투명함: ${bg}`).toBeGreaterThan(0.9);
  expect(contrast(bg, fg), `글자 대비 부족: 배경 ${bg} / 글자 ${fg}`).toBeGreaterThanOrEqual(4.5);
});
