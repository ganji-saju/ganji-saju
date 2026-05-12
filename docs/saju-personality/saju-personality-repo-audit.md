# 달빛 성향사주 리포지토리 구조 감사

작성일: 2026-05-11  
작업: `[작업 0] 기존 구조 조사`  
범위: 기존 사주 입력/결과/저장, 기존 성향궁합/성향 모듈, 결제/권한, 저장/재조회, analytics 구조 조사

## 1. Executive Summary

달빛 성향사주는 기존 `달빛 성향궁합`의 2인 관계 로직을 복사하거나 수정하지 않고, 개인 사주 리딩 흐름 위에 `src/domain/personality`의 16유형 선택/8문항 성향 체크를 결합하는 별도 도메인으로 설계하는 것이 안전하다.

재사용 핵심은 세 갈래다.

- 개인 사주 입력/계산/저장은 `src/features/saju-intake`, `src/components/saju/shared/unified-birth-info-fields.tsx`, `src/lib/saju/readings.ts`, `src/domain/saju/engine/saju-data-v1.ts`를 따른다.
- 성향 입력/체크/프로필은 `src/domain/personality`를 재사용한다.
- 결제/권한/재열람은 `src/lib/payments/catalog.ts`, `src/lib/payments/product-scope.ts`, `src/lib/product-entitlements.ts`, `src/lib/payments/paid-reading-snapshots.ts`의 기존 패턴을 따른다.

추천 라우트는 MVP 입력형으로는 `/saju/personality`, 결과로는 `/saju/personality/result`가 가장 자연스럽다. 이미 생성된 사주 리딩에서 바로 성향 해석으로 이어지는 보조 진입은 `/saju/[slug]/personality`로 둘 수 있다. 도메인 코드는 `src/domain/saju-personality/`, 화면 조립은 `src/features/saju-personality/`, API는 `src/app/api/saju/personality/` 아래로 분리하는 것이 좋다.

이번 작업에서는 코드, migration, 결제 로직, 성향궁합 로직을 수정하지 않았다. 단, 현재 워크트리에는 이전 작업으로 보이는 `src/domain/saju-personality`, `src/features/saju-personality`, `src/app/saju/personality`, `supabase/migrations/024_*`, `025_*` 등 미추적/미커밋 파일이 이미 존재한다. 실제 PR 준비 전에는 이 파일들이 의도된 작업 범위인지 별도 확인이 필요하다.

## 2. Existing Saju Flow

### Route

- `src/app/saju/page.tsx`
  - `/saju` alias route이며 현재 `/saju/new`로 redirect한다.
- `src/app/saju/new/page.tsx`
  - 기존 개인 사주 입력 시작 route다.
  - `SajuIntakePage`를 렌더링한다.
- `src/app/saju/[slug]/page.tsx`
  - 무료 사주 결과 route다.
  - `resolveReading(slug)`로 저장 또는 preview 리딩을 불러오고 `buildSajuReport`로 결과 화면을 구성한다.
- `src/app/saju/[slug]/premium/page.tsx`
  - 깊은 사주풀이/연간/월간 유료 결과 route다.
  - lifetime, year-core, monthly-calendar, today-detail 등의 권한을 확인한다.

### Input UI

- `src/features/saju-intake/saju-intake-page.tsx`
  - 기존 사주 입력의 핵심 client component다.
  - 관심 주제, 생년월일, 성별, 태어난 시간, 출생지, 동의 단계를 관리한다.
  - `/api/profile`에서 기존 내 정보와 가족 프로필을 불러오는 구조가 있다.
  - 제출 시 `/api/readings`로 리딩 생성을 요청한다.
  - analytics 이벤트 `saju_start_viewed`, `birth_form_started`, `birth_form_completed`를 사용한다.
- `src/components/saju/shared/unified-birth-info-fields.tsx`
  - 양력/음력, 연월일, 성별, 태어난 시간, 시간 모름, 출생지, 시간 기준 입력 UI다.
  - 신규 성향사주 입력에서도 재사용 가능하다.
- `src/lib/saju/unified-birth-entry.ts`
  - `UnifiedBirthEntryDraft`를 `BirthInput`으로 변환한다.
  - 음력 변환, unknown birth time, 진태양시/야자시/조자시 입력 기준을 처리한다.

