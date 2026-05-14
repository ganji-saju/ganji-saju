# 사주 풀이 정확도 진단 — 2026-05-15

조사 범위: `src/lib/saju/`, `src/domain/saju/{engine,validation,validators,report}`, `src/server/{today-fortune,ai}`, `src/app/saju/[slug]/`. Read-only audit.

---

## 요약 (top-line)

5명 모두가 "맞지 않는다"고 답한 부정 피드백에 대해 가장 가능성 높은 원인은 **계산 정확도 문제가 아니라 풀이 카피의 일반화 (genericity)** 입니다. 4기둥 산출 자체는 검증된 라이브러리(`lunar-typescript`) + KASI 비교 모듈로 묶여 있어 어지간한 케이스는 정확합니다. 다만 결과 화면에 노출되는 카피는 거의 전부가 "오행/십성 키워드 → 사전 정의된 generic 문장 슬롯에 끼우는" 템플릿 방식이라, 격국·용신·일주·대운을 한 사람의 narrative 로 엮지 않고 독립 카드로 흩어 뿌립니다.

- **P0 — 카피가 generic 합니다.** Hero "한 줄 요약" 은 `punch-copy.ts` 의 `firstNonEmpty([…], '오늘은 먼저 확인할 때입니다.')` 기반이고, fallback 문장과 실제 명식 기반 문장이 같은 모양으로 출력돼 누구에게나 적용 가능한 인상을 줍니다. 분야별 점수 summary (`buildScoreSummary`, `build-report.ts:546`) 도 ≥80/≥70/그 외의 3-bucket switch 라 같은 점수대의 5명이 거의 동일한 문장을 받습니다.
- **P0 — narrative integration 부재.** 일간 / 격국 / 용신 / 대운·세운이 별도 evidence card 로만 존재하고 `buildSajuReport` 의 어디서도 "정관격이라서 + 일간 壬이라서 + 화 용신이라서 → 그래서 당신은 …" 같이 인과를 합쳐 한 단락으로 풀어주지 않습니다 (`build-report.ts:1208 buildInsights` 의 3-block 구조 참고).
- **P1 — AI 풀이가 fallback 으로 떨어지면 거의 모두가 generic.** `OPENAI_API_KEY` 가 비어 있거나 응답이 비면 `buildFallbackInterpretation` (`saju-interpretation.ts:49`) 이 evidenceJson 의 `plainSummary` 만 한 줄씩 이어붙입니다. fallback 카피 자체가 "균형을 잡으면 좋아지는 날" 결로 추상적이어서, 5명 중 AI 미발화 케이스가 한 명이라도 있었다면 부정 피드백의 직접 원인이 됩니다.
- **P1 — 자시 분리(早子/夜子) 기본값 모호, 진태양시 기본 비활성, 분 정보 25:30 만 대체.** 자시 케이스 사용자가 split/unified 둘 중 무엇을 받는지 입력 단계에서 강하게 안내되지 않고 (`unified-birth-entry.ts:95`), 진태양시는 명시 선택 시에만 동작합니다 (`birth-location.ts:104`).
- **P2 — 신살·공망·12운성·합충 (가시 산출 없음).** lunar-typescript 가 제공 가능한 항목임에도 산출/노출 모두 없습니다. "다른 사주 사이트보다 얕다" 는 인상을 만듭니다.

---

## 1. 계산 엔진 정확성 (산출의 정확도)

### (a) 절기 산출 — `lunar-typescript`
모든 4기둥 계산은 `Solar.fromYmdHms(...).getLunar().getEightChar()` 단일 경로 (`pillars.ts:133–151`) 이고 `eightChar.setSect(...)` 만 jasiMethod 에 따라 1/2 로 바꿉니다. `lunar-typescript` 는 한·중 명리권에서 표준으로 쓰이는 8자 계산기로, 연주는 **입춘(立春) 기준**, 월주는 **24절기 절입 시각** 으로 산출됩니다. 별도 절기 테이블을 우리가 보관하지 않으므로 lib 의 절기 정확도에 종속됩니다. (라이브러리는 평년 ±수 분 단위까지 안정.)

