import { expect, test, type Page } from '@playwright/test';

// 2026-07-19 — 이 스펙은 병렬 실행에서만 산발적으로 실패했다(직렬 20/20 통과).
//   원인: `/notifications` 의 '알림 설정' 은 React onClick(setTab) 버튼인데,
//   goto 가 `domcontentloaded` 까지만 기다리므로 **하이드레이션 전에 클릭**할 수 있다.
//   그 클릭은 no-op 이라 탭이 안 열리고, 뒤따르는 링크 단언이 "element not found" 로 터진다.
//   직렬에서는 하이드레이션이 충분히 빨라 우연히 통과했다(= 제품 버그 아님, 테스트 경합).
//   해결: 클릭 후 **패널이 실제로 열렸는지**까지 한 묶음으로 재시도(toPass).
async function openSettingsTab(page: Page) {
  await page.goto('/notifications', { waitUntil: 'domcontentloaded' });

  const settingsTab = page.getByRole('button', { name: '알림 설정' });
  await expect(settingsTab).toBeVisible();

  // 하이드레이션 완료 전 클릭은 무효이므로, 탭이 열릴 때까지 클릭을 재시도한다.
  await expect(async () => {
    await settingsTab.click();
    await expect(page.getByTestId('email-notification-channel')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test('Kakao AlimTalk is exposed as an active settings path, not coming soon', async ({ page }) => {
  await openSettingsTab(page);

  const kakaoSettings = page.getByRole('link', { name: '카카오 알림톡 설정' });
  await expect(kakaoSettings).toBeVisible();
  await expect(kakaoSettings).toHaveAttribute('href', '/my/settings#kakao-contact');
  await expect(kakaoSettings).toContainText('전화번호 등록 후 결제·구독 안내 받기');
  await expect(kakaoSettings).not.toContainText('출시 예정');
});

test('Email notifications are exposed as an opt-in channel, not coming soon', async ({ page }) => {
  await openSettingsTab(page);

  const emailToggle = page.getByRole('checkbox', { name: '이메일 알림 받기' });
  await expect(emailToggle).toBeVisible();
  await expect(emailToggle).not.toBeChecked();

  const emailRow = page.getByTestId('email-notification-channel');
  await expect(emailRow).toContainText('가입한 이메일로 알림 받기');
  await expect(emailRow).not.toContainText('출시 예정');
});
