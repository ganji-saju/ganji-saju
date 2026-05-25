# ganjisaju.kr LLM 호출·캐시·비용 구조 진단 (READ-ONLY)

- 작성일: 2026-05-25
- 대상 브랜치: `chore/llm-cost-audit` (최신 main 기준, 읽기 전용)
- 범위: `src/server/ai/**`, `src/server/today-fortune/build-today-fortune.ts`, 관련 라우트/페이지
- 성격: 코드 변경 없음. 비용·트리거·hit률 수치는 모두 **가정(assumption)** 으로 명시했고, 실측은 telemetry/쿼리 로그가 필요함.

> 핵심 단가 가정(이하 전 구간 공통): 본 리포트는 코드에 이미 박혀 있는 단가표
> (`chapter-telemetry.ts` L48-53)를 그대로 따른다 — **gpt-5.2 / gpt-5.2-chat-latest =
> 입력 $1.25 / 1M tok, 출력 $10.00 / 1M tok**. 실제 OpenAI 청구 단가가 다르면 이 두 숫자만
> 치환하면 모든 비용이 비례 재계산된다. (한국어 1자 ≈ 1.5~2 토큰으로 가정.)

---

## 0. 한눈 요약 (TL;DR)

| 영역 | flag | **prod 추정** | 모델 | 캐시 | 콜드 1뷰 LLM 호출수 | 분류 |
|---|---|---|---|---|---|---|
| 오늘운세 | (없음) | 항상 ON | — | — | **0 (LLM 없음)** | **L1** |
| 기본 사주풀이 | (항상) | ON | gpt-5.2-chat-latest | `ai_interpretations` | 1 | L2/L3 |
| 총평(total review) | `OPENAI_INTERPRET_TOTAL_REVIEW` | **ON(=1)** | gpt-5.2-chat-latest | `ai_total_review_interpretations` | **3 (병렬 섹션)** | L2/L3 |
| 올해운세(yearly) | (항상) | ON | gpt-5.2-chat-latest | `ai_yearly_interpretations` | **2 (병렬 스테이지)** | L2/L3 |
| 대운 9챕터(lifetime) | `OPENAI_INTERPRET_CHAPTERS` | **OFF(=0/미설정 추정)** | gpt-5.2-chat-latest | `readings.result_json` 임베디드 envelope + **본편 미캐시** | **최대 11 (ch1~7,9 + 본편) + 검증 재시도** | L2(챕터)+**L3(본편)** |
| 오행 가이드(ohaeng) | `OPENAI_INTERPRET_OHAENG_GUIDANCE` | flag=1이나 **prod 호출 없음(dev 전용)** | gpt-5.2-chat-latest | `ai_ohaeng_guidance_interpretations` | **0 (실호출 경로 없음)** | (사실상 미가동) |
| 궁합 깊은풀이(compatibility) | `OPENAI_INTERPRET_COMPATIBILITY` | **ON(=1)** | gpt-5.2-chat-latest | `ai_compatibility_interpretations` | **1 (다중섹션 단일콜)** | L2/L3 |

가장 중요한 3가지 발견:
1. **오늘운세는 LLM을 전혀 호출하지 않는다(L1 확정).** `build-today-fortune.ts` 안에 `generateAiText`/`openai`/`fetch` 참조가 0건.
2. **대운 본편(lifetime 최종 `generateAiText`)은 어떤 캐시에도 저장되지 않는다(`cacheable: false`).** 챕터(ch1~7,9)는 `readings.result_json` envelope에 캐시되지만, 그것들을 합쳐 만드는 **최종 풀이 단계는 매 요청마다 재호출** → L2 이전 1순위 후보.
3. **오행 가이드는 flag가 `=1`이어도 프로덕션 호출 경로가 없다.** `generateOhaengGuidance`는 `/app/dev/saju-score`(프로덕션 `notFound()` 차단)에서만 import되고, 그마저도 결정론(`buildDeterministicOhaengGuidance`)만 쓴다. → 캐시 0행과 정합.

