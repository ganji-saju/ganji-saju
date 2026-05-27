# Step 3 — 대운 본문 한자/용어 치환 + 챕터 제목 다양화

> 2026-05-22 측정·후처리 확인 결과 발견된 **🔴 미적용 2건** 해결.
>
> 입력 자료:
> - `audit-reports/2026-05-22-daewoon-diversity-measurement.md` (측정 결과)
> - `audit-reports/2026-05-22-daewoon-postprocess-check.md` (후처리 확인)
>
> 출력 자료:
> - `audit-reports/2026-05-22-daewoon-fix-report.md` (작업 결과 보고)

---

## 0. 작업의 배경

### 0-1. 측정에서 확정된 사실

- ✅ **본문 다양성은 충분** — 평균 유사도 0.34 (목표 ≤ 0.40), 인접 사이클조차 0.48 < 0.5
- ✅ **자극 문구 0건** — naming-policy 준수
- ❌ **챕터 제목 중복** — 10 사이클 중 5개가 *제목 공유* (1개는 3회, 1개는 2회)
- ❌ **본문 한자 20건** — 60갑자 한자(`戊辰` 등)가 한글과 *중복 병기*되어 노출
- ⚠️ **명리 용어 78건** — 단 "대운"(56건 추정)은 naming-policy §7 사용 가능. 진짜 정리 대상은 **"천간/지지/일간 등"**

### 0-2. 후처리 확인에서 확정된 사실

- `enhanceLifetimeChapter9WithLLM`은 *챕터9(평생전략 요약) 한 필드만* 교체
- 대운 본문(`majorLuckTimeline` 사이클)은 *어떤 후처리도 통과하지 않음*
- 표시 컴포넌트(`saju/[slug]/deep` CycleCard)가 결정론 raw를 그대로 렌더
- 즉 **결정론 빌더 출력 = 사용자 노출 텍스트**

### 0-3. 즉 *원인*은 결정론 빌더에 있음

빌더가 명리 데이터를 *설명*하는 방식으로 문장을 짠다:

```
원본 (현재):
"戊辰 대운은 무진 대운에는 천간의 토 · 지지의 토 …"
└─한자 중복 ┘ └간지 두 번┘ └전문 용어┘

목표:
"무진 대운(2-11세)은 토 기운이 강하게 들어오는 시기예요"
└한글만┘                 └일상어┘
```

이걸 *후처리 치환으로 풀면 불가능* — 빌더의 *문장 템플릿 자체*를 수정해야 함.

다만 **생성 알고리즘은 그대로** 유지하면 다양성은 보존됨.

---

## 1. 목표와 비목표

### 목표 (DO)

1. **챕터 제목 다양화** — 10개 사이클 모두 *고유한 제목* (또는 최소 9개 고유)
2. **본문 명리 전문 용어 제거** — "천간/지지/일간/일주" 등을 일상어로
3. **본문 한자 한글화** — 60갑자 한자를 한글로 (`戊辰` → `무진`)
4. **검증 강화** — `daewoon-validator` 또는 유사 위치에 한자/용어 검사 추가
5. **회귀 방지** — 단위 테스트로 변환 결과 가드

### 비목표 (DON'T)

- ❌ 결정론 빌더의 **생성 알고리즘** 변경 (다양성 0.34 유지)
- ❌ 대운 본문의 **내용·길이** 변경 (어휘만 정리)
- ❌ 새 LLM 호출 추가 (변환은 *결정론적* 단순 치환)
- ❌ "대운" 단어 자체 제거 (naming-policy §7 OK 어휘)
- ❌ 12운성 한글(장생·제왕·병·사·묘 등) 제거 (naming-policy §7-§10 OK)
- ❌ UI 컴포넌트 *구조* 변경 (CycleCard 등은 그대로)

---

## 2. 작업 전 필수 사전 조사

**이 단계가 가장 중요합니다.** 실제 코드를 보지 않고 짠 지시서이므로, 사전 조사 후 *실제 코드 구조에 맞게* 작업 계획을 조정.

### 2-1. 결정론 빌더 위치 파악

