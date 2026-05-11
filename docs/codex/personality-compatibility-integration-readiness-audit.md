# 성향궁합 feature 브랜치 main 통합 배포 전 Integration Readiness Audit

작성일: 2026-05-11
대상 브랜치: `feature/personality-compatibility`
통합 대상: `origin/main`

## 1. 결론

현재 브랜치는 `origin/main`에 완전히 병합하는 통합 PR로 진행할 수 있는 상태에 가깝다. `origin/main`이 현재 브랜치의 조상이라 Git merge 충돌 가능성은 낮고, lint/typecheck/test/build/smoke는 통과했다.

다만 이 PR은 달빛 성향궁합 MVP만 포함하는 PR이 아니라 선행 리팩터, 라우트 정리, 홈/사주/오늘운세 리팩터, 검증 스크립트, 레이아웃 산출물까지 포함하는 통합 PR이다. 따라서 배포 전에는 DB migration 적용, 운영 Vercel env 확인, 실제 결제 sandbox, 로그인 기반 재열람, 모바일 화면 QA를 사람 검수로 완료해야 한다.

최종 판정: 조건부 Go

조건:
- 남은 문서 변경을 커밋해 워킹 트리를 clean 상태로 만든다.
- Supabase migration `021`~`023`을 staging 또는 운영과 동일한 환경에서 적용 검증한다.
- 운영 결제에서 `taste_personality_compatibility_mini` / `personality_compatibility_mini` 990원 플로우를 sandbox로 확인한다.
- 실제 브라우저에서 입력, 무료 결과, 결제 후 유료 결과, 저장/재조회, 공유 카드 화면을 확인한다.

## 2. Git 통합 상태

| 항목 | 결과 |
| --- | --- |
| 현재 브랜치 | `feature/personality-compatibility` |
| HEAD | `cdead3b` |
| `origin/main` | `e9e3b62` |
| merge-base | `e9e3b62ba7ffcdd84f2d274eae61f4a2040c071d` |
| `origin/main`이 HEAD의 조상인지 | 통과 |
| dry-run merge conflict marker 검색 | 통과 |
| 변경 규모 | 163 files, 24,982 insertions, 6,510 deletions |

현재 브랜치는 `origin/main`에서 갈라진 뒤 main이 추가로 앞서가지 않은 상태다. 따라서 PR merge 자체는 fast-forward 또는 일반 PR merge 모두 충돌 가능성이 낮다.

주의:
- 현재 워킹 트리에 문서 수정이 남아 있다.
- PR 전 `git status --short`가 clean인지 확인해야 한다.
- 이 브랜치는 MVP-only가 아니라 선행 리팩터 포함 통합 브랜치다.

## 3. 변경 범위 분류

### 달빛 성향궁합 직접 범위

- `src/domain/personality/**`
- `src/domain/compatibility-personality/**`
- `src/features/compatibility/personality-compatibility-*`
- `src/app/compatibility/personality/**`
- `src/app/api/compatibility/personality/**`
- `src/lib/personality-compatibility-types.ts`
- `src/lib/payments/personality-compatibility.ts`
- `supabase/migrations/021_personality_compatibility.sql`
- `supabase/migrations/022_personality_compatibility_mini_entitlement.sql`
- `supabase/migrations/023_personality_compatibility_report_scope.sql`
- 성향궁합 결제, 저장, 공유, 이벤트 관련 catalog/product-scope/analytics 수정

### 통합 PR로 함께 들어가는 선행 변경

- `AGENTS.md`
- `scripts/preflight-check.mjs`, `scripts/smoke-test.mjs`, `scripts/verify-imports.mjs`, `scripts/build-clean.mjs`
- `next.config.ts` redirect/env/turbopack root 설정
- 홈 섹션과 구형 navigation/header 삭제
- 사주 리포트 빌더 리팩터
- 오늘운세 빌더 리팩터
- `layout/**` 디자인 산출물과 zip 파일
- 여러 placeholder `.gitkeep` 삭제와 legacy route redirect 정리

이 범위는 의도된 통합 배포라면 괜찮지만, PR 본문에는 “선행 리팩터 포함 통합 PR”이라고 명시해야 한다.

