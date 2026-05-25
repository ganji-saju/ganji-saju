# ganjisaju.kr 어드민·운영 자산 인벤토리 (READ-ONLY)

- 작성일: 2026-05-25
- 대상 브랜치: `chore/admin-inventory` (origin/main `12e8504` 기준, 읽기 전용)
- 범위: `src/app/admin/**`, `src/app/api/admin/**`, `src/lib/admin/**`, `scripts/**`, `supabase/migrations/**`, 결제·AI챗·LLM 텔레메트리 코드
- 성격: 코드 변경 없음. 모든 클레임은 `file:line` 근거를 달았고, 정적 분석으로 직접 검증함. 라이브 행수/실호출 빈도는 표시한 부분만 외부 데이터(대시보드) 필요.

---

## 0. 한눈 요약 (TL;DR)

| 항목 | 결론 | 핵심 근거 |
|---|---|---|
| 1. 어드민 라우트 | **존재** — `/admin/*` 9개 페이지 + `/api/admin/*` 10개 API, 전부 화이트리스트 인증 | `src/app/admin/layout.tsx`, `src/lib/admin-auth.ts` |
| 2. scripts/ audit | **10개 존재** (9개 `npm run audit:*` 연결, `narrative-tone`은 미연결→`node` 직접) | `package.json` L22-37 |
| 3. 운영자 조회/수정 테이블 | 40개 중 **READ 8 + MODIFY 4** 가 운영 핵심. 어드민은 RLS 우회(`service_role`) | `src/lib/admin/*`, 각 migration |
| 4. 결제 환불/재시도 | **환불=라이브러리 스캐폴딩만(진입점 0), Toss cancel 호출 없음 / 재시도=부재** | `src/lib/product-entitlements.ts:473`, `payments/confirm/route.ts` |
| 5. AI챗 사용량 집계 | **집계 함수 없음**. 과금용 1인 누적 카운터만 존재 | `src/lib/credits/ai-chat-access.ts:72` |
| 6. LLM 호출 로그 | **대운 챕터만** `console.log`(Vercel 로그). DB 로그 테이블 없음, 나머지 영역 무계측 | `chapters/chapter-telemetry.ts:79` |

가장 중요한 3가지:
1. **진짜 어드민 패널이 있다** — PR #141(2026-05-16)부터 9개 운영 페이지(운영지표/리뷰모더레이션/결제퍼널/정책/푸시CTR/명리검증/가중치튜닝 등). 모두 `admin_users` 화이트리스트 + `ADMIN_USER_IDS` env 이중 가드.
2. **환불은 "코드만 있고 버튼이 없다"** — `revokeProductEntitlement` 등 권한 회수 함수는 있으나 라우트·어드민·스크립트 어디서도 호출하지 않으며, 실제 Toss 결제취소(`/v1/payments/{key}/cancel`) 호출 코드는 아예 없다. 환불은 현재 **수동 운영**(Toss 대시보드).
3. **LLM 비용 관측은 대운 챕터에만 있다** — 기본풀이/총평/올해/궁합/AI챗은 토큰·비용 로그가 전무. 운영자가 SQL로 볼 수 있는 건 캐시된 "출력 내용"뿐, 호출량·토큰·비용은 조회 불가.

---

## 1. 어드민 / 운영 라우트

### 1-1. 인증 가드 (`src/lib/admin-auth.ts`, `src/app/admin/layout.tsx`)
- 모든 `/admin/*`는 `layout.tsx`의 서버측 가드로 보호: 미인증→`/login?next=/admin`, 비어드민→`/`.
- `isAdminUser(userId)` (`admin-auth.ts:51`): ① env `ADMIN_USER_IDS`(comma UUID, DB 호출 없음) 우선 → ② `admin_users` 테이블 조회, 각 **5분 TTL 메모리 캐시**.
- `admin_users` (`migrations/028_admin_users.sql`): `role IN ('admin','super_admin')`, RLS는 본인 row만(관리 작업은 `service_role`). env 부트스트랩으로 최초 어드민 자가 등록.

### 1-2. 어드민 페이지 (9개, URL `/admin/<X>`)