### Calculation

- `src/domain/saju/engine/saju-data-v1.ts`
  - 개인 사주 계산의 기준 엔진이다.
  - 신규 기능에서 사주 계산을 새로 만들지 말고 이 결과 또는 기존 `ReadingRecord.sajuData`를 facts 입력으로 받아야 한다.
- `src/domain/saju/report/build-report.ts`
  - 기존 개인 사주 report builder다.
- `src/domain/saju/report/build-grounding.ts`
  - 사주 해석 근거/개인화 context를 만든다.
- `src/domain/saju/report/build-report-scores.ts`
  - 기존 사주 점수/요약 구조 참고 지점이다.

### Storage and Re-read

- `src/app/api/readings/route.ts`
  - `POST`에서 birth input을 검증하고 `createReading`을 호출한다.
  - Supabase 환경이 없거나 비로그인 저장이 불가능하면 preview slug를 반환한다.
  - `DELETE`에서 로그인 사용자의 저장 리딩을 삭제한다.
- `src/lib/saju/readings.ts`
  - `createReading`, `resolveReading`, `getReadingById`, `ensureReadingOwnedByUser`, `deleteReadingForUser`를 제공한다.
  - `readings.result_json`에는 `SajuDataV1`, grounding, KASI comparison, persisted metadata가 들어간다.
- `supabase/migrations/001_initial.sql`
  - `readings` 테이블과 RLS 정책을 만든다.

## 3. Existing Personality Compatibility Flow

### Route and Feature

- `src/app/compatibility/personality/page.tsx`
  - 달빛 성향궁합 입력 route다.
- `src/app/compatibility/personality/result/page.tsx`
  - 달빛 성향궁합 결과 route다.
- `src/features/compatibility/personality-compatibility-input-client.tsx`
  - 관계 유형, 나/상대 생년월일시, 나/상대 성향, 현재 질문을 입력한다.
  - `src/domain/personality`의 16유형/8문항 체크를 재사용한다.
  - `UnifiedBirthInfoFields`와 `/api/profile` 기반 saved profile loading 패턴을 참고할 수 있다.
- `src/features/compatibility/personality-compatibility-input-storage.ts`
  - 성향궁합 입력값을 sessionStorage payload로 다룬다.
- `src/features/compatibility/personality-compatibility-result-client.tsx`
  - 무료 결과, 유료 잠금, 결제 CTA, 공유, AI 상담 CTA, 피드백 이벤트를 처리한다.
- `src/features/compatibility/personality-compatibility-result-builder.ts`
  - 2인 관계형 result view model/share card를 만든다.

### Domain

- `src/domain/compatibility-personality/compatibilityFacts.ts`
  - 사주/성향/질문 facts를 2인 관계 점수 축으로 normalize한다.
- `src/domain/compatibility-personality/compatibilityScore.ts`
  - attraction, stability, communication, conflict risk, recovery 중심의 관계형 점수 엔진이다.
- `src/domain/compatibility-personality/reportSchema.ts`
  - 관계형 무료/유료 리포트 schema다.
- `src/domain/compatibility-personality/promptBuilder.ts`
  - 관계형 prompt builder다.
- `src/domain/compatibility-personality/guardrails.ts`
  - 공식 MBTI/단정 표현/관계 단정 표현을 필터링한다.

주의: 위 `compatibility-personality` 도메인은 2인 관계형 로직이므로 개인 성향사주에 복사하거나 직접 의존하지 않는 것이 좋다. 재사용 가능한 것은 구현 방식과 guardrail 아이디어이며, 점수 축과 리포트 문체는 별도로 설계해야 한다.

## 4. Existing Personality Modules

개인 성향사주에서 가장 재사용 가치가 높은 모듈은 `src/domain/personality`다.

- `src/domain/personality/personality.types.ts`
  - `PersonalityTypeCode`, `PersonalityAxis`, `PersonalityCheckAnswer`, `PersonalityProfile`, `PersonalityTypeProfile`, `PersonalityCommunicationRule` 타입을 제공한다.
