// 2026-09-27 — 한자 전면 금지 게이트(사용자 결정: 명식 포함, 해석이 어려워 한자는 쓰지 않는다).
//   몇 달째 "한자가 또 나온다"가 반복됐다 — 한글화(koreanizeGanzi)를 화면마다 따로 불러서 새 화면·폴백 문장에서 빠졌다.
//   기억이 아니라 **실제로 그린 화면의 글자**로 막는다: 공개 풀이 화면에 한자가 한 글자라도 보이면 실패.
//   (결제 뒤 본문·PDF 는 오프라인 렌더 검사 scripts/verify-*-pdf.mjs 가 막는다.)
import { test, expect } from '@playwright/test';

// 가상 사주(결정론 slug — DB 없이 계산된다).
const SLUG = '1990-5-15-14-m30-male';
const ROUTES = [
  '/',
  '/saju/new',
  `/saju/${SLUG}`,
  `/saju/${SLUG}/deep`,
  `/saju/${SLUG}/premium`,
  `/saju/${SLUG}/new-year/2027`,
  '/today-fortune?concern=general',
  '/daewoon',
  '/taekil',
  '/zodiac',
  '/compatibility/input',
  '/membership',
];

for (const path of ROUTES) {
  test(`한자 0 글자 ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const leaks = await page.evaluate(() => {
      const text = document.body.innerText;
      return [...new Set(text.match(/[^\n]{0,12}[一-鿿]+[^\n]{0,12}/g) ?? [])];
    });
    expect(leaks, `한자가 화면에 보인다: ${leaks.join(' / ')}`).toEqual([]);
  });
}
