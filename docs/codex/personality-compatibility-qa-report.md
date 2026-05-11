# 달빛 성향궁합 MVP 최종 QA 리포트

- 작성일: 2026-05-11
- 브랜치: `feature/personality-compatibility`
- 기준 커밋: `cdead3b test: complete QA for personality compatibility MVP`
- 비교 기준: `main...HEAD` 및 현재 작업트리
- 현재 작업트리 참고: `docs/codex/personality-compatibility-repo-audit.md`가 추가로 수정된 상태다. PR 전 커밋 또는 제외 여부를 결정해야 한다.

## 1. git diff 기준 변경사항 요약

`git diff --stat main...HEAD` 기준 전체 변경은 163개 파일, 약 24,982 insertions / 6,510 deletions다. 성향궁합 MVP 외 변경이 함께 포함되어 있어 PR scope를 반드시 확인해야 한다.

### 성향궁합 MVP 직접 변경

- 성향궁합 입력/결과 라우트 추가: `/compatibility/personality`, `/compatibility/personality/result`
- 궁합 메뉴에 성향궁합 진입 카드 추가
- 사주 facts와 성향 facts를 받는 5축 scoring domain 추가
- 무료/유료 리포트 schema, prompt builder, guardrail, copy 추가
- 관계 유형, 두 사람 birth input, 성향 직접 선택/간단 체크, 현재 질문 입력 UI 추가
- 무료 결과 UI, 5축 점수, 관계 키워드, 잠금 영역, CTA 추가
- 990원 `personality_compatibility_mini` 결제/권한/scope 연결
- 결과 저장/재조회 API와 Supabase migration 추가
- 공유 카드 데이터/UI 및 analytics funnel event 추가
- QA/설계/DB 문서 추가

### MVP 범위를 벗어나거나 별도 PR로 분리 검토가 필요한 변경

- `layout/` 디자인 산출물과 zip 파일 추가
- `next.config.ts`, `package.json`, `package-lock.json`, scripts, skills 관련 변경
- 홈 섹션 파일 삭제/개편, 일부 route `.gitkeep` 삭제
- 사주 report builder, 오늘운세 builder, AI route, verification route 등 성향궁합 외 도메인 변경
- 여러 문서와 refactor runbook 추가

판정: 성향궁합 MVP 자체는 기능적으로 묶여 있지만, 현재 PR diff 전체는 MVP 범위를 넓게 초과한다. PR을 “성향궁합 MVP”로만 올릴 계획이면 branch split 또는 PR 설명에서 범위를 명확히 해야 한다.

## 2. 실행 검수 결과

| 항목 | 결과 | 메모 |
| --- | --- | --- |
| `npm run lint` | 통과 | `verify:imports` 6/6 통과 |
| `npm run typecheck` | 통과 | `tsc --noEmit` 통과 |
| `npm test` | 통과 | 166개 unit test + node test 5개 통과 |
| `npm run build` | 통과 | Next build 통과, 123개 static page 생성 완료 |
| 인앱 브라우저 UI 확인 | 실패/차단 | `localhost`, `127.0.0.1` 모두 `ERR_BLOCKED_BY_CLIENT` |

빌드 결과에서 다음 성향궁합 라우트가 포함됨을 확인했다.

- `/compatibility/personality`
- `/compatibility/personality/result`
- `/api/compatibility/personality/entitlement`
- `/api/compatibility/personality/reports`

## 3. 기능/권한 QA

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 입력 플로우 | 정적 통과 | 관계 유형, 내 정보, 상대 정보, 성향 직접 선택/간단 체크, 현재 질문, sessionStorage 저장, 결과 이동 구조 확인 |
| 무료 결과 | 정적 통과 | 한 줄 결론, 5축 점수, 관계 키워드, 무료 3문단, 잠금 영역, CTA 구성 확인 |
| 유료 결과 권한 분리 | 통과 | UI는 `accessState === 'granted'`일 때만 `paidSections` 표시 |
| 저장 API 유료 권한 방어 | 통과 | 유료 productCode POST 시 entitlement 또는 포함 멤버십 없으면 403 반환 |
| 재조회 API 유료 권한 방어 | 통과 | 유료 row라도 현재 권한 없으면 `productCode: free`, `paidSections: []`, `paidAmount: null`로 sanitize |
| 결제 후 재열람 | 정적 통과 | prepare/confirm/success/product-scope가 `scope` 기반 entitlement와 결과 redirect를 연결 |
| 결제 실패 복귀 | 정적 통과 | 성향궁합 결제 실패 시 무료 결과 route로 복귀하도록 fail URL 구성 |
| 권한 확인 실패 시 저장 | 통과 | entitlement check error 상태에서는 무료 저장으로 덮어쓰지 않게 저장 중단 |

