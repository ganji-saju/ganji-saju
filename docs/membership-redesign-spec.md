# 프리미엄 멤버십 재설계 스펙 — 2026-06-28

> 사용자 지시: 프리미엄 멤버십 **월 49,000원**(월 구독) · **매월 90코인** + 혜택 **실제 집행(전체)**:
> 매일 대화 5건 무료 · 궁합 월 3회 무료 · 가족 사주 5명. 멤버십 페이지·메가 배너 동기화.

## 0. 현황(조사 결과)
- `membership_premium`(catalog.ts): 월 9,900원 → 실제 제공 = 월 10코인뿐. 혜택 카피 미집행.
- 구독: `subscriptions`(status/plan=premium_monthly/renews_at +30d/toss_billing_key). 코인은 결제 fulfillment 시 `pkg.credits` 지급.
- 대화: `AI_CHAT_FREE_TURNS=3`(평생 첫 3턴), 이후 3턴=3코인. `getAiChatTurnPlan(successfulTurns)`.
- 궁합: `getTasteProductEntitlement(user,'love-question')` 보유 시 무료, 아니면 990/코인 결제.
- 가족: `family_profiles` 테이블 존재(profile.ts). 현재 명시적 한도 없음(파악된 enforce 없음).

## 1. ⚠️ 선결 블로커 — 정기과금(매월 49,000원·90코인)
현재 `activateMembershipSubscription`은 결제 시 renews_at +30d 연장 + 1회 코인 지급. **매월 자동 재청구 + 매월 코인 재지급하는 활성 cron/webhook 이 확인되지 않음**(toss_billing_key 저장은 됨).
→ "매월 90코인"을 실제로 주려면:
  - (A) Toss billingKey 정기결제 cron(매월 청구 성공 시 90코인 grant) 신설, 또는
  - (B) 월 1회 코인 grant cron(구독 active 인 유저에 매월 90코인), 또는
  - (C) MVP: 결제(또는 갱신) 시 90코인 1회 + 다음 청구 때 재지급(정기결제 동작 전제).
  **결정 필요**: 정기결제가 실제 동작 중인지 + 매월 코인 grant 방식.

## 2. 멤버 판별 헬퍼 (모든 게이트 공통)
`isPremiumMember(userId): Promise<boolean>` = `getManagedSubscription` 의 plan==='premium_monthly' && status==='active' && !expired. lib/subscription.ts 에 추가. 캐시 불필요(요청당 1쿼리) 또는 account 흐름서 재사용.

## 3. 혜택 쿼터 시스템 (신규)
공통: 사용량 추적 테이블 `membership_benefit_usage(user_id, benefit, period_key, used_count, updated_at)` (PK user_id+benefit+period_key). period_key = 일('YYYY-MM-DD' KST) 또는 월('YYYY-MM'). RPC `consume_member_benefit(user, benefit, period_key, limit)` → 한도 내면 +1 후 true, 초과 false(원자적). 멤버 아닐 때는 호출 안 함.

### 3-1. 매일 대화 5건 무료 (benefit='dialogue_daily', 일 단위, limit 5)
- `getAiChatTurnPlan` 또는 빌링 결정부에서: 멤버면 그날 무료 5턴까지 cost=0(평생 3턴과 별개로 멤버 일일 5턴). 5턴 소진 후 기존 코인 과금.
- ai-chat-access.ts 빌링 + ai/route.ts 차감 직전 게이트. 멤버 daily usage 조회/소비.

### 3-2. 궁합 월 3회 무료 (benefit='compat_monthly', 월 단위, limit 3)
- 궁합 진입(compatibility/input·result, prepare) 게이트: 멤버 && 이번 달 3회 미만 → 무료 통과(엔타이틀먼트 동등 취급), 소비 +1. 초과 시 기존 결제 흐름.

### 3-3. 가족 사주 5명 (benefit='family_slots', 슬롯=영구 max 5)
- 기간 무관 "보유 슬롯" 개념. family_profiles INSERT(/api/profile) 시 멤버는 max 5, 비멤버는 기존 정책(현재 한도 확인 후 결정 — 비멤버 0~1 등). count 기반 게이트(usage 테이블 불필요).

## 4. 가격·코인·카피 동기화
- catalog.ts `membership_premium`: price 9900→49000, credits 10→90.
- PLAN_BLUEPRINT(moonlight.ts) premium: price '월 49,000원', features=['매월 90코인 자동 충전','매일 대화 5건 무료','궁합 월 3회 무료','가족 사주 5명','평생 리포트 별도'], opens 동기화. badge 유지/수정.
- 멤버십 페이지(featuredPlan.opens 렌더) 자동 반영.
- 메가 배너: 사주/대화 c3 는 멤버십과 무관(현행 유지) — 멤버십 별도 진입(멤버십 메뉴) 카피만 점검.

## 5. 시퀀싱(중요) — 가격↑은 혜택 집행과 함께
혜택 미집행 상태로 49,000원 먼저 올리면 "비싼데 혜택 없음"이 됨. 따라서:
- Phase 1: 멤버 헬퍼 + usage 테이블/RPC(migration) + 3 게이트 구현(가격 미변경, 멤버 0명이라 무영향).
- Phase 2: 정기결제·월 코인 grant 확정(블로커 1 해소).
- Phase 3: 가격 49,000·코인 90·카피 동기화 동시 반영(혜택 라이브 상태에서 가격 전환).
각 Phase 별도 PR + tsc/next build/test/CI/E2E.

## 6. 마이그레이션
- `membership_benefit_usage` 테이블 + `consume_member_benefit` RPC(SECURITY DEFINER, 원자적 upsert).
- 적용은 supabase CLI 수동(메모리: drift 이력). RLS: service_role only(서버 게이트 경유).

## 7. 열린 질문
1. **정기결제 실태**: Toss billingKey 월 자동청구가 실제 도는가? 아니면 수동 갱신? (블로커 1)
2. **비멤버 가족 슬롯**: 현재 비멤버 한도(0/1/제한없음)? 멤버 5명과의 차등 기준.
3. **매일 5턴 vs 평생 3턴 관계**: 멤버는 일일 5턴(매일 리셋) 단독? 비멤버 평생 3턴은 유지.
4. 기존 9,900원 구독자(있다면) 가격 전환 처리(grandfather?).