### (b) 자시 분리
`pillars.ts:64`
```ts
function getEightCharSect(jasiMethod?: JasiMethod) {
  return jasiMethod === 'split' ? 1 : 2;
}
```
- `split` (조자/야자 분리) = sect 1 — 23시 이후를 다음날로 보지 않고 早子時·夜子時 로 나눔.
- `unified` (통합) = sect 2 — 23시부터 다음날의 子時.
- 기본값은 `unified-birth-entry.ts:95` 에서 `timeRule === 'earlyZi' ? 'split' : 'unified'`. 즉 사용자가 명시적으로 "조자시" 시간규칙을 고르지 않으면 무조건 통합 사용. 5명 중 23시~01시 사이 출생자가 있다면 그가 의도한 방식과 다를 가능성이 있습니다.

### (c) 진태양시 (true solar time)
`birth-location.ts:61`
```ts
return Math.round((longitude - standardMeridian) * 4);
```
- 단순 경도차×4분만 적용. **균시차(Equation of Time, ±16분)** 보정은 없음.
- 그리고 `solarTimeMode === 'longitude'` 이고 `birthLocation` 이 있을 때만 동작 (`birth-location.ts:103-105`). 기본은 `standard` 라서 *사용자가 진태양시를 명시적으로 체크해야* 발동합니다. UI 에서 디폴트 비활성이면 서울 출생자(경도 126.978) 는 항상 +33분 보정이 안 들어가, 시주 / 자시 경계 케이스에서 한 글자가 틀릴 수 있습니다.

### (d) KASI 비교 결과
`src/domain/saju/validation/kasi-calendar.ts` 에 6개 sample fixture 가 있고 `compareKasiWithLocalSample` 가 lunarYear/Month/Day, lunLeapmonth, lunIljin(일진) vs `pillars.day.ganzi` 를 비교합니다. 다만 — **`audit-reports/` 내에 실제 KASI 실행 결과가 저장된 파일은 없습니다.** 즉 비교 모듈은 만들어 두었지만 정기 회귀 보호 결과는 commit 되어 있지 않습니다. (`audit-reports/` 에는 디자인/payment/seo 류만 존재.)

### 잠재 위험
- `birth-location.ts:107` `const minute = input.minute ?? 30;` — 분 미입력 시 30분으로 고정. 자시·진태양시 경계에서 한 글자 차이 유발.
- `birth-location.ts:140-156` `getBirthCalculationDateTime` — unknownTime 일 때 12시 0분으로 하드코딩. 시주 없음 의도지만 lunar-typescript 는 12시로 일주 계산을 그대로 함. 일주 경계 자정 출생자는 시간 모르면 일주가 흔들릴 수 있음.
- `pillars.ts:143` setSect 가 *항상* 호출되어 `getEightChar()` 가 캐시한 값을 덮어쓸 수 있음. lunar-typescript 버전에 따라 동작 차이 가능.

---

## 2. 도메인 개념 산출 (십성/격국/용신/대운…)

