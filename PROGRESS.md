# 간지사주 — 작업 진행 정리

> 최종 업데이트: **2026-05-26 (프론트 UX — 띠운세 입력 단순화·상세 기간별 콘텐츠 동적화 + 헤더 네비(PC 마이홈 드롭다운·모바일 MY 상단) + 리뷰 모달 정중앙 + 결제퍼널 500 픽스, #386~#389)**. 상세는 ↓ 첫 세션 섹션. 직전 세션: **#373~#384 (LLM 비용 캐시·텔레메트리 Phase 0 + 어드민 운영 Phase 1~3 + PDF 실데이터)** — 본편(평생리포트) read-through 캐시로 무캐시 비용 출혈 차단(#377) + 전 영역 LLM 텔레메트리 중앙 계측(#378) + 어드민 사용자 상세·검색(#379)·환불 자동화(Toss cancel 2단계 승인, #380)·LLM 비용 대시보드(#381) + PDF 목업→실데이터 전수검사(이름·대운곡선·12개월·LLM 9섹션 전문 P9, #382~#384). **상세: ↓ 첫 세션 섹션.** (이전: 2026-05-25 #364~#368 어휘·UI·12간지 선생 / 2026-05-24~25 #355~#363 today-detail·콘텐츠)
> 대상 도메인: `https://ganjisaju.kr` (canonical) · www / 간지사주.kr / xn--s39at50bo6fmwa.kr → 301 → canonical
> 브랜드: 간지사주 (2026-05-18 달빛인생 → 간지사주 통일 완료)
> 2026-05-22 종합 검수: `audit-reports/2026-05-22-comprehensive-audit.md` — 🟢 12 / 🟡 2 / 🔴 0 (점수 Phase 1~3 + 어휘 정책 + P0 6종 완료 · 잔존 🟡 2: 총평 25~35문장 enforce 미확인 / 대운 LLM 다양성 미검증). `audit:user-entitlements` exit 1은 인자 필수 CLI 오탐(`audit-reports/2026-05-22-user-entitlements-diagnosis.md`).

---

## 2026-05-26 세션 — 띠운세 입력 단순화·기간별 콘텐츠 + 헤더 네비 + 리뷰 모달 + 결제퍼널 500 픽스 (#386~#389)

> 프론트 UX 개선 4건 + 운영 버그픽스 1건. 모두 main 머지 → Vercel 자동 배포. **DB 마이그레이션 없음**(전부 코드/콘텐츠). 브라우저 렌더(Claude Preview)로 검증 후 PR.

### 띠운세 (#386 — 2개 커밋)
- **진입 단순화**: `/zodiac` 의 '생년월일로 내 띠 확인'이 사주 전체 폼(`/saju/new`: 출생시간·성별·출생지·닉네임·동의 멀티스텝)으로 보내던 비합리적 동선 제거 → 생년월일(+양/음력)만 받는 **인라인 펼침 입력**(신규 `zodiac-birth-check.tsx`). 제출 시 서버 액션(신규 `actions.ts`)이 **입춘 기준** 띠 계산(`deriveZodiacSlugFromBirthInput` 재사용, 음력→양력 변환) → `/zodiac/[띠]`. 시간·성별·출생지는 띠 판정에 불필요해 미수집.
  - 검증: 1990-05-15→말띠, **입춘 경계 1990-02-01(입춘 전)→뱀띠**(연도 기준 말띠가 아님).
- **상세 기간 탭별 콘텐츠 동적화**: 기존엔 점수·히어로 한 줄만 period(오늘/주/달/해)별로 바뀌고 '집중 포인트(`todayFocus`)·행동 제안(`action`)'은 '오늘' 단일 필드라 고정 → `ZodiacFortune` 에 `periodFocus`·`periodAction`(`ZodiacPeriodLines`) 추가, **12띠 전체 기간별 문구 작성**(naming-policy 준수: 한자·"결"·추상명사 신조어 금지). `zodiac/[slug]` §4·§5 를 period별 제목·내용으로, '올해 흐름' 카드는 올해 탭만 노출.
- **레이아웃·라벨**: '태어난 해로 더 보기'(연생 칩)를 히어로 아래 → 운세 콘텐츠(점수·집중포인트) 아래로 이동. 입력 폼 라벨(양력/음력·년/월/일) 제거(select `aria-label` 로 접근성 유지).
- 파일: `src/app/zodiac/{actions.ts,zodiac-birth-check.tsx,page.tsx}`, `src/app/zodiac/[slug]/page.tsx`, `src/lib/free-content-pages.ts`, `src/lib/profile-personalization.ts`(기존 재사용).

### 헤더 네비게이션 (#387)
- **PC 메가메뉴**: 우측 `/my` 아바타에 **hover 드롭다운**(마이홈 롤오버) 추가 — `MY_MENU_BLUEPRINT` 재사용(/my 페이지와 동일 항목), `top:100%` 부착으로 hover 연속성(갭 깜빡임 방지). 로그인 시만 노출, 비로그인은 현행 로그인/회원가입 유지. (`mega-nav.tsx`/`.css`)
- **모바일 시트**: MY(계정) 섹션을 시트 하단 → **검색창 위(맨 위)**로 이동, 비로그인 시 '아이디·비밀번호 찾기'(`/login?mode=recover`) 보조 링크 추가. (`mobile-nav-sheet.tsx`/`.css`)
- ⚠️ PC 아바타 드롭다운은 **로그인 상태에서만** 렌더 → dev 비로그인 세션으론 실물 hover 미검증(마크업·타입·CSS 검증 완료, 로그인 후 확인).

### 리뷰 모달 (#388)
- 후기 작성 모달이 모바일에서 화면 하단(`items-end`)에 뜨던 것을 **정중앙(`items-center`)** 레이어로. `max-h-[90vh]`+세로 스크롤로 긴 내용 잘림 방지. (`review-write-dialog.tsx`)

### 결제 퍼널 500 (#389 — 버그픽스, systematic-debugging)
- **증상**: `/admin/payment-funnel` "데이터를 불러올 수 없음". API(`/api/admin/payment-funnel`)가 3일 내내 지속 500.
- **진단(증거 기반)**: ① `payment_funnel_events` 테이블은 prod 존재(`supabase migration list` 030 Local=Remote — **drift 아님**, 초기 가설 기각). ② 인증(`getCurrentAdminCheck`)은 **service-role**로 admin_users 확인해 통과(403 아님). ③ 그러나 데이터 조회는 **사용자 세션(authenticated)** 클라이언트 → 030 테이블이 RLS만 있고 **테이블 GRANT 없어** 조회 차단 → 500. `refund`/`push-ab-policy` 의 guard(사용자 세션)→데이터(service-role) 패턴 미준수가 차이.
- **수정**: 데이터 조회를 **service-role**로 전환(코드 1파일, DB 변경 없음 → drift 위험 회피) + 원인 추적용 `console.error` 안전망. (`src/app/api/admin/payment-funnel/route.ts`)
- ⚠️ **검증 대기**: prod 배포 후 `/admin/payment-funnel` 정상 표시 확인 필요(admin 세션). 안 되면 `console.error` 로그로 후속(추측 없이).

### 교훈
- 단일 목적 기능(띠운세)은 **진입 입력을 그 목적에 필요한 최소(생년월일)**로 — 공용 폼(`UnifiedBirthInfoFields`) 재사용이 과입력을 부른다.
- 기간 탭 UI는 **모든 종속 콘텐츠가 period에 반응**해야 의미. 일부만 바뀌면 "왜 안 바뀌냐" 인지.
- **admin 데이터 조회는 service-role 패턴**(getCurrentAdminCheck 통과 후) — RLS만 있고 GRANT 미비한 테이블을 사용자 세션으로 읽으면 500. 레퍼런스: `refund`/`push-ab-policy`.
- 디버깅: "테이블 부재(drift)" 같은 그럴듯한 가설도 `migration list` 같은 **증거로 검증**해야 — 이번엔 기각됐다(추측 단정했으면 오진).
- squash 머지 시 `--subject` 직접 지정하면 `(#PR)` 자동 부착 안 됨 → 생략 시 자동 부착(#389에서 확인).

---

## 2026-05-25~26 세션 — LLM 비용 캐시·텔레메트리(Phase 0) + 어드민 운영(Phase 1~3) + PDF 실데이터 전수검사 (#373~#384)

> 비용 출혈 차단 → 운영 자동화 → PDF 실데이터화의 3단계 작업. 모든 코드 작업은 **main 기반 worktree(`.claude/worktrees/*`)에서 격리** → TDD → PR → CI(typecheck·test·Playwright·Vercel preview) green → squash 머지 → Vercel 자동 배포. **DB 마이그레이션은 CI 자동 아님 → supabase CLI 수동 적용**(041·042는 적용, 043은 적용 대기 — ↓ 마이그레이션 상태).

### 감사 리포트 · 정리 (read-only / 하우스키핑)
- **#375 LLM 호출·캐시·비용 구조 진단** (docs, read-only): LLM 호출 지점·캐시 계층(L1 결정론 / L2 캐시 / L3 실시간)·비용 출혈 지점 진단. **본편(대운 평생리포트)이 무캐시라 매 조회·PDF마다 재생성 → 비용 출혈 핵심**으로 지목 → Phase 0a의 근거.
- **#376 어드민·운영 자산 인벤토리** (docs, read-only, `audit-reports/2026-05-25-admin-inventory.md`): 어드민 6개 자산 인벤토리 → Phase 1~3의 근거.
- **#354 PROGRESS.md → HTML 렌더 스크립트** (tooling): `scripts/render-progress.mjs` + `npm run progress:html`. 하이브리드 워크플로우(md 편집 → html 렌더). **PROGRESS.html은 gitignore 로컬 산출물 — 보존 대상**.
- **#341 2026-05-23 세션 기록 + 가격 정책 개편안 초안** (docs): add/add 충돌(`pricing-proposal.md`)은 main의 완성본 유지(`--theirs`), PROGRESS만 머지.
- **폴더 구조 진단·정리**: `.claude/worktrees/*`에 머지 완료된 잔재 누적 + codex/claude 혼재로 "어디가 진짜 작업 폴더?" 혼선 → **메인 트리(`/Users/kionya/ganji-saju`)로 전환 + 머지된 worktree 잔재만 정리**. PROGRESS.html은 삭제하지 않고 보존.

### 비용 출혈 차단 — Phase 0
- **#377 대운 본편 read-through 캐시 (Phase 0a)**: 신규 `041_ai_lifetime_interpretations`. **content-addressed 캐시 키 = reportHash + feedback + targetYear**(스펙 갭 보강), 30일 TTL, read-through, `source=openai|fallback|cache`. `saju-lifetime-service.generateLifetimeInterpretation`이 캐시 경유. → 무캐시 재생성 비용 차단. 041 테이블에 `input_tokens/output_tokens/cost_usd` 컬럼 선반영(Phase 0b 연계).
- **#378 LLM 텔레메트리 시드 (Phase 0b)**: 신규 `042_ai_llm_runs`. **중앙 계측 — `generateAiText` 한 곳**에서 `feature/userId/telemetryStore`로 `recordLlmRun`(성공 + fallback + **캐시 hit**) 기록. `console.log` + **DB insert(비차단 await)** 둘 다. 챕터 포함 전 영역. 라이브 검증(feature×source별 count·cost 집계 정상).

### 어드민 운영 — Phase 1~3 (사용자 원안 로드맵)
- **#379 어드민 사용자 상세 + 검색 (Phase 1)**: `/admin/users`(검색) + `/admin/users/[id]`(회원정보·사주데이터·결제이력·AI챗 사용량·**LLM 캐시 hit 통계**·환불 가능 여부). 데이터 레이어 + 순수 로직 TDD. (typecheck 교훈: `gender`는 `reading.input.gender` — SajuDataV2 union엔 없음.)
- **#380 환불 자동화 (Phase 2 · 마찰점 1 본체)**: 신규 `043_refund_requests`. **2단계 승인 — admin은 환불 요청, super_admin만 최종 승인**. 상태머신(`requested→processing→completed/failed/revoke_pending/rejected`). Toss `cancelPayment` + **Idempotency-Key(재시도 안전)**. `/api/admin/refund` 원자적 트랜잭션 + 상세 페이지 환불 버튼/pending UI. 오케스트레이션 순수 로직 TDD. ⚠️ **실제 Toss 환불은 사람(super_admin)이 실행 — 빌드 + 목 테스트만 수행**.
- **#381 LLM 비용 대시보드 (Phase 3)**: `/admin/llm-cost`. **신규 테이블 없이 `ai_llm_runs` 재활용**(원안의 `llm_usage_logs` 중복 테이블 회피 — Phase 0b가 이미 구축). feature/source별 count·token·cost 집계 + 순수 로직 TDD.

### PDF 전수검사 — 목업→실데이터
- **#382 PDF 목업→실데이터 + 결제 LLM 깊은 풀이 반영**: 진단 — `buildPdfModel`이 `reading.metadata.displayName`(미populate)→**'달빛이' 목업 이름**, generic 서사, **결제한 LLM 본편 미반영**의 하이브리드. 수정 — `resolvePdfSubjectName`(input.name 우선, never '달빛이'), print 페이지가 `generateLifetimeInterpretation`(캐시) 호출 → `interpretation`을 `buildPdfModel`에 주입, LLM 9섹션을 PDF 슬롯에 `firstSentences()`로 **레이아웃-bounded** 매핑. `pdf-report-text.ts` 순수 헬퍼 + TDD.
- **#383 대운곡선·12개월 키워드 실데이터 + LLM 9섹션 전문 페이지(P9)**: 대운 곡선 = `cycleFortuneScore`(오행 생극: 인성85/비화80/식상76/재70/관66), 12개월 = `monthKeywordForScore`. **결정론 유지(가짜 숫자 아님)**. 결제 본편이 있으면 9번째 페이지(`deepReading`)에 **LLM 9섹션 전문 노출**.
- **#384 PDF 페이지 번호 분모 동기화**: #383의 P9 추가로 footer가 "PAGE 9 / 8"(분모 8 하드코딩) 버그 → `totalPages = deepReading ? 9 : 8`를 모든 footer 분모에 주입. 무료/구버전 `/ 8`, 결제 본편 `/ 9`.

### UX (앞선 머지)
- **#373 결제 내역(현금) 전면 노출**: 단건·평생·코인팩·멤버십 모두 표시.
- **#374 회원가입 생년월일 입력 통일**: 사주 입력폼과 동일한 `UnifiedBirthInfoFields`로 교체.

### 마이그레이션 상태 (⚠️ 수동 적용 — CI 자동 아님)
- `041_ai_lifetime_interpretations`(Phase 0a) · `042_ai_llm_runs`(Phase 0b): **적용됨**(라이브 검증 통과).
- `043_refund_requests`(Phase 2): **작성 완료 · prod 수동 적용 대기**(`supabase` CLI). 코드는 테이블 존재를 가정하므로 환불 기능 사용 전 적용 필수.

### 운영 후속 (코드 밖 — 사용자 작업)
- `043_refund_requests` prod 적용(supabase CLI).
- **super_admin 지정**(`admin_users.role` 또는 `ADMIN_USER_IDS` 부트스트랩) — 환불 최종 승인 권한.
- **결제 계정으로 PDF 시각 확인**: 실명 노출 / 대운 곡선이 사주별로 달라지는지 / P9 9섹션 레이아웃·페이지네이션(PAGE 7/9·8/9·9/9). **로컬 Turbopack symlink 제약으로 로컬 PDF 렌더 미검증** → 배포 빌드에서 확인.
- 실제 Toss 환불 실행은 super_admin 수동(나는 미실행).

### 교훈
- **본편 캐시 키**는 `reportHash + feedback + targetYear` — feedback/targetYear 누락 시 캐시 오염(스펙 갭이었음).
- **Phase 0b가 이미 텔레메트리 테이블을 구축** → Phase 3는 중복 테이블 없이 대시보드만(원안의 `llm_usage_logs` 폐기).
- **PDF는 모델 주도 렌더**(`buildPdfModel` 출력이 그대로 렌더로 흐름) → 글로서리·사전이 아니라 **빌더가 조립한 실제 출력 문장**으로 검증해야 함.
- 고정 A4 슬롯에 LLM 가변 텍스트를 넣을 땐 `firstSentences(n)`로 길이 bound(레이아웃 안전).

---

## 2026-05-25 세션 — 어휘·문장 품질 + UI 정합 + 12간지 선생 리브랜드 (#364~#368)

> 사용자 production 스크린샷 제보로 시작: 오늘운세/자세히보기 한자(己亥)·비문, 메인 카드 검은 배경. 5개 PR로 처리. 모든 코드 작업 main 기반 worktree → PR → CI green → squash 머지 → Vercel 자동 배포.

### 머지 완료
- **#364 어휘·문장 품질**: (A) today-detail 마감문장 한자 일진(己亥)→한글 독음(`formatTodayDateMarker`). (B) 평생리포트 SHORTAGE/EXCESS 사전 reason 메타포 오행어(새싹/햇살/흙/쇠/물 기운)→표준 "목/화/토/금/수 기운" + "기운" 중복 제거(10건). (C)(D) 오늘운세 plain 티어 비문("표현 쪽을 챙기면 감정이 덜 엉킵니다"/"표현이 비면"/"생각이 내 성향과 같은 흐름")을 일상어로 자연화. **핵심 교훈: 오늘운세 본문은 "기운"조차 금지(plain 티어, 테스트가 강제) → lifetime-report만 "X 기운".** 회귀 테스트 추가(vocab-quality·practical-action-vocab).
- **#365 홈 카드 배경 흰색 복원**: #351/#352 다크 통일 revert(`gangi-market.tsx`). footer 검정(#350 globals.css)은 분리·유지.
- **#366 홈 카드 제목 선생 병기**: `GANGI_HOME_CARDS` 10개 "기능명 · 선생"(사용자 지정 매핑).
- **#367 12간지 선생 3명 리브랜드 + 메뉴 일치**: 재물닭→**별닭**(별자리)/손금멍→**상담멍**(고민 상담)/이동말→**길일말**(좋은날·택일). `dialogue-experts`(topic·keywords·answerFrame·RAG 오버레이)·`moonlight`·`gangi-ui`·메가메뉴 대화탭 일관 변경(slug/id/zodiac 라우트 유지). ⚠️ 기존 재물운·이동운·손금 대화 주제 의도적 대체. 메가메뉴(PC/모바일)·푸터 서비스명도 홈카드와 "기능명 · 선생" 일치. 관상원·복돼지선생 유지. `route.test.ts` 단언 갱신.
- **#368 V2 엔진 오행 라벨 표준화**: `FRIENDLY_ELEMENT_LABEL`(나무/불/땅/쇠/물 기운)→표준 "X 기운"(`saju-data-v2-upgrade` 모던 풀이 반영). fixture 스펙 2건 동반 갱신.

### 정합성 메모 — 아래 옛 "미해결/미착수" 상태 갱신
- ✅ **궁합 입력 폼 잘림**(2026-05-24 "미해결 1") → **#349(spacer CTA clearance)로 해결·머지됨**.
- ✅ **footer 회색**("미해결 2") → **#350(z-index로 앰비언트 오버레이 위)으로 해결·머지됨**.
- ◐ **사이트 네비/홈 카드 통일**("미착수") → #351~#353(다크 통일·별자리 뒤로가기)로 일부 진행 후, #365에서 카드 다크는 흰색으로 되돌림(사용자 요청).
- ✅ **점수 Phase 2~7**(하단 §4 Tier 표 SC2~SC5 ⬜) → #305/#307~#312/#314로 **이미 완료·배포**됨(표가 stale).
- ✅ **lifetime 환불 "회수 함수 없음"**(아래 가격정책 (b)) → `revokeProductEntitlement`·`payments/bundle.ts` 일괄회수 **존재**(#342).
- ⬜ 여전히 열림: 가격 제안서 §3 미작성 · 코인 만료 정책↔구현 불일치(expiry/cron 없음) · today-detail 중복 과금 환불(운영) · audit 🟡 2(총평 문장수 enforce·대운 LLM 다양성).

### 후속
- 선생 명칭: 관상원·복돼지는 주제 부합으로 유지. 추가 변경 시 별도 PR.
- 시각 확인 권장: #365 카드 흰색·footer 검정 / #366·#367 긴 제목(메가메뉴·푸터) 줄바꿈 / #367 `/dialogue` 3선생(별닭·상담멍·길일말) 페이지.

---

## 2026-05-24~25 세션 — today-detail 결제 정합성 완결(#356) + 콘텐츠 대확충(궁합 LLM·띠운세·꿈해몽)

> 메인 작업 디렉토리는 `docs/progress-pricing-2026-05-23` 브랜치 유지. 모든 코드 작업은 **main 기반 worktree(`.claude/worktrees/*`)에서 격리** → PR → CI(typecheck·test·Playwright·Vercel preview) green → squash 머지 → Vercel 자동 배포. (이 PROGRESS.md 작성 외 docs 브랜치 미접촉.)

### 머지·배포 완료
- **today_fortune_feedback 테이블 복구** (SQL Editor, 코드 PR 아님): 오늘운세 피드백 "평가하기"가 PostgREST `Could not find the table 'public.today_fortune_feedback' in the schema cache` 오류. 코드·마이그레이션(023)은 존재하나 **prod DB에 테이블 부재**(`migration list`엔 023 applied인데 카탈로그엔 없는 drift). 023 SQL을 Supabase SQL Editor에서 직접 실행 + `NOTIFY pgrst 'reload schema'`로 복구. ⚠️ **교훈: DB 마이그레이션은 CI 자동 아님 → supabase CLI 수동 적용. main 머지/Vercel 배포로 스키마 반영 안 됨.**
- **#355 피드백 raw 오류 노출 fix**: `ml-feedback` API가 PostgREST raw 영문 오류를 사용자 화면에 그대로 반환 → 고정 한국어 안내만 반환 + raw는 `console.error` 서버 로그. `route-helpers.feedbackSaveErrorResponse` 분리 + 단위테스트(누출 방지 단언).
- **#356 today-detail 결제 정합성 완결** (핵심·P0): #346이 결제 grant/조회를 안정 `readingKey` 기준으로 옮기고 `checkTodayDetailAccess`(단일 읽기)를 도입했으나 **unlock 라우트만 옛 `today:${sourceSessionId}`(세션마다 가변) 조회로 남아** "이미 구매 ↔ 풀이열기 누르면 무료결과로 되돌아감"의 직접 원인. (한 계정이 **6회 결제·6개 다른 scope_key**로 데이터 확인.)
  - Layer 1: unlock GET/POST 권한 판정을 `todayDetailEntitlementScopeKeys`(readingKey 우선 + legacy readingId) + **같은날(KST) fallback**으로 통일(entitlement API와 동일). 신규 `hasTodayDetailEntitlementForDay`. → readingKey 해시 드리프트·과거 readingId 결제분도 당일이면 인정.
  - Layer 2(근본): today-fortune 생성이 매 요청마다 새 reading(UUID) INSERT → `sourceSessionId` 휘발. `findReadingByInput`로 동일 사주 reading 재사용(전체 readingKey 일치).
- **#357 후속 감사/검증** (docs): today-detail 중복결제 감사 SQL + score-factor(사주풀이 550원) 정합성 검증 → 읽기·쓰기 모두 `score:${readingKey}:${factorId}` 동일 스코프, 별도 휘발성 unlock 경로 없음 → **이상 없음(수정 불필요)**.
- **#358 콘텐츠 보완 로드맵 + 궁합 LLM 활성**: 궁합·띠운세·꿈해몽 로드맵 + 확정 결정 문서. **궁합 깊은 풀이 LLM 프로덕션 활성** — `OPENAI_INTERPRET_COMPATIBILITY=1`(Vercel prod env 설정 + 재배포). #345로 코드는 있었으나 **플래그 OFF·`.env.example` 미문서화**라 무료·유료 모두 결정론 fallback(무료 4축 재포장)만 보던 게 "궁합 내용 안 바뀐 느낌"의 원인. 플래그 문서화.
- **#359 띠운세 연생별 풀이**: 12지 × 5연생 = **60편**. `ZodiacFortune.byYear`(간지·독음·오행·풀이·행동조언) + `/zodiac/[slug]?birthYear=` 연생 칩 UI(라우트 폭증 없음). `EXPECTED_BY_YEAR` 표로 간지 정확성 강제, 한자·금지어 전수 가드.
- **#362 띠운세 같은-오행 표현 다양화**: 같은 천간 오행 연생이 띠 달라도 같은 문장틀 쓰던 문제 → 오행별 12지 **1:1 비유 배정**(화=화롯불/횃불/촛불/등댓불/불꽃놀이…)으로 60편 재작성(간지·길이·톤 유지).
- **#360 꿈해몽 풍부화(phase1+2)**: 구조 강화(`fortune` 길/흉/중립 뱃지·`action` 행동가이드·`detailSlug` 검색↔상세 연결) + 사전 **33→206**. 흉몽은 "주의·점검 신호" 순화 톤(공포·단정 회피) + "민속·상징 해석, 단정 아님" 안내.
- **#361 꿈해몽 추가 확충**: 206→**304**(+100, 동물·자연·사물·인물·행동·신체·음식 6카테고리 고루, 중복 0).

### 추가 머지·배포 완료
- **#363 띠운세 기간별 한 줄 + 기간탭/연생칩 스크롤 고정**: 기간 탭(오늘/주/월/년)이 점수·라벨은 바꾸나 헤드라인은 `item.summary` 고정 + 탭/연생칩 클릭 시 화면 맨위로 스크롤되던 2건. → `ZodiacFortune.periodLines`(12지×4=48문장)로 헤드라인을 `periodLines[period]` 교체(라벨-내용 일치) + 기간탭/연생칩 `<Link scroll={false}>`. typecheck 0 / 667 테스트.

### 운영 후속 (코드 밖)
- ⚠️ **today-detail 중복 과금 환불**: 감사 SQL(`docs/superpowers/plans/2026-05-24-today-detail-followups.md`)로 다건 결제자 산출 → **Toss `paymentKey` 기준 중복분 부분환불**(1건은 정상 이용분 제외). 예: 본 사례 계정 6건 중 5건 ≈ 2,750원.
- 배포 후 재테스트: 오늘운세 자세히보기(결제 정상화)·궁합(LLM 풀이)·띠운세 연생 칩·꿈해몽 검색.

### 참고
- 설계/계획 문서: `docs/superpowers/specs/2026-05-24-*` (today-detail 스코프, 콘텐츠 로드맵), `docs/superpowers/plans/2026-05-24-today-detail-followups.md`.
- main 진행: #355→#356→#357→#358→#359→#360→#361→#362 순 머지(최신 `10a4bd0` 시점 이후 갱신).

---

## 2026-05-24 세션 — 결제 무한반복 fix + 온보딩 제거 + 궁합입력 잘림(미완) + footer 회색(미해결)

### 머지·배포 완료
- **#346 결제 무한반복 fix** (production 배포 완료): "오늘 자세히보기"(today-detail) 권한이 불안정한 reading id(slug, 매번 바뀜)에 묶여, 사주 재생성·경로 교차 시 결제해도 권한을 못 찾던 P0. `product-scope.ts`의 today-detail scope를 **readingKey(생년월일 결정적·안정)** 기준으로 통일 + `today-detail-access.ts`에 `todayDetailEntitlementScopeKeys`(readingKey 우선 + legacy readingId 병행) + coin 3키. entitlement API·checkout을 `checkTodayDetailAccess`로 통일. dead code(entitlement/route-helpers) 제거.
- **#347 온보딩 강제 redirect 제거** (배포 완료): `app/page.tsx`에서 `moonlight:onboarded` 쿠키 미보유 시 `/onboarding` 강제 redirect 제거. 온보딩은 4슬라이드 인트로 carousel(필수 데이터 X)이라 제거해도 기능 영향 0. `/onboarding` 라우트·컴포넌트는 유지(분리).
- **#348 궁합 입력 폼 하단 잘림 fix** (배포됐으나 **여전히 잘림 — 미해결**): `app-shell.css`의 `:has(footer) { padding-bottom:0 !important }`가 main pb를 덮어, 하단 fixed CTA(약 101px)가 폼 마지막(출생지 안내)을 가림. `compatibility-input-client.tsx` AppPage에 `pb-36 md:pb-0` 추가했으나 production 여전 잘림.

### 미해결 — 다음 세션 최우선
1. **궁합 입력 폼 잘림 (재발)**: #348의 pb-36이 효과 없음. production HTML 분석 결과 `compatibility-input-client.tsx`에 **AppPage가 2개** 존재(`pb-36 md:pb-0` 적용된 것 + pb-36 없는 것). **실제 보이는 입력 폼 AppPage가 fix 안 된 쪽일 가능성**. → `grep -n "AppPage" src/features/compatibility/compatibility-input-client.tsx`로 로딩/폼 분기의 AppPage들을 모두 찾아, 실제 입력 폼 AppPage에 CTA clearance를 적용해야 함. 구조: CTA는 line ~851 `fixed inset-x-0 bottom-0`, AppPage는 app-shell-content 안, footer(SiteFooter)는 main 안(app-shell.tsx:41). app-shell.css의 `:has(footer)` pb 0 !important가 main pb를 덮으므로 보이는 폼 컨테이너 AppPage에 직접 pb 부여가 정답.
2. **footer 회색 (장기 미해결·미궁)**: `site-footer.tsx` 배경 inline `#000000` + `globals.css:18` `footer.site-footer-redesign{background:#000!important}` 둘 다 검정. computed `backgroundColor=rgb(0,0,0)` 확인. 그런데 화면(production·localhost, 사용자 육안+playwright 헤드리스 모두) 회색. **Dark Reader 아님 / Chrome 강제 다크(Auto Dark Mode) 끔 확인 — 둘 다 원인 아님.** top-layer ::backdrop·전체 가상요소·오버레이·합성 속성(opacity/filter/blend) 모두 배제. → **다음: 사용자 실제 브라우저 개발자도구로 footer 요소의 Styles/Computed `background-color`를 직접 확인(스크린샷). production(ganjisaju.kr) vs localhost 어느 쪽인지도 구분.** 자동 도구로는 코드 #000만 확인되고 화면 회색 원인 규명 실패.

### 확인 완료 (수정 불필요)
- **대운(10년 흐름)**: 의도적 무료 설계(`saju/[slug]/deep` 주석 — AI 평생리포트 49,000원 upsell 미끼). 게이팅 없음. 화면의 "무료" 표시 정상.

### 미착수
- **사이트 전반 네비게이션 개선**: 홈 하단 검은 카드(오늘운세·사주풀이) 스타일 통일 + 클릭 시 다음 페이지 바로 이동 + 모든 화면 이전/다음 네비게이션 추가. (사이트 전반 큰 UI 작업, 별도 세션 권장)

### 환경 참고
- 메인 작업 디렉토리 `/Users/kionya/ganji-saju` 현재 브랜치 `docs/progress-pricing-2026-05-23`. main 최신 `62b6178`(#347까지 머지, #348도 머지됨). 검증용 dev server는 메인에서 PORT 3000으로 띄웠음.
- worktree에서 dev server는 Turbopack이 심볼릭 node_modules를 거부함 → 메인에서 dev 실행 권장.

---

## 다음 작업 (2026-05-23 이어서 — 가격/결제 정합성)

사용자가 가격 정책 비일관성 지적(총운 무료 / 대운·오늘자세히 550 / 분야 990 / 좋은날 1,900 / 올해 3,900 / 보관형 49,000 — 구조 어색). 진행 순서:

**(a) 가격 정책 개편안 문서 완성** — `docs/payments/pricing-proposal.md` (작성 중·미완성, 출력 중단됨). 구조 개선 골자:
- 단건 최고가(3,900) ↔ 보관형(49,000) 사이 빈 중간 구간을 **묶음(번들) 상품(1만원대)** 으로 연결
- 콘텐츠 지속성/범위 비례 차등(현재 `taste_score_factor` 550 일괄 → 대운 등 장기 콘텐츠 상향)
- 결제 경로 단일화(코인 vs 단건 현금)
- 멤버십(`membership_*`)에 풀이 unlock 혜택 연결(현재 AI 대화 코인 전용이라 분리됨)
- 보관형 49,000 재검토

**(b) 코드/표기 P0 정합성 정비** (근거: `docs/payments/product-catalog.md §2`):
- 이중 결제 경로 — 동일 기능(예: 월간달력 1,900원 단건 = 2코인)이 코인 차감 + 단건 현금 양쪽 노출 → 통일/분리
- 화면 라벨 ↔ `catalog.ts` 표기 불일치 — 예: 화면 "올해흐름"(990?) vs catalog `taste_year_core` "올해 핵심 3줄"(3,900) → 통일
- `lifetime_report`(49,000) **환불 인프라 부재** — 환불 페이지·entitlement 회수 함수 없음 → 환불 후에도 열람 가능. revoke 함수 + 환불 UI 추가
- 코인 만료 정책 불일치(FAQ "1년 유효" vs DB `user_credits` 만료 컬럼/cron 없음=영구) — 정책/구현 중 택1 (§2.3)

> ⚠️ 세션 메모: 운세+결제 상세를 채팅으로 길게 출력하면 자동 콘텐츠 안전필터 오탐으로 응답이 truncation/차단됨. → 상세 표·수치는 **문서 파일에 기록**, 채팅은 요약만.

---

## 0. 2026-05-22 (점수 결제 연동 세션) — Phase 2+3 스펙 빌드(#314) + score-factor per-factor 550원 결제 연동(#315) + 결제 동의 무한루프 fix + 레거시 정리(#316)

붙여넣은 `phase-2-3-task.md` 스펙(LockGate per-factor 550원 모델)대로 점수 UI 를 신규 빌드(#314 머지)하고, 그 LockGate "풀이 보기" 를 **실제 Toss 550원 결제 + 항목(F1~F5) 단위 해제**로 연결(#315). 작업 중 발견한 **결제 동의 체크박스 무한 렌더 루프(기존 버그, 모든 checkout 영향)** 를 근본 수정하고, score-factor 권한을 위한 **마이그 038** 을 prod 에 적용. 마지막으로 스펙 모델로 대체된 **레거시 점수 컴포넌트 4종을 제거**(#316). #314 머지 완료, #315·#316 PR open(머지 대기).

### 0.1 PR 누적 표 (#314 머지 · #315·#316 open)

| PR | commit | 상태 | 내용 |
|----|--------|------|------|
| #314 | `14b0071` | 머지 | **Phase 2+3 스펙** — LockGate per-factor(550원) 모델 + 점수 UI(원형 SajuScoreCard·ScoreBreakdownCard·OhaengChart 막대·LifetimeKeysCarousel) + v4 `@theme` 토큰(score-*/ohaeng-*) |
| #315 | `e68803a` | open | **score-factor 결제 연동** — catalog/product-scope/checkout/LockGate/score-factor-access + 결제 동의 무한루프 fix + 마이그 038(NOT VALID) |
| #316 | `23eed0f` | open | **레거시 점수 컴포넌트 제거** — SajuScoreGauge/SajuScoreBreakdown/SajuOhaengBalance/SajuOhaengChart + 배럴 정리(–281 라인) |

### 0.2 Phase 2+3 스펙 빌드 (#314, 머지)

- 붙여넣은 스펙 기준 신규 모델: `LockGate`(무료 🔒 → 결제 모달 / 유료 자세히→ 링크), 원형 `SajuScoreCard`(rAF `useCountUp`), `ScoreBreakdownCard`(F1~F5 막대 + per-factor `LockGate`), `OhaengChart`(막대, 레이더 대체), `LifetimeKeysCarousel`.
- Tailwind v4 `@theme` 토큰(`--color-score-*` 5등급+soft, `--color-ohaeng-*` 5요소+soft) + `labels` 보강 — 동적 클래스 purge 회피 위해 **LITERAL 색상 맵**(`getScoreColorClasses`/`OHAENG_COLOR_CLASSES`).
- ※ 0-prev-3(#305)의 "Phase 2~3 시각토큰+UI" 와 구분 — 이번 #314 는 붙여넣은 스펙(550원 per-factor 모델)으로 **재정의된** 빌드.

### 0.3 score-factor per-factor 550원 결제 연동 (#315)

- **catalog**: `TasteProductId += 'score-factor'`, `taste_score_factor` 패키지(550원, `requiresSlug`).
- **product-scope**: `buildScoreFactorScopeKey` = `score:{readingKey}:{factorId}`, `parseFactorScope`, `resolvePaymentProductScope`/`buildPurchasedProductHref` 의 score-factor 분기.
- **LockGate** "풀이 보기" → `/membership/checkout?product=score-factor&slug&scope=F1&from=saju-result`.
- **checkout**: score-factor 상품 안내(점수 풀이 보기, 소액 풀이, dragon zodiac).
- **score-factor-access** `getSajuScoreFactorEntitlements(slug)`: F1~F5 entitlement 조회(방어적 all-locked). 결과 페이지 `ScoreBreakdownCard unlockedFactors` 로 항목별 잠금/해제.
- **키 일치 확인**: grant 경로(`confirm` → `grantTasteProductEntitlement('score-factor', score:{readingKey}:{factorId})`) ↔ read 경로(score-factor-access) 모두 `toSlug(reading.input)` 동일 키.

### 0.4 결제 동의 무한 렌더 루프 fix (기존 버그, #315 동봉)

- **증상**: `/membership/checkout` 진입 시 "Maximum update depth exceeded" 수백 건. `?plan=premium` 등 score-factor 무관 경로 포함 **모든** 결제 checkout 재현.
- **근본 원인**: `PaymentConsentCheckboxes` notify effect 가 `onValidChange` 콜백 identity 를 deps 에 포함 → 부모(`TossMembershipCheckout`)가 매 렌더 인라인 콜백 전달 → 콜백이 `setAcceptedKinds(새 배열)` 호출 → 부모 재렌더 → 새 콜백 → effect 재실행 → ∞.
- **수정**: `onValidChange` 를 ref 로 고정, notify effect 는 `[accepted, pkg]` 변경 시에만 실행(동의→버튼 활성 동작 유지). 서버 로그(재컴파일 후 0건) + 콘솔 카운터(토글 0건)로 검증.

### 0.5 마이그 038 — product_entitlements CHECK + score-factor (prod 적용)

- `product_entitlements.product_id` CHECK 에 `'score-factor'` 추가(없으면 grant `23514`).
- **드리프트 대응**: 전체 검증형 재생성 시 prod 레거시 product_id 행이 `23514`(violated by some row)로 실패 → **`NOT VALID`** 로 추가(신규 INSERT/UPDATE 강제 + 기존 레거시 행 grandfather). prod 적용 완료(Supabase SQL Editor).

### 0.6 레거시 점수 컴포넌트 제거 (#316)

- 스펙 모델로 대체돼 참조 0건이 된 `SajuScoreGauge`·`SajuScoreBreakdown`·`SajuOhaengBalance`·`SajuOhaengChart`(레이더) 제거 + 배럴 정리(–281 라인).
- 순수 로직 `getDominantOhaeng`/`getOhaengBalanceLevel` 은 오행 LLM 가이드가 계속 사용 → 유지. 소비자 0건이 된 나머지 lib export(`getScoreLevelToken`/`getBarFillPercent`/`computeOhaengRadarPoints` 등)는 전용 테스트 동반 제거라 **별도 후속 PR**로 분리.

### 0.7 검증 / 운영

- typecheck 0 · 단위 157 + spec 64 = **221 pass** · 메인 CI 게이트(Test·Typecheck·Build) #315·#316 모두 pass.
- 브라우저(dev): 결제 루프 0건, score-factor checkout 정상 렌더(점수 풀이 보기/550원).
- 마이그 038 prod 적용 완료. #315·#316 머지 시 결제→해제 라이브.
- 📦 release(예정): `2026-05-22 점수 per-factor 결제 연동 + 동의 무한루프 fix + 레거시 정리`

---

## 0-prev. 2026-05-22 (점수 풀스택 + 도크 fix 세션) — 점수 Phase 4~7 + 가이드 캐시 + LLM 활성화 + 무료/유료 경계 + 모바일 도크 (PR #307~#312)

점수 시스템을 **Phase 4~7 로 완주**(오행 레이더 → LLM 가이드 → 가이드 영속 캐시 → 실제 결과 페이지 연결 → 무료/유료 경계)하고, **운영(마이그 037 적용 + LLM 가이드 플래그 ON)** 까지 활성화. 추가로 사용자 보고 **모바일 도크 가림 버그**를 근본 수정. 6 PR 모두 main 머지 + 프로덕션 배포 완료. 점수 시스템이 기획→구현→배포→수익화 경계까지 라이브.

### 0.1 PR 누적 표 (#307 ~ #312, 6개)

| PR | commit | 내용 |
|----|--------|------|
| #307 | `05dd53a` | **Phase 4 오행 레이더** — `computeOhaengRadarPoints`(펜타곤 5축)·`getDominantOhaeng`·`getOhaengBalanceLevel`(순수, 10 유닛) + `SajuOhaengChart`(레이더 SVG) + 카드 통합 |
| #308 | `aa161be` | **Phase 5 오행 LLM 가이드** — `ohaeng-guidance/`(content·validator·cache·prompts·generate, 플래그 OFF 기본·결정론 fallback). total-review-validator `hardTextReasons`/`countGyeol` export 재사용(naming-policy 단일 소스) |
| #309 | `f3ea496` | **가이드 영속 캐시 + 마이그 037** — `ai_ohaeng_guidance_interpretations` + cache-store(in-memory+Supabase 방어적) + TTL 30일 + read-through('llm'만 저장) |
| #310 | `95392df` | **Phase 6~7 결과 페이지 연결** — `from-saju-data` 어댑터(한자→한글) + 결과 페이지 무료 게이지 + 프리미엄 전체 카드(lifetime 게이팅) |
| #311 | `2d51ec5` | **무료/유료 경계 강화** — 결과 페이지 `SajuScoreGauge` preview(등급명+🔒, 총점 미렌더=서버 컴포넌트라 HTML 미포함=진짜 페이월) |
| #312 | `9ae2806` | **모바일 도크 가림 fix** — footer 없는 페이지 dock-clearance 복원(`:has()` 분기) |

### 0.2 점수 Phase 4 — 오행 레이더 차트 (#307)

- `src/lib/saju-score/ohaeng-chart.ts`(순수): 펜타곤 5축(목 top·시계방향 72°) 좌표 + count 비례 데이터 폴리곤(`maxScale` clamp·0 나눗셈 방지), `getDominantOhaeng`(동점 시 목화토금수), `getOhaengBalanceLevel`(F4 0~20 → high/mid/low). 10 유닛.
- `SajuOhaengChart`(서버 컴포넌트): 그리드 펜타곤+스포크 + 데이터 폴리곤(도미넌트 색) + 오행별 꼭짓점/축라벨 + 균형 캡션. viewBox 여백으로 라벨 클리핑 방지. `SajuScoreCard` 오행 섹션에 레이더+막대 병행.

### 0.3 점수 Phase 5 — 오행 LLM 가이드 (#308)

- 신규 `src/server/ai/ohaeng-guidance/`(총평 LLM 파이프라인 lean 미러): types·content(input 빌더+결정론 fallback)·validator·cache(키+`isOhaengGuidanceLLMEnabled`)·prompts·`generateOhaengGuidance`(오케스트레이터: 플래그 OFF→fallback / ON→LLM(DI)→validate→재시도→실패 fallback). 20 유닛.
- validator 는 `total-review-validator` 의 `hardTextReasons`/`countGyeol` 를 export 해 재사용(한자 0·명리어 0·"X의 기운" 차단·자극/일일톤 0·"결" ≤1).
- env `OPENAI_INTERPRET_OHAENG_GUIDANCE`(기본 OFF). `SajuOhaengChart` 가 `guidanceText` 표시.

### 0.4 가이드 영속 캐시 + 마이그 037 (#309)

- `ohaeng-guidance-cache-store.ts`: `OhaengGuidanceCacheStore`(get/set) + in-memory(DI/테스트) + Supabase **방어적**(env/테이블 없으면 no-op·null) + TTL 30일 + read-through(`source='llm'` 만 read/write).
- 마이그 **037** `ai_ohaeng_guidance_interpretations`(036 동일 구조: cache_key+prompt_version UNIQUE, RLS 활성 service-role 전용, `guidance_text TEXT`). content-addressed → 오행 분포당 1회.

### 0.5 Phase 6~7 결과 페이지 연결 + 무료/유료 경계 (#310·#311)

- 어댑터 `from-saju-data.ts`: 엔진 `SajuDataV1/V2`(한자 기둥) → 점수 `SajuData`(한글). `ganzi-korean` 변환 재사용. 격국/용신/신강약 null 폴백, 길신·흉살·공망 기본값(결과 페이지 미보유), 시주 미상 빈문자. `computeSajuScoreFromData`. 6 유닛.
- **무료/유료 경계(최종)**: 결과 페이지(`/saju/[slug]`) = `SajuScoreGauge` preview(**등급명+🔒, 총점 미렌더**) + 프리미엄 CTA. 프리미엄(`/saju/[slug]/premium`) = 전체 `SajuScoreCard`(총점+내역 F1~F5+오행 레이더+해설) **lifetime 권한 게이팅**(비엔타이틀 시 blur+🔒). preview 는 서버 컴포넌트라 총점이 클라이언트 HTML 에 미포함(진짜 페이월).

### 0.6 모바일 도크 가림 버그 fix (#312)

- **증상**: footer 없는 페이지(`footer={false}` 6개: login/today-fortune(+loading)/credits(+loading)/reset-password)에서 하단 버튼이 고정 도크(z-40)에 가려지고 스크롤로도 못 올림.
- **근본 원인**(app-shell.css 모바일 미디어쿼리, 2026-05-20 변경): main 의 dock-clearance padding 을 일괄 0 으로 만들고 도크 여백을 `site-footer-redesign` footer 패딩에 위임 → footer 없는 페이지는 여백 0.
- **수정**: `:has()` 분기 — footer 있는 페이지는 0 유지(흰 공간 회귀 방지), 없는 페이지는 `var(--app-mobile-dock-clearance)` 복원. 미지원 브라우저는 규칙 무시(악화 없음). 브라우저 실측: /login·/today-fortune padding 0→117.6px·하단 버튼 도크 위로, 홈(footer) 무회귀.

### 0.7 운영 활성화

- 마이그 **037 프로덕션 적용**(Supabase 대시보드 SQL Editor, 멱등).
- **`OPENAI_INTERPRET_OHAENG_GUIDANCE=1`**(Vercel production) + 재배포 → **오행 LLM 가이드 라이브**. 엔타이틀 사용자 프리미엄 카드에서 생성, 캐시(037)로 분포당 1회. 실패 시 결정론 fallback.

### 0.8 정량 지표 / release

- 유닛 테스트 562 → **618**(+56). 점수 시스템 Phase 1~7 + 캐시 + 어댑터 + 도크 fix.
- 모든 점수 컴포넌트 사용자 화면 라이브(무료 등급 미리보기 / 유료 전체). 도크 가림 6개 페이지 해소.
- 📦 release: `2026-05-22 점수 시스템 Phase 4~7 + 가이드 캐시 + LLM 활성화 + 무료/유료 경계 + 도크 fix`

---

## 0-prev-2. 2026-05-21~22 Codex 세션 — 공개 상용화 P0 차단 이슈 제거 + clean main 배포

작업자: **Codex**. Claude Code 2026-05-21 10시 작업 스냅샷을 로컬 백업으로 보존한 뒤, Codex 작업 브랜치에서 공개 페이지 상용화 차단 이슈를 정리했다. 최종 배포/머지는 백업 커밋을 main 에 포함하지 않도록 `origin/main` 기준 clean 브랜치에 P0 커밋만 cherry-pick 해서 진행했다.

### 0.1 백업 / 브랜치 기준

| 항목 | 값 |
|------|-----|
| Claude 백업 브랜치 | `backup/claude-code-2026-05-21-1000` |
| Claude 백업 태그 | `claude-code-2026-05-21-1000` |
| 백업 커밋 | `df529d6 backup: Claude Code 2026-05-21 10시 작업 스냅샷` |
| 로컬 bundle 백업 | `.git/backups/claude-code-2026-05-21-1000.bundle` |
| Codex 작업 브랜치 | `codex/2026-05-21-1900-work` |
| clean 배포 브랜치 | `codex/2026-05-22-commercialization-p0` |
| main 반영 커밋 | `4ee2484 fix(commercialization): clear public P0 blockers` |

### 0.2 Codex P0 수정 범위

| P0 | 처리 내용 |
|----|-----------|
| 도메인 통합 | `src/proxy.ts`, `src/lib/site.ts` 기준 legacy host 를 `https://ganjisaju.kr` 로 **301** 정규화. path/query 보존. Unicode/Punycode 한국어 도메인 테스트 추가 |
| `/login` | "준비 중", "불러오는 중" 제거. 로고, 서비스 설명, 카카오 로그인, Google 로그인, 약관/개인정보 링크, 고객센터 이메일, 로그인 실패 문의 안내 노출. `next` 파라미터는 OAuth callback/email login 모두 유지 |
| `/credits` | 비로그인 상태에서도 코인팩, 정책, 로그인 CTA 노출. 로딩/준비 문구 제거. 중복 footer 제거 |
| `/today-fortune` | "오늘 흐름을 불러오는 중" 제거. loading 상태와 실제 폼 동시 노출 방지. 중복 footer 제거 |
| 멤버십 문구 | "대화 상담 무제한", "무제한" 계열 판매 문구 제거. 일/월 사용량 제한 + 공정사용정책 문구로 교체 |
| `/dialogue/appointment` | 30분 상담 100코인, 50,000원 상당, 보유/부족 코인, 추천 충전팩, 취소/노쇼/상담사 불참 환불 정책 표시. 실제 데이터 없는 경력/평점/상담건수 제거 |
| 결제 동의 구조 | 기존 중복 동의 블록 제거. `PaymentConsentCheckboxes` 단일 "결제 전 확인" 블록으로 통합. 구독은 다음 결제일/해지 방법/무료체험 여부 표시 |
| 개인정보처리방침 | OAuth, PG, LLM API, 호스팅, 분석도구 수탁자와 AI 프롬프트/응답 저장, AI 학습 활용/거부, 국외이전, 보유/파기/삭제 요청, 14세 미만 아동 처리 방침 보강 |
| 정책 URL | `/terms`, `/privacy`, `/refund-policy`, `/digital-content-policy`, `/subscription-policy`, `/coin-policy`, `/appointment-policy`, `/ai-disclaimer`, `/commerce-disclosure` 접근 가능한 bundled policy fallback 추가 |
| 금지 문구 테스트 | 공개 상용화 핵심 파일 대상 금지 문구 회귀 테스트 추가: 준비 중/준비중/로딩중/불러오는 중/결과가 없습니다/TODO/FIXME/placeholder/mock/dummy |

### 0.3 신규/주요 파일

- `src/lib/bundled-policies.ts` — DB 정책이 비어 있거나 낮은 버전일 때 사용할 9개 정책 기본 본문.
- `src/lib/public-commercialization-copy.test.ts` — 공개 상용화 페이지 금지 문구 및 로그인 필수 구성 회귀 테스트.
- `src/lib/policies.ts` — bundled policy fallback / DB 정책 우선순위 보강.
- `src/app/login/page.tsx` — Codex 기준 로그인 완성 화면 및 fallback 필수 구성 반영.
- `src/app/credits/page.tsx`, `src/app/today-fortune/page.tsx`, `src/app/dialogue/appointment/page.tsx` — 공개 핵심 유료 흐름 상용화 차단 문구 제거 및 고지 보강.

### 0.4 검증 결과

| 명령/검증 | 결과 |
|-----------|------|
| `npm test` | PASS — 157 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next 16.2.3, 184 static pages |
| `git diff --check origin/main..HEAD` | PASS |
| `npm run audit:mockup-placeholders:strict` | PASS — 의심 패턴 0 |
| 브라우저 검증 | `/login?next=%2Fcredits`, `/credits`, `/today-fortune`, `/dialogue/appointment`, `/privacy` 핵심 문구 확인 |
| 라이브 검증 | `https://ganjisaju.kr/login?next=%2Fcredits` HTTP 200, "준비 중"/"불러오는 중" 0건 |

### 0.5 배포 / 머지

- 원격 브랜치 푸시: `origin/codex/2026-05-22-commercialization-p0`
- main fast-forward merge: `0f0e4f4..4ee2484`
- main push 완료: `origin/main = 4ee2484`
- Vercel production deployment: `dpl_5qeqzzh9jbzTti3FBzAuJTdS8Dk9`
- Production URL: `https://ganjisaju.kr`
- Inspect URL: `https://vercel.com/ganji-sajus-projects/ganji-saju/5qeqzzh9jbzTti3FBzAuJTdS8Dk9`

### 0.6 운영 메모

- `backup/claude-code-2026-05-21-1000` 커밋에는 `.mcp.json`, `.claude/`, 대량 audit report, screenshots, design docs 가 포함되어 있으나 **main 에는 병합하지 않았다**.
- Codex P0 변경만 main 에 반영되어 롤백 시 `4ee2484` 이전 `0f0e4f4` 또는 백업 브랜치/태그를 기준으로 비교 가능하다.
- `npm run lint` script 는 현재 `package.json`에 없어 실행 대상 없음.

---

## 0-prev-3. 2026-05-21 (점수 UI 세션) — 점수 시스템 Phase 2~3: 시각 토큰 + UI 컴포넌트 (PR #305)

점수 시스템 Phase 1(계산 엔진 #303) 후속으로 **Phase 2(라벨/색상 시스템) + Phase 3(UI 컴포넌트)** 를 1 PR(2 원자 커밋)로 마무리. PROGRESS 로드맵 "Tailwind 토큰 → UI 컴포넌트" 구간. main 머지(squash `0f0e4f4`) + 프로덕션 배포 완료 — **단, 실제 사용자 페이지 미연결(컴포넌트만 추가)** 이라 사용자 체감 변화 없음. (시간순: 이 세션 이후 Codex 상용화 P0 세션이 main `4ee2484` 로 이어짐.)

### 0.1 PR (#305, squash `0f0e4f4`)

| 구분 | 내용 |
|------|------|
| Phase 2 | visual-tokens 단일 소스 + labels/ohaeng 파생 리팩터 + 유닛 11 |
| Phase 3 | 게이지·내역·오행·통합카드 4 컴포넌트 + /dev/saju-score QA 쇼케이스 |

### 0.2 Phase 2 — 점수 시각 토큰 단일 소스 (라벨/색상 시스템)

- 신규 `src/lib/saju-score/visual-tokens.ts`: UI 가 소비할 색상/라벨을 한 곳에서 관리(단일 소스).
  - 등급(5) `SCORE_LEVEL_TOKENS`(tailwind 클래스 6종 + SVG용 hex), 오행(5) `OHAENG_TOKENS`(hex + "X 기운"), 내역지표(F1~F5) `BREAKDOWN_FACTOR_META`(일상어 라벨·max 20·hex).
  - resolver `getScoreLevelToken`/`getScoreLevelTokenByTotal`(labels 임계값 90/75/60/45 동일)·`getOhaengToken`·`getBreakdownFactorMeta` + `getBarFillPercent`(0~100 clamp, max≤0 → 0).
- `labels.ts`/`ohaeng.ts` 를 토큰 파생으로 정리 — 색상 중복 제거, 공개 반환 shape 불변(`getLabel().color` 6필드 / `computeOhaengChart().colors|labels`) → 기존 562 테스트 그대로 통과.
- TDD: RED(모듈 부재) → GREEN(11 테스트) → REFACTOR(파생 단일소스). 라벨/설명 한자 0(naming-policy §2·§9).

### 0.3 Phase 3 — 점수 UI 컴포넌트 (서버 컴포넌트)

- 신규 `src/components/saju-score/`:
  - `SajuScoreGauge` — 총점 0~100 원형 SVG 게이지(반지름 52, 둘레 기준 dashoffset) + 등급 라벨(제목/부제/설명/면책).
  - `SajuScoreBreakdown` — F1~F5 막대(라벨·값/20·fill%·지표색). 표시값 정수 반올림(소수 노출 제거).
  - `SajuOhaengBalance` — 다섯 기운 상대 막대(최대치 기준) + 부족/과다 칩.
  - `SajuScoreCard` — `SajuScore` 하나로 게이지+내역+오행 통합.
- `src/app/dev/saju-score/page.tsx` — 컴포넌트 QA 쇼케이스(8 샘플, 등급 스펙트럼). **production `notFound()` + noindex**.
- 스타일 관례 준수: `app-*` CSS var + 인라인 hex(동적색 → Tailwind purge 무관). `'use client'` 불필요(순수 프레젠테이션).

### 0.4 검증

- 유닛 573(+11) green · node:test 157 · vitest 64(5파일) · **typecheck 0** · 회귀 0.
- 브라우저(`/dev/saju-score`): 등급별 게이지색 매핑(84·81=emerald / 72·68·67·61=blue / 59·54=amber) + dashoffset 점수 비례 + F1~F5 막대 + 오행 부족/과다 칩 + 콘솔 에러 0.
- CI: `Test, Typecheck, Build` ✅ · `Playwright smoke E2E (Phase 2A)` ✅ · Vercel 배포 ✅.

### 0.5 신규/변경 파일

- 신규: `saju-score/visual-tokens.ts`(+`__tests__/visual-tokens.test.ts`) · `components/saju-score/`(4 컴포넌트 + index) · `app/dev/saju-score/page.tsx`.
- 변경(파생 리팩터): `saju-score/{labels,ohaeng,index}.ts`.

### 0.6 메모 / 후속

- `saju-score-spec.md`/`phase-1-task.md` 는 미커밋(임시 기획 문서) — Phase 2/3 범위는 PROGRESS 로드맵 + 기존 코드 패턴 기준으로 확정.
- 컴포넌트 렌더 테스트는 리포에 0개(러너가 `.test.ts`만 발견) → 로직은 visual-tokens 유닛으로, UI 는 브라우저/Playwright 로 검증하는 관례 유지.
- **점수 Phase 4~7**: 오행 차트 UI → LLM 가이드 연계(`OhaengChartData.guidanceText`) → 무료/유료 경계 → **실제 사주 결과 페이지에 `SajuScoreCard` 연결**(현재 미연결, 최우선 후속).
- 📦 release: `2026-05-21 점수 시스템 Phase 2~3 — 시각 토큰 + UI 컴포넌트`

---

## 0-prev-4. 2026-05-21 세션 종합 — 사주 총평 LLM 풀스택 + 영속 캐시 + 어휘 정책 + 점수 Phase 1 (PR #299~#303)

사주 결과 *총평 탭* 을 결정론 7문장 단락에서 **LLM 3섹션(한 줄 요약 + 본문 4단락 + 평생 활용 3카드)** 으로 확장하고, 비용 최적화(영속 캐시) · 어휘 정책(naming-policy) · 점수 계산 엔진(Phase 1)까지 5 PR 로 마무리. 모두 main 머지 + 프로덕션 배포 완료.

### 0.1 PR 누적 표 (#299 ~ #303, 5개)

| PR | commit | 내용 |
|----|--------|------|
| #299 | 68ae221 | 총평 LLM 파이프라인 — _easy 도출 → 3섹션 병렬 생성 → §7 검증 10항목 → fallback. env 플래그 게이팅(기본 OFF). TDD |
| #300 | cf925e6 | 영속 캐시 — content-addressed(cache_key 해시) Supabase 테이블. 조회마다 차감 → 사주+컨텍스트당 1회 |
| #301 | 96a37d7 | naming-policy 어휘 정책 반영 — GANGUK 라벨 "결" 제거 · SIPSIN_SHORT · §12 정규식 검증 |
| #302 | e5a0335 | 어휘 최종 스펙 잔여 2건 — 격국 label 설명형 · 오행 "X의 기운" 차단 |
| #303 | 69029a0 | 점수 시스템 Phase 1 — F1~F5 계산 엔진 + 50 케이스 분포(평균 65.3) |

### 0.2 총평 LLM 파이프라인 (PR #299)

- 신규 모듈 `src/server/ai/total-review/` (types · content · build-input · prompts · generate · cache · 전용 OpenAI 클라이언트) + `lib/saju/total-review-validator.ts` + `saju-total-review-service.ts` + 컴포넌트 2종(`SajuTotalReviewNarrative`·`SajuLifetimeKeysSection`).
- 입력 `_easy` 도출: `dayMaster`·`sixtyGapja`·`fiveElements`·`yongsin`·`pattern` → 일상어. 강점/약점 3개씩 보강(sixtyGapja 부족분 패딩). deepStripHanja 로 한자 0.
- 3섹션 `Promise.all` 병렬 → validateTotalReview(§7 10항목) → hard 위반 시 deterministic(`buildSajuNarrative`) fallback.
- 🐛 발견·수정: `gpt-5.2-chat-latest` 가 `temperature` 미지원(400) → 전용 클라이언트에서 미전달.

### 0.3 비용 최적화 — 영속 캐시 (PR #300)

- 결과 페이지가 dynamic 렌더라 캐시 없으면 **플래그 ON 시 총평 조회마다 3 OpenAI 호출 차감**(새로고침·fallback 포함) — 문제 발견 후 캐시로 해결.
- `ai_total_review_interpretations`(마이그 036, `cache_key`+`prompt_version`, server-role RLS). read-through: hit→source `'cache'`, `'llm'` 만 write(fallback 미캐시). 30일 TTL. content-addressed → 사용자 무관 dedup.

### 0.4 어휘 정책 (naming-policy.md) 반영 (PR #301·#302)

- `naming-policy.md` = 최상위 어휘 권위. 오행 "X 기운" / 십성·격국·강약 원어+설명 / "결" 라벨·요약·카드 0회·단락 ≤1 / 한자 사주팔자 카드만.
- GANGUK_EASY 라벨 "결" 제거("본인 기운이 강한 편" 등) · SIPSIN_SHORT(십성 설명, "X의 결" 없는 버전) · 격국 label 설명형 · validator §12 정규식 7종 + 오행 "X의 기운" hard 차단.
- §12 검증: 실제 콘텐츠 위반 0건(매칭은 시스템 프롬프트 "금지 예시" 메타 참조뿐).

### 0.5 점수 시스템 Phase 1 — 계산 엔진 (PR #303)

- 신규 `src/lib/saju-score/`(10파일, 989줄): F1(일주)·F2(격국)·F3(용신)·F4(오행균형)·F5(합충신살) + `computeSajuScore` + 5단계 라벨 + 오행 차트 + 50 케이스 + 분포 검증.
- 십성→천간 *관계식 계산*(100엔트리 테이블 대신 오행·음양). 12운성 테이블. MVP 격국/용신 판정.
- 분포(§14 가중치 튜닝): 평균 60.9→**65.3** / 표준편차 12.5 / potential 10%·excellent 0%(≤15%). 결정론 100회 확인.
- **순수 계산 엔진만** — UI·LLM·결제 미포함(Phase 2~7 후속).

### 0.6 신규 DB / 플래그 / 모듈

- DB: 마이그 **036** `ai_total_review_interpretations`(적용 완료).
- env: **`OPENAI_INTERPRET_TOTAL_REVIEW`**(프로덕션 =1, 캐시로 비용 최적화).
- 모듈: `total-review/`(11파일) · `saju-score/`(10파일) · `total-review-validator.ts`.

### 0.7 운영 적용 현황

- 총평 LLM: 프로덕션 **활성**(플래그 ON + 마이그 036 + 캐시). 사주+컨텍스트당 1회 생성, 재조회 캐시 hit(0 호출).
- 점수 시스템: 엔진만 main 반영, **UI 미연결**(사용자 화면 변화 없음).
- 권장 스테이징 QA(미완): 상황 보유 reading 으로 단락2 직업·단락4 고민 반영 육안 / 5케이스 BEFORE-AFTER / 비전문가 가독성.

### 0.8 정량 지표 (Before → After)

| 지표 | Before | After |
|------|--------|-------|
| 총평 본문 | 7문장 단락 | 4단락(25~35문장) + 평생활용 3카드 |
| 총평 한자/명리어 | 노출 | 0 (validator 차단) |
| 총평 비용(플래그 ON) | 조회마다 3호출 | 사주+컨텍스트당 1회(캐시) |
| 어휘 | "쇠의 결"/"X의 결" | "X 기운"/"…사주" (§12 0건) |
| 점수 엔진 | 없음 | F1~F5 + 50케이스(평균 65.3) |
| 유닛 테스트 | ~538 | **562** |

### 0.9 후속 (다음 주기)

- **daewoon-llm-spec 어휘 반영**(B 확정 — 태스크 칩 생성): 챕터 `COMMON_SYSTEM_PROMPT` · `chapter-validator` · `MYEONGRI_GLOSSARY`("X의 결") 한 묶음. 라이브 9챕터 + 전역 글로서리라 신중히.
- **점수 Phase 2~7**: Tailwind 토큰 → UI 컴포넌트 → 오행 차트 UI → LLM 가이드 연계 → 무료/유료 경계.
- 📦 release: `2026-05-21 총평 LLM 풀스택 + 어휘 정책 + 점수 Phase 1`

---

## 0-prev-5. 2026-05-20~21 세션 종합 — V2-5 LLM 풀스택 + 검증 1~6 사이클 + 톤 정합화 (17 PR #281~#297)

진단서 6단계 검증을 순차 진행하면서 발견된 미흡 사항을 즉시 PR 로 처리. *9 챕터 LLM 풀이 인프라 완성* + *사용자 보고 톤 정합화* + *피드백 루프 + 대시보드* 까지 한 사이클 종료.

### 0.1 검증 1~6 사이클 결과

| 단계 | 결과 | 비고 |
|------|------|------|
| 1 (회귀 테스트) | ✅ PASS | 5 보존 영역 모두 유지 |
| 2 (P0 spot-check) | ✅ PASS (PR #281) | 6 버그 중 ⑥ chapter fallback 자극 표현 잔존 발견 → 즉시 fix |
| 3 (네이밍 마이그레이션) | ✅ PASS | 옛 옛 라벨 잔존 0건 (정확 매핑 strict grep) |
| 4-A (LLM 구조) | ⚠️ PARTIAL → ✅ 완료 (PR K/L/M/N) | 9챕터 중 8 LLM 활성 + 8/8 금지 규칙 + JSON schema + 병렬 호출 |
| 4-B (콘텐츠 다양성) | ✅ PASS (실측 7/8 LLM) | §5 8개 패턴 모두 목표 이내 + 챕터 간 첫 문장 중복 0 |
| 4-C (톤 품질) | ✅ PASS (LLM 본문 87.5%) | 자극 0건 + 컨텍스트 반영 + Few-shot 톤 일치 |
| 5 (일반화) | ⚠️ PARTIAL | OpenAI rate limit (TPM 30K) 한계 — Tier upgrade 권장 |
| 6 (운영) | ⚠️ PARTIAL | telemetry 비용 추적 + 캐시 OK, multi-user 보강 필요 |

### 0.2 진단서 후속 권장 5종 — 완료 현황

| 작업 | PR | 결과 |
|------|-----|------|
| (1) chapter-telemetry 비용 추적 | PR Q (#288) | ✅ model/usage/userHash 로깅 |
| (2) 9장 fallback 변별력 | PR Q (#288) | ✅ 사주별 dominant/weakest 인용 |
| (3) OpenAI Tier upgrade | — | ⚪ 운영팀 결정 영역 |
| (4) 사용자 피드백 루프 | PR R (#289) | ✅ 별점 + Yes/No (옵션 A) + DB 마이그 035 |
| (5) 품질 모니터링 대시보드 | PR S (#289) | ✅ /admin/saju-feedback (집계 + 최근 stream) |

### 0.3 추가 작업 (admin UX + 시간축 + 자유 코멘트)

| 작업 | PR | 결과 |
|------|-----|------|
| /admin/operations admin nav grid | PR T (#291) | ✅ 8개 admin 페이지 link + saju-feedback NEW 배지 |
| chapter-feedback service-role 조회 | PR T (#291) | ✅ admin RLS 우회로 모든 사용자 피드백 집계 |
| 일별 추이 차트 | PR U (#292) | ✅ 30일 sparkline (응답/별점/helpful) |
| 자유 코멘트 활성화 | PR U (#292) | ✅ ChapterFeedbackCard textarea (200자) |

### 0.4 사용자 보고 — 총평 페이지 P0 톤 정합 (3 PR)

사용자 스크린샷 보고: *"오늘운세 무료보다 더 내용 없는 풀이, 문장 어법 어색, 한자 범벅"*

| 미흡 | PR | fix |
|------|-----|-----|
| "안정이 앞서고 정리가 비기 쉬운 날" 어법 | PR V (#293) | ELEMENT_INFO 자연 표기 → "토 기운이 강하고 금 기운이 부족한 날" |
| 한자 본문 노출 (`계미(癸未) 일간`, `金 (금)을(를)`) | PR V (#293) | `ganziForBody` 한글만 + `formatElementLabel` → "금 기운" |
| 호명 3회 (X님 · X님이) | PR V (#293) | `buildSituationClosing` 호명 제거 — headline 1회만 |
| 칩 라벨 추상명사 (기질 생각 / 강점 안정 45%) | PR W (#294) | ELEMENT_INFO 통일 → "기질 금 기운 / 강점 토 기운 45%" |
| 사주 술어 한 단락 동시 노출 (신약·식신격·대운·세운·월운·용신 6+) | PR W (#294) | sentenceLuck 대운 1개로 압축 + strengthLevel 일상어화 |
| chip 한자 잔존 (일주 계미(癸未) / 대운 경오(庚午)) | PR X (#295) | chip 한자 완전 제거 + 4 pillars 카드만 한자 정체성 유지 |

### 0.5 후속 인프라 (helper + audit)

| 작업 | PR | 결과 |
|------|-----|------|
| 사주 술어 → 일상어 변환 helper | PR Y (#296) | `toPlainKorean()` 53종 매핑 + tests 11개 |
| 9 챕터 본문 톤 audit (LLM 미호출) | PR Z (#297) | 3 케이스 × 9 영역 측정 — chapter-validator 4룰 ✅, 4 잔존 미흡 식별 |

### 0.6 PR 누적 표 (#281 ~ #297, 17개)

| PR | commit | 영역 |
|----|--------|------|
| #281 | `f690430` | P0 ⑥ 자극 표현 차단 + 회귀 가드 (chapter-pattern-templates) |
| #282 | `fbdc726` | V2-5 PR K — 9장 LLM synthesis (priorChapterDigests) |
| #283 | `20629f8` | V2-5 PR L — 2·3·6·7 LLM + 1~7 병렬 호출 (Promise.all) |
| #284 | `b7a2a4e` | V2-5 PR M — validator 룰 3종 (결 빈도/문장 길이/막연한 위로) + Few-shot 예시 |
| #285 | `ce88285` | V2-5 PR N — 명리 술어 반복 룰 + JSON structured output |
| #286 | `80a6bce` | 자연 비유 라벨 (쇠의 결) → 한글 표기 (금 기운) + chapter-validator 튜닝 |
| #287 | `a305623` | V2-5 PR P — 톤 미흡 보강 (호명 1회 + 한 문장 술어 1개) |
| #288 | `b91f04f` | V2-5 PR Q — chapter-telemetry 비용 추적 + 9장 fallback 변별력 |
| #289 | `edc9dfb` | V2-5 PR R+S — 사용자 피드백 루프 + 품질 모니터링 대시보드 |
| #290 | `ee1b00d` | 035 마이그레이션 RLS policy idempotent hotfix |
| #291 | `99e2304` | V2-5 PR T — operations admin nav grid + chapter-feedback service-role 조회 |
| #292 | `f11e349` | V2-5 PR U — 시간축 추이 차트 + 자유 코멘트 활성화 (옵션 B) |
| #293 | `a6ae824` | V2-5 PR V — 총평 narrative P0 hotfix (한자/호명/조사/카피) |
| #294 | `cc5e255` | V2-5 PR W — 칩 라벨 정합 + ELEMENT_LABELS 정리 + 술어 한 단락 감소 |
| #295 | `c1bc70b` | V2-5 PR X — chip 영역 한자 완전 제거 (정책 일관) |
| #296 | `f99df96` | V2-5 PR Y — 사주 술어 → 일상어 변환 룰 helper 사전화 |
| #297 | `989a2fb` | V2-5 PR Z — narrative deterministic 톤 audit script + 보고서 |

### 0.7 신규 DB / API / 컴포넌트

#### DB 마이그레이션
- `supabase/migrations/035_chapter_feedback.sql` — chapter_feedback 테이블 (user_id, reading_id, chapter_id, rating, helpful_bool, comment) + UNIQUE 제약 + RLS + updated_at trigger. PR #290 으로 *DROP POLICY IF EXISTS* idempotent 패턴 추가.

#### API endpoints
- `POST /api/saju/chapter-feedback` — 피드백 upsert (인증 필수, RLS auth.uid=user_id)

#### server-side helpers
- `src/lib/saju/chapter-feedback.ts` — recordChapterFeedback / listChapterFeedbackForReading / getChapterFeedbackStats / getChapterFeedbackTimeseries / listRecentChapterFeedback
- `src/lib/saju/plain-translate.ts` — toPlainKorean / strengthToPlain / luckToPlain / isMyeongriTerm (53종 사전)

#### UI 컴포넌트
- `src/components/saju/chapter-feedback-card.tsx` — 별점 5개 + Yes/No + 자유 코멘트 textarea (200자), 비로그인 시 로그인 안내
- `src/components/admin/chapter-feedback-timeseries-chart.tsx` — 30일 sparkline grid (응답 수 / 평균 별점 / helpful 비율)

#### admin 페이지
- `src/app/admin/saju-feedback/page.tsx` — 챕터 피드백 집계 표 + 시간축 차트 + 최근 50개 stream
- `src/app/admin/operations/page.tsx` — admin sub-nav grid 8개 link 추가

#### 9 챕터 LLM 인프라 (8 챕터 활성)
- `src/server/ai/chapters/build-chapter{1,2,3,4,5,6,7,9}-input.ts` — chapterId 별 LLM 입력 변환
- `src/server/ai/chapters/enhance-lifetime-chapter{1,2,3,4,5,6,7,9}.ts` — summary 교체 + fallback
- `src/server/ai/chapters/chapter-prompts.ts` — 9 챕터 lens + forbiddenTopics + FEW_SHOT_EXAMPLES (1·4·5·9)
- `src/server/ai/chapters/openai-chapter-client.ts` — JSON schema 강제 (useJsonMode default true)

#### validator (chapter-validator.ts) 10개 룰
1. hanja (한자) / 2. x-과-label (옛 오행 라벨) / 3. english (영어) / 4. absolute (자극) / 5. cross-chapter (첫 문장 중복) / 6. punch-copy-duplication / 7. gyeol-frequency ("결" 5회) / 8. sentence-length (65자) / 9. vague-comfort (막연한 위로) / 10. myeongri-jargon-repetition (명리 술어 반복)

### 0.8 측정 인프라 + 결과

#### scripts (LLM 측정 / audit)
- `scripts/measure-llm-chapters.mjs` — 1996.06.01 06:30 男 + 8 챕터 LLM 호출 측정 (~$0.05/회)
- `scripts/measure-llm-5-cases.mjs` — 5 케이스 일반화 테스트 (~$0.25)
- `scripts/audit-narrative-tone.mjs` — deterministic 본문 톤 측정 (LLM 미호출, 무료)

#### audit-reports
- `audit-reports/2026-05-20-verification-4b-llm-output.md` — 검증 4-B 실측 (7/8 LLM)
- `audit-reports/2026-05-20-verification-5-generalization.md` — 검증 5 일반화 (rate limit 발견)
- `audit-reports/2026-05-20-narrative-tone-audit.md` — PR Z deterministic 본문 audit (4 잔존 미흡 식별)

### 0.9 운영 적용 안내

#### 즉시 적용 완료
모든 PR 머지 + Vercel 자동 배포 — production 반영 완료.

#### 사용자 액션 필요
1. **DB 마이그레이션 035 적용** (PR #289):
   ```bash
   supabase db push
   # 또는 Supabase Dashboard SQL Editor 에 035_chapter_feedback.sql 실행
   ```
2. **OpenAI Tier upgrade 검토** — TPM 30K (Tier 1) → 동시 사용자 1명 한계. multi-user production 운영 시 Tier 2+ (TPM 90K+) 권장.
3. **9 챕터 LLM enabled flag** — env 활성 시 풀 LLM 풀이:
   ```
   OPENAI_INTERPRET_CHAPTERS=1
   OPENAI_INTERPRET_CHAPTER_IDS=1-9
   ```

### 0.10 후속 권장 작업 (PR Z audit 결과 기반)

| 우선순위 | 작업 | 영향 |
|---------|------|------|
| 🔥 P0 | deterministic builder fallback summary 변별력 강화 (wealthStyle/coreIdentity/careerDirection) | §5 ①·② 패턴 잔존 직접 원인 |
| ⚠️ P1 | build-lifetime-report 의 ELEMENT_LABELS 잔존 정리 (PR Y plain-translate helper 활용) | 어휘 통일 |
| ✅ P2 | 장문 65자 초과 3건 단축 (A·strengthBalance, B·lifetimeStrategy, C·strengthBalance) | 가독성 |
| ✅ P3 | chapter 8 (대운) daewoon-llm-spec 위임 구현 | 9 챕터 LLM 활성화 8/9 → 9/9 |
| ✅ P3 | 2·3·6·7 챕터 Few-shot 예시 (spec §5 추가 작성 후 코드) | LLM 톤 안정성 ↑ |
| ✅ P3 | AB 테스트 인프라 — prompt 버전별 rating 시계열 비교 | 품질 측정 객관화 |

### 0.11 진단서 검증 사이클 종료 — 정량 지표

| 지표 | 시작 | 현재 (PR #297 후) | 개선 |
|------|------|--------------------|------|
| 9챕터 LLM 활성화 | 3/9 | **8/9** | +166% |
| 응답 시간 (7챕터) | 15초 (직렬) | **5초** (병렬) | -67% |
| chapter-validator 룰 | 6 | **10** (gyeol/sentence-length/vague-comfort/myeongri) | +67% |
| Few-shot 예시 | 0/9 | 4/9 (1·4·5·9) | +∞ |
| 8 금지 규칙 | 5/8 | **8/8** ✅ | +60% |
| JSON structured output | 자유 텍스트 | **schema 강제** ✅ | — |
| 사용자 피드백 인프라 | 0 | **별점 + Yes/No + 코멘트 + admin 대시보드** | — |
| 사용자 보고 톤 정합 | 4 미흡 | **0 미흡** (PR V/W/X) | -100% |
| chapter-validator 4룰 통과 (deterministic) | — | **3 케이스 × 9 영역 모두** | ✅ |

---

## 0-prev2. 2026-05-20 저녁 세션 종합 — UX 라운드 3 + V2-5 PR J + Phase 8 SEO (10 PR 머지 + 1 close)

오후~저녁 한 세션에 PR #271 ~ #280 진행. 세 축:
1. **UX 라운드 3** (3 PR 머지 + 1 close) — 홈 UX 폴리시 / nav 폴리시 / 12별자리 StarSignChip / footer color (롤백)
2. **V2-5 PR J** (1 PR 머지) — 챕터 4·5 LLM enhancement + envelope chain
3. **Phase 8 SEO 콘텐츠 품질 개선** (5 PR 머지) — 3 area metadata 통일 + 콘텐츠 보강 + paid funnel 공통화

### 0.1 진행된 것 (완료 — main 머지) ✅

#### UX 라운드 3 — 3 PR 머지 + 1 close

| PR | 제목 | 요약 |
|---|---|---|
| #271 | UX (a) banner kbd nav + 온보딩 슬라이드 transition | GangiSeasonBanner viewport `<div>` 에 tabIndex=0 + role="region" + aria-roledescription="carousel" + ←/→/Home/End keydown handler + focus-visible:ring-2. OnboardingCarousel 슬라이드 본문 wrapper 에 `key={idx}` 로 re-mount → `motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-300 delay-75` 적용. prefers-reduced-motion 자동 disable |
| #272 | UX (b) 태블릿 nav vacuum 해소 + 메가메뉴 hover 마이크로 인터랙션 | hamburger button `md:hidden` → `lg:hidden` 변경 — 태블릿 (768~1023px) 영역에서 dock 안 보이고 mega-nav 도 lg+ 부터라 진입 vacuum 발생 → mobile-nav-sheet (lg+ 강제 hidden) 가 태블릿에서도 정상 펼침. mega-nav-signup/login `:hover` + `:active` 에 translateY(-1px) + box-shadow lift (signup=pink, login=dark) + prefers-reduced-motion 가드 |
| #273 | UX (c) 12별자리 StarSignChip 신설 + 메인 별자리 카드 적용 | PROGRESS.md §0.4 (12별자리 'pig' 차용 불일치) 해소. 신규 `src/components/gangi/star-sign-chip.tsx` (12 sign ♈~♓ + element 색상 + generic 밤하늘 chip). `GangiServiceCard` 에 `chipKind` / `starSign` optional 추가. 메인 카드 그리드의 별자리 카드 chip 이 12간지 'pig' (indigo) → 밤하늘 인디고 그라데이션 + ✦ + 별 점 텍스처로 명확히 차별화 |
| ~~#274~~ | ~~footer dim color 톤업~~ | **close — 사용자 결정으로 롤백**. footer default 0.72 / 브랜드 카피 0.62 / chevron 0.6 / NavLink 0.62 → 모두 0.8~1.0 로 톤업한 PR 이었으나 사용자 검토 후 원래 dim 위계 유지 결정 |

#### V2-5 PR J — 1 PR 머지

| PR | 제목 | 요약 |
|---|---|---|
| #275 | V2-5 PR J — 챕터 4·5 LLM enhance + envelope chain | PR #261 (챕터 1) 와 동일 패턴 확장. 신규 6 파일: `build-chapter4-input.ts` + `build-chapter5-input.ts` + `enhance-lifetime-chapter4.ts` + `enhance-lifetime-chapter5.ts` + 각 TDD 테스트 (12 케이스). 수정: `saju-lifetime-service.ts` 의 `interpretLifetime` 안 chain — `applyChapter1 → applyChapter4 → applyChapter5` 순차 await. envelope `_chapters[4]`, `_chapters[5]` upsert. env disable 기본값 (회귀 0). 동시 cache miss × 3 시 envelope last-write-wins (다음 request 보정, 최대 ~$0.01 1회 redundant 비용 허용). 5 commit (Task 1~5 TDD). test 89 → 101 pass (+12) |

PR J 본격 구현 전 audit: PR #261 의 production monitoring 결과 = `chapter_run` 이벤트 0건 (7d) → env disable default 의도 충족 (회귀 0). 사용자 의도 "회귀 0 확인" 으로 PR J 즉시 진행 가능 판단

#### Phase 8 SEO 콘텐츠 품질 개선 — 5 PR 머지

Phase 8 spec (꿈해몽 10 sections / 띠운세 11 sections / 별자리 9 sections / 내부링크 / 메타데이터) 의 전체 5 PR 분할 + 순차 진행 + 완결.

| PR | 제목 | 요약 |
|---|---|---|
| #276 | Phase 8-A SEO metadata + JSON-LD schema 통일 | 신규 `src/lib/seo/structured-data.ts` (Article + FAQPage + BreadcrumbList schema builder + XSS-safe serializer) + `src/lib/seo/page-metadata.ts` (`buildContentPageMetadata` 통일 helper). 3 SEO area detail 페이지 (`/star-sign/[slug]` / `/zodiac/[slug]` / `/dream-interpretation/[slug]`) 의 `generateMetadata` 통일 + 본문에 Article + BreadcrumbList JSON-LD 2개씩 inject |
| #277 | Phase 8-B 별자리 detail 내부링크 보강 (연애 타로 + 유료 CTA) | §6 연애 section 끝에 `/tarot/daily?topic=love` cross-link (pink-soft ghost). 마지막 cross-saju CTA section 에 유료 funnel 2 grid (사주 550원~ + 궁합 990원, `?from=star-sign` UTM). 12×12 호환 매트릭스 + 기존 saju upsell 모두 보존 |
| #278 | Phase 8-C 띠운세 11 sections (§궁합·조심할 띠) | 신규 `src/lib/zodiac/zodiac-relations.ts` — 12지 전통 호환 매트릭스 (삼합 三合 4 group + 육합 六合 6 pair + 육충 六沖 6 clash). 각 띠 `idealMatches` 4 (삼합 2 + 육합 1 + 보조 1) + `bewareMatches` 1 (육충) + `matchSummary` / `bewareSummary` 한 줄. 페이지에 §궁합·조심 article 추가 + chip 양쪽 grid + 사주 CTA `?from=zodiac` UTM + 유료 funnel 2 grid |
| #279 | Phase 8-D 꿈해몽 10 sections + 800자+ 본문 + FAQPage | Phase 8 spec 가장 큰 항목 — 기존 ~90 chars 의 단순 2-card 가 빈약하다는 회귀를 해소. 신규 `src/lib/dream/dream-content.ts` (8 entries × 10 sections — 제목/한 줄 요약/기본 의미/상황별 3~4/심리적/행동 3 bullet/주의/관련 꿈/FAQ 2~3). 각 entry 합산 본문 800자+ / 단정·공포·의료 표현 금지. 페이지 컴포넌트 enriched 10 sections layout + FAQPage JSON-LD inject (조건부) + 무료 cross-area 3 (오늘운세/타로/꿈해몽 목록) + 유료 funnel 2 (사주/궁합) + `?from=dream` UTM 5건 |
| #280 | Phase 8-E PaidFunnelGrid 공통 컴포넌트 + 무료→유료 cross-area funnel | Phase 8-B/C/D 의 inline funnel ~40 lines × 3 = ~120 lines 의 중복을 `PaidFunnelGrid({ from, tone, includeMembership })` 로 추출. 5 페이지 적용: 별자리/띠 (tone=dark, 멤버십 X) + 꿈/타로 result/today-fortune client (tone=light, includeMembership). Phase 8 spec §4 내부링크 7개 흐름 전체 충족. Phase 8 완결 PR |

### 0.2 운영 적용

- **10 PR 모두 main 머지 + Vercel production 배포 완료** (commit 88bc305 → dbae20d → 844c8f3 → 28ff242 → a805521 → a95a764 → 9fb8a76 → 5882f14 → 82c36cb → 0c1d256)
- 모든 PR 의 CI (Test/Typecheck/Build + Playwright smoke E2E + Vercel Agent Review) 통과
- Release 라벨:
  - `2026-05-20 홈 banner 키보드 nav + 온보딩 슬라이드 transition` (#271)
  - `2026-05-20 태블릿 nav vacuum 해소 + 메가메뉴 hover 인터랙션` (#272)
  - `2026-05-20 12별자리 전용 StarSignChip 신설 + 메인 카드 적용` (#273)
  - `2026-05-20 V2-5 PR J — 챕터 4·5 LLM enhance + envelope chain` (#275)
  - `2026-05-20 Phase 8-A SEO metadata + JSON-LD schema 통일` (#276)
  - `2026-05-20 Phase 8-B 별자리 detail 내부링크 보강` (#277)
  - `2026-05-20 Phase 8-C 띠운세 11 sections (§궁합·조심할 띠)` (#278)
  - `2026-05-20 Phase 8-D 꿈해몽 10 sections + 800자+ 본문 + FAQPage` (#279)
  - `2026-05-20 Phase 8-E PaidFunnelGrid 공통화 + 무료→유료 cross-area funnel` (#280)

### 0.3 다음 세션 큐

#### V2-5 LLM 챕터 라인 (PR J 안정화 후)
- **V2-5 PR K — 챕터 2·3·6·7 LLM** — PR J (#275) 의 production 모니터링 1주일 후. PR J 와 동일 패턴 × 4 챕터. env `OPENAI_INTERPRET_CHAPTER_IDS=1-7` (range 문법 지원). 챕터별 교체 field: Ch 2 `strengthBalance.summary` / Ch 3 `patternAndYongsin.summary` / Ch 6 `careerDirection.summary` / Ch 7 `healthRhythm.summary`. 리팩토링 권장: `buildChapter{N}Input` + `applyChapter{N}LLMEnhancement` 공통화 (현재 1,4,5 의 코드 중복 해소 — PR K 안에서 또는 별도 작은 PR)
- **V2-5 PR L — 챕터 9 synthesis LLM** — PR K 완료 후. 챕터 1-7 의 LLM-enhanced summary digest 를 input 으로 받아 평생 활용 전략 생성. `ChapterLLMInput.priorChapterDigests` (이미 정의됨). cacheKey 에 1-7 digest hash 포함 → 1-7 중 하나라도 재생성되면 9 도 cache miss

#### Phase 8 후속 보강 (선택, 우선순위 낮음)
- 꿈해몽 entries 확장 — 현재 8 entries 의 `DREAM_CONTENT`. `src/lib/dream-dictionary.ts` 의 36 keyword 중 자주 검색되는 entry 추가 (추가 13~28 entry 의 800자+ 콘텐츠)
- 띠운세 호환 데이터 검증 — `ZODIAC_RELATIONS` 의 idealMatches/bewareMatches 가 전통 명리학 패턴과 100% 일치하는지 사용자 review
- 별자리 추가 sections — 신화·헬레니즘 origin / 행성 movement / 별자리 특정 시기 등 (현재 9 sections 외)

#### UI / UX 후속 (5건 모두 완료, 추가 검토 시)
- ~~부채꼴 FAB 데스크탑 대응 (태블릿 noise)~~ → ✅ #272 에서 hamburger lg:hidden 으로 해소
- ~~별자리 카드 zodiac chip 디자인~~ → ✅ #273 에서 StarSignChip 신설
- ~~온보딩 carousel 슬라이드 transition~~ → ✅ #271 에서 motion-safe animate-in 적용
- ~~GangiSeasonBanner 키보드 nav~~ → ✅ #271 에서 ←/→/Home/End 추가
- ~~PC 메가메뉴 회원가입 hover state~~ → ✅ #272 에서 translateY + box-shadow lift 추가

### 0.4 모니터링 (production)

1. **PR #275 V2-5 PR J** — chapter 4·5 LLM 의 production cost (`chapter_run` 이벤트 source=llm 비율, retries, validation_failures, durationMs). env disable default 라 현재 호출 0건 — 1주일 후 PR K 진행 전 확인. Supabase `readings.result_json._chapters` 의 4/5 entry upsert 검증 (env enable 시점 이후)
2. **PR #271 banner kbd nav** — 스크린리더 (VoiceOver/TalkBack) 에서 carousel role + aria-roledescription 정상 인식
3. **PR #272 태블릿 nav** — iPad portrait (820x1180) / iPad Pro (1024x1366 — lg 경계) 에서 hamburger → sheet 자연스럽게 펼침
4. **PR #273 StarSignChip** — iOS Safari / Android Chrome 에서 ♈~♓ 유니코드 glyph + system-ui font 정상 렌더 (font fallback 차이 확인)
5. **PR #276 JSON-LD** — Google Rich Results Test (rich-results.google.com) 통과 — Article + BreadcrumbList 인식. 8-D 의 FAQPage 도 rich result preview 정상 (Q&A snippet)
6. **PR #280 PaidFunnelGrid** — `?from=star-sign / zodiac / dream / tarot / today-fortune` UTM 5종이 사주 / 궁합 / 멤버십 페이지에서 analytics 추적 + conversion 비율 측정
7. **꿈해몽 #279 콘텐츠 톤** — 단정·공포·의료 단정 표현 없는지 (사이트 톤 일관성). 사용자 review 권장

### 0.5 알려진 위험 / 정리 후속

- **PR J chain 의 동시 cache miss × 3 last-write-wins** — 같은 request 안에서 챕터 1/4/5 모두 cache miss 시 envelope upsert 가 마지막 챕터 (5) entry 만 DB 저장. 다음 request 에서 1, 4 재생성 → eventually consistent. 비용 영향 ~$0.01 1회. 회피하려면 apply 함수 signature 변경 필요 (in-memory chaptersEnvelope 도 반환). PR K 진행 시 공통화와 함께 검토 가능
- **PR 271/272/273/275/276/277/278/279/280 의 미반영 footer color tone** — #274 (footer dim color 톤업) 가 롤백되어 main 의 footer 는 여전히 0.72/0.62/0.6 dim 위계. 추후 별도 결정 시 재시도 가능
- **꿈해몽 entries 8개 vs dictionary 36개 격차** — `/dream` (search) 페이지는 36 dictionary entries 모두 검색 가능하지만 `/dream-interpretation/[slug]` detail 페이지는 8 entry 만 enriched. 자주 검색되는 dream 의 detail 페이지 확장 권장
- **buildChapter{1..5}Input 의 helper 중복** — STEM_HANJA_TO_KOREAN / STRENGTH_TO_KOREAN / elementLabel / patternPlainCue / narrowOccupation / narrowConcern 가 5 파일 (chapter 1/4/5 의 input builder) 에 중복 정의. PR K 진행 시 `buildChapterInputBase(chapterId, sajuData, userSituation, options)` 로 추출 검토
- **PaidFunnelGrid 의 멤버십 가격** — "월정액" 으로만 표시. 실제 가격 정해지면 PaidFunnelGrid 내부 ITEMS 의 price 갱신 필요

---

## 0a. 2026-05-20 오전~오후 세션 종합 — V2-4 마이그레이션 완성 + UI 개선 (6 PR)

하루에 PR #265 ~ #270 (6 PR 모두 머지). 두 축:
1. **V2 마이그레이션 V2-4 단계 100% 완성** — production callers / hot path / internal builders 전체 `loadSajuDataV2` 전환 + engine 코어 옵션 호환 패턴
2. **사용자 보고 UI 개선** — 모바일 dock 가시성 / 헤더 MY 메뉴 / hydration 회귀 / 별자리 카드 / 부채꼴 FAB / footer 검정

### 0.1 진행된 것 (완료 — main 머지) ✅

#### V2-4 마이그레이션 완성 — 3 PR

| PR | 제목 | 요약 |
|---|---|---|
| #265 | V2-4 production callers — 8 files loadSajuDataV2 전환 | `audit-reports/2026-05-19-v2-migration-audit.md` §2-D 의 11 파일 중 production caller 8개 전환. API routes 2 (api/ai/route.ts ×2, api/taekil/find-good-days/route.ts), Verification 2 (today-fortune-audit.ts, kasi-calendar.ts), Lib utilities 4 (account.ts, notifications.ts, profile-personalization.ts, compatibility.ts). 변환 패턴: `normalizeToSajuDataV1(input, storedValue, opts?)` → `loadSajuDataV2(input, storedValue, opts?)`. 호환성: SajuDataV2 가 V1 super-set 이라 호출 본문 변경 0. PR #264 의 V1↔V2 entry invariant 30 케이스 모두 통과 |
| #266 | V2-4 hot path — buildFreshTodaySajuData loadSajuDataV2 전환 | hot path 2 파일 (`today-fortune/route.ts:58` + `today-fortune/unlock/route.ts:97,193`) 은 PR #264 의 `buildFreshTodaySajuData` helper 를 통과. helper 1 곳만 `calculateSajuDataV1` → `loadSajuDataV2(input, null)` 로 전환하면 hot path 자동 V2 전환. diff: 1 file, +7/-6. PR #264 의 30 invariant 가 정확히 본 helper 의 V2 전환을 회귀 차단하기 위해 설계됨 |
| #267 | V2-4 internal builders — multi-year cycle loadSajuDataV2 + 옵션 호환 패턴 | internal builder 2 파일 (`build-yearly-report.ts:356,863` + `build-fortune-calendar.ts:168`). 핵심: **calculatedAt/engineVersion 옵션 호환 패턴** 구현. SajuLoadOptions 에 `engineVersion` 추가 + normalizeToSajuDataV1 시그니처에 `calculatedAt`, `engineVersion` 추가 + loadSajuDataV2 가 V1 fallback path 호출 시 `calculatedAt: now` + `engineVersion` 전달. 이로써 multi-year cycle 의 referenceDate 가 V1 fallback 의 calculateLuckData 까지 정확히 전파 — 세운/월운 ganzi 가 yearly target year 기준으로 계산 |

#### UI 개선 라운드 1 — PR #268

| PR | 제목 | 요약 |
|---|---|---|
| #268 | feat(navigation): 모바일 dock fix + ScrollToTop + 메뉴 MY 섹션 추가 | **critical bug fix**: 모바일 dock (홈/사주추가/무료운세/대화방/보관함) 이 화면 따라다니지 않음. 원인: `motion-page-transition-frame` 의 `transform + will-change` 가 새 containing block 을 만들어 `position: fixed` 가 깨짐 (top 2134, viewport h=812 → off-screen). 해결: PR #158 (mobile-nav-sheet) 검증된 `createPortal(<nav>, document.body)` 패턴 적용. dock top **682** (viewport 하단 정확 고정). 신규: ScrollToTopButton (Portal mount + scrollY>320 fade-in + prefers-reduced-motion 대응) + PC 메가메뉴 회원가입 ghost 버튼 + 모바일 햄버거 시트에 MY 섹션 (비로그인: 로그인/회원가입 짝꿍 CTA / 로그인: 내 정보/로그아웃 + supabase onAuthStateChange 실시간 구독) |

#### Hydration 회귀 fix — PR #269

| PR | 제목 | 요약 |
|---|---|---|
| #269 | fix(layout): hydration mismatch + script tag 경고 fix | 사용자 보고 dev 콘솔 에러 2건. **(1) Hydration mismatch (SiteFooter dl)**: `business-info.ts` 의 `getEnv(key: string)` 가 `process.env[key]` **동적 키 접근** 사용 → Webpack/Turbopack 의 NEXT_PUBLIC_* inline 은 정적 접근만 지원 → client undefined → `companyItems.filter(item => item.value)` SSR(10) ↔ CSR(0) 불일치. 해결: `BUSINESS_INFO` export 를 `readEnv(process.env.NEXT_PUBLIC_X)` 정적 접근으로 변경 (12 fields). assertProductionBusinessEnv 는 server-only 가드 + 테스트 호환 위해 동적 접근 유지 (책임 분리). **(2) Script tag 경고 (23회 반복)**: layout.tsx 의 `<script dangerouslySetInnerHTML>` 가 `<body>` 안에 위치 → React 19/Next 16 에서 client 컴포넌트 트리 안의 `<script>` 무시 + 경고. 해결: `<head>` 안으로 이동 (FOUC 차단 동작 동일 유지) |

#### UI 개선 라운드 2 — PR #270

| PR | 제목 | 요약 |
|---|---|---|
| #270 | feat(home): 별자리 카드 + 부채꼴 FAB + 온보딩 swipe + footer 검정 fix + ScrollToTop 위치 | 사용자 보고 5건 동시 fix. (1) 메인 카드 그리드에 별자리 진입점 추가 (`zodiac: pig/亥`, 무료, `/star-sign`) + 꿈해몽 위치 교체 (별자리 7번, 꿈해몽 마지막). (2) 온보딩 carousel 좌우 swipe (모바일 터치 + PC 마우스) — pointer events 통합 + `touch-action: pan-y`. GangiSeasonBanner 의 mouse-only 가드도 제거. (3) Footer 검정 (#000000) 적용 안되는 사용자 보고 + 하단 흰 공간 fix — 진단: `.app-shell.app-shell-with-navigation { padding-bottom: var(--app-mobile-dock-clearance) }` (117px, white) + PR #268 의 body padding (5.2rem, white). 해결: body padding 제거 + footer 자체에 모바일 padding-bottom 5.2rem 추가 (검정 배경이 dock 까지 덮음) + main padding-bottom 0 override. 검증: whitespace_below_footer = -1px. (4) Dock 무료운세 FAB → 부채꼴 메뉴 (운세/사주/별자리/띠운세/꿈해몽, 반경 105px, 각도 -170°~-10°). 색상: pink → mystical purple 그라데이션 (pink-strong→plum→indigo). (5) ScrollToTop 위치 `bottom: 5.6rem` → `8rem` (dock 위로 충분한 여유) |

### 0.2 운영 적용

- **6 PR 모두 main 머지 + Vercel production 배포 완료** (commit b1d0d5a / 16dd250 / 72b54c1 / b58094b / a53b111 / 88bc305)
- 모든 PR 의 CI (Test/Typecheck/Build + Playwright smoke E2E + Vercel Agent Review) 통과
- Release 라벨: `2026-05-20 V2-4 production callers` / `2026-05-20 V2-4 hot path helper` / `2026-05-20 V2-4 internal builders + 옵션 호환` / `2026-05-20 모바일 dock portal fix + ScrollToTop + MY 메뉴` / `2026-05-20 hydration mismatch + script tag fix` / `2026-05-20 별자리 카드 + 부채꼴 FAB + 온보딩 swipe + footer 검정`

### 0.3 다음 세션 큐

#### V2 마이그레이션 다음 단계
- **V2-5 PR J — 챕터 4·5 LLM enhance** (2026-05-26 이후 권장)
  - PR #261 (챕터 1 LLM) production 모니터링 1주일 후 진행
  - env: `OPENAI_INTERPRET_CHAPTERS=1` + `OPENAI_INTERPRET_CHAPTER_IDS=4,5` (또는 1,4,5)
  - 챕터 4 (**관계 패턴** — 사람 사이 거리감·표현 방식), 챕터 5 (**재물 감각** — 돈의 흐름) → 별도 `enhanceLifetimeChapter4WithLLM` / `enhanceLifetimeChapter5WithLLM` 함수
  - 챕터 1 의 LLM cost (~$0.005/call) 측정값 검토 후 확장
  - **TDD 구현 plan 작성 완료 (2026-05-20)** — `docs/superpowers/plans/2026-05-20-v2-5-pr-j-chapter4-5-llm.md` (8 Task, 변경 9 파일 / +~600 -3 lines)
  - Pre-flight 확인 (2026-05-20): `CHAPTER_META[4,5]` 및 `CHAPTER_OUTPUT_SPECS[4,5]` 이미 정의됨 (`src/server/ai/chapters/chapter-prompts.ts:53-69, 160-177`) → plan 의 Task 0-2 (META 보강) skip 가능
  - 핵심 trade-off: 동시 cache miss × 3 시 envelope last-write-wins (다음 request 에서 보정, 최대 ~$0.01 1회 redundant). 회피 시 apply 함수 signature 변경 필요 → 본 PR scope 밖
  - chain 호출: `interpretLifetime` 안 `applyChapter1 → applyChapter4 → applyChapter5` 순차 await (각 챕터 env disable 시 baseReport pass-through)
- **V2-5 PR K — 챕터 2·3·6·7 LLM** (PR J 안정화 후)
- **V2-5 PR L — 챕터 9 synthesis LLM** (모든 챕터 정착 후 최종)

#### UI / UX
- **부채꼴 FAB 데스크탑 대응** — 현재 모바일 (md 미만) 만 dock 노출. 데스크탑에서는 PC 메가메뉴 사용 → 부채꼴 메뉴는 모바일 전용으로 OK. 다만 태블릿 (md~lg) 의 noise 검토 필요
- **별자리 카드 zodiac chip 디자인** — 현재 `pig/亥` (indigo) 차용. 12별자리 (Pisces/Aries 등) 전용 chip 컴포넌트 신설 검토
- **온보딩 carousel 슬라이드 transition** — 현재는 즉시 전환. swipe 동작 시 미세한 translate animation 추가 검토 (UX 부드러움)
- **GangiSeasonBanner 키보드 nav** — pointer drag + dots click 만 지원. ←/→ 화살표 키 지원 검토 (접근성)
- **PC 메가메뉴 회원가입 hover state** — 현재 ghost 버튼. hover 시 fill + transform scale 등 마이크로 인터랙션 검토

#### 모니터링 (production)
1. **PR #266 hot path** — `/api/today-fortune` + `/api/today-fortune/unlock` latency drift. Vercel runtime logs + Sentry saju calc error
2. **PR #267 internal builders** — yearly report 페이지의 monthly ganzi 정확성 + Vercel function memory peak (12개월 × 31일 = 372 V2 객체 추가 메모리)
3. **PR #268 dock portal** — 모바일에서 dock 정상 고정 (실기기 사파리/크롬). PR #268 의 createPortal 패턴이 production 빌드 후에도 SSR 정상 동작하는지
4. **PR #269 hydration fix** — production 콘솔 에러 0건 유지 (Sentry frontend errors). SiteFooter dl 정상 렌더
5. **PR #270 부채꼴 FAB** — 사용자 클릭률 (analytics) + 부채꼴 메뉴 각 항목 클릭 빈도. 만약 운세/사주 외 항목 클릭이 거의 없으면 메뉴 항목 재구성 검토
6. **PR #270 footer 검정** — 모든 페이지의 footer 하단 흰 공간 0 보장 (다양한 viewport)

### 0.4 알려진 위험 / 정리 후속

- **부채꼴 FAB pathname 변경 시 닫힘 로직** — `useEffect(() => { setFanMenuOpen(false); }, [pathname])` 적용. SPA 라우팅에서 정상 동작 확인 필요 (특히 prefetch + push)
- **온보딩 swipe vs 세로 스크롤 충돌** — `touch-action: pan-y` 로 세로 스크롤 보존. 모바일 실기기 테스트 권장 (특히 안드로이드 chrome)
- **GangiSeasonBanner mouse-only 가드 제거** — pointer events 가 native scroll-snap 과 동시 동작 시 일부 안드로이드 버전에서 jank 가능성. 후속 사용자 테스트 필요
- **V2-4 internal builder 메모리** — yearly report 1회 호출당 V2 객체 약 372개 생성. interpretation/verification 필드 동봉으로 V1 대비 ~25-40 KB / object. 372 × 30 KB = ~11 MB 추가. Vercel function memory limit (1024 MB) 대비 무난하나 모니터링
- **별자리 카드 zodiac 'pig' 차용** — 12간지 chip 중 indigo 톤. 12별자리 전용 디자인 미반영 (시각적 일관성 측면)

---

## 0a. 2026-05-18~19 세션 종합 — 결제 라우트 통일 + Phase 7 신뢰 장치 구축 (8 PR)

이틀에 걸쳐 PR #236 ~ #243 (8 PR 모두 머지). 두 축:
1. **결제 → 상세 화면 라우트 통일** (사용자 보고로 발견된 SKU별 분기 불일치)
2. **Phase 7 신뢰 장치 4축** (샘플 디스클로저 / 후기 인프라 / 상담사 AI-사람 구분 / 보관함 환불 안내) — 가짜 후기·상담실적·평점 0건 원칙 100% 준수

### 0.1 진행된 것 (완료 — main 머지) ✅

#### 결제 라우트 통일 — 2 PR

| PR | 제목 | 요약 |
|---|---|---|
| #236 | monthly-calendar(1,900원) 단독 구매자 Branch D | premium/page.tsx 분기에 `monthlyAccessLabel` 추가 + `hasAnyMonthlyCalendarForReading(userId, readingKey)` 헬퍼 (product_entitlements + legacy credit_transactions 양쪽 prefix 매칭). Branch 우선순위: lifetime → A → yearly → B → **monthly → D (NEW)** → 없음 → C. Branch D 구성: hero ✓월간달력 배지 + 월별 흐름 챕터(FortuneCalendarPanel) + 1·2장 잠금 미리보기 + 49,000원 풀팩 업셀 + 3,900원 year-core 대안 |
| #240 | today-detail 두 라우트 UI/풀이 통일 | 사용자 보고 — `/saju/[slug]/today-detail` (PR #206 inline 777줄, single topic) vs `/today-fortune/detail` (5 topic + 6+ 카드) 풀이·디자인 차이. **777줄 → 30줄** 로 wrapper 화, TodayFortuneDetailClient 재사용. backHref prop 추가로 사주 컨텍스트 (`/saju/{slug}`) 유지. resolveReading(slug) 으로 잘못된 link 사전 차단 |

#### Phase 7 신뢰 장치 구축 — 4 PR + 2 후속

| PR | 제목 | 요약 |
|---|---|---|
| #237 | Phase 7a /sample-report '리포트 제작 기준' 디스클로저 | 결제 CTA 직전에 4 카드 (생성 약 1~2분 / 14 섹션·A4 5~7페이지 / AI 모델 작성 / 사람 검수 없음) + /refund-policy /support/faq link. 디자인 토큰 (PANEL_STYLE / SOFT_FEATURE_STYLE) 재사용 |
| #238 | Phase 7b 후기 인프라 풀스택 (DB + API + 작성 UX + 표시 UI + admin moderation) | migration 033_reviews (table + RLS 4 policy + 3 인덱스 + updated_at trigger + UNIQUE user·product·scope). lib: types/queries/hash(SHA-256 12자)/verification(productId+scopeKey → entitlement 검증). API 5: POST·GET /api/reviews, /mine, /[id] PATCH·DELETE, /admin/reviews, /admin/reviews/moderate. UX: ReviewWriteDialog (별점·본문·표시명·검증) + saved-readings-list 통합 (구매 항목 카드 '✎ 후기 작성/심사 중/공개됨' 동적). 표시: ReviewList(server, productId='lifetime-report', 0건 empty state). Admin: /admin/reviews moderation queue + 공개·비공개 + 비공개 사유 |
| #239 | env: REVIEW_USER_HASH_SALT placeholder + 32-byte hex 생성 안내 | `.env.example` 문서화. 미설정 시 `ganji-saju-review-hash-v1` default |
| #241 | reviews policies repair migration 034 | 033 production push 시 `CREATE POLICY` IF NOT EXISTS 미지원으로 첫 select policy 충돌 → insert/update/delete 3 policy 누락. 034 가 `DROP POLICY IF EXISTS` + `CREATE POLICY` 4개 idempotent 재생성. `supabase migration repair --status applied 033 --linked` + `supabase db push --linked` 로 production 정상화 |
| #242 | Phase 7c 상담사 AI/사람 구분 + 환불·예약 정책 link | SpecialistMentorMode = 'ai-report' \| 'human-planned' 타입 + 4 mentor 모두 mode='ai-report'. 가문 선생 statusLabel '준비 중' → '출시 예정' (Phase 5f 톤). 각 카드 eyebrow 에 ModeBadge (AI 풀이 분홍 / 사람 상담·출시 예정 회색). footer 상담 안내 박스: AI 풀이 설명 + 사람 상담사 예약 출시 예정 + `/refund-policy` + `/appointment-policy` link |
| #243 | Phase 7d /my/results '보관함 안내' footer | 3 항목 (환불 가능 여부 / 환불 요청 / 개인정보·계정 삭제) + 4 link pill (`/refund-policy` / `/support/contact` / `/my/settings/delete-account` / `/support/faq`). 환불 자동 판정 X — 정책 페이지 link 만 (가짜 정보 차단) |

### 0.2 운영 적용

- **supabase migration 033 + 034 production 적용 완료** (linked project bgtzkjxihlbmxehmhtwg). `supabase migration list` 양쪽 Remote 컬럼 채워짐.
- **REVIEW_USER_HASH_SALT** (32-byte hex) Vercel `production` + `development` 등록 완료 + 로컬 `.env.local`. preview 는 CLI v52 비대화식 한계로 수동 대시그 (default salt fallback OK).
- Release 라벨 (사용자 자체 기록용): `2026-05-18 monthly-calendar 단독 구매 상세 화면` / `2026-05-18 샘플 페이지 정직 디스클로저` / `2026-05-18 구매 인증 후기 인프라` / `2026-05-19 today-detail 라우트 통일` / `2026-05-19 reviews policies 복구 migration` / `2026-05-19 상담사 AI/사람 구분` / `2026-05-19 보관함 환불·삭제 안내 footer`

### 0.3 다음 세션 큐

- **love-question 2 라우트 데이터 차이 통일** — `/compatibility/input?paid=love-question` vs `/compatibility/result?source=manual&paid=love-question`. Phase 2C agent 조사 시점에서 "데이터 다름" 보고됨. 별도 PR.
- (선택) lifetime/yearly 페이지에도 ReviewList 추가 (구매자에게 본인·타인 후기 노출)
- (선택) 평균 별점 표시 (실제 후기 쌓인 후)
- (선택) 후기 신고 기능

### 0.4 알려진 위험 / 정리 후속

- Vercel `preview` 환경에 `REVIEW_USER_HASH_SALT` 미설정 — preview 결제 후 작성된 후기의 userIdHash 가 production 과 다름 (preview 는 보안 영향 미미하나 일관성 위해 대시그 권장).
- Phase 7b 의 review-write-dialog 가 무한 textarea — 한글 모바일 IME 입력 시 onChange race condition 가능성 (미확인). 후속 사용자 테스트 필요.

---

## 0a. 2026-05-17~18 세션 종합 — 상용화 하드닝 Phase 1~5

이틀에 걸쳐 PR #218 ~ #234 (14 머지 + 1 OPEN). 사용자 directive "유료 상용화 가능 수준 하드닝" 으로 audit → 도메인 → KST → 정책 → 사업자 정보 → 결제 동의 → 미완성 UI 순차 진행.

### 0.1 진행된 것 (완료 — main 머지) ✅

#### Audit & Plan (Phase 0 / 1)

| PR | 제목 | 요약 |
|---|---|---|
| #218 | audit-lifetime-report — 49,000원 회귀 + 환불 정책 | scripts/audit-lifetime-report.mjs (manual 정기 회귀 도구) |
| #219 | audit-business-activity 분기 재실행 1회차 | 우선순위 등급 변동 0건 — 분기 모니터링 정착 |
| #220 | production-hardening Phase 1 audit + master plan (코드 변경 0건) | docs/audit/* 9개 (production-hardening-audit / route-status-map / incomplete-ui-inventory / legal-required-fields / policy-versioning / product-catalog / production-readiness-checklist / seo-content-plan / master plan) |

#### 도메인 / Canonical (Phase 1, 5 PR — hotfix 포함)

| PR | 제목 | 요약 |
|---|---|---|
| #221 | 도메인 canonical = ganjisaju.kr (영문 ASCII) + 브랜드 간지사주 | SITE_CONFIG + LEGACY 반전 + 38 파일 달빛인생 → 간지사주 + sitemap canonical + robots noindex 보강 + site.test.ts 16 시나리오 |
| #222 | KST 유틸 통합 + UTC drift P0 fix + /api/health/daily | src/shared/utils/kst.ts 6 함수 (getKstNow/Parts/DateKey/StartOfDay/formatKoreanDate/getDailyVersion) + 21 시나리오 + zodiac/[slug] periodSeed + buildTodayFortune raw new Date() fix |
| #223 | getTodayPillarSnapshot stored calculatedAt → 실제 오늘 | systematic-debugging Phase 1-4 — saju 페이지 (stored sajuData) vs today-fortune (fresh sajuData) calculatedAt 차이로 점수 95/71 deterministic mismatch root cause fix |
| #224 | hotfix canonical = www.ganjisaju.kr swap | ERR_TOO_MANY_REDIRECTS 긴급 (Vercel primary = www 와 코드 apex 충돌) — admin override |
| #225 | proxy single source of truth + punycode 정규화 보강 | proxy.ts hardcoded 조건 → src/lib/site.ts shouldRedirectHost 사용. 간지사주.kr (xn--) 도 canonical 정규화 |
| #226 | canonical = ganjisaju.kr (apex) 복귀 — Vercel 정상화 후 directive 원안 | 운영자 Vercel 대시보드 변경 (ganjisaju.kr primary + alias 308) 후 SITE_CONFIG.canonicalHost swap back. **308 vs 307** 답변: 도메인 정규화는 영구라 308 (Permanent + body 보존) 가 표준 |

#### Phase 3 (전자상거래 고지) — 3 PR

| PR | 제목 | 요약 |
|---|---|---|
| #227 | Phase 3-A 사업자 정보 env config + production 빌드 가드 + 푸터 개선 | src/lib/business-info.ts (BUSINESS_INFO 11 필드 + assertProductionBusinessEnv) + .env.example 11 키 + 푸터/help BusinessInfoCard env 기반 + 가드 조건 VERCEL_ENV='production' 한정 + 12 env 실제값 운영자 입력 후 production 검증 통과 (회사명/대표자/사업자번호/통신판매번호/주소/CS 전화·이메일·운영시간/CPO 이름·이메일·전화/공시 URL) |
| #228 | Phase 3-B 정책 페이지 9개 + DB 버저닝 + admin UI | migration 031 (policy_versions + user_policy_consents + RLS + ip_hash 익명화) + src/shared/policies/types.ts + src/lib/policies.ts (server fetch/create/recordConsent + computeContentHash) + policies.test.ts 12 시나리오 + 3 골격 컴포넌트 (PolicyContent markdown lite / PolicyNotReady / PolicyPageShell) + 7 신설 정책 페이지 (/refund-policy /digital-content-policy /subscription-policy /coin-policy /appointment-policy /ai-disclaimer /commerce-disclosure) + /admin/policies UI + admin CRUD API |
| #229 | Phase 3-C-1 결제 동의 체크박스 + recordUserConsent (membership 연결) | src/shared/payments/consent-rules.ts (client-safe) + src/lib/payments/consent.ts (recordConsentsForPayment server) + 10 단위 테스트 + PaymentConsentCheckboxes (master + 항목별 + 정책 link + valid callback) + /api/payments/prepare 가드 (acceptedKinds 검증 + funnel_log consent_missing) + toss-membership-checkout 연결 |
| #230 | /legal hub 탭 UI + /terms /privacy 새 패턴 + 푸터 #000 강제 | /legal?tab={kind} 가로 chip 탭 + 푸터 정책 nav 단축 (9 줄줄이 → '정책 모아보기' 한 줄) + 푸터 inline `background-color: #000000` + globals.css `!important` override + /terms /privacy hardcoded JSX → PolicyPage 패턴 + migration 032 seed (기존 본문 markdown import + pgcrypto SHA-256 자동 계산 + on conflict do nothing) |

#### Phase 5 (미완성 UI / 로딩 / 빈 상태) — 4 PR

| PR | 제목 | 요약 |
|---|---|---|
| #231 | Phase 5-A+B 상태 컴포넌트 6 표준화 + 미완성 문구 제거 | src/components/state/* 6 컴포넌트 (LoadingState / EmptyState / ErrorState / RetryButton / SkeletonCard / FeatureUnavailable) + 10 위치 미완성 문구 제거 (membership 3 카드 comingSoon filter / lock-screen FeatureUnavailable / search LoadingState / help "✦ 준비 중" 배지 제거 / 3 loading.tsx "준비 중" → "불러오는 중" / 홈 그리드 filter / 알림 "준비 중" → "출시 예정" / legal aria-label) |
| #232 | Phase 5-C 로그인 / reset-password skeleton + 로그인 고객센터 링크 | LoginPageFallback (로고/안내/카카오/Google 위치 skeleton + disabled button + sr-only) + reset-password skeleton + 로그인 안내에 /help 고객센터 링크 추가 |
| #233 | Phase 5-D 코인 센터 잔액 skeleton + 재시도 + 정책/CS 링크 | creditsFetchError state + creditsFetchVersion retry + 잔액 영역 skeleton (animate-pulse) + inline retry button (다크 배경 ErrorState 시각 충돌 회피) + audit-mockup intentional 마커 ✦ — + /coin-policy /refund-policy /help + 사업자 이메일 link |

### 0.2 진행 중 — main 머지 대기 (1 PR)

| PR | 제목 | 상태 |
|---|---|---|
| #234 | Phase 5-E 택일 결과없음 EmptyState + 4 CTA | OPEN — CI 전단 pass, 사용자 머지 신호 대기 |

PR #234 변경:
- /taekil 의 "결과가 없습니다" 단순 문구 → 표준 EmptyState
- title: "현재 조건에 맞는 좋은 날을 찾지 못했습니다"
- 4 CTA: 다른 목적으로 다시 찾기 / 생년월일 확인 / 추천 날짜 생성 / 유료 상세 풀이

### 0.3 진행했으면 하는 것 (master plan / sub-PR 큐)

**Phase 5 잔여**:
- **5-F**: Playwright 금지 문구 회귀 차단 테스트 — "준비 중" / "TODO" / "로딩중..." 등 공개 페이지 노출 시 fail. Phase 5 의 완결 (자동 회귀 차단).

**Phase 6 (안전 고지 + AI 한계 + 위기 대응)**:
- **6-A**: 공통 면책 고지 (푸터 / AI 상담 / 결제 전) + AI 사용 고지 (입력값 사용 / 결과 한계 / 저장 보관 / 삭제 요청 방법)
- **6-B+C**: AI 위험 키워드 감지 (자해·자살 / 타해 / 응급의료 / 법률 / 투자 / 도박 / 미성년자 고위험 / 개인정보 과다 입력) + 위기상황 응답 템플릿 (112/119/지역 정신건강위기상담전화 안내)

**Phase 3-C-2** (Phase 3 완결):
- 회원가입 TermsConsentModal 실연결 + DB insert (consent_method='signup_explicit')

**Phase 3-C-1-B** (Phase 3-C-1 의 후속):
- credits / saju lifetime-report / today-detail 등 다른 결제 페이지에 PaymentConsentCheckboxes + prepare 호출 추가 (Phase 3-C-1 은 membership 만)

**Phase 4 (가격 / 코인 / 구독 / 예약상담 UX)** — 대규모, 3 sub-PR:
- **4-A**: 상품 카탈로그 중앙화 (Product type one_time_digital / subscription / coin_pack / appointment / report)
- **4-B**: 코인 원화 환산 UI + "무제한" 문구 → 월 N회 (MEMBERSHIP_LIMITS config)
- **4-C**: 결제 전 요약 카드 + 결제 실패/취소/완료/webhook 미수신/콘텐츠 생성 실패 상태 분리

**Phase 6+** (이후 audit 추가 사항):
- **Phase 7** 상담 예약 취소/노쇼 정책 + UI/API (PATCH /api/appointments)
- **Phase 8** 코인 유효기간 정책-구현 정합 (FAQ "1년" vs DB 영구 — 운영자 결정 필요)
- **Phase 9** CI 보강: vitest *.spec.ts (payment-duplicate-audit 포함) + audit:payment-idempotency:strict + audit:ai-chat-idempotency:strict + eslint
- **Phase 10** SEO 확장: 32 slug 페이지 openGraph/twitter + sitemap dateKey 동적화 + 꿈해몽 사전 100건 + 별자리 144 compat

### 0.4 운영자 입력 / 확인 대기 항목

- **/admin/policies**: 9 정책 중 terms/privacy 외 7 정책 (refund / digital-content / subscription / coin / appointment / ai-disclaimer / commerce-disclosure) 본문 admin 입력 필요. 입력 전엔 PolicyNotReady ("고객센터로 문의") + noindex 자동
- **Vercel 대시보드**: production 도메인 alias 정합 (현재 정상 — 정기 점검 권장)
- **policy_versions seed migration (032)**: pgcrypto extension 활성 확인 (Supabase production 의존)
- **legal 본문 검토**: 사용자가 admin UI 통해 직접 입력한 terms/privacy 본문은 법무 검토 필요

### 0.5 알려진 위험 / 정리 후속

- 기존 4 KST 유틸 (getKoreaAccessDay / getKoreaDateKey / getSeoulDateKey / toKstDateKey) 점진 마이그레이션 필요 (PR #222 에서 single utility 도입했으나 caller 미통일)
- gangi-ui.tsx GANGI_TEACHERS 의 "준비 중" 가격 잔존 (홈 / pricing filter 됨, 다른 위치 nav 검토)
- PR #229 의 결제 동의: membership 만 연결 — 다른 결제 페이지는 acceptedKinds 미전달 (backward compat) → Phase 3-C-1-B 에서 전체 연결
- PR #218 / #219 의 audit script 들 manual 실행 — Phase 9 에서 CI strict 통합 권장 (audit:payment-idempotency / audit:ai-chat-idempotency / audit:lucky-hybrid)

---

## 0b. 2026-05-16 세션 종합 (9 PR + 자동 검증 시스템 도입)

이날 하루에 PR #176-#184 (총 9 PR) 머지 + 회귀 자동 검출 시스템 1세대 구축.

### 0.1 작업 흐름 요약 (시간 순)

| Phase | PR 범위 | 핵심 변경 | 사용자 보고 / 발견 |
|---|---|---|---|
| 1. UI 회귀 + 결제 차단 | #176/#177/#178 | UI 7건 + 결제 진입점 9곳 차단 + entitlement API/hook | 사용자 보고 (토스 "no healthy upstream") |
| 2. 점수 통일 | #179/#180/#181 | iljinScore.totalScore single source + helper 추출 + 6 영역 카드 통일 | 사용자 보고 (사주 페이지 69 vs 운세 페이지 45 → 24점 차이) |
| 3. OPEN PR 일괄 머지 | #168-#175 (8개) | 미머지 누적 PR (settings, font, onboarding, my routes, mobile sheet, admin funnel 등) batch 머지 | 사용자 보고 (로그아웃 부재 / 메뉴 탭 변경 미적용) |
| 4. dead anchor fix | #182 | premium hero 카드 3 버튼 미존재 anchor (#yearly-chapter-1/2/3) → 실제 anchor 매핑 | 사용자 보고 (메인 카드 버튼 무반응) |
| 5. 자동 회귀 검증 시스템 | #183/#184 | audit-dead-anchors + score invariant test + Playwright smoke E2E | 사용자 메타 피드백 ("끝없이 지적하지 않게 해줘") |

### 0.2 핵심 결정 사항

1. **iljinScore.totalScore single source of truth** (PR #179-#181): 사주 페이지의 모든 영역별 점수가 오늘 운세 페이지와 1:1 일치. helper (`unifyScoresWithIljinScore` / `computeSajuAreaScores`) + 공유 컴포넌트 (`SajuAreaCardsSection`) 패턴으로 통일.

2. **6 영역 카드 통일** (PR #181): 사주 메인/상세/오늘 운세 페이지 모두 동일 6 카드 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운). 라벨/색상/순서/score 모두 single source.

3. **자동 회귀 검증 시스템 도입 (사용자 메타 피드백 대응)** (PR #183/#184):
   - **audit-dead-anchors.mjs**: `href="#xxx"` 미존재 anchor 자동 검출 (PR #182 류 회귀 차단)
   - **score invariant test**: 사주 페이지 ↔ 운세 페이지 6 영역 score 1:1 일치 strict assertion (PR #179-#181 가정 매 PR 자동 검증)
   - **Playwright smoke E2E**: 페이지 진입 깨짐 / console error / dead internal link 자동 차단
   - 자동화 즉시 효과: PR #183 도입 시점에 사용자가 보고 안 한 dailyDelta 누락 회귀 검출 + fix

4. **conflict resolution** (PR #169 ↔ #179, build-today-fortune.ts): PR #179 helper 추출이 PR #169 의 부분 boundary fix를 더 완전한 방식으로 포함 → PR #179 채택. PR #169가 도입한 invariant test 는 PR #179 helper가 자동 보장.

5. **admin override 머지 유지**: CI npm ci 만성 실패 (typescript@4.9.5 peer-dep 충돌) — A5 작업으로 fix 예정. 그동안 PR #176-#184 모두 admin override squash merge.

### 0.3 산출물 (모두 production 배포 완료)

- 신규 helper 5개: `unify-saju-scores.ts`, `compute-saju-area-scores.ts`, `computeSajuIljinScore` wrapper, `SajuAreaCardsSection`, `payment-duplicate-audit.spec.ts`
- 신규 API 1개: `GET /api/payments/entitlement` + `useProductEntitlement` hook
- 신규 script 2개: `scripts/audit-user-entitlements.mjs`, `scripts/audit-dead-anchors.mjs`
- 신규 E2E 1개: `e2e/smoke.spec.ts` (Playwright chromium)
- 신규 doc 1개: `docs/payment-duplicate-block-verification.md`
- 새 invariant test 2건 (PR #169 boundary + PR #183 score 일치)

### 0.4 사용자 검증 일치 항목

- ✅ 결제 중복 차단 9곳 (멤버십/lifetime/today-detail/monthly-calendar)
- ✅ 사주 페이지 ↔ 오늘 운세 페이지 점수 1:1 일치 (3 페이지 모두)
- ✅ 6 영역 카드 통일 (사주 메인/상세/운세 동일 항목)
- ✅ premium hero 카드 3 버튼 작동 (anchor scroll + lifetime 업셀)
- ✅ 로그아웃 버튼 노출 (메가 메뉴 우상단 + /my/settings)
- ✅ 모바일 시트 4탭 균등 너비

### 0.5 다음 세션 우선순위 (✅ 모두 완료 — 2026-05-16 PR #185-#187)

1. ✅ **Tier 0-1 (Phase 2B)**: 사주 페이지 인증 E2E — Supabase test user (hybrid storage state) → PR #186 + #187 fix
2. ✅ **Tier A5**: CI `npm ci --legacy-peer-deps` fix → PR #185. admin override 의존 종료, PR #186-#187 모두 정상 CI 통과 머지
3. ✅ **Tier 0-2/0-3**: Playwright CI workflow + audit:dead-anchors strict gate (ci.yml step) → PR #185

### 0.6 2026-05-16 Tier 0 완료 후 — Phase 2C / A7 / A4 까지 (자동 회귀 검증 6 도구)

- **자동 회귀 검증 시스템 3 세대 가동** (CI 매 PR push 자동 실행):
  ```
  ├─ npm test                              (355 unit + score invariant + lucky-hybrid matrix)
  ├─ audit:dead-anchors:strict             (PR #182 류 dead anchor 정적 검출)
  ├─ audit:lucky-hybrid:strict             (PR #167 hybrid 120 조합 invariant — PR #190)
  ├─ chromium project (Phase 2A)           (5 public page smoke + console error + dead link)
  ├─ chromium-auth project (Phase 2B)
  │  ├─ auth.setup.ts                       (test 계정 로그인 + storage state)
  │  └─ saju #1-#4                          (6 카드 / hero anchor / 결제 진입점 / 점수 일치)
  └─ chromium-payment-blocks (Phase 2C)
     ├─ auth-setup                          (재사용)
     ├─ active subscription seed/cleanup    (subscription "이용 중" 차단)
     │  ├─ /membership "이용 중" 배지
     │  ├─ /pricing "✓ 이용 중 · 결제 내역" CTA
     │  └─ /membership/checkout "이미 이용 중인 멤버십입니다"
     └─ lifetime entitlement seed/cleanup
        └─ /saju/[slug]/deep "✓ 구매한 풀이 보기" CTA
  ```
- **활성화 자산**:
  - dev project `bgtzkjxihlbmxehmhtwg` 의 전용 test 계정 `e2e-test@ganjisaju.kr` + reading `b104b797-5da7-4bec-a0e1-eaa4ff8af710`
  - GitHub Secrets: `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `E2E_TEST_USER_EMAIL` / `_PASSWORD` / `E2E_TEST_READING_SLUG` / `SUPABASE_SERVICE_ROLE_KEY`
  - `.env.local`: 동일 env (로컬 검증용)
  - Playwright CI: Node 22 (Supabase admin client WebSocket 의존성 — PR #188)
- **A7 production 동작 (실시간 entitlement 반영)**:
  - 단일 CTA (deep / main): client wrapper + `useProductEntitlement` (focus 시 자동 재요청)
  - 복합 conditional (premium / print): `EntitlementRefresher` 컴포넌트 (focus 시 `router.refresh()` → server component 재실행)
  - 다른 탭 결제 후 본 탭 자동 갱신 — 사용자 reload 불필요

---

## 1. 작업 흐름 (PR 단위)

### 1.1 별자리 시스템 구축 (PR #127–#135)

| PR | 내용 |
|---|---|
| #127 | 12 별자리 상세 페이지 — 콘텐츠 라이브러리 (`sign-content.ts`) + 일별 Mulberry32 PRNG (`daily-fortune.ts`) + 12×12 호환 매트릭스 |
| #128 | `/star-sign` 메인 — TOP 3 / 살짝 주의 / 12 sign 점수 grid / 원소·모달리티 분류 |
| #129 | `/star-sign/[slug]/cross` — 서양 element × 동양 일간 합성 (상생/상극 5 관계) |
| #130 | `/star-sign/compat/[a]/[b]` — 두 별자리 6 영역 궁합 + 데이트/갈등 팁 |
| #131 | `MyStarSignCard` — `profile.birthMonth/Day` 자동 매칭, `/my` 노출 |
| #132 | 홈 (`GangiHomeClient`) 에 `MyStarSignCard` server-render slot 전달 |
| #133 | 오늘 별자리 일진 다이제스트 — `/notifications` 헤더 카드 + TOP 3 + 주의 1 |
| #134 | `/star-sign/compat` — 12×12 = 144 칸 매트릭스 미리보기 |
| #135 | `today-star-sign` push 슬롯 — 사용자 생년월일 → 별자리 자동 매칭 |

### 1.2 Push / A/B / 운영 (PR #136–#142)

| PR | 내용 |
|---|---|
| #136 | 별자리 push A/B 본문 variant (A 점수 / B 부스터 / C 럭키), FNV-1a 해시 결정적 선택 |
| #137 | 클릭률 추적 — URL `?notif=<logId>` + Portal 자동 ack + `/api/admin/push-ctr` |
| #138 | 별자리 즐겨찾기 — `star_sign_favorites` 테이블, FavoriteButton, MY strip |
| #139 | `/star-sign/[slug]/cross` 의 `cachedCalculateSaju` LRU+TTL 캐시 |
| #140 | 신살 active weight 자동 production 적용 — stale-while-revalidate cache |
| #141 | `/admin/*` 화이트리스트 가드 — `admin_users` 테이블 + env `ADMIN_USER_IDS` |
| #142 | VAPID 발급/배포 가이드 + `/api/admin/web-push-status` 진단 |

### 1.3 리텐션 / 자동화 (PR #143–#146)

| PR | 내용 |
|---|---|
| #143 | 멤버십 만료 임박 push — D-7 / D-3 / D-day 단계별 본문, KST 10:00 cron |
| #144 | 컴백 push — `lastSeenAt + inactivityReminderDays` 기반, KST 19:00 |
| #145 | A/B winner 자동 선택 — ε-greedy 90% exploit + 10% explore |
| #146 | `/admin/push-ctr` UI — variant CTR 시각화 + winner 정책 |

### 1.4 사용자 상황 입력 UX (PR #147–#149)

| PR | Part | 내용 |
|---|---|---|
| #147 | A | 입력 hero + "정확도 ↑" 뱃지 + live preview chip strip |
| #148 | B | 사주 결과 페이지 "상황 반영" chip + amber CTA |
| #149 | C | 오늘 운세 영역 점수 재정렬 + perspective 한 줄 + compact chip |

### 1.5 상황 호명 후속 (PR #150–#153)

| PR | 내용 |
|---|---|
| #150 | 사주 narrative `buildHonorificPrefix` + `buildSituationActionLine` — "직장인이신 김영민님, …" |
| #151 | `/my/situation` 분리 페이지 + `profiles.user_situation` 컬럼 + 자동 fallback |
| #152 | `/compatibility` 에 `SituationReflectionCard` compact |
| #153 | 신살 모델 R² < 0.05 promote 차단 + `?force=1` 우회 |

### 1.6 로딩 모션 통일 (PR #154 / #157 / #164)

| PR | 내용 |
|---|---|
| #154 | `<ZodiacWheelLoading>` — 회전 12지지 한자 + 별 입자 + cosmic gradient. saju-intake 적용 |
| #157 | `GangiLoadingOverlay` 자체를 `ZodiacWheelLoading` 으로 통합 → 모든 호출자 (5곳) 자동 12간지 로딩 |
| #164 | `/today-fortune/detail` unlock 흐름에 `MIN_LOADING_MS=600` 가드 |

### 1.7 네비게이션 메가 메뉴 / 모바일 시트 (PR #155 / #156 / #158 / #159)

| PR | 내용 |
|---|---|
| #155 | PC 메가 메뉴 — 운세 / 사주 / 대화 / 멤버십 4 group + 풀폭 3컬럼 패널, lg+ 표시 |
| #156 | 모바일 시트 — 같은 `MEGA_NAV` 데이터 + bottom sheet (PR #158 에서 top sheet 로 변경) |
| #158 | PC 호버 닫힘 fix (SiteHeader `lg:hidden`) + 모바일 시트 Portal + **bottom → top sheet** |
| #159 | PC SiteHeader 강제 숨김 — Tailwind specificity 보강 (CSS `!important`) |

### 1.8 호명·점수 정합성 (PR #160 / #161 / #163 / #165 / #166 / #167 / #162)

| PR | 내용 |
|---|---|
| #160 | 대화 메가 메뉴 선생 → `DALBIT_TEACHERS` 매핑 (명리호 / 타로토 / 사주용 / 궁합양) |
| #161 | 12간지 선생 12명 모두 `status='active'` 복원 + 메가 c1 전체 노출 |
| #162 | 오늘 운세 "무료 결과 보기" 전환 매끄럽게 — overlay + `setFreeResult` 제거 + min-loading |
| #163 | `달빛선생 / 달빛 여선생 / 달빛 남선생` 임의 호명 9 파일 일괄 정리 |
| #165 | **점수 전수 통일** — `iljinScore.totalScore` single source, 영역별 평균 normalize |
| #166 | 사용자 이름 자동 주입 (`profile.display_name`) + storage prefix v2 |
| #167 | 행운 패키지 일진 hybrid — 일진 element 가 lucky/unlucky 와 다르면 9 항목 합집합 |

### 1.9 UI 회귀 정리 (PR #176)

7건 사용자 보고 회귀 일괄 fix. 모두 `/today-fortune/*` 흐름.

| Issue | 핵심 |
|---|---|
| 1 | 점수 통일 회귀 — `clampScore (48~92 floor)` 가 `iljinScore.totalScore (5~95)` 를 강제로 끌어올려 "총운 banner = 산출내역 합계" 가 깨짐. unification 전용 `clampUnified(5~95)` 추가. |
| 2 | `TodayFortuneScoreGrid` (2컬럼 grid) 와 `TodayCategoryReadings` (stacked) 가 같은 영역 점수를 중복 노출 → grid 제거. |
| 3 | 사주 명식 카드의 오행 분포가 5행 vertical → 1행 5열 compact grid. 부족/과다는 셀 배경+외곽선으로 표시. |
| 4 | 1코인 unlock 후 page 최상단으로 점프 → `premiumRef` + 220ms `scrollIntoView({behavior:'smooth'})` 로 프리미엄 패널 위치 자동 스크롤. |
| 5 | "💭 깊이 들어갈 만한 질문" Q1/Q2/Q3 가 정적 `<li>` → 클릭 핸들러 없음. `TodayPremiumQuestionChips` client 컴포넌트 신설, `/dialogue?question=...` prefill (autoStart 제거 — 사용자가 전송). |
| 6 | `ELEMENT_INFO.name` 어색한 단어 페어 교체: 성장기운→**시작과 추진** / 표현기운→**열정과 표현** / 안정기운→**안정과 중심** / 정리기운→**결단과 마무리** / 생각기운→**지혜와 유연**. `trimEasySentence` 의 "흐름→분위기", "기준→생각할 점" 치환 제거. |
| 7 | 모든 nav 클릭 시 푸터로 점프 후 페이지 전환 → `site-header` 6 곳 `scroll={false}` 제거 (긴 페이지 → 짧은 페이지 이동 시 footer 근처 착륙 회귀). 결과 페이지 unlock 의 `window.location.href` → `router.push` soft navigation. |

### 1.23 행운 패키지 hybrid 매트릭스 audit + 전수 invariant test (PR #190)

**배경**: PR #167 의 `deriveHybridElements` 분기 4종 (no-iljin / ignored-iljin(기신) / emphasized(같은 오행) / union(합집합)) 가 5 lucky × 4 unlucky × 6 stem = **120 조합** 모두에서 의도대로 동작하는지 운영 + CI 자동 검증.

**신규 자산**:

1. `scripts/audit-lucky-hybrid.mjs` — standalone Node 22+ CLI audit
   - 전수 모드 (기본): 120 케이스 매트릭스 + invariant 위배 보고
   - 단일 모드: `--lucky 화 --unlucky 금` → 5 stem 시뮬레이션
   - `--strict`: 위배 시 exit 1 (CI 통합 가능)
   - 룰만 재현 (src/ import 없음). lucky-package.ts 변경 시 본 스크립트 + test 동기 필요

2. `lucky-package.test.ts` 전수 매트릭스 invariant — 매 `npm test` 자동 실행
   - 실 `buildTodayLuckyPackage` 함수로 120 조합 호출
   - 분기별 cardinality (단일=2, 합집합=4) 검증

3. `package.json` 신규: `audit:lucky-hybrid` / `audit:lucky-hybrid:strict`

**운영 가치**: 사용자 보고 ("오늘 행운 색이 어제와 같은데 일진은 달라요") 시 audit 으로 즉시 (lucky, unlucky, stem) 조합 예상 분기 + cardinality 진단. 신규 lookup 추가 시 matrix invariant 가 회귀 자동 검출.

**검증**: npm test 355 ok / 0 fail (matrix +1), audit:strict ✅ 120/120 통과.

### 1.22 A7 useProductEntitlement 일관화 — 4 saju 페이지 실시간 entitlement 반영 (PR #189)

**사용자 동기**: 다른 탭/창에서 결제 완료 후 사주 결과 페이지로 돌아오면 CTA 가 아직 "결제하기" 로 남아있는 회귀 해소.

**Hook 강화** (`useProductEntitlement`):
- `initialEntitlement`: 서버 SSR 결과를 초기값 → 첫 paint 깜빡임 0
- `revalidateOnFocus` / `revalidateOnVisibility` (default true): focus/visible 시 자동 재요청
- `refresh()`: 외부 결제 confirm callback 등에서 명시적 trigger
- 네트워크 실패 시 fail-open

**Hybrid 마이그레이션 패턴** (4 페이지):
| 페이지 | 패턴 | 이유 |
|---|---|---|
| `/saju/[slug]` | `TodayDetailResultCta` 클라이언트 wrapper | 단일 CTA → granular update |
| `/saju/[slug]/deep` | `LifetimeDeepCta` 클라이언트 wrapper | 단일 CTA → granular update |
| `/saju/[slug]/premium` | `EntitlementRefresher` (router.refresh on focus) | hero/sections/CTAs 다수 conditional → 페이지 전체 server re-render |
| `/saju/[slug]/premium/print` | `EntitlementRefresher` (양 분기) | gated ↔ accessible 양방향 전환 |

**신규 컴포넌트**: `src/components/saju/lifetime-deep-cta.tsx` / `today-detail-result-cta.tsx` / `entitlement-refresher.tsx`

**검증**: typecheck 0 / Phase 2A+2B 회귀 0 / Phase 2C 14/14 CI pass.

### 1.21 Phase 2C 결제 차단 활성 entitlement E2E (PR #188)

**배경**: Phase 2A (인증 X smoke) → Phase 2B (인증 O free user 4 시나리오) → **Phase 2C (활성 entitlement 사용자 결제 차단 4 시나리오)** 확장. PR #177 결제 차단 9곳 중 핵심 4곳 매 PR 자동 검출.

**검증 시나리오** (4 시나리오, PR #177 회귀 차단):
1. `/membership` 활성 구독 plan 카드 "이용 중" 배지
2. `/pricing` 활성 구독 plan "✓ 이용 중 · 결제 내역" CTA
3. `/membership/checkout?plan=basic` "이미 이용 중인 멤버십입니다" 안내
4. `/saju/[slug]/deep` lifetime 보유 시 "✓ 구매한 풀이 보기" CTA

**Hybrid entitlement seed/cleanup 패턴**:
- `e2e/fixtures/supabase-admin.ts` — service_role admin client (dev/staging only)
- `e2e/fixtures/entitlement-helpers.ts` — `seedSubscription` / `seedProductEntitlement` (upsert idempotent) + cleanup (`UPDATE status='expired'` safe)
- `test.describe.configure({ mode: 'serial' })` — beforeAll/afterAll race 차단 (parallel worker 환경에서 다른 worker cleanup 이 다른 worker test 의 UI check 전 실행되는 회귀 방지)

**CI Node 22 upgrade (playwright.yml)**: `@supabase/supabase-js@^2.103.1` admin client 가 Node 20 의 native WebSocket 부재로 실패 → Node 22+ 의 native 지원으로 해결. `ci.yml` 은 Vercel runtime 호환 위해 20.x 유지.

**로컬 환경 gotcha 발견** (§3.1d 참조): `.env.development.local` (vercel CLI 자동 생성) 의 빈 값 override 가 `.env.local` 우선순위 보다 높아 `SUPABASE_SERVICE_ROLE_KEY` 가 사라지는 문제.

**검증**: Phase 2A 5 + Phase 2B 5 + Phase 2C 5 = 14/14 pass (CI 2m22s).

### 1.20 Phase 2B selector + flow fix — 4 시나리오 실측 통과 (PR #187)

**배경**: PR #186 직후 활성화 단계 (dev project 의 test 계정 e2e-test@ganjisaju.kr + reading slug `b104b797-5da7-4bec-a0e1-eaa4ff8af710`) 에서 발견한 회귀 3건.

| # | 원인 | Fix |
|---|---|---|
| 1, 4 | `section:has(h2:text("오늘의 분야별 흐름"))` 가 outer wrapper section 까지 매칭 → 페이지 article 15 개 카운트 (vs 6 기대). 추가로 /today-fortune 결과 페이지는 heading "영역별로 자세히 보기" 사용 → 단일 selector 로 양 페이지 처리 불가 | `extractAreaScores` 를 label exact-match 기반으로 재작성 (heading/section 비의존). `article.filter({ has: page.getByText(label, { exact: true }) })` 패턴. 양 페이지 DOM 차이 모두 수용 |
| 4 | /today-fortune 은 입력 form 페이지 (생년월일 + 주제), 6 카드는 `/today-fortune/result` 에서 노출 | "무료 결과 보기" 클릭 → result URL wait → score 추출. logged-in 사용자 MY 프로필 자동 채움 활용 |
| 2 | paid 사용자만 hero card 렌더 → free user 에선 무조건 fail (실 회귀 아님) | hero anchor count === 0 일 때 `test.skip` graceful fallback. paid 시엔 각 `#premium-*` href 가 가리키는 id 존재 strict 검증 |

**CI 1차 실패 — GitHub Secrets 누락**: PR #186 의 `playwright.yml` 이 `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` 를 `secrets.*` 로 참조했지만 repo Secrets 에 미설정 → 빈 env → `hasSupabaseBrowserEnv=false` → 로그인 button disabled → click 영구 대기 → timeout. 활성화 절차 보강 (Secrets 5종 추가) 후 재실행 성공.

**검증**: chromium-auth 5 test 모두 pass (auth-setup 1.9s + saju #1 4.2s + #2 4.1s + #3 4.0s + #4 6.8s = 총 10.2s 로컬, CI 1m44s).

### 1.19 CI hardening — admin override 종료 (PR #185)

**배경**: PR #176-#184 (9 PR 연속) 모두 `npm ci` 의 `typescript@4.9.5` peer-dep 충돌 (`@tosspayments/payment-widget-sdk` 가 typescript 4.x 요구 vs `package.json` typescript ^5) 로 CI fail → admin override squash merge 패턴 만성화.

**Fix 3건 1 PR 통합**:
1. **A5**: `.github/workflows/ci.yml` 의 `npm ci` → `npm ci --legacy-peer-deps`
2. **0-3**: ci.yml step 으로 `npm run audit:dead-anchors:strict` 추가 — PR #182 류 dead anchor PR 머지 전 차단
3. **0-2**: `.github/workflows/playwright.yml` 신규 — Phase 2A smoke E2E 매 PR 자동 실행 (chromium only, ~1.5분). 실패 시 `playwright-report` artifact 14일 보관

**효과**: PR #185 자체가 첫 admin override 없는 정상 squash merge 통과. PR #186/#187 모두 동일하게 정상 통과.

### 1.18 Phase 2B 사주 페이지 인증 E2E 인프라 (PR #186)

**배경**: Phase 2A 가 인증 X 페이지만 검증. 사주 메인/상세 + /membership 등 로그인 페이지의 회귀 (PR #177-#181 류) 는 사용자 보고에 의존.

**Hybrid auth fixture 패턴**:
- `e2e/auth.setup.ts` — credentials 환경변수 있으면 `/login?mode=login` 에서 이메일 로그인 1회 수행 후 `e2e/.auth/test-user.json` 에 storage state 저장. 미설정 시 `setup.skip` 처리
- `e2e/fixtures/test-user.ts` — `E2E_TEST_USER_EMAIL` / `_PASSWORD` / `E2E_TEST_READING_SLUG` helper + `hasTestUser()` / `getTestReadingSlug()`
- `playwright.config.ts` — `chromium` (Phase 2A) + `auth-setup` + `chromium-auth` (Phase 2B, dependencies: auth-setup, storageState 재사용) 3 project 구조
- `.github/workflows/playwright.yml` — `E2E_TEST_USER_*` secrets 통과

**4 회귀 시나리오** (e2e/saju.spec.ts):
1. `/saju/[slug]` 6 영역 카드 (PR #181)
2. `/saju/[slug]/premium` hero anchor (PR #182, paid 시 strict)
3. `/membership` 활성 구독자 "이용 중" 배지 (PR #177/#178)
4. `/saju/[slug]` ↔ `/today-fortune/result` 6 영역 score 1:1 일치 (PR #179-#181)

**CI 안전 설계**: credentials 미설정 시 dependency chain 으로 chromium-auth 의 모든 spec 자동 skip → 회귀 0. Secrets 활성 시점부터 자동 검증 시작.

### 1.17 자동 회귀 검증 시스템 Phase 2A — Playwright smoke E2E (PR #184)

**배경**: PR #183 audit/invariant 다음 단계. 페이지 진입 자체 깨짐 / console error / dead internal link 류 회귀를 매 PR 자동 검출.

**setup**:
- `@playwright/test 1.60.0` devDependency
- `playwright.config.ts` — chromium project + webServer (npm run dev 자동 시작 + reuse)
- `e2e/smoke.spec.ts` — 5 test (홈/pricing/membership/compatibility/input + dead link 검증)
- npm scripts: `e2e` / `e2e:headed` / `e2e:ui` / `e2e:install`

**검증 범위 (인증 X 페이지)**:
- 페이지 status 200-399
- 핵심 HTML 골격 (main/header/nav/h1) 노출
- console error 0 (analytics/manifest 외부 무해 error 제외)
- 홈 internal link 20개 sampling — dead link 검출

**결과**: `npm run e2e` → 5/5 pass (~6s, chromium).

### 1.16 자동 회귀 검증 시스템 Phase 1 + dailyDelta 누락 fix (PR #183)

**배경 — 사용자 메타 피드백 (2026-05-16)**:
> "기본적으로 사람이 사용하면서 느끼는 불편함을 하나하나 지적해서 수정하다 보니 끝이 없는거 같아. 어느정도는 학습이 되어서 편하게 이용할 수있도록 해줬으면 좋겠어."

→ 사용자 보고 전 회귀를 자동 검출하는 시스템 도입.

**자동화 추가**:

1. `scripts/audit-dead-anchors.mjs` (신규)
   - `src/` 전체 *.tsx/*.ts 에서 `href="#xxx"` 패턴 추출
   - 해당 `id="xxx"` 가 src 어디에도 없으면 dead anchor 보고
   - hex color (#fff7e6) / hash 비교 literal 등 false positive 차단
   - `--strict` 모드: dead anchor 1건이라도 있으면 exit 1 (CI 통합 가능)
   - npm scripts: `audit:dead-anchors` / `audit:dead-anchors:strict`

2. `build-today-fortune.test.ts` 점수 invariant test
   "saju area scores match today-fortune free result scores 1:1 (PR #181 invariant)"
   - 사주 메인/상세 페이지의 `computeSajuAreaScores` 결과 6 영역 score 가
     오늘 운세 페이지의 `buildTodayFortuneFreeResult.scores` 와 1:1 일치 보장
   - 매 `npm test` 자동 검증

**검출된 회귀 fix (자동화 즉시 효과)**:

- `compute-saju-area-scores.ts` dailyDelta 누락 회귀
- 원인: 운세 페이지의 `toTodayScores` 는 5 영역 score 에도 `+dailyDelta` 적용, helper 는 condition 만 적용 → 미세 차이
- 새 invariant test 가 즉시 실패로 보고 → `+dailyDelta` 5 영역에도 적용 fix
- 사용자가 보고 안 한 회귀를 사전 검출 + fix → 자동화 시스템 가치 입증

**검증**: npm test 354/354 pass, audit dead anchor 0, typecheck 0 error.

### 1.15 사주 상세 hero 카드 dead anchor fix (PR #182)

**사용자 보고**: 사주 "상세" 탭 (`/saju/[slug]/premium`) hero 카드 (2026 올해 흐름) 3 버튼 (올해/달력/확장) 클릭 무반응. 하단 yearly-report-panel 의 버튼들은 정상.

**Root cause**: `yearlyAccessLabel` 분기 (Premium 이용권) 의 `readingSteps` href 가 `#yearly-chapter-1/2/3` 였는데 페이지 어디에도 해당 id 정의 없음. lifetime 분기에만 #premium-lifetime/yearly/calendar 정의됨, yearly 분기 누락.

**Fix**:
| 버튼 | Before | After |
|---|---|---|
| 올해 | `#yearly-chapter-1` | `#premium-yearly` (YearlyReportPanel — 이미 존재) |
| 달력 | `#yearly-chapter-2` | `#premium-monthly` (SmallQuestionProducts section 에 id 신규) |
| 확장 | `#yearly-chapter-3` | `/membership/checkout?plan=lifetime&...&from=saju-premium-extend` (lifetime 업셀) |

### 1.14 6 영역 카드 통일 — 모든 페이지 동일 항목 (PR #181)

**배경**: PR #179/#180 으로 점수는 통일됐지만 **항목 자체가 페이지마다 다름** — 사주 메인 4 카드 (총운/연애/재물/직장) / 사주 상세 5 카드 (직장/재물/연애/관계/건강) / 운세 페이지 5 카드 (연애/재물/직장/관계/컨디션). 사용자 요구: "총운 직장운 재물운 연애운 관계운 컨디션" 6 항목 모두 동일하게 노출.

**해결**:
- `src/lib/today-fortune/compute-saju-area-scores.ts` (신규) — 사주 페이지에서 호출. buildSajuReport 5개 + buildConditionScore (운세 builder 와 동일 산식) + unifyScoresWithIljinScore 통합. 6 영역 통일 score 반환.
- `src/components/saju/saju-area-cards-section.tsx` (신규) — 6 카드 grid 공유 컴포넌트. 사주 메인 + 사주 상세에서 import.
- `UNIFIED_AREA_LABELS` 상수: 운세 페이지 기준 긴 라벨 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운).
- `UNIFIED_AREA_COLORS` / `UNIFIED_AREA_ORDER` 상수.
- build-today-fortune.ts: `buildConditionScore` / `buildDailyDelta` export 추가 (helper 재사용).
- 사주 메인 (`/saju/[slug]/page.tsx`) — 기존 4 카드 inline → SajuAreaCardsSection.
- 사주 상세 (`/saju/[slug]/premium/page.tsx`) — 페이지 헤더 직후 SajuAreaCardsSection 추가.
- 운세 페이지 (`today-category-readings.tsx`) — overall 카드 filter 제거 (5 카드 → 6 카드). overall 라벨 '오늘의 운세 총론' → '총운'.

**보장**:
- 3 페이지 모두 동일 6 항목 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운)
- 동일 score (single source — `iljinScore.totalScore` 평균 정규화 6 영역)
- 동일 색상/순서

**검증**: npm test 353/353 pass, typecheck 0 error.

### 1.13 점수 단일화 완성 — yearly-report + credits/use (PR #180)

**배경**: PR #179 후속 회귀 사용자 보고. 사주 6 탭의 "상세" (`/saju/[slug]/premium`) 페이지에서 영역별 카드 점수가 77/76/75/76 (clampScore 48~92) 으로 노출됨. 같은 사용자/같은 날 사주 메인 (45/44/45/46) / 오늘 운세 (46/47/48/47) 와 불일치. PR #179 의 통일이 `build-yearly-report.ts` 와 `/api/credits/use/route.ts` 에는 적용 안 됐던 회귀.

**Root cause**:
- 사주 6탭 "상세" = `/saju/[slug]/premium` (`saju-screen-nav.tsx:11`)
- premium 페이지 → `YearlyReportPanel` → `build-yearly-report.ts:332-336` 가 `buildSajuReport` 5번 호출 후 통일 helper 미적용
- `/api/credits/use/route.ts:165-169` 도 동일 패턴 — 코인 결제 후 detail 풀이 텍스트 "재물운 ${score}점" 노출

**해결**:
- `build-yearly-report.ts`: `getReportMap` 직후 `computeSajuIljinScore(data)` 호출 후 5개 report (today/love/wealth/career/relationship) 의 scores 를 `unifyScoresWithIljinScore` 로 후처리. categories / overview / yearly score 모두 자동 통일.
- `/api/credits/use/route.ts`: 동일 패턴, `unifyReport` inline helper.

**최종 보장 — 모든 사주 화면 single source**:
- `/saju/[slug]` (메인) = `/saju/[slug]/today-detail` = `/saju/[slug]/share` = `/saju/[slug]/premium` ("상세") = `/today-fortune` = 코인 결제 후 detail 풀이 → **overall 1:1 일치**

**검증**: npm test 353/353 pass, typecheck 0 error.

### 1.12 OPEN PR 8개 batch 머지 (PR #168~#175)

**배경**: 2026-05-15 작업한 PR 8개가 머지 안 된 채 OPEN 상태로 누적됐고, 사용자가 production에서 "기존 작업이 반영 안 됨" (로그아웃 버튼 부재, 메뉴 탭 변경 미적용 등) 보고. 8개 모두 admin squash merge (CI npm ci 만성 실패 회피).

| PR | 핵심 변경 |
|---|---|
| #168 | `site-header.tsx` dead-code 정리 (-440줄) — PR #156 false-guarded inline 메뉴 패널 + 미사용 legacy `src/components/site-header.tsx` 제거 |
| #169 | `/my/settings` 통합 (LogoutButton + ReadingComfortControl) + 점수 boundary 회귀 잠금 test (`scores.overall === iljinScore.totalScore` strict assertion) |
| #170 | Noto Sans KR weight 6→4 슬림 — `@font-face` Sans 6×124=744 → 4×124=496 선언 (-33%), 모바일 LCP 폰트 비용 감소 |
| #171 | admin `/admin/operations` 만족도 분포 → stacked horizontal bar 차트 (jade/amber/coral 3색 분절) |
| #172 | 첫 방문자 시작가이드 → 풀스크린 carousel + 12간지 wheel hero (4 슬라이드 immersive) |
| #173 | `/my` 자매 라우트 디자인 통일 + 결과보관함 탭 노출 복구 + 메가 메뉴 우상단 `HeaderLogoutButton` (아이콘 only) |
| #174 | 모바일 시트 4탭 `flex:1 1 0` 균등 + 대화방 헤더 `whitespace-nowrap` + 궁합 결과 button `w-full` + 메가 대화 12 선생 `/dialogue/<zodiac>` 라우팅 통일 |
| #175 | admin **결제 funnel 대시보드** (B1 — migration 030 + funnel-log + `/api/admin/payment-funnel`) + 메가 메뉴 chip font-weight 800 고정 (layout shift 차단) |

**Conflict 해결**:
- PR #169 ↔ #179 (main HEAD) `build-today-fortune.ts` 통일 로직 충돌. PR #179 의 helper 추출이 PR #169 의 부분 fix를 더 완전한 방식으로 포함 → **PR #179 (origin/main) 채택**. PR #169가 도입한 `scores.overall === iljinScore.totalScore` strict test는 PR #179 helper가 자동으로 보장하므로 conflict 후에도 통과.
- 나머지 7개 PR은 conflict 없음.

**검증**:
- npm test: 353/353 pass (회귀 0)
- typecheck: 0 error
- 사용자 보고 회귀 매핑: 로그아웃 부재 → PR #169/#173, 메뉴 탭 변경 → PR #174

### 1.11 사주 페이지 ↔ 운세 페이지 점수 단일화 (PR #179)

**사용자 보고**: 같은 사주 페이지에 총운 69 / 영역별 75-77 노출되는데, 오늘 운세 페이지엔 45 노출. 24점 차이로 "어느 게 맞는 점수냐" 신뢰도 폭격.

**Root cause**:
- 사주 페이지의 `buildSajuReport()` (build-report.ts:969) 가 자체 `clampScore(48~92) + 출생일 mod` 산식으로 점수 계산 — 오늘 일진과 거의 무관, 매일 비슷한 값
- 오늘 운세의 `buildTodayFortune()` 는 `calculateIljinScore()` 8 영역 정밀 산출 (5~95 자연 범위)
- PR #165 의 single source of truth 통일 절차가 오늘 운세 빌더 안에서만 일어났음 → 사주 페이지는 통일 누락

**해결**:
| # | 변경 | 위치 |
|---|---|---|
| 1 | 통일 helper 신규 | `src/lib/today-fortune/unify-saju-scores.ts` — generic `unifyScoresWithIljinScore(rawScores, iljinTotalScore)` (clampUnified 5~95 + 평균 보존 정규화) |
| 2 | helper unit test 10개 | `src/lib/today-fortune/unify-saju-scores.spec.ts` |
| 3 | `computeSajuIljinScore(sajuData)` wrapper | `src/server/today-fortune/build-today-fortune.ts` — getTodayPillarSnapshot + deriveLuckyElements + buildSajuOriginForIljin + calculateIljinScore 4단계 묶음. 의존 함수 3개 export 추가 |
| 4 | 빌더 inline 통일 로직(45줄) → helper 호출(7줄) | `src/server/today-fortune/build-today-fortune.ts:2586-2604` |
| 5 | 사주 페이지 3곳 helper 적용 | `src/app/saju/[slug]/page.tsx:285`, `today-detail/page.tsx:177`, `share/page.tsx:53` |

**보장**:
- 사주 페이지 = 오늘 운세 페이지 overall 1:1 일치
- 영역별 = totalScore + (영역점수 - 영역평균) 정규화 → 평균이 totalScore, 상대 차이 보존
- 시 미입력 사주 → iljinScore 계산 불가 → raw scores fallback (안전)
- PR #176 회귀 패턴 (clampScore 48~92 floor가 통일 점수 끌어올리기) 차단

**검증**:
- npm test: 351/351 pass (회귀 0)
- npm run test:spec (vitest): 64/64 pass (helper 10개 포함)
- typecheck: 0 error

### 1.10 결제 중복 차단 (PR #177 / #178)

**증상**: 토스 계좌이체 마지막에서 "no healthy upstream". 토스 인프라 이슈가 아니라 활성 멤버십 사용자가 동일 plan 재결제 요청 시 client 가 차단하지 않아 발생.

#### PR #177 — 서버 페이지 5곳

| # | 위치 | 변경 |
|---|---|---|
| 1 | `/membership/checkout` | `isSubscriptionPackage` 분기 추가 — 활성 plan 일치 시 결제창 미실행, "이미 이용 중" UI + /my/billing CTA |
| 2 | `/membership` plan 카드 | jade "이용 중" 배지 + 결제 link → /my/billing |
| 3 | `/pricing` plan 카드 | "✓ 이용 중 · 결제 내역" 버튼으로 교체 |
| 4 | `/saju/[slug]/deep` lifetime CTA | 보유 시 "✓ 구매한 풀이 보기" → `/saju/[slug]/premium` |
| 5 | `/saju/[slug]/premium` premium 멤버십 button | 활성 premium 시 "✓ 멤버십 이용 중" |

#### PR #178 — Client 진입점 4곳 + 공유 인프라

**신설 공유**:
- `GET /api/payments/entitlement` — productId/slug/scope/plan 으로 `{hasEntitlement, openHref, reason}` 반환. taste/lifetime/subscription 모두 지원.
- `useProductEntitlement()` hook (`src/lib/payments/use-product-entitlement.ts`) — client mount 시 자동 fetch.

| # | 위치 | 상품 |
|---|---|---|
| 1 | `premium-lock-card.tsx` | today-detail (550원) — 이미 구매한 sourceSessionId 면 "✓ 이미 구매한 풀이" + 즉시 열람 link |
| 2 | `compatibility/result/page.tsx` manual 분기 | love-question (990원) — server-side entitlement 도 확인 (URL `paid` 만 의존하던 회귀 fix) |
| 3 | `fortune-calendar-panel.tsx` | monthly-calendar (1,900원) — 선택된 월 구매 시 "✓ 이미 구매한 N월 캘린더 열기" |
| 4 | `/api/notifications/feed` subscription-expiring | 활성 멤버 사용자에게 href 를 /membership/checkout → /my/billing 으로 동적 분기 |

**누적 결제 중복 차단 적용 현황: 9 곳 + 공유 API 1 개 + hook 1 개**.

#### PR #191 — 결제 실패 catch fallback toast (A8)

entitlement 차단이 잡지 못하는 결제창 실패 경로 (`loadTossPayments` / `requestPayment` reject) 에서 "no healthy upstream" 등 의미 없는 토스 에러 대신 가장 흔한 원인(이미 결제한 상품) 안내.

| # | 위치 | 패턴 |
|---|---|---|
| 1 | `toss-membership-checkout.tsx` catch | `toast.error` + "내 결제 내역" action → `/my/billing` |
| 2 | `credits/page.tsx` catch | 동일 |

- 메시지: `결제에 실패했습니다. 이미 결제하신 상품인지 확인해주세요.` (`docs/payment-duplicate-block-verification.md` §5 초안 준수)
- duration 6초, 실패 사유 무관 노출 (기존 `setErrorMessage` inline 에러 유지)
- 메시지 초안의 markdown link 는 sonner native `action` 버튼으로 치환 — 클릭 영역 명확 + 다른 toast 와 시각 일관성

#### PR #192 — A6 회귀 fix: 코인 결제 detail_report_access kind 누락

사용자 보고 (2026-05-17 16:30/17:00 동일 사주 1코인 중복 결제 시도) 로 발견. PR #178 이 entitlement 조회 시 `today_fortune_premium_access` kind 만 시도했으나, 1코인 결제 경로 (`/api/credits/use` POST → `unlockDetailReport`) 는 `detail_report_access` kind 로 저장 — 두 kind 불일치로 결제 후에도 entitlement 항상 false → 결제 button 계속 노출.

**저장 vs 조회 mismatch**:
| 단계 | 함수 | metadata kind | 키 |
|---|---|---|---|
| 저장 (1코인 결제) | `credits/use POST` → `unlockDetailReport()` | `detail_report_access` | `readingKey` |
| 조회 (entitlement API) | `hasTodayFortunePremiumAccess()` | `today_fortune_premium_access` | `sourceSessionId` / `readingKey` |

(실제로는 `unlockDetailReport` 내부 `hasDetailReportAccess` 가 `reused=true` 반환해 코인 차감 안 됐으나, UI 가 일반 결제 성공 UX 라 사용자가 중복 결제로 오인.)

**fix**:
- 신규 `entitlement/route-helpers.ts`: `resolveTodayDetailCoinUnlock(userId, scope, deps)` — 두 kind 모두 fallback. deps 주입 단위 테스트 가능 (`profile/route.ts` 패턴 동일).
- 신규 `entitlement/route-helpers.test.ts`: 6 시나리오 (PR #178 키 by slug / by readingKey, `detail_report_access` 단독 — 회귀 fix 핵심, neither, missing slug, redundant key skip).
- `entitlement/route.ts`: helper 사용 + `hasDetailReportAccess` import 추가.

같은 reading 의 detail 콘텐츠는 today-fortune / saju-detail 양쪽 동일 (`buildDetailReportContent` 공유) — `detail_report_access` row 가 있는 사용자는 today-detail entitlement 도 가져야 함 (의미적으로 정합).

**배포 즉시 효과**: 이미 결제한 `detail_report_access` row 가 DB 에 존재 → 배포 즉시 PremiumLockCard 가 "이미 구매" UI 로 자동 전환. DB 마이그레이션 불필요.

**남은 follow-up**: A6 Phase 2C E2E (PR #188) 가 1코인 결제 시나리오 미커버 → 회귀 자동 차단 못함. E2E 보강 필요 (Tier 0 후속 후보).

### 1.11 코인 충전 success 페이지 redesign (PR #193)

사용자 보고 (2026-05-17, production `/credits/success` 진입 시 구형 디자인) 로 발견. `BOARD_MANIFEST.md` 의 redesign 항목에 `credits/success` 는 누락 — `pay-result` (16-1 결제 결과 3상태) 가 `membership/success` 만 IMPLEMENTED 였음.

`membership/success` 와 동일 **CenteredCard 패턴** (96px pink circle hero + 22px title + 13px desc, `screens-f.jsx ScreenPaymentResult` mockup 기반) 적용:

| State | Hero | Motion |
|---|---|---|
| loading | pink circle "…" | `MotionSajuLoading` (moonGlyph "貨", labels "결제 승인 / 코인 반영 / 확인 완료") |
| error | white circle "!" + coral 오류 article | — |
| success | pink circle "✓" | `MotionCoinSuccess` ("+ N 코인") |

비즈니스 로직 (`/api/payments/confirm` POST, `trackMoonlightEvent`, `moonlight:credits-updated` event) 무수정 — UI 만 교체.

**CTA 어댑트**: success primary `오늘 운세 보러 가기` → `/today-fortune` (코인 사용 가장 흔한 다음 흐름), secondary `결제 내역 보기` → `/my/billing`.

**남은 follow-up**: `BOARD_MANIFEST.md` 에 `credits-success` 행 추가 (현재 누락 — redesign 추적 정합성).

### 1.12 /credits 잔액 binding 치명적 회귀 (PR #194)

사용자 보고 (2026-05-17, 88코인 보유자가 `/credits` 진입 → 우측 상단 SiteHeader 는 `✦ 88 코인` 정상이지만 페이지 안 ink-dark 카드는 `✦ — / 로그인 후 잔액과 충전 내역이 표시됩니다` 노출). **모든 사용자에게 동일하게 보이는 치명적 회귀**.

**Root cause**: 2026-05-13 redesign 시 mockup placeholder 가 **그대로 hardcoded** 상태로 머묾.
- `credits/page.tsx:170` `✦ —` — 잔액 변수 binding 없음
- `credits/page.tsx:180` `로그인 후 잔액과 충전 내역이 표시됩니다` — 분기 없는 hardcoded 문구
- `isLoggedIn` state 는 page.tsx 결제 분기에만 사용 — ink-dark 카드는 분기 자체 X.

**Fix**: SiteHeader / mega-nav 와 동일 패턴 (`user_credits` 직접 조회 + `moonlight:credits-updated` event listen) 적용. ink-dark 카드 3 state 분기 (미인증 / 로딩 / 잔액 확정).

**전수조사 — 동일 binding 누락 패턴은 이 카드만 (`credits/page.tsx:170, 180` 단일 지점)**:
| 위치 | 상태 |
|---|---|
| `SiteHeader.tsx:660-707` | `user_credits` fetch + cache + event ✓ |
| `mega-nav.tsx:153-` | SiteHeader 와 동일 패턴 ✓ |
| `/my/page.tsx:137` | server-side `dashboard.credits.total` ✓ |
| `detail-unlock.tsx:424, 484` | `remaining` 변수 binding ✓ |
| `membership/page.tsx:256` "— 닭띠 · 1991" | 의도된 mockup 후기 attribution (사회증명 카드), bug 아님 |

**자동화 후속**: ✅ PR #195 — `audit-mockup-placeholders` script + CI strict step 추가. 동일 패턴 (mockup placeholder → dynamic binding 누락) 회귀 즉시 차단. 사용자가 first detector 되는 패턴 방지.

### 1.13 오늘 운세 detail 새로고침마다 1코인 차감 idempotency 회귀 (PR #196)

사용자 보고 (2026-05-17): 무료 운세 → 하단 1코인 버튼 → 상세 풀이 → **새로고침마다 또 차감**.

**Root cause**: `TodayFortuneDetailClient` (today-fortune-detail-client.tsx:79) 의 useEffect 가 mount 시마다 자동 POST `/api/today-fortune/unlock` 호출. `attemptedRef` 는 같은 컴포넌트 인스턴스에서만 중복 차단인데 **새로고침 = 새 React tree = ref 리셋 → POST 다시**.

정상이면 unlock route 의 idempotency 가 reused 반환해야 하나, 기존 entitlement check 가 `today_fortune_premium_access` (sourceSessionId 키) 만 봤음. 1코인 결제로 저장되는 `detail_report_access` (readingKey 키) row 가 있어도 매치 안 됨 → `unlockCreditsOnce` RPC deduct path → 매번 차감. **PR #192 (entitlement API 의 같은 패턴 회귀) 와 본질적으로 동일** — 두 endpoint 가 같은 access 의미를 봐야 함.

**Fix** (PR #192 패턴 그대로 — deps 주입 + 단위 테스트, profile/route-helpers 컨벤션):
- 신규 `unlock/route-helpers.ts`: `resolveTodayFortuneUnlockAccess(userId, scope, deps)` — 3 path 우선순위:
  1. taste-product entitlement (550원 직접 결제 DB row)
  2. coin-session — `hasTodayFortunePremiumAccess(sourceSessionId)`
  3. **coin-reading** — `hasDetailReportAccess(readingKey)` ← **회귀 fix 핵심** (credits/use 가 저장하는 레거시 키)
- 신규 `unlock/route-helpers.test.ts`: 6 시나리오 (taste / session / reading / none / 2 short-circuit).
- `unlock/route.ts`: helper 사용, `accessSource` null 일 때만 `unlockTodayFortunePremium` 호출.

**배포 즉시 효과**: 기존 `detail_report_access` row 있는 사용자 → 다음 새로고침부터 reused, 차감 안 됨. DB 마이그레이션 불필요.

**남은 follow-up**: 자동 POST 자체를 사용자 액션 (버튼 클릭) 으로 옮기는 UX 리팩토링 — 새로고침이 read-only 임을 코드 의도로 명시 (defense in depth). server-side idempotency 는 본 PR 에서 끝났지만 UX 명료성은 별도 작업 후보.

### 1.14 saju/today-detail named CSS class → inline token redesign (PR #198)

사용자 보고 (2026-05-17): `/saju/[slug]/today-detail` (550원 결제 후 풀이화면) 가 구스타일 페이지. PR #197 `audit-redesign-coverage` 의 CRITICAL 30건이 모두 이 페이지에 집중 — 단일 페이지 fix 로 audit CRITICAL 0 달성.

**Root cause**: 페이지가 `flow-polish.css` 의 `.gangi-today-detail-*` / `.gangi-paid-detail-*` / `.gangi-detail-kicker` 같은 **named CSS class** 사용. 다른 redesign 페이지 (PR #193 credits/success, `/today-fortune/detail` 등) 는 inline + Tailwind + design token 패턴 — architecture 불일치.

**Fix**:
- named class 30개 → inline style 1:1 변환. design token (`var(--app-pink)`, `var(--app-ink)` 등) + shadow/radius/padding 정확값 유지 → 시각 동일.
- 공통 inline snippet (`CARD_SURFACE_STYLE` / `KICKER_STYLE` / `SECTION_TITLE_STYLE`) 로 중복 감소.
- 파일 상단에 `// Redesign 2026-05-17 ...` 주석 추가 → audit WARNING marker 도 해결.
- `audit-redesign-coverage.mjs` regex 강화 — 주석 안의 class reference (trailing `-`) false positive 차단.

**Audit baseline 변화**:
| | Before | After |
|---|---|---|
| CRITICAL | 30 (전부 본 페이지) | **0** ✅ |
| WARNING | 59 | 58 (본 페이지 marker 추가) |

비즈니스 로직 (resolveReading / entitlement check / buildSajuReport / scoreCards 계산) 무수정 — UI 만 교체.

**남은 follow-up**:
1. **WARNING 58 분류** — auth/compatibility/dialogue/dream/forgot-password/free/guide 등 진짜 redesign candidate vs intentional stub (skip marker). 분류 후 CI `audit:redesign-coverage:strict` step 통합 (audit-mockup-placeholders 와 같은 패턴).
2. **flow-polish.css cleanup** — `.gangi-today-detail-*` / `.gangi-paid-detail-*` / `.gangi-detail-kicker` / `.gangi-result-flow-strip` rule 들 dead code. 다른 페이지 미사용 audit 으로 확인됨 — 후속 cleanup PR 에서 삭제.

### 1.18 audit-redesign-coverage WARNING 분류 (PR #202)

PR #197 audit script 의 baseline WARNING 58 분류 (PR #199~201 idempotency series 후속 4번 작업).

**Fix**: audit script 의 `SKIP_PATTERNS` 카테고리화 — 명확히 redesign 영향 없는 entry path glob:
- auth flow: `auth` / `login` / `signup` / `forgot-password` / `reset-password` (별도 redesign track)
- legal: `privacy` / `terms` (text-only)
- utility / redirect / lock: `safe-redirect` / `lock-screen` / `about-engine`
- info / help: `help` / `guide` / `support/faq` / `support/contact`
- onboarding step: `onboarding` / `saju/new/consent` / `saju/new/empathy` / `saju/new/nickname`
- notification widget (embedded): `notifications/widget`

**Baseline 변화**: 87 page → 68 page 스캔, WARNING 58 → **41** (SKIP_PATTERNS) → **21** (PR #203 wrapper detection).

`isWrapperContent` content-based skip 추가 (PR #203) — redirect-only 또는 thin wrapper (메타데이터 + 1-2 component import) 페이지 20개 자동 제외. 사용자가 보는 큰 UI 가 page.tsx 가 아닌 client component 에 있는 패턴 (예: `today-fortune/page.tsx` → `TodayFortuneExperience`, `today-fortune/detail/page.tsx` → `TodayFortuneDetailClient`) 모두 skip.

**남은 21 candidate 카테고리** (후속 PR 들로 순차 redesign):

| 카테고리 | 페이지 (real UI, wrapper 제외) | 우선순위 |
|---|---|---|
| ~~사주~~ | ~~`saju/[slug]/deep/page.tsx`~~ ✅ PR #204 | 완료 |
| 궁합 / 별자리 | `compatibility/page.tsx` (242), `compatibility/input/page.tsx` (51), `compatibility/result/page.tsx` (187), `star-sign/[slug]/cross/page.tsx` (430), `star-sign/compat/page.tsx` (314), `star-sign/compat/[a]/[b]/page.tsx` (413) | 중간 |
| 대화 | `dialogue/[expert]/page.tsx` (112), `dialogue/history/page.tsx` (183), `dialogue/history/[sessionId]/page.tsx` (175) | 중간 |
| 명리 / 보조 | `myeongri/page.tsx` (144), `daewoon/page.tsx` (100), `interpretation/page.tsx` (131) | 낮음 |
| 꿈해몽 / 타로 | `dream-interpretation/[slug]/page.tsx` (131), `tarot/daily/pick/page.tsx` (56) | 낮음 |
| MY / 결제 | `my/billing/page.tsx` (364), `my/settings/page.tsx` (282), `pricing/page.tsx` (191) | 중간 |
| ~~메인 / 보조~~ | ~~`free`, `zodiac`, `sample-report`~~ ✅ PR #205/#206/#207 | 완료 |

### 1.22 lifetime-report (49,000원) 환불 정책 + audit (PR #218)

사용자 후속 작업 2번. audit-business-activity 가 lifetime-report 8 events / 4 users (MEDIUM) 검출 — 49,000원 = 가장 비싼 단일 상품, 회귀 시 환불 부담 크다.

**audit baseline (전체 history)**:
- 총 결제 row: 8
- 순결제 (user × scope 유니크): 8
- unique users: 4
- 매출 (gross, KRW): **392,000**
- 회귀 (같은 user + 같은 scope 2+ row): **0** ✅
- 환불 history: 0건

**신규 script** (`scripts/audit-lifetime-report.mjs`):
- product_entitlements 의 lifetime-report row 통합 + 같은 user/scope 중복 결제 검출
- credit_transactions 의 regression_refund metadata 추적
- 매출 (gross) + 환불액 + 순매출 보고
- option: `--days N` / `--strict`

**환불 발생 시 절차** (audit 결과 회귀 발견 시):
1. 본 audit 로 회귀 row 식별 (id / user_id / scope_key / 결제일)
2. Toss 결제 환불 API (paymentKey 로 전액 또는 부분 환불)
3. `product_entitlements` row → status `'refunded'` (schema 추가 필요) 또는 row 삭제 + audit row 기록
4. 사용자 알림 (이메일 / push)

**남은 follow-up**:
- 분기 1회 audit:lifetime-report 실행으로 회귀 monitoring
- `product_entitlements.status` column schema 추가 검토 (refund 기록용)
- Toss 결제 환불 자동화 함수 (현재는 manual)

### 1.21 사용자 traffic 기반 우선순위 발굴 (PR #216 — audit-business-activity)

사용자 후속 작업 3번. PV 데이터 (Vercel Analytics 등) 없음 — production 의 business action 빈도 = activity proxy.

**신규**: `scripts/audit-business-activity.mjs` — readings / credit_transactions / product_entitlements / fortune_feedback / appointments 통합 집계. event × product 별 events + unique users.

**Last 30 days baseline (2026-04-17 ~ 2026-05-17, 9 unique users 활성)**:

| 등급 | event / product | events | users |
|---|---|---|---|
| 🔴 TOP | reading_created | 221 | 9 |
| 🔴 TOP | credit_deduct / detail_report (1코인) | 46 | 4 |
| 🔴 TOP | entitlement_purchased / today-detail (550원) | 35 | 7 |
| 🟡 MEDIUM | fortune_feedback / general (오늘 운세) | 24 | 4 |
| 🟡 MEDIUM | credit_deduct / ai_chat (3코인) | 22 | 3 |
| 🟡 MEDIUM | entitlement_purchased / lifetime-report (49,000원) | 8 | 4 |
| 🟡 MEDIUM | entitlement_purchased / monthly-calendar (1,900원) | 6 | 3 |
| 🟡 MEDIUM | entitlement_purchased / year-core | 5 | 3 |
| 🟢 LOW | love-question / money-pattern / work-flow / appointment / saju_personality_mini / personality_compatibility_mini / calendar / fortune_feedback work_meeting | 1-3 | 1-3 |

**해석**:
- **사주 + today-fortune detail = 핵심 흐름** (events 합 302 = 전체 86%). 회귀 발생 시 사용자 영향 가장 큼. 이미 PR #196~#201 (idempotency 4-tier + client marker) + PR #214 audit-payment-idempotency 모니터링 도구로 보호.
- **ai_chat (22 events, MEDIUM)** — 이전 분석에서 누락. dialogue 결제 흐름 검증 후보.
- **lifetime-report (8 events, MEDIUM)** — 가장 비싼 상품 (49,000원). 결제 회귀 발생 시 환불 부담 큼 → audit 강화 검토.
- **LOW 등급 (1-3 events)** — 회귀 발생 시 사용자 영향 작음, 사전 작업 defer.

**남은 follow-up**:
1. ai_chat 결제 흐름 검증 — credit_transactions 의 ai_chat feature row (3코인 차감) 가 idempotent 한지 audit. PR #196~#201 의 today-detail 류 회귀와 같은 패턴 가능성.
2. lifetime-report entitlement 회귀 / 환불 정책 — 49,000원 결제 회귀 발생 시 audit 도구 (lifetime-specific).
3. 분기 1회 `npm run audit:business-activity` 실행으로 우선순위 재산정 (회귀 발생 패턴 변화 모니터링).

### 1.20 redesign series 전체 완료 — audit baseline CRITICAL 0 + WARNING 0 + CI strict 통합 (PR #208~#213)

사용자 "1~5 순차 진행" 명시. PR #197 audit-redesign-coverage 의 17 candidate 모두 처리 + CI strict 통합으로 자동 회귀 차단 5종 완성.

**1~5 순차 진행 결과**:
| # | 그룹 | PR | 페이지 | 작업 |
|---|---|---|---|---|
| 1 | 궁합/별자리 (6) | #208 | compatibility 3 + star-sign 3 | 모두 marker (이미 redesigned) |
| 2 | 대화 (3) | #209 | dialogue/[expert] + history × 2 | 모두 marker |
| 3 | MY/결제 (3) | #210 | my/billing + my/settings + pricing | 모두 marker |
| 4 | 명리/보조 (3) | #211 | myeongri (redesign) + interpretation (redesign) + daewoon (marker) | 2 visual + 1 marker |
| 5 | 꿈해몽/타로 (2) | #212 | dream-interpretation/[slug] (redesign) + tarot/daily/pick (marker) | 1 visual + 1 marker |

**Audit baseline 추이**:
- 1.2.3 series 시작 시점: WARNING 21
- 1번 종료: 11
- 2번 종료: 8
- 3번 종료: 5
- 4번 종료: 2
- **5번 종료: 0** ✅

**CI strict 통합 (PR #213)**: `.github/workflows/ci.yml` 의 Test/Typecheck/Build job 에 `audit:redesign-coverage:strict` step 추가. 향후 누군가 신규 페이지에 구스타일 named CSS class (`gangi-today-detail-*` 등) 또는 redesign marker 누락 → CI exit 1 → 머지 차단.

**자동 회귀 차단 도구 5종 완성** (§2.10 참조).

### 1.19 1.2.3 redesign series 완료 — 사용자 1.2.3 순차 진행 (PR #204~#207)

PR #197/#202/#203 audit-redesign-coverage 의 baseline 정리 + 점진적 redesign. 사용자 명시 우선순위 (1번 사주, 2번 오늘 운세, 3번 메인) 순차 진행 결과:

| PR | 페이지 | 작업 | 결과 |
|---|---|---|---|
| #204 | `saju/[slug]/deep` (517줄) | marker only | 이미 design token 적용, marker 누락만 |
| #205 | `free` (43줄) | marker only | design system component 기반 (GangiIntro/GangiListLink) |
| #206 | `zodiac` (113→167줄) | visual redesign | PageHero/SectionSurface → inline + design token |
| #207 | `sample-report` (239→388줄) | visual redesign | 7 section + ink-dark "다음 단계" hero |

**2번 오늘 운세**: candidate 0개 (모두 wrapper — UI 가 client component 에 있음). 작업 없음.

**Audit baseline 추이**: 21 → 20 → 19 → 18 → **17** (4 페이지 처리, sample-report 의 `TrackedLink` style prop 추가 부수 변경).

**남은 17 candidate** (다음 순차 작업 후보):
- 궁합 / 별자리 6개 (compatibility 3 + star-sign 3)
- 대화 3개 (dialogue/[expert] / history × 2)
- MY / 결제 3개 (my/billing / settings / pricing)
- 명리 / 보조 3개 (myeongri / daewoon / interpretation)
- 꿈해몽 / 타로 2개

순차 진행 시 동일 패턴 (PR #206 zodiac / PR #207 sample-report) 적용 — 같은 layout component (PageHero/SectionSurface/FeatureCard) 사용 페이지는 inline + design token 변환, design system component 만 사용하는 페이지는 marker only.



**남은 follow-up**:
1. 41 candidate 페이지 순차 redesign — 우선순위 높음 (사주/오늘운세/메인) 부터.
2. **CI strict step 통합** — 41 → 0 만든 후 `audit:redesign-coverage:strict` ci.yml step 추가. 그때 사용자가 first detector 되는 패턴 자체 차단 완료.

### 1.17 today-fortune detail 자동 POST → 사용자 액션 UX 리팩토링 (PR #201)

PR #199 / #200 의 server-side idempotency 가 backstop. 본 PR 은 **client 의도 명확화** — 새로고침이 read-only 임을 코드 흐름으로 명시 (defense in depth + server load 절감).

**신규 흐름**:
1. 무료 페이지 "1코인 열기" → `markPendingUnlock(sourceSessionId)` (sessionStorage) + navigate.
2. detail page mount → `consumePendingUnlock` 으로 marker 확인:
   - 있음 → POST (deduct trigger) + marker clear
   - 없음 (새로고침 / 직접 URL) → GET (read-only)
3. GET 응답 `hasAccess: false` → 무료 페이지 redirect (사용자 결제 안 함).

**변경**: 신규 `unlock-marker.ts`, unlock route 에 GET handler 추가, detail-client useEffect 분기, 무료 페이지 2곳 handleUnlock 에 marker 호출.

**defense in depth 3-layer 완성**:
| Layer | 보호 | PR |
|---|---|---|
| client | 새로고침 시 deduct request 자체 안 보냄 | #201 |
| server (daily) | POST 와도 daily fallback → reused | #199 |
| server (reading) | reading-scoped 정확 매치 → reused | #200 |

### 1.16 today-fortune/unlock coin-reading path 의 잘못된 kind fix (PR #200 — PR #199 evidence 기반 정확한 fix)

PR #199 의 supabase MCP evidence 가 확정: production row 모두 `kind=today_fortune_premium_access`. PR #196 의 coin-reading path 가 `hasDetailReportAccess` 사용 — `kind=detail_report_access` 만 조회해서 매번 false (kind 미스매치).

**Fix**: `hasTodayFortunePremiumAccessByReading(userId, readingKey)` 신규 — JSONB `@>` 매치 (`{kind: today_fortune_premium_access, readingKey}` 가 row metadata 에 포함, sourceSessionId 무관). coin-reading path 가 두 kind OR 조회 — today-fortune 경로 (PR #200 추가) + saju-detail 경로 (기존).

**최종 4-tier matrix**:
| Path | Source | 매치 키 | PR |
|---|---|---|---|
| 1 | taste-product | 550원 결제 row | #178 |
| 2 | coin-session | `today_fortune_premium_access` by sourceSessionId | #178 |
| 3 | coin-reading | `today_fortune_premium_access` by readingKey **OR** `detail_report_access` by readingKey | #196 + #200 |
| 4 | coin-daily | `feature='detail_report'` + `type='use'` + KST 같은 일자 (kind 무관) | #199 |

PR #199 (daily, 사용자 명시 비즈니스 룰) + PR #200 (reading-scoped, 정확성) 보완 — daily 가 못 잡는 edge case (어제 결제 사주 → 오늘 첫 진입) 도 path 3 catch. defense in depth.

### 1.15 today-fortune/unlock "같은 날 두 번 결제 차단" daily idempotency (PR #199 — supabase MCP evidence 기반 root cause 확정)

사용자 보고 (2026-05-17): `/today-fortune/detail` 에서 1코인 결제 후 다시 보려고 하면 또 차감. PR #196 의 3-path fallback (taste-product / coin-session / coin-reading) 후에도 production 에서 재현. "로그인한 사람들의 코인 결제내역을 확인해서 해당하는 년월일시 확인해서 같은 날에 두번 결제가 이뤄지지 않게 시스템화해야해" 명시 요구.

**supabase MCP evidence (production credit_transactions 24-48h)**:
| user_id | row_count | kinds | reading_keys (distinct) | source_session_ids (distinct) |
|---|---|---|---|---|
| 8d7efd3c… | **6** | `[today_fortune_premium_access]` | **1** (단일) | **6** (매번 새 UUID) |
| 331ab9f9… | 5 | `[today_fortune_premium_access]` | 1 | 5 |
| adad3be3… | 2 | `[today_fortune_premium_access]` | 2 | 2 |

**Root cause 확정**: production row 가 **전부 `today_fortune_premium_access` kind** (today-fortune/unlock 경로) + 단일 readingKey + **매번 새 sourceSessionId** (today-fortune 무료 결과 생성마다 UUID).

PR #196 fallback 이 작동 못한 이유:
- `hasTodayFortunePremiumAccess(sourceSessionId)`: sourceSessionId 매번 새로 생성 → 매번 false.
- `hasDetailReportAccess(readingKey)`: **`detail_report_access` kind 만 조회**. production row 는 `today_fortune_premium_access` kind → **kind 미스매치, 매번 false**.
- 두 fallback 모두 false → unlockTodayFortunePremium RPC → 새 sourceSessionId 라 idempotency 미매치 → deduct + 새 row → 매번 차감.

**Fix — 4-path matrix (broadest fallback 추가)**:
| Path | Source | 매치 키 | 추가 PR |
|---|---|---|---|
| 1 | taste-product | 550원 직접 결제 DB row | #178 |
| 2 | coin-session | `today_fortune_premium_access` (sourceSessionId) | #178 |
| 3 | coin-reading | `detail_report_access` (readingKey) | #192 / #196 |
| 4 | **coin-daily** | `feature='detail_report'` + `type='use'` + KST 같은 일자 (metadata kind 무관) | **#199** |

`hasTodayFortuneDailyAccess` 신규 (detail-report-access.ts) — Korea timezone day [00:00 KST, +24h), metadata kind 무관. 사용자 명시 비즈니스 룰 "같은 user 가 같은 날 today-detail 결제했다면 어떤 reading / sourceSessionId 로 진입해도 reused".

**배포 즉시 효과**: evidence 의 user 8d7efd3c / 331ab9f9 / adad3be3 등 이미 오늘 차감 row 보유자 → 다음 진입부터 `coin-daily` 매치, 차감 안 됨. DB 마이그레이션 / 데이터 정정 불필요.

**남은 follow-up**:
1. ✅ **유저 환불 완료** — supabase MCP execute_sql 로 직접 환불 (2026-05-17 KST). 8d7efd3c +6 코인 (5/14·5/16·5/17 각 2 잉여), 331ab9f9 +3 코인 (5/17 3 잉여). adad3be3 는 다른 readingKey 라 의도된 행동 가능성 — 환불 제외. audit row 3개 (`type=purchase`, `metadata.kind=regression_refund`) credit_transactions 에 기록.
2. ✅ **정확한 fix 완료** — PR #200 `hasTodayFortunePremiumAccessByReading` 신규, coin-reading path 가 두 kind OR 조회.
3. ✅ **자동 POST → 사용자 액션 UX 리팩토링 완료** — PR #201. sessionStorage marker (`unlock-marker.ts`) + detail-client GET/POST 분기 + 신규 GET handler. 새로고침 시 server POST 호출 자체 없음. defense in depth 3-layer 완성 (client 의도 명시 + server daily idempotency + reading-scoped).

---

## 2. 핵심 기술 결정

### 2.1 12간지 로딩 모션
- After Effects HTML 그대로 사용 X (512KB). CSS/SVG 재구현 (~6KB)
- 모든 `GangiLoadingOverlay` 호출자 자동 12간지 — 디자인 단일화
- `MIN_LOADING_MS=600ms` 가드 + `router.prefetch + push + didNavigate`

### 2.2 점수 single source of truth (`iljinScore.totalScore`)
- `result.scores` (SajuReport 기반) vs `result.iljinScore` (운세톡톡 벤치마크) **공존이 원인**
- 빌더에서 `scores.overall = iljinScore.totalScore` 덮어쓰기
- 영역별: `totalScore + (영역점수 - 영역평균)` 정규화 → 평균이 totalScore, 상대 차이 보존
- `TODAY_RESULT_STORAGE_PREFIX = ...:v3:` (v1 → v2 → v3 마이그레이션으로 옛 캐시 무효화)
- **PR #179 — 통일 범위 확장**: 오늘 운세 빌더 안에만 있던 통일 로직을 `src/lib/today-fortune/unify-saju-scores.ts` helper 로 추출. 사주 페이지 3곳 (`/saju/[slug]`, `/saju/[slug]/today-detail`, `/saju/[slug]/share`) 도 동일 helper 호출해서 두 페이지 점수 일치 보장.
- **PR #180 — yearly-report + credits/use 추가 통일**: `build-yearly-report.ts` 의 5개 buildSajuReport 결과 + `/api/credits/use/route.ts` 의 5개 report scores 모두 통일.
- **PR #181 — 6 영역 카드 통일**: `compute-saju-area-scores.ts` 신규 helper + `SajuAreaCardsSection` 공유 컴포넌트. 3 페이지 (사주 메인/상세/운세) 동일 6 카드 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운).
- **PR #183 — invariant test 잠금**: 사주 페이지 6 영역 score === 오늘 운세 페이지 score 1:1 일치 strict assertion. 회귀 발생 시 즉시 npm test 실패.

### 2.10 자동 회귀 검증 시스템 (PR #183/#184) — "사용자 매번 보고하지 않게"

사용자 메타 피드백 대응. production 화면에서 사용자가 first detector 역할을 줄이는 자동화.

**5 종 도구 매트릭스** (2026-05-17 자동 회귀 차단 완성):
| 도구 | 차단 가능 회귀 | 실행 | 도입 PR |
|---|---|---|---|
| `audit-dead-anchors` | `href="#xxx"` 가 페이지에 정의 안 된 anchor (PR #182 류) | `npm run audit:dead-anchors` (+ `--strict` for CI) | #183 |
| score invariant test | 사주 페이지 ↔ 운세 페이지 영역별 score 불일치 (PR #179-#181 류) | `npm test` 자동 (build-today-fortune.test.ts) | #183 |
| Playwright smoke E2E | 페이지 진입 깨짐 / console error / dead internal link | `npm run e2e` (chromium, ~6s) | #184 |
| `audit-mockup-placeholders` | redesign 컴포넌트 mockup placeholder binding 누락 (PR #194 류 — `✦ —` / "로그인 후 ..." hardcoded) | `npm run audit:mockup-placeholders` (+ `--strict` for CI) | #195 |
| `audit-redesign-coverage` | 구스타일 named CSS class 사용 (`gangi-today-detail-*` 등) + redesign 마커 누락 페이지 (PR #193 류 / saju/today-detail 류) | `npm run audit:redesign-coverage:strict` (CI 통합 완료) | #197 / #202 / #203 / #213 |

**자동화 즉시 효과 (PR #183 도입 시점)**:
- 새 audit script 실행 → 사용자가 본 dead anchor 외에 추가 false positive 1건 즉시 분류 (regex 개선)
- 새 invariant test 실행 → PR #181의 `compute-saju-area-scores.ts` dailyDelta 누락 회귀 검출 → 사용자가 보고 안 한 score 미세 차이 사전 fix

### 2.3 사주 + 일진 hybrid (행운 패키지)
- 사주 lucky element = 평생 동일 (명리 이론 정합)
- 오늘 일진 천간 element 보조 source 도입:
  - 일진 = 기신 → 무시 (lucky 만)
  - 일진 = lucky → 강조 (변동 없음)
  - 일진 = 다른 element → **두 element 항목 합집합** (9 항목 매일 일부 변동)

### 2.4 메가 메뉴 vs SiteHeader
- lg ≥ 1024px: 메가 메뉴 단독 노출, SiteHeader CSS `!important` 로 강제 숨김
- 모바일 시트는 **top sheet** (햄버거가 우상단이라 자연스러움) + `createPortal(document.body)` (부모 transform 영향 0)

### 2.5 admin 화이트리스트
- `ADMIN_USER_IDS` env (부트스트랩) + `admin_users` 테이블 (운영)
- `getCurrentAdminCheck()` 가 in-memory 5분 TTL 캐시
- `/admin/*` layout 가드 + API guard 양쪽

### 2.6 상황 데이터 흐름
- 입력: `/saju/new` (live preview), `/my/situation` (default 저장)
- 저장: `reading_situation` (per-reading) + `profiles.user_situation` (user default fallback)
- 활용: `personalizationContext.userSituation` → narrative honorific + chip 카드 + 오늘 점수 재정렬 + perspective

### 2.7 ML 학습 → production 자동 루프
```
admin /admin/weight-tuning 학습 → draft 저장
  ↓ R² ≥ 0.05 검증 (PR #153)
admin 활성화 → status='active'
  ↓ 5분 stale-while-revalidate (PR #140)
production today-fortune 의 scoreHint 자동 override
```

### 2.8 결제 entitlement 통합 API (PR #178, 보존 필수)

**API 계약**:
```
GET /api/payments/entitlement
  ?productId=<taste|lifetime|subscription productId>
  &slug=<reading slug, optional>
  &scope=<scope key, optional>     // 예: 'general', '2026-05'
  &plan=<basic|premium|plus>         // productId='subscription' 일 때만

응답:
{
  hasEntitlement: boolean,
  openHref: string | null,   // 보유 시 열람 페이지 URL
  reason: 'product-purchased' | 'coin-unlocked' | 'active-subscription'
        | 'lifetime-purchased' | 'unauthenticated' | null
}

productId 지원:
- 'today-detail'      → coin unlock + product entitlement 모두 검사
- 'love-question' / 'money-pattern' / 'work-flow' (글로벌)
- 'monthly-calendar' (scope=YYYY-MM)
- 'year-core' (scope=YYYY)
- 'lifetime-report' (slug 필수)
- 'subscription' (plan 필수, plus→basic 정규화)
```

**Client hook** `useProductEntitlement(input)`:
- mount 시 fetch, `cancelled` flag 로 unmount race 방지
- 네트워크 실패 시 `hasEntitlement=false` (결제 button 막지 않음 — fail-open 안전)
- `enabled=false` 면 fetch skip (slug 미준비 등)

**확장 가이드**:
- 새 상품 추가 시 → `route.ts` 의 productId 분기 + `buildPurchasedProductHref` 에 매핑 추가
- 새 client 진입점 → `useProductEntitlement({productId, slug?, scope?})` 만 호출, 결과 분기

### 2.9 결제 DB 스키마 (보존 필수)

#### 2.9.1 `product_entitlements` (canonical)
```sql
-- src/lib/product-entitlements.ts ProductEntitlementRow 참조
id           uuid PK
user_id      uuid (FK auth.users)
product_id   text  -- 'today-detail' | 'love-question' | 'money-pattern' |
                   --  'work-flow' | 'monthly-calendar' | 'year-core' |
                   --  'lifetime-report'
scope_key    text  -- 'global' (single-purchase) 또는 build*ScopeKey() 결과
order_id     text  nullable
payment_key  text  nullable (토스 paymentKey)
package_id   text  nullable
amount       int   nullable
metadata     jsonb -- {kind, productId, scopeKey, orderId, paymentKey, amount, packageId}
created_at   timestamptz

UNIQUE INDEX (user_id, product_id, scope_key)
```

**scope_key 빌더** (`src/lib/payments/product-scope.ts`):
- `buildTodayDetailScopeKey(sourceSessionId)` — `today-detail` 용 (사주 + 오늘 단위)
- `buildReadingProductScopeKey(readingKey)` — 사주별 단위
- `buildMonthlyCalendarScopeKey(readingKey, year, month)` — 사주 + 월 단위
- `buildYearCoreScopeKey(readingKey, year)` — 사주 + 년 단위
- `buildLifetimeReportScopeKey(readingKey)` — 사주별
- 글로벌 상품 (love-question 등): scope_key = `'global'` (insert) / `null` (select)

#### 2.9.2 `subscriptions` (멤버십)
```sql
-- src/lib/subscription.ts SubscriptionRow 참조
user_id            uuid PK / FK
status             text  -- 'active' | 'cancelled' | 'expired'
plan               text  -- 'plus_monthly' | 'premium_monthly'
renews_at          timestamptz nullable
toss_billing_key   text  nullable
toss_customer_key  text  nullable
created_at         timestamptz
updated_at         timestamptz
```

- `getManagedSubscription(userId)` 가 `renews_at <= now()` 인데 status≠'expired' 면 자동 'expired' 갱신.
- plan slug → subscriptionPlan 매핑: `basic → plus_monthly`, `premium → premium_monthly`, `lifetime → 별도 (product_entitlements 의 lifetime-report)`

#### 2.9.3 `credit_transactions` (legacy + audit)
```sql
-- src/lib/product-entitlements.ts EntitlementTransactionRow 참조
id          uuid PK
user_id     uuid
type        text  -- 'purchase' | 'consume' | ...
feature     text  -- 'taste_product' | 'lifetime_report' | ...
amount      int   -- 코인 변동량 (purchase 의 경우 0 가능 — entitlement audit 용)
metadata    jsonb -- entitlement audit 정보 (kind/productId/readingKey/scopeKey/orderId/paymentKey)
created_at  timestamptz
```

**역할**:
- 코인 거래 원장 (PRIMARY)
- product_entitlements 가 도입되기 전 entitlement 저장소 (LEGACY)
- 새 entitlement 도입 시 product_entitlements 에 PRIMARY 저장 + credit_transactions 에 audit 미러링 (`recordLegacyTasteProductTransaction`)

#### 2.9.4 entitlement 조회 우선순위
```
1. product_entitlements 에서 (user_id, product_id, scope_key) 조회
2. 없으면 credit_transactions 의 legacy 행 조회 (`feature='taste_product'` + metadata.scopeKey 일치)
3. today-detail 한정: hasTodayFortunePremiumAccess(coin unlock) 도 검사
```

---

## 3. 알려진 이슈 / 미해결

### 3.1 ~~Pre-existing test failure~~ ✅ FIXED (PR #176)
- ~~`not ok - day master summary is separated from topic highlight cards`~~
- PR #176 에서 정규식 `/타고난 기질/` → `/핵심 기질/` 로 보정. 코드는 47e533a 이후 "내 핵심 기질" 사용 중이었음.

### 3.1b ~~사주 페이지 ↔ 오늘 운세 페이지 점수 불일치~~ ✅ FIXED (PR #179)
- ~~같은 사용자 같은 날 사주 페이지 69 vs 오늘 운세 페이지 45 → 24점 차이~~
- PR #179 에서 `unifyScoresWithIljinScore` helper 추출 + 사주 페이지 3곳 적용. iljinScore.totalScore single source of truth 확장.

### 3.1d 로컬 `.env.development.local` override gotcha (vercel CLI 자동 생성 파일)

- `vercel env pull` 이 만든 `.env.development.local` 이 `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` 등을 빈 문자열 `""` 로 두는데, Next.js env precedence 가 **`process.env` > `.env.development.local` > `.env.local`** 이라 .env.local 의 실 값이 가려진다.
- 증상: `/api/payments/entitlement` 500 `supabaseKey is required` / `/membership` 활성 구독자 "이용 중" 배지 미노출.
- Workaround (로컬 dev):
  ```bash
  set -a
  source <(grep -E "^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|E2E_TEST_USER_EMAIL|E2E_TEST_USER_PASSWORD|E2E_TEST_READING_SLUG)=" .env.local)
  set +a
  npm run dev
  ```
- CI 영향 0: `.env.development.local` 미존재 (gitignored), `process.env` 에 GitHub Secrets 매핑된 값 적용.
- 본질 해결: Vercel development 환경에 실 service role 키 등록 후 `vercel env pull --environment=development` 재실행. 또는 본 파일 삭제 + 필요 시 수동 작성.

### 3.1c ~~CI npm ci 만성 실패~~ ✅ FIXED (PR #185)
- ~~`Missing: typescript@4.9.5 from lock file` — `@tosspayments/payment-widget-sdk` 의 peer dep 충돌~~
- PR #185 에서 `.github/workflows/ci.yml` + `.github/workflows/playwright.yml` 의 `npm ci` 에 `--legacy-peer-deps` 추가. typescript 4.x ↔ 5.x peer-dep 충돌 우회.
- PR #186/#187 모두 admin override 없이 정상 squash merge 통과로 fix 확인.

### 3.2 운영 적용 필요 마이그레이션
- migration 025 (sinsal_weight_versions)
- migration 026 (notification_log_variant + clicked_at)
- migration 027 (star_sign_favorites)
- migration 028 (admin_users) — **`ADMIN_USER_IDS` env 필수**
- migration 029 (profile_user_situation)

### 3.3 VAPID 키 발급 필요
- `npm run generate:web-push-keys` 후 Vercel env 3종 설정
- `docs/web-push-setup.md` 6 단계 점검표 참조

### 3.4 사이드바 부가 기능 이동 미완
- PR #155/#159 가 PC SiteHeader 의 사이드바를 가렸지만, 기존 사이드바의 LayoutMode/ReadingComfort 토글 / 로그아웃 버튼 등이 PC 에서 접근 불가
- → 다음 정리 PR 에서 우상단 avatar drawer 또는 `/my/settings` 로 이동 필요

### 3.5 site-header.tsx dead-code
- PR #156 에서 inline 드롭다운을 `false && mobileMenuOpen` 으로 비활성. 약 160줄 dead-code 잔존.
- 다음 정리 PR 에서 완전 삭제 예정.

---

## 4. 다음에 이어서 할 일 (우선순위)

### Tier 총평·점수 (2026-05-21 세션 follow-up) — 최우선
| # | 작업 | 예상 | 상태 |
|---|---|---|---|
| **TR1** | **daewoon-llm-spec 어휘 정책 반영** — 챕터 `COMMON_SYSTEM_PROMPT`(§9 오행/§10 십성/결 강화) + `chapter-validator`(§12 정규식) + `MYEONGRI_GLOSSARY` "X의 결" ~10종 재작성. 라이브 9챕터 + 전역 글로서리라 글로서리·검증기·프롬프트·테스트 **한 묶음**으로 (총평 PR #301/#302 패턴 재사용) | 1일 | ⬜ **B 확정**(다음 주기), 태스크 칩 생성 |
| **SC2** | **점수 Phase 2** — Tailwind 토큰 등록(`tailwind.config`) + 면책 문구 시스템 + 라벨별 UI 분기 준비 | 0.5일 | ⬜ |
| **SC3** | **점수 Phase 3** — `SajuScoreCard`(원형 점수) + `ScoreBreakdownCard`(5요소 산출) + 카운트업 애니메이션 | 1.5일 | ⬜ |
| **SC4** | **점수 Phase 4** — `OhaengChart` 막대 차트 + 부족/과다 가이드 카드 | 1일 | ⬜ |
| **SC5** | **점수 Phase 5~6** — LLM `guidanceText` 연계(총평 파이프라인 활용) + 무료/유료 경계 재설계 | 1일 | ⬜ |
| **TR2** | 총평 스테이징 QA — 상황 보유 reading 단락2 직업·단락4 고민 반영 육안 / 5케이스 BEFORE-AFTER / 비전문가 가독성 | 0.5일 | ⬜ |

### Tier 0 — 자동 회귀 검증 시스템 완성 (Phase 2B, 2026-05-16 세션 follow-up) ✅ 완료
| # | 작업 | 예상 | 상태 |
|---|---|---|---|
| **0-1** | **Phase 2B: 사주 페이지 인증 E2E** — Hybrid auth fixture (storage state + real login) + 4 회귀 시나리오 (6 카드 / hero anchor / 결제 차단 / 점수 일치) | 1-1.5일 | ✅ PR #186 + #187 fix |
| 0-2 | Playwright CI workflow — `.github/workflows/playwright.yml` + Phase 2A 5 test 자동 실행 + Phase 2B Secrets 활성 시 자동 추가 | 0.5일 | ✅ PR #185 |
| 0-3 | `audit:dead-anchors:strict` 를 ci.yml step 으로 통합 — 새 dead anchor PR 머지 차단 | 0.2일 | ✅ PR #185 |

### Tier A — 직전 작업 자연스러운 연장
| # | 작업 | 예상 | 상태 |
|---|---|---|---|
| A1 | 사이드바 부가 기능 (LayoutMode / ReadingComfort / 로그아웃) 새 위치 — 우상단 avatar drawer 또는 `/my/settings` 통합 | 0.5일 | ✅ PR #169/#173 완료 |
| A2 | `site-header.tsx` dead-code (`false && mobileMenuOpen` 약 160줄) 완전 삭제 | 0.3일 | ✅ PR #168 완료 |
| A3 | 점수·이름 통일 운영 검증 (`v3` prefix 후 새 응답 흐름 확인) | 0.5일 | ✅ PR #179-#181 + #183 invariant test 로 자동화 |
| A4 | 행운 패키지 hybrid 운영 검증 + 일진 흉신 케이스 실측 | 0.3일 | ✅ PR #190 (5×4×6=120 케이스 matrix audit + invariant test) |
| **A5** | **CI npm ci 만성 실패 fix** — `--legacy-peer-deps` 추가, admin override 의존 종료 | 0.3일 | ✅ PR #185 완료 |
| A6 | **결제 중복 차단 활성 계정 검증** — 멤버십/lifetime 각각 entitlement seed/cleanup E2E 매 PR 자동 검증 | 0.5일 | ✅ PR #188 (Phase 2C 4 시나리오) + PR #192 회귀 fix (1코인 결제 `detail_report_access` kind 추가 조회). E2E 가 1코인 시나리오 미커버 → 보강 필요 |
| A7 | 사주 결과 페이지 CTA 를 `useProductEntitlement` 로 일관화 (서버 props 대신) — 다른 탭 결제 후 실시간 반영 | 0.5일 | ✅ PR #189 (4 saju 페이지 hybrid 패턴: client wrapper + EntitlementRefresher) |
| A8 | "no healthy upstream" 사용자에게 안내 — 결제창 실패 시 client toast 로 "이미 결제한 상품인지 확인해주세요" 가이드 | 0.3일 | ✅ PR #191 (결제 catch 2곳 sonner toast + "/my/billing" action 버튼, duration 6초) |

### Tier B — 수익 · 리텐션
| # | 작업 | 예상 |
|---|---|---|
| B1 | 결제 funnel 통계 (`/credits → prepare → confirm`) admin 대시보드 | 1일 |
| B2 | 결제 후 만족도 follow-up push (24h 후 feedback 유도) | 0.5일 |
| B3 | LTV / cohort 분석 | 1일 |

### Tier C — ML / 분석 후속
| # | 작업 | 예상 |
|---|---|---|
| C1 | 영역별 가중치 학습 — overall 외 5 영역 각각 | 1.5일 |
| C2 | 별자리 push D/E variant 추가 (신화 · 궁합 본문) | 0.5일 |

### Tier D — 콘텐츠 확장
| # | 작업 | 예상 |
|---|---|---|
| D1 | 띠 × 별자리 크로스 (12 × 12 = 144 조합 통합 풀이) | 1.5일 |
| D2 | 사주 공유 이미지 (OG image generation) | 1일 |
| D3 | 시간대별 운세 (오전/오후/저녁 구분) | 1일 |
| D4 | 꿈해몽 36 → 100 단어 + 카테고리 필터 | 1일 |

### Tier E — 성능 / 운영 안정성
| # | 작업 | 예상 |
|---|---|---|
| E1 | 모바일 LCP — Noto Sans KR 6 weight → 2-3 weight | 0.5일 |
| E2 | Rate limit (`/api/payments`, `/api/notifications/test`) | 1일 |
| E3 | Sentry 통합 + source map upload | 0.5일 |
| E4 | `/admin/operations` 차트화 (grid → SVG bar/line) | 0.5일 |

### Tier F — 신규 기능
| # | 작업 | 예상 |
|---|---|---|
| F1 | 가족 그룹 운세 (5인 한 화면) | 2일 |
| F2 | 신년 운세 특별 페이지 `/new-year` | 1일 |
| F3 | 친구 추천 referral | 1-1.5일 |
| F4 | 사주 PDF 다운로드 | 1일 |

---

## 5. 운영 적용 체크리스트

### 5.1 환경 변수 (Vercel)
- [ ] `ADMIN_USER_IDS=<owner-uuid>` (PR #141)
- [ ] `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` (PR #135–#142)
- [ ] `WEB_PUSH_PRIVATE_KEY`
- [ ] `WEB_PUSH_SUBJECT=mailto:owner@your-domain.com`
- [ ] `CRON_SECRET` / `NOTIFICATION_CRON_SECRET`

### 5.2 Supabase Migrations (순서대로)
- [ ] 025_sinsal_weight_versions
- [ ] 026_notification_log_variant
- [ ] 027_star_sign_favorites
- [ ] 028_admin_users
- [ ] 029_profile_user_situation

### 5.3 Vercel Cron 확인
- KST 08:00 / UTC 23:00 — today-fortune
- KST 09:00 / UTC 00:00 — today-star-sign
- KST 10:00 / UTC 01:00 — subscription-expiring
- KST 12:00 / UTC 03:00 — today-tarot
- KST 19:00 / UTC 10:00 — comeback-reminder
- KST 20:00 / UTC 11:00 — today-zodiac

### 5.4 운영 검증 절차
1. `/today-fortune` 무료 결과 → 4 위치 점수 일치 + 이름 본인 nickname 노출
2. 행운 패키지 9 항목 매일 일부 변동 (사주 lucky ≠ 일진 element 인 날)
3. `/admin/web-push-status` → `fullyConfigured: true`
4. 테스트 사용자 push 구독 → dry-run → 실발송 → 클릭 ack → CTR 확인
5. `/admin/push-ctr` → variant 별 CTR 노출
6. `/admin/operations` 진입 (admin only) → 운영 지표 노출

---

## 6. 핵심 파일 / 경로 빠른 참조

### 데이터 / 빌더
- `src/server/today-fortune/build-today-fortune.ts` — 오늘운세 빌더 + 점수 통일
- `src/lib/today-fortune/lucky-package.ts` — 행운 패키지 hybrid
- `src/lib/today-fortune/iljin-score-engine.ts` — 8영역 점수
- `src/lib/star-sign/daily-fortune.ts` — 별자리 일별 PRNG
- `src/domain/saju/report/build-narrative.ts` — 사주 narrative + honorific

### 컴포넌트
- `src/components/saju/situation-reflection-card.tsx` — 상황 chip (default/compact)
- `src/components/star-sign/my-star-sign-card.tsx` — MY 별자리
- `src/components/saju/zodiac-wheel-loading.tsx` — 12간지 로딩 모션
- `src/components/today-fortune/today-lucky-package-card.tsx` — 행운 패키지 UI
- `src/components/today-fortune/today-iljin-breakdown-card.tsx` — 점수 산출 내역
- `src/components/today-fortune/today-premium-question-chips.tsx` — Q1/Q2/Q3 prefill 대화방 link (PR #176)
- `src/components/today-fortune/premium-lock-card.tsx` — today-detail 결제 lock + entitlement 분기 (PR #178)

### 결제 entitlement (PR #177/#178)
- `src/lib/payments/catalog.ts` — PAYMENT_PACKAGES, isSubscriptionPackage, isTasteProductPackage
- `src/lib/payments/product-scope.ts` — scope key 빌더 + resolvePaymentProductScope + buildPurchasedProductHref
- `src/lib/product-entitlements.ts` — getTasteProductEntitlement, grantProductEntitlement
- `src/lib/report-entitlements.ts` — lifetime report entitlement
- `src/lib/subscription.ts` — getManagedSubscription
- `src/lib/payments/use-product-entitlement.ts` — client hook
- `src/app/api/payments/entitlement/route.ts` — 통합 GET 엔드포인트

### Navigation
- `src/features/shared-navigation/mega-nav.tsx` — PC 메가
- `src/features/shared-navigation/mobile-nav-sheet.tsx` — 모바일 top sheet
- `src/features/shared-navigation/mega-nav-data.ts` — 4 group 데이터

### Admin
- `src/lib/admin-auth.ts` — `getCurrentAdminCheck`
- `src/app/admin/layout.tsx` — server-side redirect
- `src/app/admin/weight-tuning/` — ML 학습 + R² 가드
- `src/app/admin/push-ctr/` — variant CTR UI

### Content / Config
- `src/content/moonlight.ts` — DALBIT_TEACHERS (12간지 선생), MY_MENU_BLUEPRINT, NotificationSlotKey
- `src/features/shared-navigation/mega-nav-data.ts` — 메가 메뉴 4 group
- `src/lib/saju/types.ts` — BirthInput, UserSituation

---

## 7. 테스트 상태 & 자동 검증 명령
- `npm test` — **354 ok / 0 failure** (PR #183 invariant 1건 +1)
- `npm run test:spec` — vitest 64/64 pass (unit/spec)
- `npm run typecheck` — 0 error
- `npm run audit:dead-anchors` — 작동 안 하는 # 링크 자동 검출 (PR #183)
- `npm run audit:dead-anchors:strict` — dead anchor 1건이라도 있으면 exit 1 (CI 통합 가능)
- `npm run audit:user-entitlements <user-id-or-email>` — 사용자 결제 상태 + 9 진입점 차단 매트릭스
- `npm run e2e` — Playwright smoke E2E (chromium, ~6s, 5 test) — 페이지 진입 깨짐/console error/dead internal link 자동 차단 (PR #184/#185)
- `npm run e2e -- --project chromium-auth` — Phase 2B 사주 페이지 인증 E2E (auth-setup + 4 시나리오 ~10s) — 6 카드 / hero anchor / 결제 차단 / 점수 일치 자동 검증 (PR #186/#187). credentials (`E2E_TEST_USER_*` env) 미설정 시 자동 skip
- `npm run e2e -- --project chromium-payment-blocks` — Phase 2C 결제 차단 활성 entitlement E2E (PR #188). subscription / lifetime entitlement seed/cleanup + 4 시나리오 (멤버십/pricing/checkout/deep). `SUPABASE_SERVICE_ROLE_KEY` 필요, 미설정 시 자동 skip
- `npm run audit:lucky-hybrid` — 행운 패키지 hybrid 룰 매트릭스 audit (PR #190). 전수 120 케이스 + 단일 모드 `--lucky 화 --unlucky 금`
- `npm run audit:lucky-hybrid:strict` — invariant 위배 1건이라도 있으면 exit 1 (CI 통합 가능)
- `npm run e2e:ui` — Playwright UI mode (디버깅)
- ✅ CI 환경 `npm ci` peer-dep 충돌 해소 — PR #185 의 `--legacy-peer-deps` flag 적용 후 admin override 없이 정상 squash merge 통과 (PR #186/#187 확인)

---

## 8. 최근 배포 이력

| 날짜 | Release | PR | 핵심 |
|---|---|---|---|
| 2026-05-23 | **사주 풀이 텍스트 품질 전면 정비** | #336/#337/#338/#339/#340 | 상세 풀이 문장 반복·역할/기운 중복 제거(#336) · 키워드 자연화/격국명 과치환/잔존 결/lifetimeRule 중복(#337) · `simplifySajuCopy` 받침 조사 자동정정 normalizer + 전 화면 감사 조사457→0·중복어171→0(#338) · 오행 추상어 cue→표준 "X 기운"(#339) · 균형 문장 자연화 + 궁합 한자 노출/택일 표기 정정(#340). 캐시 마이그레이션 불필요(리포트 매 로드 재빌드) |
| 2026-05-23 | **PDF 저장 화면 (보관형 리포트)** | #334/#335 | 8페이지 A4 리포트 디자인 적용(브라우저 인쇄 · 결정론 데이터+매핑) + 모바일 반응형 화면 + `print-color-adjust` 인쇄 배경 표시 정정 |
| 2026-05-22 | **Codex 상용화 P0 차단 이슈 제거 + clean main 배포** | commit `4ee2484` | 로그인/코인/오늘운세 SSR 문구 정리, 301 canonical redirect, 멤버십 무제한 문구 제거, 예약상담 가격/환불 고지, 결제 동의 단일화, 9개 정책 bundled fallback, 공개 금지 문구 회귀 테스트. 백업 커밋 제외 후 clean branch cherry-pick → Vercel prod `dpl_5qeqzzh9jbzTti3FBzAuJTdS8Dk9` |
| 2026-05-19 | **2026-05-19 9 챕터 LLM 통합 인프라 (chapter prompts + client + enhance + V1\|V2 호환)** | #250/#251/#252/#253/#256 | report-llm-spec.md §2-4 의 9 챕터 system prompt + ChapterMeta/OUTPUT_SPECS + ChapterLLMClient interface (DI) + OpenAIChapterClient (openai-text wrap) + generateChapter (validator 후처리 + 재생성 max 2) + enhanceLifetimeChapter1WithLLM (LifetimeCoreIdentitySection.summary 만 교체) + buildChapter1Input (SajuDataV1\|SajuDataV2 union, narrowOccupation/narrowConcern) |
| 2026-05-19 | **2026-05-19 P0 풀이 엔진 재설계 (chapter-validator + cycle 본문 십성 + 한자/단정 제거)** | #245/#246/#248/#249 | cycleSipsin infra (getCycleSipsin + 5 빌더 시그니처) → 본문 4 빌더 (relationship/wealthCareer/mental/practicalActions) 십성 10 base × status/occupation 4 분기 곱 (9 cycle distinct 10/10/10) → P0 본문 버그 4건 fix (B01 '내 내' regex chain / B05 '커안쪽' word-boundary / B03 timing / B04 종결문 비문) + chapter-validator 6 룰 (한자/X과/영어/단정/cross-chapter/punch-copy) + 빌더 본문 한자 ganzi→한글 + '절대/반드시' 제거 |
| 2026-05-19 | **2026-05-19 ELEMENT_INFO 자연 비유 + formatElementName + B06 헤드라인** | #247/#254/#255 | "X과/와 Y" 5 라벨 → 새싹/햇살/흙/쇠/물 의 결 (ㄹ 받침 통일로 호출처 "이/을" 자연) + ELEMENT_INFO.keyword 도입 + formatElementName .split 제거 + buildHeadline "흙·정인격" → "흙에 정인격" 자연 연결 |
| 2026-05-19 | **2026-05-19 love-question 사주 cross-sell 정리** | #244 | /saju/[slug]/premium + /sample-report 의 TASTE_PRODUCTS 그리드에서 love-question 카드 제거 + MoonlightTasteProduct.compatibilityOnly flag + getTasteProductHref love-question 분기 dead code 제거 |
| 2026-05-18 | **2026-05-18 phase-5e 택일 EmptyState + 4 CTA** | #234 | OPEN. /taekil "결과가 없습니다" → EmptyState + 다시찾기/생년월일/추천날짜/유료 4 CTA |
| 2026-05-18 | **2026-05-18 phase-5d 코인 센터 skeleton + 재시도** | #233 | 잔액 fetch error state + skeleton + inline retry button + 정책/CS 링크 |
| 2026-05-18 | **2026-05-18 phase-5c 로그인 / reset-password skeleton + 고객센터 링크** | #232 | LoginPageFallback (로고/안내/카카오/Google skeleton + disabled) + reset-password skeleton |
| 2026-05-18 | **2026-05-18 phase-5ab 상태 컴포넌트 6 + 미완성 문구 제거** | #231 | LoadingState/EmptyState/ErrorState/RetryButton/SkeletonCard/FeatureUnavailable 6 + membership/lock-screen/search/help/3 loading/홈/알림 10 위치 fix |
| 2026-05-18 | **2026-05-18 legal hub + /terms /privacy 새 패턴 + 푸터 #000** | #230 | /legal?tab={kind} 가로 chip 탭 + 푸터 정책 nav 단축 + #000 강제 + migration 032 seed |
| 2026-05-18 | **2026-05-18 phase-3c-1 결제 동의 체크박스 + recordUserConsent** | #229 | PaymentConsentCheckboxes + prepare API 가드 + recordConsentsForPayment + membership 연결 |
| 2026-05-18 | **2026-05-18 phase-3b 정책 페이지 9개 + DB 버저닝 + admin UI** | #228 | migration 031 (policy_versions + user_policy_consents) + 7 신설 정책 페이지 + /admin/policies |
| 2026-05-18 | **2026-05-18 phase-3a 사업자 정보 env config + production 빌드 가드** | #227 | BUSINESS_INFO 11 필드 + assertProductionBusinessEnv + 푸터/help BusinessInfoCard |
| 2026-05-18 | **2026-05-18 canonical = ganjisaju.kr (apex) 복귀** | #226 | Vercel 정상화 후 directive 원안 복귀. 308 (도메인 정규화 표준) 확정 |
| 2026-05-18 | **2026-05-18 punycode 정규화 보강 (single source of truth)** | #225 | proxy.ts hardcoded → shouldRedirectHost 사용 |
| 2026-05-18 | **2026-05-18 hotfix redirect-loop canonical www 임시 swap** | #224 | ERR_TOO_MANY_REDIRECTS 긴급 — admin override |
| 2026-05-17 | **2026-05-17 fix today-pillar stored calculatedAt → 실제 오늘** | #223 | systematic-debugging — saju vs today-fortune 점수 95/71 mismatch root cause fix |
| 2026-05-17 | **2026-05-17 phase-2 KST 유틸 통합 + UTC drift fix + /api/health/daily** | #222 | src/shared/utils/kst.ts 6 함수 + 21 시나리오 + zodiac/buildTodayFortune raw new Date() fix |
| 2026-05-17 | **2026-05-17 phase-1 도메인 canonical + 브랜드 간지사주 통일** | #221 | SITE_CONFIG + 38 파일 달빛인생→간지사주 + sitemap/robots canonical |
| 2026-05-17 | **2026-05-17 production-hardening Phase 1 audit + master plan** | #220 | 9 docs/audit/* (production-hardening / route-status / incomplete-ui / legal-required / policy-versioning / product-catalog / qa-readiness / seo-plan / plan) |
| 2026-05-17 | **2026-05-17 audit-business-activity 분기 재실행 1회차** | #219 | 우선순위 등급 변동 0건 |
| 2026-05-17 | **2026-05-17 audit-lifetime-report — 49,000원 회귀 + 환불 정책** | #218 | scripts/audit-lifetime-report.mjs |
| 2026-05-16 | **2026-05-16 lucky-hybrid matrix audit** | #190 | scripts/audit-lucky-hybrid.mjs (5×4×6=120 케이스 매트릭스 CLI) + lucky-package.test.ts 전수 invariant. 행운 패키지 hybrid 룰 (PR #167) 회귀 자동 검출 6번째 도구 추가 |
| 2026-05-16 | **2026-05-16 A7 saju CTA 실시간 entitlement 반영** | #189 | useProductEntitlement 강화 (initialEntitlement + revalidateOnFocus/Visibility) + 4 saju 페이지 hybrid 마이그레이션 (단일 CTA = client wrapper / 복합 = EntitlementRefresher router.refresh). 다른 탭 결제 후 본 탭 자동 갱신 |
| 2026-05-16 | **2026-05-16 Phase 2C 결제 차단 + Node 22 CI fix** | #188 | service_role admin client 로 subscription/lifetime entitlement seed/cleanup + 4 시나리오 E2E. test.describe.configure({mode:'serial'}) 로 race 차단. Playwright workflow Node 22 (WebSocket native). 자동 회귀 검증 시스템 3 세대 |
| 2026-05-16 | **2026-05-16 Phase 2B selector + flow fix** | #187 | saju.spec.ts 의 selector 회귀 (article 중복 카운트) + /today-fortune 결과 페이지 navigation + free user graceful skip. CI 에서 4 시나리오 실제 통과 — Phase 2B 자동 검증 2 세대 실측 가동 |
| 2026-05-16 | **2026-05-16 Phase 2B 사주 인증 E2E** | #186 | hybrid auth fixture (storage state + real login) + 4 회귀 시나리오 spec (6 카드/hero anchor/결제 차단/점수 일치). credentials 미설정 시 자동 skip 으로 CI 안전 |
| 2026-05-16 | **2026-05-16 CI hardening (admin override 종료)** | #185 | `npm ci --legacy-peer-deps` + audit:dead-anchors:strict ci.yml step + playwright.yml workflow. typescript 4.x↔5.x peer-dep 충돌 해소로 PR #176-#184 의 admin override 만성 패턴 종료 |
| 2026-05-16 | **2026-05-16 Playwright smoke E2E** | #184 | 인증 X 페이지 (홈/pricing/membership/compatibility) 자동 검증 5/5 pass. 페이지 진입 깨짐 + console error + dead internal link 자동 차단 |
| 2026-05-16 | **2026-05-16 자동 회귀 검증 시스템 + dailyDelta fix** | #183 | audit-dead-anchors script + score invariant test 도입. PR #181 의 dailyDelta 누락 회귀 자동 검출 + fix (사용자 미보고 회귀를 사전 차단) |
| 2026-05-16 | **2026-05-16 사주 상세 hero anchor fix** | #182 | premium 페이지 hero 카드 3 버튼 (#yearly-chapter-1/2/3) 미존재 anchor → #premium-yearly/monthly/업셀 link 매핑 |
| 2026-05-16 | **2026-05-16 6 영역 카드 통일** | #181 | 사주 메인/상세/운세 페이지 모두 동일 6 카드 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운). 공유 컴포넌트 SajuAreaCardsSection + compute-saju-area-scores helper |
| 2026-05-16 | **2026-05-16 점수 단일화 완성 (yearly + credits)** | #180 | /saju/[slug]/premium ("상세" 탭) + 코인 결제 후 풀이 텍스트도 iljinScore.totalScore 통일. 모든 사주 화면 overall 1:1 일치 완성 |
| 2026-05-16 | **2026-05-16 OPEN PR 8개 batch 머지** | #168/#169/#170/#171/#172/#173/#174/#175 | 미머지 누적 PR 일괄 반영. site-header 정리, /my/settings + 로그아웃, font 슬림, admin 차트, onboarding carousel, /my 통일 + HeaderLogoutButton, 모바일 시트 4탭, admin payment funnel |
| 2026-05-16 | **2026-05-16 사주↔운세 점수 단일화** | #179 | 사주 페이지 3곳도 iljinScore.totalScore 통일 helper 호출. 두 페이지 overall 1:1 일치 |
| 2026-05-16 | **2026-05-16 결제 중복 차단 + UI 회귀** | #176 / #177 / #178 | UI 회귀 7건, 결제 진입점 9곳 차단, entitlement API + hook |
| 2026-05-15 | 점수 통일 + 사용자 이름 + 행운 hybrid | #165 / #166 / #167 | iljinScore.totalScore single source, profile 이름 주입, hybrid 9 항목 |

production canonical: **https://ganjisaju.kr** (2026-05-18 변경, 영문 ASCII apex)
Vercel 대시보드: https://vercel.com/ganji-sajus-projects/ganji-saju

---

## 9. 2026-05-19 세션 종료 정리 (13 PR + 작업 자료 3건)

### 작업 자료 (untracked)
- `docs/superpowers/bugs/2026-05-19-p0-bug-tracker.json` — P0 6 버그 위치 + 진짜 원인 + 수정 안 추적
- `docs/superpowers/bugs/2026-05-19-naming-migration.md` — ELEMENT_INFO "X과 Y" → 자연 비유 마이그레이션 가이드 + 호출처 7곳 매핑
- `docs/superpowers/plans/2026-05-19-report-llm-spec.md` — 9 챕터 LLM 통합 전체 스펙 (1차~7차 작업 분해)
- `docs/superpowers/plans/2026-05-19-saju-daewoon-narrative-redesign-p0.md` — P0 plan 원본 (PR-A/B/C 분할)

### 미해결 항목 (다음 세션)

**B02 '근' 노출** — 코드 grep 0 매치 (`STEM_TO_KOREAN` 모두 `己: '기'` 정상). 현재 코드에서 재현 불가. 가능성: 캐싱된 옛 버전 / 글꼴 렌더링 / 외부 데이터. **main 배포 (PR #244~256) 후 화면 재확인 → 여전히 보이면 DOM inspector / 페이지 URL 공유 필요**.

**V2 마이그레이션 audit/refactor (선행 필요)** — engine/index.ts 공식 가이드 "새 코드는 가급적 v2". 현재 V1 의존 파일 전수 audit 완료 (2026-05-19, [`audit-reports/2026-05-19-v2-migration-audit.md`](audit-reports/2026-05-19-v2-migration-audit.md)). 총 V1/V2 의존 60 파일 중 V2-2~V2-4 실제 변경 대상 **30 파일** (이미 V2 호환 3 / 엔진 코어·테스트 12+ 제외). 작업 분해:
- **V2-1 (완료, 2026-05-19)**: V1 의존 파일 audit 자료 작성 (코드 변경 0). 각 파일의 V1 사용 형태·라인 위치·위험도·V2-2/3/4 단계 분류 + 권장 PR 분할안 (V2-2 PR A/B/C, V2-3 PR D, V2-4 PR E~H).
- **V2-2**: domain helpers 17 파일 시그니처 `SajuDataV1 \| SajuDataV2` union (함수 본문 변경 0). 라인 변경 ~150. build-report.ts (33 refs) / build-today-fortune.ts (29 refs) / compatibility.ts (16 refs, type 부분) / build-yearly-report.ts (14 refs, type 부분) 가 큰 파일. typecheck/test 회귀 0 예상 (V2 가 V1 super-set 인 subtype 관계).
- **V2-3**: storage layer (`lib/saju/readings.ts` + `lib/saju/report-metadata.ts`) `loadSajuDataV2` 도입. DB row 의 `result_json` envelope 변경 시 롤백 안전성 / 저장 크기 +25~40 KB / row 결정 필요. **위험도 high — 1주일 모니터링 후 V2-4 진행 권장**.
- **V2-4**: production callers 11 파일 (`calculateSajuDataV1` / `normalizeToSajuDataV1` → `loadSajuDataV2`). hot path (`today-fortune/route.ts`, `today-fortune/unlock/route.ts`) 가장 신중. lib utilities (`account.ts`, `notifications.ts`, `profile-personalization.ts`) + verification (`today-fortune-audit.ts`, `kasi-calendar.ts`) + internal builder calls (`build-yearly-report.ts` line 355, `build-fortune-calendar.ts` line 164) 포함.
- **V2-5**: V2 의 SajuModernInterpretation 필드에 LLM 결과 저장 (새 데이터 모델 — 별도 설계). (a) 2-2 LLM 통합과 합쳐서 검토.

**(a) 2-2 LLM 통합 (V2-2~V2-3 후 진행)** — enhanceLifetimeChapter1WithLLM 을 saju-lifetime-service 에 통합 + 실제 OpenAI 호출 활성. 비용 발생 시점 (호출당 ~$0.005). 결정 사항:
- env feature flag (예: `OPENAI_INTERPRET_CHAPTERS=1`) toggle 방식
- 캐싱 전략 (사주 hash + chapterId 키, TTL)
- 비용 모니터링 (console.log vs telemetry)
- 챕터 1 정착 후 4·5 → 2·3·6·7 → 9 synthesis 순 확장

**후속 시각 검증** — 13 PR 머지 후 production 화면에서 확인:
- 5월 카드 "커안쪽 결만" 사라짐 (B05)
- "내 내 사주표" 누적 사라짐 (B01)
- 세운 본문 "챙기세요과/핵심입니다를" 비문 사라짐 (B04)
- 9 대운 카드 본문이 실제로 다르게 보임 (PR-B)
- 사주 결과 헤드라인 "흙에 정인격" 자연 연결 (B06)
- elements/page.tsx 의 자연 비유 라벨 ("쇠의 결" 등)
- "쇠의" 단독 노출 0 (formatElementName fix)

### 13 PR 총 변경량
- ~3,000+ lines (코드 + 테스트 + 작업 자료)
- npm test 65 → 72 (신규 invariant 30+ 케이스)
- typecheck 0 error 유지, vitest spec 64/64 회귀 0