## 4. 실행한 검수 명령

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `git fetch origin` | 통과 | sandbox 제한으로 escalated 실행 |
| `git merge-base --is-ancestor origin/main HEAD` | 통과 | `origin/main`이 HEAD의 조상 |
| `git merge-tree $(git merge-base origin/main HEAD) origin/main HEAD` conflict marker 검색 | 통과 | `CONFLICT`, conflict marker 없음 |
| `npm run lint` | 통과 | `verify:imports` 6/6 |
| `npm run typecheck` | 통과 | TypeScript 오류 없음 |
| `npm test` | 통과 | 166 tests passed + node tests 5 pass |
| `npm run build` | 통과 | Next build 성공, 123 static pages |
| `npm run preflight` | 통과 with warnings | uncommitted docs, `src/proxy.ts` warning |
| `vercel env ls` | 통과 | env 이름만 확인, 값은 확인하지 않음 |
| `npm run start` | 통과 | sandbox 포트 제한으로 escalated 실행 |
| `npm run smoke` | 통과 | 20/20 route 응답 정상 |
| 성향궁합 route/API HTTP check | 통과 | 상세 결과 아래 참고 |
| `supabase db lint --local` | 실패 | local Supabase DB `127.0.0.1:54322` 미기동 |
| `supabase migration list --linked` | 실패 | `SUPABASE_ACCESS_TOKEN` 없음 |

성향궁합 전용 HTTP 확인:

| 경로 | 상태 |
| --- | --- |
| `/compatibility/personality` | 200 |
| `/compatibility/personality/result` | 200 |
| `/api/compatibility/personality/entitlement` | 400, scope 없음 정상 거절 |
| `/api/compatibility/personality/entitlement?scope=personality-compatibility:test` | 200 |
| `/api/compatibility/personality/reports?id=test` | 401, 미로그인 정상 거절 |

## 5. Supabase Migration 점검

추가 migration:

| 파일 | 역할 | 정적 점검 |
| --- | --- | --- |
| `021_personality_compatibility.sql` | `personality_profiles`, `compatibility_personality_reports`, `report_feedback` 생성, RLS, index, policy 추가 | 구조 확인 |
| `022_personality_compatibility_mini_entitlement.sql` | `product_entitlements_product_id_check`에 `personality_compatibility_mini` 추가 | 기존 020 제약 확장 확인 |
| `023_personality_compatibility_report_scope.sql` | `compatibility_personality_reports.scope_key` 추가, `(user_id, scope_key)` unique index | 저장/재조회 scope 기준 확인 |

정적 확인 결과:
- 신규 테이블은 RLS가 켜져 있다.
- 본인 `user_id` 기준 SELECT/INSERT/UPDATE/DELETE policy가 있다.
- `personality_profiles.profile_id`는 `family_profiles(id)`에만 연결되며 본인 소유 검사가 있다.
- `compatibility_personality_reports`는 본인 소유 성향 프로필만 연결할 수 있게 검사한다.
- `product_entitlements` check constraint는 기존 `today-detail`, `monthly-calendar`, `love-question`, `money-pattern`, `work-flow`, `year-core`, `lifetime-report`에 새 상품을 추가하는 형태다.

남은 확인:
- 로컬 Supabase DB가 떠 있지 않아 `supabase db lint --local`은 실패했다.
- remote migration 상태는 Supabase access token이 없어 확인하지 못했다.
- 배포 전 staging 또는 운영과 동일한 DB에서 `021`~`023` 적용 테스트가 필요하다.
- `report_feedback`은 범용 이름이므로 향후 다른 리포트 피드백 테이블과 충돌할 수 있다. 현재 repo 내 중복은 발견되지 않았다.

## 6. Vercel Env 점검

`vercel env ls`로 환경변수 이름을 확인했다. 값은 노출하지 않았다.

Production에 확인된 핵심 변수:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Toss: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_INTERPRET_MODEL`
- KASI: `KASI_SERVICE_KEY`
- Site/Web Push: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`

