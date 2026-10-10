# 풀이 품질 점검 C — 궁합 / 올해운세·2027 신년(월별 제외)

읽기 전용 점검. DB·유료 API 접근 없음. 줄 번호는 2026-10-10 기준 브랜치 fix/new-year-pdf-titles.
⚠️ 검증필요 표시는 코드로 확정 못 한 것(운영 env 값, 시중 앱 내부 구성 등).

## 0. 결론 요약
- 궁합: 결제자에게 나가는 "깊은 풀이"는 env `OPENAI_INTERPRET_COMPATIBILITY=1` 일 때만 LLM(3~5섹션x500~800자). OFF 면 결정론 4섹션이며 한 섹션이 실천 한 문장 수준(≈100~200자). ⚠️ 운영 env 값은 확인 못 함(코드 기본 OFF).
- 신년: 프롬프트가 서로 모순된다. "한 문단 2~3문장 / 짧게 잘라 / 모바일 운세 데이터"와 "분야별 7~10문장 400~650자"가 같이 들어간다. 근거 쪽은 세운이 "천간 오행 vs 일간 오행 5갈래" 하나로 압축돼 있다.
- 빠진 근거 공통: 두 상품 모두 대운 시기 비교, 지지 합충(일지 외), 십성(세운/상대)이 AI·계산에 안 넘어간다. 계산 함수(getCycleSipsin, detectComprehensiveSinsals 삼재)는 저장소에 이미 있는데 연결이 안 됐다.

---
## 1. 궁합 (src/server/ai/compatibility/, src/lib/compatibility.ts, src/lib/compatibility/)

### 1-1. 사용자에게 나가는 항목과 길이 지시
| 항목 | 생성 방식 | 길이 지시/상한 | 위치 |
|---|---|---|---|
| 무료: 점수·한줄요약·잘 맞는/조심할 지점·4축 카드(갈등/대화/돈/거리)·evidence 4종 | 결정론 | 문장표 | lib/compatibility.ts:1062~1200 |
| 유료 깊은 풀이(LLM) | JSON sections 3~5개 | 본문 60~1200자, 프롬프트 "500~800자 목표", 제목 28자(검증 40자) | compatibility-interpretation-prompts.ts:8-11,35-38 |
| 〃 호출 한도 | maxOutputTokens 6000, timeout 30s, 재시도 2회 | | generate-compatibility-interpretation.ts:52,100-104 |
| 유료 깊은 풀이(fallback) | 4축 practice 1문장 + 근거 1줄. 프레임/강약 비교는 첫 섹션만 | 문장 조립, 상한 없음(실제 짧음) | lib/compatibility.ts:942-975 |
| 용도별 적합성 4종(결혼/동업/돈거래/오래 보는 사이) | 결정론 점수 + reason 1문장 + condition 1문장 | 고정 | lib/compatibility/couple-fit.ts:56-125 |
| 시간축: 올해 12개월 상위3/하위2/엇갈림2 + 3개년 | 결정론 | 월 카드 body ≈ 고정 2문장 + 첫문장 1개 | lib/compatibility/couple-timing.ts:112-165,170-215 |

- LLM 켜져도 사용자 핵심 가치인 "용도별(couple-fit)·시간축(timing)"은 LLM 이 아닌 고정 문구다. LLM 입력에도 들어가지 않는다(content.ts 의 input 에 없음).
- 캐시: 명식 8글자+이름+natalEvidence+관계로 키. 30일 TTL(cache.ts:12-37).

### 1-2. 사주 근거 중 빠진 것
| 근거 | 현재 상태 | 비고 |
|---|---|---|
| 일간 관계 | 있음: same/합/충/보완 4종만(lib/compatibility.ts:383-424). 합 5쌍, 충 4쌍 외는 전부 "보완" 한 덩어리 | 생극(내가 극/상대가 극)·음양 구분 없음 |
| 일지 합충형파해 | 있음(:426-492). 일지 vs 일지 한 쌍만 | 월지·연지·시지 교차 비교 없음. 삼합/방합, 원진, 귀문 없음 |
| 오행 보완 | 있음(:496-538). "한쪽 weakest = 다른 쪽 dominant" 불리언 + 공통 용신 | 점수 +4/+5/-3 고정 |
| 십성으로 본 서로의 역할 | 빠짐. 상대 일간이 내게 무슨 십성(관성/재성/식상)인지 계산 안 함. 연애 궁합의 핵심(남:재성, 여:관성) | LLM 에는 각자 원국 tenGods 만 전달, 교차 관계는 모름 |
| 천간합 (일간 외 기둥 간) | 빠짐 | 월간/연간 합 미반영 |
| 배우자궁·배우자성 | 빠짐. 일지 오행·성별별 관성/재성 유무 미사용 | 성별 데이터는 birthInput.gender 로 있음 |
| 신살(도화/홍염/원진/귀문) 교차 | 빠짐. natalEvidence 에 specialSals/relations 없음 | yearly 쪽 grounding 은 포함하는데 궁합은 제외(natal-reading-evidence.ts:5-20) |
| 대운 시기 겹침 | 빠짐. 연도 전망은 세운 간지 x 일주 점수만(couple-timing.ts:240-265) | 두 사람 현재 대운 방향·교운기 없음 |
| 연애 vs 결혼 구분 | couple-fit 에 "결혼" 한 줄. 연애 시작/재회/썸 구분 없음 | 관계 라벨 4종(연인/가족/친구/동업)뿐 |

