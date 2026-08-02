# 다층 인과 조립기 (Multi-layer Causal Narrative Assembler) — 설계 스펙

> 작성: 2026-08-02 · 상태: 승인됨(설계) → 구현 계획 대기
> 배경 근거: `docs/today-fortune-vs-kanana-gap-2026-08-02.md` (카나나 vs 간지사주 갭 검증)
> **어휘 정책 최상위 권위: `docs/claude-specs/02-naming-policy.md` (충돌 시 이 정책이 정답)**

---

## 1. 목적

간지사주 오늘운세는 일진 십성·합충·용신/기신·대운/세운/월운·신살을 **계산·탐지**하지만,
그 결과를 **"명칭 + 인과"로 서술하지 않고** 순화어/칩으로 흩어 놓는다(무료 `reasonSnippet`은 라벨이
"사주 근거 한 줄"인데 명리 근거 0개; 유료 `evidenceLines`는 세운/월운/용신을 칩으로만 노출).

이 스펙은 **이미 존재하는 계산 결과를 하나의 인과 문단으로 엮는 순수 결정론 조립기**를 정의한다.
신규 명리 계산은 없다. LLM도 없다.

### 목표
- 무료: `reasonSnippet.body`를 "사주 근거가 실제로 들어간" 1~2문장 축약 인과로 교체.
- 유료: 오늘 자세히보기에 일진 십성 × 원국 × 세운/월운 × 신살을 엮은 4~6문장 인과 문단 추가.
- 어휘: naming-policy 티어(십성·용신·대운/세운/월운·신살을 **한글 원어 + 첫 등장 시 짧은 설명**; 본문 한자 0).

### 비목표 (YAGNI)
- LLM 산문 생성/폴리시(브레인스토밍 안 2·3 기각).
- 감정 예보 섹션, 귀인/주의 인물 섹션(별도 후속).
- scenarios/evidenceLines 재작성(기존 유지, 신규 필드로 병렬 추가).
- 신살 신규 구현(현침살 등 — 엔진 17종 밖).

---

## 2. 모듈 경계

신규 순수 파일: **`src/lib/today-fortune/causal-narrative.ts`**

```ts
export function buildCausalNarrative(
  input: CausalInput,
  opts?: { tier?: 'brief' | 'full'; seed?: string }
): CausalNarrative;
```

- 순수 함수(부작용·IO·LLM 없음). 독립 유닛 테스트 가능.
- `build-today-fortune.ts`가 기존 값에서 `CausalInput`을 파생해 호출한다(§4 매핑).

---

## 3. 출력 계약 (`CausalNarrative`)

```ts
interface CausalNarrative {
  full: string;   // 유료: 4~6문장 인과 문단
  brief: string;  // 무료: 1~2문장 축약(원인+용신)
  terms: string[];// 문단에서 사용한 명리어(첫 등장 설명 부착 추적·테스트용)
}
```

- `full`/`brief` 모두 **본문 한자 0**, naming-policy §12 정규식 0건.
- 재료 부족(§6 폴백) 시 빈 문자열 금지 — 최소 원인+조언 2문장은 보장.

---

## 4. 입력 계약 (`CausalInput`) — 전부 기존 값 파생

| 필드 | 타입 | 출처(기존 코드) |
|---|---|---|
| `dayMaster` | Stem | `sajuData.pillars.day.stem` |
| `dayMasterElement` | '목'\|'화'\|'토'\|'금'\|'수' | `sajuData.dayMaster.element` |
| `todayStem` / `todayBranch` | Stem / Branch | `getTodayPillarSnapshot` (일진) |
| `iljinTenGod` | SipSung | `calculateSipsung(dayMaster, todayStem)` |
| `saewoonTenGod` / `wolwoonTenGod` / `daewoonTenGod` | SipSung \| null | `calculateSipsung(dayMaster, currentLuck.{saewoon,wolwoon,currentMajorLuck}.ganzi[0])` |
| `jijiRelations` | 배열 | 오늘 지지 vs 원국 4지지: `isSamhap·isBanghap·isYukhap·isBranchChung·isBranchHyung·isBranchHae·isBranchPa·isBranchWonjin` |
| `yongsin` / `kishin` | Element | `deriveLuckyElements(sajuData)` |
| `elementExtremes` | {dominant, missing/weakest} | `sajuData.fiveElements` |
| `activeSinsals` | 배열(name/category/scoreHint) | `detectComprehensiveSinsals` (오늘 관련·|scoreHint| 큰 순) |
| `strengthLevel` | '신강'\|'신약'\|'중화'\|null | `sajuData.strength?.level` |
| `seed` | string | `${dateKey}::${sajuData.pillars.day.ganzi}` (유료는 `premium::` prefix) |

