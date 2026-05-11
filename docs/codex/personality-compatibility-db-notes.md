# 달빛 성향궁합 DB 설계 노트

## 확인 결과

- DB 방식: Prisma가 아니라 Supabase Postgres 직접 SQL migration 방식입니다.
- migration 위치: `supabase/migrations`
- 현재 컨벤션: 번호 prefix를 붙인 SQL 파일을 순차 적용합니다. 최신 파일은 `020_product_entitlements_paid_snapshots.sql`이고, 이번 작업은 `021_personality_compatibility.sql`로 추가했습니다.
- 기존 핵심 테이블:
  - `profiles`: 로그인 사용자의 기본 생년월일/성별/출생 정보. `user_id`가 PK입니다.
  - `family_profiles`: 저장된 가족/상대 프로필. `id` UUID PK와 `user_id`를 가집니다.
  - `readings`: 사주풀이 결과 저장.
  - `product_entitlements`, `paid_reading_snapshots`: 유료 해금과 재열람 스냅샷.
  - `fortune_feedback`: 오늘운세 피드백. 성향궁합 리포트 피드백과는 별도입니다.
- 중복 테이블 확인:
  - `personality_profiles` 없음.
  - `compatibility_personality_reports` 없음.
  - `report_feedback` 없음.
  - `compatibility_reports`, `saju_charts` 없음.

## 추가한 구조

### `personality_profiles`

성향궁합에서 사용하는 16유형 성향 프로필입니다.

| 필드 | 용도 | 비고 |
| --- | --- | --- |
| `id` | 성향 프로필 ID | UUID |
| `user_id` | 소유 사용자 | `auth.users` FK |
| `profile_id` | 저장된 상대/가족 프로필 연결 | `family_profiles(id)` FK, nullable |
| `type_code` | 16유형 코드 | 공식 검사/진단이 아닌 서비스 내부 성향 선택값 |
| `source` | 입력 출처 | `self_reported`, `moonlight_check` |
| `confidence` | 체크 결과 신뢰도 | 0~1 |
| `answers_json` | 8문항 답변/요약 | JSON object |
| `created_at` | 생성 시각 | `now()` |

`profiles`는 `user_id` 자체가 PK라서 `profile_id` 하나로 `profiles`와 `family_profiles`를 동시에 FK 연결할 수 없습니다. 그래서 이번 MVP에서는 `profile_id`를 `family_profiles(id)`에만 연결하고, `NULL`이면 본인 프로필 또는 비저장/수동 입력 참여자로 해석합니다.

확인 필요: 나중에 본인/가족/비저장 수동 입력을 DB 쿼리에서 명확히 구분해야 하면 `profile_ref_type` 같은 구분 컬럼을 별도 migration으로 추가하는 편이 안전합니다.

### `compatibility_personality_reports`

사주 facts와 성향 facts를 함께 담는 성향궁합 리포트입니다.

| 필드 | 용도 | 비고 |
| --- | --- | --- |
| `id` | 리포트 ID | UUID |
| `user_id` | 소유 사용자 | `auth.users` FK |
| `profile_a_id` | 나의 성향 프로필 | `personality_profiles(id)` FK |
| `profile_b_id` | 상대 성향 프로필 | `personality_profiles(id)` FK |
| `relationship_type` | 관계 유형 | 연인/부부/친구/직장 등 |
| `question_type` | 질문 유형 | 일반/갈등/회복/돈/일 등 |
| `score_json` | 5축 점수 | JSON object |
| `saju_facts_json` | 사주 엔진 facts | JSON object |
| `personality_facts_json` | 성향 facts | JSON object |
| `report_json` | 결과 재열람 스냅샷 | JSON object |
| `product_code` | 상품 코드 | 무료/990원 깊이보기 등 |
| `paid_amount` | 결제 금액 | nullable |
| `created_at` | 생성 시각 | `now()` |

### `report_feedback`

성향궁합 리포트에 대한 사용자 피드백입니다.

| 필드 | 용도 | 비고 |
| --- | --- | --- |
| `id` | 피드백 ID | UUID |
| `report_id` | 성향궁합 리포트 | `compatibility_personality_reports(id)` FK |
| `user_id` | 작성 사용자 | `auth.users` FK |
| `rating` | 평점 | 1~5 |
| `tags_json` | 태그 배열 | JSON array |
| `comment` | 자유 의견 | nullable |
| `created_at` | 생성 시각 | `now()` |

동일 사용자가 동일 리포트에 중복 피드백을 남기지 않도록 `unique(user_id, report_id)` 인덱스를 둡니다.

## RLS 정책

세 테이블 모두 Row Level Security를 켰습니다.

- 사용자는 자기 `user_id`와 일치하는 row만 조회/추가/수정/삭제할 수 있습니다.
- `personality_profiles.profile_id`가 저장된 가족/상대 프로필을 가리킬 때는 해당 `family_profiles.user_id`가 현재 사용자와 일치해야 합니다.
- 리포트와 피드백도 연결된 성향 프로필/리포트가 현재 사용자 소유인지 확인합니다.

## TypeScript 타입

타입 위치: `src/lib/personality-compatibility-types.ts`

포함 타입:

- `PersonalityTypeCode`
- `PersonalityProfileSource`
- `PersonalityRelationshipType`
- `PersonalityQuestionType`
- `PersonalityProfile`
- `CreatePersonalityProfileInput`
- `PersonalityCompatibilityScoreJson`
- `CompatibilitySajuFacts`
- `CompatibilityPersonalityFacts`
- `CompatibilityPersonalityReportContent`
- `CompatibilityPersonalityReport`
- `CreateCompatibilityPersonalityReportInput`
- `ReportFeedback`
- `CreateReportFeedbackInput`

## 이번 단계에서 하지 않은 것

- UI 구현 없음.
- API route 구현 없음.
- 결제 상품 연결 없음.
- `product_entitlements`와의 연결 없음.
- 개인정보처리방침 문구 코드 반영 없음.
- 실제 운영 DB migration 적용 없음.

## 확인 필요

- 개인정보처리방침에 16유형 성향 선택값, 8문항 답변, 궁합 리포트 저장 목적과 보관 기간을 추가해야 합니다.
- `profile_id = NULL`의 의미가 MVP에는 충분하지만, 장기적으로 본인/비저장 상대/임시 입력을 더 명확히 나누려면 구분 컬럼이 필요합니다.
- 990원 깊이보기 상품 코드와 `product_entitlements` scope 규칙은 결제 작업 단계에서 별도 확정해야 합니다.
