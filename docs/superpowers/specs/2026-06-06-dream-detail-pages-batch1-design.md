# 꿈해몽 상세페이지 확대 (Batch 1, 12개) 설계

- 날짜: 2026-06-06
- 상태: 설계 확정 (구현계획 작성 대기)
- 상위 로드맵: `2026-05-24-content-enhancement-roadmap.md` 영역3 — 검색↔상세 연결의 "상세 커버리지" 확대
- 기준 main: #410 머지 이후

## 1. 배경 / 문제

꿈 사전 `DREAM_DICTIONARY`는 306 키워드인데, 풍부한 10섹션 상세페이지
(`DREAM_CONTENT`)는 **9개뿐**. 대부분의 검색은 사전 카드만 보고 "자세히 풀어보기"
버튼이 없어 깊이 체감이 낮다(로드맵 "콘텐츠가 단순한 느낌"). 인기 해몽 12개에
상세페이지를 추가해 커버리지를 9→21로 확대한다.

## 2. 목표 / 비목표

**목표**: 고전 고검색 해몽 12개의 상세페이지 신설 + 검색→상세 연결 배선.
**비목표(YAGNI)**: LLM 개인화 해석(로드맵 D4 제외), 검색 알고리즘 변경(#410 완료),
사전 키워드 추가(이미 306).

## 3. 대상 12개 (전부 사전 존재·detailSlug 미설정 확인됨)

| 키워드 | slug | 분류 | fortune |
|---|---|---|---|
| 돼지 | `pig-dream` | animal | 길몽 |
| 용 | `dragon-dream` | animal | 길몽 |
| 똥 | `feces-dream` | object | 길몽 |
| 호랑이 | `tiger-dream` | animal | 길몽 |
| 불 | `fire-dream` | nature | 길몽 |
| 죽음 | `death-dream` | action | 길몽 |
| 결혼 | `marriage-dream` | action | 길몽 |
| 물고기 | `fish-dream` | animal | 길몽 |
| 집 | `house-dream` | object | 길몽 |
| 시험 | `exam-dream` | action | 중립 |
| 아기 | `baby-dream` | person | 길몽 |
| 피 | `blood-dream` | object | 길몽 |

(기존 9 slug: teeth-falling, snake-dream, water-dream, flying-dream,
pregnancy-dream, money-dream, falling-dream, dead-relative-dream — 중복 없음.)

## 4. 데이터 구조 (3개 저장소 동시 갱신, 엔트리당)

### 4.1 `DREAM_CONTENT` (src/lib/dream/dream-content.ts) — 10섹션 `DreamContentEntry`
```ts
{
  slug, title, oneLineSummary,
  baseMeaning,                       // 3~4문장, 한자 0
  situations: [{heading, body} × 3~4],
  psychological,                     // 무의식/심리 관점
  actionGuide: [string × 2~3],
  caution,                           // "한 가지로 단정 말라" 메타가이드
  relatedSlugs: [기존/신규 slug 중 실재하는 것 2~3],
  faqs: [{question, answer} × 2~3],  // schema.org FAQPage
}
```
골드 템플릿 = 기존 `snake-dream` 엔트리(품질·톤·길이 기준).

### 4.2 `DREAM_ENTRIES` (src/lib/free-content-pages.ts) — 카탈로그 `DreamEntry`
```ts
{ slug, title, summary, meaning, action }
```
이 배열이 라우트(`generateStaticParams`)와 목록을 구동 → **반드시 추가**해야 상세
라우트가 생성됨.

### 4.3 `DREAM_DICTIONARY` (src/lib/dream-dictionary.ts) — `detailSlug` 배선
대상 키워드 12개 엔트리에 `detailSlug: '<slug>'` 추가 → 검색 카드의
"이 꿈 자세히 풀어보기" 노출 + 테스트(모든 DREAM_CONTENT slug은 ≥1 키워드 연결) 충족.

## 5. 콘텐츠 제약 (테스트·정책 강제)

- **한자 0**: 본문(oneLineSummary/baseMeaning/situations/psychological/actionGuide/
  caution/faqs)에 한자(`[一-鿿]`) 금지. (keyword/hanja 식별필드는 사전 측, 본 작업 무관.)
- **네이밍정책 §12 금지어휘 0**: `FORBIDDEN_PATTERNS`(예: `(새싹|햇살)\s+(기운|결|흐름)`,
  `[가-힣]+의\s*결…`, `…형\s*사주` 등) 미포함.
- **단정·보장·과장 금지(의료법 하우스가드)**: "반드시/100%/완치/무조건/틀림없이" 등 배제.
  운세 톤 "~경향/~수 있습니다/자주 해석됩니다".
- **relatedSlugs 정합성**: 전부 실재 DREAM_CONTENT slug(기존 9 + 신규 12 = 21 풀 내).
- **길이**: baseMeaning ≥ 80자 수준(골드 템플릿 기준), situations 각 1~2문장.

## 6. 테스트 전략

기존 교차검증(detailSlug→DREAM_CONTENT 실재, 모든 DREAM_CONTENT slug 연결됨,
DREAM_DICTIONARY 금지어휘)은 자동 적용. 추가:
- **DREAM_CONTENT 한자 0 + 금지어휘 0** 테스트 신설(현재는 DREAM_DICTIONARY 본문만 검사).
- **DREAM_CONTENT slug 수 ≥ 21** 회귀 가드.
- **12 신규 slug 각각 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳 모두 존재** 단언.
- 렌더 출력 검증(메모 교훈): 상세 라우트가 신규 slug에서 200·핵심 섹션 노출(스모크).

## 7. 의료광고법 게이트
운세 콘텐츠 — 시술/치료 아님(부작용 표기 비대상). 단정·과장·유인 0 확인.
조립된 실제 본문 전수를 `medical_compliance_checker`로 최종 게이트.

## 8. 실행 방식 (구현 노트 — plan에서 상술)
12개 본문은 병렬 서브에이전트가 **구조화 산출물로 생성**(파일 직접 편집 X, 충돌 방지)
→ 컨트롤러가 3개 파일에 조립 → 테스트 + 의료법 게이트 → PR.

## 9. 리스크 / 가정 붕괴 조건
- **리스크**: 생성 콘텐츠의 한자/금지어휘/단정 혼입. → 신설 테스트 + 의료법 게이트로 차단,
  위반 시 해당 엔트리 재생성.
- **리스크**: relatedSlugs가 미실재 slug 지목. → 21개 화이트리스트로 한정.
- **가정**: 12 키워드가 사전에 존재·detailSlug 미설정(확인 완료).