---

## 1. 캐시 테이블 / 임베디드 캐시 구조

### 1-1. 영역별 캐시 위치

| 영역 | 캐시 위치 | 키 종류 | content-addressed? | TTL | read-through? | source 라벨 |
|---|---|---|---|---|---|---|
| 기본 사주풀이 | 테이블 `ai_interpretations` | `(reading_id, topic, prompt_version)` | **아니오** (reading_id 기반) | 없음(영구) | 예 | `openai`/`fallback` |
| 올해운세 | 테이블 `ai_yearly_interpretations` | `(reading_id 또는 reading_slug, target_year, counselor_id, prompt_version)` | **부분** (slug는 사주기반) | 없음(영구) | 예 | `openai`/`fallback` |
| 총평 | 테이블 `ai_total_review_interpretations` | `(cache_key=SHA256, prompt_version)` | **예** | **30일** | 예 | `llm`/`cache`/`fallback` |
| 오행 가이드 | 테이블 `ai_ohaeng_guidance_interpretations` | `(cache_key=SHA256, prompt_version)` | **예** | **30일** | 예 | `llm`/`cache`/`fallback` |
| 궁합 | 테이블 `ai_compatibility_interpretations` | `(cache_key=SHA256, prompt_version)` | **예** (쌍 정렬) | **30일** | 예 | `llm`/`cache`/`fallback` |
| 대운 9챕터 | **임베디드** `readings.result_json`(`chaptersEnvelope`) | 각 챕터 entry 의 `cacheKey=SHA256` | **예** | **30일**(`isChapterCacheFresh`) | 예(envelope) | `llm`/`cache`/`fallback` |
| 대운 **본편** | **없음** | — | — | — | **아니오** | `openai`/`fallback` |

### 1-2. content-addressed 키 설계 (hit률을 좌우하는 핵심)

- **총평**(`total-review-cache.ts` L23-47): SHA256( 4기둥 ganzi + 일간 stem/element + gender + {관계상태/직업/고민} + promptVersion ). 사주 메타(calculatedAt)는 제외 → **같은 사주+같은 상황이면 시간 무관 hit**. 단 사용자 상황(관계/직업/고민)이 키에 포함되어, 같은 사주라도 상황이 다르면 miss.
- **궁합**(`compatibility-interpretation-cache.ts` L12-22): SHA256( `[selfChartKey, partnerChartKey].sort()` + relationship + promptVersion ). **쌍 정렬**이라 A↔B 순서 무관 → 동일 커플은 1회만 과금.
- **오행**(`ohaeng-guidance-cache.ts` L15-25): SHA256( counts[목화토금수] + dominant + lack + excess + balanceLevel + promptVersion ). **사용자 무관**으로 오행 분포 자체만 키 → 이론상 hit률이 가장 높아야 하는 구조(분포 가짓수 유한). 그러나 §4-가동상태 참고: prod 호출 경로 없음.
- **대운 챕터**(`chapter-cache.ts` L18-43): SHA256( 4기둥 ganzi + 일간 + {age/관계/직업/고민} + chapterId ). 챕터별 별도 키.
- **기본 사주풀이**(`/api/interpret/route.ts` L91-97): `reading_id + topic + prompt_version` 동등비교. **SHA256 content-addressed 아님** → 같은 사주라도 reading row가 다르면(예: 비로그인 deterministic slug, 재계산) 별도 캐시. `isReadingId` 가 아니면 캐시 자체를 안 함(L86, L116).

### 1-3. hit률이 구조적으로 높/낮은 이유 + 행수 기반 추정