| 페이지 | 용도 | 주 데이터 소스 |
|---|---|---|
| `operations` | 운영 지표 대시보드 — DAU, 결제 퍼널 전환, 만족도, 활성 구독 | `readings`, `credit_transactions`, `subscriptions`, `dialogue_messages` |
| `payment-funnel` | 결제 퍼널 단계별 전환/이탈/실패 사유 | `payment_funnel_events` |
| `reviews` | 리뷰 모더레이션 큐 (승인/거부) | `reviews` (**update**) |
| `policies` | 9개 정책 버전·게시 상태 관리 | `policy_versions` (**update**), `user_policy_consents` |
| `saju-feedback` | 챕터 피드백 품질 (평점/도움됨 비율) | `chapter_feedback`, `today_fortune_feedback` |
| `push-ctr` | 푸시 A/B/C 변형 성과·정책 위너 | `notification_delivery_logs`, `push_subscriptions` |
| `myungri-validation` | 신살 룰 검증 (피드백 t-test) | `sinsal_weight_versions`, `fortune_feedback` |
| `weight-tuning` | ML 가중치 튜닝 (ridge regression 추천치 vs 현재) | `sinsal_weight_versions` (**promote**) |
| `saju-verify` | 사주 입력 vs 계산 출력 대조 검증 도구 | (계산 엔진, 테이블 무관) |

### 1-3. 어드민 API (10개, `src/app/api/admin/*/route.ts`)
`operations`, `payment-funnel`, `policies`, `push-ab-policy`, `push-ctr`, `reviews`, `reviews/moderate`, `sinsal-validation`, `web-push-status`, `weight-learning`. 전부 `getCurrentAdminCheck()`로 401(미인증)/403(비어드민) 분기. 비즈니스 로직은 `src/lib/admin/{operations-stats,payment-funnel-stats,sinsal-validation,weight-learning}.ts`로 분리.

### 1-4. dev 전용 (prod 차단)
- `/dev/saju-score` (`src/app/dev/saju-score/page.tsx:20`): `if (NODE_ENV==='production') notFound()` + noindex. 사주 점수 컴포넌트 쇼케이스(QA 전용). 실제 페이지에 연결 안 됨.

> **참고(비어드민 운영면)**: 일반 사용자 `/my/billing`(결제내역), `/dialogue/history`(채팅 히스토리)는 본인 데이터 열람 페이지로, 운영자 전용은 아님.

---

## 2. `scripts/` 인벤토리

### 2-1. audit 스크립트 (10개) — 각 한 줄 요약

