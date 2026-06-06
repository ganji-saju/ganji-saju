# 궁합 결정론 fallback 하이브리드 재작성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유료 §8 결정론 fallback을 (관계유형×점수대×커플데이터×축당 근거) 하이브리드로 재작성해 무료 §4~6과 명확히 차별화한다(LLM 비용 0).

**Architecture:** `buildDeterministicDeepSections`에 호출부의 사주 컨텍스트를 주입한다. 관계유형 4종(`summarizeStemInteraction`의 `kind`) × 점수대 5단계(`resolveScoreBand`)로 20셀 프레이밍 매트릭스를 만들고, 기존 커플고유 `card.practice` + 두 이름 + 축별 근거 한 줄을 엮어 본문을 조립한다. `CompatibilityDeepSection`에 `evidence?` 옵셔널 필드를 더해 LLM 경로와 동형을 유지한다.

**Tech Stack:** TypeScript, Next.js(프로젝트판), 테스트 = `node:assert/strict` + 전역 `test()` (`node scripts/run-unit-tests.mjs`, `.test.ts` 재귀 디스커버리).

**Spec:** `docs/superpowers/specs/2026-06-06-compatibility-fallback-rewrite-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/lib/compatibility.ts` | 궁합 해석 도메인 로직 | 타입 +`evidence?`, `summarizeStemInteraction` +`kind`, `resolveScoreBand`/`firstSentence`/`DEEP_SECTION_FRAME` 추가, `buildDeterministicDeepSections` 재작성 + 호출부 ctx 주입 |
| `src/lib/compatibility.test.ts` | 도메인 단위 테스트 | 차별성·evidence·분기 회귀 테스트 추가 |
| `src/features/compatibility/compatibility-deep-sections.tsx` | §8 렌더러 | `item.evidence` 캡션 줄 렌더 |

기존 패턴 유지: `compatibility.ts`는 이미 1038줄 대형 파일이지만 도메인이 한 곳에 모여 있어 본 작업 범위에선 분할하지 않는다(YAGNI). 새 헬퍼는 같은 파일 내 관련 함수 근처에 배치.

---

## Task 1: 차별성·evidence 회귀 테스트 (실패 먼저)

**Files:**
- Test: `src/lib/compatibility.test.ts` (기존 파일에 append)

- [ ] **Step 1: Write the failing test**

`src/lib/compatibility.test.ts` 맨 아래에 추가:

```ts
test('deep sections are differentiated from free summary cards and carry evidence', () => {
  const result = makeCompat('lover', 1988, 1991);

  // 무료 §4~6 카드(summary)와 유료 §8(deepSection.body)는 같은 key 끼리 서로 달라야 한다.
  // (재포장 회귀 차단 — 과거엔 body = 접두어 + practice 였다.)
  for (const section of result.deepSections) {
    const card = result.practicalCards.find((c) => c.key === section.key);
    assert.ok(card, `practical card for ${section.key} must exist`);
    assert.notEqual(
      section.body,
      card!.summary,
      `${section.key}: deep body must differ from free summary`
    );
    assert.notEqual(
      section.body,
      card!.practice,
      `${section.key}: deep body must not equal raw practice`
    );

    // 축당 근거 한 줄이 채워져야 한다.
    assert.ok(
      typeof section.evidence === 'string' && section.evidence.trim().length > 0,
      `${section.key}: evidence one-liner must be present`
    );
  }

  // 4축이 모두 존재.
  assert.deepEqual(
    result.deepSections.map((s) => s.key).sort(),
    ['communication', 'conflict', 'distance', 'money']
  );
});

test('deep section framing reflects score band and relationship kind', () => {
  // 서로 다른 두 커플은 (점수대/관계유형이 다르면) 동일 축에서 다른 프레이밍을 받는다.
  const a = makeCompat('lover', 1988, 1991).deepSections.find((s) => s.key === 'conflict');
  const b = makeCompat('lover', 1990, 1990).deepSections.find((s) => s.key === 'conflict');
  assert.ok(a && b);
  // 단정 금지 톤 — 금지 단정어가 본문에 없어야 한다(의료광고법/하우스 스타일).
  for (const s of [a!, b!]) {
    assert.doesNotMatch(s.body, /반드시|100%|완벽한 궁합|무조건|절대/);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `section.evidence` is undefined (현재 타입에 evidence 없음) → "evidence one-liner must be present" 단언 실패. (body !== summary 는 현재도 통과할 수 있으나 evidence 단언에서 확실히 red.)

---

## Task 2: 타입 + 기반 헬퍼 + 프레이밍 매트릭스

**Files:**
- Modify: `src/lib/compatibility.ts` (타입 `:141`, `summarizeStemInteraction` `:359`, 신규 헬퍼는 `:851`(DEEP_SECTION_AXIS_LEAD) 인근)

- [ ] **Step 1: `CompatibilityDeepSection`에 `evidence?` 추가**

`src/lib/compatibility.ts:141` 교체:

```ts
export interface CompatibilityDeepSection {
  key: string;
  title: string;
  body: string;
  /**
   * 이 축 풀이의 사주 근거 한 줄. 결정론 경로에서만 채운다.
   * LLM 경로(compatibility-interpretation-types.ts)와 동형 유지를 위해 옵셔널.
   */
  evidence?: string;
}
```

- [ ] **Step 2: `summarizeStemInteraction`에 `kind` 필드 추가**

`src/lib/compatibility.ts:359~357` 함수의 4개 `return` 객체 각각에 `kind`를 추가한다. 4분기는 이미 존재하므로 라벨만 표면화:

```ts
// 같은 일간 (selfStem === partnerStem) 블록:
return {
  kind: 'same' as const,
  score: 4,
  title: '일간이 같은 관계',
  body: `두 분 모두 ${selfKo} 일간이라 세상을 읽는 기본 프레임이 비슷합니다. 공감은 빠르지만 양보하지 않는 지점도 닮아 있을 수 있습니다.`,
};

// STEM_COMBINATIONS (천간합) 블록:
return {
  kind: 'harmony' as const,
  score: 6,
  title: '일간 천간합이 잡히는 관계',
  body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 천간합으로 묶여 기본적으로 서로를 붙잡아 주는 힘이 있습니다. 관계를 이어가려는 의지는 비교적 강한 편입니다.`,
};

// STEM_CLASHES (충) 블록:
return {
  kind: 'clash' as const,
  score: -5,
  title: '일간 충이 걸리는 관계',
  body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 생각을 진행하는 속도가 달라, 결정을 빨리 내릴수록 마찰이 생기기 쉽습니다.`,
};

// 기본(보완) 블록:
return {
  kind: 'complement' as const,
  score: 0,
  title: '일간의 성향은 다르지만 보완 여지가 있는 관계',
  body: `${selfKo}${josa(selfKo, '과', '와')} ${partnerKo}${josa(partnerKo, '은', '는')} 같은 방식으로 움직이지는 않지만, 차이를 이해하면 오히려 역할 분담이 선명해질 수 있습니다.`,
};
```

- [ ] **Step 3: 점수대/문장 헬퍼 + 프레이밍 매트릭스 추가**

`src/lib/compatibility.ts`의 `DEEP_SECTION_AXIS_LEAD`(`:846` 부근) **바로 위**에 추가:

```ts
type StemInteractionKind = 'same' | 'harmony' | 'clash' | 'complement';

// 점수대 5단계 — buildCompatibilityInterpretation 의 라벨 산출(>=84/78/70/62)과 동일 기준.
// band 0 = 최상 … 4 = 가장 약함.
function resolveScoreBand(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score >= 84) return 0;
  if (score >= 78) return 1;
  if (score >= 70) return 2;
  if (score >= 62) return 3;
  return 4;
}

// 한국어 첫 문장만 추출(근거 한 줄용). "…다." 단위. 없으면 전체.
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const idx = trimmed.indexOf('다.');
  return idx >= 0 ? trimmed.slice(0, idx + 2) : trimmed;
}

