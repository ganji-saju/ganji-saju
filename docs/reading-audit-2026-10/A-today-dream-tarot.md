# 풀이 품질 점검 A (읽기 전용) — 오늘운세 무료/상세, 꿈해몽, 타로
기준일 2026-10-10. 코드만 읽음(DB·유료 API 미사용). 경로 접두 생략: B=src/server/today-fortune/build-today-fortune.ts

## 0. 한눈에
- 오늘운세 무료·상세 본문의 대부분은 **결정론 문구표**(AI 아님). LLM 은 env 플래그(OPENAI_TODAY_FORTUNE, OPENAI_INTERPRET_TODAY_PREMIUM)가 켜진 경우만 얹힌다. ⚠️검증필요: 운영 플래그 현재값은 코드로 알 수 없음.
- 꿈해몽·타로는 **AI 없음**. 꿈=사전(327 키워드, 상세 68건), 타로=카드별 고정 문구+조립 템플릿.
- 세 상품 공통 약점: 사용자의 사주(꿈·타로는 사주 자체 미사용), 대운, 합충·신살이 풀이 문장에 거의 안 들어가고, 같은 "관계 10종 / 카드 78장" 버킷에 든 사람은 같은 문장을 받는다.

## 1. 오늘의 운세 무료 화면 (buildTodayFortuneFreeResult, B:3131)
| 항목(사용자 노출) | 생성 방식 | 길이 지시/상한 (파일:줄) |
|---|---|---|
| 한 줄 헤드라인(oneLine.headline) | 분야 카드 answer 1문장 | 고정표 DAILY_TOPIC_ANSWERS[관계10][분야5] 1문장 (B:1651, 1799) |
| 본문(oneLine.body) | personalToday 조각 7~8개 이어붙임 | 조각당 1문장 → 약 7~8문장, 상한 코드 없음 (B:1916-1960) |
| 분야 카드 6개(총운·연애·재물·직장·관계·컨디션) | question/answer/evidence/example/choice | answer 1문장(고정표), evidence: 총운만 길고 나머지 분야는 **동일 템플릿 1문장** (B:1820), example/choice = 관계별 장면표 daily-topic-scenes.ts |
| 기회/주의 카드 | buildPublicOpportunity/Risk | 오행 5톤 문구표 (B:2126, 2162) |
| 사주 근거 한 줄 | causal-narrative brief | brief 1~2문장 (B:3160 부근) |
| 명식 카드·오행 분포·신살 칩 | sajuChart | 신살 칩은 UI 노출용 |
| 일진 점수 8영역 + 등급 | iljin-score-engine | 점수 숫자 |
| 일진 메시지 | pickIljinMessages | **3개** (B:3318) |
| 행운 패키지 12종+ | lucky-package.ts | 고정 후보에서 선택 |
| (옵션) LLM headline+body | ai/today-fortune/prompt.ts:8,40 | **6~9문장, 350~550자 목표**, maxOutputTokens 2400 (service.ts:141), 캐시·실패시 결정론 폴백 |

## 2. 오늘운세 상세(유료) — today-premium-service.ts + build-today-fortune.ts:3466
| 항목 | 생성 방식 | 길이 지시/상한 |
|---|---|---|
| 좋은 시간대 / 주의 시간대 | 12시진 평가 후 **각 2개만** | pickTimeBlockWindows `slice(0,2)` (B:2593); 본문 **3문장 상한** limitEasyTimeSentences(…,3) (B:2596, 2655), 힌트는 1문장 |
| 추천 행동 / 피할 행동 | buildRecommendedActions/AvoidActions | 문구표+근거 힌트 (B:2929, 2960) |
| 두 갈래 시나리오 | 지금 vs 기다리기, better/watch | 고정 꼬리문 actNowTail/waitTail (premium-relation-copy.ts) |
| 근거 줄 | buildEvidenceLines | B:2781 |
| 일진 풀이(todayIljinReading) | pickIljinMessages | **5개** (B:3543) |
| 인과 서사(causalNarrative.full) | 슬롯 조립(일진 십성·세운/월운 십성·지지 관계·신살) | causal-narrative.ts, 시드=날짜 |
| 추천 질문 3개 | 관계(5단계)별 표 | PREMIUM_FOLLOW_UPS |
| (옵션) AI 깊은 풀이 | today-premium-service.ts:96 | **10~14문장, 600~900자, 2~3단락**, maxOutputTokens 2400 (:67), 줄글·소제목 금지, 검증 실패시 통째 폐기(:152-155) |