- **구조적으로 hit률이 높은 영역**: 총평/궁합/오행 — content-addressed라 "같은 입력=같은 키". 특히 오행은 키에 사용자 식별자가 없어 잠재 hit률 최상(다만 미가동).
- **구조적으로 hit률이 낮아질 수 있는 영역**:
  - **기본 사주풀이**: reading_id 단위 + topic 분리. 사용자가 topic(총운/연애/재물 등)을 바꿔 볼 때마다 새 키 → miss. 비로그인(deterministic slug)은 아예 캐시 미적용(`isReadingId` false) → 매번 L3.
  - **올해운세**: `target_year` + `counselor_id` 가 키에 포함 → 연도/상담사 전환 시 miss. 단 `regenerate=true` 면 강제 재호출(L232).
  - **대운 본편**: **캐시 없음 → hit률 0% (항상 cold)**.
- **행수 기반 추정**(Supabase 메타 2026-05):
  - `readings`=566. `ai_interpretations`=6 → 기본풀이 캐시가 매우 얕음(566 reading 중 6행). 대부분 비로그인 slug이거나 풀이 미진입으로 추정.
  - `ai_yearly_interpretations`=33 → yearly는 어느 정도 누적.
  - `ai_total_review_interpretations`=17 → 총평 flag ON 상태에서 누적 중. 566 reading 대비 17이면, 총평까지 도달한 트래픽이 적거나(또는 상황 키 분기로 키가 흩어짐) 초기.
  - `ai_ohaeng_guidance_interpretations`=0, `ai_compatibility_interpretations`=0 → 오행은 prod 경로 없음(0 정합), 궁합은 flag ON이나 아직 결제·열람 트래픽이 없어 0으로 추정.

> ⚠️ **정확한 live hit% 는 본 코드 정적분석만으로 산출 불가.** `chapter_run` telemetry 로그(아래 §6)와
> 캐시 테이블 read/write 비율(쿼리 로그)을 집계해야 실측 hit률이 나온다. 위 추정은 행수·구조 기반의
> 정성적 추론이다.

---

## 2. `src/server/ai/` 함수별 표

| 영역 | 핵심 모듈 | flag (+prod 추정 상태) | 모델 | 캐시(테이블/embedded) | **콜드 1뷰당 OpenAI 호출수** |
|---|---|---|---|---|---|
| 기본 사주풀이 | `saju-interpretation.ts` + `/api/interpret/route.ts` | (flag 없음, 항상 시도) | `OPENAI_INTERPRET_MODEL`→gpt-5.2-chat-latest | `ai_interpretations` | **1** (`generateAiText`, max_out 900) |
| 총평 | `saju-total-review-service.ts` + `total-review/` | `OPENAI_INTERPRET_TOTAL_REVIEW` — **ON(=1)** | gpt-5.2-chat-latest | `ai_total_review_interpretations` | **3** (one_line / main_narrative / lifetime_keys, `Promise.all`) |
| 올해운세 | `saju-yearly-service.ts` + `saju-yearly-interpretation.ts` | (flag 없음, 항상 시도) | gpt-5.2-chat-latest | `ai_yearly_interpretations` | **2** (narrative + monthly, `Promise.all`) |
| 대운 9챕터 | `saju-lifetime-service.ts` + `chapters/` | `OPENAI_INTERPRET_CHAPTERS` (+`_CHAPTER_IDS`) — **OFF 추정** | gpt-5.2-chat-latest | `readings.result_json`(`chaptersEnvelope`) | 챕터 ch1~7+9 = **8** + **본편 1(미캐시)** = **9** (검증 실패 시 챕터당 +최대 2 재시도) |
| 오행 가이드 | `ohaeng-guidance/` | `OPENAI_INTERPRET_OHAENG_GUIDANCE` — flag=1이나 **prod 호출 없음** | gpt-5.2-chat-latest | `ai_ohaeng_guidance_interpretations` | **0** (호출 경로 없음; dev showcase는 결정론만) |
| 궁합 | `compatibility/` | `OPENAI_INTERPRET_COMPATIBILITY` — **ON(=1)** | gpt-5.2-chat-latest | `ai_compatibility_interpretations` | **1** (3~5섹션을 단일 콜로 JSON 생성, max_out 1400) |