### 1-3. 시중 대비 빠진 항목 (근거 URL)
시중 앱 내부 목록은 검색으로 확정하지 못했다(⚠️ 검증필요: 점신/포스텔러 궁합 화면 직접 캡처 필요). 확인된 것만:
- 점신 앱 소개: 인맥 보고서(저장한 인맥과의 관계 흐름 정리), 상대 궁합 확인 https://apps.apple.com/KR/app/id960571015
- 일반 사주 궁합 해설의 공통 축: 일지 합충·오행 보완·십성 비교, 결혼 시기는 대운/세운의 관성·재성 유입으로 판단
  https://brunch.co.kr/@mov/17 , https://brunch.co.kr/@mov/18 , https://v.daum.net/v/QsNGLbZw1z
- 빠진 후보 항목: 상대의 성격 요약(상대 입장 서술), 서로에게 끌리는 이유/결혼 시기/재회 가능성 같은 "질문형" 섹션, 대운 겹침 기반 "함께 좋은 시기", 두 사람 각자의 연애 스타일, 갈등 시나리오별 대화 문장 예시.

### 1-4. 짧거나 일반론이 되는 원인
1. 점수·4축 카드의 문장은 관계유형 4 x 축 4 x 결과 몇 갈래 고정표(RELATIONSHIP_LENS, COMMUNICATION_STYLES, DEEP_SECTION_FRAME 4x5=20셀). 같은 오행 조합이면 같은 말.
2. 결정론 fallback 이 사실상 "4축 practice 1문장"이다(:975). LLM OFF 면 결제자 체감 분량이 매우 적다.
3. 프롬프트가 "결정론 요약보다 한 단계 더 깊게"라면서 새 근거는 안 준다. 근거는 같은 카드 문장의 재진술이 되기 쉽다(prompts.ts:26-31).
4. 프롬프트 "조건부 장면 예시, 실제로 있었다고 단정하지 않는다"가 안전하지만 "열 사람 중 아홉에게 맞는 말" 방지 지시([밀착 개인화])가 신년 쪽에만 있고 궁합엔 없다.
5. 용도별 적합성 reason 은 모든 해당 조합이 같은 문장(couple-fit.ts reason 삼항 3갈래), condition 은 거의 상수(business, longterm 은 완전 고정).
6. couple-timing 연 전망 body 는 4가지 고정 문장(:230-262).

---
## 2. 올해운세 / 2027 신년운세 (월별 제외)

### 2-1. 사용자에게 나가는 항목과 길이 지시
| 항목 | 생성/출처 | 길이 지시·상한 | 위치 |
|---|---|---|---|
| 총론 opening | LLM "첫 문단 장문" | 문장 수 지시 없음, 파싱 상한 1400자 | interpretation.ts:90, 877 |
| 키워드 3~5 | LLM | 항목당 180자 상한 | :91 |
| 상/하반기 | LLM "각 5~7문장" | 상한 1100자 | :92, 부속 지시 |
| 분야 6개 | LLM "7~10 짧은 문장(400~650자 목표)" | 상한 1600자 | :93 |
| 좋은/주의 시기 | LLM 2~4개 | 항목당 260자 | :95 |
| 행동 조언 | LLM 3~6개 | 항목당 240자 | :96 |
| 한줄 요약 | LLM | 220자 | :97 |
| 가족운·학업운 (신년 전용) | LLM "각 6~9문장" | 1600자 | schemaLine, :771 부근 |
| 분기 4개 | LLM | 260자(MAX_PERIOD) | :95, parse |
| 기대할 일/조심할 일 3~6 | LLM, 월+분야+한 문장 | 260자 | :95 |
| 호출 한도 | narrative 10000토큰/65s, monthly 8000/60s, newyear 6000/45s | | saju-yearly-service.ts:140-145 |
| 화면 카드 4줄(핵심/기회/주의/행동) | 결정론 report.categories | 104/100/100/88자로 잘라 표시 | yearly-report-panel.tsx:637-670 |
| PDF 문서 | 같은 데이터. 키워드는 상위 4개만 | slice(0,4) | new-year-report-document.tsx:241 |

