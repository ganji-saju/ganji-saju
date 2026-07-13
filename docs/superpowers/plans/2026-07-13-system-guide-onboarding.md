# System Guide Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 또는 회원가입을 완료한 사용자가 이 브라우저에서 한 번만 보는 6단계 사용방법 온보딩과, 언제든 다시 열 수 있는 `/guide` 사용방법 메뉴를 현재 간지사주 디자인으로 제공한다.

**Architecture:** 안내 콘텐츠와 브라우저 상태 규칙은 순수 TypeScript 모듈로 분리한다. 루트 레이아웃에는 Supabase 인증 상태와 `localStorage`를 조정하는 작은 클라이언트 런처를 영속 마운트하고, 실제 모달은 `document.body` 포털로 렌더링한다. `/guide`는 검색 가능한 서버 페이지로 유지하면서 수동 실행만 클라이언트 이벤트로 연결하고, 데스크톱·모바일 메뉴는 동일한 `/guide` 링크를 사용한다.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Supabase Auth, Tailwind CSS 4, Lucide React, Node test runner, Playwright 1.60.

## Global Constraints

- 기존 `--app-*` 컬러 토큰, Noto Sans/Serif KR, 둥근 카드·버튼 및 현재 헤더 레이아웃을 유지한다.
- 다른 프로젝트, 다른 Supabase 프로젝트, 외부 서비스 권한은 사용하지 않는다.
- 서버 DB에는 온보딩 상태를 저장하지 않는다. 브라우저별 `localStorage`만 사용한다.
- 비로그인 사용자는 자동 실행하지 않는다. 로그인 사용자가 닫기 또는 완료를 한 뒤에는 자동 실행하지 않는다.
- `/guide`의 수동 실행은 저장 상태와 관계없이 항상 동작한다.
- 모달은 포털, 포커스 트랩, Escape 닫기, 배경 스크롤 잠금, `100dvh`, safe-area를 지원한다.
- Galaxy S25 및 Meta/Kakao 인앱 브라우저에서 화면 밖 배치와 터치 스크롤 회귀가 없어야 한다.
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`와 `03-layouts-and-pages.md`의 현재 프로젝트 버전 지침을 다시 확인한다.
- 각 작업은 먼저 실패 테스트를 만들고, 최소 구현으로 통과시킨 뒤 커밋한다.

---

## Task 1: 안내 콘텐츠와 브라우저 상태 계약 정의

**Files:**

- Create: `src/features/system-guide/system-guide-content.ts`
- Create: `src/features/system-guide/system-guide-state.ts`
- Create: `src/features/system-guide/system-guide-content.test.ts`
- Create: `src/features/system-guide/system-guide-state.test.ts`

- [ ] **Step 1: 콘텐츠 계약 실패 테스트 작성**

`system-guide-content.test.ts`에 6단계 순서, 고유 ID, 주/보조 링크를 고정한다.

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';

test('system guide exposes the approved six steps in order', () => {
  assert.deepEqual(
    SYSTEM_GUIDE_STEPS.map(({ id, primaryHref }) => ({ id, primaryHref })),
    [
      { id: 'profile', primaryHref: '/my/profile' },
      { id: 'fortune', primaryHref: '/today-fortune' },
      { id: 'saju', primaryHref: '/saju/new' },
      { id: 'results', primaryHref: '/my/results' },
      { id: 'dialogue', primaryHref: '/dialogue' },
      { id: 'notifications', primaryHref: '/notifications' },
    ],
  );
  assert.equal(SYSTEM_GUIDE_STEPS[5]?.secondaryHref, '/membership');
});
```

- [ ] **Step 2: 상태 계약 실패 테스트 작성**

다음 공개 API를 테스트한다.

```ts
export const SYSTEM_GUIDE_STORAGE_KEY = 'ganji-saju:system-guide:v1';
export type SystemGuideStatus = 'new' | 'in_progress' | 'dismissed' | 'completed';
export interface SystemGuideState { version: 1; status: SystemGuideStatus; stepIndex: number }
export function createDefaultSystemGuideState(): SystemGuideState;
export function normalizeSystemGuideState(value: unknown): SystemGuideState;
export function shouldAutoOpenSystemGuide(authenticated: boolean, state: SystemGuideState): boolean;
export function readSystemGuideState(storage: Pick<Storage, 'getItem'>): SystemGuideState;
export function writeSystemGuideState(storage: Pick<Storage, 'setItem'>, state: SystemGuideState): void;
```

