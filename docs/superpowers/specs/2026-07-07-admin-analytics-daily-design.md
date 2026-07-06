# /admin/analytics — 누적 일별 지표 그래프 (Design)

> 상태: 승인됨(2026-07-07). 다음 단계: writing-plans → 구현.

## Goal
관리자가 **방문자·전환율·유입링크·결제**를 매일 측정·누적해 시계열 **그래프**로 보는 전용 페이지 `/admin/analytics`. 데이터는 100% 자체(first-party) 소스라 정확하고 외부 API 의존이 없다.

## 결정 사항 (사용자 승인)
1. **데이터 소스 = 자체(first-party)**: `site_visits`·`payment_orders`·`payment_funnel_events`. GA4/Vercel은 client-only + 서버 read-back API 없음 + 동의모드로 추정치(부정확) → 미사용.
2. **유입 = referrer + UTM**: `site_visits`에 UTM 컬럼 신설, VisitPing이 landing URL의 utm_*를 수집.
3. **배치 = 새 `/admin/analytics` 페이지** (기존 실시간 `/admin/operations`와 역할 분리).

## Architecture
```
raw(site_visits, payment_orders, payment_funnel_events, admin_user_summary)
   │  (KST 일별 집계: RPC + JS 버킷)
   ▼
buildDailyMetricsRollup(dateKeys)  ──upsert──▶  metrics_daily (일 1행, 누적)
   ▲                                                │
cron /api/admin/metrics/rollup (매시, 최근 3일)      │ (읽기)
backfill (최초 1회, [최초데이터일…오늘])             ▼
                                        GET /api/admin/analytics?days=N
                                                    ▼
                                        /admin/analytics 페이지 (SVG 그래프)
```

## 1. 데이터 모델

### 1-1. 신규 테이블 `metrics_daily` (migration, ⚠️수동 적용)
KST 하루 1행. RLS enable + 정책 0개(deny-all) → service-role 전용(기존 admin 테이블 관례).

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `date_key` | text PK | KST YYYY-MM-DD |
| `visitors` | int | distinct visitor_hash |
| `page_views` | int | 총 PV |
| `new_signups` | int | 그날 가입자 수 |
| `paid_orders` | int | 완료 결제 건수(confirmed/fulfilling/fulfilled) |
| `revenue_won` | bigint | 완료 결제 합계(원) |
| `prepare_attempts` | int | funnel prepare_attempt 수 |
| `checkout_starts` | int | funnel confirm_attempt 수 |
| `confirm_success` | int | funnel confirm_success 수 |
| `inflow_referrers` | jsonb | `[{host, visitors}]` 상위 N |
| `inflow_utm` | jsonb | `[{source, medium, campaign, visitors}]` 상위 N |
| `refreshed_at` | timestamptz | 마지막 롤업 시각 |

**전환율은 저장하지 않고 read 시 파생**: `방문→결제 = paid_orders/visitors`, `결제창 전환 = confirm_success/prepare_attempts`. (0 분모는 null 처리.)

### 1-2. `site_visits` 컬럼 추가 (ALTER)
`utm_source text`, `utm_medium text`, `utm_campaign text` (모두 nullable). 기존 행은 null.

### 1-3. 집계 RPC `metrics_daily_source(from_key, to_key)`
`site_visits`를 서버 group-by 해 per-day 반환: `date_key, visitors, page_views, inflow_referrers jsonb, inflow_utm jsonb`. raw 행을 앱으로 가져오지 않는다(대량일↑ 시 50k cap 회피). 상위 N=10.

## 2. 수집 (UTM — net-new)
- **VisitPing**(`src/components/analytics/visit-ping.tsx`): 기존 `{vid, path, ref}`에 landing URL(`location.search`)의 `utm_source/medium/campaign`를 추가 전송. utm 존재하고 그날 아직 utm 미기록이면(localStorage `moonlight:visit-utm:<dateKey>` 게이트) 방문 ping이 이미 나갔어도 1회 추가 ping 허용.
- **`/api/visit`**(`src/app/api/visit/route.ts`): payload에서 utm 3종 추출(각 ≤120자 sanitize), site_visits upsert. **onConflict (date_key, visitor_hash) 시 기존 utm/referrer_host가 null이면 새 값으로 UPDATE**(같은 날 direct→광고클릭 순서라도 utm 귀속). 값 있으면 first-touch 유지.
- 모델 = **당일 first-touch UTM**. 한계(같은 날 이미 utm 있는 뒤 다른 캠페인 클릭은 미갱신)는 spec에 명시. best-effort·200 always.