- `src/domain/personality/selfCheck.ts`
  - `PERSONALITY_SELF_CHECK_QUESTIONS` 8문항을 제공한다.
  - `calculatePersonalityAxisScores`, `buildPersonalityTypeCode`, `calculatePersonalityConfidence`, `estimatePersonalityType`를 제공한다.
  - 신규 기능에서 “성향 체크”로 그대로 재사용 가능하다.
- `src/domain/personality/typeProfiles.ts`
  - `PERSONALITY_TYPE_PROFILES`, `isPersonalityTypeCode`, `getPersonalityTypeProfile`을 제공한다.
  - 16유형의 title, communicationStyle, relationshipHint, caution copy가 있다.
- `src/domain/personality/communicationRules.ts`
  - 각 성향 축 pole별 선호/주의점을 제공한다.
  - 개인 사주의 관계/일/표현 섹션에서 보조 facts로 활용 가능하다.
- `src/domain/personality/index.ts`
  - 위 모듈의 public export 지점이다.

재사용 원칙:

- “공식 MBTI 검사”가 아니라 “16유형 성향”, “성향 체크”로 표현한다.
- MBTI와 오행을 1:1로 단순 매핑하지 않는다.
- selfCheck answers 원문은 analytics나 공유 카드에 넣지 않는다.

## 5. Payment, Entitlement, Product Code Structure

### Catalog

- `src/lib/payments/catalog.ts`
  - `PAYMENT_PACKAGES`에 모든 결제 상품이 모인다.
  - 상품은 `credits`, `subscription`, `lifetime_report`, `taste_product`로 구분된다.
  - taste product는 `TasteProductId`에 등록되어야 checkout/prepare/confirm 흐름을 탈 수 있다.
  - 현재 워크트리에는 이전 작업 흔적으로 `saju_personality_mini` 관련 import/타입/상품이 보인다. 새 작업을 시작하는 기준 브랜치에서는 이 변경이 이미 의도된 것인지 먼저 확인해야 한다.

### Scope

- `src/lib/payments/product-scope.ts`
  - 상품별 scope policy를 결정한다.
  - 기존 reading 기반 상품은 `reading:*`, `today:*`, `calendar:*`, `year:*`, `lifetime:*` scope를 사용한다.
  - 성향궁합은 `personality-compatibility` kind와 별도 scope를 사용한다.
  - 개인 성향사주는 별도 kind와 prefix가 필요하다.

### Prepare and Confirm

- `src/app/api/payments/prepare/route.ts`
  - 로그인 확인, 상품 존재 확인, `requiresSlug`/`requiresScope` 확인, 중복 구매 확인을 수행한다.
- `src/app/api/payments/confirm/route.ts`
  - Toss 결제 승인 후 코인 적립, subscription 활성화, lifetime entitlement, taste product entitlement, paid snapshot 저장을 처리한다.
- `src/lib/product-entitlements.ts`
  - `getTasteProductEntitlement`, `grantTasteProductEntitlement`, `grantProductEntitlement`를 제공한다.
  - `product_entitlements`와 legacy `credit_transactions` fallback을 함께 다룬다.
- `src/lib/payments/paid-reading-snapshots.ts`
  - 유료 결과 재열람을 위한 snapshot 저장 패턴이다.

권장:

- 성향궁합의 `personality_compatibility_mini`를 재사용하지 않는다.
- 신규 product code는 `saju_personality_mini`처럼 분리한다.
- 읽기 단위가 개인 사주인지, 성향 fingerprint까지 묶는지에 따라 `scope_key`를 먼저 확정한다.

## 6. Existing Report Storage and Re-read Structure

### Personal Saju

- `readings`
  - 개인 사주 원본 리딩 저장소다.
  - `src/lib/saju/readings.ts`가 생성/조회/삭제를 담당한다.
- `paid_reading_snapshots`
  - 유료 상품 구매 시 재열람용 snapshot을 저장한다.
  - `src/lib/account.ts`와 `/my`에서 구매 결과 목록으로 노출된다.

### Personality Compatibility

- `personality_profiles`
  - `supabase/migrations/021_personality_compatibility.sql`에서 생성된다.
  - 사용자 선택 또는 8문항 체크 결과를 저장한다.
  - 개인 성향사주에서도 재사용 가능하나, 저장 정책과 answers_json 범위는 최소화해야 한다.
