# (B) 대운 LLM 다양성 검증 작업 지시서

> 2026-05-22 종합 검수에서 🟡 부분으로 분류된 **04-daewoon-llm-spec 적용도 ~50%** 의 정량 검증.
>
> 검수 보고서 §6 요약:
> > 대운(daewoon) LLM: 엔진(`orrery-adapter.mapDaewoon`)으로 산출 + `app/daewoon` · `daewoon-timeline-strip` 표시 + LLM은 `chapters/build-chapter9-input`·yearly·lifetime 에 통합. **04-daewoon-llm-spec의 전용 오케스트레이터(`generateDaewoon…`)는 미발견** — 챕터 파이프라인에 흡수된 구조.
>
> 목적: **9개 대운 풀이가 실제로 *각각 다른가*** 를 정량 측정. 결과에 따라 보강 작업 여부 결정.
>
> 출력: `audit-reports/2026-05-22-daewoon-diversity-measurement.md`

---

## 0. 작업의 본질

이 작업은 **두 단계**입니다.

```
Step 1: 측정 (이 지시서) — read-only, 코드 변경 없음
   ↓ 결과를 사용자에게 공유
Step 2: 결정 (사용자 + Claude 채팅) — 후속 보강 작업 필요 여부 판단
   ↓ 필요 시
Step 3: 보강 (별도 작업 지시서) — 04-spec 기반 다양화 작업
```

**이 지시서는 Step 1만 다룹니다.** Step 2~3은 측정 결과를 본 후 결정.

---

## 1. 검증 목표

대운 풀이가 9개 시기에 대해 *얼마나 다양한지* 다음 4축으로 측정:

| 축 | 측정 방법 | 목표 (04-spec 근거) |
|----|--------|---------|
| **본문 다양성** | 9개 풀이 간 코사인 유사도 또는 자카드 유사도 | 평균 유사도 ≤ 0.40 |
| **챕터 제목 고유성** | 9개 챕터 제목이 서로 다른지 | 9개 모두 고유 |
| **자극 문구 잔존** | "대박/암흑기/텅장/꿀팁/비책" 잔존 | 0건 |
| **한자·전문용어 누수** | 본문 한자, 전문 용어 누수 | 0건 |

---

## 2. 측정 대상 — 대표 사주 1개

검수 시점에 대운 풀이를 생성하는 *고정 사주 1개* 사용. 가능하면 검수 보고서·기존 audit에서 자주 등장한 케이스:

**기본 후보**: 검수 보고서나 audit-reports/에서 가장 자주 등장한 사주를 사용.

```bash
# 기존 audit에서 자주 등장하는 sajuId 또는 birth 정보 찾기
grep -h "sajuId\|birth\|일주" audit-reports/2026-05-2*.md | head -20

# orrery 엔진 테스트 케이스에서 대운 9개 모두 출력하는 케이스
grep -rln "daewoon\|대운" src/lib/saju-score/test-cases.ts 2>/dev/null
```

후보가 명확하지 않으면 **계미 일주, 1999.04.01 14:30 여, 대전** 사용 (이전 진단·스펙에서 반복 사용된 케이스).

---

## 3. 측정 절차

### 3-1. 대운 9개 풀이 데이터 수집

```bash
# 대운 풀이 LLM 호출 코드 위치 확인
echo "=== 대운 풀이 생성 코드 ==="
grep -rln "build-chapter9-input\|daewoon.*chapter\|chapter9" src/server/ 2>/dev/null

echo ""
echo "=== orrery-adapter.mapDaewoon 위치 ==="
grep -rn "mapDaewoon\|orrery-adapter" src/lib/ src/domain/ 2>/dev/null | head -10
```

**옵션 A — 캐시·DB에서 추출 (권장)**

기존 사용자 사주의 대운 풀이가 DB나 캐시에 있으면 그걸 사용. 새 LLM 호출 비용 0.

```bash
# 대운 풀이 저장 위치 확인
echo "=== LLM 결과 캐시 ==="
find src -type d -name "*cache*" -o -name "*generated*" 2>/dev/null | head -5

# Supabase migrations에서 대운 풀이 테이블 확인
ls supabase/migrations/ | grep -i "daewoon\|chapter9\|interpret"
```

**옵션 B — 새로 1회 생성 (필요 시)**

캐시에 없으면 LLM 1회 호출로 9개 대운 풀이 생성. 비용·시간 예상치 보고 후 사용자 승인 받고 진행.

### 3-2. 데이터 정리

9개 대운 풀이를 다음 형식의 JSON으로 정리:

```typescript
interface DaewoonOutput {
  index: number;          // 0~8
  ageRange: [number, number];  // [22, 31] 등
  ganji: string;          // "갑오"
  unseong: string;        // "장생" 등 12운성
  chapter_title: string;  // 챕터 제목
  one_line: string;       // 한 줄 요약
  full_text: string;      // 본문 전체
  sections?: Record<string, string>;  // 8섹션 구조면
}

// 결과
const daewoonOutputs: DaewoonOutput[] = [...];  // 9개
```

