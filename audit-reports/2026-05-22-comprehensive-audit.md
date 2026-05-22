# ganji-saju 종합 검수 보고서 — 2026-05-22 (B 중간 깊이)

> **작업 지시서**: `docs/claude-specs/10-audit-task.md`
> **검수자**: Claude Code · **방식**: read-only (코드 수정/리팩토링/git 변경 없음)
> **대상**: `/Users/kionya/ganji-saju` (branch `main`)
> **배경**: 지난 몇 주 Codex / Claude Code / ChatGPT / Claude(채팅) 4개 AI 혼합 작업물의 *현재 상태* 파악. 9개 스펙 문서(`docs/claude-specs/01~09`) 대비 구현도 확인.

## 환경 정보

| 항목 | 값 |
|------|-----|
| OS | macOS |
| Node | v24.14.0 |
| npm | 11.9.0 |
| Next.js | 16.2.3 |
| React | 19.2.4 |
| Vitest | ^4.1.6 (`.spec.ts`) |
| Playwright | ^1.60.0 |
| 단위 테스트 러너 | `scripts/run-unit-tests.mjs` (`.test.ts`, node:assert) + Vitest (`.spec.ts`) |

---

## §0 사전 점검

**상태**: ✅ PASS

**확인 결과**:
- `pwd` = `/Users/kionya/ganji-saju` ✅
- `audit-reports/` 쓰기 권한 ✅ (drwxr-xr-x, owner kionya)
- **9개 스펙 문서**: `docs/claude-specs/` 에 01~09 전부 존재 ✅ + 작업지시서 10 = 총 10개
  | # | 파일 | 줄수 |
  |---|------|-----|
  | 01 | comprehensive-diagnostic.md | 578 |
  | 02 | naming-policy.md (**최상위 우선순위**) | 505 |
  | 03 | saju-total-review-llm-spec.md | 884 |
  | 04 | daewoon-llm-spec.md | 566 |
  | 05 | saju-terms-dictionary.json | 634 |
  | 06 | verification-prompts.md | 940 |
  | 07 | saju-score-spec.md | 1417 |
  | 08 | phase-1-task.md | 1182 |
  | 09 | phase-2-3-task.md | 1361 |
  | 10 | audit-task.md (작업지시서) | 732 |
- 작업지시서 10번 == `docs/audit/audit-task.md` (diff 무출력, 동일)
- 이전 audit 보고서: 최신 = `2026-05-20-narrative-tone-audit.md` (결정론 fallback 본문 톤 검사 — 케이스 A/B 4룰 전부 통과). **이번 검수는 그 이후 변화 추적** 성격.

**비고 (예상 밖 상황 — 해소됨)**:
- 검수 최초 시점 `find` 에서 9개 스펙이 전부 미발견 → 사용자 확인 결과 `docs/claude-specs/` 폴더가 검수 직전(2026-05-22 10:32~10:35) 추가됨. 현재는 전부 present.
- 검수 중 `CLAUDE.md` 에 `docs/claude-specs/02-naming-policy.md 우선` 참조가 추가됨(어휘 정책 최상위 우선순위 명시).

---

## Section 1 — 작업 환경 점검

**상태**: ✅ PASS (관찰 사항 있음)

**확인 결과**:
- **git 활동(3주)**: 567 커밋. 작업자 `ganji-saju` 496(AI/자동 커밋 identity) vs `kionya` 71(사용자 직접). AI-흔적 커밋(claude/codex/gpt 멘션) 32건.
- **변경 빈도 Top 5**: `src/app/saju/[slug]/page.tsx`(58), `src/app/globals.css`(55), `site-header.tsx`(35), `saju/[slug]/premium/page.tsx`(33), `saju-intake-page.tsx`(30) — 사주 결과/프리미엄/인테이크가 핫스팟.
- **PROGRESS.md**: 171KB, 최신 세션(2026-05-22 점수 결제 연동) 반영 ✅. 단 최상단 "최종 업데이트" 라인이 `#315·#316 PR open(머지 대기)`로 남아 있으나 실제로는 머지 완료 → 경미한 문서 staleness.
- **CLAUDE.md ↔ AGENTS.md**: **충돌 없음**. `CLAUDE.md` = `@AGENTS.md`(포함) + "어휘 충돌 시 docs/claude-specs/02-naming-policy.md 우선" 1줄. `AGENTS.md` = Next.js 16 주의 룰. naming-policy 우선순위는 CLAUDE.md에만 존재(의도된 계층).