운영/브라우저에서 아직 직접 확인하지 못한 부분:

- Toss sandbox 실제 승인
- 결제 실패 redirect
- 로그인 전환 후 scope 유지
- 저장된 reportId 재열람
- 모바일 화면 클릭 플로우

## 4. 개인정보/공유/analytics QA

### 공유 카드

공유 카드 생성 함수는 다음 필드만 사용한다.

- 관계 키워드
- 끌림/소통/회복 요약
- 오늘의 한마디
- `달빛인생` 브랜드 텍스트
- 다시 보기 링크

확인 결과:

- 생년월일시, 출생지, 성별, 이름, 상대 이름은 공유 텍스트에 포함되지 않는다.
- 성향 유형 코드는 `isPrivateShareKeyword`로 공유 키워드에서 제외한다.
- 공유 카드 UI 문구에도 개인정보를 넣지 않는다는 안내가 있다.

주의:

- 결과 화면 내부에는 입력 확인용으로 이름, 성향 코드, birth summary가 표시된다. 공유 카드에는 포함되지 않지만, 화면 스크린샷 공유 시 사용자가 해당 영역을 직접 캡처하지 않도록 UI/가이드 확인이 필요하다.

### analytics payload

확인한 이벤트:

- `personality_compatibility_viewed`
- `relationship_type_selected`
- `profile_a_completed`
- `profile_b_completed`
- `personality_type_selected`
- `personality_check_completed`
- `free_result_viewed`
- `paid_unlock_clicked`
- `payment_completed`
- `report_shared`
- `ai_chat_started_from_report`
- `report_feedback_submitted`

payload 판정:

- 포함: `relationshipType`, `productCode`, `amount`, `source`, `profileSlot`, `inputMode`, `resultType`, `feedbackValue`
- 미포함: 이름, 생년월일, 출생시간, 성별, 상대 정보, birth summary, 성향 typeCode, axisScores

결론: 성향궁합 analytics payload에 PII는 확인되지 않았다.

## 5. 금지/단정 표현 QA

검색어:

- `공식 MBTI`
- `MBTI 검사`
- `MBTI 진단`
- `심리검사`
- `무조건`
- `반드시`
- `절대`
- `최악`
- `파멸`
- `헤어진다`
- `결혼한다`
- `재회한다`

성향궁합 직접 영향 범위 검색 결과:

- `src/domain/compatibility-personality/guardrails.ts`: 금지어 목록과 치환표 목적
- `src/domain/compatibility-personality/reportPrompt.test.ts`: guardrail 테스트 fixture 목적
- 성향궁합 사용자 화면/결과/결제 카피에서 직접 노출되는 금지 표현은 발견되지 않았다.

결혼/이별/재회 단정 표현 추가 검색 결과:

- `배우자/결혼`, `결혼/장기 관계 가능성이 있는지`: 관계 유형/질문 라벨이며 단정 표현 아님
- `promptBuilder.ts`의 `연애, 결혼, 친구...`: 관계 유형 설명이며 단정 표현 아님
- 기존 궁합 입력의 `재회` regex: 저장 프로필 관계 추론용이며 성향궁합 결과 단정 표현 아님
- `헤어진다`, `결혼한다`, `재회한다`: guardrail 목록/치환표와 테스트 fixture에서만 발견

전체 repo 검색 결과:

- 문서, AGENTS, 기존 사주/오늘운세 prompt/audit 코드에 `반드시`, `무조건`, `절대` 등이 남아 있다.
- 이번 성향궁합 MVP 사용자 노출 범위 밖의 기존 표현은 이번 QA에서 수정하지 않았다.

## 6. 남은 리스크

