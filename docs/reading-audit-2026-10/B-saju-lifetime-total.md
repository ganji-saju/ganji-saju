# 풀이 품질 점검 B (읽기 전용, 2026-10-10)

범위: 기본 풀이 / 평생·깊은 사주풀이 / 총평 / 오행 가이드 / 점수. 코드·DB·유료 API 미접근.
기존 문서 반영: docs/reading-repetition-2026-09-27.md, reading-depth-improvement.md(2026-09-29/30 분량 상향), reading-quality-plan.md.
⚠️ 검증필요 표시는 코드 정독만으로 확정 못 한 것. 운영 env 플래그(챕터 LLM·오행 LLM 켜짐 여부)는 확인 불가.

## 0. 핵심 요약
1. 평생 AI 풀이는 "본편 11섹션 1콜(14,000토큰)" + "챕터 1~7·9 보강(summary 한 칸만 교체)" 이중 구조다. 챕터 보강 입력에는 합충·신살·공망·대운·세운이 **구조적으로 안 들어간다**(notableSinsals는 항상 빈 배열).
2. 시중 평생풀이의 단골 항목인 **결혼 시기·배우자궁·자녀·인생 주요 시기(연도별 사건 후보)** 가 없거나 얕다.
3. 오행 가이드 프롬프트에 **템플릿 리터럴 버그**(작은따옴표 안 `${...}`)가 있고, 캐시 키가 분포 기준이라 같은 분포면 전원 같은 문장이다.

## 1. 사주 기본 풀이 (saju-interpretation.ts, domain/saju/report/build-narrative.ts)
| 항목 | 길이 지시 / 상한 | 위치 |
|---|---|---|
| headline | 80자 상한 | saju-interpretation.ts:27 |
| summary | 프롬프트 7~10문장, 보존 상한 1,600자 | :28, :388 |
| insights | 4개(강점/약점/관계·일/오늘 행동), 각 4~6문장, 상한 700자 | :29-30, :389 |
| AI 호출 | maxOutputTokens 4,200 | app/api/interpret/route.ts:273 |
| 결정론 화면(질문 4개) | 질문별 answer/evidence/example/choice 고정 문장표(십성 5군×역할, 강약 3분기, 보완오행 5분기) | build-narrative.ts:40-140 |

- 근거 전달: 일주·월주·시주, 오행, 십성, 강약, 용신/희신/기신, 대운현황, 60갑자 core/강점/주의, 오행 편중 3줄(saju-interpretation.ts:240-285). 프롬프트가 "오행 비율·십성·강약·용신 중 최소 3가지 사용"을 요구.
- 빠진 것: 합충형파해 구체 쌍, 신살, 12운성, 공망은 `factJson/evidenceJson`을 통째로 JSON에 넣는 경로로만 노출(프롬프트에서 사용 지시 없음). 궁성(기둥별 영역) 해석 지시 없음. 세운/월운 미사용(기본은 평생 톤이라 의도적).
- 얕아지는 원인: 결정론 화면 4질문은 십성 5군 문구표를 나눠 쓴다(보완오행·강약도 3~5분기). 같은 "군"이면 문장 동일. 사주 기본 리포트 사람 간 공통 문장 50%(reading-repetition 문서).