## 3. 꿈해몽 (AI 없음)
| 항목 | 출처 | 길이/상한 |
|---|---|---|
| 검색 결과 카드: 길흉(fortune)·요약·상황 4개·행동 1문장·관련어 | src/lib/dream-dictionary.ts (327 키워드) | summary 2~3문장, situations 보통 4줄(각 10자 내외 "의미 암시"), action 1문장 |
| 상세 페이지: 한줄요약·기본의미·상황별(3개)·심리·행동 3개·주의·FAQ | src/lib/dream/dream-content.ts (68건) | 주석상 "합산 800자 이상" (dream-content.ts:10); 상황별 body 2문장 |
| 하루 1회 제한 | api/dream/search/route.ts | 키워드 사전 일치만, 자유 서술 불가 |
→ 사용자가 꾼 꿈의 구체 내용(색·행동·감정)은 반영 불가. 사전에 없으면 "무결과" 로그만 남김(route.ts:36).

## 4. 타로 (결정론)
| 항목 | 생성 | 길이/상한 |
|---|---|---|
| 3장 스프레드: 자리명 | buildSpreadPositions (tarot-api.ts:728) | 의도별 3자리 고정표 |
| 자리별 인사말(insight) | buildSpreadPositionInsight (:880) | **자리3 × 정/역2 = 6가지 문장틀** + 카드 짧은 테마어 끼움, 1~2문장 |
| 카드의 메시지(cardMeaning) | tarot-card-meanings-ko.ts 78장×정/역 | 카드당 약 3문장(고정) |
| 종합(synthesis) | buildSpreadSynthesis (:907) | opener 고정 + 흐름 1문장 + **texture 4가지 분기** + close 고정 |
| 오늘 한 가지(closing) | 3번째 카드 action | 1문장 |
| 1장 결과 페이지 | answer/guidance/sajuBlend/action | result/page.tsx:129-181 노출. sajuBlend 는 도메인4×기분5 고정 문장 (tarot-api.ts:1168), 사주 실계산 없음 |
| 영문 원전 발췌 폴백 | compactMeaning | 180자 절단 (tarot-api.ts:1343) |
→ 스프레드 화면은 questionInsight·answer·psychology·guidance·sajuBlend 를 계산만 하고 **노출하지 않음**(spread/page.tsx 는 insight+cardMeaning+synthesis+closing 만).

## 5. 사주 근거 중 빠진 것
오늘운세 LLM 입력은 buildNatalReadingEvidence(natal-reading-evidence.ts)=일간·기둥·신강약·격국·용신·십성·오행뿐.
| 누락 | 현재 상태 |
|---|---|
| 대운(현재 대운·전환 시기) | LLM·무료 본문 모두 미전달. 인과서사에 세운/월운 십성만 (B:3383) |
| 원국 내부 합충형해파·삼합/방합 | 일진 vs 원국 지지 1순위 관계(topRelation)만. 원국 자체 구조 없음 |
| 신살 | 칩/인과서사 1개(top)만. LLM 입력엔 없음 |
| 12운성·지장간·공망·납음 | 전혀 없음 |
| **오늘 일진 간지·점수 8영역 분해·인과서사 full·일진메시지** | 유료 AI 입력(today-premium-service.ts:104-126)에 todayGanzi·breakdown 없음. 결정론 결과 문장만 요약으로 들어감 → AI 가 계산 근거 없이 요약을 되풀이할 위험 |
| 시간대별 평가(12시진 점수) | AI 에 미전달 |
| 꿈·타로 | 사주 입력 자체 없음 |