| 개념 | 파일 / 함수 | 규칙 | 한계 |
|---|---|---|---|
| 십성 | `saju-data-v1.ts:1174 getTenGod` | 일간 오행 vs 대상 오행의 5관계 + 음양 동일 여부 | 정확. 단 지장간 가중치 `[0.7, 0.4, 0.2]` 는 임의 값 |
| 오행 점수 | `saju-data-v1.ts:801 calculateFiveElements` | 천간 1.2점, 지지 1.0점, 지장간 본/중/여기 0.7/0.4/0.2 | 통상적 비율이긴 하나 출처 명시 없고, 월령 강화 / 합화 / 공망 반영 없음 |
| 신강·신약 | `saju-data-v1.ts:871 calculateStrength` | base 50 + 계절 보정(+18~−10) + (support − drain)·6 | score≥67 신강, ≤43 신약, 그 외 중화. **임계값 67/43은 임의 fixture-tuned**. fixture 1982-01-29 가 score=66 으로 신강 경계 1점 차이. 다른 사주가 비슷한 경계에 있으면 사용자 체감과 어긋남 |
| 격국 | `saju-data-v1.ts:908 calculatePattern` | 월지 지장간 1순위(본기) 의 십신 → 격국명 | **월지 본기만 보고 단정.** 천간 투출, 합/충, 시지 협력 없음. v2 표시는 "정관격 후보" 로 보수화하지만 산출 자체가 얕음 |
| 용신 | `saju-data-v1.ts:933 calculateYongsin` | 조후 override (5종 hardcoded) + 억부(신강/신약 분기) + 희기신보정(약/강 오행) 의 3 candidate 중 점수 1위 | 조후 override 가 `목-spring / 화-summer / 토-earth / 금-autumn / 수-winter` 5개만 (`:1346-1376`). 일간 ≠ 계절 메인 오행 케이스 (예: 壬水일간 丑월) 는 조후 후보 0 → 억부+희기신만 가지고 결정. fixture 1982-01-29 가 정확히 이 케이스이고 결과는 `희기신보정 화` (실제 만세력 기준으로는 합리적이지만 산식 자체가 얇음) |
| 대운/세운/월운 | `saju-data-v1.ts:1381 calculateLuckData` | lunar-typescript `getYun(gender, sect).getDaYun(11)` 으로 라이브러리 위임. 세운은 `getLiuNian()`, 월운은 현재 양력 기준 `getMonth()` | 대운 시작 나이 미세조정(절기 일수 보정) 없음 (`:1487 "절기 일수 미세보정 전"` 자체 표기). 대운 startAge ±1년 정도 차이 가능 |
| 공망 | 없음 | — | **미산출.** `src/server/classics/evidence.ts:99` 에서 키워드만 등장 |
| 신살 (12신살, 도화·역마·천을귀인 등) | 없음 | — | **미산출** |
| 12운성 | 없음 | — | **미산출** |
| 합/충/형/해/회 | 부분 | `build-today-fortune.ts:1722` 에서 육합만 score delta 용으로 사용 | 명식 내부의 삼합·방합·천간합·지지충·삼형 등 명시 산출 없음 |

---

## 3. 풀이 카피 톤 (사용자 체감)

### 노출 카피 layer

1. **Hero "한 줄 요약"** (`/saju/[slug]/page.tsx:357`): `easyResultCopy(punchReading.verdict, 1)` — `punch-copy.ts:241 buildPunchReading` 가 만들고, 그 안의 `firstNonEmpty([…], '오늘은 먼저 확인할 때입니다.')` 가 fallback. verdict 가 비면 fallback 문장이 그대로 노출됩니다.
2. **분야별 흐름 점수 4개** (`/saju/[slug]/page.tsx:421-470`): 점수 + 막대만 표시. summary 문장은 `details(접힘)` 안 (`build-report.ts:546 buildScoreSummary`) — switch 가 ≥80/≥70/else 3-band 라 같은 점수 사용자끼리 거의 동일.
3. **"더 깊이 들여다보기"** (`/saju/[slug]/page.tsx:567-654`): 왜/조심/오늘 할 일 3 카드. 모두 `compact(text, 42~64)` 잘림이라 60자 미만 문장. 본문이 짧고 잘려서 결국 generic 인상.
4. **v2 insight panel** (`SajuV2InsightPanel`, `build-report` 와 별도, `saju-data-v2-upgrade.ts:498`): foundation / balance / pattern / yongsin / luck-flow 5블록. v2 카피는 evidence claim 단위로 검증 가능한 형태이지만 — 문장이 "내 핵심 기질은 X의 큰 나무처럼 풀이됩니다. 다만 기질 하나만 보지 말고 …" 류 메타 안내가 다수라 "이 사람만의 이야기" 라기보다 "사주가 무엇인지 알려주는 글" 처럼 읽힙니다.

