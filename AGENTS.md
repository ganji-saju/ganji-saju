<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ganji Saju Agent Guide

이 문서는 Codex가 `ganji-saju` 리포지토리에서 일관되게 작업하기 위한 프로젝트 규칙입니다. 구현 전에 관련 구조를 먼저 확인하고, 기존 사주 계산/인증/결제 흐름을 임의로 바꾸지 않습니다.

## 1. 프로젝트 개요

- Next.js App Router 기반 사주/운세 서비스입니다.
- `src/pages`는 사용하지 않고, 라우팅은 `src/app` 아래에서 관리합니다.
- React 19, Next 16, TypeScript 5, Tailwind CSS 4를 사용합니다.
- Supabase Auth/DB, Toss Payments, OpenAI, Vercel Analytics/Speed Insights가 연결되어 있습니다.
- 주요 사용자 흐름은 사주 입력, 오늘운세, 타로, 궁합, 결제/코인, 보관함, 프로필 관리입니다.

## 2. 주요 디렉터리 구조

| 경로 | 역할 |
| --- | --- |
| `src/app` | Next.js App Router 라우트와 API route |
| `src/app/api` | AI, 사주 해석, 프로필, 결제, 코인, 알림 API |
| `src/app/saju` | 사주 입력/결과/상세/프리미엄 화면 |
| `src/app/compatibility` | 궁합 진입, 입력, 결과 화면 |
| `src/app/membership`, `src/app/pricing`, `src/app/pay` | 결제와 상품 진입 화면 |
| `src/app/my` | 보관함, 프로필, 결제 상태, 설정 |
| `src/components` | 공통 UI, Gangi UI, 결제 UI, 사주 입력 공유 컴포넌트 |
| `src/features` | 화면 단위 클라이언트 기능 |
| `src/features/compatibility` | 궁합 입력/결과/수동 저장 흐름 |
| `src/domain/saju` | 사주 엔진, 리포트 빌더, 검증 로직 |
| `src/lib` | Supabase, 프로필, 결제, 권한, 크레딧, 사주 저장 유틸 |
| `src/server` | AI 호출, 오늘운 빌더, 검증 서버 로직 |
| `src/content` | 서비스 카피, 탭, 상품, 궁합 관계 타입 등 콘텐츠 상수 |
| `supabase/migrations` | Supabase DB 마이그레이션 |
| `docs/codex` | Codex 작업 조사/계획/체크리스트 문서 |

현재 루트 `prisma`, 루트 `migrations`, `src/pages` 폴더는 없습니다.

## 3. 실행 명령

| 명령 | 역할 |
| --- | --- |
| `npm run dev` | Next 개발 서버 실행 |
| `npm run start` | Next production server 실행 |
| `npm run preflight` | 배포 전 환경/설정 점검 |
| `npm run smoke` | smoke test |
| `npm run verify:imports` | import 검증 |
| `npm run validate:kasi` | KASI 달력 검증 |
| `npm run validate:classics` | 고전 코퍼스 검증 |
| `npm run generate:web-push-keys` | Web Push 키 생성 |

## 4. Lint / Typecheck / Test / Build

| 구분 | 명령 |
| --- | --- |
| lint | `npm run lint` |
| typecheck | `npm run typecheck` |
| test | `npm test` |
| build | `npm run build` |

현재 `npm run lint`는 별도 ESLint가 아니라 기존 import 검증인 `npm run verify:imports`를 실행합니다. 작업 범위가 문서 변경만인 경우에도 가능하면 `git diff --check`를 실행합니다. TS/TSX 변경이 있으면 최소 `npm run lint`와 `npm run typecheck`를 실행하고, 영향 범위에 따라 `npm test`, `npm run build`까지 실행합니다.

## 5. 사주/궁합 로직 수정 시 주의사항

- 사주 계산 엔진(`src/domain/saju/engine`)은 임의로 변경하지 않습니다.
- 사주 입력값은 기존 `UnifiedBirthInfoFields`, `resolveUnifiedBirthInput`, `BirthInput` 흐름을 우선 사용합니다.
- 기존 사주 결과 저장/조회는 `src/lib/saju/readings.ts` 흐름을 확인한 뒤 변경합니다.
- 궁합 기능은 기존 `/compatibility/input` → `/compatibility/result` 흐름과 `src/lib/compatibility.ts`를 먼저 확인합니다.
- 새 성향궁합은 기존 궁합 흐름 위에 레이어를 추가하는 방식을 우선 검토합니다.
- 명리 전문용어는 내부 판단 자료로 사용할 수 있지만, 일반 사용자 본문에 반복 노출하지 않습니다.
- `evidence_json`, engine/rule version, 개발자용 메타데이터는 일반 결과 본문에 직접 노출하지 않습니다.
- 결과 문구는 입력값이 달라지면 실제로 달라져야 하며, 평균적인 일반론 반복을 피합니다.

