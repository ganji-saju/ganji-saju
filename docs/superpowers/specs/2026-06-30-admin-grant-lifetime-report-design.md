# 관리자 평생리포트 권한 부여 — 설계

> 2026-06-30. 승인된 설계. 관리자(super_admin)가 특정 유저의 특정 사주 결과에 평생리포트(lifetime-report) 권한을 수동 부여.

## 배경 / 제약
- 평생리포트 권한은 **사주 결과(reading) 단위 스코프**: `product_entitlements`에 `product_id='lifetime-report'`, `scope_key='lifetime:{readingKey}'`. readingKey = `toSlug(reading.input)`.
- 부여 함수: `grantLifetimeReportEntitlement(userId, readingKey, { orderId?, paymentKey?, amount? }, legacyKeys?)` (`src/lib/report-entitlements.ts`) — 멱등(upsert).
- 체크 함수: `getLifetimeReportEntitlement(userId, readingKey, legacyKeys?)`.
- 기존 관리자 패턴: `/admin/users/[id]` `환불·운영` 탭에 `GrantCreditsActions`(코인, 현재 차단됨)·`GrantMembershipActions` 카드 + 각 `/api/admin/.../grant` 라우트(super_admin 가드 + `logAdminAccess`). **이 패턴을 미러링.**
- 신규 결제상품·DB 마이그레이션 **없음**(`lifetime-report`는 기존 허용 product_id).

## 구성 단위

### 1. 서버: 유저 결과 목록 조회 — `listUserReadingsForAdmin(userId)`
- 위치: `src/lib/admin/user-readings.ts` (신규).
- `readings` 테이블에서 user_id로 조회(최근순, 상한 예: 50), 각 결과를 `getReadingById`/기존 row→ReadingRecord 매핑으로 `input` 확보 → `readingKey = toSlug(input)`.
- 반환: `Array<{ id: string; readingKey: string; label: string; hasLifetime: boolean }>`.
  - `label`: 이름(있으면) · 생년월일(+시) · 생성일. 예: `홍길동 · 2000-01-15 戌 · 06-20`.
  - `hasLifetime`: `getLifetimeReportEntitlement(userId, readingKey)` 존재 여부(중복부여 방지·효과 확인). 비용 우려 시 best-effort.
- 순수 매핑 부분(row → label)은 테스트 가능하게 분리.

### 2. API 라우트: `POST /api/admin/lifetime-report/grant`
- 위치: `src/app/api/admin/lifetime-report/grant/route.ts` (신규, membership/grant 미러).
- 가드: `getCurrentAdminRole(supabase)` → 미인증 401 / 비-super_admin 403.
- body: `{ userId: string, readingId: string, reason?: string }`.
- 처리:
  1. `getReadingById(readingId)` → 없으면 404/400.
  2. **소유자 검증**: `reading.userId === userId` 아니면 403(타인 결과 부여 차단).
  3. `readingKey = toSlug(reading.input)`.
  4. `grantLifetimeReportEntitlement(userId, readingKey, { amount: 0 })` (멱등; paymentKey 미주입 — 결제 아님).
  5. `logAdminAccess({ actorId, actorRole, action: 'grant_lifetime_report', targetUser: userId, reason, meta: { readingId, readingKey, entitlementId } })`.
  6. (선택) `refreshAdminUserSummaryForUser(userId)`.
- 응답: `{ ok: true, readingKey, entitlementId }` / 실패 `{ ok: false, error }`.

### 3. 감사 enum
- `src/lib/admin/access-log.ts`의 `AdminAction`에 `'grant_lifetime_report'` 추가.

### 4. 클라 컴포넌트: `GrantLifetimeReportActions`
- 위치: `src/app/admin/users/[id]/grant-lifetime-report-actions.tsx` (신규, grant-membership-actions 미러).
- props: `{ role, userId, readings: Array<{id,label,hasLifetime}> }`.
- UI: 결과 드롭다운(이미 보유한 결과는 "✓ 보유 중" 표기) + 사유 input(선택) + "권한 부여" 버튼.
- super_admin 아니면 비활성/숨김(기존 컴포넌트 패턴).
- 클릭 → `POST /api/admin/lifetime-report/grant { userId, readingId, reason }` → 성공 메시지 + 상태 갱신(router.refresh 또는 로컬).
- **readingKey는 클라가 계산/전송하지 않음** — readingId만 전송, 서버 도출.

### 5. 페이지 와이어링
- `src/app/admin/users/[id]/page.tsx` `환불·운영` 탭에 카드 추가: "평생 리포트 권한 부여 (super_admin)" → `<GrantLifetimeReportActions role={role} userId={id} readings={await listUserReadingsForAdmin(id)} />`.
- 결과 목록은 서버 컴포넌트(page)에서 조회해 prop 주입.

## 데이터 흐름
관리자 페이지 로드 → `listUserReadingsForAdmin(userId)` → 드롭다운 → 부여 클릭 → 라우트가 readingId로 reading 재확인·소유자 검증·readingKey 도출 → `grantLifetimeReportEntitlement` → 감사로그 → 유저가 해당 결과의 평생리포트 열람 가능.

## 에러 처리
- 미인증 401 / 비-super_admin 403 / readingId 누락·없음 400·404 / 타인 소유 403 / 부여 실패 500.
- 부여 멱등: 이미 보유 시 그대로 `ok:true`(에러 아님).

## 범위(YAGNI)
- **v1 = 부여만.** 회수(revoke)는 제외(기존 환불 플로우와 별개; 필요 시 후속).
- 결제상품·마이그레이션 없음. PG·금액 미관여(amount:0, 무료 수동 부여).

## 테스트
- 라우트: 비-super_admin 거부 / 미인증 거부 / 타인 소유 readingId 거부 / 정상 부여(readingKey 도출 정확·멱등) / 부여 시 logAdminAccess 호출.
- `listUserReadingsForAdmin`: row→label 매핑 순수함수 + hasLifetime 반영.
- 금지문구 가드: UI 카피 확정문구만('권한 부여'·'보유 중').
- 커밋 Korean + Co-Authored-By.