| # | 스크립트 | 한 줄 요약 | npm wiring |
|---|---|---|---|
| 1 | `audit-ai-chat-idempotency.mjs` | AI챗(3코인 대화) 턴 멱등성 검증 — 같은 턴 이중 과금(레이스) 탐지 | `audit:ai-chat-idempotency`(+`:strict`) |
| 2 | `audit-business-activity.mjs` | 운영 트래픽 프록시 — reading·크레딧사용·권한·피드백·예약 빈도로 활동량 추정 | `audit:business-activity` |
| 3 | `audit-dead-anchors.mjs` | `href="#x"` 인데 매칭 `id="x"` 없는 끊긴 앵커 탐지 | `audit:dead-anchors`(+`:strict`) |
| 4 | `audit-lifetime-report.mjs` | 평생소장권(49,000원) 멱등성 + 매출/환불 감사 (최고가 단일 상품) | `audit:lifetime-report`(+`:strict`) |
| 5 | `audit-lucky-hybrid.mjs` | 행운팩 사주+택일 하이브리드 룰 매트릭스(5오행×5천간×4흉) 검증 | `audit:lucky-hybrid`(+`:strict`) |
| 6 | `audit-mockup-placeholders.mjs` | 리디자인 잔재 하드코딩 목업 텍스트 탐지 | `audit:mockup-placeholders`(+`:strict`) |
| 7 | `audit-narrative-tone.mjs` | 사주 서사 본문 톤 감사 — 한국어 글자빈도/말투/술어/자극어구(LLM 무호출, 무료) | **미연결 → `node scripts/audit-narrative-tone.mjs`** |
| 8 | `audit-payment-idempotency.mjs` | 오늘운세 상세리포트 동일유저/일 이중 차감 모니터 (2026-05-17 기준 0건) | `audit:payment-idempotency`(+`:strict`) |
| 9 | `audit-redesign-coverage.mjs` | 신디자인 미이관 구식 페이지 탐지 | `audit:redesign-coverage`(+`:strict`) |
| 10 | `audit-user-entitlements.mjs` | 9개 결제 진입점(PR #177/#178) 권한 진단. CLI: user-id 또는 email 인자 | `audit:user-entitlements` |

> ⚠️ **검증으로 잡은 불일치**: audit 스크립트는 **10개 파일** 존재하나 `package.json`에는 **9개만** `audit:*`로 연결됨. `audit-narrative-tone.mjs`는 npm 미연결 — `node scripts/audit-narrative-tone.mjs`로만 실행. `:strict` 변형은 7개에만 존재(`user-entitlements`, `business-activity` 제외).

### 2-2. 기타 스크립트 (10개)
- **고전 코퍼스 seed/validate**: `ingest-classics.mjs`(위키소스 적재), `seed-classic-korean-summaries.mjs`(`seed:classics-summaries`), `seed-classics-hold-metadata.mjs`(`seed:classics-holds`), `validate-classics-corpus.mjs`(`validate:classics`).
- **달력 검증**: `validate-kasi-calendar.mjs`(`validate:kasi`) — KASI 천문 음력 정확도.
- **테스트/유틸**: `run-unit-tests.mjs`(`npm test`, node:test), `compare-saju-output-similarity.mjs`(npm 미연결 유틸), `generate-web-push-keys.mjs`(`generate:web-push-keys`, VAPID 키쌍).

---

## 3. Supabase 테이블 — 운영자 조회/수정 관점

전체 40개 테이블(`supabase/migrations/` 기준). 운영자 접점 중심으로 분류.

### 3-1. 운영자 핵심 테이블

**운영자가 자주 READ (어드민 대시보드/진단 스크립트):**

| 테이블 | 운영 용도 | 접근 경로 |
|---|---|---|
| `readings` | 사주 조회 건수(DAU 프록시), 히스토리. `result_json` JSONB에 팔자+풀이 임베드 | operations-stats, audit-business-activity |
| `credit_transactions` | 코인 충전/사용 이력 = 매출·소비 집계 핵심 | operations-stats(4곳), payment-history |
| `subscriptions` | 활성 멤버십 구독 수 | operations-stats |
| `product_entitlements` | 단건/평생/번들 구매 권한(현금 결제 원천) | audit-user-entitlements, /my/billing |
| `payment_funnel_events` | prepare→confirm 단계별 전환/실패 | payment-funnel-stats |
| `today_fortune_feedback` / `chapter_feedback` / `fortune_feedback` | 만족도·품질 모니터 | saju-feedback, myungri-validation |
| `dialogue_messages` | AI챗 볼륨(운영지표) + 사용자 히스토리 | operations-stats |
| `notification_delivery_logs` / `push_subscriptions` | 푸시 발송·CTR | push-ctr |

**운영자가 MODIFY (쓰기):**

| 테이블 | 수정 행위 | 경로 |
|---|---|---|
| `reviews` | 승인/거부 status 변경 (모더레이션) | `api/admin/reviews/moderate` (`lib/reviews/queries` `.update` ×5) |
| `policy_versions` | 정책 버전 게시/발행 | `api/admin/policies` (`lib/policies` `.update`/`.insert`) |
| `sinsal_weight_versions` | 학습 가중치 promote | `api/admin/weight-learning` |
| `admin_users` | 어드민 추가/제거 (super_admin) | `service_role` 수동 |

### 3-2. 핵심 메커니즘 — RLS + service_role
모든 사용자 테이블은 **본인 row RLS**(`auth.uid() = user_id`, `001_initial.sql:50-55`). 어드민 통계는 `createServiceClient()`(`admin-auth.ts:36`)로 **RLS를 우회**해 전체 집계. 즉 운영자 조회의 보안 경계는 RLS가 아니라 `admin_users` 화이트리스트 + service_role 키.

### 3-3. 비운영 테이블(참고)
- **회원/식별**: `profiles`, `family_profiles`, `star_sign_favorites`, `notification_preferences`
- **크레딧 내부**: `user_credits`, `credit_lots`(040, 1년 만료 lot), `paid_reading_snapshots`
- **AI 캐시(§6 연계)**: `ai_interpretations`, `ai_yearly_interpretations`, `ai_total_review_interpretations`, `ai_ohaeng_guidance_interpretations`, `ai_compatibility_interpretations`
- **정책/동의**: `user_policy_consents`
- **예약**: `appointments`
- **고전 코퍼스(거의 정적 레퍼런스, 12개)**: `classic_works`, `classic_work_versions`, `classic_sources`, `classic_sections`, `classic_passages`, `classic_translations_ko`, `classic_commentaries`, `classic_concept_tags`, `classic_passage_concept_tags`, `classic_readings_ko`, `classic_ingest_runs`, `classic_validation_runs`

> 라이브 행수는 이 세션에서 Supabase 대시보드/MCP 접근 불가로 미산출. (2026-05 직전 스냅샷 참고치: `readings`≈566, `ai_interpretations`≈6, `ai_yearly`≈33, `ai_total_review`≈17, `ai_ohaeng`/`ai_compatibility`≈0 — 본 인벤토리 작성 시점의 정확값은 대시보드 확인 필요.)

---

## 4. 결제 — 환불 / 재시도 기능

### 4-1. 결제 구조 (`src/lib/payments/`)
- 모듈: `catalog.ts`(상품 정의), `toss.ts`(Toss API), `confirmation.ts`(검증), `bundle.ts`(번들 부여/회수), `funnel-log.ts`. 라우트: `api/payments/{prepare,confirm,entitlement}/route.ts`.
- 상품(`catalog.ts:42-170`): 코인팩 `credit_1/3/7`, 구독 `subscription_30`·`membership_plus`·`membership_premium`, 평생 `lifetime_report`(49,000원), 단건 taste(`today-detail` 등), 번들 `bundle_today_set`(990원→권한 6개).
- 전 결제는 `api/payments/confirm/route.ts:60` `confirmPayment`→Toss confirm 단일 호출.

### 4-2. VERDICT — 환불: **PARTIAL (스캐폴딩만, 진입점 0)**
- 권한 회수 함수는 **존재**: `revokeProductEntitlement`(`product-entitlements.ts:473`)가 `product_entitlements`+레거시 `credit_transactions` 삭제 후 감사행(`feature='entitlement_revoke'`) 기록. 번들 `revokeBundleEntitlement`(:552), 평생 `revokeLifetimeReportEntitlement`(`report-entitlements.ts:224`).
- **그러나 실제 Toss 결제취소 호출이 코드에 없음** — `tosspayments.com`은 `src/` 전체에서 confirm용 `toss.ts:14` 단 1곳. 주석(`product-entitlements.ts:471-472`)이 `/v1/payments/{paymentKey}/cancel`은 "이 함수 밖"이라고 명시.
- **검증 결과: revoke 함수는 서로만 호출**(`report-entitlements.ts:229`, `product-entitlements.ts:573`)할 뿐 **라우트·어드민·스크립트 진입점이 0건**(`scripts/`에도 `revoke` 참조 없음). → 환불은 라이브러리 스캐폴딩일 뿐 실행 경로가 없으며, 실무상 **Toss 대시보드 수동 처리** 추정.

### 4-3. VERDICT — 재시도: **ABSENT**
- `confirm/route.ts`는 `confirmPayment` 1회 호출, 실패 시 `confirm_failed` 퍼널 이벤트 기록 후 400 반환 — 재시도 없음(`:65-72`).
- Toss에 멱등키 전송 안 함(`toss.ts:14-21`은 `paymentKey/orderId/amount`만 POST). **webhook/cancel/refund 라우트 디렉터리 자체가 부재**(검증: `find api -iname '*webhook*'/'*cancel*'/'*refund*'` 0건). pending/재처리 로직 없음.

---

## 5. AI 챗 사용량 추적

- 챗 기능: 12간지 페르소나 채팅 = `src/app/api/ai/route.ts`(996줄, 생성+과금) + UI `components/dialogue/dialogue-chat-panel.tsx`. 메시지는 `api/dialogue/messages/route.ts`→`dialogue_messages`(`024`)에 영구 저장.
- 과금용 추적은 **존재**: `lib/credits/ai-chat-access.ts` — 무료 3턴 후 3코인 번들. `getAiChatSuccessfulTurns`(:72)가 `count(credit_transactions WHERE type='use' AND feature='ai_chat')`로 다음 턴 가격 결정(`ai/route.ts:764`에서만 사용).

### VERDICT — 통계 집계 함수: **ABSENT**
- `getAiChatSuccessfulTurns`는 **과금 게이팅용 1인 누적 카운터**일 뿐 분석용 아님. 일별 총량·유저별 롤업·쿼터 없음(잔액 외 제한 無, `ai/route.ts:789-790`).
- `dialogue_messages`는 `model TEXT`는 있으나 **토큰/비용 컬럼 없음**(`024:16-17`). `src/lib/admin/`·`api/admin/`에 챗 대상 `group by`/RPC/일별집계 쿼리 전무(어드민 유일 집계는 `payment-funnel-stats.ts:107`의 `payment_funnel_events`).
- 챗 라우트는 텔레메트리 미방출(실패 시 `console.error`만, `ai/route.ts:830`).

---

## 6. LLM 호출 로그 — 저장 위치 / 조회 방법

### 6-1. 유일한 구조적 로그 = 대운 챕터
- `src/server/ai/chapters/chapter-telemetry.ts:79` `logChapterRun`이 `console.log(JSON.stringify({event:'chapter_run', ...}))` 1줄 방출. 필드: `model, inputTokens, outputTokens, costUsd, userIdHash(SHA256 16자), durationMs, retries, source, validationFailures`(:8-32).
- **호출처는 `saju-lifetime-service.ts` 단 한 곳**(24개 사이트). 즉 **대운 깊은풀이 챕터 파이프라인만** 로그를 남김.

### 6-2. DB 로그 테이블: **없음**
- LLM 호출용 `*_log`/`telemetry`/`usage`/`token` 테이블을 만드는 마이그레이션 부재. 유사명은 `notification_delivery_logs`(004), `dialogue_messages`(024)뿐 — 둘 다 LLM 호출 로그 아님.
- `ai_interpretations`(`0060`) 등 캐시 테이블은 `model`/`source`/`error_message`는 있으나 **토큰·비용 없음**, 본질은 출력 캐시.

### 6-3. 나머지 영역: 무계측
- 기본풀이/총평/올해/궁합/AI챗은 usage 로깅 전무. 공용 클라이언트 `openai-text.ts:170-177`가 `usage`를 `lastUsage`로 추출하지만 **`chapter-telemetry`만 소비**, 나머지는 폐기.

### 6-4. 운영자의 현재 조회 방법
- **대운 챕터만**: Vercel 런타임 로그에서 `chapter_run` grep → model/토큰/비용/해시유저. 단 **휘발성**(Vercel 보존기간), SQL 조회 불가, 실유저 식별 불가(16자 해시).
- **그 외 전 영역**: 조회 가능한 호출 이력 자체가 없음. 내구 아티팩트는 캐시된 *출력*(`ai_interpretations`/`ai_total_review`/`ai_yearly`/`ai_compatibility`/`dialogue_messages`)뿐 — 내용·model은 SQL로 보지만 **토큰/비용/지연/호출량은 불가**.

---

## 7. 운영 갭 / 관찰 (제안 아님, 사실 정리)

1. **환불 셀프서비스 부재** — 권한 회수 함수는 있으나 어드민 UI/엔드포인트 미연결 + Toss cancel 미구현. 환불은 전적으로 수동(개발자/대시보드 의존).
2. **결제 재시도/webhook 부재** — confirm 실패는 사용자가 재시도하는 수밖에 없음. Toss webhook 미수신 → 비동기 상태 동기화 없음.
3. **LLM 비용 관측 비대칭** — 대운 챕터만 telemetry. 실제 prod 비용(기본풀이/총평/올해/궁합/챗)은 OpenAI 대시보드로만 추정 가능(2026-05-25 LLM 비용 리포트와 정합).
4. **AI챗 분석 공백** — 채팅 사용량 일별/유저별 집계 없음. 운영 지표 대시보드도 챗은 볼륨 카운트 수준.
5. **audit:narrative-tone npm 미연결** — 운영 루틴에서 누락되기 쉬움.

---

## 부록 — 파일·라인 근거 인덱스

- 어드민 가드: `src/lib/admin-auth.ts:51`(isAdminUser), `src/app/admin/layout.tsx`, `migrations/028_admin_users.sql`
- 어드민 페이지: `src/app/admin/{operations,payment-funnel,reviews,policies,saju-feedback,push-ctr,myungri-validation,weight-tuning,saju-verify}/`
- 어드민 API: `src/app/api/admin/*/route.ts`(10개), 로직 `src/lib/admin/{operations-stats,payment-funnel-stats,sinsal-validation,weight-learning}.ts`
- 스크립트 wiring: `package.json:11-37`; audit 파일 `scripts/audit-*.mjs`(10개)
- 결제: `src/lib/payments/{catalog,toss,confirmation,bundle,funnel-log}.ts`, `src/app/api/payments/{prepare,confirm,entitlement}/route.ts`
- 환불 스캐폴딩: `src/lib/product-entitlements.ts:471-573`, `src/lib/report-entitlements.ts:224-229`
- AI챗: `src/app/api/ai/route.ts`, `src/lib/credits/ai-chat-access.ts:72`, `migrations/024_dialogue_history.sql`
- LLM 텔레메트리: `src/server/ai/chapters/chapter-telemetry.ts:79`, 호출 `src/server/ai/saju-lifetime-service.ts`, 공용 `src/server/ai/openai-text.ts:170-177`
- 운영자 테이블 조회: `src/lib/admin/*`(`.from()` 집계), `src/lib/reviews/queries`(reviews update), `src/lib/policies`(policy_versions)
- RLS: `migrations/001_initial.sql:50-55`
