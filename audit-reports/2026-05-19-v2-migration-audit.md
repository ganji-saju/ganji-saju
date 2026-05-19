# 2026-05-19 V2 마이그레이션 — V1 의존 파일 audit

> **작업 단계**: V2-1 (코드 변경 0, 자료 작성만)
> **목적**: V2 마이그레이션 (`engine/index.ts` 가이드 — "새 코드는 가급적 v2") 의 V2-2 ~ V2-5 단계 실행 전, V1 의존을 가진 파일들을 전수 식별하고 각 파일의 변경 범위·위험도·단계 분류를 확정한다.
> **결정 사항**: 본 자료에는 코드 변경 권고만 포함하며, 실제 코드 변경은 V2-2 이후 단계에서 진행한다.

---

## 0. 요약 (TL;DR)

| 단계 | 정의 | 파일 수 | 본 audit 권고 |
|---|---|---:|---|
| 이미 V2 호환 | 변경 불필요 | 3 | skip |
| V2-2 | domain helper signature `SajuDataV1 \| SajuDataV2` union (본문 변경 0) | 17 | 가장 먼저 진행 (risk 최저) |
| V2-3 | storage layer `loadSajuDataV2` 도입 | 2 | V2-2 직후 진행 |
| V2-4 | production callers (API routes / page.tsx / verification / lib utilities) `loadSajuDataV2` 사용 | 11 | V2-3 직후 진행 |
| V2-5 | `SajuDataV2.interpretation` 의 LLM 결과 저장 모델 | 별도 설계 | (a) 2-2 LLM 통합과 합쳐서 설계 |
| 엔진 코어 + 테스트 | 라이브러리 자체 (수정 대상이 아님) | 12+ | 변경 없음 |

총 V1/V2 의존 파일 (engine 자체 + 테스트 포함): 60
실제 V2-2~V2-4 변경 대상: **30 파일**.

DB 영향: **호환** (loadSajuDataV2 가 V1 row 를 자동 V2 upgrade. 신규 row 만 V2 schema 로 저장).
typecheck 영향: V1 만 쓰는 시그니처를 union 으로 넓히는 것은 **subtype 확장**이라 회귀 0 예상 (`SajuDataV2 extends Omit<SajuDataV1, 'schemaVersion'|'metadata'>`).

---

## 1. V1/V2 데이터 모델 차이 요약

### 1-1. 코어 위치

- `src/domain/saju/engine/index.ts` — 단일 import 진입점. V1+V2 동시 re-export.
- `src/domain/saju/engine/saju-data-v1.ts` — V1 정의 (`calculateSajuDataV1`, `normalizeToSajuDataV1`, `seedSajuDataV1FromLegacy`, `deriveLegacySajuResult`, `SajuDataV1`).
- `src/domain/saju/engine/saju-data-v2-upgrade.ts` — V2 정의 (`loadSajuDataV2`, `upgradeSajuDataV1ToV2`, `verifySajuData`, `SajuDataV2`).

### 1-2. SajuDataV2 의 구조 (V1 super-set)

```ts
interface SajuDataV2 extends Omit<SajuDataV1, 'schemaVersion' | 'metadata'> {
  schemaVersion: 'saju-data/v2';
  metadata: SajuDataV1['metadata'] & {
    ruleSetVersion: 'moonlight-rules/v2';
    parentSchemaVersion: 'saju-data/v1';
    parentRuleSetVersion: string;
    migratedAt: string;
    qualityScore: number;
    verificationStatus: 'pass' | 'pass-with-warnings' | 'fail';
  };
  interpretation: SajuModernInterpretation;  // 신규 — claim/evidence 기반 해석 블록
  verification: SajuVerificationReport;       // 신규 — 검증 리포트 (issues, score)
  legacy: { schemaVersion: 'saju-data/v1'; ruleSetVersion: string };
}
```

핵심:
- V2 는 V1 의 **모든 필드**를 그대로 가짐 (`pillars`, `dayMaster`, `fiveElements`, `strength`, `pattern`, `yongsin`, `tenGods`, `currentLuck`, `majorLuck`, `input`).
- V2 만의 추가: `interpretation` (claim/evidence/disclaimer 구조), `verification` (검증 리포트), `legacy` (v1 출처).
- `metadata` 만 super-set (V1 필드 + V2 추가 6 필드).

