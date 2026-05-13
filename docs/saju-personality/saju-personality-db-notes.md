# 달빛 성향사주 DB 스키마와 TypeScript 타입 설계 노트

작성일: 2026-05-11  
문서 상태: Draft  
작업 범위: additive DB migration, TypeScript 타입, 설계 메모

## 1. 확인 결과

### DB migration 방식

- 현재 리포지토리는 Prisma가 아니라 Supabase SQL migration 방식을 사용한다.
- migration 위치는 `supabase/migrations/*.sql`이다.
- 루트 `prisma` 디렉터리와 `schema.prisma`는 확인되지 않았다.

### 기존 성향 프로필 테이블

- 기존 테이블: `public.personality_profiles`
- 생성 migration: `supabase/migrations/021_personality_compatibility.sql`
- 용도:
  - 16유형 성향 직접 선택 결과 저장
  - 8문항 달빛 체크 결과 저장
  - `source`는 `self_reported`, `moonlight_check`
  - `answers_json`에 체크 응답/요약 메타데이터 저장
- 결론:
  - 개인 성향사주에서도 이 테이블을 재사용한다.
  - 같은 성향 데이터를 위해 새 `personality_profiles` 테이블을 만들지 않는다.

### 기존 사주 chart/report 저장 테이블

- 기존 테이블: `public.readings`
- 생성 migration: `supabase/migrations/001_initial.sql`
- 주요 컬럼:
  - `id`
  - `user_id`
  - `birth_year`
  - `birth_month`
  - `birth_day`
  - `birth_hour`
  - `gender`
  - `result_json`
  - `created_at`
- 코드 재조회 지점:
  - `src/lib/saju/readings.ts`
  - `createReading`
  - `resolveReading`
- 결론:
  - 개인 성향사주는 사주 계산 자체를 새로 만들지 않고 `readings`의 기존 결과를 facts 입력으로 사용한다.
  - 새 테이블의 `saju_chart_id`는 `public.readings(id)`를 참조한다.

### 기존 report_feedback 재사용 가능 여부

- 기존 테이블: `public.report_feedback`
- 생성 migration: `supabase/migrations/021_personality_compatibility.sql`
- 현재 FK:
  - `report_id UUID NOT NULL REFERENCES public.compatibility_personality_reports(id) ON DELETE CASCADE`
- 결론:
  - 현재 구조 그대로는 개인 성향사주 리포트 피드백에 재사용할 수 없다.
  - `compatibility_personality_reports`에 강하게 묶여 있으므로, 개인 성향사주에서 사용하려면 별도 `saju_personality_report_feedback` 테이블을 만들거나, 후속 migration에서 polymorphic/generalized feedback 구조를 설계해야 한다.
  - 이번 작업에서는 피드백 테이블을 추가하지 않았다.

## 2. 추가한 migration

추가 파일:

- `supabase/migrations/024_saju_personality_reports.sql`

추가 테이블:

- `public.saju_personality_reports`

이번 migration은 additive 변경만 포함한다.

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- 신규 테이블 RLS 활성화
- 신규 테이블 policy 생성

이번 migration에서는 아래 작업을 하지 않았다.

- 기존 테이블 drop
- 기존 데이터 delete/truncate
- 기존 컬럼 destructive alter
- 기존 성향궁합 테이블 변경
- 기존 `product_entitlements` check constraint 변경
- 기존 payment 코드 변경

## 3. saju_personality_reports 스키마

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `UUID` | 리포트 ID |
| `user_id` | `UUID` | 소유 사용자. `auth.users` 참조 |
| `profile_id` | `UUID` | 저장된 가족/상대 프로필에서 시작한 경우 `family_profiles.id`. 본인 기본 프로필 또는 신규 입력은 `NULL` |
| `saju_chart_id` | `UUID` | 기존 개인 사주 리딩. `readings.id` 참조 |
| `personality_profile_id` | `UUID` | 기존 성향 프로필. `personality_profiles.id` 참조 |
| `scope_key` | `TEXT` | 리딩, 성향, 관심영역 조합의 비식별 범위 키 |
| `report_type` | `TEXT` | `free` 또는 `paid` |
| `life_area` | `TEXT` | `basic`, `love`, `relationships`, `work`, `money_achievement`, `year`, `today` |
| `score_json` | `JSONB` | 6축 성향사주 점수 |
| `saju_facts_json` | `JSONB` | 기존 사주 엔진 결과에서 추출한 개인 해석 facts |
| `personality_facts_json` | `JSONB` | 16유형 성향 입력/체크 facts |
| `fusion_facts_json` | `JSONB` | 사주 facts와 성향 facts를 결합한 해석 단서 |
| `report_json` | `JSONB` | 무료/유료 화면 재열람용 리포트 스냅샷 |
| `product_code` | `TEXT` | 무료는 `free`, 유료는 후속 결제 상품 코드 |
| `paid_amount` | `INT` | 유료 결제 금액. 무료 또는 미결제는 `NULL` 가능 |
| `created_at` | `TIMESTAMPTZ` | 생성 시각 |
| `updated_at` | `TIMESTAMPTZ` | 수정 시각 |

## 4. RLS 정책

`saju_personality_reports`는 RLS를 활성화한다.