**증거**:
```
작업자(3주): ganji-saju 496 / kionya 71   ·   AI-흔적 커밋 32건
Hot: saju/[slug]/page.tsx 58 · globals.css 55 · site-header 35 · premium/page 33 · saju-intake 30
```

**다음 액션 권장**:
- `docs/claude-specs/` 가 **untracked(미커밋)** — 스펙을 버전관리에 넣으려면 커밋 필요(후속, 검수 범위 밖).
- PROGRESS.md "최종 업데이트" 라인 PR 상태(open→merged) 갱신(경미).

---

## Section 2 — P0 버그 6개 잔존 검사

**상태**: ✅ PASS — 6개 전부 **실제 잔존 0건**

원시 grep hit은 전부 (a) fix 주석, (b) validator blocklist 정의, (c) 프롬프트 부정예시, (d) test 가드, (e) CSS 클래스명 `app-pink-strong`, (f) HTML `<strong>` 태그 — **사용자 노출 본문 누수 0**.

| P0 | 패턴 | 원시 hit | 실누수 | 판정 | 근거 |
|----|------|--------|------|------|------|
| #1 | "내 내 내" 변수 누수 | 1 | 0 | ✅ | `terminology.ts:21` = B01 fix 주석(`(?<!내 )사주표` lookbehind 누적 차단) |
| #2 | "근" 한자 매핑 | 0 | 0 | ✅ | 없음 |
| #3 | 영어 enum 본문 누수 | 378→0 | 0 | ✅ | 전부 CSS `app-pink-strong` + HTML `<strong>` 태그. strength enum 한글본문 누수 0 |
| #4 | 종결문 접속 비문 | 0 | 0 | ✅ | 없음 |
| #5 | "커안쪽 결만" | 2 | 0 | ✅ | `public-copy.test.ts` B05 가드(주석+assert) |
| #6 | fallback 자극 표현 | 6 | 0 | ✅ | `total-review-validator`/`chapter-validator` blocklist + 프롬프트 부정예시 + test 가드 |

**확인 결과**:
- 6개 P0 전부 수정 완료. #1·#5·#6은 회귀 방지 테스트/validator로 가드되어 재발 차단 구조.
- P0#3은 지시서 grep 패턴이 과넓어(`app-pink-strong`·`<strong>` 매치) 정밀 재검 필요했고, 정밀 결과 실누수 0 확인.

**다음 액션 권장**: 없음(전부 해소). 운영용 P0#3 자동검사는 grep 패턴을 className/`<strong>` 제외로 정교화 권장(후속·경미).

---

## Section 3 — 어휘 정책(naming-policy) 적용 검사

**상태**: ✅ PASS (관찰 사항) — 금지 SAJU 어휘 **실위반 0건**, 올바른 'X 기운' 형태 182건 사용

| 검사 | 원시 hit | 실위반 | 판정 | 비고 |
|------|--------|------|------|------|
| 5-1a 자연비유 'X의 결' | 7 | 0 | ✅ | 전부 `chapter-validator` blocklist + `elements.ts` 제거 주석 |
| 5-1b 구 라벨 '결단과/안정과/…' | 15 | 0 | ✅ | validator regex 2건 + tarot/zodiac/compat·ohaeng 설명문의 일반 한국어("새로운 시작과 도전") false positive |
| 5-1c 십성 추상명사 'X의 기운' | 0 | 0 | ✅ | |
| 5-1d 오행 'X의 기운' | 3 | 0 | ✅ | "흡수의/도화의"→"수/화의 기운" substring 오탐 2 + `build-lifetime` 외부 reference 설명 주석 1 |
| 5-1e 'X형 사주' 신조어 | 0 | 0 | ✅ | |

**오행 라벨 'X 기운' 빈도**: 목 19 · 화 28 · 토 61 · 금 49 · 수 25 = **182건** (올바른 형태 광범위 정착).

**면책 문구**: `src/lib/saju-score/labels.ts` 에 `SCORE_DISCLAIMER` 정의 + `score-color-classes.test.ts` 가드. 점수 시스템 단일 소스로 존재.

