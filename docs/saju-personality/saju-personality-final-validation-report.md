# 달빛 성향사주 Final Validation Report

작성일: 2026-05-11

## 1. Executive Summary

달빛 성향사주 기능은 현재 로컬 기준 `main` 브랜치에 merge commit 형태로 반영되어 있으며, `origin/main`과 같은 HEAD를 가리킨다. 이번 검증에서는 production deploy, production Supabase `db push`, `main` direct push를 실행하지 않았다.

정적 검증은 통과했다. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `git diff --check` 모두 성공했다. 단, 로컬 Node 버전이 `v24.14.0`이라 `package.json`의 `node: 20.x` 요구와 달라 `npm ci`에서 engine warning이 발생했다.

Supabase local 검증은 Docker daemon 미실행으로 완료하지 못했다. Remote linked dry-run은 이 Codex 셸에 `SUPABASE_ACCESS_TOKEN`이 없어 실행하지 못했다. 운영 반영 전 권한 있는 터미널에서 `024`, `025` migration dry-run과 실제 적용 여부를 다시 확인해야 한다.

## 2. Current Branch / Commit

| 항목 | 값 |
|---|---|
| 현재 브랜치 | `main` |
| HEAD | `9802de07f76ddf1997d9f5320e9341c1cde7bf01` |
| HEAD 요약 | `9802de0 Merge branch 'integration/saju-personality'` |
| 1번 부모 | `31a5abc15f01cf87ad85a003b12a92b4b125e408` |
| 2번 부모 | `9e7b3abd71670bd9774eb6827848c781cceda801` |
| 원격 상태 | `main` is up to date with `origin/main` |

주의: 요청 기준 명령인 `git diff --stat origin/main...HEAD`와 `git diff --name-status origin/main...HEAD`는 현재 `origin/main`과 `HEAD`가 같아서 빈 결과가 나왔다. 변경 요약은 merge commit의 1번 부모 대비로 보조 산출했다.

## 3. Changed Files Summary

`git show --stat --oneline --find-renames HEAD` 기준:

| 항목 | 결과 |
|---|---|
| 변경 파일 수 | 37 files |
| 추가 라인 | 5,479 insertions |
| 삭제 라인 | 6 deletions |
| 신규 migration | `024_saju_personality_reports.sql`, `025_saju_personality_mini_entitlement.sql` |

주요 추가/수정 범위:

- `src/domain/saju-personality/*`: facts builder, fusion rules, 6축 score engine, report schema, prompt builder, guardrails, tests.
- `src/features/saju-personality/*`: 입력 UI, session handoff, 무료/유료 결과 UI, 저장/공유/AI CTA.
- `src/app/saju/personality/*`: 성향사주 입력/결과 라우트.
- `src/app/api/saju/personality/*`: entitlement 확인, report 저장/재조회 API.
- `src/lib/payments/saju-personality.ts`, `src/lib/payments/catalog.ts`, `src/lib/payments/product-scope.ts`: 990원 상품/권한 scope 연결.
- `src/lib/analytics-events.ts`: 성향사주 funnel 이벤트 추가.
- `src/app/api/ai/*`, `src/components/dialogue/*`, `src/app/dialogue/*`: AI 상담 CTA context 연결.