### Generic vs 구체 키워드 비율 (추정)

`buildScoreSummary` (`build-report.ts:546`) 5×3=15 슬롯 / `buildSummaryHighlights` (`:577`) topic 5종 × 3문장 / `buildTopicActions` (`:1035`) topic 5종 × 2문장 / `getHeadline` (`:999`) topic 5종 × 2분기 — 총 ~70여 개 템플릿이 모두 `{dominant}이 살아 있어 / {weakest}이 비기 쉬워 / {support}을 챙기면` 류 문장 슬롯입니다. 즉 5명 사용자가 dominant/weakest 오행이 같다면 거의 같은 본문을 받습니다.

### narrative integration 검사

`build-report.ts:1208 buildInsights` 는 3 블록을 반환합니다:
1. 타고난 반응 — `getPersonalityFromSajuData(data)` (일간 기반)
2. 내 안의 균형 — dominant / weakest
3. 질문 포커스 — topic 별 generic

이 3 블록 사이에 **인과 연결이 없습니다.** "壬水 일간이라 → 丑월에 — → 신강에 가까워 → 화 용신" 같이 한 흐름으로 엮는 코드가 없고, 각각 독립 슬롯에 들어갑니다. 5명 모두가 "내 얘기 같지 않다" 고 한 가장 큰 카피 측 원인은 여기에 있습니다.

### AI 풀이 카피

`saju-interpretation.ts:336` 의 instructions 는 "personalizationContext / factJson / evidenceJson 안에서만 해석" + "사람마다 다른 결론" + "내부 용어 본문 노출 금지" 로 강하게 잡혀 있어 잘 발화하면 품질이 높습니다. 그러나 OpenAI 미설정/응답 빈 경우 `buildFallbackInterpretation` 으로 떨어지고, fallback 은 evidenceJson 의 `plainSummary` 를 단순 연결합니다 (`saju-interpretation.ts:60-86`). 이 plainSummary 들이 바로 위 build-report 가 만든 generic 문장과 같아 5명 중 fallback 받은 사용자는 더욱 generic 한 결과를 봅니다.

---

## 4. 다른 사주 사이트 대비 빠진 항목

| 항목 | 우리 산출 | 우리 노출 | 우선순위 |
|---|---|---|---|
| 4기둥 천간/지지/오행 | O (정확) | O | — |
| 일간 (內 기질) | O | O (`punch-copy`) | — |
| 십성 분포 | O (`tenGods.byType`) | △ (v2 패널 내부만) | P1 |
| 오행 점수/비율 | O (지장간 가중치 포함) | O (5-bar) | — |
| 신강/신약 | O (점수+레벨) | O (v2 패널) | — |
| 격국 | O (월지 본기 한정) | O ("후보") | P1 — 천간 투출/협력 강화 |
| 용신/희신/기신 | O (3 method 가중) | O (v2 패널) | — |
| 대운 10기 | O (lunar-typescript) | O (`saju/[slug]/deep`) | — |
| 세운 (올해) | O | O | — |
| 월운 (이번 달) | O | O | — |
| 일운 (오늘) | O (build-today-fortune) | O | — |
| 공망 (空亡) | **X** | X | P1 |
| 12신살 (역마/도화/화개/천을귀인 등) | **X** | X | P1 |
| 12운성 (장생·목욕·관대 …) | **X** | X | P2 |
| 합/충/형/해 (천간합·지지충·삼합·방합·삼형) | △ (육합만 today delta) | X | P1 |
| 백호/괴강/양인 등 특수 신살 | **X** | X | P2 |
| 궁(年/月/日/時) 의미 — 부모궁/배우자궁/자녀궁 | X (concept 만) | X | P2 |
| 60갑자 일주별 특성 카드 | O (`personalizationContext.sixtyGapja`) | △ (AI prompt 용, UI 노출 약함) | P1 — UI 에 더 크게 |

