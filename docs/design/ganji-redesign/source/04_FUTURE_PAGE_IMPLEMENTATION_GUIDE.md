# 미구현 디자인 보드 보관 및 추후 구현 가이드

## 결론
미구현 페이지까지 먼저 생성해도 된다. 단, “완성 기능”이 아니라 **visual shell / design stub**로 만들어야 한다.

## 허용되는 것
- 실제 route 생성
- 디자인 레이아웃/카드/모션/상태 UI 구현
- mock data 사용
- 버튼 disabled 처리
- “준비 중” badge 표시
- 추후 구현에 필요한 API contract 문서화

## 금지되는 것
- 실제 결제 실행
- 실제 회원탈퇴 실행
- 실제 상담 예약 mutation 실행
- 실제 알림 발송
- 실제 개인정보 저장
- 서버 API를 추측으로 생성
- href를 기존과 다르게 변경

## 권장 파일 구조

```txt
src/features/design-stubs/
  pages/
    today-detail-shell.tsx
    tarot-spread-shell.tsx
    taekil-shell.tsx
    appointment-shell.tsx
    pdf-print-shell.tsx
  mock-data/
    today-detail.mock.ts
    tarot-spread.mock.ts
    taekil.mock.ts
  components/
    prepared-page-shell.tsx
    stub-action-button.tsx

docs/design/ganji-redesign/future-pages/
  today-detail.md
  tarot-spread.md
  taekil.md
  appointment.md
  pdf-print.md
```

## future-page 문서 템플릿

```md
# Future Page — <페이지명>

## Source Board
- section:
- board id:
- label:
- source component:
- source file:

## Target Route
- route:
- app file:
- shell component:

## Current Stub Scope
- 구현된 디자인 요소:
- mock data:
- disabled action:

## Required Production Data Contract
- API endpoint:
- query params:
- response shape:
- auth requirement:

## Required Actions
- primary action:
- secondary action:
- analytics event:

## Risk Notes
- 결제:
- 개인정보:
- 의료/법률/투자 단정 표현:
- 회원탈퇴/알림/예약 등 위험 액션:

## 다음 Claude Code 지시문
```
이 페이지를 실제 기능으로 전환해라. 기존 shell component의 디자인은 유지하고, 아래 API/data contract를 연결해라. mock data를 제거하고 loading/error/empty 상태를 추가해라. 위험 액션은 confirmation modal과 서버 검증을 통과한 뒤에만 실행되게 해라.
```
```

## stub route 구현 지시문 예시

```md
`BOARD_MANIFEST.md`에서 아직 구현되지 않은 `<board id>` 보드를 실제 route shell로 만들어라.
기능 구현은 하지 말고, 디자인과 상태 UI만 구현한다.
버튼은 disabled 또는 준비 중 상태로 둔다.
mock data는 `src/features/design-stubs/mock-data`에 분리한다.
추후 구현 문서는 `docs/design/ganji-redesign/future-pages/<name>.md`에 작성한다.
완료 후 build를 실행하고 manifest status를 STUBBED로 바꿔라.
```