정책:

- 본인 리포트 조회: `auth.uid() = user_id`
- 본인 리포트 추가: `auth.uid() = user_id`
- 본인 리포트 수정: `auth.uid() = user_id`
- 본인 리포트 삭제: `auth.uid() = user_id`

추가/수정 시 참조 무결성 보조 조건:

- `profile_id`가 있으면 현재 사용자의 `family_profiles.id`여야 한다.
- `saju_chart_id`가 있으면 현재 사용자의 `readings.id` 또는 공개 preview 성격의 `user_id IS NULL` 리딩이어야 한다.
- `personality_profile_id`가 있으면 현재 사용자의 `personality_profiles.id`여야 한다.

## 5. 인덱스

추가 인덱스:

- `idx_saju_personality_reports_user_scope`
  - `(user_id, scope_key)` unique
  - 같은 리딩/성향/관심영역 조합의 중복 저장과 중복 결제 연결을 방지하기 위한 기준
- `idx_saju_personality_reports_user_created`
  - 보관함/최근 결과 목록 조회용
- `idx_saju_personality_reports_saju_chart`
  - 특정 사주 리딩 기준 재조회용
- `idx_saju_personality_reports_personality_profile`
  - 특정 성향 프로필 기준 재조회용
- `idx_saju_personality_reports_life_area`
  - 관심영역별 목록 조회용

## 6. TypeScript 타입

추가 파일:

- `src/domain/saju-personality/sajuPersonality.types.ts`
- `src/domain/saju-personality/index.ts`

추가 타입:

- `SajuPersonalityLifeArea`
- `SajuPersonalityReportType`
- `SajuPersonalityScores`
- `SajuPersonalityReport`
- `SajuPersonalityReportSection`
- `SajuPersonalityFacts`
- `PersonalityFacts`
- `FusionFacts`
- `SajuPersonalityReportRecord`
- `CreateSajuPersonalityReportInput`

6축 점수:

- `temperamentScore`
- `choicePatternScore`
- `expressionScore`
- `relationshipStyleScore`
- `workAchievementScore`
- `timingActionScore`
- `totalScore`

점수 기준:

- 모든 점수는 0~100 normalize 값이다.
- `scoreMeaning`은 `higher_means_stronger_self_understanding_signal`로 정의했다.
- 점수는 운명 확정값이 아니라 자기이해 신호의 강도로 해석한다.

## 7. 성향궁합 테이블과의 분리

개인 성향사주에서는 아래 테이블을 리포트 저장용으로 재사용하지 않는다.

- `compatibility_personality_reports`
- `report_feedback`

이유:

- `compatibility_personality_reports`는 2인 관계형 리포트 전용 구조다.
- `report_feedback`은 `compatibility_personality_reports(id)`에 FK로 고정되어 있다.
- 개인 성향사주는 `reading_id`, 개인 성향 facts, 관심영역, 6축 점수 중심이라 저장 의미가 다르다.

재사용하는 테이블:

- `readings`
- `personality_profiles`
- `product_entitlements`는 후속 결제 작업에서 권한 기준으로 재사용 가능
- `paid_reading_snapshots`는 후속 유료 스냅샷 저장 시 참고 가능

## 8. Payment 관련 메모

이번 작업에서는 payment 코드와 product entitlement constraint를 수정하지 않았다.

후속 결제 작업에서 필요한 항목:

- 신규 product code 확정
  - 예: `saju_personality_mini`
- `src/lib/payments/catalog.ts` 상품 추가
- `src/lib/payments/product-scope.ts` scope kind 추가
- `product_entitlements_product_id_check` 확장 migration
- `/membership/checkout` 진입 파라미터 설계
- 결제 성공 후 `saju_personality_reports`와 `paid_reading_snapshots` 중 어디에 paid snapshot을 둘지 확정

## 9. 위험도

이번 migration 위험도는 낮다.

이유:

- 새 테이블만 추가한다.
- 기존 데이터 삭제가 없다.
- 기존 성향궁합 테이블을 변경하지 않는다.
- 기존 사주 엔진/리딩 생성 구조를 변경하지 않는다.
- payment constraint를 건드리지 않는다.

남은 리스크:

- `report_feedback`은 기존 구조 그대로 재사용할 수 없어 후속 설계가 필요하다.
- `profile_id`는 현재 `family_profiles.id`만 참조한다. 본인 기본 프로필은 `profiles.user_id`가 PK라 단일 FK로 함께 표현하기 어렵다.
- `scope_key` 생성 규칙은 아직 구현되지 않았다.
- product code와 entitlement 연결은 후속 결제 작업에서 별도 migration이 필요하다.

## 10. 다음 단계

권장 다음 작업:

1. `src/domain/saju-personality`에 facts builder, score schema, report schema를 추가한다.
2. `scope_key` 생성 규칙을 확정한다.
3. 신규 product code와 entitlement scope 정책을 확정한다.
4. 저장 API 설계 시 `saju_personality_reports`의 RLS 조건과 동일한 소유권 검사를 서버에서도 반복한다.
5. 피드백 기능이 필요하면 개인 성향사주 전용 피드백 테이블 또는 범용 feedback 테이블을 별도 설계한다.