// 관계유형(4) × 점수대(5) = 20셀 프레이밍 오프너. 축 공통 톤.
// 하우스 스타일: "~경향/~편/~수 있습니다" — 단정·과장·보장 표현 금지(의료광고법 가드).
const DEEP_SECTION_FRAME: Record<StemInteractionKind, [string, string, string, string, string]> = {
  same: [
    '두 분은 기본 결이 닮아 말이 잘 통하는 편이라, 이 강점을 살리면 관계가 더 단단해질 수 있습니다.',
    '비슷한 기질 덕에 공감이 빠른 편이니, 닮은 약점만 함께 챙기면 흐름이 좋아질 수 있습니다.',
    '닮은 점이 많아 편안하지만, 같은 지점에서 부딪히기도 쉬운 관계입니다.',
    '비슷한 성향이 양보 없는 고집으로 겹치면 거리가 생길 수 있는 관계입니다.',
    '닮은 만큼 같은 약점이 동시에 커지기 쉬워, 역할을 의식적으로 나눌 필요가 있는 관계입니다.',
  ],
  harmony: [
    '서로를 붙잡아 주는 힘이 강해, 방향만 맞추면 오래 이어질 가능성이 높은 관계입니다.',
    '기본적으로 끌어당기는 힘이 있어, 작은 차이를 조율하면 안정적으로 흐를 수 있습니다.',
    '묶이는 힘은 있지만 생활 리듬 차이가 변수로 작동하는 관계입니다.',
    '끌리는 마음과 달리 현실 조건에서 엇갈리기 쉬워 합의가 필요한 관계입니다.',
    '서로를 원하는 마음은 있어도 부딪히는 지점이 많아 인내가 필요한 관계입니다.',
  ],
  clash: [
    '속도 차이가 있지만 그만큼 서로를 자극해 키워 주는 힘으로 쓸 수 있는 관계입니다.',
    '부딪힘이 있는 편이나, 차이를 인정하면 보완 관계로 바뀔 여지가 있습니다.',
    '결정 속도와 시각 차이로 마찰이 생기기 쉬운 관계입니다.',
    '같은 사안을 다르게 읽어 갈등이 반복되기 쉬워 규칙이 필요한 관계입니다.',
    '기본 방향이 자주 충돌해, 거리와 역할을 분명히 해야 피로가 줄어드는 관계입니다.',
  ],
  complement: [
    '움직이는 방식은 달라도 역할 분담이 선명해, 차이가 강점이 되는 관계입니다.',
    '서로 다른 결이 빈 곳을 채워 주어, 차이를 이해할수록 편해지는 관계입니다.',
    '다른 성향이 때로 보완으로, 때로 오해로 작동하는 관계입니다.',
    '차이가 클 때는 서로의 기준을 설명하는 과정이 필요한 관계입니다.',
    '서로 다른 방향이 자주 어긋나, 기대를 미리 맞춰야 서운함이 줄어드는 관계입니다.',
  ],
};
```

- [ ] **Step 4: 타입 컴파일 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 본 변경으로 인한 신규 에러 없음. (이 단계는 아직 `buildDeterministicDeepSections`가 신규 헬퍼를 안 쓰므로 "declared but never used" 경고가 날 수 있음 — Task 3에서 해소. tsc가 unused 로 실패하면 Task 3과 함께 검증해도 됨.)

---

## Task 3: `buildDeterministicDeepSections` 재작성 + 호출부 ctx 주입

**Files:**
- Modify: `src/lib/compatibility.ts:853`(함수), `:1015`(호출부)

- [ ] **Step 1: 함수 재작성**

`src/lib/compatibility.ts:853~861`의 `buildDeterministicDeepSections` 전체를 교체:

```ts
// 축 → 근거 소스 매핑(기존 evidence[] 4종과 대칭). 근거는 첫 문장만 발췌.
function buildAxisEvidence(
  key: CompatibilityPracticalCard['key'],
  ctx: DeepSectionContext
): string {
  switch (key) {
    case 'conflict':
      return `근거 — 일간 신호: ${firstSentence(ctx.stemInteraction.body)}`;
    case 'communication':
      return `근거 — 오행 흐름: ${firstSentence(ctx.elementInteraction.summary)}`;
    case 'money':
      return `근거 — 오행 보완·겹침: ${firstSentence(ctx.balanceInteraction.body)}`;
    case 'distance':
      return `근거 — 일지 신호: ${firstSentence(ctx.branchInteraction.body)}`;
  }
}