테스트 케이스는 `null`, 깨진 JSON, 잘못된 version/status, 음수·범위 밖 `stepIndex`, 비로그인, `new`, `in_progress`, `dismissed`, `completed`를 모두 포함한다. `new`와 `in_progress`인 로그인 사용자만 자동 실행되어야 하며 단계는 `0..5`로 보정한다.

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/features/system-guide/system-guide-content.test.ts src/features/system-guide/system-guide-state.test.ts`

Expected: 모듈을 찾을 수 없어 FAIL.

- [ ] **Step 4: 최소 콘텐츠와 상태 모듈 구현**

콘텐츠 타입은 아이콘을 React 컴포넌트로 저장하지 않고 직렬화 가능한 값만 둔다.

```ts
export type SystemGuideStepId =
  | 'profile' | 'fortune' | 'saju' | 'results' | 'dialogue' | 'notifications';

export interface SystemGuideStep {
  id: SystemGuideStepId;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}
```

`normalizeSystemGuideState`는 예외를 던지지 않고 기본값으로 복구하며, 저장 읽기 함수도 보안·프라이버시 모드에서 발생할 수 있는 `localStorage` 접근 예외를 잡는다.

- [ ] **Step 5: 단위 테스트와 타입 검사**

Run: `npm test -- src/features/system-guide/system-guide-content.test.ts src/features/system-guide/system-guide-state.test.ts && npm run typecheck`

Expected: PASS, type error 0.

- [ ] **Step 6: 커밋**

```bash
git add src/features/system-guide/system-guide-content.ts src/features/system-guide/system-guide-state.ts src/features/system-guide/system-guide-content.test.ts src/features/system-guide/system-guide-state.test.ts
git commit -m "feat: 사용방법 온보딩 상태 계약 추가"
```

## Task 2: 접근 가능한 1단계 집중 모달 구현

**Files:**

- Create: `src/features/system-guide/system-guide-onboarding.tsx`
- Create: `src/features/system-guide/system-guide-onboarding.test.tsx`
- Reference: `src/components/notifications/push-permission-modal.tsx`
- Reference: `src/components/common/use-focus-trap.ts`

- [ ] **Step 1: 컴포넌트 동작 실패 테스트 작성**

Vitest/jsdom에서 다음을 검증한다.

- 현재 단계의 제목과 `1 / 6` 진행 정보가 보인다.
- 첫 단계에는 이전 버튼이 없고, 중간 단계에는 이전/다음 버튼이 있다.
- 마지막 단계의 주 버튼은 `홈으로 가기`, 보조 링크는 `/membership`이다.
- 닫기, Escape, 배경 클릭은 `onDismiss(stepIndex)`를 정확히 한 번 호출한다.
- 완료는 `onComplete()`를 호출한다.

공개 Props는 아래로 고정한다.

```ts
interface SystemGuideOnboardingProps {
  open: boolean;
  initialStepIndex: number;
  onStepChange: (stepIndex: number) => void;
  onDismiss: (stepIndex: number) => void;
  onComplete: () => void;
}
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:spec -- src/features/system-guide/system-guide-onboarding.test.tsx`

Expected: 컴포넌트가 없어 FAIL.

- [ ] **Step 3: 포털 모달 최소 구현**

`PushPermissionModal` 패턴을 따라 `createPortal(..., document.body)`와 `useFocusTrap`을 사용한다. DOM 구조 핵심은 다음과 같다.

```tsx
<div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center"
  role="dialog" aria-modal="true" aria-labelledby="system-guide-title">
  <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="사용방법 닫기" />
  <article
    ref={trapRef}
    tabIndex={-1}
    className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[22px] border bg-white p-5 focus:outline-none sm:p-6"
    style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
  >
    {/* 진행 점, 현재 한 단계의 아이콘·제목·설명·CTA만 렌더 */}
  </article>
