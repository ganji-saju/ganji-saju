// 2026-05-16 Phase 2B — 인증 fixture credentials helper.
//
// 로컬: .env.local 에 E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 추가하면 동작.
// CI: GitHub Secrets 에 동일 이름으로 추가한 후 playwright.yml env 매핑.
//
// 미설정 시 hasTestUser() === false → auth-setup 이 skip 처리 → saju spec 자동 skip.
// (회귀 없이 점진 도입 가능)
//
// 보안:
// - dev/staging Supabase 의 전용 test 계정만 사용. production 계정 절대 금지.
// - 비밀번호는 randomize 후 .env.local 와 GitHub Secrets 양쪽에 저장.

export type TestUserCredentials = {
  email: string;
  password: string;
};

export function getTestUser(): TestUserCredentials | null {
  const email = process.env.E2E_TEST_USER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!email || !password) return null;
  if (!email.includes('@')) return null;
  return { email, password };
}

export function hasTestUser(): boolean {
  return getTestUser() !== null;
}

// 사주 페이지 테스트에 사용할 reading slug. test user 의 본인 사주 slug.
// 미설정 시 /saju/me 사용 (대부분 본인 사주로 리디렉트되도록 라우팅됨).
export function getTestReadingSlug(): string {
  return process.env.E2E_TEST_READING_SLUG?.trim() || 'me';
}
