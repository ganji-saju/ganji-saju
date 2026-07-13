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
- `src/features/shared-navigation/system-guide-navigation.test.ts`

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
