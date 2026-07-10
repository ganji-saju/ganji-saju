// 2026-07-10 — Task 9(허브 통합 입력 E2E). /start 의 UnifiedIntake(intent=null) →
// 선택 화면(IntakeChoice) → localStorage 영속 → 타 상품(오늘의 운세) 프리필까지는
// 순수 클라이언트 로직(resolveUnifiedBirthInput 검증 + birth-profile-store
// localStorage)이라 백엔드/Supabase 없이도 결정적으로 검증 가능하다.
//
// 선택 카드 클릭 이후의 실제 제출(POST /api/readings, /api/today-fortune)은 DB가
// 필요해 이 로컬 환경에서 초록으로 못 돌린다(e2e/saju.spec.ts 의
// E2E_TEST_USER_EMAIL 미설정 skip 관례와 동일 제약) — 그래서 이 스펙은 선택 화면
// 노출까지만 검증하고, 카드 클릭 → /saju/** 도달은 별도의 skip-게이트 테스트로
// 분리한다.
import { test, expect } from '@playwright/test';
import { hasTestUser } from './fixtures/test-user';

const BIRTH_PROFILE_STORAGE_KEY = 'moonlight:birth-profile:last';

test.describe('허브 통합 입력(UnifiedIntake) — 클라이언트 플로우', () => {
  test('start hub: 생년월일·성별·출생지 입력 → 선택 화면 노출 + localStorage 저장 → today-fortune 프리필', async ({
    page,
  }) => {
    await page.goto('/start');

    // 생년월일 — UnifiedBirthInfoFields 는 idPrefix 기본값 'unified' 로 렌더되어
    // select id 가 `unified-birth-{year,month,day}` (unified-intake.tsx 는 idPrefix 를
    // 넘기지 않는다).
    await page.locator('#unified-birth-year').selectOption('1990');
    await page.locator('#unified-birth-month').selectOption('5');
    await page.locator('#unified-birth-day').selectOption('12');

    // 성별 — 버튼 토글(select 아님).
    await page.getByRole('button', { name: '여성' }).click();

    // 출생지 — 프리셋 칩(클라이언트 전용, API 호출 없음). 검색창(API 호출)은 회피.
    await page.getByRole('button', { name: '서울', exact: true }).click();

    // 태어난 시각 — unified-intake.tsx 가 직접 렌더하는 전용 select(id 고정값).
    await page.locator('#unified-intake-hour').selectOption('10');

    await page.getByRole('button', { name: '결과 보기' }).click();

    // 선택 화면(IntakeChoice) 노출 — role=group aria-label 로 식별.
    const choiceGroup = page.getByRole('group', { name: '무엇을 볼까요?' });
    await expect(choiceGroup).toBeVisible();
    await expect(choiceGroup.getByRole('button', { name: '오늘의 운세' })).toBeVisible();
    await expect(choiceGroup.getByRole('button', { name: '내 사주' })).toBeVisible();

    // 출생 프로필이 localStorage 에 영속됐는지 확인 (birth-profile-store.saveBirthProfile).
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      BIRTH_PROFILE_STORAGE_KEY
    );
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? '{}');
    expect(parsed.year).toBe('1990');
    expect(parsed.month).toBe('5');
    expect(parsed.day).toBe('12');
    expect(parsed.gender).toBe('female');
    expect(parsed.birthLocationCode).toBe('seoul');

    // 다른 상품(오늘의 운세) 방문 시 동일 출생정보가 프리필 요약 카드로 노출.
    await page.goto('/today-fortune');
    await expect(page.getByText('정보로 볼게요')).toBeVisible();
  });

  // 카드 클릭 → 실제 제출(POST /api/readings 등)은 Supabase/DB 가 필요해 로컬
  // 무자격 환경에서는 항상 skip. E2E_TEST_USER_EMAIL/PASSWORD 가 있는 환경(CI 등)
  // 에서만 도는 별도 시나리오로 분리 — saju.spec.ts 의 skip 관례를 그대로 따른다.
  test('start hub: "내 사주" 선택 → /saju/** 도달 (DB 필요, credentials 있을 때만)', async ({
    page,
  }) => {
    test.skip(!hasTestUser(), 'E2E_TEST_USER_EMAIL/PASSWORD 미설정 — DB 필요 제출 시나리오 skip');

    await page.goto('/start');
    await page.locator('#unified-birth-year').selectOption('1990');
    await page.locator('#unified-birth-month').selectOption('5');
    await page.locator('#unified-birth-day').selectOption('12');
    await page.getByRole('button', { name: '여성' }).click();
    await page.getByRole('button', { name: '서울', exact: true }).click();
    await page.getByRole('button', { name: '결과 보기' }).click();

    await page.getByRole('group', { name: '무엇을 볼까요?' }).getByRole('button', { name: '내 사주' }).click();
    await expect(page).toHaveURL(/\/saju\//);
  });
});
