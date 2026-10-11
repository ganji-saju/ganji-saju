# Claude 1차 — codex-r1 지적 반영

| Codex 지적 | 판정 | 근거·조치 |
|---|---|---|
| [중간] 미래 기간에 과거 실적 섞임 | 수용 | `resolveAdminPeriod` 가 미래 시작을 endKey=startKey 로 눌러 재현됨(주소 직접 입력 시). `dailyTableDays(period, todayKey)` 가 미래 시작이면 넓히지 않음 + 단위 테스트 |
| [중간·기존] 윤년 1/1 누락(365 상한) | 수용 | `getDailyMetrics` 상한을 `ADMIN_PERIOD_MAX_DAYS`(366)로. 기존 테스트 기대값 365→366 |
| [낮음] 제목 "최근 4주"와 실제 범위 불일치 | 수용 | 제목에 실제 표시 첫~끝 날짜 |
| [낮음] 같은 롤업 테이블 두 번 조회 | 기각(유지) | 짧은 기간일 때만 ≤28행 1회 추가. Codex 도 현 규모에서 합리적이라 봄 |

검증: tsc 통과, `npm test` 종료코드 0, vitest 622 통과.