- AI 실패 시 fallback 은 `tightenLine`(maxSentences 2~3, 길이 110~260)로 압축: 분기 160자, 가족/학업 3문장 260자(interpretation.ts:142,268-292). 즉 폴백이면 "6~9문장"이 3문장.
- 결정론 분야 카드: summary/opportunity/caution 은 오늘운세 리포트 문장을 가져와 "오늘->올해" 치환 후 108~112자로 절단(build-yearly-report.ts:540-562).

### 2-2. 사주 근거 중 빠진 것
| 근거 | 현재 | 위치/재사용 후보 |
|---|---|---|
| 세운 십성 | 빠짐. 세운은 "천간 오행 vs 일간 오행" 5갈래(0~4)만 | build-yearly-report.ts:418-435. 재사용: lib/saju/cycle-sipsin.ts getCycleSipsin (현재 lifetime 리포트만 사용) |
| 세운 지지 vs 원국 합충형파해 | 빠짐. 연지 정보는 yearGanji 문자열뿐 | 재사용: lib/compatibility.ts summarizeBranchInteraction |
| 대운과 세운 관계 | 이름만 한 줄 삽입("OO 대운 위에 OO 세운", :494,610). 십성/오행 관계/교운기 없음 | |
| 대운 목록 | 저장 리딩의 luckCycles/luckFlow 를 **일부러 제거**하고 LLM 에 넘김(interpretation.ts:753-757). 대신 target-year report 에서만 받는데 거기엔 현재 대운 간지 1개뿐 | 의도(옛 연도 계산 혼입 방지)는 맞으나 대체 근거가 부족 |
| 삼재 | 빠짐 (신년/연간 어디에도 없음). 계산은 이미 존재 | lib/today-fortune/sinsal-comprehensive.ts:148,415 (연지 기준, 들/눌/날삼재) |
| 용신 해당 여부(세운 오행이 용신/기신인가) | 부분. supportElements/cautionElements 에 넣어 월 momentum 에는 사용. 연 총평 문장에는 "나와의 관계 5갈래" 가 쓰임 | 연 단위 용신 일치 판정 없음 |
| 원국 신살/합충 | 있음(natal factJson/evidenceJson 으로 LLM 에 전달) | 단 올해 발동 여부는 계산 안 함(천을귀인이 올해 들어오는지 등) |
| 월지/연지 충 등 "올해 가장 흔들리는 자리" | 빠짐 | |
| 성별별 관성·재성 유입(연애/결혼운) | 빠짐. love 분야는 오늘운세용 love 리포트 재활용 | |
| 분야 점수 | health/move 는 고정, 나머지는 일진 점수를 "통일"한 값(:1000~1010) | 연 단위 근거 아님 |

### 2-3. 시중 대비 빠진 항목
확인 가능한 근거(앱 소개 페이지 기준, ⚠️ 상세 화면은 미확인):
- 토정비결·신년운세 앱: 신년총운/재물/애정/직장·가정/인간관계/주의사항/성공전략/월별(총운·애정·금전·변화·인간관계·건강·주의) + 토정비결 + **삼재운** + 사주표 https://apps.apple.com/kr/app/2026-%EC%8B%A0%EB%85%84%EC%9A%B4%EC%84%B8-%ED%86%A0%EC%A0%95%EB%B9%84%EA%B2%B0-%EC%8B%A0%EB%85%84%EC%9A%B4%EC%84%B8-%EC%99%84%EC%A0%84%ED%8C%90/id1184705835?l=ko
- 점신: 신년운세 + 만세력(대운·세운 확인) + **행운의 번호/코디/음식**, 띠별·인맥 https://apps.apple.com/KR/app/id960571015
- 본 서비스에 없는 것: 삼재(들/눌/날), 올해 귀인(방향/띠), 행운 색·숫자·방향, 띠별/나이별 포인트, 토정비결식 한 줄 괘 풀이, 성공전략 섹션(성격이 비슷한 건 actionAdvice), "주의사항" 독립 섹션(caution 목록으로 부분 대체).
- 앞 둘은 점신/토정비결 앱 소개에서만 확인했고, 귀인·행운 색·방향이 실제 메뉴로 있는지는 직접 확인 필요. ⚠️ 검증필요.
- 행운 색/숫자/방향은 계산 근거(용신 오행 -> 색·방위·수)가 약하면 "재미 요소"라 한계를 문구로 밝혀야 함(naming/컴플라이언스 정책은 별도 확인).