## 2. 평생운세 / 깊은 사주풀이(종합 PDF)
### 2-1. 나가는 항목과 길이
| 항목 | 생성 방식 | 길이 지시 | 위치 |
|---|---|---|---|
| 표지(opening·keywords3~5·lifetimeRule·oneLineSummary·rememberRules5) | 본편 1콜 | opening 상한 1,500 / rule 420 / remember 220 | saju-lifetime-interpretation.ts:57-63 |
| 11섹션: 성향·기운균형·역할/보완·관계·가족·재물·직업·학업·건강·대운·전략 | 본편 1콜(JSON) | 재물·직업·관계 600~900자, 나머지 8개 350~600자, 섹션 상한 3,200자, 핵심3 검증 최소 180자 | :504-530, :60, :367 |
| 본편 호출 | maxOutputTokens 14,000, 타임아웃 65초 | | saju-lifetime-service.ts:105-106 |
| 챕터 1·3·4·5·6 보강 | 장별 LLM(직렬), summary 한 칸만 교체 | 10~15문장·600~900자 목표(허용 320~1000) | chapter-prompts.ts:178-235 |
| 챕터 2·7 보강 | 동일 | 6~10문장·350~600자(허용 180~700) | :193, :232 |
| 챕터 9(평생원칙) | 1~7 완료 후 synthesis | 3~5원칙, 600~900자 | :245 |
| 챕터 8(대운) | LLM 아님. 결정론 8단(hook·본문·멘탈·관계·재물/직업·실천4개·마무리) | 본문 400~600, 관계/멘탈 400~500, 재물 500~700 목표(타입 주석) | lifetime-types.ts:108-135 |
| 챕터 호출 | 장당 maxOutputTokens 2,200, 타임아웃 25초, 재시도 2회(최대 3콜) | | openai-chapter-client.ts:92,98 / generate-chapter.ts:93 |
| 101개 연도(0~100세) | 결정론 | 연도마다 focus/rhythm/action(십성 10종 표) + 대운 단계 라벨 + 원국 충·육합·동일지지 문장 | lib/saju/lifetime-pdf-timeline.ts:157-210, 255-270 |
| 올해 부록 | 결정론 | 상/하반기·좋은시기·조심시기 | lifetime-types.ts:176 |
| 장 전체 on/off | env OPENAI_INTERPRET_CHAPTERS=1 + 장ID 집합, 기본 OFF | | chapter-cache.ts:98-104 ⚠️운영 값 확인 불가 |

- 챕터 보강이 꺼져 있거나 실패하면 결정론 `buildFallbackLifetimeInterpretation`이 나간다(고정 문장 조립, saju-lifetime-interpretation.ts:183-300). 폴백은 사람 간 공통 문장 39%.
- 챕터 보강은 **summary 한 칸만 교체**(enhance-lifetime-chapter4.ts:38-40). 상세 필드(distanceStyle 등)는 결정론 그대로 → 한 섹션에 AI 문단 + 고정문 혼재.

### 2-2. 근거 중 빠진 것
| 근거 | 본편(11섹션 1콜) | 챕터 1~7 입력 | 비고 |
|---|---|---|---|
| 십성·격국·용신·강약·지장간·12운성(기둥별) | 있음(grounding, natalEvidence) | 있음(natalEvidence.pillars에 hiddenStems/twelveStage 포함) | ✓ |
| 합충형파해 쌍 | factJson.relations로 JSON에 포함, 프롬프트 사용 지시 없음 | **없음**(natalEvidence에 relations 없음, chapter-prompts는 관계 장에서도 합충 언급 없음) | 2026-09-29 문서는 "관계 풀이가 합·충 위치 명시"라 했으나 이는 결정론 빌더 쪽 |
| 신살 | specialSals가 JSON에 포함 | **notableSinsals: []** 하드코딩(build-chapter1-input.ts:142) | 코드 주석 "후속 PR" 방치 |
| 공망 | JSON에 포함 | 없음 | |
| 궁성(년=초년·조상, 월=부모·사회, 일지=배우자궁, 시=자녀·말년) | 지시 없음 | 지시 없음 | ⚠️ 전용 매핑은 없는 것으로 보임(grep 0건) |
| 대운 간지·나이 | 포함 | **없음**(챕터 7 건강 제외 대운 미전달; 8장은 결정론) | 재물·직업·관계 장에 "시기" 근거 없음 |
| 세운(올해)·월운 | lifetimeEvidence에 포함 | 없음 | 평생 톤이라 의도 |
| 성별 | 있음(birth.gender) | **userContext에 없음** | 대운 순역·배우자성(남=재성/여=관성) 해석 불가 |
| fiveElements.supportElements | - | **[]** 하드코딩(build-chapter1-input.ts:121) | 용신 오행 보강 라벨 비어 있음 |

