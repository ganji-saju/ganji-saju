# Task 6 보고서: Galaxy S25·인앱 브라우저 회귀 E2E 검증

## 상태

- 완료
- 기준 HEAD: `cc27d1b9015be84622ddcc1407dbec942be199c5`

## Red

1. 최초 `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium`
   - 3 실패, 1 skip
   - 수동 버튼 클릭 뒤 dialog의 접근성 이름이 단계 제목이어서 `/사용방법/` locator가 찾지 못함.
   - 데스크톱 viewport에서 모바일 메뉴 버튼이 렌더되지 않아 모바일 메뉴 시나리오 실패.
   - Galaxy 360×780에서 article이 viewport보다 짧아 내부 scrollTop이 변하지 않음.
2. `chromium-auth-guide` project는 최초 config에 없어 실행할 수 없는 RED 상태.

## Green

- dialog에 안정적인 접근성 이름 `사용방법`을 부여함.
- dialog 최대 높이를 viewport와 24rem 중 작은 값으로 제한해 Galaxy S25에서도 내부 스크롤 영역과 body lock을 함께 유지함.
- 모바일 메뉴 시나리오는 360×780 viewport와 정확한 메뉴 버튼 이름을 사용함.
- `chromium-auth-guide` project를 추가하고 기존 `auth-setup` 및 조건부 storageState를 재사용함.
- 인증 spec은 가이드 storage key만 초기화/정리하며 credentials가 없으면 사유를 명시해 skip함.

## 실제 실행 결과

- `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium`
  - 3 passed, 1 skipped
- `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium-auth-guide`
  - credentials 미설정 환경: 5 skipped (auth setup 1 + 공개/Galaxy 3 + 인증 1)
- `npm run typecheck`
  - exit 0
- `npx vitest run src/features/system-guide/system-guide-onboarding.test.tsx src/features/system-guide/system-guide-launcher.test.tsx src/features/system-guide/system-guide-page.test.tsx src/features/shared-navigation/system-guide-navigation.test.tsx`
  - 4 files passed, 38 tests passed
- `git diff --check`
  - exit 0

## 변경 파일

- `e2e/system-guide-onboarding.spec.ts`
- `playwright.config.ts`
- `src/features/system-guide/system-guide-onboarding.tsx`
- `.superpowers/sdd/task-6-report.md`

## Self-review

- 공개 spec은 credentials 및 storageState 없이 실행됨.
- Galaxy 설정은 spec 내부 `test.use`에만 적용되어 project 수를 늘리지 않음.
- 6단계 전진/후진, viewport 경계, 내부 스크롤, body lock/복구, 닫기 영속성, 수동 재오픈을 실제 UI로 검증함.
- 인증 project는 기존 auth fixture 관례와 storage path를 재사용하고 다른 localStorage key를 변경하지 않음.
- 제품 수정은 E2E에서 발견한 접근성 이름과 내부 스크롤 결함에 한정함.

## 커밋

- 커밋 후 기록: `test: 사용방법 온보딩 모바일 회귀 검증`

## 환경 제약

- 현재 셸에 `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD`가 없어 실제 로그인 자동 실행은 수행하지 못했고, 의도된 명시 skip 경로를 검증함.
- 개발 서버에서 `NO_COLOR`/`FORCE_COLOR` 경고와 CSP report-only 로그가 출력됐으나 테스트 실패나 타입 오류는 없었음.
- repo에 ESLint dependency/config가 없어 `npx eslint ...`는 최신 ESLint 임시 설치 후 config 부재로 실행되지 않았으며, 대신 TypeScript와 관련 Vitest/E2E 및 `git diff --check`를 통과함.

## Important 리뷰 수정 (2026-07-13)

### Red

- 명령: `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium --grep "desktop walkthrough"`
- 결과: 1 failed. 데스크톱 article `clientHeight`가 382px로 24rem 모바일 제한에 잘리는 회귀를 확인함.

### 변경

- 인증 init script에 `sessionStorage` marker를 추가해 동일 browser context의 최초 document에서만 guide localStorage key를 제거함. dismiss 상태와 marker는 reload에서 유지되고, afterEach는 guide key와 marker만 정리함.
- 모바일 기본 max-height는 24rem로 유지하되 `sm` 이상은 기존 `calc(100dvh - 1.5rem)` 제한으로 복원함. 데스크톱 natural height/비스크롤 회귀 E2E를 추가함.
- Galaxy 내부 스크롤 검증을 `mouse.wheel`에서 CDP `Input.dispatchTouchEvent` 기반 article 내부 터치 스와이프로 교체함.

### Green 및 실제 실행 결과

- 명령: `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium`
  - 결과: 4 passed, 1 skipped.
- 명령: `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium-auth-guide`
  - 결과: credentials 미설정으로 6 skipped. 실제 인증 로그인 경로는 환경 제약상 미실행.
- 명령: `npm run typecheck`
  - 결과: exit 0.
- 명령: `npx vitest run src/features/system-guide/system-guide-onboarding.test.tsx src/features/system-guide/system-guide-launcher.test.tsx src/features/system-guide/system-guide-page.test.tsx src/features/shared-navigation/system-guide-navigation.test.tsx`
  - 결과: 4 files passed, 38 tests passed.
- 명령: `git diff --check`
  - 결과: exit 0.

### Self-review

- init marker는 sessionStorage에만 있어 storageState로 유출되지 않고 reload에는 유지됨.
- dismiss 직후 localStorage가 `dismissed`를 포함하는지 확인한 뒤 reload 후 dialog 0개를 단언하므로, marker가 없던 기존 구현은 credentials 환경에서 실패함.
- 터치 helper는 article bounding box 내부에서 시작/종료하며 8단계 touchMove 후 실제 `scrollTop > 0`을 기다림.
- 데스크톱 테스트는 article 높이가 384px보다 크고 `scrollHeight === clientHeight`임을 확인해 모바일 제한 누출을 검출함.

### 커밋

- 코드 및 E2E: `7cb28b70` (`test: 온보딩 회귀 시나리오 보강`).
- 이 append 기록은 후속 보고서 커밋에 포함.