공통 클라이언트 동작(`openai-text.ts`):
- 모델 기본값: `getOpenAIModel()`=gpt-5.2, `getOpenAIInterpretationModel()`=gpt-5.2-chat-latest (override `OPENAI_INTERPRET_MODEL`). 풀이 계열은 전부 interpretation 모델 사용.
- `maxRetries: 0` (SDK 레벨 재시도 없음, L110) + `store: false` + timeout 15초 기본. **단, 검증 실패 재시도는 상위 오케스트레이터가 수행**(아래 §3-재시도).
- `usage.input_tokens/output_tokens` 를 추출해 결과에 실어 비용 추적 가능(L173-177).

---

## 3. 영역별 L1 / L2 / L3 분류 + 재시도 동작

분류 기준: **L1=결정론(LLM 없음)**, **L2=영속 캐시 hit(과금 없음)**, **L3=실시간 LLM(과금 발생)**.

| 영역 | 분류 | 콜드(첫 1회) | 이후(같은 입력) |
|---|---|---|---|
| **오늘운세** | **L1** | 결정론 — LLM 0회 | 결정론 — LLM 0회 |
| 기본 사주풀이 | L3→L2 | L3 1회 후 `ai_interpretations` 저장 | L2 (cached=true, source 그대로) |
| 총평 | L3→L2 | L3 3섹션 후 `ai_total_review_interpretations` 저장(전 섹션 llm일 때만) | L2 |
| 올해운세 | L3→L2 | L3 2스테이지 후 `ai_yearly_interpretations` 저장(전 스테이지 openai일 때만) | L2 |
| 대운 챕터(ch1~7,9) | L3→L2 | L3 각 챕터 1회 후 envelope 저장 | L2 (envelope hit) |
| **대운 본편(최종 풀이)** | **L3 (항상)** | L3 1회 | **L3 1회 — 캐시 없음, 매번 재과금** |
| 오행 가이드 | (미가동) | — | — |
| 궁합 | L3→L2 | L3 1회 후 `ai_compatibility_interpretations` 저장 | L2 |

재시도(추가 호출) 동작 — **비용에 직접 영향**:
- **총평**(`generate-total-review.ts` L77): 섹션별 `maxRetries=2` → 검증 실패 시 섹션당 **최대 3회**. 3섹션 모두 최악이면 9콜. 단 LLM 호출 자체 실패(throw)도 retry로 흡수.
- **궁합/오행**(각 generate L80/L98): `maxRetries=2` → **최대 3회** (오행은 길이/validator, 궁합은 JSON 파싱+validator).
- **대운 챕터**(`generate-chapter.ts` L138, 단 lifetime-service는 `enhance*` 경유): chapter-validator 실패 시 `maxRetries`(기본 2)까지 재호출.
- **기본 사주풀이/올해운세**: 오케스트레이터 레벨 재시도 없음(파싱 실패 시 fallback). 단 `generateAiText`의 SDK 재시도도 0 → **1콜 고정**.

> 비용 추정(§4)은 **검증 1회 통과(재시도 0)** 를 기본 가정으로 한다. 재시도가 흔하면 해당 영역 비용은
> 1.0~3.0배 사이에서 증가한다(특히 총평).

---

## 4. 추정 비용

### 4-1. 토큰 추정 (영역별, 콜드 1회 생성 기준)

입력 토큰은 system instructions + 직렬화된 사주/grounding JSON, 출력 토큰은 기대 산출 길이에서 추정.
한국어 1자 ≈ 1.5~2 토큰. (모든 수치는 **가정**.)

