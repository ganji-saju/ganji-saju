# 2026-05-19 V2-5 + (a) 2-2 LLM 통합 — Storage 설계

> **작업 단계**: V2-5 + (a) 2-2 LLM 통합 (코드 변경 0, 설계 문서)
> **선행 PR**: [#257](https://github.com/ganji-saju/ganji-saju/pull/257) V2-1 audit / [#258](https://github.com/ganji-saju/ganji-saju/pull/258) V2-2 signature union / [#259](https://github.com/ganji-saju/ganji-saju/pull/259) V2-3 storage loadV2
> **참조**: [V2-1 audit](2026-05-19-v2-migration-audit.md) §2-E (V2-5 핵심 결정 사항), §5 (제약사항), [report-llm-spec.md](../docs/superpowers/plans/2026-05-19-report-llm-spec.md) (9 챕터 LLM 호출 패턴)

---

## 0. TL;DR

| 결정 | 권장 |
|---|---|
| **저장 위치** | `result_json` envelope 의 별도 field `_chapters` (V2-3 envelope V1 정책 준수) |
| **In-memory 형태** | `SajuDataV2.interpretation.blocks` 에 hydrate (loadSajuDataV2 후 후속 단계에서 LLM 결과 merge) |
| **캐싱 키** | `sha256(sajuData.pillars + sajuData.dayMaster + userContext.relevantFields + chapterId)` |
| **TTL** | 30일 (시즌 라벨 변경 가능성 — report-llm-spec.md §9-3) |
| **Feature flag** | `OPENAI_INTERPRET_CHAPTERS=1` (env 기반 enable/disable) |
| **비용** | 호출당 ~$0.005, 9 챕터 ~$0.045 / reading, 30일 캐시로 사용자당 1회 |
| **확장 순서** | 챕터 1 → 4·5 → 2·3·6·7 → 9 synthesis (report-llm-spec.md §9-2) |

핵심: V2-3 의 envelope V1 정책을 유지하면서, **LLM 결과만 별도 envelope field 로 저장**. V2 interpretation 은 in-memory hydration 단계에서 LLM 결과를 머지하는 방식.

---

## 1. 배경 — 왜 별도 설계가 필요한가

### 1-1. V2-3 의 envelope V1 정책 (이미 머지됨, PR #259)

`readings.ts` 의 `createStoredReadingResultJson` 은 `sajuData: SajuDataV1` 만 받음. DB row 의 `result_json` envelope shape 는 V1 그대로 유지. 새 row 도 `calculateSajuDataV1` 로 생성된 V1 객체 + envelope 메타 (`_grounding`, `_kasiComparison`, `_metadata`).

→ V2 의 `interpretation`, `verification`, `legacy` 추가 필드 + metadata 확장 필드는 **DB 에 저장 안 됨**. in-memory 에서만 `loadSajuDataV2` 가 자동 upgrade 로 생성.

### 1-2. LLM 챕터 결과는 어디에 저장하나

LLM 호출 비용 (~$0.045 / reading, 9 챕터) 때문에 **재호출 회피**가 핵심. 즉 어딘가에 영속화 필요. V2-3 정책 + 9-챕터 LLM 호출의 결합:

| 옵션 | 장점 | 단점 | 결정 |
|---|---|---|---|
| **(X) envelope 별도 field `_chapters`** | V2-3 envelope V1 정책 그대로 유지. 1 row = 1 reading 결과 통합 조회. | result_json 크기 증가 (~10 KB / 9 챕터). | ✅ **권장** |
| (Y) V2 interpretation.blocks 에 임시 저장 (in-memory 전용) | V2 schema 일관. | LLM 결과 영속화 불가 → 매번 재호출 (~$0.045 / 페이지 뷰). 거부됨. | ❌ |
| (Z) 별도 DB 테이블 `reading_chapters` | row size 분산. 챕터별 독립 invalidation. | join 비용 + readings.ts 변경 범위 큼. envelope 정책 어긋남. | △ (필요 시 차후) |

→ **(X) 채택**. envelope `_chapters` field 에 챕터별 LLM 결과 저장.

### 1-3. (a) 2-2 통합 지점

기존 `saju-lifetime-service.ts` 는 `buildLifetimeReport(input, sajuData, targetYear, userSituation)` → deterministic 본문 생성 후 `generateAiText` 로 LLM 풀이 생성. 본문 중 **챕터 1 (`LifetimeCoreIdentitySection.summary`)** 만 우선 LLM enhance 대상.

```
generateLifetimeInterpretation (entry)
 ├─ resolveReading(id)  ← V2-3 loadSajuDataV2 결과 (in-memory V2)
 ├─ buildLifetimeReport(input, sajuData, targetYear)  ← V2-2 union 시그니처
 ├─ buildFallbackLifetimeInterpretation(report)
 ├─ ✅ enhanceLifetimeChapter1WithLLM(input, report.coreIdentity)  ← 본 PR 추가
 │    └─ generateChapter({ chapterId: 1, saju, userContext })
 │        └─ OpenAIChapterClient (이미 구현됨, PR #252)
 ├─ generateAiText (기존 8 챕터 + synthesis)
 └─ return LifetimeInterpretationResponsePayload
```

`enhanceLifetimeChapter1WithLLM` 은 이미 PR #253 에 구현 완료. 통합만 남음.

---

## 2. Storage 모델 — envelope `_chapters` field

### 2-1. envelope 구조 확장

```typescript
// readings.ts 의 PersistedReadingEnvelope 확장
export interface PersistedReadingEnvelope {
  _grounding?: SajuInterpretationGrounding;
  _kasiComparison?: KasiSingleInputComparison | null;
  _metadata?: SajuPersistedReadingMetadata;
  _chapters?: PersistedChapterEnvelope;  // ← 신규
}

export interface PersistedChapterEnvelope {
  schemaVersion: 'reading-chapters/v1';
  generatedAt: string;                    // ISO timestamp
  promptVersion: string;                  // chapter-prompts.ts 의 version
  model: string;                          // 'gpt-4o-mini' 등
  cacheKey: string;                       // sha256(saju + userContext + chapterId)
  chapters: Record<ChapterId, ChapterEntry>;
}

interface ChapterEntry {
  chapterId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  body: string;                           // LLM 출력 본문
  source: 'llm' | 'fallback';
  retries: 0 | 1 | 2;
  validationFailures: string[];           // 후처리 검증 실패 목록 (운영 추적용)
}

type ChapterId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
```

### 2-2. DB 저장 시점

- **신규 row**: `buildReadingInsertPayload` 는 envelope `_chapters` 없이 저장 (LLM 호출은 사용자가 결과 페이지 요청 시 trigger).
- **기존 row + LLM 호출 후**: 별도 `updateReadingChapters(readingId, chapters)` 호출로 `_chapters` field 만 upsert.

→ DB column schema 변경 0. `result_json: unknown` jsonb 에 field 추가만.

### 2-3. 캐싱 정책

```typescript
function buildChapterCacheKey(sajuData: SajuDataV1 | SajuDataV2, userContext: ChapterUserContext, chapterId: number): string {
  const payload = JSON.stringify({
    pillars: {
      year: sajuData.pillars.year.ganzi,
      month: sajuData.pillars.month.ganzi,
      day: sajuData.pillars.day.ganzi,
      hour: sajuData.pillars.hour?.ganzi ?? null,
    },
    dayMaster: { stem: sajuData.dayMaster.stem, element: sajuData.dayMaster.element },
    userContext: {
      // 챕터 결과에 영향 주는 필드만 (relevantFields)
      age: userContext.age,
      relationshipStatus: userContext.relationshipStatus,
      occupation: userContext.occupation,
      currentConcern: userContext.currentConcern,
    },
    chapterId,
  });
  return sha256(payload);  // 환경: node crypto.createHash
}
```

캐시 hit 조건:
- 같은 사주 + 같은 userContext + 같은 chapterId → 같은 cacheKey → DB `_chapters[chapterId].cacheKey` 일치
- 사용자가 "다시 생성" 버튼 누르면 cacheKey 무시 (force regenerate)
- TTL 30일: `generatedAt + 30d < now` 면 자동 재생성

### 2-4. In-memory hydration — `loadSajuDataV2` 후속 단계

V2-3 의 `loadSajuDataV2` 결과 (V2 schema, `interpretation.blocks` 는 deterministic builder 결과) 위에 LLM 결과를 머지:

```typescript
function hydrateInterpretationWithChapters(
  v2: SajuDataV2,
  envelope: PersistedChapterEnvelope | undefined
): SajuDataV2 {
  if (!envelope) return v2;

  const enhancedBlocks = v2.interpretation.blocks.map((block) => {
    const chapter = envelope.chapters[mapBlockIdToChapterId(block.id)];
    if (!chapter || chapter.source === 'fallback') return block;
    return { ...block, summary: chapter.body };  // body 로 summary 만 교체
  });

  return {
    ...v2,
    interpretation: { ...v2.interpretation, blocks: enhancedBlocks },
  };
}
```

`readings.ts` 의 `mapReadingRow` 에 hydration step 추가:

```typescript
function mapReadingRow(row: ReadingRow): ReadingRecord {
  const persisted = extractPersistedReadingEnvelope(row.result_json);
  ...
  const sajuData = loadSajuDataV2(input, row.result_json);                  // V2-3 (이미 머지됨)
  const hydrated = hydrateInterpretationWithChapters(sajuData, persisted._chapters);  // ← V2-5 신규
  ...
  return { ..., sajuData: hydrated };
}
```

---

## 3. Feature flag + 비용 제어

### 3-1. env flag

```typescript
// .env / vercel env
OPENAI_INTERPRET_CHAPTERS=1     // enable LLM 챕터 생성
OPENAI_INTERPRET_CHAPTER_IDS=1  // 활성 챕터 (점진 확장: '1' → '1,4,5' → '1,2,3,4,5,6,7' → '1-9')
```

`saju-lifetime-service.ts` 에서:

```typescript
const enabledChapters = parseEnabledChapterIds(process.env.OPENAI_INTERPRET_CHAPTER_IDS ?? '');
if (process.env.OPENAI_INTERPRET_CHAPTERS === '1' && enabledChapters.has(1)) {
  const chapter1Result = await enhanceLifetimeChapter1WithLLM(input, report.coreIdentity);
  report.coreIdentity = chapter1Result;  // summary 만 교체됨
}
```

기본값 (env 미설정): 모든 챕터 LLM disable → 기존 deterministic 본문 그대로 (현재 동작 보존).

### 3-2. 비용 모니터링

```typescript
interface ChapterLLMTelemetry {
  chapterId: number;
  source: 'llm' | 'cache' | 'fallback';
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostUSD: number | null;        // gpt-4o-mini: $0.150 / 1M input + $0.600 / 1M output
}
```

- `console.log` 1차 (PR I)
- telemetry 테이블 + 일별 집계 view 2차 (PR L+, 별도 PR)
- 일별 비용 임계값 초과 시 alert (PR M+, 별도 PR)

---

## 4. 구현 순서 (PR I/J/K)

### PR I — chapter envelope storage + 챕터 1 LLM 통합 (기본 동작 보존)

**변경 파일**:
- `src/lib/saju/readings.ts` — `PersistedReadingEnvelope._chapters` field 추가, `extractPersistedReadingEnvelope` / `createStoredReadingResultJson` 확장. `hydrateInterpretationWithChapters` helper 추가.
- `src/server/ai/saju-lifetime-service.ts` — `enhanceLifetimeChapter1WithLLM` 통합 (env flag 분기).
- `src/server/ai/chapters/build-chapter1-input.ts` — V2-2 에서 이미 V1|V2 union 적용됨.
- 신규: `src/server/ai/chapters/chapter-cache.ts` — `buildChapterCacheKey` + 30일 TTL 체크.
- 신규: `src/server/ai/chapters/chapter-telemetry.ts` — `console.log` 1차 monitoring.

**검증**:
- `npm run typecheck` — 0 error
- `npm test` 회귀 0
- 새 spec: `enhance-lifetime-chapter1.test.ts` 의 통합 케이스 (env flag on/off, cacheKey hit/miss).
- env `OPENAI_INTERPRET_CHAPTERS=0` 인 staging 에서 기존 동작 100% 보존 확인.
- env `OPENAI_INTERPRET_CHAPTERS=1` 인 staging 에서 챕터 1 본문이 LLM 결과로 교체되는지 + envelope `_chapters` 에 저장되는지 + 2회 호출 시 cache hit 인지 확인.

### PR J — 챕터 4, 5 추가 (관계 + 재물 — 중복이 가장 많은 챕터)

- `report-llm-spec.md §9-2` 의 구현 순서 따름
- `enhanceLifetimeChapter4WithLLM`, `enhanceLifetimeChapter5WithLLM` 추가
- env `OPENAI_INTERPRET_CHAPTER_IDS=1,4,5` 로 활성
- LLM 비용 모니터링 1주일 (호출당 ~$0.015 / reading, cache hit 후 ~$0)

### PR K — 챕터 2, 3, 6, 7 + synthesis 9

- 잔여 6 챕터 (2, 3, 6, 7, 9) 추가
- env `OPENAI_INTERPRET_CHAPTER_IDS=1-9` 로 전체 활성
- 비용 ~$0.045 / reading (cache miss), cache hit 후 ~$0

### PR L+ (별도 PR, 차후) — 모니터링 강화

- telemetry 테이블 추가 (`chapter_llm_runs`)
- 일별 비용 집계 view
- 검증 실패율 / 재생성률 추적

---

## 5. V2-3 envelope V1 정책과의 호환성

| 시나리오 | 동작 |
|---|---|
| **기존 row + 본 PR 코드** | envelope `_chapters` 없음 → `hydrateInterpretationWithChapters` 가 v2 그대로 반환. 사용자가 페이지 진입 시 LLM 호출 trigger, 결과를 `_chapters` 에 저장. |
| **신규 row + 본 PR 코드 + env disable** | LLM 호출 안 함. envelope `_chapters` 없이 저장. 기존 deterministic 본문. |
| **신규 row + 본 PR 코드 + env enable (챕터 1)** | LLM 호출 → 결과를 envelope `_chapters` 에 저장. 다음 페이지 진입 시 cache hit. |
| **롤백 — 본 PR 머지 후 이전 버전으로 코드 롤백** | envelope `_chapters` 는 unknown field 로 무시됨. `normalizeToSajuDataV1` 도 unknown field 그대로 패스 (TS unknown). DB row 손상 0. |
| **롤백 후 다시 본 PR 코드로 진행** | envelope `_chapters` 가 있으면 그대로 hydrate. 손실 0. |

---

## 6. 알려진 제약사항 / 결정 필요 사항

### 6-1. result_json 크기 증가 (~10 KB / 9 챕터)

- V1 envelope: ~25 KB / row (사주 데이터 + grounding + metadata)
- + `_chapters` (9 챕터 × ~1 KB body + meta): **~10 KB 추가** → 총 ~35 KB / row
- V2 schema 직접 저장 (V2-3 (b) 옵션) 시 +25-40 KB 였던 것에 비해 적음

→ PostgreSQL TOAST 압축 후 실제 디스크 증가는 ~5 KB / row 예상. 100K row 기준 500 MB. 수용 가능.

### 6-2. cacheKey 정밀도

- `userContext.relevantFields` 의 정의가 챕터마다 다를 수 있음 (챕터 1 은 age, 챕터 4 는 relationshipStatus, 챕터 5 는 occupation+currentConcern)
- 현재 설계: 모든 챕터가 같은 user context fields 사용 → cache key 통일 (단순)
- 대안: 챕터별 relevantFields 정의 + 챕터별 cacheKey 다르게 — 더 복잡하지만 정확한 cache hit. 차후 PR L+ 에서 결정.

### 6-3. 챕터 9 (synthesis) 의 cacheKey

- 챕터 9 는 1~7 챕터 digest 받음 (report-llm-spec.md §1-2)
- cacheKey 에 1~7 챕터의 digest hash 도 포함 필요
- 1~7 챕터 중 하나라도 재생성되면 챕터 9 도 cache miss → 재생성
- PR K 에서 구현

### 6-4. 챕터 8 (대운) 는 별도 spec

- `daewoon-llm-spec.md` (별도) — 8 섹션 대운 풀이
- 9 대운 cycle × 5 카드 = 45 호출. 캐싱 키 별도.
- 본 V2-5 설계 scope 밖. PR K 후 별도 설계.

---

## 7. 검증 명령

```bash
# PR I 종료 후
npm run typecheck                                    # 0 error
npm test                                             # 72 → 72+N pass (enhance-lifetime-chapter1 통합 테스트)
npm run test:spec                                    # 64 pass

# Staging 검증 (Vercel preview)
OPENAI_INTERPRET_CHAPTERS=0 npm run dev              # 기존 deterministic 본문 100% 보존
OPENAI_INTERPRET_CHAPTERS=1 OPENAI_INTERPRET_CHAPTER_IDS=1 npm run dev
                                                     # 챕터 1 LLM 결과로 교체 + envelope _chapters 저장 확인

# 새 audit script
npm run audit:chapter-cache <reading-id>            # _chapters envelope 의 cache hit 비율 + 30일 TTL 확인
```

---

## 8. 다음 단계 (이 문서 이후)

1. **PR I 구현** — 본 설계 수용 시 readings.ts envelope + saju-lifetime-service 통합 + chapter-cache helper + chapter-telemetry helper. 변경량 ~200 lines.
2. PR I 머지 후 staging 검증 (env flag 0/1 전환).
3. PR J (챕터 4, 5) — 1 주일 후, PR I 모니터링 결과 정상 확인 후.
4. PR K (잔여 6 챕터 + synthesis) — 추가 1~2 주일 모니터링 후.
5. PR L+ (모니터링 강화) — 별도 PR 묶음.

---

*설계 작성: 2026-05-19. 코드 변경 0. 다음 단계: 사용자 검토 후 PR I 시작 또는 다른 단위 (예: V2-4 production callers) 결정.*