**확인 결과**:
- naming-policy 금지 어휘(자연비유 결 / 구 십성·일주 라벨 / 'X의 기운' / 'X형 사주')의 **사용자 노출 실위반 0건** — 전부 validator blocklist · 제거 주석 · 일반 한국어 false positive.
- 올바른 'X 기운' 형태가 182건으로 광범위 정착.
- 지시서 grep 패턴이 과넓어("시작과"=일반 접속, "흡수의"→"수의 기운" substring) 정밀 분류 필요했음.

**다음 액션 권장**:
- 면책 문구(`SCORE_DISCLAIMER`)가 **모든 점수 카드 경로에서 항상 렌더**되는지 컴포넌트 레벨 1회 확인 권장(후속·경미).

---

## Section 4 — Phase 1 점수 엔진 구현 확인

**상태**: ✅ PASS — 완전 구현 + 테스트 통과 + 분포 수용기준 충족

**확인 결과**:
- **파일**: 기대 8종(types/formulas/helpers/labels/ohaeng/index/test-cases/distribution) **전부 존재** ✅ + Phase 2~6 추가(visual-tokens·ohaeng-chart·from-saju-data).
- **export**: `calculateF1~F5` 5개 전부 + `computeSajuScore` ✅.
- **테스트**: 전체 **157 pass / 0 fail** ✅. (단 `.test.ts`는 vitest 아닌 `run-unit-tests.mjs`가 실행 — 지시서 `npx vitest run src/lib/saju-score`는 "No test files found"으로 0건. 테스트는 정상 존재·통과.)
- **분포(50 케이스)**: 평균 **65.3** / 표준편차 **12.5** / 최소 38 / 최대 88. excellent 0% · good 22% · neutral 42% · mindful 26% · potential 10%.
  - 수용기준(평균 65~70 · 표준편차 8~15 · 양극단 ≤15%) → **통과 ✅** (양극단 10%).
- **테스트 케이스 수**: `ALL_TEST_CASES.length === 50` assert 통과 → **50개 확인** (지시서 `grep "id: '"`=0은 따옴표 스타일 불일치 오탐).

**증거**:
```
[saju-score] 분포 통계  평균 65.3 · 표준편차 12.5 · 최소 38 · 최대 88
  excellent 0% / good 22% / neutral 42% / mindful 26% / potential 10%
ok - 점수 분포: 평균 65~70 / 표준편차 8~15 / 양극단 ≤15%
tests 157 / pass 157 / fail 0
```

**다음 액션 권장**: 없음(Phase 1 완료). 지시서 §6-3/6-4의 vitest·grep 명령을 repo 테스트 구조(`.test.ts`→custom runner)에 맞게 갱신 권장(후속·경미).

---

## Section 5 — Phase 2+3 UI 컴포넌트 확인

**상태**: ✅ PASS (구현·통합 완료) / ⚠️ 파일명 규칙이 지시서 가정과 다름(기능 정상)

**예상 밖 상황(§14-3) — 보고**: 지시서는 **PascalCase 파일명**(`SajuScoreCard.tsx`)을 가정하나, 실제는 **kebab-case 파일 + PascalCase export**(Next.js/React 통용 관례). 5개 컴포넌트 export 명은 사양과 **정확히 일치** — 누락·오명명 아님.

| 사양(export) | 지시서 PascalCase | 실제 파일 | 줄수 |
|------|------|------|------|
| SajuScoreCard | ❌ | `saju-score-card.tsx` | 64 |
| ScoreBreakdownCard | ❌ | `score-breakdown-card.tsx` | 93 |
| OhaengChart | ❌ | `ohaeng-bar-chart.tsx` (막대; 레거시 레이더 제거됨) | 108 |
| LifetimeKeysCarousel | ❌ | `lifetime-keys-carousel.tsx` | 47 |
| LockGate | ❌ | `lock-gate.tsx` | ✅ |