## 6. 결제/코인/멤버십 로직 수정 시 주의사항

- 결제 상품은 `src/lib/payments/catalog.ts`의 `PAYMENT_PACKAGES`와 타입을 먼저 확인합니다.
- 상품별 권한 범위는 `src/lib/payments/product-scope.ts`에서 관리합니다.
- 결제 전 중복 구매 차단은 `/api/payments/prepare` 흐름을 존중합니다.
- 결제 승인 후 권한 부여는 `/api/payments/confirm` 흐름을 존중합니다.
- 유료 해금 기준은 `product_entitlements`와 `(user_id, product_id, scope_key)` unique 정책을 우선 사용합니다.
- 결제 당시 결과 보관은 `paid_reading_snapshots` 흐름을 확인합니다.
- 코인 차감은 `src/lib/credits`와 관련 API를 확인한 뒤 변경합니다.
- 1코인 해금과 원화 결제가 같은 상품을 여는 경우 중복 결제/중복 차감이 생기지 않도록 같은 권한 기준으로 묶어야 합니다.
- 새 `product_id`가 필요하면 Supabase check constraint 확장 마이그레이션이 필요합니다.
- 기존 Toss 결제 승인, Supabase Auth, subscription 로직을 임의로 우회하지 않습니다.

## 7. 개인정보/성향 데이터 처리 주의사항

- 생년월일, 성별, 출생시간, 출생지, 가족/상대 정보는 개인정보에 준해 다룹니다.
- 로그에 원본 개인정보를 남기지 않습니다. 디버깅이 필요하면 최소한의 마스킹 또는 구조 확인만 사용합니다.
- 비로그인 사용자의 수동 입력은 기존 sessionStorage 흐름을 확인하고, 로그인/결제 전환 시 데이터가 유실되지 않게 주의합니다.
- 성향궁합 결과는 단정적인 진단이 아니라 관계 이해를 돕는 참고 풀이로 작성합니다.
- 건강, 법률, 투자, 위기 상황 판단은 전문 도움을 우선하도록 안내합니다.

## 8. 금지 표현

아래 표현은 UI, 결과 문구, 상품명, 안내문에서 사용하지 않습니다.

- 공식 MBTI 검사
- MBTI 진단
- MBTI 심리검사
- 무조건
- 반드시
- 절대
- 파멸
- 최악

비슷한 의미의 공포성 단정 표현도 피합니다.

## 9. 완료 기준

작업 완료 보고 전 아래 기준을 확인합니다.

- 타입 에러 없음.
- lint 통과.
- build 통과. 단, 문서만 변경한 경우 build 생략 사유를 명확히 적을 수 있습니다.
- 변경 파일과 변경 이유를 설명할 수 있어야 합니다.
- 기존 사주 입력, 궁합, 결제, 보관함, 로그인 흐름에 회귀가 없어야 합니다.
- 실패한 검수 명령이 있으면 원인과 남은 리스크를 보고합니다.

## 10. 성향궁합 구현 권장 출발점

작업 0 감사 결과 기준으로 성향궁합은 아래 위치에서 시작하는 것이 가장 안전합니다.

- 입력: `src/features/compatibility/compatibility-input-client.tsx`
- 결과: `src/features/compatibility/compatibility-result-view.tsx`
- 계산/조합: `src/lib/compatibility.ts` 또는 별도 `src/lib/personality-compatibility.ts`
- 관계 콘텐츠: `src/content/moonlight.ts`
- 결제 상품: `src/lib/payments/catalog.ts`
- 상품 scope: `src/lib/payments/product-scope.ts`
- 보관/재열람: `src/lib/payments/paid-reading-snapshots.ts`, `src/app/my/page.tsx`

처음 구현은 무료 결과 타입과 빌더를 추가하고, 결제/권한 연결은 결과 개인화와 UI 흐름 검증 후 별도 단계에서 붙입니다.
