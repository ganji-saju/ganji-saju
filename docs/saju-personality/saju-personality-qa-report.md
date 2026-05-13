# 달빛 성향사주 전체 QA 및 회귀 검수

작성일: 2026-05-11  
브랜치: `codex/saju-personality-repo-audit`  
범위: 달빛 성향사주 신규 기능, 기존 사주/궁합/결제/마이페이지 주요 회귀, 개인정보/금지 표현 검수

## Executive Summary

달빛 성향사주 MVP의 핵심 입력/무료 결과 흐름은 로컬 브라우저와 정적 검수에서 정상 동작을 확인했다. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`, `npm run verify:imports`, `npm run preflight`, `npm run smoke`를 실행했고, 최종적으로 모두 통과했다.

다만 배포 전 반드시 정리해야 할 항목이 있다. 사주 메뉴에서 `/saju/personality`로 들어가는 공개 진입 링크가 검색되지 않았고, 입력 화면 하단에 이전 단계 안내 문구인 “이번 단계에서는 결제와 저장을 연결하지 않습니다”가 남아 있다. 또한 워크트리에 DB 백업으로 보이는 untracked 파일/폴더가 있어 `git add .` 사용 시 개인정보성 데이터가 커밋될 수 있으므로 커밋 대상에서 제외해야 한다.

## 검수 명령

| 명령 | 결과 | 비고 |
|---|---:|---|
| `npm run lint` | PASS | `npm run verify:imports` 6/6 통과 |
| `npm run typecheck` | PASS | TypeScript 에러 없음 |
| `npm test` | PASS | 성향사주 facts/score 및 analytics 이벤트 테스트 포함 통과 |
| `npm run build` | PASS | Next production build 통과 |
| `git diff --check` | PASS | whitespace/check 에러 없음 |
| `npm run verify:imports` | PASS | import 검증 통과 |
| `npm run preflight` | PASS with warnings | uncommitted changes 경고, `src/proxy.ts` 존재 및 `src/middleware.ts` 부재 경고 |
| `npm run smoke` | PASS after dev server | dev server 미기동 상태에서는 연결 실패, dev server 실행 후 20/20 route 통과 |

## 로컬 라우트 확인

| 경로 | 결과 | 비고 |
|---|---:|---|
| `/saju/personality` | 200 | 입력 페이지 렌더링 확인 |
| `/saju/personality/result` | 200 | 결과 페이지 fallback 렌더링 확인 |
| `/membership/checkout?product=saju_personality_mini&scope=saju-personality%3Aqa&from=saju-personality-result` | 200 | 990원 상품 checkout 진입 확인 |
| `/membership/success?product=saju_personality_mini&scope=saju-personality%3Aqa&amount=990&paymentKey=qa&orderId=qa` | 200 | success route 렌더링 확인, 실제 PG 승인 아님 |
| `/dialogue?source=saju-personality-report&sajuPersonalityReportId=qa&lifeArea=today&unlocked=false` | 307 | `/dialogue/dragon?...` 리다이렉트 확인 |
| `/my/results` | 308 | 기존 `/my` 리다이렉트 확인 |

## 신규 기능 QA

| 항목 | 결과 | 근거 |
|---|---:|---|
| 사주 메뉴에서 달빛 성향사주 진입 가능 | FAIL | `/saju/personality` 직접 접근은 가능하지만, 코드 검색상 공개 메뉴 링크가 확인되지 않음. `src/app/saju/page.tsx`는 `/saju/new`로 redirect |
| 기존 프로필 선택 가능 | PARTIAL | 로그인 상태가 아니어서 저장 프로필 목록은 미검증. 비로그인 안내와 `/api/profile` 연동 구조는 확인 |
| 신규 생년월일시 입력 가능 | PASS | 브라우저에서 연/월/일/성별/출생지 입력 후 결과 생성 |
| 태어난 시간 모름 선택 가능 | PASS | 기본값 `모름`, 분 입력 비활성화, 결과 생성 확인 |
| 16유형 직접 선택 가능 | PASS | `INFJ` 선택 후 무료 결과 도달 |
| 8문항 성향 체크 가능 | PASS | 8문항 응답 완료 후 무료 결과 도달 |
| 관심영역 선택 가능 | PASS | `오늘` 선택 후 결과 도달 |
| 무료 결과 표시 | PASS | 한 줄 결론, 키워드, 요약 해석 표시 |
| 6축 점수 표시 | PASS | 내면 에너지, 표현, 결정, 실행 리듬, 관계 감도, 성장 방향 표시 |
| 잠금 영역 표시 | PASS | 결제 전 상세 본문 없이 제목/예고만 표시 |
| 990원 깊이보기 CTA 표시 | PASS | `990원으로 깊이보기` CTA 표시 |
| 결제 성공 시 유료 리포트 표시 | PARTIAL | entitlement 기반 코드 경로 및 success route 확인. 실제 Toss 결제 성공 E2E는 미실행 |
| 결제 실패/취소 시 무료 결과 복귀 | PARTIAL | 실패 redirect builder와 checkout route 코드 확인. 실제 PG 실패 E2E는 미실행 |
| 구매 리포트 재열람 가능 | PARTIAL | `reportId`/`scope` 기반 재조회 API와 entitlement gating 확인. 로그인 사용자 실제 재열람은 미실행 |
| 공유 카드 개인정보 미노출 | PASS | 브라우저 결과와 sanitize 로직에서 이름/생년월일시/성별/체크 원문/원국/결제정보 비노출 확인 |
| AI 상담 CTA 연결 | PASS | `/dialogue` route redirect 및 report context 연동 경로 확인 |
| 모바일 화면 깨짐 없음 | PARTIAL | responsive class/build 확인. 실제 모바일 viewport 스크린샷은 미실행 |

## 기존 기능 회귀

| 항목 | 결과 | 근거 |
|---|---:|---|
| 기존 사주 입력 | PASS | smoke `/saju/new` 200, build/typecheck 통과 |
| 기존 사주 결과 | PASS | 관련 테스트 및 build 통과 |
| 오늘운세 | PASS | smoke 오늘운세 route/API status 기대값 통과 |
| 기존 궁합 | PASS | smoke `/compatibility`, `/compatibility/input` 200 |
| 달빛 성향궁합 | PASS | 기존 성향궁합 도메인 테스트 통과, 신규 성향사주는 2인 관계 로직 미수정 |
| 기존 결제 | PASS | checkout/success route build 및 smoke 통과 |
| 멤버십 | PASS | smoke `/membership`, `/pricing` 200 |
| 마이페이지 재열람 | PARTIAL | `/my/results` redirect 확인, 로그인 사용자 UI 재열람은 미실행 |

## 개인정보 검수

공유 카드에는 키워드, 핵심 축 2~3개, 오늘의 한마디, 브랜드 텍스트, 다시 보기 링크만 포함된다. `sanitizeReportJson`은 저장 리포트 재조회 시 `facts`, `birthInput`, `birthSummary`, `displayName`, `personalityAnswers`를 제거한다.

analytics 이벤트 payload는 신규 성향사주 이벤트 기준으로 `source`, `confidence`, `lifeArea`, `productCode`, `amount`, `reportType`, `channel`, `rating` 범위에서 사용된다. 이름, 생년월일, 태어난 시간, 성별, 성향 체크 원문 답변, 질문 원문, 결제 상세 정보는 신규 이벤트 payload에 넣지 않는 것으로 확인했다.

주의할 점은 현재 워크트리에 `backup-before-personality-compatibility-full.sql`과 `supabase/data_table_backup/`가 untracked로 존재한다는 것이다. 백업/덤프성 파일은 개인정보 또는 운영 데이터가 섞일 수 있으므로 PR 커밋 전에 제외, 삭제, 또는 `.gitignore` 처리 여부를 사람이 확인해야 한다.

## 금지 표현 검수

검색 명령:

```bash
rg -n "공식 MBTI|MBTI 검사|MBTI 진단|심리검사|무조건|반드시|절대|최악|파멸|질병|투자하면|이 직업만" src docs supabase --glob '!docs/saju-personality/saju-personality-qa-report.md'
rg -n "공식 MBTI|MBTI 검사|MBTI 진단|심리검사|무조건|반드시|절대|최악|파멸|질병|투자하면|이 직업만" src/features/saju-personality src/app/saju/personality src/app/api/saju/personality src/domain/saju-personality src/lib/payments/saju-personality.ts src/lib/analytics-events.ts
rg -n "결혼한다|헤어진다|재회한다|이별|결혼|재회" src/features/saju-personality src/app/saju/personality src/app/api/saju/personality src/domain/saju-personality
```

신규 성향사주 범위에서 금지 표현은 `src/domain/saju-personality/guardrails.ts`의 금지어/치환어 목록에만 존재한다. 사용자 결과 UI와 신규 API route에는 해당 금지 표현이 직접 노출되는 용례가 확인되지 않았다. 결혼/이별/재회 단정 표현 검색은 신규 성향사주 범위에서 결과가 없었다.

전체 저장소 검색에서는 기존 문서, 기존 prompt, 안전 가이드, guardrails, 백업 CSV에서 `반드시`, `무조건`, `질병` 등의 표현이 검색된다. 이는 신규 성향사주 사용자 화면의 직접 노출과는 별개지만, PR 리뷰 시 기존 레거시 문구와 신규 범위를 구분해야 한다.

## 결제 및 권한 검수

`saju_personality_mini`는 `PAYMENT_PACKAGES`, `TasteProductId`, `product_entitlements` check constraint, `resolvePaymentProductScope`, checkout/success/fail redirect, paid snapshot 제목/요약에 연결되어 있다. 무료 결과는 `accessState !== 'granted'`에서 `paidSections`를 노출하지 않고, 저장 API도 paid 저장 요청 시 entitlement 또는 포함 멤버십 권한이 없으면 403을 반환한다.

프리미엄 멤버십 포함 정책은 `policy_pending`과 빈 included plan 배열로 남아 있다. 운영 상품 등록, Toss 실결제 승인, 실패/취소 redirect, 구매 후 재열람은 staging 또는 production 계정으로 최종 확인이 필요하다.

## 발견한 실패/리스크

| 항목 | 영향 | 권장 조치 |
|---|---|---|
| 사주 메뉴 공개 진입 링크 없음 | 사용자가 새 기능을 찾기 어려움 | `/saju/new`, 홈 서비스 메뉴, 또는 글로벌 nav 중 한 곳에 `/saju/personality` 진입 카드/링크 추가 |
| 입력 화면 하단의 과거 안내 문구 | 결제/저장 연결 완료 상태와 안내가 충돌 | “결제와 저장은 결과 화면에서 로그인 사용자 기준으로 연결됩니다”처럼 현재 상태에 맞게 수정 |
| untracked DB 백업/덤프 파일 존재 | `git add .` 시 개인정보성 데이터 커밋 위험 | PR 전 커밋 제외 및 필요 시 안전한 로컬 보관/삭제 |
| 실제 Toss 결제 E2E 미실행 | 운영 결제 실패 가능성 잔존 | staging/production에서 990원 상품 등록, success/fail/cancel redirect 확인 |
| 로그인 사용자 저장 프로필/재열람 미실행 | 계정 기반 플로우 회귀 가능성 잔존 | 테스트 계정으로 프로필 선택, 저장, 보관함 재열람 확인 |
| 모바일 viewport 스크린샷 미실행 | 작은 화면 레이아웃 깨짐 가능성 잔존 | 실제 모바일 또는 viewport 도구로 `/saju/personality`, `/saju/personality/result` 확인 |
| `npm run preflight` proxy/middleware 경고 | auth redirect 경로에 기존 구조 리스크 | 기존 `src/proxy.ts`/`src/middleware.ts` 정책 확인 |

## 배포 전 사람이 확인해야 할 것

| 항목 | 확인 내용 |
|---|---|
| 운영 상품 | Toss/Vercel/Supabase 운영 환경에 `saju_personality_mini` 및 990원 상품 정책 등록 |
| DB migration | `024_saju_personality_reports.sql`, `025_saju_personality_mini_entitlement.sql` 운영 적용 순서와 rollback 계획 |
| 개인정보 | 백업/덤프 파일이 PR에 포함되지 않는지 확인 |
| UX 진입점 | 사주 메뉴 또는 홈에서 달빛 성향사주를 찾을 수 있는지 확인 |
| 멤버십 정책 | 프리미엄 멤버십에서 성향사주 깊이보기를 포함할지 결정 |
| 결제 E2E | 성공, 실패, 취소, 재열람, 중복 결제 차단 확인 |
| 모바일 | 입력/결과/checkout 화면 모바일 실기기 확인 |

## 최종 판정

현재 코드 품질 검수와 핵심 무료 결과 플로우는 통과했다. 다만 사용자 진입 링크, 잘못된 안내 문구, untracked 백업 파일, 실제 결제/로그인 E2E 미검증이 남아 있어 배포 가능 여부는 `조건부 보류`로 판단한다.