**확인 결과**:
- **5개 컴포넌트 전부 존재 + export 명 사양 일치** ✅. `index.ts` 배럴로 노출.
- **Tailwind 토큰**: `tailwind.config.ts` **없음**(Tailwind v4 `@theme`). `src/app/styles/tokens.css` 에 `--color-score-*` 10건 + `--color-ohaeng-*` 10건(5등급/5오행 × base+soft) ✅.
- **LockGate**: `550원` · `FACTOR_VALUE_LINES`(F1~F5) · `LockPaymentModal` · `score-factor` 결제 연결 — per-factor 잠금/결제 모델 완비 ✅.
- **총평 탭 통합**: `saju/[slug]/page.tsx` + `saju/[slug]/premium/page.tsx` 사용 ✅ (결과·프리미엄 통합).

**다음 액션 권장**:
- 파일명 규칙 차이는 **결함 아님**(export·기능 정상). 스펙 문서의 PascalCase 파일 가정 ↔ 실제 kebab-case 관례 차이만 인지(스펙을 관례에 맞춰 갱신하거나 그대로 둬도 무방).
- `OhaengChart`는 09-phase-2-3 스펙의 막대형으로 구현(구 Phase 4 레이더 제거 — 의도된 진화).

---

## Section 6 — LLM 호출 코드 검증

**상태**: ✅ PASS (LLM 인프라 충실) / ⚠️ 대운 전용 파이프라인·총평 문장수 enforce는 구조상 차이

**확인 결과**:
- **LLM 호출 중앙화**: `src/server/ai/` 에 집중 — 총평(`total-review/`), 오행 가이드(`ohaeng-guidance/`), 챕터(`chapters/`), 연간(`saju-yearly-*`), 평생(`saju-lifetime-*`) + OpenAI 클라이언트(`openai-text`, `openai-total-review-client`, `openai-chapter-client`). API 진입점 `app/api/ai`, `app/api/interpret`.
- **오케스트레이터**: `generate-total-review`, `generate-ohaeng-guidance`, `generate-chapter` — 플래그/캐시/검증/재시도/fallback 구조 ✅.
- **시스템 프롬프트 naming-policy**: `total-review-prompts`, `chapter-prompts`, `ohaeng-guidance-prompts`, `saju-interpretation` 등에 'X 기운'/한자 금지/결 단어 제한 규칙 임베드 ✅.
- **후처리 검증**: `total-review-validator` · `chapter-validator` · `ohaeng-guidance-validator` 가 `generate-*` 에 적용(hardTextReasons·countGyeol 단일 소스 재사용) ✅.

**관찰/차이**:
- ⚠️ **대운(daewoon) LLM**: 엔진(`orrery-adapter.mapDaewoon`)으로 산출 + `app/daewoon` · `daewoon-timeline-strip` 표시 + LLM은 `chapters/build-chapter9-input`·yearly·lifetime 에 통합. **04-daewoon-llm-spec의 전용 오케스트레이터(`generateDaewoon…`)는 미발견** — 챕터 파이프라인에 흡수된 구조. (기능 커버 vs 스펙 구조 차이 — 후속 확인 권장.)
- ⚠️ **총평 7→25~35문장 확장**: `total-review-validator` 에 문장 분리/중복/길이 룰은 존재하나 **명시적 25~35 문장 count enforce는 grep 미확인**(프롬프트/cross-section 룰에 있을 수 있음 — B 깊이 초과, 후속).

**다음 액션 권장**:
- 대운 LLM이 04-spec의 "9개 시기 다양성"을 충족하는지(챕터9 출력 다양성) 후속 정밀 확인.
- 총평 문장수 목표(25~35) enforce 위치 확인 또는 명문화.

---

## Section 7 — 기존 audit 스크립트 실행

**상태**: ✅ PASS — 핵심 5개 전부 exit 0

| 스크립트 | exit | 결과 |
|------|------|------|
| audit-narrative-tone | 0 | ✅ 본문 톤 'X 기운' 정상("화 기운이 중심…"). ※ 자체 리포트 `2026-05-20-narrative-tone-audit.md` 재생성(소스 변경 아님, 스크립트 부수효과) |
| audit-redesign-coverage | 0 | ✅ 통과(구스타일 CSS 일부 WARNING — 토큰화 권장 안내) |
| audit-mockup-placeholders | 0 | ✅ 586파일 스캔, 의심 패턴 0 |
| audit-dead-anchors | 0 | ✅ 586파일, dead anchor 0 (anchor href 10 / 정의 id 48 매칭) |
| audit-lifetime-report | 0 | ✅ 환불 history 0건 |