```bash
echo "=== 대운 빌더 (majorLuckTimeline 생성) ==="
grep -rln "majorLuckTimeline\|buildMajorLuck\|daewoonCycles\|buildDaewoon" \
  src/ --include="*.ts" 2>/dev/null

echo ""
echo "=== 결정론 빌더 진입점 추정 ==="
grep -rln "orrery-adapter\|mapDaewoon\|daewoon-builder" src/ 2>/dev/null
```

### 2-2. 챕터 제목 생성 위치 파악

```bash
echo "=== 챕터 제목 생성 로직 ==="
grep -rn "chapterTitle\|chapter_title\|cycle.*title" \
  src/lib/ src/domain/ 2>/dev/null | head -20

echo ""
echo "=== 대운 raw-data.json 에서 실제 제목 ==="
cat audit-reports/2026-05-22-daewoon-raw-data.json 2>/dev/null \
  | grep -E "chapter_title|title" | head -20
```

### 2-3. 기존 한자→한글 매핑 자산

```bash
echo "=== withKoreanGanzi 함수 ==="
grep -rn "withKoreanGanzi\|toKoreanGanzi\|korean.*ganzi" src/ 2>/dev/null

echo ""
echo "=== 60갑자 한자 매핑 자산 ==="
grep -rln "갑자\|을축\|병인\|10천간\|12지지" src/lib/ src/data/ 2>/dev/null
```

### 2-4. 명리 용어 사전 (saju-terms-dictionary.json)

```bash
echo "=== 용어 사전 위치 ==="
find . -name "saju-terms-dictionary*" -not -path "./node_modules/*" 2>/dev/null

echo ""
echo "=== 천간/지지 변환 매핑이 사전에 있는지 ==="
grep -E "천간|지지" docs/claude-specs/05-saju-terms-dictionary.json 2>/dev/null | head -10
```

### 2-5. CycleCard 표시 컴포넌트

```bash
echo "=== CycleCard 위치 ==="
find src -name "*CycleCard*" -o -name "*cycle-card*" 2>/dev/null

echo ""
echo "=== 대운 렌더 진입점 ==="
find src/app -path "*saju*" -name "*.tsx" 2>/dev/null | xargs grep -l "daewoon\|major.*luck\|CycleCard" 2>/dev/null | head -10
```

### 2-6. 보고

사전 조사 결과를 다음 표로 정리:

| 영역 | 파일 경로 | 메모 |
|------|--------|----|
| 결정론 빌더 | ... | ... |
| 챕터 제목 생성 | ... | ... |
| 기존 한자→한글 매핑 | ... | 재사용 가능? |
| 용어 사전 | ... | 사용 중? |
| CycleCard | ... | ... |

**사용자 확인 후 §3 진행.** 이 단계에서 *예상 못한 구조*가 발견되면 즉시 중단·보고.

---

## 3. Phase A — 챕터 제목 다양화

### 3-1. 현재 중복 패턴 분석

```bash
echo "=== 10개 사이클 제목 현황 ==="
cat audit-reports/2026-05-22-daewoon-raw-data.json 2>/dev/null \
  | python3 -c "
import json, sys, collections
data = json.load(sys.stdin)
titles = [c.get('chapter_title', '') for c in data.get('cycles', [])]
print('전체 제목:')
for i, t in enumerate(titles): print(f'  {i}: {t}')
print()
print('중복 분포:')
counts = collections.Counter(titles)
for t, n in counts.most_common():
    if n > 1: print(f'  {n}회: \"{t}\"')
"
```

**보고할 정보**:
- 10개 제목 전체 목록
- 중복 패턴 (어느 사이클들이 같은 제목 쓰는지)
- 빌더가 *어떤 데이터*에 기반해서 같은 제목을 내는지 (12운성? 격국? 다른 분기 부족?)

### 3-2. 다양화 전략 — 3개 옵션 중 선택

코드 보고 *가장 자연스러운* 옵션 선택:

**옵션 ① — 12운성 + 나이대 조합**
```
"새 출발의 시기 (15-24세)"     ← 장생기
"본격 발휘기 (35-44세)"        ← 제왕기
"정리와 마무리 (75-84세)"      ← 묘기
```

**옵션 ② — 본문 키워드 추출**

각 사이클 본문에서 *가장 자주 등장하는 키워드*를 제목에 반영. NLP 없이 단어 빈도 카운트로도 충분.

**옵션 ③ — 사이클 번호 + 핵심 주제**
```
"1번째 흐름 — 자신을 알아가는 시기"
"2번째 흐름 — 자리를 다지는 시기"
...
```