→ 사용자가 다른 만세력 사이트에서 흔히 보던 "도화살이 있어서 …", "공망에 申酉가 있어서 …", "甲己合 으로 …" 같은 **구체 hook** 이 우리 화면엔 전혀 없습니다. "이 사이트가 얕다" 인상의 직접 원인.

---

## 5. AI/LLM 풀이 사용 방식

- 엔드포인트: `src/app/api/interpret/route.ts` POST. caching 키 = `readingId × topic × promptVersion(counselorId)`, Supabase `ai_interpretations` 테이블.
- 모델 기본: `gpt-5.2-chat-latest` (`openai-text.ts:28`). timeout 15s, maxOutputTokens 900 (interpret route), temperature 0.7.
- prompt 구조 (`saju-interpretation.ts:223 buildStructuredInterpretationInput`): `===사주 원국=== + 일간/년주/월주/일주(60갑자코드)/시주 + 오행% + 십성 + 강약 + 용신/희신/기신 + 대운현황 → ===이 사주의 고유 특성=== → ===풀이 지시=== → [원본 데이터 JSON]` 형식. **fact + evidence JSON 이 그대로 들어감.** 좋은 grounding 패턴.
- 응답 스키마: `{ headline, summary, insights[] }`. JSON 파싱 실패하면 fallback (`parseInterpretationText`).
- fallback (`buildFallbackInterpretation`): evidenceJson plainSummary + sixtyGapja core / actionCue 를 단순 join. **AI 미발화 케이스는 사실상 build-report 의 generic 문장만 노출.**
- yearly / lifetime 도 같은 패턴 (`saju-yearly-interpretation.ts`, `saju-lifetime-interpretation.ts`).

→ AI 가 발화하는 한 카피 품질은 좋은 편입니다. 다만 fallback path 가 너무 평탄해 KEY 미설정 / 응답 실패 시 사용자가 "그냥 균형 잡으라는 말" 만 보게 됩니다. 5명 중 일부가 fallback 케이스였을 가능성이 큽니다.

---

## 6. 회귀 테스트 / fixture 커버리지

- **고정 fixture 1**: `fixture-19820129.spec.ts` — 1982-01-29 08:45 男 서울, `壬子` 일주. 4기둥 / 일간 / strength=66 / pattern=정관격 / yongsin=화 / fiveElements 점수까지 핀. v2 라벨도 검사. 잘 됨.
- **고정 fixture 2**: `saju-cross-fixtures.spec.ts` — 3 명식 (2000-01-01 戊午, 1990-05-17 壬午, 1995-08-15 戊寅) baseline pin. 단 spec 안에 *"공식 만세력과 spec 으로 교차"* 라고 적혀 있지만 **외부 만세력과의 일치 확인은 KASI 비교 모듈로 분리**되어 있고 자동화된 비교는 안 함.
- **음력 / 윤달 / 절입일 fixture**: KASI sample 6종 (`kasi-calendar.ts:56`) 에 윤일/설날/윤2월 시작/입춘 인접 포함. 그러나 KASI API key 가 있어야 실행되고, audit-reports 에 실제 비교 결과 .md 가 없습니다.
- **자시 fixture**: `kasi-calendar.ts:92` 의 `jasi-boundary-reference` 1982-01-29 23:30 split — 음력일만 비교, day pillar 비교는 끔. 즉 split/unified 동작이 회귀 테스트로 보호되지 않습니다.
- **unknownTime fixture**: pillars.test.ts:36 에 slug 보존만 검증, 출력 사주값 보호 없음.

---

## 7. 6번 케이스별 동작 (정확도 의심 신호)

### 새벽 시간 (23~01시) 출생
- jasiMethod 가 `unified` (기본) 면 sect=2: 23시 ~ 익일 1시 모두 다음날 자시.
- `split` 이면 sect=1: 23시 ~ 자정은 그날 야자시(夜子時), 자정 ~ 01시는 다음날 조자시(早子時) → 일주가 한 글자 바뀜.
- UI: `unified-birth-entry.ts:9-25` 에 `timeRule: 'earlyZi'` 옵션이 있고 (`features/saju-intake/saju-intake-page.tsx:276`), 사용자가 의식적으로 골라야만 split. **default unified.**
- 23시~01시 출생자가 5명 중 있고 본인이 split 방식 만세력을 본 적 있다면, 우리 결과가 그 만세력과 한 글자 다를 수 있어 "안 맞는다" 가 됨.