- 인앱 브라우저가 로컬 URL을 차단해 실제 클릭 QA와 스크린샷 캡처를 자동 수행하지 못했다.
- PR diff가 성향궁합 MVP 외 변경을 많이 포함한다. 리뷰/배포 리스크를 줄이려면 PR split 권장.
- 운영 DB에 `021`, `022`, `023` migration이 적용되지 않으면 저장/권한/재조회가 실패한다.
- Toss console 또는 sandbox에서 `personality_compatibility_mini` 990원 결제 success/fail URL을 실제 확인해야 한다.
- `PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS`는 빈 배열이며 정책은 `not_included`다. 멤버십 포함 여부는 서비스 정책 결정 필요.
- 카카오톡 공유/이미지 저장은 실제 외부 연동 없이 구조와 UI만 준비되어 있다.

## 7. 배포 전 사람이 확인해야 할 것

- `/compatibility/personality` 입력 시작 화면 스크린샷
- 성향 직접 선택 UI와 간단 체크 UI 스크린샷
- `/compatibility/personality/result` 무료 결과 화면 스크린샷
- 잠금 영역과 990원 CTA 스크린샷
- 결제 checkout 화면 스크린샷
- 결제 성공 후 깊이보기 열린 화면 스크린샷
- 공유 카드 영역 스크린샷
- 모바일 화면에서 입력 완료, 결과, 결제 CTA가 깨지지 않는지 확인
- 다른 계정 또는 비로그인에서 저장된 `reportId` 접근 시 노출되지 않는지 확인
- 결제 실패 시 무료 결과로 복귀하는지 확인

## 8. PR description 초안

```md
## 작업 목적

달빛인생 궁합 메뉴에 “달빛 성향궁합” MVP를 추가합니다. 사용자가 관계 유형, 두 사람의 생년월일시, 16유형 성향 직접 선택 또는 간단 체크, 현재 질문을 입력하면 사주 facts와 성향 facts를 결합해 5축 점수를 계산하고 무료/유료 결과를 제공합니다.

## 주요 변경사항

- `/compatibility/personality` 입력 플로우 추가
- `/compatibility/personality/result` 무료 결과 및 깊이보기 결과 화면 추가
- 사주 facts와 성향 facts를 결합하는 5축 점수 엔진 추가
- 무료/유료 리포트 schema, prompt builder, guardrails, 기본 copy 추가
- 990원 상품 `personality_compatibility_mini` 결제/권한/scope 연결
- 성향궁합 결과 저장/재조회 API 및 Supabase migration 추가
- 공유 카드 UI와 공유 텍스트 구조 추가
- 성향궁합 funnel analytics event 추가
- QA/설계/DB 문서 추가

## 테스트 결과

- `npm run lint` 통과
- `npm run typecheck` 통과
- `npm test` 통과: 166개 unit test + node test 5개
- `npm run build` 통과

## 스크린샷 필요 위치

- 성향궁합 입력 첫 화면
- 성향 직접 선택 화면
- 간단 체크 화면
- 무료 결과 화면
- 잠금 영역과 990원 CTA
- 결제 checkout 화면
- 결제 후 깊이보기 열린 화면
- 공유 카드 영역
- 모바일 입력/결과 화면

## 결제/개인정보 관련 확인 필요 사항

- Toss sandbox에서 990원 결제 성공/실패 redirect 확인 필요
- 운영 DB에 `021`, `022`, `023` migration 적용 필요
- 같은 scope 재구매 방지 확인 필요
- 저장된 reportId가 본인 계정에서만 재조회되는지 확인 필요
- 공유 카드와 analytics payload에 생년월일시, 성별, 이름, 상대 정보가 들어가지 않는지 staging에서 재확인 필요
- 프리미엄 멤버십에 성향궁합 깊이보기를 포함할지 정책 결정 필요

## 롤백 방법

- 라우트 노출 롤백: `/compatibility`의 성향궁합 진입 CTA 제거
- UI 롤백: `src/app/compatibility/personality/*`, `src/features/compatibility/personality-compatibility-*` 제거 또는 route 차단
- 결제 롤백: `personality_compatibility_mini` 상품 등록과 product-scope 분기 제거
- DB 롤백: 운영 적용 전이면 `021`, `022`, `023` migration 배포 보류. 이미 적용했다면 신규 테이블/constraint 변경은 별도 rollback migration으로 처리
- analytics 롤백: `analytics-events.ts`의 성향궁합 이벤트와 호출부 제거

## PR scope 주의

현재 branch diff에는 성향궁합 MVP 외 layout 산출물, 사주/오늘운세/홈/AI 관련 변경도 포함되어 있습니다. 성향궁합 MVP만 리뷰하려면 PR split을 권장합니다.
```
