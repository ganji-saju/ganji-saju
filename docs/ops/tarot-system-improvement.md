This is a synthesis-only task. All inputs (research, audit, draft plan, skeptic verdicts) are provided. I'll merge them into one decision-ready Korean document, applying every valid skeptic objection. No file exploration needed since the skeptics already verified the code claims.

# ganji-saju 타로 개선 — 의사결정용 종합 문서

## 1. 한 줄 결론 + "타로 풀이가 '맞다'는 것의 정직한 정의

**무료 "한 장 타로"의 결정론 템플릿 엔진은 유지하되, 이미 코드에 잠들어 있는 자산(3-card spread 데드코드, 렌더 안 되는 78장 실제 Waite 의미)을 깨우고 정직성·안전 가드를 채워 craft-quality를 끌어올리는 것이 $0·고임팩트 경로다. AI는 옵트인 "한 번 더 묻기" 1턴에만 한정한다.**

타로 풀이는 **예측 적중으로 평가할 수 없다.** 통제된 반복연구 어디에도 타로가 우연 이상으로 미래를 맞힌다는 증거는 없고, 사용자가 느끼는 "정확함"은 Forer/Barnum 효과(동일 일반론에 평균 ≈84% "내 얘기" 평점, Forer 1948), subjective validation, confirmation bias로 완전히 설명된다. 따라서 ganji-saju가 측정·최적화할 대상은 *적중*이 아니라 **craft-quality 7차원** — 질문 관련성, 내적 일관성, (Barnum 아닌) 구체성, 실제 RWS 의미에 대한 충실성, 재현성, 안전성, 사용자 성찰을 끌어내는 resonance다. 달빛선생의 정직한 약속은 "미래를 맞힌다"가 아니라 "오늘의 흐름과 가능성을 비추고, 결정은 선생님께 돌려드린다"이며, 이 framing만이 entertainment 법적 방패·의료광고법 정합·정직성 가드와 동시에 일치한다.

---

## 2. 타로를 실제로 어떻게 보고/풀이하고/품질을 판단하는가 (연구 요약)

### 2-1. 리딩 절차 (RWS/Waite 정통)
| 단계 | 내용 | ganji-saju 대응 |
|---|---|---|
| ① 질문 프레임 | open-ended(What/How/Why), yes/no·"언제/될까"는 회피(agency 박탈) | `analyzeQuestion`의 silent reframe **이미 수행 — 보호 대상** |
| ② significator(선택) | 쿼런트 대표 court 카드, 현대엔 자주 생략 | 미적용(무방) |
| ③ 셔플·④ 컷 | 질문을 쥐고 3회(Waite) | seeded 키가 디지털 대체 — "셔플했다" 주장만 금지 |
| ⑤ 스프레드 배치 | 카드를 named position에 깔고 뒤집기 | 단일카드(현재)·3카드 엔진 존재 |
| ⑥ 읽기 | position 통과 → 카드끼리 대조(dignity) → synthesis | **synthesis 부재가 핵심 갭** |

출처: Biddy Tarot(질문 기술), Tarotsmith·PsychicScience(셔플/컷/Celtic), Labyrinthos·Learn Tarot(position).

### 2-2. 의미를 좁히는 funnel (핵심 기법)
```
[1]카드 核 → [2]문법(suit=원소×number=단계×court=인물/태도)
→ [3]position(슬롯이 묻는 질문) → [4]질문 도메인/의도
→ [5]이웃 카드(synthesis) → [6]agency(트레이드오프+오늘의 한 수)
```
- **suit→원소→영역**: Wands=불=의욕/행동, Cups=물=감정/관계, Swords=공기=생각/판단/갈등, Pentacles=흙=재물/현실. (엔진 `SUIT_THEMES`가 이미 인코딩, 오행 매핑까지 — 강점)
- **number=서사 단계**: Ace=씨앗 → 5=갈등 → 10=완성/과잉. (`VALUE_THEMES` 인코딩됨)
- **역방향 ≠ 단순 반대**: blocked/internalized/delayed/excess/resistance/opposite "메뉴"에서 질문으로 선택. wellness 톤엔 **strict-opposite 회피**, blocked/internalized 권장(Greer 12법).
- **Elemental Dignity**: same=증폭, friendly(불+공기/물+흙)=지지, contrary(불↔물/공기↔흙)=상쇄. ⚠️ 서구 4원소 ≠ 한국 5행 오행 — 카피 혼용 금지.