주의:
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `OPENAI_*`, `SUPABASE_SERVICE_ROLE_KEY`는 Preview와 Production에 있다.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`는 env 목록상 Production 중심으로 보인다.
- Preview 배포에서 로그인/DB 기반 QA를 하려면 Preview에도 Supabase public URL/key가 필요할 수 있다.

## 7. 결제/권한 점검

상품:

| 항목 | 값 |
| --- | --- |
| package id | `taste_personality_compatibility_mini` |
| product code | `personality_compatibility_mini` |
| 가격 | 990 |
| 상품명 | `달빛 성향궁합 깊이보기` |
| scope 필요 여부 | `requiresScope: true` |
| 멤버십 포함 정책 | `not_included` |

확인한 흐름:
- `catalog.ts`에 taste product로 등록되어 있다.
- `confirmation.ts`에서 scoped 상품은 `scope`가 없으면 승인 payload를 거절한다.
- `product-scope.ts`에서 성향궁합 상품은 caller-provided scope를 entitlement scope로 사용한다.
- `/api/payments/prepare`는 기존 entitlement가 있으면 중복 결제를 막고 결과 화면으로 돌려보낸다.
- `/api/payments/confirm`은 Toss 승인 후 `grantTasteProductEntitlement`로 권한을 부여한다.
- `/api/compatibility/personality/entitlement`는 `product_entitlements`와 멤버십 정책을 함께 확인한다.
- `/api/compatibility/personality/reports`는 paid 저장 시 entitlement 또는 포함 멤버십이 없으면 403을 반환한다.

중요 리스크:
- 현재 유료 섹션 내용은 client-side 결과 빌더에서 생성된 뒤 UI에서 권한에 따라 숨겨지는 구조다.
- 일반 UI와 저장 API 기준으로는 결제 전 `paidSections`가 노출되지 않지만, 실제 고가치 유료 콘텐츠나 LLM 생성 상세 리포트로 확장할 때는 paid section 생성 자체를 서버 권한 확인 뒤로 옮기는 편이 안전하다.
- MVP mock/정적 상세 카피 수준에서는 허용 가능하지만, 운영 보안 기준으로는 “UI hide only”가 장기 구조가 되면 안 된다.

## 8. 기존 플로우 회귀 점검

자동 smoke에서 확인한 주요 경로:
- 홈
- 오늘운세
- 사주 시작
- 기존 궁합
- 기존 궁합 입력
- 타로
- 멤버십
- 가격
- 로그인
- 개인정보처리방침
- 이용약관
- 알림 설정
- My redirect
- legacy redirect: `/about-engine`, `/gunghap`, `/today`, `/vault`
- Geo API
- Today Fortune API
- Interpret API

남은 수동 QA:
- 기존 사주 입력부터 결과 저장까지 실제 브라우저 확인
- 기존 궁합 `/compatibility/input`에서 결과 생성 확인
- 로그인 사용자의 My page, billing, profile 확인
- 실제 Toss sandbox 결제 성공/실패/취소 확인
- 성향궁합 paid 결제 후 재열람 확인
- 모바일 폭에서 입력 단계와 결과 카드 확인

## 9. 개인정보와 Analytics 점검

확인 결과:
- 성향궁합 analytics payload는 `relationshipType`, `resultType`, `productCode`, `amount`, `source`, `profileSlot`, `inputMode`, `shareMethod`, `feedbackValue` 등만 사용한다.
- 이름, 생년월일, 태어난 시간, 성별, 상대 개인정보는 analytics payload에 넣지 않는다.
- 공유 카드는 관계 키워드, 끌림/소통/회복 요약, 오늘의 한마디, 브랜드, 다시 보기 링크만 포함한다.
- 공유 키워드에서 16유형 코드처럼 보이는 키워드는 필터링한다.
- 저장 API는 `rawBirthInputStored: false` 메타를 사용하고, 공유 카드에는 원본 생년월일시를 노출하지 않는다.

주의:
- 결과 화면 자체는 본인 확인용으로 이름, 성향 유형, birth summary를 보여준다. 사용자가 화면 캡처를 공유하면 개인정보가 포함될 수 있다.
- `compatibility_personality_reports`에는 사주 facts, 성향 facts, score/report snapshot이 저장된다. 개인정보처리방침에 성향 유형, 성향 체크 응답, 관계 질문, 관계 리포트 저장 항목을 반영해야 한다.
- scope key는 원본 입력 fingerprint를 해시한 값이지만 cryptographic secret으로 취급하면 안 된다.

## 10. 금지 표현과 단정 표현 점검

검색어:
- 공식 MBTI
- MBTI 검사
- MBTI 진단
- MBTI 심리검사
- 심리검사
- 무조건
- 반드시
- 절대
- 최악
- 파멸
- 헤어진다
- 결혼한다
- 재회한다

결과:
- 성향궁합 사용자 노출 범위에서는 guardrail replacement와 test fixture 외 유의미한 노출을 찾지 못했다.
- `guardrails.ts`는 금지 표현을 감지하고 완화 표현으로 치환한다.
- `reportPrompt.test.ts`의 금지 표현은 guardrail 테스트 fixture다.

## 11. 배포 순서 제안

1. 현재 문서 변경을 커밋한다.
2. `git status --short`가 clean인지 확인한다.
3. `git fetch origin` 후 `origin/main` 기준이 최신인지 확인한다.
4. PR 본문에 “선행 리팩터 포함 통합 PR”이라고 명시한다.
5. staging 또는 운영과 같은 Supabase DB에서 migration `021`~`023` 적용을 먼저 검증한다.
6. Preview에서 Supabase public env가 필요한지 확인하고, 필요하면 Preview env를 보강한다.
7. Preview 배포 후 자동 smoke와 수동 E2E를 수행한다.
8. Toss sandbox에서 990원 결제 성공/실패/취소를 확인한다.
9. Production DB에 migration `021`~`023`을 적용한다.
10. PR을 merge하고 production deploy를 진행한다.
11. 배포 직후 `/compatibility/personality`, `/compatibility/personality/result`, 결제 성공 callback, 재열람 API를 확인한다.
12. Supabase logs, Vercel function logs, Toss 결제 로그를 30분 이상 모니터링한다.

## 12. 롤백 전략

### 코드 롤백

- 가장 빠른 방법은 merge commit revert 후 재배포다.
- Vercel에서 직전 정상 deployment로 rollback할 수 있으면 우선 사용한다.
- 성향궁합만 막아야 하면 hotfix로 `/compatibility/personality` 진입 CTA와 결제 CTA를 숨긴다.

### DB 롤백

- 이미 적용된 migration은 즉시 drop하지 않는다.
- 신규 테이블과 컬럼은 기존 기능에 영향을 주지 않는 추가 구조이므로, 장애 초기에 DB rollback보다 코드 rollback을 우선한다.
- 잘못된 `product_entitlements` check constraint가 문제면 hotfix migration으로 기존 product id 목록을 보존한 채 constraint를 다시 확장한다.

### 결제 롤백

- `taste_personality_compatibility_mini` 결제 CTA를 숨기거나 결제 준비 API에서 임시 차단한다.
- 이미 생성된 entitlement는 삭제하지 말고 재열람 정책을 별도로 정한다.
- 결제 승인 후 리포트 저장만 실패하는 경우에는 entitlement 기준으로 재열람 복구 API 또는 수동 복구 절차가 필요하다.

## 13. Go/No-Go 체크리스트

| 항목 | 상태 |
| --- | --- |
| Git 충돌 가능성 | Go |
| 자동 lint/typecheck/test/build | Go |
| HTTP smoke | Go |
| Supabase migration 로컬/원격 적용 검증 | No-Go, 사람 확인 필요 |
| Vercel Production env | Go |
| Vercel Preview Supabase env | 확인 필요 |
| Toss 990원 sandbox 결제 | 확인 필요 |
| paid/free UI 권한 분리 | Go for MVP, 서버 생성 구조 개선 권장 |
| 개인정보 analytics/share payload | Go |
| 개인정보처리방침 업데이트 | 확인 필요 |
| 실제 브라우저/모바일 UI | 확인 필요 |
| 선행 리팩터 포함 범위 승인 | 확인 필요 |

## 14. PR 본문에 넣을 문구

```md
이 PR은 달빛 성향궁합 MVP와 함께 해당 기능을 붙이기 위한 선행 리팩터, 라우트 정리, 검증 스크립트, 홈/사주/오늘운세 구조 변경을 포함하는 통합 PR입니다.

origin/main 기준 merge conflict 가능성은 낮고 lint/typecheck/test/build/smoke는 통과했습니다.

배포 전 필수 확인:
- Supabase migration 021~023 적용
- Vercel Preview/Production env 확인
- Toss sandbox 990원 결제 성공/실패/취소 확인
- 로그인 사용자 저장/재열람 확인
- 모바일 화면 QA
- 개인정보처리방침에 성향/관계 리포트 저장 항목 반영
```