## 6. 시중 서비스 대비 빠진 항목 (⚠️검증필요: 검색으로 항목 상세 확인 못 함, 앱스토어 소개문 수준)
- 점신: 시간대별 흐름, 바이오리듬, 애정·금전·건강, 행운 번호·코디·음식, 스포츠운 — https://apps.apple.com/us/app/2026-%EC%A0%90%EC%8B%A0pro-%EB%B3%91%EC%98%A4%EB%85%84-%EC%8B%A0%EB%85%84%EC%9A%B4%EC%84%B8-%EC%82%AC%EC%A3%BC-%ED%83%80%EB%A1%9C-%EC%83%81%EB%8B%B4/id960515020?l=pt-BR → 우리는 시간대·행운 패키지는 있음. 빠진 것: 바이오리듬, 내일/지정일 운세 연계(점신 "내일의 운세·지정일 운세" 확장은 https://v.daum.net/v/Kur2Ssd8DL 로 확인).
- 포스텔러: 대운·세운·월운 흐름, 주제별 상세 — https://apps.apple.com/KR/app/id1262949138 → 오늘운세 상세에 대운·월운 맥락 없음.
- 꿈해몽: 길몽/흉몽/예지몽 구분, 심리·조언, 꿈 일기 — https://apps.apple.com/kr/app/%EA%BF%88-%EC%9D%BC%EA%B8%B0%EB%A1%9C-%EB%B0%9B%EC%95%84-%EB%B3%B4%EB%8A%94-%EC%A7%80%ED%98%9C%EB%A1%9C%EC%9A%B4-%ED%95%B4%EB%AA%BD-%EB%93%9C%EB%A6%BC%ED%85%94%EB%9F%AC/id6746065412 → 우리 사전에도 fortune 있음. 빠진 것: 꿈 일기(기록·재열람), 자유 서술 입력, 꿈 + 오늘 일진 연결.
- 타로: AI 타로 앱은 질문 입력 시 구체 해석·여러 스프레드(1/3/크로스/켈틱) 제공 — https://apps.apple.com/kr/app/%ED%83%80%EB%A1%9Cai-%EB%A7%A4%EC%9D%BC%EC%9D%98-%EC%B9%B4%EB%93%9C-%EC%9D%BD%EA%B8%B0%EC%99%80-%EC%98%88%EC%B8%A1/id6447095993 → 우리는 3장 하나, 질문 반영은 의도 분류(자리명)까지. 수트·숫자·궁정카드 조합 해석은 일반 타로 지식이며 검색 근거 없음(⚠️).

## 7. 짧거나 일반론으로 흐르는 원인
1. **관계 10종 버킷**: 분야 카드 answer 가 DAILY_TOPIC_ANSWERS[10][5] 고정 1문장(B:1651). 같은 일간 관계인 사람은 하루 종일 동일. 근거(evidence)는 분야 카드에서 **모두 같은 템플릿**(B:1820, 2026-09-27 반복 제거의 부작용으로 정보량 감소).
2. **문장 수 상한**: 시간대 본문 3문장(B:2596,2655), 시간대 2개 (B:2593), 일진 메시지 3/5개, 힌트 1문장.
3. **AI 프롬프트 자체가 짧음**: 상세 600~900자(today-premium-service.ts:96), 무료 350~550자(prompt.ts:40); 입력에 계산 근거(일진 간지·인과서사·합충)가 없어 길게 쓰면 요약 되풀이. "근거 부족은 반복으로 채우지 않습니다"로 짧은 출력 유도.
4. **검증기 폐기 → null**: 한자/100%/무조건/validateChapterBody 실패 시 통째로 버려 결정론으로 회귀(:152-155).
5. **dedupe/thin 필터**: dedupeSentencesDeep·thinRepeatedTodayDeep 이 반복 문장을 삭제 → 고정 문구표 구조에서는 정보가 줄어듦.
6. **타로**: 자리 인사말 6틀, 종합 texture 4분기, sajuBlend 20조합 + 1장 결과와 스프레드가 서로 다른 필드를 노출. 질문 문장 자체는 자리명 선택에만 쓰임.
7. **꿈**: 사전 일치형, 상황 4줄이 "의미 암시" 한 줄 수준, 개인 맥락 없음.