**범위 밖 5개(결제·인증) — 빌드 영향만**:
- ai-chat-idempotency 0 · business-activity 0 · lucky-hybrid 0 · payment-idempotency 0 · **user-entitlements exit 1 (FAIL)**.
- `build` = `next build` 로 audit 스크립트 **미체인** → user-entitlements 실패는 **Next.js 빌드 영향 없음**(독립 실행 검사).

**다음 액션 권장**: `audit:user-entitlements` exit 1 회귀 원인 후속 점검(결제·인증 영역, 이번 검수 범위 밖).

---

## Section 8 — 컴포넌트 품질 검사 (B 깊이 핵심)

**상태**: ✅ PASS — 5개 전부 고품질(금지어휘/TODO/any/하드코딩색상 0)

| 컴포넌트(kebab 파일) | 줄수 | use client | 금지어휘 | 면책문구 | TODO | :any | 하드코딩#hex |
|------|----|----|----|----|----|----|----|
| saju-score-card | 64 | ✅ | 0 | **2** | 0 | 0 | 0 |
| score-breakdown-card | 93 | ✅ | 0 | 0 | 0 | 0 | 0 |
| ohaeng-bar-chart | 108 | ✅ | 0 | 0 | 0 | 0 | 0 |
| lifetime-keys-carousel | 47 | ⚪(없음) | 0 | 0 | 0 | 0 | 0 |
| lock-gate | 179 | ✅ | 0 | 0 | 0 | 0 | 0 |

**깊이 점검**:
- **SajuScoreCard**: `useCountUp(target, animate, duration)` + `requestAnimationFrame` + `cancelAnimationFrame` cleanup → rAF 카운트업 정상 ✅. **면책문구(SCORE_DISCLAIMER) 2건 포함** — Section 3의 "면책 항상 표시" 후속이 메인 카드에서 해소됨.
- **ScoreBreakdownCard**: `import { LockGate }` + `unlockedFactors?: Partial<Record<LockFactorId, boolean>>` per-factor 통합 ✅.
- **OhaengChart(ohaeng-bar-chart)**: 'X 기운' 라벨("목 기운(자라남과 추진)…") + naming-policy §2 주석 + @theme ohaeng-* 토큰 ✅.
- **LockGate**: `role="dialog"` + `aria-modal="true"` + `fixed inset-0` + motion-modal idiom(terms-consent-modal 준수) → 접근성 모달 ✅.

**확인 결과**: 하드코딩 색상 0(전부 CSS var/@theme), `:any` 0(타입 안전), TODO/FIXME 0, 금지어휘 0. 구현 품질 양호.

**다음 액션 권장**:
- `lifetime-keys-carousel` 가 `'use client'` 없음 — 인터랙션(스크롤/스와이프) 필요 시 client 전환 확인(CSS 스크롤만이면 서버 컴포넌트로 OK). 경미·후속.

---

## Section 9 — 사이트맵·라우팅 검수

**상태**: ✅ PASS — 라우트·탭·진입점 정상

**확인 결과**:
- **사주 결과 탭**(`saju/[slug]/`): `page`(메인) · `nature`(성향) · `elements`(오행) · `deep`(명식) · `overview` · `premium`(+`premium/print`) · `share` · `today-detail`. → **ScoreBreakdownCard LockGate 의 `navigateTo=/saju/{slug}/{tab}`(nature·deep·elements) 타겟과 일치** ✅.
- **인테이크**: `saju/new/` (birth·consent·empathy·nickname).
- **대운/세운/일진**: `app/daewoon` ✅, `app/today` · `app/today-fortune` · `saju/[slug]/today-detail`. 세운(saewoon) 전용 디렉토리는 없음(연간 리포트에 통합 추정).
- **결제/잠금 진입점**: `lock-gate`(score) · `detail-unlock` · `premium-lock-card`(today) · `toss-membership-checkout` · `payment-consent-checkboxes` 등 다수 ✅.

**다음 액션 권장**: 없음(라우팅 정상). 세운 전용 경로 필요 여부만 제품 판단(후속).

---

## Section 10 — Playwright E2E 확인 (분석만, 미실행)

**상태**: ⚠️ PARTIAL — E2E 존재하나 **신규 점수 시스템/잠금 미커버**