**선택 원칙**:
- 결정론 빌더가 이미 *12운성 데이터*를 갖고 있으면 ① 자연스러움
- 본문 키워드 추출 함수가 이미 있으면 ②
- 둘 다 어려우면 ③

작업 지시서 §3-3은 ①을 기본 가정. 다른 옵션 선택 시 적절히 조정.

### 3-3. 옵션 ① 구현 명세 (12운성 + 나이대 조합)

```typescript
// src/lib/daewoon/title-builder.ts (신규 또는 기존 빌더 안에)

const UNSEONG_TITLE_THEMES: Record<string, string> = {
  '장생': '새로운 시작의',
  '목욕': '드러내고 다듬는',
  '관대': '자리를 펴는',
  '건록': '본격적인',
  '제왕': '정점의',
  '쇠': '한 박자 늦추는',
  '병': '돌아보는',
  '사': '비우는',
  '묘': '정리와 마무리의',
  '절': '깊이 안으로 향하는',
  '태': '새 씨앗이 자리잡는',
  '양': '천천히 영그는',
};

function buildCycleTitle(cycle: DaewoonCycle): string {
  const theme = UNSEONG_TITLE_THEMES[cycle.unseong] ?? '흐름이 바뀌는';
  const ageRange = `${cycle.ageStart}-${cycle.ageEnd}세`;
  return `${theme} 시기 (${ageRange})`;
}
```

**예상 결과**:
```
0: 새로운 시작의 시기 (2-11세)
1: 드러내고 다듬는 시기 (12-21세)
2: 자리를 펴는 시기 (22-31세)
3: 본격적인 시기 (32-41세)
4: 정점의 시기 (42-51세)
...
```

10개 모두 12운성이 *다른 한* 모두 고유. 만약 *같은 12운성*이 두 사이클에 등장하면 *나이대*로 자연스럽게 구분됨.

### 3-4. 폴백 — 12운성 중복 시

명리 시스템상 *같은 12운성*이 한 사주에서 두 번 나올 가능성은 낮지만, 만약 그럴 경우 *서수 prefix* 추가:

```typescript
// 같은 unseong이 이미 사용된 경우
if (usedThemes.has(theme)) {
  return `또 한 번 ${theme} 시기 (${ageRange})`;
}
```

이 패턴이 보기 어색하면 *나이대만으로* 구분.

---

## 4. Phase B — 본문 명리 전문 용어 제거

### 4-1. 정확한 대상 어휘

**제거 대상** (빌더 문장 템플릿 수정):

```
천간, 지지, 일간, 일주, 월주, 시주, 연주
시지, 월지, 연지
격국, 정인격, 편관격 (등 모든 격국명)
용신, 신강, 신약, 강약
순행, 역행
비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인
합, 충, 형, 파, 해, 원진, 공망, 신살, 양인, 도화, 역마, 화개
교운기
장생지, 목욕지, 관대지, 건록지, 제왕지 (~지 붙은 12운성)
```

**유지 가능** (naming-policy §7):

```
대운 (10년 단위 큰 흐름) — 첫 등장 시 짧은 설명
세운, 월운, 일진
12운성 한글 (장생, 제왕 등) — 첫 등장 시 짧은 설명
```

### 4-2. 문장 패턴 변환 가이드

빌더의 문장 템플릿에서 자주 등장하는 패턴 → 변환:

| 원본 패턴 | 변환 후 |
|---------|------|
| `천간의 X와 지지의 Y` | `X 기운과 Y 기운이 동시에` |
| `천간이 X, 지지가 Y` | `위쪽 흐름은 X 기운, 아래쪽 흐름은 Y 기운` |
| `천간 X가 들어오면서` | `X 기운이 들어오면서` |
| `지지에 자리잡은 Y` | `생활 흐름에 자리잡은 Y 기운` |
| `일간을 도와주는` | `본인의 기운을 도와주는` |
| `신강한 사주` | `본인 기운이 강한 사주` |
| `용신이 작동` | `보강 흐름이 작동` |
| `격국이 잡힘` | `사회적 역할이 명확` |

### 4-3. 변환 위치

빌더 코드에서 *문장 생성하는 위치*를 모두 찾아 매핑 적용:

```bash
# 빌더 안의 어휘 검색
grep -rnE "천간|지지|일간|용신|신강|신약" \
  src/lib/daewoon/ src/domain/daewoon/ src/server/daewoon/ 2>/dev/null \
  | grep -v "/__tests__/\|\.test\.\|\.spec\." | head -30
```

각 발견 위치에서 §4-2 변환 표 적용.

### 4-4. 문법 흐름 유지

단순 치환이 아니라 *문장 흐름*도 자연스러워야 합니다. 어색하면 *문장 구조 재작성*까지 OK:

**나쁜 예시**:
```
"천간 X가 들어와요"  →  "X 기운 기운이 들어와요" (오타 누적)
```

**좋은 예시**:
```
"천간 X가 들어와요"  →  "X 기운이 들어와요"
"지지 Y와 만나"      →  "현실의 흐름에 Y 기운이 자리잡아"
```

테스트로 어색한 결과(`기운 기운`, `위쪽 흐름 위쪽` 같은 중복) 검출.

---

## 5. Phase C — 본문 한자 한글화

### 5-1. 60갑자 매핑 테이블

```typescript
// src/lib/daewoon/koreanize-hanja.ts (신규)

const CHEONGAN_MAP: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
};

const JIJI_MAP: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
  '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해',
};

export function koreanizeHanja(text: string): string {
  let result = text;
  // 60갑자 한자 한글 치환
  for (const [hanja, hangul] of Object.entries({ ...CHEONGAN_MAP, ...JIJI_MAP })) {
    result = result.replaceAll(hanja, hangul);
  }
  return result;
}
```

### 5-2. 중복 병기 제거

빌더가 `"戊辰 대운은 무진 대운에는…"` 식으로 *한자+한글 동시 출력*하는 패턴이 있으면, **빌더 수정**으로 한자 부분만 제거. 후처리로는 어색한 결과(`"무진 대운은 무진 대운에는…"`)가 남음.

이 부분은 **빌더의 *간지 라벨 처리* 코드를 확인 후 결정**:

```bash
grep -rn "ganzi.*hanja\|ganzi.*korean\|withKoreanGanzi" src/lib/daewoon/ src/domain/ 2>/dev/null
```

기존 `withKoreanGanzi`가 *라벨만* 변환한다면, 본문에 직접 한자가 들어가는 위치를 찾아서 *애초에 한자를 안 쓰도록* 빌더 수정.

### 5-3. 적용 위치

두 가지 옵션:

**옵션 A — 빌더 안에서 처리** (권장)

빌더가 본문 문자열을 만드는 *마지막 단계*에 `koreanizeHanja()` 호출. 출력 자체가 한글.

```typescript
function buildCycleBody(cycle: Cycle): string {
  // ... 본문 생성 로직 ...
  const rawBody = `${cycle.ganji} 대운은 ...`;
  return koreanizeHanja(rawBody);  // ← 마지막에 변환
}
```

**옵션 B — 표시 컴포넌트 (CycleCard)에서 처리**

```typescript
function CycleCard({ cycle }) {
  const body = koreanizeHanja(cycle.body);
  return <div>{body}</div>;
}
```

옵션 A가 좋은 이유: *DB 캐시·로그·디버그 출력*에서도 한글로. 옵션 B면 캐시에는 한자 남음.

---

## 6. 검증

### 6-1. 단위 테스트 (신규)

```typescript
// src/lib/daewoon/__tests__/koreanize.test.ts

describe('koreanizeHanja', () => {
  it('60갑자 한자를 한글로 변환', () => {
    expect(koreanizeHanja('戊辰')).toBe('무진');
    expect(koreanizeHanja('甲子')).toBe('갑자');
    expect(koreanizeHanja('癸亥')).toBe('계해');
  });
  
  it('한자가 없으면 그대로', () => {
    expect(koreanizeHanja('무진 대운')).toBe('무진 대운');
  });
  
  it('한자와 한글 혼재 시 한자만 변환', () => {
    expect(koreanizeHanja('戊辰 대운')).toBe('무진 대운');
  });
});

describe('buildCycleTitle', () => {
  it('12운성에 따라 다른 제목', () => {
    const cycles = generateTestCycles();
    const titles = cycles.map(buildCycleTitle);
    expect(new Set(titles).size).toBeGreaterThanOrEqual(9);
  });
});
```