| 영역 | 콜당 입력 tok(가정) | 콜당 출력 tok(가정) | 콜수 | **생성당 합계 입력/출력 tok** | 근거 |
|---|---|---|---|---|---|
| 기본 사주풀이 | ~2,500 | ~700 | 1 | 2,500 / 700 | grounding JSON 통째 + 긴 instructions(`saju-interpretation.ts` L348-373), max_out 900 |
| 총평 | ~2,000 ×3 | one_line~120 + main~1,000 + keys~250 | 3 | ~6,000 / ~1,370 | system 3,344자(≈2k tok), `main_narrative` 4단락이 큼, max_out 1,500 |
| 올해운세 | narrative~2,600 + monthly~2,400 | narrative~1,300 + monthly(12개월)~1,600 | 2 | ~5,000 / ~2,900 | max_out 2,400/1,900, 12개월 flow |
| 대운 챕터(1뷰=ch1~7,9) | ~2,200 ×8 | 챕터 본문 180~450자→~600 ×8 | 8 | ~17,600 / ~4,800 | few-shot 포함 user msg, max_out 700 |
| 대운 **본편** | ~3,000 | ~2,000 | 1 | 3,000 / 2,000 | lifetime 전체 리포트 직렬화, max_out 2,600 |
| 궁합 | ~1,800 | 3~5섹션×(60~420자)→~1,200 | 1 | 1,800 / 1,200 | max_out 1,400, body 60~420자 |
| 오행(미가동) | ~600 | ~300 | 1 | 600 / 300 | max_out 400, 20~320자 |

### 4-2. 생성 1회당 비용 (단가 가정: 입력 $1.25/1M, 출력 $10/1M)

비용 = (입력tok × 1.25 + 출력tok × 10) / 1,000,000

| 영역 | 입력 비용 | 출력 비용 | **콜드 1생성 합계(USD)** |
|---|---|---|---|
| 기본 사주풀이 | $0.0031 | $0.0070 | **≈ $0.010** |
| 총평(3콜) | $0.0075 | $0.0137 | **≈ $0.021** |
| 올해운세(2콜) | $0.0063 | $0.0290 | **≈ $0.035** |
| **대운 풀(챕터8+본편1)** | $0.0258 | $0.0680 | **≈ $0.094** |
| 궁합(1콜) | $0.0023 | $0.0120 | **≈ $0.014** |
| 오행(미가동) | $0.0008 | $0.0030 | ≈ $0.004 |

> 대운이 압도적으로 비쌈(생성당 ≈ $0.09). 다만 **prod에서 챕터 flag OFF로 추정**되면 대운은 본편 1콜
> (≈ $0.01)만 발생. flag ON 시 9콜 + 재시도로 비용 급증.

### 4-3. DAU별 일일 비용 시뮬레이션

**가정(모두 명시, 조정 가능):**

| 가정 변수 | 값 | 비고 |
|---|---|---|
| 1 DAU = 사주 1건 조회 | 1 reading/유저/일 | 보수적 |
| 기본 사주풀이 트리거율 | 70% | 결과페이지 진입 후 풀이 호출 |
| 총평 트리거율 | 60% | 결과페이지 총평 섹션(flag ON, 컨텍스트 有) |
| 올해운세 트리거율 | 25% | 별도 진입 |
| 대운 트리거율 | 3% | 유료(평생소장권) |
| 궁합 트리거율 | 5% | 유료, 2인 |
| **캐시 hit률(L2 비율)** | **60%** | content-addressed 영역 가정. cold(과금)=40% |
| 대운 챕터 flag | **OFF** | 본편 1콜만 과금(미캐시이므로 hit 0%) |
| 대운 본편 hit률 | 0% | 캐시 없음 → 항상 cold |

cold 호출수 = DAU × 트리거율 × (1 − hit률). 대운 본편만 hit률 0% 적용.

**DAU 100 (일):**
- 기본: 100×0.7×0.4 = 28생성 × $0.010 = **$0.28**
- 총평: 100×0.6×0.4 = 24생성 × $0.021 = **$0.50**
- 올해: 100×0.25×0.4 = 10생성 × $0.035 = **$0.35**
- 대운: 100×0.03 = 3건 → 본편 3 × $0.010 = **$0.03** (챕터 OFF 가정)
- 궁합: 100×0.05×0.4 = 2생성 × $0.014 = **$0.03**
- **일 합계 ≈ $1.19 / 월 ≈ $36**