이 데이터를 `audit-reports/2026-05-22-daewoon-raw-data.json`으로 저장.

### 3-3. 측정 — 본문 다양성

각 풀이 쌍 36개(C(9,2))에 대해 유사도 계산:

```typescript
// 간단한 자카드 유사도 (3-gram 또는 단어 단위)
function jaccardSimilarity(textA: string, textB: string): number {
  // 한국어는 형태소 분석이 이상적이지만, MVP는 단어 단위
  const setA = new Set(textA.split(/\s+/));
  const setB = new Set(textB.split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// 또는 n-gram (안정적)
function ngramSimilarity(textA: string, textB: string, n = 3): number {
  const gramsA = new Set();
  const gramsB = new Set();
  for (let i = 0; i <= textA.length - n; i++) gramsA.add(textA.slice(i, i + n));
  for (let i = 0; i <= textB.length - n; i++) gramsB.add(textB.slice(i, i + n));
  const intersection = new Set([...gramsA].filter(x => gramsB.has(x)));
  const union = new Set([...gramsA, ...gramsB]);
  return intersection.size / union.size;
}
```

36개 쌍의 평균·최대·최소 유사도 계산.

**결과 표**:

```
대운 쌍 | 유사도
--------|------
0-1     | 0.32
0-2     | 0.45
...
7-8     | 0.38

평균: 0.X
최대: 0.X (대운 N - 대운 M)
최소: 0.X (대운 N - 대운 M)
```

### 3-4. 측정 — 챕터 제목 고유성

```typescript
const titles = daewoonOutputs.map(d => d.chapter_title);
const uniqueTitles = new Set(titles);
const isUnique = uniqueTitles.size === 9;

// 중복 발견 시
const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
```

### 3-5. 측정 — 금지 문구 잔존

```typescript
const fullText = daewoonOutputs.map(d => d.full_text).join('\n\n');

// naming-policy.md §12 정규식 + 04-spec 자극 문구
const forbiddenPatterns: Array<[RegExp, string]> = [
  [/대박|암흑기|텅장|꿀팁|비책/g, '자극 문구'],
  [/(새싹|햇살|흙|쇠|물)의\s*결/g, '자연 비유 + 결'],
  [/결단과|안정과|열정과|시작과|지혜과/g, '구 X과 라벨'],
  [/(목|화|토|금|수)의\s*기운/g, '오행 X의 기운 (X 기운 표기 위반)'],
  [/[\u4e00-\u9fff]/g, '한자 본문 노출'],
  [/천간|지지|일간|일주|월주|시주|연주|격국|용신|신강|신약|대운|세운/g, '명리 전문 용어'],
];

const violations: Array<{pattern: string, matches: string[]}> = [];
for (const [pattern, label] of forbiddenPatterns) {
  const matches = fullText.match(pattern);
  if (matches?.length) {
    violations.push({pattern: label, matches: [...new Set(matches)]});
  }
}
```

### 3-6. 측정 — 길이·구조 일관성

```typescript
const lengths = daewoonOutputs.map(d => d.full_text.length);
const sentenceCounts = daewoonOutputs.map(d => d.full_text.split(/[.!?]\s+/).length);

// 통계
const lengthStats = {
  min: Math.min(...lengths),
  max: Math.max(...lengths),
  mean: lengths.reduce((a, b) => a + b, 0) / lengths.length,
  stdDev: ...,
};
```

길이 편차가 클수록 *9개 중 어느 한쪽이 부실*하다는 신호.

---

## 4. 보고서 작성

### 4-1. 파일 위치

`audit-reports/2026-05-22-daewoon-diversity-measurement.md`

### 4-2. 보고서 구조

