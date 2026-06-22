# 진행 기록 — 궁합 990원(compat-reading) 결제 404 인시던트 + 정식 전환 준비

- **기간**: 2026-06-07 ~ 06-08 (KST)
- **프로젝트**: ganji-saju (prod Supabase `bgtzkjxihlbmxehmhtwg`, Vercel `ganji-sajus-projects/ganji-saju`, `ganjisaju.kr`)
- **관련 PR**: [#430](https://github.com/ganji-saju/ganji-saju/pull/430) (버그 수정) · [#431](https://github.com/ganji-saju/ganji-saju/pull/431) (초기화 런북)

---

## 1. 증상
궁합 결과 화면에서 **"990원 · 깊은 궁합 풀이 보기"** 결제 후 **404 "여긴 비어 있는 자리예요"**.
제보 URL: `https://ganjisaju.kr/saju/17tlvmxnestdk/premium?payment=confirmed&plan=premium`
(궁합 결제인데 도착지는 사주 프리미엄 경로 → 사용자가 990원 내고 풀이를 못 받음.)

## 2. 근본 원인 (잠복 버그 2개, 플래그 ON으로 동시 노출)
**트리거**: `COMPAT_PER_COUPLE_PRICING` 플래그가 2026-06-06 프로덕션에 추가(ON)되며 궁합 CTA가
글로벌 `love-question` → per-couple `compat-reading`(slug=커플키)으로 전환.

1. **리다이렉트 누락** — `membership/success/page.tsx`의 `buildTasteProductHref()`에
   `compat-reading` 분기가 없어 `productHref=null` → 폴백 `buildPremiumResultHref('premium', slug)`가
   작동(checkout이 plan 기본값 premium 전달) → **커플키를 사주 slug 자리에 꽂아**
   `/saju/{coupleKey}/premium`로 오라우팅 → 404.
2. **DB 제약 드리프트** — `product_entitlements_product_id_check` CHECK 제약에 `compat-reading`·
   `score-total`이 누락(마이그레이션 038이 #345 전날, #428 이전). 이용권 INSERT가 23514로 거부되고
   `grantTasteProductEntitlement`가 catch하여 legacy(credit_transactions) 폴백 → 접근은 유지되나
   정식 테이블(`product_entitlements`)에는 미적재.

## 3. 조치 타임라인
| 순서 | 조치 | 결과 |
|---|---|---|
| 1 | 라이브 재현으로 근인 2개 특정 | CTA href = `product=compat-reading&slug={커플키}` 확인 |
| 2 | **즉시 완화**: `COMPAT_PER_COUPLE_PRICING` 제거 + 현재 커밋 재배포 | 글로벌 `love-question`(정상 경로) 복귀, 라이브 검증 |
| 3 | **PR #430**: 리다이렉트 헬퍼 추출 + `compat-reading` 분기 + 회귀 테스트 4종 | 867 tests pass, 머지·배포 |
| 4 | **마이그레이션 051**: 제약에 `compat-reading`·`score-total` 추가(NOT VALID) | prod 적용·검증 |
| 5 | per-couple 재가동: 051 적용 후 플래그 ON + 재배포 | 라이브 CTA=compat-reading 복귀 |
| 6 | 실 결제 1건으로 엔드투엔드 검증 | 아래 4절 |

## 4. 엔드투엔드 검증 (신규 커플 `c7qjdepvkrc3`)
- 주문: compat-reading, 990원, `confirmed=true`, `fulfilled=true`
- **이용권 정식 적재**: `product_entitlements` / `compat:c7qjdepvkrc3` ← 051 효과
- 리다이렉트: `…/compatibility/result?source=manual&paid=compat-reading` (404 아님)
- A/B 비교: 051 전 결제 커플 = legacy만 / 051 후 커플 = 정식 테이블 적재

## 5. 환불 분석
- 프로덕션 토스가 **테스트 모드(`test_ck_`)** → 모든 결제 **실청구 없음** → **환불 불필요**.
- 영향: 단일 사용자(`7e188932`), compat-reading 2건. 접근권 보유.

## 6. LLM 비용 전수 감사 (정식 전환 대비)
| LLM 표면 | 키 방식 | 데이터 초기화 시 | 재과금 |
|---|---|---|---|
| 궁합·평생·총평·오행 | 입력 해시(content-addressed, FK 0) | 보존 | ❌ |
| 사주 본풀이·연간 | reading UUID (CASCADE) | readings 보존 시 유지 | ⚠️ readings 삭제 시만 |
| 오늘 프리미엄 | `today_fortune_result_snapshots`(SET NULL 보존) | 보존 | ❌ |
| 타로·꿈 | LLM 호출 없음(결정론) | — | ❌ |
| paid_reading_snapshots | content 캐시서 재조립 | CASCADE 삭제되나 무해 | ❌ |

→ **결제 데이터만 지우면 LLM 재과금 0.** (단 `prompt_version` 변경 시 content 캐시 미스 주의)

## 7. 테스트 결제 초기화 (실행·검증 완료)
- 재무계열 11테이블 전부 0: payment_orders, product_entitlements, paid_reading_snapshots,
  credit_transactions, credit_lots, user_credits, subscriptions, refund_requests,
  payment_webhook_events, processed_credit_payments, payment_funnel_events
- 보존: readings(551), ai_compatibility(4), ai_lifetime(3), ai_total_review(35),
  ai_interpretations(6), ai_yearly(30), today_fortune_snap(5)
- 런북: `docs/ops/reset-test-payments-before-live.sql`

## 8. 정식 전환(go-live) 남은 체크리스트
1. 토스 `live_` 키 교체(`NEXT_PUBLIC_TOSS_CLIENT_KEY`·`TOSS_SECRET_KEY`) → 재배포
2. 토스 라이브 웹훅 URL·시크릿 등록
3. `prompt_version` 유지(캐시 보존)
4. 가격 모델 확인(현재 `COMPAT_PER_COUPLE_PRICING=1`, per-couple 990)
5. 키 교체 후 실결제 1건 확인 → 환불

## 9. 산출물
- 코드: `src/lib/payments/post-payment-redirect.ts`(+test), `src/app/membership/success/page.tsx`
- 마이그레이션: `supabase/migrations/051_product_entitlements_compat_reading_score_total.sql`
- 런북: `docs/ops/reset-test-payments-before-live.sql`
- PR: #430(수정), #431(런북)

---
_작성: Claude Code (Opus 4.8) · 2026-06-08_