### 4.1 지지 관계 랭킹
오늘 지지를 포함하는 관계를 강도순으로 정렬해 **상위 1개**를 문단에 서술:
`삼합 ≈ 충 > 방합 ≈ 육합 > 형 > 해·파·원진`. 삼합/방합은 `SAMHAP_GROUPS`/`BANGHAP_GROUPS`의
`.element`로 결과 오행을 얻어 "무슨 오행으로 흐르는지"를 명시.
> 예(19820129): 오늘 申은 삼합 申子辰(수, 원국 子·辰과)과 방합 申酉戌(금, 원국 酉와)을 동시 발동.
> 상위=삼합(수). 결과 오행 수가 이미 과다(27.3%)·기신 금 보강 방향 → "무거워질 수 있어요" 프레이밍.

### 4.2 세운/월운 계산 시점 주의
`sajuData.currentLuck`(세운/월운/대운)은 `metadata.calculatedAt`(시스템 시계) 기반,
일진(`todayStem/Branch`)은 빌더 주입 `now` 기반. **프로덕션은 둘 다 real-now라 정합**.
테스트에서 `now`를 과거/미래로 주입하면 층이 어긋날 수 있으니, 다층 슬롯 테스트는
`calculatedAt`과 `now`를 같은 날로 맞추거나 다층 슬롯을 검증에서 분리한다.

---

## 5. 인과 문장 로직 (5슬롯)

각 슬롯은 케이스별 2~3 변형을 갖고 `pickVariant(seed)`로 **결정론 변주**.
첫 등장 십성·신살·용신·강약엔 괄호 설명 1회(naming-policy §3·§5·§6·§8).

| # | 슬롯 | 조건 | 예시 문장(19820129, 2026-08-02) |
|---|---|---|---|
| 1 | **원인**(일진 십성) | 항상 | "오늘은 **편관(밀어붙이는 별)** 기운이 들어와 책임과 압박이 커지는 날이에요." |
| 2 | **겹침**(용신/기신 + 합충) | 항상 | "오늘 신금이 사주의 자수·진토와 만나 **수 기운**으로 흐르는데, 원래 강한 금·수를 더 키워 흐름이 무거워질 수 있어요." (오늘 오행이 용신이면 반김 프레이밍) |
| 3 | **다층**(세운/월운 십성) | 유료·데이터 有 | "여기에 올해 흐름(**편재**)과 이번 달 흐름까지 겹쳐 마음이 복잡해지기 쉬워요." |
| 4 | **신살 색채** | 유료·활성 신살 有 | "**귀문관살(예민함의 별)**이 함께라 말의 뉘앙스를 과하게 곱씹기 쉬우니 주의하세요." |
| 5 | **조언**(용신 보강 + 십성 대응) | 항상 | "그래서 오늘은 **화 기운**(말·밝게 퍼짐)을 채우듯, 큰 결정보다 정리와 기록으로 천천히 가는 게 좋아요." |

- **brief(무료)** = 슬롯 1 + 슬롯 5(용신 한 조각). 슬롯 3·4 제외.
- **full(유료)** = 슬롯 1→2→3→4→5.
- 용신 오행별 "보강 활동" 문구는 기존 `luckyPackage`(색·음식·방위) 톤과 일관(중복 문장 금지, 조언은 방향만).

### 5.1 첫 등장 설명 사전 (naming-policy에서 인용)
- 십성: 편관(밀어붙이는 별)·정재(꾸준한 살림의 별)·편재(움직이는 돈의 별)·정인(돌봄과 배움의 별)… (§3 표)
- 신살: 귀문관살(예민함의 별)·양인살(강한 의지의 별)·천을귀인(도움이 오는 별)… (§8 표 + 엔진 hint)
- 오행: "화 기운(말·밝게 퍼짐)" 첫 등장 시 (§2 짧은 설명)
- 강약: 중화(균형 잡힌 상태) 등 (§5)