## 8. 고객 체감 순 개선안 Top 5
| # | 무엇을 | 어디 | 왜 | 난이도 | 비용 |
|---|---|---|---|---|---|
| 1 | 유료 AI 입력에 **오늘 일진 간지, 점수 8영역 breakdown, causalNarrative.full, todayIljinReading, 상위 시간대 2+2, 신살 목록**을 근거 블록으로 추가 | today-premium-service.ts (input 타입 :14-37, 프롬프트 :104-126, toTodayPremiumInterpretationInput :162) | 지금은 AI 가 요약 문장만 받아 일반론 재서술. 근거가 있어야 "왜 오늘 이렇게"를 풀 수 있음 | S~M | 입력 토큰 +600~1000/회 (출력 동일) |
| 2 | 유료 AI 분량 상향(600~900→900~1300자, 3~4단락: 답/근거/분야별 장면/시간대/선택기준) + 토큰 여유 | today-premium-service.ts:96,67; 검증기 chapter-validator 상한 확인 | 결제 후 체감 분량 직접 개선. 폐기 규칙은 먼저 점검(과거 재시도 비용 사건: 검증기가 비용 태움) | S | 출력 토큰 +40~60%, 건당 비용 증가 |
| 3 | 사주 근거 확장: **현재 대운·원국 합충·신살·12운성**을 natalEvidence 에 추가 (오늘운세·타로 연결 시 공용) | natal-reading-evidence.ts (+ SajuData currentLuck 이미 존재: B:2217 getLuckFactLine) | 시중(포스텔러) 대비 가장 큰 공백. 모든 읽기 표면에 공용 이득 | M | 입력 +300~500 토큰 |
| 4 | 무료/유료 분야 카드의 evidence 를 분야별로 다르게(그 분야 십성·오행·신살 1줄 + 일진 지지 관계) 되살리고, DAILY_TOPIC_ANSWERS 를 관계10 × 강약3 이상으로 확장 | B:1799-1830, daily-topic-scenes.ts | 같은 날 같은 관계 사람이 같은 문장을 받는 문제 해소(결정론, 토큰 0) | M | LLM 비용 없음 |
| 5 | 꿈·타로에 개인화 한 층: 타로 스프레드 화면에 계산돼 있는 questionInsight/answer/psychology 노출 + 카드 간 수트 조합·역방향 서술 분기 확대; 꿈은 상황 입력 칩(색/행동/감정)으로 situations 선택 + 오늘 일진 한 줄 | tarot-api.ts:880-950, spread/page.tsx:127-200; dream/page.tsx, dream-dictionary.ts | 두 상품은 AI 없이 고정문구라 체감 격차 가장 큼. 노출만 늘려도 길이 체감 개선(이미 계산됨) | S(타로 노출)~L(꿈 입력) | 토큰 0 (AI 도입 시에만 증가) |

## 9. 가정이 무너지는 조건
- 운영에서 OPENAI_TODAY_FORTUNE / OPENAI_INTERPRET_TODAY_PREMIUM 이 꺼져 있으면 사용자는 결정론 문구만 받으므로 #4·#5 가 #1~#2 보다 우선.
- 검증기(validateChapterBody)가 길이 상향 시 폐기율을 올리면 #2 는 비용 역효과 → 먼저 폐기율을 ai_llm_runs 로 확인(이번 조사는 DB 미접근, 미확인).
- 시중 비교는 앱스토어 소개문 수준. 실제 앱 화면은 미확인.