출처: Greer(*Tarot Reversals*, *Elemental Dignities*), Pollack, Labyrinthos, Anthony Louis/Corax(Golden Dawn), MJS Tarot(bridging).

### 2-3. 품질 루브릭 7차원 (accuracy 아님)
| # | 차원 | 평가 | 게이트 |
|---|---|---|---|
| D1 | 관련성 | 질문 intent/subject에 직답하는가 | 가중 0.30 |
| D2 | 일관성/무모순 | answer↔action 방향 충돌 없는가 | 가중 0.25 |
| D3 | 구체성(anti-Barnum) | 틀릴 수 있을 만큼 구체적인가 | 페널티 −0.15 |
| D4 | 카드 충실성 | 실제 meaning_up/rev·orientation 반영 | 가중 0.30 |
| D5 | 재현성 | 같은 질문+같은 날 = 같은 리딩 | **이미 통과(seeded)** |
| D6 | 안전 | 죽음·진단·투자·절대표현 없음, agency | **하드 게이트(pass/fail)** |
| D7 | resonance | 사용자 반응 | 약한 보조신호만(confirmation bias 상향편향) |

출처: Forer(skepdic/Wikipedia), Dickson&Kelly 1985(SAGE), 실무 기준(Daily Tarot Girl·Astroideal), 윤리(Spiral Sea·Teach Me Tarot·PullTarot), LLM-judge(Langfuse·G-Eval), entertainment 법리(FindLaw·First Amendment Encyclopedia — Texas는 "오락용" 서면고지 요구).

---

## 3. 현재 ganji-saju 타로 시스템 진단 (skeptic 재검증 반영)

### 이미 있는 것 (자산)
| 항목 | 위치 | 비고 |
|---|---|---|
| 78장 RWS 덱(영문 meaning_up/rev/desc) | `src/data/tarot-card-data.json` | 한글 0자 |
| 결정론 seeded 엔진(orientation 22% reversed) | `tarot-api.ts` `pickCard`/`pickOrientation` | D5 통과 |
| 질문 분석(domain/intent/subject/mood/tone) + silent reframe | `analyzeQuestion`(L414), `buildQuestionInsight`(L506) | **최대 강점** |
| 아키타입 테이블(MAJOR 21·SUIT 4·VALUE 14) | `tarot-api.ts` L125~ | 카피 생성원 |
| 3-card positional spread 엔진 | `getTarotSpreadForQuestion`(L786)·`buildSpreadPositions`(L673) | **데드코드** |
| 재사용 AI 인프라(`generateAiText` gpt-5.2, dialogue route, free-turn 선례) | `src/server/ai/openai-text.ts`, `ai-chat-access.ts` | tarot 미연동 |
| 타로→사주 funnel(sajuBlend, PaidFunnelGrid from=tarot) | `tarot-api.ts` L935, result page | 단방향 카피 |

### 없는 것 / 결함 (file:line)
| 결함 | 위치 | 심각도 |
|---|---|---|
| **The Hermit 룩업 누락** — 22장 중 21장만, generic+영문명 노출. (단 moonlight.ts:1391 orphan 카피는 **다른 스키마**라 paste 불가, 게다가 그 자체로 unused) | `MAJOR_CARD_NAMES`(L101-123)·`MAJOR_THEMES`(L134-259) | 실버그 |
| **78장 실제 Waite 의미가 렌더 0회** — `meaningExcerpt` 계산·truncate·저장 후 어느 UI도 미사용 | `tarot-api.ts` L827/857 | D4 핵심 |
| **모든 역방향 → `'blocked'` 단일 붕괴** — reversed Sun=reversed Tower | `getCardFlowState` L463 | D4 결함 |
| **3-card spread UI import 0** | grep exit 1 | 데드코드 |
| **참고용/entertainment disclaimer 전무** | `src/app/tarot/**` | 정직·법적 갭 |
| **option.intent 메타데이터 무시** — display-string일 뿐 enum 아님, 엔진이 regex 재유도 | `daily/page.tsx`·`analyzeQuestion` | 분류 부정확 |