### 절입일 출생
- lunar-typescript 가 절입 시각까지 반영하여 월주를 산출하므로 정확. 단 **진태양시 보정이 꺼져 있으면** 출생지 경도 차이가 절입 시각에 ±30분 영향 → 월주 한 글자 차이.

### 미상 시간 (unknownTime=true)
- `birth-location.ts:153` 에서 hour=12, minute=0 으로 하드코딩 → lunar-typescript 가 시주를 계산해 버리고 pillars.ts:148 에서 `input.unknownTime` 분기로 hour pillar 만 null 처리. **그러나 일주가 자정 경계에 있으면 12시 가정으로 같은 일자 처리되어 안전.**
- 위험: AI prompt 에 시주가 "미상" 으로 들어가는데 v1 점수 (오행 점수 등)는 *0 가중치가 아니라 단순히 hour pillar 가 빠진 상태로 계산*. 즉 4기둥 → 3기둥인데 비율은 100% 로 정규화돼서 오행 강세가 출생시 미상자에서 왜곡됩니다. (`saju-data-v1.ts:585` percentage 계산 보면 totalScore 가 3기둥 합).

### 음력 입력
- `unified-birth-entry.ts:71` `Lunar.fromYmd(year, month, day).getSolar()` → 양력으로 변환 후 처리. 윤달 입력(예: 윤2월) 은 UI 에서 지원 못 함 (calendarType 만 있고 leapMonth flag 없음). **윤달 출생자가 평달로 입력되면 한 달 어긋남.**

---

## 8. 개선 우선순위 제안

### P0 — 카피 narrative 통합 (가장 큰 사용자 체감 변화)

1. `src/domain/saju/report/build-report.ts:1208 buildInsights` 를 재구성해 "일간 + 격국 + 용신 + 현재 대운" 을 한 단락으로 엮은 narrative insight 1개를 항상 첫 슬롯에 노출. 현재 3블록은 모두 독립 문장.
2. `src/domain/saju/report/punch-copy.ts:241 buildPunchReading` 의 verdict 가 fallback 문장 `'오늘은 먼저 확인할 때입니다.'` 로 떨어지지 않게, *반드시* sixtyGapja.core + 격국명 + 용신 오행 중 최소 2 키워드를 포함하는 verdict builder 추가.
3. `src/app/saju/[slug]/page.tsx:357` Hero 카피를 `personalizationContext.sixtyGapja.title` (예: "壬子 — 큰 강의 일주") + 격국 후보를 같이 노출. 60갑자 일주 데이터가 이미 산출돼 있는데 UI 에서 안 씀.

### P0 — AI fallback 품질

4. `src/server/ai/saju-interpretation.ts:49 buildFallbackInterpretation` 의 fallback 도 build-report 가 아닌 fact/evidence JSON 자체에서 키워드 2~3개 (격국명, 용신 오행 한국어, 강약 점수, 현재 세운 ganzi) 를 명시적으로 결합한 문장으로 교체. 현재는 generic plainSummary 만 join.
5. `src/app/api/interpret/route.ts:243` 에서 `aiResult.source === 'fallback'` 일 때 UI 가 표시할 표식 (배지) 강화. 사용자가 "AI 응답 실패" 임을 모르고 본문을 평가하는 게 가장 큰 부정 피드백 트리거.

### P1 — 빠진 항목 산출 + 노출