### 6-2. daewoon-validator 보강

기존 검증 함수에 추가:

```typescript
function validateDaewoonOutput(text: string): ValidationResult {
  const reasons: string[] = [];
  
  // ... 기존 검사 ...
  
  // 신규: 한자 검사
  const hanjaMatches = text.match(/[\u4e00-\u9fff]/g);
  if (hanjaMatches?.length) {
    reasons.push(`한자 누출 ${hanjaMatches.length}건: ${[...new Set(hanjaMatches)].join(', ')}`);
  }
  
  // 신규: 금지 명리 용어 검사
  const bannedTerms = [
    '천간', '지지', '일간', '일주', '월주', '시주', '연주',
    '시지', '월지', '연지', '격국', '용신', '신강', '신약',
    '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
    '원진', '공망', '신살', '양인', '도화', '역마', '화개',
    // '대운'은 제외 (naming-policy §7 OK)
  ];
  for (const term of bannedTerms) {
    if (text.includes(term)) reasons.push(`금지 용어: ${term}`);
  }
  
  return { ok: reasons.length === 0, reasons };
}
```

### 6-3. Step 1 측정 도구 재실행

작업 완료 후 측정 도구를 다시 돌려서 *같은 방식으로* 비교:

```bash
# 측정 스크립트 재실행 (있다면)
# 또는 audit-reports/2026-05-22-daewoon-raw-data.json 생성 로직 재실행

# 비교 항목
echo "=== 한자 누출 ==="
# 이전: 20건 → 목표: 0건

echo "=== 명리 용어 (대운 제외) ==="
# 이전: 78건 - "대운" → 목표: 0건

echo "=== 챕터 제목 고유성 ==="
# 이전: 7/10 → 목표: 9~10/10

echo "=== 본문 다양성 ==="
# 이전: 0.34 → 목표 유지: ≤ 0.40
```

---

## 7. 수용 조건

배포 전 모두 통과:

- [ ] **사전 조사 (§2)** 완료 후 사용자 확인 받음
- [ ] **챕터 제목**: 10개 사이클 중 *최소 9개 고유* (이상적으로 10/10)
- [ ] **본문 한자**: 0건 (이전 20건)
- [ ] **금지 명리 용어**: 0건 (이전 78건에서 "대운" 제외한 모두)
- [ ] **본문 다양성**: 평균 유사도 ≤ 0.40 *유지* (이전 0.34)
- [ ] **본문 길이**: 각 사이클 ±10% 이내 유지 (이전 평균 ~700자)
- [ ] **단위 테스트**: 신규 koreanize·title 테스트 통과
- [ ] **기존 157개 단위 테스트**: 깨지지 않음
- [ ] **daewoon-validator**: 한자/용어 검사 추가됨
- [ ] **read-only 환경**: `pwd === /Users/kionya/ganji-saju`
- [ ] **빌드 통과**: `npm run build` 정상

---

## 8. 자주 막힐 부분

### 8-1. "천간/지지"를 *자연스럽게* 풀어쓰기 어려움

`"천간 X, 지지 Y"` 같은 말은 *명리 구조 설명*이라 일상어 치환이 까다로움.

**해결책**: 의미적 *재작성*. 단어 단위 치환 대신 *문장 단위*로.

| 원본 | 단순 치환 (나쁨) | 의미 재작성 (좋음) |
|------|------------|--------|
| 천간 X · 지지 Y | X 기운 · Y 기운 | X 기운과 Y 기운이 함께 들어오는 시기 |
| 천간이 X인 대운 | X 기운인 대운 | X 기운이 두드러지는 대운 |

이 *문장 재작성*은 일부 *수작업*이 필요. Claude Code가 빌더 코드 보고 어색한 부분 1~2개 발견 시 *사용자에게 확인*하도록.

### 8-2. 12운성 *같은 이름*이 두 사이클에 나오는 경우

명리 시스템상 10년 단위 9사이클이라 *같은 12운성 반복* 가능. 예: 일부 사주에서 "쇠"가 두 번.

**해결책**: §3-4 폴백 — 나이대로 자연스럽게 구분.

### 8-3. 후처리 옵션 A vs B 결정