### 2-3. 시중 대비 빠짐/얕음 (웹 근거 한계 명시)
시중 근거(제한적): 정통운세 앱 설명은 평생사주를 "약 40쪽, 총운·재물운·애정운·직업운·건강운·자녀운·대운"으로 구성, PDF 공유 제공 (https://apps.apple.com/us/app/id578175870). 정통사주는 연애·결혼·재물·직업·인연·신년총운·대운·세운 제공 (https://apps.apple.com/kr/app/%EC%A0%95%ED%86%B5%EC%82%AC%EC%A3%BC-%ED%8F%89%EC%83%9D-%EC%82%AC%EC%A3%BC%ED%8C%94%EC%9E%90%EC%99%80-%EC%82%AC%EC%A3%BC%ED%92%80%EC%9D%B4-%EC%99%84%EA%B2%B0%ED%8C%90/id1178530910). 포스텔러 신년운세는 주제별 풀이+월운, "200쪽 이상" 소개 (https://apps.apple.com/KR/app/id1262949138). ⚠️ 점신·헬로우봇·크몽 PDF의 구체 목차는 검색으로 확인 못 함(공개 자료 부족).
| 시중 보통 항목 | 우리 상태 | 판정 |
|---|---|---|
| 성격·적성 | 챕터1·6, 60갑자 | 있음 |
| 재물 | 챕터5 + 본편 | 있음(시기 근거 없음) |
| 직업 | 챕터6 (직업명 목록 의도적 배제: chapter-prompts.ts:76) | 있으나 "구체 직군" 기대 대비 얕음 |
| 애정 | 챕터4 | 있음 |
| **결혼 시기** | 없음(빈 항목). 미래 사건 예고 금지 방침 | **빠짐** |
| **배우자 특성/배우자궁** | 없음(일지 해석 지시 없음) | **빠짐** |
| **자녀운** | 없음. familyPattern은 "부모·배우자·자녀 역할과 거리감" 한 줄 지시, 전용 계산 블록 없이 관계·직업·대운에서 조립(saju-lifetime-interpretation.ts:272-285) | **얕음** |
| 건강 | 챕터7(질환·장기 대응 금지) | 의료광고법상 의도적 제한 |
| 대운별 흐름 | 결정론 8단 + 10개 대운 | 있음(십성 10종 문구표 공유, 공통문장 51%) |
| 인생 주요 시기 요약(좋은 해/조심할 해 Top N) | 101개 연도 표는 있으나 "요약" 없음 | **빠짐**(독자가 101행을 읽어야 함) |
| 월운 | 평생엔 제외(방침) | 의도 |

### 2-4. 짧거나 일반론이 되는 원인
- 본편이 1콜 14,000토큰에 11섹션+표지를 몰아 쓴다. 섹션당 350~600자 목표(관리자가 정한 값)는 시중 "40쪽"과 격차. 재물·직업·관계만 600~900자.
- 챕터 길이 목표(600~900자)와 검증기 **문장당 65자 초과 탈락**(chapter-validator.ts:293-306)이 겹쳐 짧은 문장을 강제 → 근거 설명을 빼고 문장 수로 채우게 됨. 챕터 술어 반복 규칙(같은 명리 술어 장당 N회 초과 탈락)도 근거 인용을 줄임.
- **재시도에 실패 사유 미주입**: generate-chapter.ts:93-135는 3번 모두 동일 user message(총평은 2026-08-10 수정됨, 챕터는 아직). 재시도가 주사위 → 폴백 확률↑.
- few-shot(챕터1·4·5·9)이 모두 같은 "정인격" 사례라 출력이 "~해보세요/비교해보세요" 어미·구조로 수렴(예시 끝문장 "…비교해보세요"). 이 어미가 전 챕터 반복(공통 문장 원인).
- "모든 장을 같은 조언으로 마무리하지 말라" 지시는 있으나 "비교 기준으로 끝낸다" 구조 지시가 동시에 있어 결론이 비슷.
- 결정론 폴백 고정표: 대운 십성 10종, 연도 십성 10종×나이대 6단, 건강/관계 고정문. 챕터 LLM 꺼진 상태면 사실상 이 표가 본문.
- 미성년·생시미상·근거부족 시 "억지로 분량 채우지 않는다" 지시(saju-lifetime-interpretation.ts:~530)가 짧은 출력을 허용.

## 3. 총평 (saju-total-review-service.ts, total-review/)
| 항목 | 지시/상한 | 위치 |
|---|---|---|
| 한 줄 요약 | 20~35자(검증 12~90) | total-review-prompts.ts:SECTION one_line, validator:188 |
| 본문 4단락(누구인가/강한 환경/무너지는 곳/지금 시기) | 단락당 7~8문장, 총 28~32문장(검증 25~35), 문장 60자 안팎·최대 90 | prompts:20, validator:213 |
| 평생 활용 카드 3개 | 제목 8자·부제 20자·본문 1~2문장 | prompts |
| 호출 | 섹션 3콜 병렬, maxOutputTokens 4,800, 타임아웃 40초, 재시도 2회(사유 주입함) | saju-total-review-service.ts:74-75, generate-total-review.ts |
- 실제 분량: 28~32문장×~60자 ≈ 1,700~1,900자. 재물·애정·건강 **전용 문단 없음**(4단락이 성향/환경/약점/현재).
- 근거 입력: `wonkuk.*_easy`(일간·일주·강약·격국·용신·오행과부족)+현재 대운/세운/월운 한 줄씩+natalEvidence(pillars 지장간·12운성 포함)+classicGrounding. 합충·신살·공망·궁성은 `_easy`에 없음 → 입력 JSON의 natalEvidence에도 relations 없음(natal-reading-evidence.ts 21줄).
- **일반론 원인**: key_strengths/weaknesses는 60갑자 표(strengths 2·watchPoints 1)를 padToThree로 3개로 채움(total-review-content.ts:68-76) → 같은 일주면 동일. career_fit은 십성별 고정 6직군(content:26-37). 한 줄 요약·카드가 같은 "일주 본질" 라벨 의존.
- 검증기: 문장 수 25~35 하드 게이트가 길이를 고정(더 풍부하게 쓰려 해도 35 초과 탈락). 과거 few-shot이 스스로 탈락한 사건은 수정됨(prompts 주석). 비용은 docs 기준 total_review가 LLM 비용 82%(project 메모).

## 4. 오행 가이드 (ohaeng-guidance/)
| 항목 | 지시/상한 | 위치 |
|---|---|---|
| 본문 | 5~8문장, 300~500자 목표, 길이검증 20~800자, 1,400토큰, 재시도 2회(사유 미주입) | ohaeng-guidance-prompts.ts:27, generate-ohaeng-guidance.ts:40-41,95-110 |
| 기본 상태 | env OPENAI_INTERPRET_OHAENG_GUIDANCE=1일 때만 LLM, 기본 OFF → 결정론 3문장 3분기 | ohaeng-guidance-cache.ts:27, content.ts:21-43 ⚠️운영 값 확인 불가 |
- **버그 1**: ohaeng-guidance-prompts.ts:32 가 작은따옴표 문자열 `'다섯 기운 분포(제공된 글자 ${...}개):'` → 모델에 `${Object.values(...)}` 글자 그대로 전달. 템플릿 리터럴(백틱)로 고쳐야 함.
- **일반론 원인**: 입력이 오행 개수·강한/부족·균형점수뿐(월령·강약·용신·십성 없음). 프롬프트가 "개수만으로 단정 금지"라 결론이 한계 서술+비교 질문으로 수렴. 캐시 키(counts·dominant·lack·excess·level)가 분포 단위 → 같은 분포 사용자 전원 동일 문장(ohaeng-guidance-cache.ts:15-25).
- 결정론은 3종뿐(없는 기운 있음/고름/치우침). 문장 구조 고정.

## 5. 사주 점수 화면 (lib/saju-score, components/saju-score)
- 총점 5구간 라벨(90/75/60/45/0)별 title·subtitle·description 고정 1벌(labels.ts:11-47) → 구간 내 전원 같은 문구.
- 5요소 카드는 제목/부제만(일주 본질·격국 작동도·용신기신·오행·합충신살), 요소별 점수 근거 문장 없음 ⚠️(score-breakdown-card.tsx:24-28에서 확인한 범위). F5(합충·신살 우호도)는 점수에 들어가지만 어떤 합충/신살이 영향을 줬는지 사용자에게 설명 안 함(formulas.ts:124-146).
- 평생 활용 3카드(lifetime-keys-carousel)는 총평 lifetime_keys 재사용.

## 6. 개선안 상위 5 (고객 체감 순)
| # | 무엇을 | 어디 | 왜 | 난이도 | 비용 영향 |
|---|---|---|---|---|---|
| 1 | **챕터 입력에 합충형파해·신살·공망·대운·성별 투입 + notableSinsals/supportElements 하드코딩 해제** (build-chapter*-input의 natalEvidence에 relations/specialSals/gongmang/currentLuck 추가, userContext에 gender) | chapters/build-chapter1~9-input.ts, domain/saju/report/natal-reading-evidence.ts, chapter-cache.ts 키 | "이 사람만의 차이"의 근거가 지금 구조적으로 없다. 공통 문장 39~50%의 근본 원인 중 하나. 총평·기본풀이도 같은 evidence 공유 | M | 입력 토큰 +300~800/콜(소폭). 캐시 키 변경으로 재생성 1회 |
| 2 | **누락 주제 추가: 결혼·배우자궁(일지)·자녀(시주) 장 + 궁성 매핑 지시** (신규 챕터 또는 familyPattern 강화), 결혼 "시기"는 사건 예고가 아니라 "관계 조건이 맞물리는 대운 구간" 형식 | saju-lifetime-interpretation.ts(familyPattern 지시), 신규 chapter, build-lifetime-report.ts | 시중 평생풀이 핵심 항목(결혼·배우자·자녀)이 비어 있음. 구매 후 "빠졌다" 불만 가능성 최대 | L (법·표현 가드 설계 포함) | 챕터 1콜 추가 ≈ +1.5만~2만 토큰 출력 추정 ⚠️ |
| 3 | **챕터 재시도에 실패 사유 주입 + 문장 65자 상한 완화(예 80자)·술어 반복 한도 재검토** | chapters/generate-chapter.ts(총평 buildRetryCorrectionNote 재사용), lib/saju/chapter-validator.ts | 폴백 감소(= 고정표 노출 감소), 근거를 풀어 쓸 수 있음. 총평에서 이미 효과 입증된 패턴 | S | 재시도 횟수 감소 → 비용 오히려 하락 가능 |
| 4 | **"인생 주요 시기 Top" 요약 + 챕터 8 대운 개인화**: 101행 연도표 위에 좋은 해/조심할 해/전환 대운 5~7개를 근거(충·합·12운성·대운 교체)와 함께 결정론 선별, 대운 십성 10종 표를 월지·용신 오행·강약 분기로 확장 | lib/saju/lifetime-pdf-timeline.ts, build-lifetime-report.ts(cycle 빌더) | 시중 "인생 그래프/주요 시기"에 해당. 결정론이라 AI 비용 0, 대운 공통문장 51% 감소 | M | 0 |
| 5 | **오행 가이드 버그 수정 + 입력에 강약·용신·월령 추가 + 캐시 키에 포함 / 점수 화면 요소별 근거 1줄** | ohaeng-guidance-prompts.ts:32(백틱), ohaeng-guidance-cache.ts:15, score-breakdown-card.tsx(F1~F5 근거), labels.ts | 지금은 같은 분포 전원 동일 문장 + 모델에 `${}` 원문이 전달. 점수 화면은 "왜 이 점수"가 안 보임 | S(버그)~M | 캐시 적중률↓(키 세분화) → 호출 증가 소폭; 플래그 OFF면 0 |

### 부수 권장
- 본편 11섹션 1콜을 "핵심 3장 / 나머지" 2콜로 쪼개면 섹션당 길이 검증·재시도 부분화 가능(현재 한 섹션 실패→전체 폴백, 캐시도 전체). M.
- few-shot을 일간·십성이 다른 2건 이상으로 늘려 "비교해보세요" 어미 수렴 완화. S.
- 챕터 보강 결과가 summary 한 칸만 교체되는 구조라 상세 필드와 어조 불일치 → 보강 대상 필드 확대 또는 상세 필드를 AI 본문으로 대체. M.

## 7. 가정이 무너지는 조건
- 운영에서 OPENAI_INTERPRET_CHAPTERS가 이미 모든 장 ON이면 2-4의 "고정표 노출" 비중은 낮아지고 1번(입력 근거) 효과가 더 중요해짐. OFF면 폴백 고정문이 본문이라 4번(결정론 개인화)이 최우선.
- 본편 프롬프트가 `factJson`을 통째로 넣으므로 모델이 relations/specialSals를 실제로 쓰는지는 생성 샘플로만 확인 가능(코드로는 사용 지시 부재만 확인). 비용 때문에 이번 점검에서 호출하지 않음.
- 결혼·자녀 항목은 서비스 정책(미래 사건 예고 금지, 의료·법 가드)과 충돌할 수 있어 기획 결정이 선행돼야 함.
