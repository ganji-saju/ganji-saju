# 콘텐츠 보완 로드맵 — 궁합 · 띠운세 · 꿈해몽

- 날짜: 2026-05-24
- 상태: 검토 대기 (영역별 구현은 각 영역 detail plan 승인 후)
- 기준: 현재 main `97d4399`

세 영역 모두 "콘텐츠가 단순/안 바뀐 느낌" 문제. 본 문서는 영역별 **현황 · 권고 접근 · 결정 필요 · 순서**를 제시한다. 각 영역은 본 로드맵 승인 → 영역별 상세 구현계획(writing-plans) → 구현 순으로 진행한다.

---

## 영역 1 — 궁합 (compatibility)

### 현황/진단
PR #345가 "깊은 풀이(LLM)"를 추가했으나 **사실상 비활성**:
- LLM은 `OPENAI_INTERPRET_COMPATIBILITY === '1'` 일 때만 작동(`src/server/ai/compatibility/compatibility-interpretation-cache.ts:28`). **기본 OFF**, `.env.example`에도 미기재 → 프로덕션 Vercel env에 없으면 한 번도 안 돎.
- 결과: 무료·**990원 결제자 모두** 결정론 fallback `buildDeterministicDeepSections`(`src/lib/compatibility.ts`)를 보는데, 이게 **무료 4축 풀이에 접두어만 붙인 재포장** → "추가는 됐는데 안 바뀐 느낌"의 직접 원인.
- 핵심 파일: `src/features/compatibility/compatibility-result-view.tsx`(§8 deep), `compatibility-deep-sections.tsx`(LLM 비동기), `src/server/ai/compatibility/*`, `src/app/api/interpret/compatibility/route.ts`, `src/lib/payments/compatibility-access.ts`.

### 결정 필요
- **D1:** 프로덕션에서 LLM을 켤지(OpenAI 호출 비용↑·품질↑) vs 결정론 fallback만 개선 vs 둘 다.

### 범위 · 순서
1. 프로덕션 env 점검 → (켤 경우) `OPENAI_INTERPRET_COMPATIBILITY=1` 설정 + `.env.example`에 플래그 문서화.
2. `buildDeterministicDeepSections` 재작성 — 두 일간 조합·점수대 분기 텍스트로(LLM OFF여도 무료와 차별). **← LLM 비용 없이 즉시 효과**.
3. LLM 출력 분량/섹션 확대(`generate-compatibility-interpretation.ts`의 MAX_OUTPUT_TOKENS/섹션 수) + 검증 실패→fallback 계측 로깅(`compatibility-interpretation-validator.ts`).
4. 무료↔유료 시각 차별 + `source==='llm'`일 때 "두 분 맞춤 풀이" 배지(`compatibility-deep-sections.tsx`).

---

## 영역 2 — 띠운세 (연생별 확장)

### 현황
12띠 정적 데이터(`src/lib/free-content-pages.ts`의 `ZODIAC_FORTUNES`), 띠당 ~4문장(summary/todayFocus/action + yearlyMessage), 점수는 시드 자동생성. **연생 분기 없음** — `years`는 "이 띠 해당 연도 목록" 표시용 문자열일 뿐. 페이지: `src/app/zodiac/[slug]/page.tsx`(12개 정적 라우트).
**유리한 점:** 띠 판별이 사주 엔진과 연결(`deriveZodiacSlugFromBirthInput` @ `src/lib/profile-personalization.ts`) → 연주 **천간까지** 구분 가능(닭띠 57/69/81/93/05 = 乙酉/辛酉/癸酉… 간지 조합) → 연생별 풀이 산출 토대 있음.

### 결정 필요
- **D2:** 연생별 콘텐츠 소스 — (A) 정적 수기 작성(품질↑·작성량↑) / (B) LLM 생성→정적 캐시(작성량↓·검수 필요) / (C) 사주 엔진 동적(개인화↑·엔진작업↑). 권고: **A+C 하이브리드**.
- **D3:** 띠당 연생 개수/범위(예: 현존 세대 ~5-6개 연생; 매년 신규 연생 갱신 정책).

### 범위 · 순서
1. 데이터 모델 확장 — `ZodiacFortune`에 `byYear?: Record<number, {...}>` 중첩 + **닭띠 6연생 파일럿** 콘텐츠.
2. UI — 연생 선택 칩 + `?birthYear=` 쿼리파라미터 분기(기존 `?period=` 패턴 재사용 → **라우트 폭증 없음**, `generateStaticParams` 12개 유지).
3. 점수/일진을 연주 천간별 시드 분기(개인화 체감).
4. 검증 후 나머지 11띠 × 연생 콘텐츠 확충(정적 또는 LLM 생성→캐시, D2 결정 따름).

---

## 영역 3 — 꿈해몽 (풍부화)

### 현황
100% 정적, LLM 없음. **두 데이터 소스가 분리·미연결**:
- 검색사전 `DREAM_DICTIONARY`(**33키워드**, `src/lib/dream-dictionary.ts`) — 자유텍스트 검색(`src/app/dream/page.tsx` + `src/app/api/dream/search/route.ts`).
- SEO상세 `DREAM_CONTENT`(**단 8개 slug**, 10섹션 풍부, `src/lib/dream/dream-content.ts` + `src/app/dream-interpretation/[slug]/page.tsx`).
- 검색 결과 → 상세로 가는 링크 없음. 기존 자산: `/dialogue/snake`(꿈뱀선생) 대화형 기능.

### 결정 필요
- **D4:** LLM 개인화 해석(단계 5)을 이번 범위에 포함할지 vs 정적 확충·연결 위주.
- **D5:** 사전 확충 목표 규모(예: 33 → 200+).

### 범위 · 순서 (쉬운→어려운)
1. **(易)** 검색↔상세 연결 + 데이터 단일화(검색 33개에 slug 매핑).
2. **(易~中)** 사전 33→200+ 키워드 확충(순수 데이터, 저위험).
3. **(中)** 길몽/흉몽 뱃지 + 카테고리 필터 + 행동가이드(상세의 enriched 구조를 검색으로 확장).
4. **(中)** 검색 정확도 — 한글 자모/동의어/초성.
5. **(難·선택)** LLM 개인화 해석 — `/dialogue/snake` 자산 활용 + 사주/오늘운세 연동.

---

## 전체 권고 우선순위

1. **궁합 — 결정론 fallback 재작성(영역1 #2)**: LLM 비용 없이 즉시 체감, 이미 결제자 존재. (+ D1에서 LLM ON 결정 시 #1 병행)
2. **꿈해몽 1–2단계(연결 + 사전 확충)**: 쉬움·저위험·체감 큼.
3. **띠운세 연생별 파일럿(닭띠)** → 검증 후 전체 확충.

## 검토 시 확정할 결정 (D1~D5)
- D1 궁합 LLM ON 여부 · D2 띠운세 콘텐츠 소스 · D3 연생 범위 · D4 꿈해몽 LLM 포함 여부 · D5 사전 확충 규모.

## 의료광고법 주의
세 영역 모두 운세 콘텐츠 — 단정·과장·치료성 표현 금지(naming-policy/의료법 가드 준수). LLM 도입 시 기존 챕터 검증기(`validate*`) 패턴 재사용.
