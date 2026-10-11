① **수용** — `src/lib/admin/dashboard-summary.ts:110` 미래 시작은 확장하지 않아 과거 실적 혼입을 막습니다.
② **미흡** — `src/lib/admin/analytics-metrics.ts:169`의 366일 상한과 테스트 변경은 타당합니다. 다만 `src/lib/admin/external-analytics.ts:478`은 여전히 365일입니다. API가 둘을 함께 호출하므로(`src/app/api/admin/analytics/route.ts:84`) 완료된 윤년 조회에서 내부 지표는 366일, 외부 지표는 365일로 범위가 갈라집니다.
③ **수용** — `src/app/admin/page.tsx:482`에서 추적 시작일로 자른 뒤 실제 첫·끝 날짜를 제목에 사용합니다.
④ **수용** — `src/lib/admin/dashboard-summary.ts:199`의 조건부 추가 조회는 기존 판단대로 유지 가능합니다.

**365 선택지·days 영향:** 현재 화면은 달력 선택기입니다(`src/app/admin/analytics/analytics-dashboard.tsx:742`). 365 선택지는 없고 관련 주석만 낡았습니다. API도 `unit/period`만 읽어 `days=365`는 기존부터 무시합니다(`src/app/api/admin/analytics/route.ts:53`). 이번 변경으로 생긴 호환성 회귀는 아닙니다.

정적 검토만 수행했습니다. 수정·DB·네트워크·테스트 실행은 없었으며, 윤년 내부·외부 범위 불일치는 보완이 필요합니다.