6. `src/domain/saju/engine/saju-data-v1.ts` 에 공망 / 12신살 / 12운성 산출 추가 (lunar-typescript `EightChar.getXun()`, `getYun()` 활용). v1 schema 의 `extensions` 슬롯에 넣고 v2 패널에서 1 카드로 노출.
7. 합·충·형 산출: `BRANCH_HIDDEN_STEMS` 외에 `BRANCH_HARMONY_TABLE` / `BRANCH_CONFLICT_TABLE` 을 추가하고 `enrichPillars` 단계에서 명식 내부 관계 카드를 만듦.
8. `src/lib/saju/birth-location.ts:107` 의 `minute ?? 30` 디폴트를 입력 단계에서 사용자가 명시하도록 강제하거나, fallback 0 분으로 변경하고 그 사실을 카피에서 디스클로즈.

### P1 — 정확도 보호

9. KASI 6 sample 비교 결과를 CI 에서 정기 실행하고 결과를 `audit-reports/kasi-comparison-<date>.md` 로 commit. 현재 모듈만 있고 실측 결과가 저장돼 있지 않음.
10. 자시 분리 fixture 추가: `fixture-19820129.spec.ts` 류로 23:30 출생 split / unified 두 모드 모두 핀.
11. `src/lib/saju/birth-location.ts:61 getSolarTimeOffsetMinutes` 에 균시차(EoT) 보정 추가. 현재 경도 차만 반영해서 시주 경계 사례에서 한 글자 어긋날 수 있음.
12. 음력 윤달 입력 지원: `unified-birth-entry.ts:71` 에 `Lunar.fromYmdHms(year, ±month, day, …)` 음수 month convention 으로 윤달 처리. UI 에 윤달 체크박스 추가.

### P2 — 측정·관측

13. `today-fortune/feedback` 라우트가 있으므로, 부정 피드백 응답에서 `fallbackReason / dominant / weakest / strength.level / pattern.name` 를 함께 저장. 같은 명식 axis 의 사용자가 동일 패턴으로 부정을 주는지 검증.
14. 강약 임계값 67/43 (`saju-data-v1.ts:894`) 의 출처/근거 문서화. 현재 1982-01-29 fixture 1개에 fitted 된 인상.
15. 격국 산출 강화: `calculatePattern` 이 월지 본기만 보고 단정하지 않고, 월간(月干) 천간 투출 / 시지 협력 / 지장간 중·여기 가중까지 본 후 confidence 와 함께 노출 ("정관격 후보 confidence 중간").

---

## 결론

**5명이 동시에 "안 맞는다"고 답한 가장 큰 원인은 계산 오류가 아니라 카피 generic 입니다.** 4기둥 / 십성 / 용신 / 대운 산출은 표준 라이브러리 기반으로 합리적인 정확도를 가지고 있고 회귀 fixture 도 갖춰져 있습니다. 다만 결과 화면 카피가 ① "왜 이 사람만의 이야기인가" 의 narrative 가 없고, ② AI fallback path 가 너무 평탄하며, ③ 공망·신살·12운성·합충 같은 사용자 친숙 hook 이 노출되지 않습니다. P0 (narrative 통합 + AI fallback 보강) 두 가지만 먼저 처리해도 5명 중 다수의 체감 정확도가 즉시 개선될 것으로 봅니다.

핵심 참조 파일:
- `/Users/kionya/ganji-saju/src/lib/saju/pillars.ts`
- `/Users/kionya/ganji-saju/src/lib/saju/birth-location.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/engine/saju-data-v1.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/engine/saju-data-v2-upgrade.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/validation/kasi-calendar.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/report/build-report.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/report/punch-copy.ts`
- `/Users/kionya/ganji-saju/src/server/ai/saju-interpretation.ts`
- `/Users/kionya/ganji-saju/src/server/ai/openai-text.ts`
- `/Users/kionya/ganji-saju/src/server/today-fortune/build-today-fortune.ts`
- `/Users/kionya/ganji-saju/src/app/saju/[slug]/page.tsx`
- `/Users/kionya/ganji-saju/src/app/api/interpret/route.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/engine/fixture-19820129.spec.ts`
- `/Users/kionya/ganji-saju/src/domain/saju/engine/saju-cross-fixtures.spec.ts`