- `compatibility_personality_reports`
  - 2인 관계형 성향궁합 리포트 전용이다.
  - 개인 성향사주 저장용으로 재사용하지 않는다.
- `report_feedback`
  - 현재 성향궁합 리포트에 FK로 묶여 있다.
  - 개인 성향사주에서 그대로 쓰려면 FK 구조가 맞지 않으므로 별도 feedback table 또는 범용화 설계가 필요하다.

### Profile

- `profiles`
  - 본인 기본 프로필이다.
  - `/api/profile`이 조회/저장을 담당한다.
- `family_profiles`
  - 가족/상대 프로필 저장소다.
  - 성향사주에서는 “기존 프로필 선택” 시 본인 프로필 우선, 필요하면 family profile도 선택 가능하다.

## 7. Analytics Track Structure

- `src/lib/analytics.ts`
  - `trackMoonlightEvent(event, params)`를 제공한다.
  - client에서 `window.dataLayer`와 `moonlight:analytics` custom event로 전송한다.
- `src/lib/analytics-events.ts`
  - 이벤트 이름 registry와 `MoonlightAnalyticsEvent` 타입을 제공한다.
- `src/components/common/tracked-link.tsx`, `src/components/common/tracked-button.tsx`
  - 링크/버튼 단위 tracking helper다.
- 기존 사용 예:
  - 사주 입력: `saju_start_viewed`, `birth_form_started`, `birth_form_completed`
  - 사주 결과: `saju_result_viewed`
  - 결제: `payment_started`, `payment_completed`
  - 성향궁합: `personality_compatibility_viewed`, `personality_type_selected`, `personality_check_completed`, `free_result_viewed`, `paid_unlock_clicked`, `report_shared`

권장:

- 개인 성향사주는 `saju_personality_*` prefix를 사용한다.
- payload에는 `source`, `lifeArea`, `productCode`, `amount`, `reportType`, `channel`, `rating`, `confidence` 정도만 허용한다.
- 이름, 생년월일, 태어난 시간, 성별, 성향 체크 원문, 질문 원문, profile id, paymentKey/orderId는 보내지 않는다.

## 8. Reusable Modules

| 영역 | 재사용 파일 | 재사용 방식 |
|---|---|---|
| 사주 입력 UI | `src/components/saju/shared/unified-birth-info-fields.tsx` | 신규 입력이 필요한 경우 그대로 사용 |
| 사주 입력 변환 | `src/lib/saju/unified-birth-entry.ts` | draft를 `BirthInput`으로 변환 |
| 사주 계산 결과 | `src/lib/saju/readings.ts`, `src/domain/saju/engine/saju-data-v1.ts` | 기존 `ReadingRecord.sajuData`를 facts 입력으로 사용 |
| 사주 결과 빌더 참고 | `src/domain/saju/report/*` | 개인 사주 용어/grounding/facts 구조 참고 |
| 프로필 조회 | `src/app/api/profile/route.ts` | 본인/가족 birth profile 선택 |
| 16유형 선택 | `src/domain/personality/typeProfiles.ts` | type code/profile copy 재사용 |
| 8문항 체크 | `src/domain/personality/selfCheck.ts` | check questions/type estimation 재사용 |
| 성향 대화 규칙 | `src/domain/personality/communicationRules.ts` | 개인 report의 관계/표현 facts 참고 |
| guardrail 아이디어 | `src/domain/compatibility-personality/guardrails.ts` | 개인 사주용 별도 guardrails 설계 시 참고 |
| 결제 상품 | `src/lib/payments/catalog.ts` | 신규 product 등록 위치 |
| 권한 scope | `src/lib/payments/product-scope.ts` | 신규 scope kind/prefix 설계 위치 |
| entitlement | `src/lib/product-entitlements.ts` | 구매/재열람 권한 기준 |
| snapshot | `src/lib/payments/paid-reading-snapshots.ts` | 유료 결과 재열람 패턴 참고 |
| analytics | `src/lib/analytics.ts`, `src/lib/analytics-events.ts` | 이벤트 이름 등록 및 전송 |

## 9. Modules That Must Not Be Modified