**DAU 1,000 (일):** 위 ×10 ≈ **$11.9 / 일, 월 ≈ $357**

**DAU 10,000 (일):** ×100 ≈ **$119 / 일, 월 ≈ $3,570**

**민감도 — 대운 챕터 flag를 ON 으로 켜면(9콜+):** 대운 생성당 $0.094.
- DAU 1,000·대운 트리거 3%·hit 60% 가정 시 cold 대운 = 1,000×0.03×0.4 = 12생성 × $0.094 = **$1.13/일**.
  여기에 챕터 cache가 envelope last-write-wins라 **같은 요청 내 다중 miss 시 다음 요청에서 재호출**(코드 L155-158 주석)되는 점이 추가 비용을 만들 수 있음 → 실측 필요.
- **재시도까지 겹치면 총평·대운 비용이 1.5~2배로 튈 수 있음**(§3).

> 위 DAU 비용은 트리거율·hit률 가정에 선형 의존. 실제 비용은 (a) `chapter_run` 로그의 source 분포,
> (b) 캐시 테이블 read/write 비율, (c) 재시도 빈도를 집계해 확정해야 함.

---

## 5. L2 이전 후보 (캐시 미적용/콜드 재호출 영역)

우선순위 순:

### 후보 1 — 대운 본편(최종 lifetime `generateAiText`) **[최우선]**
- **현황**: `saju-lifetime-service.ts` L227-233 의 본편 풀이는 `cacheable: false`(L99, L259)로 **영속 캐시가 전혀 없다**. 챕터(ch1~7,9)는 envelope에 캐시되지만, 그것을 종합하는 본편은 매 `/api/interpret/lifetime` 요청마다 L3 재호출.
- **근거(비용·중복 위험)**: 생성당 ≈ $0.01 (입력 3,000/출력 2,000 tok)이며, 같은 reading을 재열람·새로고침할 때마다 중복 과금. 유료(평생소장권) 사용자가 리포트를 여러 번 여는 특성상 중복 생성 위험 높음. 본편 출력이 사주+report 결정론 입력에 의존하므로 **content-addressed 키(사주 ganzi + counselor + promptVersion)** 로 충분히 캐시 가능.
- **제안 방향(코드 변경 아님)**: 챕터 envelope와 같은 `readings.result_json` 임베디드 또는 신규 테이블 `ai_lifetime_interpretations`(reading_id + counselor + prompt_version)로 read-through. yearly/total-review 패턴 그대로 복제 가능.

### 후보 2 — 기본 사주풀이의 비로그인(deterministic slug) 경로
- **현황**: `/api/interpret/route.ts` L86·L116 — `isReadingId(readingId)` 가 아니면 read/write 둘 다 skip → 비로그인 slug 트래픽은 **항상 cold L3**. 캐시 키도 SHA256 content-addressed가 아니라 reading_id 동등비교.
- **근거**: `readings`=566 대비 `ai_interpretations`=6행은 캐시가 거의 안 쌓였음을 시사(대부분 slug이거나 미진입). 비로그인 동일 사주가 반복 조회되면 매번 과금.
- **제안 방향**: slug(=사주 deterministic 해시) 기반 content-addressed 캐시 추가, 또는 topic별 분리 키를 사주해시+topic으로 통일.

### 후보 3 — 올해운세 `regenerate`/연도·상담사 분기로 인한 miss 축소
- **현황**: 캐시는 있으나 키에 `target_year`+`counselor_id` 포함 → 연도/상담사 전환 시 miss. `regenerate=true`(route L232) 시 강제 재호출.
- **근거**: 생성당 ≈ $0.035 로 단가가 높은 편(12개월 monthly 출력). 같은 사주의 같은 해를 상담사만 바꿔도 2배 과금.
- **제안 방향**: 캐시 자체는 적절. regenerate 남용 모니터링 + 상담사 무관 공통 파트 분리 캐시는 선택적.