### 1-3. V2 API 의 호환성

| V1 API | V2 대체 | 자동 fallback |
|---|---|---|
| `calculateSajuDataV1(input, opts)` | `loadSajuDataV2(input, null, opts)` | V1 계산 후 V2 upgrade. ✅ |
| `normalizeToSajuDataV1(input, storedValue, opts)` | `loadSajuDataV2(input, storedValue, opts)` | storedValue 가 V1 이면 자동 V2 upgrade. ✅ |
| `deriveLegacySajuResult(sajuData)` | (V2 도 동일 호출 가능 — V1 subtype) | extends 관계로 동작. ✅ |
| `upgradeSajuDataV1ToV2(v1, opts)` | (V2 진입 후엔 불필요) | — |

→ **마이그레이션은 거의 무손실**. V1 만 받는 함수의 signature 를 `SajuDataV1 \| SajuDataV2` 로 union 변경하는 것만으로 본문 변경 0 으로 동작.

---

## 2. 단계별 파일 매핑

### 2-A. 이미 V2 호환 (변경 불필요) — 3 파일

| 파일 | 형태 |
|---|---|
| `src/server/ai/chapters/build-chapter1-input.ts` | 이미 `SajuDataV1 \| SajuDataV2` union 적용 (PR #256) |
| `src/components/saju/saju-v2-insight-panel.tsx` | V1+V2 받아 `upgradeSajuDataV1ToV2` 로 내부 변환 |
| `src/app/admin/saju-verify/page.tsx` | V1/V2 동시 비교용 admin 도구 (calculateSajuDataV1 + upgradeSajuDataV1ToV2 둘 다 의도적으로 사용) |

### 2-B. V2-2: domain helpers — signature `SajuDataV1 | SajuDataV2` union (본문 변경 0) — 17 파일

> 모두 **`import type { SajuDataV1 }`** 만 import. `SajuDataV2` 를 추가 import 하고 함수 시그니처를 `SajuDataV1 | SajuDataV2` 로 넓히면 본문은 손대지 않는다 (V2 가 V1 super-set 이므로 모든 필드 접근 그대로 동작).

| # | 파일 | V1 참조 수 | 사용 형태 | 위험도 | 비고 |
|---:|---|---:|---|---|---|
| 1 | `src/domain/saju/report/build-report.ts` | 33 | type only, 다수 helper signature | low | 가장 광범위. 모든 빌더의 기반 |
| 2 | `src/server/today-fortune/build-today-fortune.ts` | 29 | type only, 15+ helper signature | low | today-fortune 코어 |
| 3 | `src/lib/compatibility.ts` | 16 | `normalizeToSajuDataV1` × 1 + type 다수 | **medium** | `normalizeToSajuDataV1` 호출 1건은 V2-4 분리. type 부분만 V2-2 |
| 4 | `src/domain/saju/report/build-yearly-report.ts` | 14 | type + `calculateSajuDataV1(input)` × 1 (line 355) | **medium** | 내부 호출은 V2-4 분리. type 부분만 V2-2 |
| 5 | `src/domain/saju/report/personalization-context.ts` | 7 | type only | low | — |
| 6 | `src/domain/saju/report/build-fortune-calendar.ts` | 5 | type + `calculateSajuDataV1(input)` × 1 (line 164) | **medium** | 내부 호출은 V2-4 분리. type 부분만 V2-2 |
| 7 | `src/lib/saju/elements.ts` | 4 | type only (getPersonalityFromSajuData / getLuckyElementsFromSajuData) | low | — |
| 8 | `src/domain/saju/report/interpret-api-contract.ts` | 4 | type only | low | — |
| 9 | `src/domain/saju/report/build-grounding.ts` | 4 | type only (+ SajuYongsinCandidate) | low | — |
| 10 | `src/domain/saju/report/build-lifetime-report.ts` | 2 | type only (+ SajuMajorLuckCycle, TenGodCode) | low | — |
| 11 | `src/domain/saju/report/build-narrative.ts` | 2 | type only | low | — |
| 12 | `src/lib/saju/report-metadata.ts` | 2 | type only | low | V2-3 후보지만 type 만 쓰면 V2-2 만으로 충분 |
| 13 | `src/lib/today-fortune/compute-saju-area-scores.ts` | 2 | type only | low | — |
| 14 | `src/features/saju-detail/saju-screen-helpers.ts` | 1 | type only | low | — |
| 15 | `src/features/compatibility/compatibility-result-view.tsx` | 1 | type only | low | — |
| 16 | `src/components/saju/saju-area-cards-section.tsx` | 1 | type only | low | — |
| 17 | `src/app/saju/[slug]/{deep,elements,nature,overview,premium,premium/print,share}/page.tsx` | 1×7 | type only | low | 7 페이지 (deep/elements/nature/overview/premium/premium-print/share) — 모두 동일 패턴 |

**V2-2 변경 패턴 표준화:**

```diff
- import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
+ import type { SajuDataV1, SajuDataV2 } from '@/domain/saju/engine';

- function foo(data: SajuDataV1) { ... }
+ function foo(data: SajuDataV1 | SajuDataV2) { ... }
```

Path 변경 권고: `@/domain/saju/engine/saju-data-v1` → `@/domain/saju/engine` (단일 진입점 가이드 준수).

**V2-2 작업량 추정:**
- 총 라인 변경: 약 100~150 줄 (대부분 signature 1줄씩, build-report.ts 와 build-today-fortune.ts 가 30~50 줄)
- 본문 변경: 0 (subtype 안전성)
- 테스트 회귀: 0 예상 (fixture 가 V1 형태로 생성되어 V1|V2 union 함수에 그대로 통과)

### 2-C. V2-3: storage layer — `loadSajuDataV2` 도입 — 2 파일

| 파일 | V1 참조 수 | 변경 형태 | 위험도 |
|---|---:|---|---|
| `src/lib/saju/readings.ts` | 13 | `calculateSajuDataV1` × 2 + `normalizeToSajuDataV1` × 1 → `loadSajuDataV2`. `deriveLegacySajuResult` 는 V2 도 받음 (subtype) | **high** |
| `src/lib/saju/report-metadata.ts` | 2 | type only — V2-2 에서 union 변경하면 storage row 의 `result_json` shape 가 V2 schema 로 저장될 때 한 번 더 확인 | medium |

**`readings.ts` 변경 패턴:**

```diff
- import { calculateSajuDataV1, deriveLegacySajuResult, normalizeToSajuDataV1, type SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
+ import { deriveLegacySajuResult, loadSajuDataV2, type SajuDataV2 } from '@/domain/saju/engine';

- const sajuData = calculateSajuDataV1(input);        // 신규 reading
+ const sajuData = loadSajuDataV2(input, null);

- const sajuData = normalizeToSajuDataV1(input, row.result_json);  // 기존 row
+ const sajuData = loadSajuDataV2(input, row.result_json);
```

**DB 호환성:**
- `readings` 테이블의 `result_json: unknown` column 에 저장된 schema:
  - 기존 row → V1 또는 legacy. `loadSajuDataV2` 가 `isSajuDataV2` 검증 후 V1 이면 자동 `upgradeSajuDataV1ToV2`.
  - 신규 row → V2 schema (`interpretation`, `verification`, `legacy` 추가됨).
- **migration 0 단계** — DB 변경 없음. 코드만 변경.

**저장 크기 증가 (예상):**
- V1 → V2 추가 필드 (`interpretation.blocks` 5개 + `verification.issues` 평균 5~10건 + `legacy`): **+25~40 KB / row** (한 reading 당).
- 기존 row 는 V1 으로 남고, 다음 조회 시점에 새 V2 schema 로 자동 재저장 (또는 in-memory 만 V2, DB 는 V1 유지하는 정책도 가능 — V2-3 진행 시 결정).

**위험도 — high 이유:**
- `result_json` 의 `extractPersistedReadingEnvelope` (line 138) 가 envelope 구조를 기대. V2 schema 추가 시 envelope 파싱 로직과 호환 확인 필요.
- DB 에 V2 schema 가 새로 저장되기 시작하면, 이전 버전 코드로 롤백 시 unknown 필드 무시되는지 검증 필요 (`normalizeToSajuDataV1` 의 unknown 필드 처리).

### 2-D. V2-4: production callers — 11 파일

> V2-2 의 type union 변경 + V2-3 의 storage 변경 이후, 실제 `calculateSajuDataV1` / `normalizeToSajuDataV1` 호출 사이트를 `loadSajuDataV2` 로 교체.

#### API routes — 4 파일

| 파일 | 호출 | 변경 |
|---|---|---|
| `src/app/api/ai/route.ts` (line 273, 480) | `normalizeToSajuDataV1(input, null, ...)` × 2 | `loadSajuDataV2(input, null, ...)` |
| `src/app/api/taekil/find-good-days/route.ts` (line 51) | `calculateSajuDataV1(birthInput)` | `loadSajuDataV2(birthInput, null)` |
| `src/app/api/today-fortune/route.ts` (line 58) | `calculateSajuDataV1(parsed.input)` | `loadSajuDataV2(parsed.input, null)` |
| `src/app/api/today-fortune/unlock/route.ts` (line 97, 193) | `calculateSajuDataV1(reading.input)` × 2 | `loadSajuDataV2(reading.input, null)` |

#### Verification scripts — 2 파일

| 파일 | 호출 | 변경 |
|---|---|---|
| `src/server/verification/today-fortune-audit.ts` (line 98) | `calculateSajuDataV1(parsed.input)` | `loadSajuDataV2(parsed.input, null)` |
| `src/domain/saju/validation/kasi-calendar.ts` (line 261) | `normalizeToSajuDataV1(input, null)` | `loadSajuDataV2(input, null)` |

#### Lib utilities — 4 파일

| 파일 | 호출 | 변경 |
|---|---|---|
| `src/lib/account.ts` (line 228) | `normalizeToSajuDataV1(input, reading.result_json)` × 1 | `loadSajuDataV2(input, reading.result_json)` |
| `src/lib/notifications.ts` (line 153) | `normalizeToSajuDataV1(input, latest.result_json)` × 1 | `loadSajuDataV2(input, latest.result_json)` |
| `src/lib/profile-personalization.ts` (line 60) | `calculateSajuDataV1(input)` × 1 | `loadSajuDataV2(input, null)` |
| `src/lib/compatibility.ts` (호출 부분만) | `normalizeToSajuDataV1(...)` 일부 호출 | `loadSajuDataV2(input, null)` |

#### Internal builder calls — 2 파일

| 파일 | 호출 | 변경 |
|---|---|---|
| `src/domain/saju/report/build-yearly-report.ts` (line 355) | 다른 해(年)의 사주 계산용 `calculateSajuDataV1(input, ...)` | `loadSajuDataV2(input, null, ...)` — multi-year cycle |
| `src/domain/saju/report/build-fortune-calendar.ts` (line 164) | 다른 해(年)/달(月) 사주 계산용 `calculateSajuDataV1(input, ...)` | `loadSajuDataV2(input, null, ...)` |

**V2-4 위험도 분류:**

| 위험도 | 파일 |
|---|---|
| **high** | `src/app/api/today-fortune/route.ts`, `src/app/api/today-fortune/unlock/route.ts` — production hot path. 실시간 호출 빈도 최고 |
| medium | `src/lib/account.ts`, `src/lib/notifications.ts` — DB row 의 `result_json` 을 직접 받음 → V2-3 storage 변경 후 V2 row 정상 처리 확인 필요 |
| medium | `src/lib/compatibility.ts` — 사주 1:1 합산 로직. self/partner 두 명의 SajuDataV1 객체 다수 사용 |
| medium | `src/domain/saju/report/build-yearly-report.ts`, `build-fortune-calendar.ts` — 내부에서 다른 해(年) 사주 재계산. cycle 별 V2 객체 생성으로 메모리 사용량 증가 (interpretation/verification 동봉) |
| low | `src/app/api/ai/route.ts`, `taekil/find-good-days/route.ts`, `verification/*`, `validation/kasi-calendar.ts`, `profile-personalization.ts` |

### 2-E. V2-5: `SajuDataV2.interpretation` 의 LLM 결과 저장 모델

> 별도 설계 — (a) 2-2 LLM 통합과 합쳐서 검토. 본 audit 의 scope 밖.

핵심 결정 사항 (V2-3 ~ V2-4 진행 후 별도 설계 문서로 분리):
- LLM 챕터 결과를 `SajuDataV2.interpretation.blocks` 에 추가 저장할지, 별도 column (`reading_chapters_json`) 으로 분리할지
- LLM 비용 발생 시점 (호출당 ~$0.005) 의 캐싱 키 (saju hash + chapterId)
- 챕터 1 정착 후 4·5 → 2·3·6·7 → 9 synthesis 순 확장
- env feature flag (`OPENAI_INTERPRET_CHAPTERS=1`) toggle 방식

### 2-F. 엔진 코어 + 테스트 (수정 대상이 아님) — 12+ 파일

| 카테고리 | 파일 |
|---|---|
| 엔진 코어 (정의) | `src/domain/saju/engine/index.ts`, `saju-data-v1.ts`, `saju-data-v2-upgrade.ts`, `orrery-adapter.ts` |
| 엔진 테스트 (spec) | `saju-data-v1.test.ts`, `saju-data-v2-verification.spec.ts`, `fixture-19820129.spec.ts`, `saju-cross-fixtures.spec.ts` |
| 빌더 테스트 (test) | `build-lifetime-report.test.ts`, `build-yearly-report.test.ts`, `build-narrative.test.ts`, `build-fortune-calendar.test.ts`, `build-grounding.test.ts`, `classic-corpus-grounding.test.ts`, `grounding-decision-trace.test.ts`, `topic-mapping.test.ts`, `topic-rule-table.test.ts` |
| 그 외 테스트 | `src/lib/saju/readings.test.ts`, `report-metadata.test.ts`, `unified-birth-entry.test.ts`, `compute-saju-area-scores 등 관련 테스트들`, `server/ai/saju-*.test.ts`, `build-chapter1-input.test.ts`, `today-fortune/build-today-fortune.test.ts` |
| 코멘트만 V1 등장 | `src/server/verification/profile-linkage-audit.ts` (line 245), `src/lib/today-fortune/types.ts` (line 38) |

**테스트 영향:**
- V2-2 의 signature union 변경 후 **테스트 회귀 0 예상** (fixture 가 V1 객체를 생성 → V1|V2 union 함수에 그대로 통과).
- V2-3 의 storage 변경 후 `readings.test.ts` 는 mocked Supabase 로 V2 schema row 검증 추가 1~2 케이스 필요.
- V2-4 의 production caller 변경 후 통합 테스트 (E2E + audit 스크립트) 회귀 0 예상.

---

## 3. 마이그레이션 위험도 / 우선순위 매트릭스

```
위험도 ↑

high │ readings.ts (V2-3)      today-fortune/route.ts (V2-4)
     │                          today-fortune/unlock/route.ts (V2-4)
     │
med  │ compatibility.ts (V2-2)  build-yearly-report (V2-2)
     │ build-fortune-calendar    build-yearly-report (V2-4 호출)
     │ (V2-2 + V2-4)             build-fortune-calendar (V2-4 호출)
     │                          account.ts (V2-4)
     │                          notifications.ts (V2-4)
     │                          report-metadata.ts (V2-3 후속)
     │
low  │ build-report.ts (33)    profile-personalization (V2-4)
     │ build-today-fortune (29) ai/route.ts (V2-4)
     │ build-narrative (2)      today-fortune-audit (V2-4)
     │ build-lifetime-report (2) kasi-calendar (V2-4)
     │ personalization-context  taekil/find-good-days (V2-4)
     │ build-grounding         saju 페이지 7개 (V2-2)
     │ elements.ts             feature 컴포넌트 4개 (V2-2)
     │ compute-saju-area-scores
     └─────────────────────────────────────────────→
       V2-2 (type union)    V2-3/V2-4 (call sites)
```

---

## 4. 권장 작업 순서 (V2-2 → V2-3 → V2-4)

### Phase 1 — V2-2 (1~2 PR, ~150 lines)
- **PR A**: type-only 변경 — saju 페이지 7개 + features 4개 + lib/saju/elements.ts + report-metadata.ts + compute-saju-area-scores.ts (총 14 파일, 라인 변경 < 30) → typecheck pass 확인.
- **PR B**: builder helper signature — build-report.ts + build-today-fortune.ts + build-lifetime-report.ts + build-narrative.ts + build-yearly-report.ts (type 부분) + build-fortune-calendar.ts (type 부분) + build-grounding.ts + personalization-context.ts + interpret-api-contract.ts (총 9 파일, 라인 변경 ~ 80) → `npm test` 354 → 354 pass 확인.
- **PR C**: compatibility.ts (type 부분), 단일 PR → vitest spec 64/64 pass 확인.

### Phase 2 — V2-3 (1 PR, ~50 lines)
- **PR D**: readings.ts 의 `loadSajuDataV2` 도입 + report-metadata.ts 의 V2 schema 인식 → `readings.test.ts` 신규 케이스 2~3 추가 → DB 호환 검증 (기존 row 자동 업그레이드 동작 + 신규 row V2 schema 저장 확인).

### Phase 3 — V2-4 (3~4 PR)
- **PR E**: API routes 4개 (`today-fortune/route.ts`, `today-fortune/unlock/route.ts`, `ai/route.ts`, `taekil/find-good-days/route.ts`) — production hot path 가장 먼저 V2 로 전환 + E2E 회귀 확인 (`npm run e2e --project chromium-auth, chromium-payment-blocks`).
- **PR F**: lib utilities 4개 (`account.ts`, `notifications.ts`, `profile-personalization.ts`, `compatibility.ts` 호출 부분).
- **PR G**: internal builder calls 2개 (`build-yearly-report.ts` line 355, `build-fortune-calendar.ts` line 164) — multi-year cycle 의 V2 객체 생성으로 메모리 사용량 변화 모니터링 (interpretation 추가분).
- **PR H**: verification + validation 3개 (`today-fortune-audit.ts`, `kasi-calendar.ts`, 그 외).

### Phase 4 — V2-5 (별도 설계)
- (a) 2-2 LLM 통합 결합 → `SajuDataV2.interpretation.blocks` 의 LLM 결과 저장 정책 결정.

---

## 5. 알려진 제약사항 / 결정 필요 사항

1. **DB 저장 정책**: `readings.result_json` 에 V2 schema 가 저장되기 시작하면 저장 크기 +25~40 KB / row. V2-3 진행 시 결정:
   - (a) **in-memory V2, DB 는 V1 유지** — `loadSajuDataV2` 결과를 화면용으로만 사용, 저장은 V1 형태로 envelope packing
   - (b) **DB 도 V2 schema 저장** — 새 row 부터 V2, 기존 row 는 다음 조회 시점에 자동 업그레이드 재저장

   추천: (a). interpretation/verification 은 재계산 비용이 매우 낮고, DB 부담 증가가 더 큰 리스크.

2. **`metadata` 의 추가 필드 노출 위험**: V2 metadata 는 `qualityScore`, `verificationStatus`, `migratedAt` 등 추가 필드 포함. 기존 코드가 `metadata` 를 spread 하거나 JSON.stringify 로 클라이언트 노출 시 unintended exposure 가능. V2-3 시 audit:
   - `src/lib/saju/readings.ts` 의 `result_json` envelope 가 metadata 전체를 외부로 직렬화하는지 확인
   - `src/app/api/today-fortune/route.ts` 응답에 metadata 가 포함되는지 확인

3. **V2 `interpretation.blocks` 의 PROHIBITED_INTERPRETATION_PATTERNS**: 한자/단정 표현 (이미 P0a 정리됨 — chapter-validator). V2-5 진행 시 LLM 결과도 동일 검증 통과 필요.

4. **`build-yearly-report.ts` / `build-fortune-calendar.ts` 의 multi-year cycle**: 한 reading 당 N 년치 사주 객체를 재계산 → V2 로 전환 시 N × (interpretation 5블록 + verification) 메모리 사용. 9 대운 cycle (PR #248) 기준 9 × 5블록 = 45 block 객체. 메모리 사용량 모니터링 필요.

5. **롤백 안전성**: V2-3 진행 후 DB 에 V2 schema row 가 섞인 상태에서 V1 코드로 롤백 시 `normalizeToSajuDataV1` 의 unknown 필드 처리 검증 필요. 권장: V2-3 PR 머지 직후 1주일 모니터링 후 V2-4 진행.

---

## 6. V2-2 ~ V2-4 변경 대상 파일 일람 (실행 체크리스트)

```
[ V2-2 — 17 파일, type-only / signature union ]
□ src/domain/saju/report/build-report.ts                 (33 refs)
□ src/server/today-fortune/build-today-fortune.ts        (29 refs)
□ src/domain/saju/report/build-yearly-report.ts          (14 refs, type 부분만)
□ src/lib/compatibility.ts                                (16 refs, type 부분만)
□ src/domain/saju/report/personalization-context.ts      (7 refs)
□ src/domain/saju/report/build-fortune-calendar.ts       (5 refs, type 부분만)
□ src/lib/saju/elements.ts                                (4 refs)
□ src/domain/saju/report/interpret-api-contract.ts       (4 refs)
□ src/domain/saju/report/build-grounding.ts              (4 refs)
□ src/domain/saju/report/build-lifetime-report.ts        (2 refs)
□ src/domain/saju/report/build-narrative.ts              (2 refs)
□ src/lib/saju/report-metadata.ts                         (2 refs)
□ src/lib/today-fortune/compute-saju-area-scores.ts      (2 refs)
□ src/features/saju-detail/saju-screen-helpers.ts        (1 ref)
□ src/features/compatibility/compatibility-result-view.tsx (1 ref)
□ src/components/saju/saju-area-cards-section.tsx        (1 ref)
□ src/app/saju/[slug]/{deep,elements,nature,overview,premium,premium/print,share}/page.tsx (7 파일 × 1 ref)

[ V2-3 — 2 파일, loadSajuDataV2 도입 ]
□ src/lib/saju/readings.ts                                (storage 코어)
□ src/lib/saju/report-metadata.ts                         (metadata envelope)

[ V2-4 — 11 파일, 호출 사이트 loadSajuDataV2 교체 ]
□ src/app/api/today-fortune/route.ts                      (hot path)
□ src/app/api/today-fortune/unlock/route.ts               (hot path)
□ src/app/api/ai/route.ts                                 (× 2 호출)
□ src/app/api/taekil/find-good-days/route.ts
□ src/lib/account.ts
□ src/lib/notifications.ts
□ src/lib/profile-personalization.ts
□ src/lib/compatibility.ts                                (호출 부분)
□ src/domain/saju/report/build-yearly-report.ts           (line 355 호출)
□ src/domain/saju/report/build-fortune-calendar.ts        (line 164 호출)
□ src/server/verification/today-fortune-audit.ts
□ src/domain/saju/validation/kasi-calendar.ts

[ 이미 V2 호환 — 변경 불필요 ]
✓ src/server/ai/chapters/build-chapter1-input.ts
✓ src/components/saju/saju-v2-insight-panel.tsx
✓ src/app/admin/saju-verify/page.tsx
```

---

## 7. 검증 명령 (각 단계 종료 후)

```bash
# V2-2 종료 후
npm run typecheck                 # 0 error 유지
npm test                          # 354 pass → 354 pass
npm run test:spec                 # 64/64 pass

# V2-3 종료 후 (위 + 추가)
npm test -- readings.test         # V2 schema seed 케이스 추가 후 pass
npm run audit:user-entitlements <test-user-id>  # storage layer 정상 동작 확인

# V2-4 종료 후 (위 + 추가)
npm run e2e                       # smoke 5/5 pass
npm run e2e -- --project chromium-auth          # Phase 2B 4 시나리오 pass
npm run e2e -- --project chromium-payment-blocks # Phase 2C 4 시나리오 pass
npm run audit:dead-anchors:strict
npm run audit:lucky-hybrid:strict
```

---

## 8. 결론

- V2 마이그레이션은 **subtype 안전성** 덕분에 V2-2 단계 (signature union) 만으로 기존 코드 99% 가 V2 객체를 그대로 받아 동작한다.
- V2-3 (storage) 가 가장 위험. DB row 의 `result_json` envelope 변경 시 롤백 안전성 검증 필수.
- V2-4 (callers) 는 production hot path (today-fortune/route.ts, unlock/route.ts) 만 신중하게. 나머지는 patch-level 변경.
- 권장 일정: V2-2 (1주) → V2-3 (1주, 모니터링 포함) → V2-4 (1~2주) → V2-5 별도.
- (a) 2-2 LLM 통합은 V2-3 이후 진행 가능 (storage 에 V2 schema 가 있어야 interpretation.blocks 에 LLM 결과 저장 가능).

---

*audit 작성: 2026-05-19. 다음 단계: 사용자 검토 후 V2-2 시작 단위 (PR A/B/C 분할 또는 단일 PR) 결정.*
