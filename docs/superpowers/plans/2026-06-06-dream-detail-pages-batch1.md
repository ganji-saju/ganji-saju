# 꿈해몽 상세페이지 확대 (Batch 1, 12개) Implementation Plan

> **For agentic workers:** 컨트롤러가 병렬 콘텐츠 생성 → 조립 → 테스트 게이트로 실행. 콘텐츠는 서브에이전트가 구조화 산출하고, 파일 편집은 컨트롤러가 단독 수행(충돌 방지).

**Goal:** 인기 해몽 12개의 10섹션 상세페이지를 신설하고 검색→상세를 배선해 DREAM_CONTENT를 9→21로 확대.

**Architecture:** 12개 본문을 병렬 서브에이전트가 구조화(JSON-유사) 산출 → 컨트롤러가 `dream-content.ts`/`free-content-pages.ts`/`dream-dictionary.ts` 3곳에 조립·배선 → 신설 테스트 + 의료법 게이트.

**Tech Stack:** TypeScript. 테스트 = `node:assert/strict` + 전역 `test()` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-06-06-dream-detail-pages-batch1-design.md`

---

## Task 1: 12개 콘텐츠 구조화 생성 (병렬 서브에이전트)

각 서브에이전트는 **1개 키워드**의 `DreamContentEntry`(10섹션) + `DreamEntry`(5필드)를
아래 골드 템플릿·제약에 맞춰 **텍스트로 반환만** 한다(파일 편집 금지).

**할당:** 돼지/pig-dream, 용/dragon-dream, 똥/feces-dream, 호랑이/tiger-dream,
불/fire-dream, 죽음/death-dream, 결혼/marriage-dream, 물고기/fish-dream,
집/house-dream, 시험/exam-dream, 아기/baby-dream, 피/blood-dream.

**작성자 제약(전원 공통):**
- 한자 0(본문 전 필드). 단정·보장·과장 금지(반드시/100%/완치/무조건/틀림없이 ✕).
  운세 톤("~경향/~수 있습니다/자주 해석됩니다").
- 네이밍정책 §12 금지패턴 미포함: `(새싹|햇살)\s+(기운|결|흐름)`, `[가-힣]+의\s*결…`,
  `…형\s*사주`, `결단과|안정과|열정과|시작과` 등.
- `relatedSlugs`는 다음 21개 화이트리스트에서만 2~3개: teeth-falling, snake-dream,
  water-dream, flying-dream, pregnancy-dream, money-dream, falling-dream,
  dead-relative-dream, pig-dream, dragon-dream, feces-dream, tiger-dream,
  fire-dream, death-dream, marriage-dream, fish-dream, house-dream, exam-dream,
  baby-dream, blood-dream.
- 길이: baseMeaning 3~4문장, situations 3~4개(각 heading+1~2문장), actionGuide 2~3개,
  faqs 2~3개(마지막 1개는 "어떤 운세를 함께 보면 좋나요?"류 — 오늘운세/타로/사주 안내).

골드 템플릿(snake-dream)·DreamEntry 예시는 spec/코드 참조.

- [ ] 12개 산출물 수집(컨트롤러). 누락·형식오류 시 해당 키워드만 재생성.

---

## Task 2: 3개 파일 조립·배선 (컨트롤러 단독)

- [ ] **Step 1:** `src/lib/dream/dream-content.ts`의 `DREAM_CONTENT` 객체 끝(마지막 항목 뒤)에
  12개 `DreamContentEntry`를 추가.
- [ ] **Step 2:** `src/lib/free-content-pages.ts`의 `DREAM_ENTRIES` 배열에 12개 `DreamEntry` 추가.
- [ ] **Step 3:** `src/lib/dream-dictionary.ts`의 해당 키워드 12개 엔트리에 `detailSlug: '<slug>'` 추가
  (각 키워드 객체 내, related/action 근처). 키워드: 돼지/용/똥/호랑이/불/죽음/결혼/물고기/집/시험/아기/피.
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20` → 신규 에러 0.

---

## Task 3: 검증 테스트 추가 (`src/lib/dream-dictionary.test.ts`)