## 4. Static Validation Result

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm ci` | 통과 | Node `v24.14.0` vs required `20.x` engine warning |
| `npm run lint` | 통과 | 내부적으로 `npm run verify:imports`, 6/6 통과 |
| `npm run typecheck` | 통과 | `tsc --noEmit` 통과 |
| `npm test` | 통과 | 176개 unit tests + Node test 5개 통과 |
| `npm run build` | 통과 | Next.js 16.2.3 build 통과, 125 static pages generated |
| `git diff --check` | 통과 | whitespace error 없음 |

빌드 산출 라우트에서 `/saju/personality`, `/saju/personality/result`, `/api/saju/personality/entitlement`, `/api/saju/personality/reports`가 확인됐다.

## 5. Supabase Migration Validation

로컬 Supabase 명령 결과:

| 명령 | 결과 | 원인 |
|---|---|---|
| `supabase start` | 실패 | Docker daemon 연결 불가 |
| `supabase db reset` | 실패 | Docker daemon 연결 불가 |
| `supabase migration list --local` | 실패 | 로컬 Postgres `127.0.0.1:54322` 접근 불가 |

Remote linked 명령 결과:

| 명령 | 결과 | 원인 |
|---|---|---|
| `supabase migration list --linked` | 실패 | `SUPABASE_ACCESS_TOKEN` 미설정 |
| `supabase db push --dry-run --linked` | 실패 | `SUPABASE_ACCESS_TOKEN` 미설정 |

Migration 파일 검토:

- `024_saju_personality_reports.sql`은 `CREATE TABLE IF NOT EXISTS`, index 생성, RLS enable, policy 생성으로 구성된다.
- `025_saju_personality_mini_entitlement.sql`은 `product_entitlements_product_id_check` 제약을 `DROP CONSTRAINT IF EXISTS` 후 `ADD CONSTRAINT`로 재생성해 `saju_personality_mini`를 추가한다.
- 데이터 삭제 패턴인 `drop table`, `drop column`, `truncate`, `delete from`, `alter table ... rename`, `alter table ... set not null`은 검색되지 않았다.
- 단, `025`의 `DROP CONSTRAINT IF EXISTS`는 데이터 삭제는 아니지만 production 적용 전 반드시 dry-run과 constraint 재생성 성공을 확인해야 한다.

Production 반영 전 확인 명령:

```bash
supabase migration list --linked
supabase db push --dry-run --linked -p "$SUPABASE_DB_PASSWORD"
```

Dry-run에서 `024_saju_personality_reports.sql`, `025_saju_personality_mini_entitlement.sql`만 표시될 때만 실제 migration 적용을 진행한다.

## 6. Vercel Preview Validation Plan

이번 검증에서는 Vercel production deploy를 실행하지 않았다. Preview 검증은 아래 순서로 진행한다.

1. Vercel Preview URL에서 build status가 성공인지 확인한다.
2. `/saju/personality` 직접 접근이 200인지 확인한다.
3. `/saju/personality/result`가 입력 session 없이 진입했을 때 안전한 안내 상태를 보여주는지 확인한다.
4. 로그인 사용자로 기존 프로필 불러오기 UI가 동작하는지 확인한다.
5. 16유형 직접 선택과 8문항 성향 체크가 모두 무료 결과로 이어지는지 확인한다.
6. 990원 CTA가 `/membership/checkout?product=saju_personality_mini...` 형태로 이동하는지 확인한다.
7. Preview 환경에서 실제 결제는 sandbox/live 설정 구분 후 제한적으로 확인한다.

## 7. Manual QA Checklist

| 체크 | 상태 |
|---|---|
| 사주 메뉴 또는 직접 URL로 `/saju/personality` 진입 | 확인 필요 |
| 기존 프로필 선택 | 확인 필요 |
| 신규 생년월일시 입력 | 확인 필요 |
| 태어난 시간 모름 선택 | 확인 필요 |
| 16유형 직접 선택 | 확인 필요 |
| 8문항 성향 체크 | 확인 필요 |
| 관심영역 선택 | 확인 필요 |
| 무료 결과 표시 | 확인 필요 |
| 6축 점수 표시 | 확인 필요 |
| 잠금 영역 표시 | 확인 필요 |
| 990원 깊이보기 CTA 표시 | 확인 필요 |
| 결제 성공 시 유료 리포트 표시 | production/sandbox에서 확인 필요 |
| 결제 실패/취소 시 무료 결과 복귀 | production/sandbox에서 확인 필요 |
| 구매 리포트 재열람 | production/sandbox에서 확인 필요 |
| 공유 카드 개인정보 미노출 | 코드 검토 통과, 화면 확인 필요 |
| AI 상담 CTA 연결 | 코드 검토 통과, 화면 확인 필요 |
| 모바일 화면 깨짐 없음 | 확인 필요 |

## 8. Existing Feature Regression Checklist

정적 검증과 build는 통과했지만, 아래 기존 기능은 production smoke에서 다시 확인한다.

| 기존 기능 | 상태 |
|---|---|
| 기존 사주 입력 `/saju/new` | build 통과, 수동 확인 필요 |
| 기존 사주 결과 `/saju/[slug]` | build 통과, 수동 확인 필요 |
| 오늘운세 `/today-fortune` | build 통과, 수동 확인 필요 |
| 기존 궁합 `/compatibility/input`, `/compatibility/result` | build 통과, 수동 확인 필요 |
| 달빛 성향궁합 `/compatibility/personality` | build 통과, 수동 확인 필요 |
| 기존 결제 `/membership/checkout` | build 통과, 결제 E2E 확인 필요 |
| 멤버십 `/membership` | build 통과, 수동 확인 필요 |
| 마이페이지 재열람 `/my` | build 통과, 수동 확인 필요 |
| AI 상담 `/dialogue` | build 통과, 수동 확인 필요 |

## 9. Privacy / Analytics Review

개인정보 키워드 검색:

```bash
rg -i --count-matches "birth|birthDate|birth_time|gender|displayName|name|answers_json|rawAnswer" src
```

전체 `src` 기준 매칭은 많다. 기존 사주 입력/프로필/테스트/`className` 등 넓은 매칭이 포함된다. 신규 성향사주 주요 경로 검토 결과는 아래와 같다.

| 영역 | 검토 결과 |
|---|---|
| Analytics payload | `source`, `lifeArea`, `productCode`, `reportType`, `channel`, `rating`, `confidence` 수준. 생년월일, 성별, 이름, 답변 원문 전송 없음 |
| 공유 카드 | `keywords`, `axisHighlights`, `todayMessage`, `brandText`, `revisitPath` 중심. 생년월일/성별/답변 원문/상세 원국 제외 |
| AI 상담 context | `lifeArea`, `scoreSummary`, `fusionSummary`, `unlocked`만 prompt context에 포함 |
| 저장 API sanitizer | `reportJson`에서 `facts`, `birthInput`, `birthSummary`, `displayName`, `personalityAnswers` 제거 |
| sessionStorage | 결과 생성 전 handoff를 위해 `birthInput`, `displayName`, `birthSummary`, personality payload를 보관. 브라우저 세션 한정이지만 민감 입력이므로 정책 검토 필요 |
| 저장 리포트 본문 | `headline`과 유료 section body에 `displayName`이 문장으로 포함될 수 있음. 개인정보 최소화 기준에서는 제거 또는 비식별 표현 권장 |

개인정보 관련 최종 확인 필요:

- 저장 리포트 본문에 닉네임/displayName을 포함할지 정책 결정.
- 개인정보처리방침에 성향 유형, 성향 체크 응답, 관심영역, 성향사주 리포트 저장 항목 반영.
- production 로그/Vercel 로그/analytics에서 raw request body나 sessionStorage payload가 수집되지 않는지 확인.

## 10. Payment / Entitlement Review

| 항목 | 확인 내용 |
|---|---|
| Product code | `saju_personality_mini` |
| Package id | `taste_saju_personality_mini` |
| Price | 990 |
| 상품명 | `달빛 성향사주 깊이보기` |
| Scope prefix | `saju-personality` |
| 멤버십 정책 | `policy_pending`, 포함 plan 없음 |
| 중복 구매 방지 | `/api/payments/prepare`의 `alreadyPurchased` 흐름 재사용 |
| 권한 확인 | `/api/saju/personality/entitlement?scope=...`에서 `product_entitlements` 조회 |
| 재조회 | `/api/saju/personality/reports`가 entitlement 보유 시 paid report 반환 |
| Checkout 이동 | `/membership/checkout?product=saju_personality_mini&scope=...&from=saju-personality-result` |

운영 전 확인 필요:

- `saju_personality_mini`가 운영 결제 catalog/Toss 처리에 맞게 등록됐는지 확인.
- Toss sandbox/live env 분리 확인.
- 결제 성공 후 `product_entitlements`에 `(user_id, product_id, scope_key)`가 생기는지 확인.
- 결제 실패/취소 시 무료 결과로 복귀하는지 확인.

## 11. Production Deployment Plan

production deploy는 이번 검증에서 실행하지 않았다. 권장 순서는 아래와 같다.

1. 운영 DB 백업 또는 최소 복구 가능 상태 확인.
2. 권한 있는 터미널에서 `supabase migration list --linked` 확인.
3. 권한 있는 터미널에서 `supabase db push --dry-run --linked -p "$SUPABASE_DB_PASSWORD"` 실행.
4. dry-run에서 `024`, `025`만 표시되는지 확인.
5. 승인 후 production Supabase migration 적용.
6. `supabase migration list --linked`로 `024`, `025` remote applied 확인.
7. Vercel production deployment가 `main` 최신 commit을 배포했는지 확인.
8. production smoke test 수행.
9. Toss 결제, Supabase logs, Vercel logs, analytics 이벤트를 30~60분 모니터링.

## 12. Rollback Plan

애플리케이션 rollback:

1. Vercel에서 직전 stable production deployment로 rollback.
2. 신규 `/saju/personality` 진입 링크가 있다면 임시 비활성화.
3. `saju_personality_mini` 상품의 운영 노출을 비활성화.

DB rollback:

- `024`는 신규 테이블 추가라 기존 기능에는 영향이 낮다. production 장애 시 앱 rollback을 우선한다.
- `025`는 `product_entitlements_product_id_check` constraint 재생성이 포함된다. 장애 시 기존 product id 목록으로 constraint를 재생성하는 SQL을 별도 준비해야 한다.
- 데이터 삭제 rollback은 수행하지 않는다.

Rollback 기준:

- production build 실패.
- 기존 사주 결과 접근 실패.
- 기존 결제 실패.
- 신규 report 저장 실패.
- PII 노출 확인.
- Supabase migration 적용 실패.
- `product_entitlements` constraint 오류로 기존 상품 결제/권한 생성 실패.

## 13. Blockers

| blocker | 영향 | 해소 방법 |
|---|---|---|
| 현재 검증 세션에서 Supabase local reset 실패 | local migration full reset 미검증 | Docker Desktop 실행 후 `supabase start`, `supabase db reset`, `supabase migration list --local` 재실행 |
| 현재 검증 세션에서 linked dry-run 실패 | 원격 migration pending 상태 미확인 | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` 설정된 권한 계정 터미널에서 dry-run 재실행 |
| `025`의 `DROP CONSTRAINT IF EXISTS` | product entitlement constraint 재생성 실패 시 결제 권한 영향 가능 | production dry-run, staging 적용 이력, 기존 product id 포함 여부 재확인 |
| 저장 리포트 본문 displayName 포함 가능 | 개인정보 최소화 정책 이슈 가능 | 저장 본문에서 닉네임 제거 또는 정책 승인 |
| Vercel Preview 검증 미실행 | 실제 환경 env/route/결제 진입 미확인 | Preview URL에서 수동 QA 완료 |

## 14. Go / No-Go Decision

현재 코드 정적 검증 기준은 Go다.

Production 배포 기준은 Conditional Go다. 아래 조건을 모두 만족하면 production 반영 가능하다.

- Supabase production dry-run에서 `024`, `025`만 적용 대상으로 표시된다.
- `024`, `025` migration 적용 후 remote migration list에서 applied 상태가 확인된다.
- Vercel Preview 또는 Production 배포에서 `/saju/personality`와 기존 핵심 경로 smoke test가 통과한다.
- `saju_personality_mini` 운영 상품 코드와 Toss env가 확인된다.
- 저장 리포트 본문 `displayName` 포함 여부에 대한 개인정보 정책 판단이 완료된다.