### (후보 아님 — 명시) 총평 / 궁합 / 오행
- 이미 content-addressed 30일 TTL read-through 캐시가 적용됨. 추가 L2 이전 불필요.
- 단 **총평 캐시 set 시 `model`을 넘기지 않아 항상 `model: null` 저장**(`saju-total-review-service.ts` L162 가 `{ output, reasons }`만 전달, store는 `value.model ?? null`). 비용 추적 메타 누락이지 캐시 동작 자체 문제는 아님 — 관측성 개선 여지.
- **오행은 캐시가 아니라 "호출 경로"가 없음** — L2 이전 대상이 아니라, 가동하려면 프로덕션 호출부 연결이 선행돼야 함.

---

## 6. 관측성(telemetry) 메모

- `chapter-telemetry.ts`: `logChapterRun` 이 `event:'chapter_run'` JSON 한 줄을 console.log → Vercel runtime logs에서 grep 가능. 필드: `chapterId, source(llm/cache/fallback), durationMs, retries, cacheKey, validationFailures, model, inputTokens, outputTokens, costUsd, userIdHash(SHA256 16자)`.
- `estimateChapterCostUsd`(L63): 위 단가표로 콜당 비용을 계산해 로그에 실음 → **챕터 영역만큼은 실측 비용 집계 가능**.
- 한계: **챕터 외 영역(기본/총평/올해/궁합/본편)은 동급 telemetry가 없음.** `generateAiText`는 usage를 결과에 싣지만(L173-177) 라우트들이 이를 로깅·집계하지 않음 → 이 영역들의 실측 비용/hit률은 캐시 테이블 read/write 쿼리 로그와 OpenAI 대시보드 교차로만 산출 가능.
- 따라서 **정확한 live hit% / 일일 실비용은 (1) chapter_run 로그 집계 + (2) 캐시 테이블 cached=true 비율 + (3) OpenAI usage 대시보드** 3종을 합쳐야 확정된다(본 리포트는 정적분석·행수 기반 추정).

---

## 부록 — 파일·라인 근거 인덱스

- 단가표: `src/server/ai/chapters/chapter-telemetry.ts` L48-53
- 오늘운세 LLM 없음: `src/server/today-fortune/build-today-fortune.ts` (generateAiText/openai/fetch grep 0건)
- 기본 사주풀이 1콜 + 캐시: `src/app/api/interpret/route.ts` L86-139, L243-249
- 총평 3섹션 병렬 + 캐시 read-through: `src/server/ai/saju-total-review-service.ts` L93-165; 재시도 `total-review/generate-total-review.ts` L73-114; 캐시 store `total-review/total-review-cache-store.ts`
- 올해 2스테이지 병렬 + 캐시: `src/server/ai/saju-yearly-service.ts` L94-97(토큰), L135-204(캐시), L288-307(병렬)
- 대운 챕터 임베디드 캐시 + 본편 미캐시: `src/server/ai/saju-lifetime-service.ts` L99(`cacheable:false`), L188-214(직렬 챕터), L227-233(본편 콜); 캐시키 `chapters/chapter-cache.ts`
- 대운 flag/예시 기본값: `.env.example` L26-27(`OPENAI_INTERPRET_CHAPTERS=0`, IDS=`1-9`), L33(`TOTAL_REVIEW=0`)
- 오행 prod 호출 부재: `generateOhaengGuidance` 호출처 = `src/app/dev/saju-score/page.tsx` L12(+ `notFound()` prod 차단), 결정론만 사용
- 궁합 1콜(3~5섹션) + 게이팅: `src/app/api/interpret/compatibility/route.ts` L82-100; `compatibility/generate-compatibility-interpretation.ts` L46(max_out 1400), L98-123
- 궁합 prod 게이팅 UI: `src/app/compatibility/result/page.tsx` L120·L203(`isCompatibilityInterpretationLLMEnabled()`)