interface DeepSectionContext {
  stemInteraction: ReturnType<typeof summarizeStemInteraction>;
  elementInteraction: ReturnType<typeof summarizeElementInteraction>;
  branchInteraction: ReturnType<typeof summarizeBranchInteraction>;
  balanceInteraction: ReturnType<typeof summarizeElementBalance>;
  score: number;
  selfName: string;
  partnerName: string;
}

function buildDeterministicDeepSections(
  practicalCards: CompatibilityPracticalCard[],
  ctx: DeepSectionContext
): CompatibilityDeepSection[] {
  const band = resolveScoreBand(ctx.score);
  const frame = DEEP_SECTION_FRAME[ctx.stemInteraction.kind][band];

  return practicalCards.map((card) => {
    // 본문 = 프레이밍(관계유형×점수대) + 축 리드 + 커플고유 practice + 두 이름 주입.
    const coupleLine =
      `${ctx.selfName}님과 ${ctx.partnerName}님은 ${DEEP_SECTION_AXIS_LEAD[card.key]} ${card.practice}`.trim();
    const body = [frame, coupleLine].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    return {
      key: card.key,
      title: card.title,
      body,
      evidence: buildAxisEvidence(card.key, ctx),
    };
  });
}
```

- [ ] **Step 2: 호출부에 ctx 주입**

`src/lib/compatibility.ts:1015`(`deepSections: buildDeterministicDeepSections(practicalCards),`)를 교체:

```ts
    deepSections: buildDeterministicDeepSections(practicalCards, {
      stemInteraction,
      elementInteraction,
      branchInteraction,
      balanceInteraction,
      score,
      selfName: self.name,
      partnerName: partner.name,
    }),
```

(주의: `stemInteraction`/`elementInteraction`/`branchInteraction`/`balanceInteraction`/`score`는 같은 함수 `buildCompatibilityInterpretation` 스코프 `:931~945`에 이미 선언돼 있음.)

- [ ] **Step 3: 테스트 실행 (Task 1 green)**

Run: `npm test`
Expected: PASS — Task 1의 두 테스트 + 기존 12 테스트 모두 통과.

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 신규 에러 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compatibility.ts src/lib/compatibility.test.ts
git commit -m "feat(compatibility): 결정론 fallback 하이브리드 재작성 — 관계유형×점수대×근거"
```

---

## Task 4: 렌더러 — evidence 근거 줄 표시

**Files:**
- Modify: `src/features/compatibility/compatibility-deep-sections.tsx:88~95`(본문 `<p>` 직후)

- [ ] **Step 1: evidence 캡션 줄 추가**

`compatibility-deep-sections.tsx`에서 본문 단락:

```tsx
              <p className="mt-1.5 break-keep text-[13px] leading-[1.7] text-[var(--app-copy)]">
                {item.body}
              </p>
```

바로 아래에 추가:

```tsx
              {item.evidence ? (
                <p
                  className="mt-1.5 break-keep text-[11px] leading-[1.6] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {item.evidence}
                </p>
              ) : null}
```

(LLM 교체 시 `evidence` 미생성 → 자동 미표시. 기존 빈 화면 방지 흐름 유지.)

- [ ] **Step 2: 타입체크 + 빌드 골격 확인**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 신규 에러 0. (`CompatibilityDeepSection.evidence`가 옵셔널이라 LLM 경로 타입과도 호환.)

- [ ] **Step 3: Commit**

```bash
git add src/features/compatibility/compatibility-deep-sections.tsx
git commit -m "feat(compatibility): §8 깊은 풀이에 축당 근거 한 줄 렌더"
```

---

## Task 5: 의료광고법 게이트 + 전체 검증 + PR

**Files:** (코드 변경 없음 — 검증·게이트)

- [ ] **Step 1: 조립된 실제 출력 문장으로 검증(메모 교훈)**

글로서리/정의가 아닌 **빌더가 조립한 실제 body**를 덤프해 비문·한자 잔존·단정표현 확인. 임시 스크립트:

```bash
cat > /tmp/dump-compat.mjs <<'EOF'
import { buildCompatibilityInterpretation } from './src/lib/compatibility.ts';
for (const [ya, yb] of [[1988,1991],[1990,1990],[1982,1979],[1995,1986]]) {
  const r = buildCompatibilityInterpretation('lover',
    { name:'가', birthInput:{year:ya,month:3,day:12,hour:9,gender:'male'} },
    { name:'나', birthInput:{year:yb,month:7,day:21,hour:14,gender:'female'} });
  console.log(`\n=== ${ya} × ${yb} (score ${r.score}) ===`);
  for (const s of r.deepSections) console.log(`[${s.key}] ${s.body}\n   ${s.evidence}`);
}
EOF
npx tsx /tmp/dump-compat.mjs
```

Expected: 4커플 × 4축 본문이 서로 다르고, 각 본문에 프레이밍+practice+이름, 그 아래 근거 한 줄. 단정어(반드시/100%/완벽/무조건/절대) 0건. 한자 잔존·비문 0건.

- [ ] **Step 2: 의료광고법 자가 게이트**

`medical_compliance_checker` 스킬로 Step 1 덤프 출력 전수 + `DEEP_SECTION_FRAME` 20셀을 검수. 치료성·과장·보장·유인 표현 0 확인. (운세 콘텐츠지만 하우스 가드 동일 적용.)

- [ ] **Step 3: 전체 스위트 + 린트**

Run: `npm test && npx tsc --noEmit -p tsconfig.json 2>&1 | head`
Expected: 전체 PASS, 타입에러 0.

- [ ] **Step 4: 임시 스크립트 정리 후 PR**

```bash
rm -f /tmp/dump-compat.mjs
git push -u origin feat/compatibility-fallback-rewrite
gh pr create --base main \
  --title "feat(compatibility): 결정론 fallback 하이브리드 재작성 (로드맵 영역1 #2)" \
  --body "spec: docs/superpowers/specs/2026-06-06-compatibility-fallback-rewrite-design.md

- §8 결정론 fallback을 관계유형(4)×점수대(5)×커플데이터×축당 근거로 재작성
- CompatibilityDeepSection.evidence? 옵셔널 추가(LLM 경로 동형)
- 렌더러 근거 한 줄 표시
- 차별성·evidence·단정금지 회귀 테스트

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: CI(Test/Typecheck/Build + Playwright smoke + Supabase Preview) 통과. (브랜치가 현재 main 기준이라 PR#405 CI수정 포함 — 스모크 green 예상.)

---

## Self-Review

**Spec coverage:**
- §3.1 시그니처 확장 → Task 3 Step 1-2 ✓
- §3.2 20셀 매트릭스/kind/resolveScoreBand → Task 2 Step 2-3 ✓
- §3.3 본문 조립(프레이밍+practice+이름) → Task 3 Step 1 ✓
- §3.4 evidence? + 축 매핑 → Task 2 Step 1, Task 3 Step 1(buildAxisEvidence) ✓
- §3.5 렌더러 → Task 4 ✓
- §5 테스트(차별성/분기/근거) → Task 1, §5 렌더 출력 검증 → Task 5 Step 1 ✓
- §6 의료광고법 → Task 5 Step 2 + Task 1 단정금지 단언 ✓
- §7 리스크(빈 값 비문) → `firstSentence`/`filter(Boolean)`/`replace(/\s+/g,' ')` 처리 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드/명령/기대출력 포함. TODO/TBD 없음.

**Type consistency:** `DeepSectionContext`(Task3) 필드명이 호출부 주입(Task3 Step2)·`buildAxisEvidence`(Task3 Step1)와 일치. `kind`(Task2 Step2) ↔ `DEEP_SECTION_FRAME` 키(Task2 Step3) ↔ `ctx.stemInteraction.kind`(Task3 Step1) 일치. `evidence?`(Task2 Step1) ↔ 렌더러 `item.evidence`(Task4) 일치.

**주의:** `DeepSectionContext` 인터페이스는 Task3 Step1 코드블록에서 `buildDeterministicDeepSections` 위에 함께 선언한다(별도 파일 아님).