## 3. 롤업
### 3-1. 순수 집계 `buildDailyMetricsRollup(dateKeys, deps)` (`src/lib/admin/analytics-rollup.ts`)
각 날짜에 대해 raw에서 계산:
- visitors/PV/inflow: RPC `metrics_daily_source`.
- new_signups: `admin_user_summary.signup_at` KST 버킷 카운트(백필도 가능 — 전 유저 signup_at 보유).
- paid_orders/revenue: `payment_orders` where status∈완료 AND KST(`confirmed_at ?? fulfilled_at ?? created_at`) == day.
- funnel: `payment_funnel_events` stage별 카운트 by KST(created_at).
반환 배열을 `metrics_daily` upsert(by date_key). I/O는 주입형 deps로 분리 → 순수 단위 테스트.

### 3-2. 크론 `/api/admin/metrics/rollup`
- 인증: `CRON_SECRET`(Bearer) + super_admin 수동 트리거(기존 refresh 관례, [reference_cron-and-prod-ops]).
- vercel.json cron 추가: **매시** `0 * * * *` (기존 hourly refresh와 동일 케이던스). 최근 **3 KST일** 재집계(오늘 신선·어제 확정, 멱등 upsert).
- `?backfill=<N>` 또는 `?from=&to=` 파라미터로 과거 구간 백필(최초 1회 super_admin 트리거). 대량일은 청크 처리.

## 4. 페이지
- `src/lib/admin/analytics-metrics.ts`: `getDailyMetrics(windowDays)` — metrics_daily 윈도우 조회, 누락일 gap-fill(연속 date_key), 전환율 파생. 오늘 행이 없거나 stale하면 표기(“{refreshed_at} 기준”).
- `GET /api/admin/analytics?days=30|90|365` — admin 가드, service client.
- `src/app/admin/analytics/page.tsx` (+ dashboard 컴포넌트): 윈도우 선택(30/90/365). 그래프(기존 admin SVG sparkline 패턴을 `MetricsChart`로 확장, 정적 SVG·server component):
  - 방문자·PV / 신규가입 / 결제(매출+건수) / 전환율(방문→결제, 결제창) / 유입 상위 채널(referrer+UTM 표+막대).
- admin 홈(`src/app/admin/page.tsx`)에 링크 추가.

## 5. 마이그레이션·운영 의존성 (⚠️)
- 신규 migration(테이블+ALTER+RPC) `supabase db push` 수동 적용 필요.
- **선결 확인**: 062(site_visits)/065(unique counts)가 prod에 적용돼 있어야 방문자 데이터 존재. 미적용이면 방문자 그래프 공백.
- 백필: 배포+마이그레이션 후 super_admin이 `/api/admin/metrics/rollup?backfill=…` 1회 트리거.

## 6. 테스트
- `analytics-rollup.test.ts`: 주입 raw로 KST 일별 버킷·전환 파생·상위N inflow·완료상태 필터·경계(자정 KST/UTC) 검증(커스텀 러너 스타일).
- `analytics-metrics.test.ts`: gap-fill·전환율 0분모 null·윈도우 경계.

## Scope cut (YAGNI)
- retention/cohort 그래프, GA4/Vercel read-back, hover 툴팁 인터랙션(v1 정적 SVG). active_users는 기존 operations에 있으니 제외(요청 4종 집중).

## 위험/가정
- 방문자 수는 자체 수집 하한(애드블록·JS차단·동의무관하지만 1일1기기 게이트) — GA4보다 완전하나 절대 진실 아님. 라벨에 “자체 집계” 명시.
- migration 수동적용 누락 시 조용한 공백 → 페이지에 “데이터 없음/마이그레이션 확인” 안내.
- UTM 소급 불가(배포 후부터 수집).