</div>
```

아이콘은 단계 ID에서 Lucide 아이콘으로 매핑한다. 링크 CTA를 누를 때는 닫힘 상태를 먼저 저장할 수 있도록 콜백을 실행한 뒤 Next `Link`로 이동한다. 터치 영역은 최소 44px, 설명은 `word-break: keep-all`, 카드 내부만 `overflow-y-auto`로 둔다.

- [ ] **Step 4: 열림 수명주기 구현**

열렸을 때만 Escape listener와 body scroll lock을 활성화하고 cleanup에서 이전 `overflow` 값을 복원한다. `initialStepIndex`는 열리는 시점마다 반영하되 열려 있는 중 부모 재렌더가 사용자의 현재 단계를 되감지 않게 한다.

- [ ] **Step 5: 테스트와 타입 검사**

Run: `npm run test:spec -- src/features/system-guide/system-guide-onboarding.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/features/system-guide/system-guide-onboarding.tsx src/features/system-guide/system-guide-onboarding.test.tsx
git commit -m "feat: 사용방법 온보딩 모달 추가"
```

## Task 3: 인증 완료 후 1회 자동 실행과 수동 실행 이벤트 연결

**Files:**

- Create: `src/features/system-guide/system-guide-launcher.tsx`
- Create: `src/features/system-guide/system-guide-events.ts`
- Create: `src/features/system-guide/system-guide-launcher.test.tsx`
- Modify: `src/app/layout.tsx:1-30,259-280`
- Reference: `src/lib/supabase/client.ts`

- [ ] **Step 1: 런처 실패 테스트 작성**

Supabase 클라이언트와 저장소를 mock하여 다음 시나리오를 고정한다.

- 비로그인 초기 상태: 열리지 않는다.
- 로그인 초기 상태 + `new`: 자동으로 열린다.
- `SIGNED_IN` 이벤트 + `new`: 열린다.
- `dismissed` 또는 `completed`: 로그인해도 열리지 않는다.
- 단계 이동: `in_progress`와 현재 index를 저장한다.
- 닫기: `dismissed`, 완료: `completed`를 저장한다.
- `SYSTEM_GUIDE_OPEN_EVENT` 수신: 인증·저장 상태에 관계없이 지정 단계 또는 0에서 열린다.
- `/login`, `/signup`, `/auth/*`에서는 자동 실행하지 않지만 수동 이벤트는 허용한다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:spec -- src/features/system-guide/system-guide-launcher.test.tsx`

Expected: 런처 모듈이 없어 FAIL.

- [ ] **Step 3: 이벤트 계약 구현**

```ts
export const SYSTEM_GUIDE_OPEN_EVENT = 'ganji-saju:open-system-guide';

export function openSystemGuide(stepIndex = 0) {
  window.dispatchEvent(new CustomEvent(SYSTEM_GUIDE_OPEN_EVENT, { detail: { stepIndex } }));
}
```

이벤트 detail은 런처에서 숫자와 범위를 재검증한다.

- [ ] **Step 4: 클라이언트 런처 구현**

`'use client'`, `usePathname`, `createClient`, `hasSupabaseBrowserEnv`를 사용한다. 초기 `getUser()`와 `onAuthStateChange`를 모두 구독하되 `INITIAL_SESSION` 중복 실행을 막는다. 모달을 열기 전 저장 상태를 다시 읽어 탭 간 갱신과 React Strict Mode 중복을 방어한다.

```tsx
export function SystemGuideLauncher() {
  // mounted/auth/open/step 상태
  // 초기 getUser + auth subscription
  // manual custom event subscription
  // dismiss/complete/step persistence
  return <SystemGuideOnboarding ... />;
}
```

Supabase 브라우저 환경값이 없으면 자동 실행만 생략하고, `/guide`의 수동 이벤트는 정상 동작해야 한다.

- [ ] **Step 5: 루트 레이아웃에 영속 마운트**

`src/app/layout.tsx`에 import하고 `PriceProvider` 다음 전역 UI 영역에 한 번만 둔다.

```tsx
<PriceProvider map={priceMap}>{children}</PriceProvider>
<SystemGuideLauncher />
```

- [ ] **Step 6: 테스트와 타입 검사**

Run: `npm run test:spec -- src/features/system-guide/system-guide-launcher.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/features/system-guide/system-guide-launcher.tsx src/features/system-guide/system-guide-events.ts src/features/system-guide/system-guide-launcher.test.tsx src/app/layout.tsx
git commit -m "feat: 로그인 후 사용방법 온보딩 자동 실행"
```

## Task 4: `/guide` 사용방법 페이지 구현

**Files:**

- Modify: `src/app/guide/page.tsx`
- Create: `src/features/system-guide/system-guide-page.tsx`
- Create: `src/features/system-guide/system-guide-page.test.tsx`

- [ ] **Step 1: 페이지 실패 테스트 작성**

다음을 검증한다.

- `사용방법` 제목과 6개 단계 카드가 모두 렌더링된다.
- 각 카드의 링크가 승인된 실제 경로를 가리킨다.
- `처음부터 안내 보기` 버튼은 `openSystemGuide(0)`을 호출한다.
- 알림 단계에는 `/notifications`, `/membership` 링크가 모두 있다.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:spec -- src/features/system-guide/system-guide-page.test.tsx`

Expected: 기존 redirect 페이지 때문에 FAIL.

- [ ] **Step 3: 실제 가이드 페이지 구현**

`src/app/guide/page.tsx`는 서버 컴포넌트로 metadata와 정적 껍데기를 제공한다.

```tsx
export const metadata: Metadata = {
  title: '사용방법',
  description: '간지사주의 프로필, 무료운세, 사주풀이, 저장 결과, 대화, 알림 사용방법',
};

export default function GuidePage() {
  return <SystemGuidePage />;
}
```

`SystemGuidePage`만 클라이언트 컴포넌트로 두고, 상단 소개 카드·6단계 세로 카드·하단 `처음부터 안내 보기`를 기존 앱 카드 스타일로 구성한다. 모바일 한 열, 넓은 화면 두 열을 사용하며 기존 `SiteHeader`/페이지 셸 관례가 있으면 그대로 적용한다.

- [ ] **Step 4: 테스트와 타입 검사**

Run: `npm run test:spec -- src/features/system-guide/system-guide-page.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/app/guide/page.tsx src/features/system-guide/system-guide-page.tsx src/features/system-guide/system-guide-page.test.tsx
git commit -m "feat: 사용방법 가이드 페이지 추가"
```

## Task 5: 데스크톱·모바일 주 메뉴에 사용방법 추가

**Files:**

- Modify: `src/features/shared-navigation/mega-nav-data.ts:18-145`
- Modify: `src/features/shared-navigation/mega-nav.tsx:223-242`
- Modify: `src/features/shared-navigation/mobile-nav-sheet.tsx:125-205`
- Modify: `src/features/shared-navigation/mobile-nav-sheet.css`
- Create: `src/features/shared-navigation/system-guide-navigation.test.ts`

- [ ] **Step 1: 내비게이션 실패 테스트 작성**

`MEGA_NAV`에 standalone `{ label: '사용방법', simple: true, href: '/guide' }`가 정확히 한 번 있고 `resolveActiveGroup('/guide') === '사용방법'`인지 확인한다. 렌더 테스트에서는 데스크톱 `주 메뉴`와 모바일 `전체 메뉴` 안의 링크가 모두 `/guide`인지 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/features/shared-navigation/system-guide-navigation.test.ts`

Expected: 사용방법 항목이 없어 FAIL.

- [ ] **Step 3: 데스크톱 메뉴 추가**

`MEGA_NAV`의 멤버십 다음에 simple group을 추가하고 active resolver에 `/guide`를 추가한다. 기존 `GroupChip` 링크 동작을 재사용하여 새 드롭다운은 만들지 않는다.

```ts
{ label: '사용방법', simple: true, href: '/guide' }
```

- [ ] **Step 4: 모바일 standalone 링크 추가**

모바일의 4-group 탭 폭을 억지로 5등분하지 않는다. `검색`과 그룹 탭 사이에 별도 `사용방법` 행을 두어 승인된 standalone 메뉴 구조와 44px 터치 영역을 보장한다.

```tsx
<Link href="/guide" onClick={onClose} className="mobile-nav-sheet-guide">
  <span aria-hidden="true">?</span>
  <span>사용방법</span>
  <span aria-hidden="true">›</span>
</Link>
```

CSS는 기존 account/search/line/token을 재사용하고 새 고정 색을 도입하지 않는다.

- [ ] **Step 5: 테스트와 타입 검사**

Run: `npm test -- src/features/shared-navigation/system-guide-navigation.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/features/shared-navigation/mega-nav-data.ts src/features/shared-navigation/mega-nav.tsx src/features/shared-navigation/mobile-nav-sheet.tsx src/features/shared-navigation/mobile-nav-sheet.css src/features/shared-navigation/system-guide-navigation.test.ts
git commit -m "feat: 주 메뉴에 사용방법 진입점 추가"
```

## Task 6: Galaxy S25·인앱 브라우저 회귀 E2E 검증

**Files:**

- Create: `e2e/system-guide-onboarding.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: 공개 가이드와 모바일 메뉴 E2E 작성**

인증 없이도 항상 검증 가능한 시나리오부터 작성한다.

```ts
test('guide page opens the six-step walkthrough manually', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: '사용방법' })).toBeVisible();
  await page.getByRole('button', { name: '처음부터 안내 보기' }).click();
  await expect(page.getByRole('dialog', { name: /사용방법/ })).toBeVisible();
});
```

모바일 메뉴를 열어 `사용방법` 링크를 확인하고 `/guide`로 이동한다.

- [ ] **Step 2: Galaxy S25 viewport와 인앱 UA 시나리오 추가**

Playwright project를 별도로 늘리지 않고 spec 내부 `test.describe`에서 아래를 적용한다.

```ts
test.use({
  viewport: { width: 360, height: 780 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S931N) AppleWebKit/537.36 Mobile Safari/537.36 KAKAOTALK',
});
```

6단계를 오가며 다음을 검증한다.

- dialog bounding box가 viewport 안에 있다.
- 긴 콘텐츠 상태에서 `article.scrollHeight >= article.clientHeight`이며 touch/wheel 후 스크롤 위치가 변한다.
- 배경 body는 열려 있는 동안 잠기고 닫힌 뒤 복구된다.
- 닫은 뒤 reload해도 자동 재오픈되지 않는다.
- 수동 버튼은 다시 연다.

- [ ] **Step 3: 인증 자동 실행 시나리오 추가**

기존 `auth-setup` storageState를 재사용하는 `chromium-auth-guide` project를 `playwright.config.ts`에 추가한다. credentials가 없으면 기존 관례대로 skip한다. 테스트 시작 전에 `page.addInitScript`로 해당 storage key만 제거하고, 로그인 상태에서 첫 진입 자동 실행과 닫기 영속성을 검증한다. 테스트 종료 시 해당 key만 제거하여 다른 스펙에 영향을 주지 않는다.

- [ ] **Step 4: E2E 실행**

Run: `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium`

Expected: 공개/모바일/Galaxy 시나리오 PASS.

Run when test credentials exist: `npx playwright test e2e/system-guide-onboarding.spec.ts --project=chromium-auth-guide`

Expected: 인증 자동 실행 시나리오 PASS. credentials 미설정이면 명시적 skip.

- [ ] **Step 5: 커밋**

```bash
git add e2e/system-guide-onboarding.spec.ts playwright.config.ts
git commit -m "test: 사용방법 온보딩 모바일 회귀 검증"
```

## Task 7: 전체 품질 검증과 배포 준비

**Files:**

- Modify if needed: files touched in Tasks 1-6 only
- Verify: `docs/superpowers/specs/2026-07-13-system-guide-onboarding-design.md`

- [ ] **Step 1: 승인 명세 대조**

아래 체크리스트를 코드와 테스트 결과로 하나씩 확인한다.

- 로그인/회원가입 완료 후 브라우저당 한 번 자동 실행
- 비로그인 자동 실행 없음
- 닫기/완료 후 자동 재실행 없음
- `/guide` 수동 실행은 항상 가능
- 6단계와 모든 링크 일치
- 데스크톱·모바일 사용방법 메뉴
- 기존 색상·레이아웃·폰트 유지
- 화면 밖 모달, 배경 블러만 보이는 상태, Galaxy 터치 스크롤 회귀 없음

- [ ] **Step 2: 전체 자동 검증**

Run: `npm test && npm run test:spec && npm run typecheck && npm run build`

Expected: 모두 exit 0. 이 프로젝트는 CI가 타입 오류를 잡으므로 `typecheck`를 생략하지 않는다.

- [ ] **Step 3: 브라우저 수동 검증**

Run: `npm run dev`

확인 경로:

- Desktop: `/guide`, 헤더 `사용방법`, 로그인 직후 모달
- Mobile 360×780: 햄버거 → `사용방법`, 모달 1~6단계, 내부 스크롤
- Meta/Kakao UA: 외부 링크 쿼리(`?fbclid=test`) 포함 접근, 터치 스크롤, 닫기

DevTools에서 dialog bounding rect가 `top >= 0`, `bottom <= visualViewport.height`인지 확인한다.

- [ ] **Step 4: 최종 diff 검토**

Run: `git status --short && git diff --check && git log --oneline --decorate -8`

Expected: whitespace error 없음, 의도한 파일만 변경, 비밀값/환경파일 없음.

- [ ] **Step 5: 구현 완료 커밋이 필요한 경우만 생성**

검증 과정에서 수정이 발생한 경우에만:

```bash
git add src/features/system-guide src/app/guide/page.tsx src/app/layout.tsx src/features/shared-navigation/mega-nav-data.ts src/features/shared-navigation/mega-nav.tsx src/features/shared-navigation/mobile-nav-sheet.tsx src/features/shared-navigation/mobile-nav-sheet.css src/features/shared-navigation/system-guide-navigation.test.ts e2e/system-guide-onboarding.spec.ts playwright.config.ts
git commit -m "fix: 사용방법 온보딩 검증 보완"
```

- [ ] **Step 6: 리뷰·머지·배포 단계로 인계**

구현이 완료되면 `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, `pr-reviewer`, `superpowers:finishing-a-development-branch`를 순서대로 적용한다. GitHub 명령은 반드시 `./scripts/gh-ganji`를 사용하고, push는 repo-local credential helper를 유지한다. 사용자가 승인한 경우에만 PR 생성·머지·운영 배포까지 수행한다.
