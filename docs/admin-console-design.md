# 관리자 콘솔(Admin Console) 설계 — 2026-06-28

> 목적: 이미 구현된 13개 어드민 섹션을 **하나의 관리자모드로 통합**한다.
> 핵심 진단: 기능은 풍부하나 `/admin` 랜딩·내비게이션이 없어 흩어진 섬 상태.
> 따라서 "신규 기능 개발"보다 **허브 + 내비게이션 + 통합 대시보드**가 1순위.

---

## 1. 현황 인벤토리 (이미 구현된 자산)

### 1.1 인증·권한 (완성도 높음)
| 자산 | 위치 | 비고 |
|---|---|---|
| 레이아웃 가드 | `app/admin/layout.tsx` | 비admin → `/` 또는 `/login` redirect |
| 역할 체크 | `lib/admin-auth.ts` | `getCurrentAdminCheck`(admin 여부) / `getCurrentAdminRole`(admin·super_admin) |
| 화이트리스트 | env `ADMIN_USER_IDS`(=super_admin 부트스트랩) + `admin_users` 테이블 | 5분 TTL 캐시 |
| 감사 로그 | `lib/admin/access-log.ts` | `admin_access_log`, action 12종(view_detail·grant_credit·refund_approve…) |
| PII 마스킹 | `lib/admin/masking.ts`, `detail-view.ts` | admin은 이메일/생일/영수증 가림, super_admin만 노출 |

### 1.2 섹션 13개 + 데이터 소스
| # | 섹션 | 페이지 | 데이터 lib | API | 역할 |
|---|---|---|---|---|---|
| 1 | 운영 지표 | `/admin/operations` | `operations-stats.ts`(OperationsSnapshot) | `/api/admin/operations` | admin |
| 2 | 결제 퍼널 | `/admin/payment-funnel` | `payment-funnel-stats.ts` | `/api/admin/payment-funnel` | admin |
| 3 | LLM 비용 | `/admin/llm-cost` | `llm-cost-stats.ts` | — | admin |
| 4 | 사용자 목록 | `/admin/users` | `user-list.ts`, `user-list-query.ts` | `/api/admin/users/list`,`export` | admin |
| 5 | 사용자 상세 | `/admin/users/[id]` | `user-detail.ts`,`member-extras.ts` | `/api/admin/refund`,`credits/grant` | admin/super |
| 6 | 세그먼트·코호트 | `/admin/users/segments` | `segments-data.ts`,`cohort.ts`,`segments.ts` | — | admin |
| 7 | 후기 모더레이션 | `/admin/reviews` | — | `/api/admin/reviews`,`reviews/moderate` | admin |
| 8 | 약관·정책 | `/admin/policies` | — | `/api/admin/policies` | super(추정) |
| 9 | 푸시 CTR | `/admin/push-ctr` | — | `/api/admin/push-ctr`,`web-push-status`,`push-ab-policy` | admin |
| 10 | 사주 검증 | `/admin/saju-verify` | `sinsal-validation.ts` | `/api/admin/sinsal-validation` | admin |
| 11 | 명리 검증 | `/admin/myungri-validation` | — | — | admin |
| 12 | 사주 피드백 | `/admin/saju-feedback` | — | — | admin |
| 13 | 가중치 튜닝 | `/admin/weight-tuning` | `weight-learning.ts` | `/api/admin/weight-learning` | admin |
| + | 결제 멱등 감사 | — | — | `/api/admin/audits/payment-idempotency` | super |
| + | 디자인 쇼케이스 | `/admin/design/*` | — | — | admin(내부용) |

### 1.3 핵심 KPI(이미 산출됨, OperationsSnapshot)
- **오늘**: 신규가입·DAU·결제건수·충전코인·풀이작성·피드백
- **누적**: 총가입·활성구독·총풀이·총결제·총충전코인
- **만족도**: 표본수·평균(-1~+1)·영역별별점(재물/애정/직업/건강/관계)·적중/부분/빗나감 비율
- **추이**: 14일 일별(가입·결제·DAU·풀이)

---

## 2. 갭 분석 (왜 "관리자모드"가 필요한가)

| # | 문제 | 영향 |
|---|---|---|
| G1 | **`/admin` 랜딩/대시보드 없음**(page.tsx 부재) | 진입점 자체가 없음 — URL 직접 입력해야 함 |
| G2 | **섹션 간 내비게이션 전무** | 13개 섹션이 서로 링크 없이 고립. 발견 불가 |
| G3 | **한눈에 보는 통합 뷰 없음** | 운영/결제/비용/만족도가 각각 다른 페이지에 분산 |
| G4 | **역할별 메뉴 가시성 미통합** | super_admin 전용(정책·환불승인·감사)이 구분 안 됨 |
| G5 | **빠른 액션 동선 없음** | "이 유저에게 코인 지급" 같은 작업까지 클릭이 많음 |

---

## 3. 설계: 관리자 콘솔 정보구조(IA)

