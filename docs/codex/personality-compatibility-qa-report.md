# 달빛 성향궁합 MVP QA 리포트

- 작성일: 2026-05-11
- 브랜치: `feature/personality-compatibility`
- 기준 범위: `main...HEAD` 전체 변경 파일 목록을 확인했고, 심층 QA는 성향궁합 MVP와 직접 연결된 도메인, 입력/결과 UI, 결제, 저장/공유, analytics, Supabase migration 파일을 중심으로 수행했다.
- 브라우저 QA 상태: Codex 인앱 브라우저에서 `http://localhost:3000/compatibility/personality`, `http://127.0.0.1:3000/compatibility/personality` 접근이 모두 `ERR_BLOCKED_BY_CLIENT`로 차단되어 실제 클릭 플로우는 수동 확인 필요로 남겼다.

## 1. 실행 검수 결과

| 항목 | 결과 | 메모 |
| --- | --- | --- |
| `npm run lint` | 통과 | `verify:imports` 6/6 통과 |
| `npm run typecheck` | 통과 | `tsc --noEmit` 통과 |
| `npm test` | 통과 | 166개 unit test + node test 5개 통과 |
| `npm run build` | 통과 | Next build 통과, `/compatibility/personality`, `/compatibility/personality/result`, 관련 API route 포함 |
| 인앱 브라우저 UI 확인 | 실패/차단 | 브라우저 확장 또는 클라이언트 정책으로 localhost 접근 차단 |

## 2. 변경 파일 검토 요약

심층 검토한 주요 파일은 다음과 같다.

- 점수/리포트/가드레일: `src/domain/compatibility-personality/*`
- 성향 도메인: `src/domain/personality/*`
- 입력/결과 UI: `src/app/compatibility/personality/*`, `src/features/compatibility/personality-compatibility-*`
- 결제/권한: `src/lib/payments/personality-compatibility.ts`, `src/lib/payments/catalog.ts`, `src/lib/payments/product-scope.ts`, `src/lib/payments/confirmation.ts`, `src/app/api/payments/prepare/route.ts`, `src/app/api/payments/confirm/route.ts`, `src/app/membership/checkout/page.tsx`, `src/app/membership/success/page.tsx`
- 저장/재조회: `src/app/api/compatibility/personality/reports/route.ts`, `supabase/migrations/021_personality_compatibility.sql`, `022_personality_compatibility_mini_entitlement.sql`, `023_personality_compatibility_report_scope.sql`
- 이벤트: `src/lib/analytics-events.ts`, `src/lib/analytics-events.test.ts`, 입력/결과/결제 컴포넌트의 `trackMoonlightEvent` 호출부

브랜치에는 성향궁합 외의 구조/문서/layout 변경도 포함되어 있다. 이번 QA에서는 해당 파일들을 전체 파일 목록 기준으로 확인했지만, 세부 동작 검증은 성향궁합 MVP 직접 영향 범위에 집중했다.

## 3. 기능 QA

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 입력 플로우 | 부분 통과 | 정적 검토상 관계 유형, 내 정보, 상대 정보, 성향 직접 선택/간단 체크, 현재 질문, sessionStorage 저장, 결과 라우팅 구조가 연결되어 있다. 브라우저 클릭 검증은 차단으로 미수행. |
| 무료 결과 화면 | 통과 | 결과 builder와 result client가 한 줄 결론, 5축 점수, 관계 키워드, 무료 3문단, 잠금 영역, CTA를 구성한다. 갈등 지수는 UI에서 높을수록 주의 신호라고 명시한다. |
| 유료 결과 노출 방지 | 수정 후 통과 | UI는 `accessState === 'granted'`일 때만 `paidSections`를 노출한다. 추가로 reports API에서도 서버 측 권한 확인을 넣어 직접 API 호출 우회를 막았다. |
| 결제 후 재열람 | 정적 통과 | 결제 prepare에서 기존 entitlement를 확인하고, confirm에서 scoped entitlement를 부여하며, success에서 scope 포함 결과 화면으로 redirect한다. 실제 Toss 승인과 운영 DB 재열람은 수동 확인 필요. |
| 결제 실패 처리 | 정적 통과 | 성향궁합 990원 상품 실패 URL은 `/compatibility/personality/result?payment=failed&scope=...`로 복귀하며 결과 화면에 무료 결과 복귀 안내가 표시된다. |
| 결과 저장/재조회 | 수정 후 통과 | reports API는 로그인 사용자 본인 row만 조회한다. 유료 row도 권한이 없으면 응답에서 `productCode: free`, `paidSections: []`, `paidAmount: null`로 내려간다. |
| 공유 카드 개인정보 | 통과 | 공유 카드와 복사 문구는 관계 키워드, 끌림/소통/회복 요약, 오늘의 한마디, 브랜드 텍스트, 다시 보기 링크만 포함한다. 생년월일시, 성별, 상대 상세 정보는 포함하지 않는다. |
| 이벤트 payload PII | 통과 | `relationshipType`, `productCode`, `amount`, `source`, `profileSlot`, `inputMode`, `feedbackValue` 중심이다. 이름, 생년월일, 성별, 상대 정보, 성향 코드, 축 점수는 analytics payload에 넣지 않는다. |

