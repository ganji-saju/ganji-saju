# 요청 — 관리자 대시보드 맨 위 날짜별·주별 표가 한 줄만 보이는 문제

- 사용자 목표: 맨 위로 올린(#951) "날짜별 · 주별 상세" 표가 기본 기간('오늘')에서 한 줄만 보인다. 표만 최근 여러 주를 보여 준다. 상단 카드 기본 '오늘'은 2026-09-01 사용자 결정이라 유지.
- 후보 A(Claude): 브랜치 `feat/admin-daily-table-min-window`, 기준 커밋 main `8e6247bd`. 표 데이터만 max(선택 기간, 28일)로 넓히고 넓혔을 때 제목에 "최근 4주" 표기. 유입 상위는 선택 기간 그대로.
- 진행 방식: Claude 제작 → Codex 읽기 전용 검증(`codex exec --sandbox read-only`) → Claude 반영 → decision.md.
- 검증: tsc, `npm test`(dailyTableDays 단위 테스트), CI·E2E·CodeQL.