- [ ] **Step 1:** DREAM_CONTENT 콘텐츠 정책 + 커버리지 테스트 추가:
```ts
test('DREAM_CONTENT 는 21개 이상이며 본문에 한자/금지어휘가 없다', () => {
  const slugs = Object.keys(DREAM_CONTENT);
  assert.ok(slugs.length >= 21, `DREAM_CONTENT ${slugs.length} 개 (>=21 기대)`);

  const HANJA = /[一-鿿]/;
  const FORBIDDEN: RegExp[] = [
    /(새싹|햇살|흙|쇠|물)의\s*결/g,
    /\b(새싹|햇살)\s+(기운|결|흐름)/g,
    /(반드시|100%|완치|무조건|틀림없이)/g,
  ];
  const findings: string[] = [];
  for (const [slug, e] of Object.entries(DREAM_CONTENT)) {
    const body = [
      e.oneLineSummary, e.baseMeaning, e.psychological, e.caution,
      ...e.situations.map((s) => `${s.heading} ${s.body}`),
      ...e.actionGuide,
      ...e.faqs.map((f) => `${f.question} ${f.answer}`),
    ].join(' ');
    if (HANJA.test(body)) findings.push(`${slug}: 한자 노출`);
    for (const p of FORBIDDEN) { p.lastIndex = 0; if (p.test(body)) findings.push(`${slug}: 금지어휘`); }
    for (const rel of e.relatedSlugs) {
      assert.ok(DREAM_CONTENT[rel], `${slug}: relatedSlug "${rel}" 미실재`);
    }
  }
  assert.deepEqual(findings, []);
});

test('신규 12 슬러그는 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳에 모두 존재한다', () => {
  const NEW = ['pig-dream','dragon-dream','feces-dream','tiger-dream','fire-dream',
    'death-dream','marriage-dream','fish-dream','house-dream','exam-dream',
    'baby-dream','blood-dream'];
  const entrySlugs = new Set(DREAM_ENTRIES.map((e) => e.slug));
  const linked = new Set(
    Object.values(DREAM_DICTIONARY).map((e) => e.detailSlug).filter(Boolean)
  );
  for (const s of NEW) {
    assert.ok(DREAM_CONTENT[s], `${s} DREAM_CONTENT 누락`);
    assert.ok(entrySlugs.has(s), `${s} DREAM_ENTRIES 누락`);
    assert.ok(linked.has(s), `${s} detailSlug 연결 누락`);
  }
});
```
(상단 import에 `DREAM_ENTRIES` 추가 필요: `import { DREAM_ENTRIES } from './free-content-pages';` — 이미 있으면 생략.)

- [ ] **Step 2:** `npm test` → 전체 PASS(신규 + 기존 교차검증 모두).

- [ ] **Step 3:** Commit:
```bash
git add src/lib/dream/dream-content.ts src/lib/free-content-pages.ts src/lib/dream-dictionary.ts src/lib/dream-dictionary.test.ts
git commit -m "feat(dream): 인기 해몽 12개 상세페이지 추가(9→21) + 검색→상세 배선"
```

---

## Task 4: 의료법 게이트 + 렌더 스모크 + PR

- [ ] **Step 1:** 조립된 실제 본문 전수를 `medical_compliance_checker`로 게이트(단정·과장·유인 0).
- [ ] **Step 2:** 렌더 스모크 — 대표 신규 slug 빌드/라우트 확인(throwaway 또는 기존 dream smoke 활용).
- [ ] **Step 3:** `npm test && npx tsc --noEmit -p tsconfig.json 2>&1 | head` → 전체 green.
- [ ] **Step 4:** PR:
```bash
git push -u origin feat/dream-detail-pages-batch1
gh pr create --base main \
  --title "feat(dream): 인기 해몽 12개 상세페이지 확대 (9→21)" \
  --body "spec/plan: docs/superpowers/specs|plans/2026-06-06-dream-detail-pages-batch1*

- 돼지·용·똥·호랑이·불·죽음·결혼·물고기·집·시험·아기·피 상세(10섹션) 신설
- DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳 배선 → 검색→상세 연결
- DREAM_CONTENT 한자/금지어휘 0 테스트 + 커버리지 가드 추가
- 의료광고법 게이트 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review
- 대상 12개 전부 spec과 일치, 기존 9와 중복 없음 ✓
- 3개 저장소(콘텐츠/카탈로그/사전) 동시 갱신 필요성 명시 ✓(라우트=DREAM_ENTRIES, 링크=detailSlug)
- 테스트: 한자/금지어휘/relatedSlug 정합/3곳 존재/커버리지 ✓
- 콘텐츠 충돌 방지: 서브에이전트는 산출만, 편집은 컨트롤러 단독 ✓
- 의료법 게이트 = 절대원칙 우선 ✓
- placeholder 없음(작성자 제약·테스트 코드 구체) ✓
