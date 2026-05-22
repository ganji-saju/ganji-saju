# 대운 후처리·사용자 노출 텍스트 출처 확인 — 2026-05-22

> 측정 보고서 `audit-reports/2026-05-22-daewoon-diversity-measurement.md` §3 caveat("결정론 본문의 한자/용어가 사용자에게 실제 노출되는가?")의 검증.
> **방식**: read-only **코드 추적**. src/·scripts/·DB 변경 없음.
> ⚠️ 프로덕션 DB 직접 조회는 미실시 — `SUPABASE_SERVICE_ROLE_KEY`(민감 자격증명) + 실유저 PII 접근이라. 대신 코드로 "저장/후처리 여부"를 규명(아래 결과로 DB 샘플이 불필요함이 확인됨).

## 1. 후처리 LLM 함수 위치 + 호출 체인

- **정의**: `enhanceLifetimeChapter9WithLLM` — `src/server/ai/chapters/enhance-lifetime-chapter9.ts:45`
- **호출**: `src/server/ai/saju-lifetime-service.ts:899`
  - 체인: lifetime 리포트 생성 시 → `OpenAIChapterClient`로 LLM 시도 → 성공 시 결과 캐시(`ai_interpretations`, `chapterId=9`), 실패 시 결정론 fallback.
- **적용 범위 (핵심)**: 함수 주석/구현이 명시 — **"LLM 성공 시 `lifetimeStrategy.summary` 만 enhanced 본문으로 교체"**(line 39, 68-70: `{...lifetimeStrategy, summary: result.body}`).
  - 즉 후처리는 **챕터9 = '평생 전략' 합성 챕터의 summary 1개 필드**만 교체.
  - **`majorLuckTimeline`(대운 9~10 사이클)은 전혀 건드리지 않음.**

## 2. 사용자 노출 대운 텍스트 출처 추적

- **표시 경로**: `src/app/saju/[slug]/deep/page.tsx` 의 `CycleCard`.
  - 컴포넌트 주석(line 11-12): "hook / chapterTitle / chapterBody / mental / relationship / wealthCareer / practicalActions / closingNote + 12운성·원진·교운기 metadata 을 **그대로 노출**."
  - 렌더(line 203-307): `cycle.hook` · `cycle.chapterBody` · `cycle.mental` · `cycle.relationship` · `cycle.wealthCareer` · `cycle.closingNote` 를 **결정론 빌더 값 그대로** 출력.
  - `withKoreanGanzi(cycle.ganzi)`(line 106): **간지 *라벨*만** 한글 변환 — **본문(chapterBody 등)은 변환 대상 아님**.
- **DB 저장 여부**: `ai_interpretations` 테이블은 챕터9(`lifetimeStrategy.summary`)만 캐시. **대운 사이클은 저장 안 됨 → 요청마다 `buildLifetimeReport` 로 결정론 재생성.**
  - → "DB/캐시에서 뽑을 대운 샘플"이 **존재하지 않음**(저장 안 하므로). 결정론 출력이 곧 사용자 노출. **측정 보고서의 결정론 샘플 = 사용자 실제 노출 텍스트.**

## 3. 결론 (a / b / c)

**a) 후처리 LLM 존재 여부**: **Y (존재) — 단 대운 본문에는 미적용.**
`enhanceLifetimeChapter9WithLLM` 는 있으나 `lifetimeStrategy.summary` 1개 필드만 교체. 대운(`majorLuckTimeline`) 사이클 본문에는 **후처리가 일절 적용되지 않음** → 대운에 한해 사실상 **N**.

**b) 한자/용어 치환 여부**: **N (치환 없음).**
- LLM 후처리: 대운 본문 미접촉.
- 표시 컴포넌트: `chapterBody` 등 raw 렌더, `withKoreanGanzi` 는 간지 라벨 전용(본문 미적용).
- 결정론 빌더: 본문에 원시 한자 간지(`戊辰`)를 한글(`무진`)과 **중복 병기**한 채 생성 → 그대로 노출.

**c) 사용자 실제 노출 텍스트의 한자·용어 개수 (1샘플)**:
- **샘플: cycle 0 (戊辰, 2-11세, 710자)** → **한자 2건(`戊辰`) · 명리 전문용어 9건(`대운`·`천간`·`지지`)**.
  - 발췌: `"2-11세의 戊辰 대운은 … 무진 대운에는 천간의 토 · 지지의 토 결이 …"`
- 전체 10사이클 합산: **한자 20건 · 명리용어 78건** (측정 보고서와 동일).

---

## 한 줄 요약

> **대운 본문은 후처리·캐시·라벨변환 어디서도 한자/용어가 치환되지 않고 결정론 빌더 raw 가 사용자에게 그대로 노출됨(LLM 후처리는 챕터9 summary만 교체). 따라서 측정 보고서의 한자 20·용어 78은 *실제 사용자 노출* 수치 — caveat는 "노출됨"으로 확정.**

> read-only 확인 완료. 코드·DB 변경 없음. 보강(한자/용어 정리)은 Step 3 별도 지시서에서 결정.
