# 가입자 리스트(M1) 핸드오프 런북

> 코드·테스트·타입검사·커밋은 모두 완료(브랜치 `feat/admin-member-list-m1`). 아래는 **사람이 실행해야 하는 단계**(프로덕션 DB 변경·라이브 검증) — 에이전트가 임의로 수행하지 않았다.

## 0. 상태 요약
- 단위 테스트: **172 passing / 0 fail** (`npm test`)
- 타입 검사: **0 errors** (`npm run typecheck`)
- 신규 마이그레이션: `049_admin_user_summary.sql`, `050_admin_access_log.sql` (**미적용** — 아래 1단계)
- 신규 크론: `vercel.json`에 `/api/admin/users/summary/refresh` `0 * * * *` 추가(배포 시 등록)

## 1. 마이그레이션 적용 (수동 — drift 이력 주의)
> **DB 식별:** ganji-saju Supabase ref = **`bgtzkjxihlbmxehmhtwg`**. (Claude에 연결된 Supabase MCP는 무관한 `richdoc-ops`(`trmbkdrzvtolvolchoad`) 프로젝트라 **MCP로 적용 금지** — 반드시 본인 자격증명으로.)

```bash
# (최초 1회) CLI 로그인 + 프로젝트 링크
supabase login
supabase link --project-ref bgtzkjxihlbmxehmhtwg

# 적용 전 로컬 vs 원격 비교(drift 확인)
supabase migration list
# 적용
supabase db push
```
**drift로 `db push`가 history mismatch 오류 시 — 대시보드 SQL Editor 직접 실행(가장 안전):**
1. https://supabase.com/dashboard/project/bgtzkjxihlbmxehmhtwg/sql
2. `supabase/migrations/049_admin_user_summary.sql` 내용 붙여넣기 → Run
3. `supabase/migrations/050_admin_access_log.sql` 내용 붙여넣기 → Run

**검증(SQL Editor 또는 CLI):**
```sql
select to_regclass('public.admin_user_summary'), to_regclass('public.admin_access_log');
-- 둘 다 테이블명 반환(널 아님)이면 성공
```
> RLS는 정책 미생성 = 전면 deny. service_role(서버 데이터레이어)만 접근하므로 앱 사용자에게 노출되지 않음. 적용 후 Supabase advisor로 RLS 경고 없는지 확인 권장.

## 2. 환경변수 확인
- `CRON_SECRET` 설정 여부 확인(기존 `/api/payments/reconcile`가 사용 중이라 이미 있을 가능성 높음). 없으면 Vercel 프로젝트 env에 추가.
- `SUPABASE_SERVICE_ROLE_KEY`(또는 `SUPABASE_SECRET_KEY`) 설정 확인 — 요약 배치·목록 조회가 service_role 사용.

## 3. 최초 요약 테이블 채우기
배포 후(또는 로컬에서 env 갖춘 채) 1회 트리거:
```bash
# 크론 시크릿으로
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://<배포도메인>/api/admin/users/summary/refresh
# 기대: {"ok":true,"processed":<가입자수>,"refreshedAt":"..."}
```
또는 super_admin 세션으로 같은 경로 POST. 이후:
```bash
supabase db execute "select count(*) from admin_user_summary;"   # ≈ 가입자 수
```
> 이후엔 매시간 Vercel Cron이 자동 갱신.

## 4. 라이브 검증 체크리스트 (admin 세션)
- [ ] `/admin/users` 진입 → 빠른검색 + 세그먼트칩 + 필터바 + 목록테이블 + (다음페이지) + CSV 버튼 노출.
- [ ] 정렬 변경(가입일↓/결제액↓/최근활동↓/결제건수↓) → 순서 반영.
- [ ] 필터(회원상태·결제·구독·최소결제액·비활동일·가입경로) 적용 → URL 쿼리스트링 반영·목록 변동.
- [ ] 0건 조합 → 빈상태 카드(필터 초기화) 노출.
- [ ] 다음 페이지 → keyset로 중복 없이 다음 묶음 로드.
- [ ] **admin 역할**: 목록·빠른검색 이메일이 `a***@e***.com`로 마스킹.
- [ ] **super_admin 역할**: 이메일 원본 표시.

## 5. PII·감사 검증
- [ ] super_admin으로 `CSV 내보내기` → 파일에 `email,display_name` 컬럼 포함·이메일 원본.
- [ ] admin으로 `CSV 내보내기` → `email`/`display_name` 컬럼 **없음**(비식별만).
- [ ] export 직후: `supabase db execute "select action, actor_role, meta from admin_access_log order by created_at desc limit 1;"` → `export_csv` 1건 + `meta.pii` 역할별 값.

## 6. LTV 정의 일관성 스폿체크
- [ ] 목록 임의 1명의 LTV ＝ 그 사용자 `/admin/users/[id]` 상세의 결제 합계(`payment.totalSpentWon`). 다르면 `summary-refresh.ts`의 `buildPaymentHistory` 입력을 상세와 재대조.

## 7. 권한 음성 테스트
- [ ] 비로그인 `GET /api/admin/users/list` → **401**.
- [ ] 비admin 계정 → **403**.
- [ ] admin(비super)으로 `/api/admin/users/export` → CSV에 PII 컬럼 없음.
- [ ] 크론 라우트: 잘못된/누락 `Authorization` → **401/403**, 올바른 `Bearer $CRON_SECRET` → 200.

## 8. 배포
- `feat/admin-member-list-m1` → main 머지 시 Vercel 자동 배포 + `vercel.json` 크론 등록.
- **머지 전 1단계(마이그레이션) 선적용**(테이블 없으면 목록/배치 빈 결과·에러). 순서: ① 마이그레이션 → ② 배포 → ③ 최초 refresh 트리거.

## 9. 알려진 한계 / 다음 단계
- LTV·활동 지표는 **매시간 배치** 기준(목록 `기준 …` 배지 표시). 코인·구독·환불가능액 실시간성은 M3 상세에서 라이브 재조회.
- 세그먼트는 M1에서 **프리셋 필터**까지. D7/D30 코호트 잔존율·세그먼트 개요는 **M2**.
- 360 상세 탭 재구성 = **M3**, 운영 쓰기 액션·감사 뷰 = **M4**, 마케팅 동의 수집(C1)·보유기간 정책(C2)은 병행 스펙.