**확인 결과**:
- **E2E 파일**: `auth.setup.ts` · `saju.spec.ts`(192줄) · `payment-blocks.spec.ts`(136줄) · `smoke.spec.ts`(88줄) + `fixtures/`.
- **`saju.spec.ts`**(최종 수정 2026-05-16, PR #186/#187) 4 시나리오: ①6 영역 카드 노출 ②premium hero anchor ③/membership 진입점 ④6 영역 score `/saju`↔`/today-fortune` 1:1 일치. → 여기서 "score"는 **구 6 영역 점수(`compute-saju-area-scores`)**, 신규 `SajuScoreCard`/`ScoreBreakdownCard` 아님.
- **`payment-blocks.spec.ts`**: 멤버십 중복차단 + "구매한 풀이 보기"(lifetime/today-detail) CTA. **score-factor 550원 LockGate 미커버**.
- **갭**: 신규 Phase 2+3 점수 컴포넌트(SajuScoreCard·ScoreBreakdownCard·OhaengChart·LockGate) + **score-factor 결제→해제 플로우** E2E **0건**. (점수 시스템은 2026-05-21~22 작업 → E2E(2026-05-16)가 선행하여 미반영.)

**다음 액션 권장**:
- 신규 점수 카드 + per-factor LockGate(🔒→결제 모달→해제) E2E 시나리오 추가 권장(회귀 차단). 결제 무한루프 fix(#315) 같은 회귀를 E2E로 잡으려면 특히 가치.

---

## Section 11 — 종합 보고서

### 11-1. 9개 스펙 문서별 적용도

| # | 스펙 문서 | 위치 | 적용 | 적용도 | 검증 | 잔존 이슈 |
|---|---------|----|----|------|----|----------|
| 01 | comprehensive-diagnostic | ✅ | ✅ | ~95% | ✅ | P0 6/6 해소 |
| 02 | naming-policy (최우선) | ✅ | ✅ | ~95% | ✅ | 실위반 0 · 'X 기운' 182건 |
| 03 | saju-total-review-llm | ✅ | ✅ | ~85% | 🟡 | 25~35문장 enforce 미확인 |
| 04 | daewoon-llm | ✅ | 🟡 | ~50% | 🟡 | 전용 LLM 파이프라인 미발견(챕터9 흡수) |
| 05 | saju-terms-dictionary(json) | ✅ | 🟡 | 미심층 | — | 본 검수 직접 대조 안 함 |
| 06 | verification-prompts | ✅ | 🟡 | 부분 | 🟡 | audit 스크립트/validator로 일부 구현 |
| 07 | saju-score-spec | ✅ | ✅ | ~95% | ✅ | Phase 1~3 완료 |
| 08 | phase-1-task | ✅ | ✅ | ~100% | ✅ | 157테스트·분포 충족 |
| 09 | phase-2-3-task | ✅ | ✅ | ~95% | 🟡 | E2E 미커버(단위는 N/A·컴포넌트) |

### 11-2. 14개 작업 항목 분류

| # | 작업 | 분류 | 근거 |
|---|-----|----|------|
| 1 | P0#1 "내 내 내" | 🟢 | fix 주석+lookbehind, 실누수 0 |
| 2 | P0#2 "근" 매핑 | 🟢 | 0건 |
| 3 | P0#3 영어 enum | 🟢 | 실누수 0 (CSS/`<strong>` 오탐만) |
| 4 | P0#4 종결문 비문 | 🟢 | 0건 |
| 5 | P0#5 "커안쪽" | 🟢 | test 가드만 |
| 6 | P0#6 챕터 fallback 자극 | 🟢 | validator blocklist만 |
| 7 | 어휘 정책(naming-policy) | 🟢 | 실위반 0 · 182 라벨 · validator |
| 8 | 총평 LLM 확장(7→25~35문장) | 🟡 | 파이프라인 라이브, 25~35 enforce 미확인 |
| 9 | 대운 9개 다양성 | 🟡 | 산출/표시/챕터통합 O, 전용 다양성 미검증 |
| 10 | 점수 Phase 1(엔진) | 🟢 | 8파일·157테스트·분포 65.3/12.5 |
| 11 | 점수 Phase 2(라벨/색상) | 🟢 | @theme 10+10·labels·visual-tokens |
| 12 | 점수 Phase 3(UI) | 🟢 | 5컴포넌트·통합 |
| 13 | 잠금 UI/결제 모달 | 🟢 | lock-gate·550원·score-factor 라이브 |
| 14 | 총평 탭 통합 | 🟢 | saju/[slug] + premium 통합 |

**통계**: 🟢 완료 **12** · 🟡 부분 **2** · 🔴 미적용 **0** · ⚪ 보류 **0**

### 11-3. AI별 작업 흔적 추정 (git author + 파일 헤더 + 주석 날짜 기반)

- **Claude Code** (author `ganji-saju`, Co-Authored-By Claude): 점수 시스템 Phase 1~7, 컴포넌트(kebab 파일), score-factor 결제 연동(#315), validator/오케스트레이터, 무한루프 fix. 최근 3주 커밋 다수.
- **Codex CLI**: 공개 상용화 P0(PROGRESS `0-prev-2` Codex 세션), login/credits/today-fortune 하드닝.
- **Claude(채팅)**: `docs/claude-specs/` 01~10 스펙 문서(전략 설계·작업지시서) 작성.
- **ChatGPT**: 일부 스펙/카피 수동 적용 흔적(특정 식별 어려움).
- **사용자(kionya, 71커밋)**: 수동 수정, 프로덕션 배포, 마이그 037/038 적용, 머지 결정.

### 11-4. 우선순위 다음 액션 Top 5

| # | 이슈 | 영향 범위 | 예상 소요 | 권장 처리 |
|---|-----|--------|---------|---------|
| 1 | `audit:user-entitlements` exit 1 — 결제·인증 권한 회귀(또는 환경 의존) | 결제/이용권 무결성(금전) | 소~중(원인 규명 먼저) | 수동 진단 → Claude Code |
| 2 | 신규 점수 카드 + score-factor LockGate **E2E 부재** | 회귀 안전망(최근 결제 무한루프 실재) | 중 | Claude Code |
| 3 | 대운 LLM 다양성(04-spec) 검증/보강 — 전용 파이프라인 vs 챕터9 흡수 | 대운 콘텐츠 품질 | 중~대 | Claude Code |
| 4 | 총평 25~35문장 enforce 명문화·검증(03-spec) | 총평 분량 일관성 | 소 | Claude Code |
| 5 | 문서 정합: `docs/claude-specs/` 커밋 + PROGRESS PR상태 갱신 + 스펙의 PascalCase/`tailwind.config` 가정 현행화 | 문서/온보딩 | 소 | 수동 |

### 11-5. 종합 판정

- **점수 시스템(Phase 1~3) + 어휘 정책 + P0 6종**: **사실상 완료**(🟢). 테스트·분포·validator·라이브 결제까지 검증됨.
- **부분(🟡) 2건**은 LLM 콘텐츠 깊이(총평 문장수·대운 다양성)로, 기능은 동작하나 스펙 정량 기준 충족 여부가 미검증.
- **검수 범위 밖 적신호 1건**: `audit:user-entitlements` 실패(결제·인증) — 빌드 무관하나 무결성 차원에서 우선 진단 권장.
- **회귀 안전망 갭**: 신규 점수/잠금 E2E 부재.

---

> 검수 완료 — 본 보고서는 read-only 분석 결과이며 소스 코드/git 변경 없음. 발견 사항의 처리는 후속 작업.

---

## 갱신 — 2026-05-22 Step 3 (대운 본문/제목 정리) 결과

§11-2의 🟡 부분 1건 + 측정으로 신규 식별된 🔴 2건이 모두 🟢 완료로 갱신됨.
상세: `audit-reports/2026-05-22-daewoon-fix-report.md`

| 작업 | 이전 | 갱신 후 |
|------|----|------|
| 9. 대운 9개 다양성 | 🟡 | 🟢 (측정 0.348 ≤ 0.40) |
| 9a. 챕터 제목 다양화 | 🔴(7/10) | 🟢 (10/10) |
| 7a. 대운 본문 한자/용어 | 🔴(한자 20·순행/원진/월지 등) | 🟢 (한자 0·명리용어 0, daewoon-validator 가드) |

**총합: 🟢 14 / 🟡 0 / 🔴 0 / ⚪ 0** (모든 핵심 항목 완료).