본문 한자 한글화를 빌더 vs CycleCard 중 어디서 할지. **옵션 A(빌더) 권장**. 다만 빌더 *진입점*이 여러 개면 누락 가능성. 그 경우 *옵션 A + B 이중 안전망*.

### 8-4. 다양성 0.34가 작업 후에도 유지되는가

핵심 우려. *어휘만* 변경해도 단어 빈도가 바뀌면 유사도 측정값에 영향. 

**해결책**: 작업 후 측정 재실행. 0.40 초과 시 *부분 롤백* 후 재시도.

---

## 9. Claude Code 즉시 복사 프롬프트

```
ganji-saju 대운 본문/제목 정리 작업 (Step 3)을 진행해줘.

작업 지시서: (이 파일)
배경 자료:
- audit-reports/2026-05-22-daewoon-diversity-measurement.md
- audit-reports/2026-05-22-daewoon-postprocess-check.md

[작업 범위]
A. 챕터 제목 다양화 (10/10 고유)
B. 본문 명리 전문 용어 제거 (천간/지지 등)
C. 본문 한자 한글화 (60갑자)
D. daewoon-validator 보강
E. 단위 테스트 추가
F. 측정 도구 재실행으로 검증

[비범위]
- 결정론 빌더의 *생성 알고리즘* 변경 금지
- 본문 내용·길이 변경 금지
- LLM 호출 추가 금지
- UI 컴포넌트 구조 변경 금지

[순서]
1. §2 사전 조사 — 빌더·제목·매핑 자산 위치 파악
   → 결과 보고 후 사용자 확인 받기
2. §3 Phase A — 챕터 제목 다양화
3. §4 Phase B — 명리 용어 제거
4. §5 Phase C — 한자 한글화
5. §6 검증 — 단위 테스트 + validator + 측정 재실행
6. §7 수용 조건 11개 모두 통과 확인

[원칙]
- 각 Phase 완료 시 한 줄 보고
- §8 자주 막힐 부분 발견 시 사용자에게 확인
- 빌더 코드 안에서 *생성 알고리즘*이 아닌 *어휘·템플릿*만 수정
- 사전 조사 §2 결과가 작업 가정과 *크게 다르면* 즉시 중단·보고

[보고]
완료 시 audit-reports/2026-05-22-daewoon-fix-report.md 작성 + 이 대화에:
1. 변경된 파일 목록 (src/ + scripts/ + tests)
2. 측정 재실행 결과 표 (이전 vs 이후)
3. §7 수용 조건 11개 ✅/❌
4. 가장 인상적인 변화 1줄

[시작 전 확인]
1. pwd가 /Users/kionya/ganji-saju 인가
2. 마지막 머지 #320 적용된 상태인가
3. audit-reports/ 쓰기 권한 OK

위 3개 확인 후 §2 사전 조사부터 시작.
```

---

## 10. 후속 — 검수 보고서 갱신

작업 완료 후 *검수 보고서 §11-2 분류 갱신*:

| 작업 | 이전 | **갱신 후** |
|------|----|---------|
| 7. 어휘 정책 | 🟢 → 🟡 → **🟢** | 대운 본문 정리 완료 |
| 9. 대운 9개 다양성 | 🟡 → **🟢** | 측정 통과 (0.34) |
| 9a. 챕터 제목 다양화 | 🔴 → **🟢** | 신규 해소 |
| 7a. 대운 본문 한자/용어 | 🔴 → **🟢** | 신규 해소 |

**총합**: 🟢 12 → **🟢 14** (모든 핵심 항목 완료). 

검수 보고서에 다음 줄 추가:
```markdown
## 갱신 — 2026-05-22 Step 3 작업 결과

§11-2의 🟡 부분 1건 + 🔴 미적용 2건이 모두 🟢 완료로 갱신됨.
audit-reports/2026-05-22-daewoon-fix-report.md 참조.

총합: 🟢 14 / 🟡 0 / 🔴 0 / ⚪ 0
```

---

## 11. 한 줄 요약

> **결정론 빌더의 *생성 알고리즘은 그대로*, *문장 템플릿·제목 생성 룰·한자 출력*만 정리. 측정 도구로 작업 후 0건/0건/9~10건 고유/0.34 유지 확인. 검수 보고서를 🟢 14 / 🟡 0 / 🔴 0 으로 갱신.**