이번 기능에서 직접 수정하거나 복사하면 회귀 위험이 큰 영역이다.

- `src/domain/saju/engine/*`
  - 기존 사주 계산 엔진이다. 신규 기능은 결과를 입력 facts로 받아야 한다.
- `src/domain/compatibility-personality/*`
  - 2인 관계형 성향궁합 도메인이다. 개인 성향사주 점수/리포트로 복사하지 않는다.
- `src/features/compatibility/personality-compatibility-*`
  - 성향궁합 입력/결과 화면이다. 개인 기능 구현을 위해 변경하지 않는다.
- `src/app/compatibility/personality/*`
  - 성향궁합 route다. 개인 성향사주 route로 재사용하지 않는다.
- `src/app/api/compatibility/personality/*`
  - 성향궁합 report/entitlement API다. 개인 report 저장용으로 재사용하지 않는다.
- `src/lib/payments/personality-compatibility.ts`
  - 성향궁합 상품 코드/scope helper다. 개인 상품과 혼동하지 않는다.
- `supabase/migrations/021_personality_compatibility.sql`
  - `personality_profiles`는 재사용 가능하지만 `compatibility_personality_reports`는 관계형 전용이다.
- `supabase/migrations/022_personality_compatibility_mini_entitlement.sql`
  - 성향궁합 상품 권한 확장이다. 개인 상품 추가 시 별도 additive migration이 필요하다.

## 10. Recommended Route

MVP 추천 route:

```text
/saju/personality
/saju/personality/result
```

이유:

- 사용자가 기존 프로필을 선택하거나 신규 생년월일시를 입력하는 독립 플로우를 만들기 쉽다.
- `/compatibility/personality`와 의미가 충돌하지 않는다.
- 결과/결제/저장/공유/AI 상담을 개인 사주 도메인 아래로 묶을 수 있다.

보조 route:

```text
/saju/[slug]/personality
```

이유:

- 이미 생성된 사주 결과에서 “성향을 붙여보기”로 바로 이어갈 수 있다.
- reading slug/id를 payment scope와 저장 record에 묶기 쉽다.
- 다만 MVP에서 신규 생년월일시 입력까지 포함한다면 처음부터 필수 route로 만들 필요는 없다.

권장하지 않는 route:

```text
/compatibility/personality/*
```

이 route는 이미 2인 관계형 성향궁합 의미가 강하므로 개인 성향사주에 사용하지 않는다.

## 11. Recommended Domain Structure

도메인:

```text
src/domain/saju-personality/
  index.ts
  sajuPersonality.types.ts
  buildSajuPersonalityFacts.ts
  fusionRules.ts
  scoreWeights.ts
  sajuPersonalityScore.ts
  reportSchema.ts
  promptBuilder.ts
  guardrails.ts
  reportCopy.ts
```

feature:

```text
src/features/saju-personality/
  saju-personality-input-client.tsx
  saju-personality-input-storage.ts
  saju-personality-result-builder.ts
  saju-personality-result-client.tsx
```

route/API:

```text
src/app/saju/personality/page.tsx
src/app/saju/personality/result/page.tsx
src/app/api/saju/personality/reports/route.ts
src/app/api/saju/personality/entitlement/route.ts
```

원칙:

- `src/domain/personality`는 재사용한다.
- `src/domain/compatibility-personality`는 참고만 하고 의존하지 않는다.
- UI/DB/LLM 호출은 도메인 순수 함수와 분리한다.

## 12. Payment Reuse Plan

권장 신규 상품:

```text
product_code: saju_personality_mini
package_id: taste_saju_personality_mini
price: 990
name: 달빛 성향사주 깊이보기
```

재사용 흐름:

- `PAYMENT_PACKAGES`에 taste product로 추가한다.
- `product-scope.ts`에 별도 `saju-personality` kind를 추가한다.
- `/api/payments/prepare`를 통해 로그인, scope, 중복 구매를 확인한다.
- `/api/payments/confirm`에서 기존 `grantTasteProductEntitlement`를 통해 entitlement를 부여한다.
- 구매 후 redirect는 `/saju/personality/result` 또는 `/saju/[slug]/personality` 정책에 맞춘다.

scope 설계 후보:

```text
saju-personality:{readingIdOrSlug}
saju-personality:{readingIdOrSlug}:{personalityFingerprint}
saju-personality:{hashedBirthAndPersonalityAndLifeArea}
```

주의:

- scope에 이름, 생년월일시 원문, 성향 체크 원문을 넣지 않는다.
- `personality_compatibility_mini`와 product code/scope prefix를 공유하지 않는다.
- 프리미엄 멤버십 포함 여부는 정책 확인 필요로 남긴다.

## 13. Storage Reuse Plan

추천:

- `readings`는 개인 사주 원본 리딩으로 재사용한다.
- `personality_profiles`는 성향 profile 저장소로 재사용 가능하다.
- 개인 성향사주 report는 별도 `saju_personality_reports` 테이블을 additive migration으로 만든다.
- `compatibility_personality_reports`는 재사용하지 않는다.

신규 table 후보:

```text
saju_personality_reports
  id
  user_id
  profile_id
  saju_chart_id 또는 reading_id
  personality_profile_id
  report_type
  life_area
  scope_key
  score_json
  saju_facts_json
  personality_facts_json
  fusion_facts_json
  report_json
  product_code
  paid_amount
  created_at
  updated_at
```

개인정보 원칙:

- 이름, 생년월일시 원문, 태어난 시간, 성별을 공유 카드에 넣지 않는다.
- report_json 전체를 외부 공유 payload로 쓰지 않는다.
- 성향 체크 원문 answers는 필요한 경우에도 저장 범위를 최소화하고 analytics에는 보내지 않는다.

## 14. Analytics Reuse Plan

추천 이벤트:

- `saju_personality_viewed`
- `saju_personality_profile_selected`
- `saju_personality_birth_info_completed`
- `saju_personality_type_selected`
- `saju_personality_check_completed`
- `saju_personality_life_area_selected`
- `saju_personality_free_result_viewed`
- `saju_personality_paid_unlock_clicked`
- `saju_personality_payment_completed`
- `saju_personality_report_saved`
- `saju_personality_report_shared`
- `saju_personality_ai_chat_started`
- `saju_personality_feedback_submitted`

허용 payload:

- `source`
- `confidence`
- `lifeArea`
- `productCode`
- `amount`
- `reportType`
- `channel`
- `rating`

금지 payload:

- 이름
- 생년월일
- 태어난 시간
- 성별
- 출생지
- 성향 체크 원문 답변
- 질문 원문
- paymentKey/orderId
- profile id

## 15. Risks

- 현재 워크트리에 성향사주 구현 파일과 migration이 이미 미추적 상태로 존재하므로, 이 작업을 진짜 `[작업 0]`으로 되돌려 진행하려면 기준 브랜치/커밋을 먼저 확인해야 한다.
- 성향궁합 result builder나 score engine을 복사하면 개인 사주가 아니라 관계형 점수/문구가 섞인다.
- 기존 사주 계산 엔진을 수정하면 오늘운세, 기존 사주 결과, 궁합까지 회귀 범위가 커진다.
- 결제 product code를 성향궁합과 공유하면 entitlement 재열람/중복 결제 기준이 꼬일 수 있다.
- profile/personality/check answers는 자기이해 민감 데이터로 볼 수 있어 analytics와 공유에서 제외해야 한다.
- `report_feedback`은 현재 compatibility report에 FK가 묶여 있어 개인 성향사주 feedback으로 바로 재사용하기 어렵다.
- `paid_reading_snapshots`는 reading 기반 snapshot에는 좋지만, 성향 profile/life area까지 포함한 재열람에는 별도 report table이 더 명확하다.

## 16. Next Step

다음 단계는 구현이 아니라 PRD 확정이다.

1. `/saju/personality` 독립 입력 플로우와 `/saju/[slug]/personality` 결과 연계 플로우 중 MVP primary route를 확정한다.
2. `saju_personality_mini` product code, 990원 가격, 멤버십 포함 여부를 정책으로 확정한다.
3. `saju_personality_reports` 저장 범위와 `personality_profiles` 재사용 범위를 확정한다.
4. 개인 성향사주 전용 facts/score/report schema를 설계한다.
5. 이후 `[작업 1]`에서 MVP PRD 문서만 작성한다.