```markdown
# 대운 LLM 다양성 측정 보고서 — 2026-05-22

## 0. 측정 개요
- 측정 대상 사주: [사주 정보]
- 데이터 출처: 캐시 / 신규 생성
- 측정 시각: ISO datetime
- 측정자: Claude Code (read-only)

## 1. 본문 다양성

### 1-1. 9개 풀이 본문 (요약 100자씩)
| # | 대운 | 본문 시작 |
|---|----|---------|
| 0 | 갑오 | ... |
| 1 | ... | ... |
| ... |

### 1-2. 36개 쌍 유사도
| 쌍 | 자카드 | n-gram |
|----|------|--------|
| ... |

### 1-3. 통계
- 평균 유사도: 0.X
- 최대 유사도: 0.X (대운 N - 대운 M) ← 가장 비슷한 쌍
- 최소 유사도: 0.X (대운 N - 대운 M) ← 가장 다른 쌍
- **목표 (≤ 0.40)**: ✅ 통과 / ❌ 미통과

### 1-4. 시각화 (선택)
가장 유사한 쌍의 본문 *옆에 놓고* 어느 부분이 같은지 강조.

## 2. 챕터 제목 고유성
- 9개 제목 목록
- 중복 여부: ✅ 모두 고유 / ❌ N개 중복
- 중복 시: 어느 대운들 간 중복인지

## 3. 금지 문구 잔존
- 자극 문구: N건
- 자연 비유 + 결: N건
- 구 X과 라벨: N건
- 오행 X의 기운: N건
- 한자: N건
- 명리 전문 용어: N건

각 발견 시 어느 대운의 어느 위치에 있는지 명시.

## 4. 길이·구조 일관성
- 본문 길이 min/max/mean/stdev
- 문장 수 min/max/mean
- 편차가 큰 대운 (평균에서 ±2σ 벗어남) 식별

## 5. 종합 판정

### 5-1. 04-spec 근거 충족도
| 기준 | 목표 | 측정 | 판정 |
|------|----|----|----|
| 본문 다양성 | 평균 유사도 ≤ 0.40 | 0.X | ✅/❌ |
| 챕터 제목 고유 | 9개 모두 고유 | N/9 | ✅/❌ |
| 자극 문구 0 | 0건 | N건 | ✅/❌ |
| 한자·용어 누수 0 | 0건 | N건 | ✅/❌ |

### 5-2. 진단

다음 셋 중 하나로 판정:

**A. ✅ 충족** — 04-spec 근거 모두 통과. 다양성 보강 작업 *불필요*.
**B. ⚠️ 부분 부족** — 일부 항목 미통과. 우선순위에 따라 부분 보강.
**C. ❌ 다양성 부족** — 평균 유사도 > 0.40 등 핵심 기준 미통과. 04-spec 기반 본격 보강 필요.

### 5-3. 권장 후속

- A 판정: 검수 보고서의 🟡 → 🟢 갱신만
- B/C 판정: 후속 작업 지시서 작성 권장. 가능한 방향:
  - 챕터9 파이프라인에 *대운별 입력 분기* 강화
  - 04-spec의 8섹션 구조를 챕터9 출력에 명시적 반영
  - 검증 함수에 *대운 간 유사도 임계값* 추가

## 6. 한 줄 요약
> [측정 결과 1줄로]
```

---

## 5. 측정 원칙

### 5-1. read-only

- src/, scripts/ 코드 변경 금지
- 새 LLM 호출은 *옵션 B (캐시 없을 때)* 만, 사용자 승인 후
- DB 변경 금지

### 5-2. 신중

- 한 번 측정으로 결론 안 내림. 결과를 *사용자와 함께 해석*
- 유사도 0.40이라는 임계값은 *추정*. 실제 한국어 LLM 출력에서 어느 정도가 "충분히 다양한지"는 컨텍스트 따라 다름
- 측정 결과 자체가 *최종 판단*이 아님 — 사람이 9개 출력 중 무작위 3개를 직접 읽었을 때 *이게 같은 사람 사주가 맞나?* 라고 느낄 정도면 OK

### 5-3. 비용 알림

옵션 B (신규 LLM 호출) 시:
- 예상 토큰 수 + 비용 추정 *먼저 보고*
- 사용자 명시적 승인 후 호출

---

## 6. 보고

측정 완료 후 이 대화에 다음 4가지 전달:

1. **보고서 파일 경로 + 줄 수**
2. **5-1 충족도 표** (4개 기준 ✅/❌)
3. **5-2 진단 결과** (A/B/C 중 하나)
4. **가장 인상적인 발견** — 1~2줄 (예: "0번 대운과 4번 대운이 95% 일치", "9개 모두 같은 종결구조")

이 4가지면 Step 2(후속 결정)으로 즉시 진입 가능.

---

## 7. Claude Code 즉시 복사 프롬프트

```
ganji-saju 대운 LLM 다양성 측정을 진행해줘.

작업 지시서: docs/claude-specs/audit-task-B-daewoon-diversity.md (이 파일)
검수 배경: audit-reports/2026-05-22-comprehensive-audit.md §6
출력: audit-reports/2026-05-22-daewoon-diversity-measurement.md

[순서]
1. §3-1: 대운 풀이 LLM 호출 코드 위치 파악
2. §3-2: 대운 9개 풀이 데이터 수집
   - 옵션 A (캐시·DB) 우선 시도
   - 옵션 B (신규 호출) 필요 시 비용 추정 + 사용자 승인 받기
3. §3-3 ~ §3-6: 4축 측정 실행
4. §4: 보고서 작성
5. §6: 4가지 보고

[원칙]
- read-only (src/, scripts/ 코드 변경 금지)
- 신규 LLM 호출은 사용자 승인 후
- 측정 결과를 *판단*하지 말 것. 데이터만 제시.
  최종 진단(A/B/C)도 객관적 기준에 따라.

[시작 전 확인]
1. pwd가 /Users/kionya/ganji-saju 인가
2. 대운 풀이가 캐시·DB에 있는지 사전 확인
3. 측정 대상 사주를 §2 기본 후보로 진행해도 되는지

위 3개 확인 후 시작.
```

---

## 8. 한 줄 요약

> **9개 대운 풀이가 *실제로* 얼마나 다양한지를 4축(본문 유사도·제목 고유성·금지 문구·길이)으로 정량 측정. 결과 보고만, 보강은 별도 단계. read-only 원칙.**