## 4. 금지 표현 검색 결과

실행 검색어: `공식 MBTI`, `MBTI 검사`, `MBTI 진단`, `심리검사`, `무조건`, `반드시`, `절대`, `최악`, `파멸`, `헤어진다`, `결혼한다`, `재회한다`

성향궁합 관련 사용자 노출 범위 집중 검색 결과:

- 발견 위치: `src/domain/compatibility-personality/guardrails.ts`
- 발견 위치: `src/domain/compatibility-personality/reportPrompt.test.ts`
- 판정: guardrail 금지어 목록/치환표와 테스트 fixture 목적의 사용이다. 성향궁합 UI/결과/결제 사용자 문구에서는 직접 노출되지 않았다.

전체 repo 검색 결과:

- `AGENTS.md`, product/docs QA 문서, 기존 사주/오늘운세 서버 prompt와 audit 코드에도 메타 목적 또는 기존 구현 목적의 표현이 남아 있다.
- 이번 MVP 사용자 화면 직접 영향 범위 밖의 기존 문서/서버 prompt 표현은 변경하지 않았다.

## 5. 발견 및 수정한 항목

### 수정 1. 유료 리포트 저장 API 권한 검증 추가

- 문제: 정상 UI는 권한 확인 뒤 유료 저장을 시도하지만, 로그인 사용자가 reports API에 직접 `productCode: personality_compatibility_mini`를 보내면 권한 없이 유료 report row를 저장할 여지가 있었다.
- 수정 파일: `src/app/api/compatibility/personality/reports/route.ts`
- 수정 내용: POST에서 유료 productCode 요청 시 entitlement 또는 포함 멤버십을 서버에서 확인하고, 권한이 없으면 403을 반환한다.
- 보강 내용: GET에서도 저장 row가 유료 productCode이더라도 현재 사용자에게 해당 scope 권한이 없으면 무료 결과로 sanitize하여 응답한다.
- 검증: 수정 후 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 모두 통과.

### 수정 2. 권한 확인 실패 시 무료 저장으로 덮어쓰기 방지

- 문제: 결과 화면에서 entitlement 확인이 네트워크/서버 오류로 실패하면 기존 로직상 `accessState: error`도 무료 결과처럼 저장 시도를 할 수 있었다.
- 수정 파일: `src/features/compatibility/personality-compatibility-result-client.tsx`
- 수정 내용: access check 에러 상태에서는 report save를 중단하고 저장 상태를 error로 표시한다.
- 효과: 결제한 사용자의 기존 유료 저장본이 일시적인 권한 확인 실패로 무료 저장본에 덮이는 위험을 줄였다.

## 6. 남은 리스크

- 인앱 브라우저가 localhost 접근을 차단해 실제 클릭 플로우, 모바일 레이아웃, CTA 클릭 후 화면 전환은 자동 검증하지 못했다.
- 실제 Toss 결제 승인, 결제 실패 redirect, 운영 Supabase entitlement row 생성은 라이브 자격 증명과 결제 sandbox가 필요해 정적 검토와 build/test로만 확인했다.
- Supabase migration `021`, `022`, `023`이 운영 DB에 적용되지 않으면 저장/권한/재조회 흐름이 실패할 수 있다.
- `PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS`는 빈 배열이고 정책은 `not_included`다. 프리미엄 멤버십 포함 여부는 서비스 정책 결정이 필요하다.
- 카카오톡 공유 또는 이미지 저장은 기존 재사용 구현이 없어 UI와 공유 데이터 구조까지만 준비되어 있다.
- 브랜치 전체에는 성향궁합 외 파일 변경도 많다. 이 브랜치를 그대로 배포한다면 성향궁합 외 변경사항까지 별도 회귀 확인이 필요하다.

## 7. 배포 전 사람이 확인해야 할 항목

- 로컬 또는 staging 브라우저에서 `/compatibility/personality` 입력 완료부터 `/compatibility/personality/result` 도착까지 실제 클릭으로 확인한다.
- 비로그인 사용자가 990원 CTA 클릭 시 로그인으로 이동하고, 로그인 후 기존 결과 scope가 유지되는지 확인한다.
- 결제 sandbox에서 `personality_compatibility_mini`, 990원, scope 포함 successUrl/failUrl이 Toss 콘솔 설정과 맞는지 확인한다.
- 결제 성공 뒤 결과 화면이 `paid=personality_compatibility_mini&scope=...`로 돌아오고 깊이보기가 열리는지 확인한다.
- 같은 scope로 재결제 시 checkout/prepare에서 기존 구매로 감지되어 재결제 없이 결과로 이동하는지 확인한다.
- 저장된 `reportId` 링크를 새로고침/재접속했을 때 본인 계정에서 재조회되고, 다른 계정 또는 비로그인에서는 노출되지 않는지 확인한다.
- 공유 카드와 복사 텍스트에 생년월일시, 성별, 이름, 상대 세부 정보가 들어가지 않는지 실제 화면에서 확인한다.
- 운영 DB에 `compatibility_personality_reports` 테이블과 `product_entitlements` check constraint 확장이 적용됐는지 확인한다.