```
/admin (NEW 랜딩 대시보드)
├─ [상단] 기간 토글(오늘/7일/14일/30일) + 새로고침
├─ [KPI 카드 그리드] 오늘 신규/DAU/결제/매출코인/풀이/만족도 + 14일 스파크라인
├─ [요약 위젯] 결제 퍼널 전환율 · LLM 비용(오늘/누적) · 활성구독 · 환불 대기건수
├─ [빠른 액션] 사용자 검색 → 상세 · 후기 모더레이션 대기 · 정책 미게시 알림
└─ [섹션 바로가기 그리드] 13개 섹션 카드(역할별 노출)

공통 레이아웃(layout.tsx 확장)
└─ 좌측/상단 내비게이션(역할 인지) — 모든 /admin/* 페이지에 영속
   ├─ 개요(/admin)
   ├─ 운영·분석: 운영지표 · 결제퍼널 · LLM비용 · 세그먼트
   ├─ 사용자: 목록 · 세그먼트
   ├─ 콘텐츠·품질: 후기 · 사주검증 · 명리검증 · 사주피드백 · 가중치
   ├─ 운영도구: 푸시 · (super)정책 · (super)결제감사
   └─ [super_admin 전용 배지 표시]
```

### 3.1 역할 모델 (2단계 유지)
- **admin**: 조회·분석·후기 모더레이션·검증. PII 마스킹.
- **super_admin**: + 환불 승인·코인 지급·정책 게시·결제 감사·PII 원문.
- 내비/대시보드 위젯은 `role`에 따라 조건부 렌더(서버에서 결정).

---

## 4. 데이터 모델 (대부분 재사용, 신규 최소)

| 위젯 | 데이터 출처 | 신규 여부 |
|---|---|---|
| KPI 카드(오늘/누적/만족도/추이) | `buildOperationsSnapshot()` | ✅ 재사용 |
| 결제 퍼널 전환율 요약 | `buildPaymentFunnelSnapshot()` | ✅ 재사용 |
| LLM 비용 요약 | `llm-cost-stats` aggregate | ✅ 재사용 |
| 환불 대기건수 | `refund_requests` status='requested' count | ⚠️ 신규 count 1개 |
| 후기 모더레이션 대기 | 미승인 review count | ⚠️ 신규 count 1개 |
| 정책 미게시 알림 | 활성 PolicyVersion 부재 kind | ⚠️ 신규 count(선택) |
| 섹션 메뉴 정의 | 정적 config(`lib/admin/nav.ts` 신규) | ⚠️ 신규 정적 |

→ **신규 데이터는 "대기건수 카운트" 3개뿐**. 나머지는 기존 스냅샷 조립.

---

## 5. 기능 우선순위

### P0 — 관리자모드의 본체(이번 작업 권장 범위)
1. **`/admin` 랜딩 대시보드** — 기존 스냅샷(운영+퍼널+LLM) 통합 + KPI 카드 + 섹션 바로가기 그리드
2. **영속 내비게이션**(layout.tsx 확장) — 역할 인지, 13개 섹션 그룹핑
3. **역할 기반 메뉴 가시성** — super_admin 전용 배지/숨김
4. **빠른 액션** — 대시보드에서 사용자 검색 바 + 대기건수 카드 → 해당 섹션 딥링크

### P1 — 운영 편의(후속)
5. 대기건수 알림(환불/후기/정책) 실데이터 연결
6. 대시보드 기간 토글(오늘/7/14/30일) 상태 연동
7. `admin_access_log` 최근 활동 피드(누가 뭘 했나) 위젯

### P2 — 신규(필요 시)
8. CSV 일괄 내보내기 허브, 알림 발송 콘솔, A/B 정책 관리 UI 고도화

---

## 6. 구현 계획(P0)

| 단계 | 파일 | 내용 |
|---|---|---|
| 1 | `lib/admin/nav.ts`(신규) + 테스트 | 섹션 메뉴 정의(라벨·경로·역할·그룹) 순수 config + 역할 필터 함수 |
| 2 | `app/admin/layout.tsx`(확장) | 가드 유지 + 역할 조회 + `<AdminNav role=…>` 영속 렌더 |
| 3 | `components/admin/admin-nav.tsx`(신규) | 클라이언트 내비(현재 경로 하이라이트, 그룹 접기) |
| 4 | `lib/admin/dashboard-summary.ts`(신규) | 기존 스냅샷 3종 + 대기건수 묶어 1 호출 |
| 5 | `app/admin/page.tsx`(신규) | 랜딩 대시보드(KPI 카드·요약 위젯·섹션 그리드·검색바) |
| 6 | 회귀 테스트 | nav 역할 필터·dashboard-summary 조립 단위 테스트 |

검증: 각 단계 `tsc` + `next build`(client/server 경계) + `npm test`. PR 분할 가능(① nav+layout, ② 랜딩 대시보드).

---

## 7. 비범위(이번에 안 함)
- 개별 섹션 페이지 내부 로직 재작성(이미 동작) — 링크만 연결
- 신규 분석 지표 발명 — 기존 KPI 재사용 우선
- 디자인 쇼케이스(`/admin/design/*`) 메뉴 정식 편입(내부용이라 하단 분리)