---

## 6. 폴백 (재료 부족)

| 상황 | 동작 |
|---|---|
| 일진 stem/branch 없음(시간 미입력 등) | 조립기 미호출 → 무료는 기존 `buildPublicReasonBody` 유지, 유료 `causalNarrative` = null(섹션 미노출) |
| `currentLuck` 세운/월운 없음 | 슬롯 3 스킵(나머지 슬롯으로 문단 성립) |
| 활성 신살 0 | 슬롯 4 스킵 |
| 지지 관계 0 | 슬롯 2는 용신/기신·오행 과다만으로 성립 |

빈 문자열 절대 금지. brief는 최소 슬롯1+5.

---

## 7. 플러그인 지점

### 7.1 무료 (`buildTodayFortuneFreeResult`, build-today-fortune.ts:2707)
- `reasonBody`(현 `buildPublicReasonBody`, :2763) → 일진·용신 있으면 `buildCausalNarrative(input,{tier:'brief'}).brief`로 교체.
- `reasonSnippet`(:2807) 구조·라벨("사주 근거 한 줄") 유지, body만 교체.
- `buildPublicReasonBody`는 **폴백으로 존치**(삭제 금지).

### 7.2 유료 (`buildTodayFortunePremiumResult`, build-today-fortune.ts:2933)
- 반환 객체(:2968~)에 **신규 필드** 추가:
  ```ts
  causalNarrative: causal ? { title: '오늘 이 흐름인 이유', body: causal.full } : null
  ```
- 기존 필드(evidenceLines·scenarios·todayIljinReading 등) **불변**.
- 타입 `TodayFortunePremiumResult`(`src/lib/today-fortune/types.ts`)에 `causalNarrative` 옵셔널 추가.

### 7.3 UI
- 유료: `src/features/today-fortune/today-fortune-detail-client.tsx`에 카드 1개 추가(값 null이면 미렌더). 위치는 groundingSummary/evidenceLines 인근.
- 무료: 기존 `reasonSnippet` 렌더 컴포넌트 그대로(문자열만 바뀜) — UI 변경 없음.

---

## 8. 어휘 가드 & 테스트 (run-unit-tests: `*.test.ts`)

신규 `src/lib/today-fortune/causal-narrative.test.ts` — fixture 19820129(1982-01-29 남 진시, now=2026-08-02):
1. **명리 근거 포함**: full에 십성명(편관)·합충어(삼합)·용신어(화 기운) 각 1회 이상 등장.
2. **정책 준수**: naming-policy §12 `FORBIDDEN_PATTERNS` 정규식 전량 0건 + 본문 한자(`/[㐀-鿿]/`) 0.
3. **첫 등장 설명**: `terms`의 십성·신살 첫 등장에 괄호 설명 부착(정규식 `편관\(.+?\)` 등).
4. **결정론 변주**: seed(날짜) 다르면 문단 달라짐 / 같은 seed면 동일(재현성).
5. **폴백**: 시간 미입력 입력 → brief 비어있지 않음, 유료 causal=null.
6. **회귀**: 기존 today-fortune 테스트(build-today-fortune.test.ts, today-detail-daily-variation.test.ts, daily-variety-guard.test.ts) green 유지 — reasonSnippet 교체로 깨지는 단언 확인·수정.

---

## 9. 파일 요약

| 파일 | 변경 |
|---|---|
| `src/lib/today-fortune/causal-narrative.ts` | **신규** — 조립기 + 슬롯 변형 + 설명 사전 |
| `src/lib/today-fortune/causal-narrative.test.ts` | **신규** — 유닛 테스트 |
| `src/server/today-fortune/build-today-fortune.ts` | 무료 reasonBody 교체 + 유료 causalNarrative 필드 + CausalInput 파생 헬퍼 |
| `src/lib/today-fortune/types.ts` | `TodayFortunePremiumResult.causalNarrative?` 추가 |
| `src/features/today-fortune/today-fortune-detail-client.tsx` | 유료 카드 1개 추가(null 가드) |

---

## 10. 검증 자산
- 실측 하네스: `$CLAUDE_JOB_DIR/tmp/run-today.mjs` (fixture 19820129 출력 대조용)
- 정식 픽스처: `src/domain/saju/engine/fixture-19820129.spec.ts`
