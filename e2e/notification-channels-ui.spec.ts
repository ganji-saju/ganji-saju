import { expect, test } from '@playwright/test';

test('Kakao AlimTalk is exposed as an active settings path, not coming soon', async ({ page }) => {
  await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '알림 설정' }).click();

  const kakaoSettings = page.getByRole('link', { name: '카카오 알림톡 설정' });
  await expect(kakaoSettings).toBeVisible();
  await expect(kakaoSettings).toHaveAttribute('href', '/my/settings#kakao-contact');
  await expect(kakaoSettings).toContainText('전화번호 등록 후 결제·구독 안내 받기');
  await expect(kakaoSettings).not.toContainText('출시 예정');
});
