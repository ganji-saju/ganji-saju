# 띠운세 60갑자 확대 — 간지 기반 연생 resolver 설계

- 날짜: 2026-06-06
- 상태: 설계 확정 (구현계획 작성 대기)
- 상위 로드맵: `2026-05-24-content-enhancement-roadmap.md` 영역2(띠운세) 후속
- 기준 main: #411 머지 이후

## 1. 배경 / 문제

12지 각 띠는 `byYear`에 **5개 고정 연도**의 연생 풀이를 가진다(예: 닭띠 1957·1969·1981·1993·2005).
이 5개는 그 지지(예: 酉)가 60갑자에서 만나는 **5개 간지(乙酉·丁酉·己酉·辛酉·癸酉) 전체**를
대표한다 — 즉 12지×5 = **60갑자 해석이 콘텐츠상 이미 완비**됨.

문제는 **resolver**: `resolveSelectedYear`(`src/app/zodiac/[slug]/page.tsx:152`)가
`?birthYear=YYYY`를 byYear의 **정확한 키 5개로만** 매칭한다. 그래서 같은 乙酉 닭띠라도
**1945년생·2065년생은 풀이를 못 본다**(키에 없어 null). 다른 세대 사용자가 자기 연생
풀이에 닿지 못하는 게 핵심 한계.

## 2. 목표 / 비목표

**목표**: 어떤 출생연도든 그 **간지로 기존 5개 해석에 매핑**해 보여준다(전 세대 커버).
칩도 5개 고정 연도 → 세대별(범위 내 모든 해당 연도)로 확장.

**비목표(YAGNI)**: 연생 콘텐츠 재작성/추가(5개 해석 불변, D2/D3 확정 유지), 임의 연도
입력 UI(칩 기반 유지), 월·일주까지 분기(연주 간지만).

## 3. 설계

### 3.1 신규 유틸 — `src/lib/saju/year-ganji.ts`
```ts
// 연도 → 연주 간지(한자). 기준: 서기 4년 = 甲子. stem=(year-4)%10, branch=(year-4)%12.
export function yearToGanji(year: number): string; // 예: 2005 → '乙酉'
```
- STEMS(甲~癸)·BRANCHES(子~亥) 한자 배열은 `pillars.ts`와 동일 순서로 정의(순수 함수, 엔진 비의존).
- 검증: 2005→乙酉, 1969→己酉, 1957→丁酉, 1993→癸酉, 1981→辛酉(닭띠 5개와 일치).

### 3.2 resolver 리팩터 — `resolveByYear(item, raw)`
기존 `resolveSelectedYear`(년도 number 반환)를 대체:
```ts
function resolveByYear(item, raw): { year: number; fortune: ZodiacByYearFortune } | null
```
- raw 파싱 실패 → null.
- `item.byYear[year]` 정확 키 존재 → 그 항목.
- 아니면 `yearToGanji(year)` 계산 → byYear 항목 중 `.ganji`가 일치하는 것을 찾음 → 그 풀이를
  **입력 연도와 함께** 반환(표시는 "1945년생", 내용은 乙酉 해석).
- 일치 없음(그 연도의 지지가 이 띠의 지지와 다름, 예: 닭 페이지에 2004 갑신) → null(자가 검증).

### 3.3 칩 세대 확장 — `getGenerationYears(item, range)`
기존 `getByYearEntries`(5개)를 대체/보강:
- 범위 `[1930, 2026]`(Date 비의존 고정 상수) 내에서, byYear 5개 ganji 각각에 해당하는 모든
  연도를 `yearToGanji`로 수집 → 평탄화·중복제거·내림차순.
- 결과(닭띠 예): 2005·1993·1981·1969·1957 + 1945·1933 … 범위 내 세대 추가(약 7~10개).
- 칩 클릭 시 `?birthYear=Y`, 활성 판정은 선택 연도와 비교(기존 UI 그대로, 데이터 소스만 교체).

### 3.4 페이지 배선
- `selectedByYear`/`selectedYear`를 `resolveByYear` 반환으로 치환.
- 칩 `map` 대상은 `getGenerationYears`.
- href·active·period 유지 패턴 동일.

## 4. 영향 파일
| 파일 | 변경 |
|---|---|
| `src/lib/saju/year-ganji.ts` | 신규 — yearToGanji |
| `src/lib/saju/year-ganji.test.ts` | 신규 — 단위 |
| `src/app/zodiac/[slug]/page.tsx` | resolveSelectedYear→resolveByYear, getByYearEntries→getGenerationYears, 배선 |
| (선택) zodiac 페이지 테스트 | resolver 매핑 회귀(있으면 추가) |

## 5. 테스트 전략
- **yearToGanji**: 2005→乙酉, 1969→己酉, 1900→庚子, 2026→丙午 등 표준값.
- **resolveByYear 매핑**: 닭띠에서 1945 → 2005와 동일 fortune(ganji 乙酉)로 수렴; 정확 키
  2005도 동일; 닭 띠에 2004(갑신) → null.
- **getGenerationYears**: 닭띠 결과가 5개 고정연도를 포함하고, 범위 내 추가 세대(예 1945)도 포함.
- 기존 `free-content-pages.test.ts`의 EXPECTED_BY_YEAR(5개 강제)는 불변(콘텐츠 미변경).

## 6. 의료광고법
운세 콘텐츠, 신규 카피 없음(로직만). 비대상.

## 7. 리스크 / 가정 붕괴 조건
- **가정**: byYear 5개 entry의 `ganji`가 그 지지의 5개 간지를 정확히 덮음(EXPECTED_BY_YEAR
  테스트가 보증). 붕괴 시 일부 세대 매핑 누락 → null(안전 degrade).
- **리스크**: 음수/0 연도 등 비정상 입력 → `(year-4)%n` 음수. range 하한 1930으로 칩은 안전,
  resolver는 raw가 정수면 계산하되 매칭 없으면 null이라 안전.
- **리스크**: 범위 [1930,2026]가 미래 세대(2027+) 미포함 → 차기 확장 시 상한만 조정.