### 2-4. 짧거나 일반론이 되는 원인
1. 프롬프트 모순(interpretation.ts:839-851): "길게 늘인 장문이 아니라… 모바일 운세 데이터", "한 문단 2~3문장 이하", "카드 안 문구는 짧게 잘라서" vs 분야 7~10문장·상하반기 5~7문장·가족/학업 6~9문장. 모델이 짧은 쪽을 따르기 쉽다. opening 은 길이 지시가 아예 없다.
2. 입력 요약 한계: 연간 근거 중 사람마다 다른 값이 ①일간 오행 ②세운 천간 오행 관계(5갈래) ③강약/격국/용신 라벨 정도. 같은 5갈래에 속하는 사람은 총론·분야 입력이 거의 같다. 사람별로 갈리는 월 정보는 "월 천간 오행 vs 일간 오행"도 같은 5갈래.
3. 고정표 다수:
   - MONTH_AREA_PLAN(build-yearly-report.ts:97-110): 월->분야/테마가 12칸 고정. 모든 사람에게 같은 월이 같은 분야. 상반기/하반기 "topArea"(findMostRepeatedArea)가 사실상 항상 같은 분야로 수렴.
   - CATEGORY_MONTH_MAP(:88-95): 분야별 관련 월 고정(예: 연애는 항상 3,4,5,10월).
   - DEFAULT_RISE/CAUTION_MONTHS(:115-116): 근거 없는 월 기본값이 momentum 판정의 최종 fallback.
   - YEARLY_CATEGORY_COPY: 5갈래 x 6분야 = 30칸(yearly-category-copy.ts). 같은 갈래면 opportunity/action 문장이 동일.
   - HIGHLIGHT_RISE/CAUTION, QUARTER_VERB, HALF_TAIL, MONTH_MOMENTUM_TAIL: 모두 5~6칸.
   - createHealthSection/createMoveSection: caution/action 이 전원 동일 고정문(:549-615), move opportunity 도 고정.
4. 카드/LLM 이중 구조: LLM prose 가 있어도 카드는 결정론 문장을 100자 안팎으로 잘라 보여준다(panel :637-670). 카드의 근거가 일진 리포트(`getReportMap` today/love/wealth…)라 연 단위 근거가 아니다.
5. 검증기 없음: 신년 extras 는 금지 패턴(반드시/100%…)만 검사(:468-474). 길이 하한·반복·일반론 검사 없음. 실패해도 폴백을 "버전 고정"으로 확정해 두 번째 생성 기회가 없다(service :278).
6. 6분야만 narrative 로 생성하고 family/study 는 별도 6000토큰 호출(분업은 합리적이나 가족/학업은 근거 입력이 relationship/work 공유).

---
## 3. 개선안 상위 5개 (고객 체감 순)

