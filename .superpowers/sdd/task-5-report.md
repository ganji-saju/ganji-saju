# Task 5 보고서

## RED

- 명령: `npm test -- src/features/shared-navigation/system-guide-navigation.test.ts`
- 결과: 신규 4개 테스트 중 3개 실패.
- 확인한 결손: `MEGA_NAV` 사용방법 항목/active resolver 없음, 모바일 독립 행 없음, 44px 터치 영역 스타일 없음.

## GREEN

- 명령: `npm test -- src/features/shared-navigation/system-guide-navigation.test.ts && npm run typecheck`
- 결과: 전체 단위 테스트 186개 통과, TypeScript 검사 통과.
- 추가 확인: `git diff --check` 통과.

## 변경 파일

- `src/features/shared-navigation/mega-nav-data.ts`
- `src/features/shared-navigation/mega-nav.tsx`
- `src/features/shared-navigation/mobile-nav-sheet.tsx`
- `src/features/shared-navigation/mobile-nav-sheet.css`
- `src/features/shared-navigation/system-guide-navigation.test.tsx`

## Self-review

- 데스크톱은 기존 `GroupChip` simple 링크 경로를 재사용해 별도 드롭다운을 만들지 않음.
- 모바일은 기존 4개 그룹 탭을 유지하고 검색과 탭 사이에 `/guide` 독립 행 배치.
- 독립 행 `min-height: 44px` 적용.
- CSS는 `--app-line`, `--app-copy`, `--app-pink-*` 기존 토큰만 사용.
- 변경 범위는 Task 5 지정 파일과 본 보고서로 제한.

## 커밋

- `feat: 주 메뉴에 사용방법 진입점 추가`

## 우려사항

- 없음.

## 리뷰 findings 후속 수정

### RED

- 명령: `npm run test:spec -- src/features/shared-navigation/system-guide-navigation.test.tsx`
- 결과: 실제 `MobileNavSheet` portal 렌더에서 `/guide`의 상세 목록 0개로 실패.
- 원인: `initialActiveLabel="사용방법"`인 simple group을 상세 `activeGroup`으로 선택.

### 변경

- 기존 source 문자열 검사를 jsdom 실제 `MegaNavBar`/`MobileNavSheet` 렌더 테스트로 교체.
- 데스크톱 `/guide` accessible 링크 및 hover 시 panel 미노출 검증.
- 모바일 `/guide` href, `onClose`, 검색→사용방법→tablist DOM 순서, 기존 tab 4개 검증.
- 렌더된 `.mobile-nav-sheet-guide`의 computed `min-height: 44px` 검증.
- simple group을 모바일 상세 그룹으로 선택하지 않고 첫 non-simple 그룹인 운세로 fallback.
- 1024~1199px 구간 header/chip/actions 치수 압축 및 중복 진입 가능한 회원가입 CTA 숨김.

### GREEN

- 명령: `npm run test:spec && npm run typecheck && git diff --check`
- 결과: Vitest 20 files / 181 tests 통과, TypeScript 검사 통과, diff whitespace 검사 통과.

### 실제 viewport 검증

- 실행: Playwright Chromium, `/guide`, viewport 1024 / 1100 / 1199px.
- 1024px: header client/scroll width `1024/1024`, logo-nav gap `186px`, nav-actions gap `186px`.
- 1100px: header client/scroll width `1100/1100`, logo-nav gap `220px`, nav-actions gap `220px`.
- 1199px: header client/scroll width `1199/1199`, logo-nav gap `264px`, nav-actions gap `264px`.
- 전 구간 `/guide` 링크 width > 0 및 href `/guide`, signup computed display `none` 확인.

### 후속 커밋

- `fix: 사용방법 메뉴 반응형과 렌더 테스트 보강`

### 후속 우려사항

- 없음.

## Important 회원가입 CTA 유지 수정

### RED

- 명령: `npm run test:spec -- src/features/shared-navigation/system-guide-navigation.test.tsx`
- 결과: 6개 중 1개 실패. 1024~1199px media query의 `.mega-nav-signup { display: none }` 검출.

### 변경

- compact desktop media query에서 회원가입 CTA 숨김 규칙 제거.
- 1024px 대응은 기존 header/chip/action 간격과 치수 압축만 유지.
- 회원가입 CTA 비노출 회귀 테스트 추가.

### GREEN

- 명령: `npm run test:spec && npm run typecheck && git diff --check`
- 결과: Vitest 20 files / 182 tests 통과, TypeScript 검사 통과, diff whitespace 검사 통과.

### 실제 Chromium 측정

- 실행 경로: `/guide`, 비로그인 상태, viewport 1024 / 1100 / 1199px.
- 1024px: header client/scroll `1024/1024`, signup display/width `flex/91px`, guide display/width `block/79px`.
- 1100px: header client/scroll `1100/1100`, signup display/width `flex/91px`, guide display/width `block/81px`.
- 1199px: header client/scroll `1199/1199`, signup display/width `flex/91px`, guide display/width `block/83px`.
- 세 viewport 모두 guide href `/guide` 확인.

### 커밋

- `fix: compact desktop 회원가입 CTA 유지`

### 우려사항

- 없음.