> **Skeptic 정정 반영:** ① "Fortitude/Last Judgment 네이밍 드리프트"는 **존재하지 않음** — 덱 키(`Fortitude`/`The Last Judgment`)와 테이블 키가 이미 일치. ② "`앞으로의 방향에 대하여`가 direction 브랜치 도달불가"는 **거짓** — tone='direction'으로 도달함. **진짜 오라우트는** `지금 고민 중인 관계에 대하여`가 마음/연락/재회 키워드 부재로 intent='general'에 머물러 **DEFAULT 스프레드**로 빠지는 것. ③ 카드 차별화는 이미 일부 존재 — `tarot-api.test.ts:170`이 cups.answer≠swords.answer 보증. Barnum 위험은 **같은 suit+같은 flow 버킷 충돌 / 같은 flow 두 메이저 충돌**로 한정.

---

## 4. 개선안

### (A) 풀이 깊이

| ID | 무엇/왜 (연구근거) | 현재 갭·파일 | 구현 | 공수 | 리스크 | 반영 | 제약 |
|---|---|---|---|---|---|---|---|
| **A1** | Hermit 룩업 추가 — 메이저 1장 degrade는 즉시 D4 실패 (RESEARCH §4) | `MAJOR_THEMES`/`MAJOR_CARD_NAMES` 21/22 | Hermit행 **신규 작성**(orphan 1391은 스키마 달라 paste 불가). 22/22 키 커버리지 단위테스트(드리프트 주장은 폐기, Hermit 갭은 잡음) | S | 낮음 | ✅ | $0·가드OK·결정론 |
| **A2** | 78장 한글 카드 의미 데이터셋 — 56마이너 차별화 근본해법, D4 진짜 통과 (AUDIT "richest data discarded") | `meaningExcerpt` 렌더 0회 | **수작업 78×2 한글 1~2문장**(`tarot-card-ko.ts`, key=name_short) → "이 카드가 말하는 것" 섹션 렌더. 영문 직노출 금지 | L | 중(분량·품질, **렌더 출력으로 검증** MEMORY) | ✅ | $0·가드OK·결정론 |
| **A3** | 역방향 메뉴화(blocked→intent별) — "상대 마음"엔 internalized가 정확 (RESEARCH §4) | `getCardFlowState` L463 | L463 제거→ feelings/other=internalized, decision/timing=delayed, 그 외 blocked. `buildCardAction`/`buildDirectAnswer` 역방향 분기 확장 | M | 중(회귀 — B3 안전망) | ✅ | $0·가드OK·결정론 |
| **A4** | 3-card spread UI 연결 + synthesis 1문단 — synthesis가 Barnum 격파, single-card 불가 (RESEARCH takeaway #1) | 데드코드. ⚠️ **replay는 URL param 재유도**(reading_json 아님) | (4a) 옵트인 CTA `?spread=3`. (4b) 신규 `buildSpreadSynthesis`(원소+숫자진행+Major/Minor). **(4c) replay: URL이 3 cardId 운반하도록 확장 또는 reading_json을 source-of-truth로 전환(=C3와 동일 작업)** | L | 중(replay 회귀 — E2E 필수) | ⚠️ | $0·가드OK·결정론·스냅샷주의 |
| **A5** | Elemental Dignity 레이어 — 고신뢰·$0 differentiator (RESEARCH §5) | dignity 계산 없음 | suit→원소 상수 + 인접쌍 same/friendly/contrary → A4 synthesis에 1절. ⚠️ 4원소≠오행 분리 voice | S | 낮음 | ⚠️(A4 의존) | $0·가드OK·결정론 |
| **A6** | 큐레이션 질문 정확 라우팅 (RESEARCH §1/§5) | option.intent는 **display-string, enum 아님** | 각 옵션에 **typed enum 필드 신규 추가** + string→enum 매핑 + 자유입력은 regex fallback. 실수정 대상은 `지금 고민 중인 관계` DEFAULT 오라우트 | **S→M↑** | 낮음 | ✅ | $0·가드OK·결정론 |
| **A7** | 카드 image hook anti-Barnum — answer가 카드 정체성에 반응 (RESEARCH §3/§6) | answer=intent×flow ~30 body. (단 cross-suit는 이미 차별, test:170) | A2 데이터셋에 image hook 1구 포함 → `buildDirectAnswer` 합성. **범위: 같은 suit+flow / 같은 flow 두 메이저 충돌만** | M | 중(품질) | ⚠️(A2 선행) | $0·가드OK·결정론 |
| **A8** | 질문 reframe formalize — 엔진 최대강점 보호 (RESEARCH §5) | 회귀방지 없음 | "반드시/무조건/운명" 금지·"가능성/흐름/선생님의 선택" 선호를 B-gate에 codify | S | 낮음 | ✅ | $0·가드OK·결정론 |

### (B) 품질/검증 — 전부 오프라인 CI ($0 런타임)

| ID | 무엇/왜 | 갭·파일 | 구현 | 공수 | 반영 |
|---|---|---|---|---|---|
| **B1** | 안전 렉시콘(D6 하드게이트) — entertainment 방패+의료광고법 정합 | 정직성 가드가 **reading 카피 emit 파일 미스캔** | `public-commercialization-copy.test.ts`에 운세과장 렉시콘(죽음·시한부·진단·종목·반드시·무조건·운명) + **`tarot-api.ts`·result page를 스캔 리스트에 추가** | S | ✅ |
| **B2** | Barnum 탐지기(D3) | 헤지 과용("…다기보다 전환점","단정하기보다", fallback "큰 흐름과 전환") | `{질문×78×2}` 매트릭스 헤지비율 임계, **리트머스: 같은 문장이 다른 카드에 붙는가** | M | ✅ |
| **B3** | 모순 탐지기(D2) | push/hold polarity | answer↔action 반대극 검출 — A3 회귀 안전망 | S | ✅ |
| **B4** | Faithfulness(D4, 명칭 내부전용) | L463 결함 | A2 도입 후 자명 통과. 1차는 "reversed Sun≠reversed Tower" assert. ⚠️ **'정확/적중' UI 노출 금지** — fidelity-to-source지 fidelity-to-future 아님 | M | ⚠️(A2/A3) |
| **B5** | D5 골든파일 회귀 / D7 약한신호 | seeded | D5 codify(#428~431 패턴). D7=confirmation bias 상향편향 → 단독지표 금지 | S/M | ✅/⚠️(DB) |
| **B6** | entertainment+agency disclaimer | 전무 | *"오늘의 타로는 마음을 정리하는 참고용 메시지입니다. 결정은 늘 선생님의 몫이에요."* result §3. ⚠️ **result page를 `PUBLIC_CORE_COPY_FILES`에 추가**해야 가드가 회귀 방지 | S | ✅ |

### (C) 결정론 템플릿 vs AI — 판정: 무료 플로우는 결정론, AI는 옵트인 1턴

| 축 | 결정론 | AI per-reading |
|---|---|---|
| 비용 | $0 ✅ | ungated $ 노출 ❌ |
| 결정론 | 유지 ✅ | seed/cache 없으면 깨짐 ❌ |
| 정직가드 | 정적 커버 | **정적 미커버 — 런타임 validator 필수** |
| 안전 | 자유입력 0 | detectSafeRedirect **필수(블로킹)** |

- **C1(P2):** 결정론 템플릿을 grounding으로 "달빛선생에게 한 번 더 묻기" 옵트인 → today-fortune `result_intro_free` 패턴 미러. 스냅샷/세션당 **AI 1턴 무료**, 이후 코인 빌링. ⚠️ free-turn ledger는 today-fortune scope — **tarot 신규 scope/row = DB 변경, Supabase CLI 수동**(MEMORY).
- **C2:** AI 호출 시 `detectSafeRedirect`(위기) + 비단정 validator + 기존 위기자원 렉시콘(moonlight.ts L767-809 자살예방 109/988 등) **재사용 — 블로킹 전제조건**.
- **C3:** 비결정 출력은 reading_json을 replay source-of-truth로 전환(=A4c와 동일 리팩터).
- **C4:** tarot question+card를 dialogue route `from/sourceSessionId/concernId`로 전달 → 사주 funnel 강화.

**판정:** ⚠️ feasible-with-caveat. 인프라 준비됨. **P0/P1엔 안 함**(결정론 깊이가 더 싸고 안전). AI는 결정론 한계 도달 후 P2.

---

## 5. 추천 로드맵

**P0 — 싸고·고임팩트·순수 결정론 ($0·가드OK·결정론):**
1. **A1** Hermit 룩업 + 22/22 커버리지 테스트 (S, 즉시 버그 제거)
2. **B6** entertainment+agency disclaimer 1줄 + result page를 가드 스캔 리스트 추가 (S, 법적 방패·현재 전무)
3. **B1** 안전 렉시콘 확장 + **tarot-api.ts/result page 스캔 포함** (S)
4. **A6** 큐레이션 질문 typed-enum 라우팅 (S→M, `지금 고민 중인 관계` DEFAULT 오라우트 해소)
5. **A3** 역방향 메뉴화(L463 fix) (M, D4 결함 제거)
6. **B3/B2** 모순·Barnum 탐지기 오프라인 CI (S/M, A3 회귀 안전망)
7. **A8** reframe formalize (S, B-gate에 흡수)

**P1 — 깊이의 본체 (결정론, 작성 비용 L):**
8. **A2** 78장 한글 카드 의미 데이터셋 + 렌더 (L, **렌더 출력으로 검증**)
9. **A7** 카드 image hook (M, A2 부산물 — 충돌 범위 한정)
10. **B4/B5** faithfulness·골든파일 codify (M)
11. **A4+A5** 3-card spread UI + synthesis + dignity (L, **replay=URL param이라 3 cardId 확장 or reading_json 전환 필수·E2E 필수**)

**P2 — AI 하이브리드 (옵트인, 비용 캡):**
12. **C1~C4** "한 번 더 묻기" 무료 1턴 + 코인 빌링 + safety/비단정 validator(블로킹) + replay source-of-truth + 사주 funnel. ⚠️ DB scope 추가 = Supabase CLI 수동.

---

## 6. 절대 하지 말 것 (overclaim·pseudoscience·가드 위반)

- [ ] **"정확한 타로/예측 적중/맞힘" 마케팅** — 경험적 indefensible + entertainment 방패 무력화 + 의료광고법 과장광고 리스크. "흐름·가능성"만.
- [ ] **synthesis/dignity 카피에 예언·운명 어휘** — "세 카드가 운명을 가리킨다", "결국 ~할 것입니다", "~예정되어" 금지. **positional/reflective framing만**("과거 자리의 X가 지금 자리의 Y로 이어지는 이야기"). **synthesis는 'no predictive/fated language'를 하드 CI assert로**.
- [ ] **무거운 카드 doom 종결** — Death/Tower/Devil/Moon/10·9·3 Swords + 모든 역방향은 **agency/회복으로 마감**, finality 금지(moonlight.ts:1354 "끝이 아니라 새로운 시작" 기준선). **렌더 출력으로 검증**, doom 토큰이 agency 절 없이 끝나면 B-gate 실패.
- [ ] **결정론 깨는 무캐시 AI를 무료 플로우에 투입** — $ 노출 + D5 위반. AI는 옵트인 1턴+캐시만.
- [ ] **AI 턴에서 detectSafeRedirect 생략** — 위기/의료/투자 입력에 카드 리딩 응답 금지. **블로킹 전제조건**.
- [ ] **'준비 중/로딩중/placeholder/TODO' 신규 카피** — 정직성 가드 위반('출시 예정'은 허용).
- [ ] **4원소(서구)와 5행(오행) 혼용** — sajuBlend voice 분리.
- [ ] **B4 'faithfulness'를 '정확/적중'으로 UI 노출** — 내부 CI 지표(fidelity-to-source-text)일 뿐, 미래 적중 아님.
- [ ] **D7(thumbs)을 단독 품질지표로** — confirmation bias 상향편향, 약한 보조신호만.

---

## ✅ P0 1차 반영 완료 (2026-06-21) — "버그수정 + 정직성"

| ID | 변경 | 파일 | 검증 |
|---|---|---|---|
| **A1** | Hermit(은둔자) 메이저 룩업 추가 — 22/22 커버리지. 이전: bare 영문 `The Hermit` 노출 | `tarot-api.ts` `MAJOR_CARD_NAMES`·`MAJOR_THEMES` | 렌더 `은둔자 · The Hermit` 확인 + 회귀테스트(메이저 전부 한글 시작) |
| **A3** | 역방향 단일 `'blocked'` 붕괴 제거 → `getUprightFlowState` 도출 후 카드별 역방향 변환(open→guarded 등). upright 동작 100% 보존 | `tarot-api.ts` `getCardFlowState` L469 | 렌더 reversed Sun≠Tower 확인 + 회귀테스트 |
| **B6** | result 페이지에 entertainment+agency 면책문구 추가("참고용 메시지…선택은 당신의 몫") | `result/page.tsx` §3 하단 | 렌더 노출 확인 |
| **B1** | 안전 게이트 — 생성 풀이 출력(78×2×질문5)에 예측적중·의료·재정·doom 어휘 0 검증. 카드명 오탐 피해 소스 아닌 **출력** 검사 | `tarot-api.test.ts` 신규 | 통과(현 템플릿 클린) |
| **B6+** | 정직성 가드 스캔에 tarot 3개 페이지 추가(이전 미커버) | `public-commercialization-copy.test.ts` `PUBLIC_CORE_COPY_FILES` | 통과 |

**검증 종합**: tsc 클린 · 유닛 fail 0(신규 3 test ok) · next build 성공(256 페이지, 타로 4라우트).

**다음(미반영)**: A6 질문 typed-enum 라우팅 · A2 78장 한글 의미 데이터셋(P1) · A4 3카드 스프레드 UI(P1) · C1 옵트인 AI 1턴(P2, DB scope=Supabase 수동).

---

## ✅ P1 1차 반영 완료 (2026-06-21) — A2 78장 한글 카드 의미

56장 마이너 카드가 제너릭하게 느껴지던 근본 원인(실제 RWS 의미가 렌더 0회) 해결.

| 항목 | 내용 |
|---|---|
| 데이터셋 | `src/data/tarot-card-meanings-ko.ts` 신규 — 78장×정역(156개) 한글 의미. 영문 Waite 원전을 소스로 **새로 집필**(직역 아님), 달빛선생 보이스·anti-Barnum·안전(doom/과장 0)·정역 분화. 길이 46~78자 |
| 생성 방식 | 11에이전트 워크플로(5그룹 병렬 집필 → 그룹별 적대 검증 → 8장 재집필). 키는 카드명 매칭으로 실제 덱 `name_short`(waac/wapa 등)에 정합 |
| 연결 | `tarot-api.ts`: `getTarotCardMeaningKo()` import, `TarotReading.cardMeaning` 필드 추가(한글 우선, 누락 시 영문 폴백). result page §3에 **"이 카드가 말하는 것 [정/역방향]"** 섹션 렌더 |
| 테스트 | A2 회귀: 78장 정/역 모두 한글·정역 분화·고유성(distinct 78) 검증. B1 안전 게이트 surface에 cardMeaning 포함 |
| 검증 | tsc 클린 · 유닛 fail 0 · 렌더 출력 확인(wapa 정/역, Death 역방향=회복 마감) |

**남은 P1**: A4 3카드 스프레드 UI 연결+종합(replay=URL param 구조 변경 필요). **P2**: C1 옵트인 AI 1턴.

---

## ✅ P1 2차 반영 완료 (2026-06-21) — A4 3카드 스프레드 심화뷰

데드코드였던 `getTarotSpreadForQuestion` 엔진을 활성화. **질문 시드 기반**(사용자 결정)이라 replay는 `?question=X`로 자명 — DB·스냅샷 변경 0.

| 항목 | 내용 |
|---|---|
| 종합 서사 | `buildSpreadSynthesis()` 신규 — 3 포지션을 잇는 한 문단. **포지션 흐름**(현재→원인→조언) + 카드 구성 읽기(메이저 다수/단일 수트/혼합) + **주체성 마감**. 예언·운명·doom 어휘 0(하드 테스트). 짧은 테마(major=고유, minor=수트)·`withRoParticle` ㄹ예외 조사 처리 |
| 엔진 | `getTarotSpreadReadingForQuestion()` — 기존 스프레드 엔진 + synthesis. 질문 시드 결정론(같은 질문=같은 스프레드) |
| 라우트 | `src/app/tarot/daily/spread/page.tsx` 신규 — 3 포지션(카드 face+한글 의미+정역 배지) + 종합 + 면책문구 + 액션 |
| CTA | result 페이지에 "세 장으로 더 깊이 보기 →"(`?question=X` 전달). 단일카드 '뽑기' 의식은 그대로 유지 |
| 테스트 | A4: 결정론·세 포지션 모두 언급·주체성 마감·예언/운명/doom 어휘 0(5질문). 정직성 가드에 spread page 추가 |
| 검증 | tsc 클린 · 유닛 fail 0 · next build 성공 · 렌더 출력 확인(조사 버그 2건 수정: 판단를→판단을, 재물으로→재물로) |

**남은**: A4 pick-3 모델(별도, 큰 작업) · **P2 C1** 옵트인 AI 1턴(DB scope=Supabase 수동).