| # | 무엇을 | 어디 | 왜 | 난이도 | 비용 |
|---|---|---|---|---|---|
| 1 | 세운 근거 팩 신설: 세운 십성(getCycleSipsin) + 세운 지지 vs 원국 4지지 합충형파해(summarizeBranchInteraction 재사용) + 대운-세운 십성/오행 관계 + 용신/기신 해당 + 삼재 여부(detectComprehensiveSinsals) 를 `annualContext` 에 추가해 narrative/newyear 입력과 총론·분야 카드에 사용 | build-yearly-report.ts createYearlyContext(:394-415), yearly-types.ts YearlyFlowContext, interpretation.ts createNarrativeGrounding | "열 사람 중 아홉 같은 말"의 근본 원인(5갈래 압축)을 푼다. 삼재·귀인 항목도 같은 팩에서 파생 | M | LLM 입력 +수백 토큰/호출, 호출 수 불변. 결정론 계산 추가 ≈ms |
| 2 | 프롬프트 모순 제거 + 길이 지시 일관화: "모바일 운세 데이터/짧게 잘라/2~3문장" 삭제, opening 에 문장 수(예 8~10문장), 분야 지시 유지. 파싱에 최소 길이 하한(분야 300자, 총론 500자)과 재시도 시 사유 주입 | interpretation.ts:839-851,876-882, parse 함수 | 같은 호출로 분량·구체성이 올라간다. 검증기 폐기 재시도 비용(기억된 total_review 교훈) 피하려면 하한은 느슨히 | S | 출력 토큰 증가(분야 6x650자≈+). 재시도 늘면 비용↑ -> 하한은 낮게 시작 |
| 3 | 신년 전용 신규 섹션: 삼재(들/눌/날, 연지 기준) + 올해 귀인(천을귀인 올해 발동 위치) + 주의사항/성공전략 독립 블록, 행운 색·방위·숫자(용신 오행 매핑)는 "참고용" 라벨로 | 새 결정론 빌더(예: domain/saju/report/new-year-extras-lucky.ts) + new-year-report-document.tsx + yearly-report-panel.tsx | 시중 신년 상품 기본 메뉴라 비교 시 "빠졌다"로 체감. 결정론이라 LLM 비용 0, 화면=PDF=재열람 동일 유지 쉬움 | M | 0원(결정론). 문구 컴플라이언스/한자 금지/"삼재=불행 단정" 금지 가드 필요 |
| 4 | 궁합 근거 확장 + LLM 입력에 용도별/시간축 포함: 서로의 십성 역할(상대 일간이 내게 무슨 십성), 월지·연지 교차 합충, 천간합, 신살 교차(도화/원진/귀문), 두 사람 현재 대운, 성별별 배우자성 -> `CompatibilityInterpretationInput` 에 추가하고 couple-fit/timing 결과도 넘겨 5~6섹션(연애 스타일/상대 성격/결혼 시기 가능성/갈등 시나리오/대화 문장) 확장 | lib/compatibility.ts(summarize*), compatibility-interpretation-content.ts/prompts.ts/types.ts, couple-fit.ts, couple-timing.ts | 궁합 유료 체감 핵심("왜 우리가"). 지금은 일간+일지 한 쌍 위주라 모든 같은 오행 조합이 같은 말. 프롬프트 버전 올려 캐시 무효화 필요 | L | LLM 입력/출력 +50~80%, 커플당 1회 캐시이므로 총액 영향 제한적. ⚠️ 운영 플래그 ON 여부 먼저 확인 |
| 5 | 고정표 개인화: MONTH_AREA_PLAN/CATEGORY_MONTH_MAP/DEFAULT_RISE·CAUTION_MONTHS 를 월 간지 십성·월지 합충 기반으로 사람별 산출, health/move 고정 caution/action 을 용신/강약/대운 기반 변형. 궁합 couple-fit 의 business/longterm condition 도 신호(stemKind·element)별 분기 | build-yearly-report.ts:88-116,549-615, couple-fit.ts:85-125 | "내 달은 왜 남과 같은 분야냐" 반복 불만의 원인. 월별은 별도 확장 예정이므로 이 항목은 월별 팀과 범위 조율 필요 | M~L | 0원(결정론). 월별 확장 작업과 충돌 가능 -> 순서 조율 |

### 실행 순서 제안
- 먼저 2(S) 로 분량 문제를 즉시 해소하고, 동시에 1 의 근거 팩을 만들면 3·5 가 같은 팩을 공유한다.
- 4 는 별도 작업(캐시 버전·플래그 확인·컴플라이언스 검수 포함).

### 가정이 무너지는 조건
- 궁합 LLM 플래그가 운영에서 이미 ON 이면 1-4(2)의 "fallback 이 짧다"는 영향이 작아지고 개선 4 우선도는 올라간다.
- 신년 프롬프트 모순이 실제 출력 길이에 얼마나 영향 주는지는 이번에 실측하지 않았다(유료 API 금지). 개선 2 는 가설이다. 적용 전 기존 저장 풀이 길이를 읽기 전용 샘플로 확인 권장.
- 시중 앱 비교는 앱스토어 소개글 수준이다. 삼재/귀인/행운 항목이 실제 유료 화면에 있는지는 캡처로 재확인해야 한다.

### 참고 출처
- https://apps.apple.com/KR/app/id960571015 (점신)
- https://apps.apple.com/kr/app/2026-%EC%8B%A0%EB%85%84%EC%9A%B4%EC%84%B8-%ED%86%A0%EC%A0%95%EB%B9%84%EA%B2%B0-%EC%8B%A0%EB%85%84%EC%9A%B4%EC%84%B8-%EC%99%84%EC%A0%84%ED%8C%90/id1184705835?l=ko
- https://brunch.co.kr/@mov/17 , https://brunch.co.kr/@mov/18 , https://v.daum.net/v/QsNGLbZw1z
