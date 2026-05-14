# 대운·깊은·상세 풀이 엔진 업그레이드 — 전수조사 audit · 2026-05-15

> 입력 자료: `/Users/kionya/Downloads/간지사주_대운풀이_개선방안.md` (사주아이 + 음양관 + 흐름사주 벤치마크 487라인)
> 목표: 사용자 자료의 7대 요구사항(① 현재상황 3입력 ② 대운 8단 섹션 ③ 카피 10패턴 ④ 개운법 3단 구체화 ⑤ 일상어 사전 50개 ⑥ 세운 6요소 + Peak/Pitfall ⑦ 원진·12운성·천간합·양인살 엔진 강화) 을 현재 코드에 정확히 매핑.
> 조사 방식: read-only. 코드 수정 / git 작업 0건.

---

## 요약

- **대운(majorLuck) 풀이 코드 위치 5건**:
  `src/domain/saju/engine/saju-data-v1.ts:1500` (산출) · `src/domain/saju/report/build-lifetime-report.ts:257-291` (해석) · `src/app/saju/[slug]/deep/page.tsx:483-548` (UI 카드) · `src/components/ai/lifetime-report-panel.tsx:333-421` (타임라인 컴포넌트) · `src/app/saju/[slug]/premium/print/page.tsx:673` (인쇄)
- **깊은/상세 풀이 진입 페이지 5건**: `saju/[slug]/page.tsx` (768라인 — 메인 결과) · `deep/page.tsx` (622) · `premium/page.tsx` (742) · `overview/page.tsx` (303) · `nature/page.tsx` (245) · `elements/page.tsx` (336) · `today-detail/page.tsx` (316)
- **입력 폼 진입점 4건**: `src/features/saju-intake/saju-intake-page.tsx:911-1146` (사주 시작 stepper · 3 step 만) · `src/components/saju/shared/compact-birth-fields.tsx` (today / MY / 궁합 공통, 397라인) · `src/components/today-fortune/birth-info-stepper.tsx:215` · `src/components/saju/shared/unified-birth-info-fields.tsx` (469라인)
- **사용자 자료 7대 요구사항 vs 현재 코드 갭 7건 전부 미충족** (정도 차이는 §6 PR 시퀀스 참조)
- **Phase 1 (2~4주) 4 PR / Phase 2 (1~2개월) 2 PR / Phase 3 (장기) 1 PR** 권고.

핵심 발견:
1. **`SajuPersonalizationContext` 에 사용자 입력 컨텍스트(연애/직업/고민) 슬롯이 0개** (`src/domain/saju/report/personalization-context.ts:28-49`). 모든 풀이 본문이 일주/십성/오행 등 명리 정보만으로 생성됨 — 사주아이가 후기에서 "내 얘기 같다" 평가받는 가장 강력한 장치(개인 컨텍스트 주입)가 통째로 빠짐.
2. **`SajuOnboardingDraft` 에도 situation 필드 없음** (`src/features/saju-intake/onboarding-storage.ts:9-29`). `focusTopic` 1개만 있어 "연애/돈/일/관계/오늘" 카테고리만 받음 — 사용자 자료가 요구하는 "연애 상태 / 직업 / 요즘 고민" 3가지를 받을 자리가 없음.
3. **DB `readings` 테이블에 situation column 없음** (`supabase/migrations/001_initial.sql:33-43`). column: `birth_year, birth_month, birth_day, birth_hour, gender, result_json`. 추가 마이그레이션 필요.
4. **대운 cycle 데이터 구조가 2필드뿐**: `summary` + `task` (`src/domain/saju/report/lifetime-types.ts:105-112`). 8단 프레임워크(Hook / 상세 / 멘탈 / 로맨스 / 돈·커리어 / 개운법 / 세운 / 마지막 한마디) 와 거리가 큼.
5. **원진(怨嗔) 검사 0건**. `src/domain/saju/engine/orrery-adapter.ts:569-693` `buildRelations()` 는 천간합/천간충/육합/충/형/파/해/반합/삼합/방합 만 산출하고 원진 누락. `grep -in "원진" src/` 결과 0건.
6. **12운성(장생/목욕/관대/건록/제왕…) 산출 0건**. 같은 파일 line 436 주석에 "12운성 reference 단계로 채웠다"는 표현은 있으나 실제 산출 함수/필드 없음.
7. **Peak/Pitfall 마킹 시스템 0**. `momentum: 'rise'|'steady'|'caution'` (`yearly-types.ts:27`) 정도만 있고 사용자 자료의 🚨 Peak / ⚠️ Pitfall 같은 강조 마킹 UI 없음.
8. **챕터 헤드라인 카피 패턴 10종(질문형/감탄+FOMO/경고형/비밀형/공감형/위기형/희망형/변환형/시그널형/반전형) 중 적용 0종**. `interpretation-rule-table.ts:36-49` 의 `actionLeads` 30개·`cautionLeads` 30개·`summaryLeads` 15개 = 총 ~90 lead 모두 평이한 평서문.

---

## §1. 입력 폼 위치 + 현재 상황 3개 추가할 자리

| 파일 | 현재 입력 항목 | 권고 |
| --- | --- | --- |
| `src/features/saju-intake/saju-intake-page.tsx:118-146` | step1 profile(focusTopic 1개), step2 birth(생년월일·양/음·시·성별), step3 location(출생지) — 총 3 step | step1 profile 단계에 **현재상황 카드 3개**(연애 상태 / 직업 / 요즘 고민) 추가. `PROFILE_STEP` ~ `BASE_STEPS` (line 118-146) 사이에 신규 step 삽입 또는 step1 내부에 chip group 3개로 inline 확장. |
| `src/features/saju-intake/onboarding-storage.ts:9-29` `SajuOnboardingDraft` | `nickname, focusTopic, tone, consents…` | 신규 필드 `relationshipStatus?: 'dating'\|'single'\|'married'\|'divorced'`, `occupation?: 'employee'\|'self_employed'\|'student'\|'homemaker'\|'job_seeker'`, `currentConcern?: 'business'\|'love'\|'family'\|'health'\|'wealth'\|'other'`, `currentConcernText?: string` 추가. `createInitialOnboardingDraft()` (line 47) / `normalizeOnboardingDraft()` (line 90~) / `loadRecentGuestInput()` 모두 동기화. |
| `src/components/saju/shared/compact-birth-fields.tsx:51-101` `CompactBirthFieldsProps` | calendarType / timeRule / 날짜 / 성별 / 출생지 (397라인) | 옵션 prop `showCurrentSituation?: boolean` 추가하고 today-fortune / MY / 궁합 4곳에서 토글 가능하게. (today-fortune 은 이미 `concern` 별도 존재하므로 occupation 만 추가 등 신중) |
| `src/components/today-fortune/birth-info-stepper.tsx:215` | 4-step stepper. `concernId` 단계가 이미 있음. | 기존 concern(6 종) 와 새 currentConcern(6 종) 의 의미 분리 필요 — 전자는 "오늘 1개 질문", 후자는 "삶의 큰 고민". 네이밍은 `dayConcern` vs `lifeConcern` 으로 구분 권고. |
| `src/lib/today-fortune/types.ts:7-13` `ConcernId` | `love_contact, money_spend, work_meeting, relationship_conflict, energy_health, general` | **재사용 불가**. 이건 "오늘 행동" 용. lifeConcern 은 별도 enum. |
| `src/lib/saju/unified-birth-entry.ts:11-25` `UnifiedBirthEntryDraft` | birth 전용 — 그대로 둘 것 | situation 필드는 별도 draft (예: `UserSituationDraft`) 로 분리. unified-birth-entry 는 사주 계산 입력 책임만 유지. |
| `src/lib/saju/types.ts:35-47` `BirthInput` | `name, year, month, day, hour, minute, gender, …` (사주 계산 입력) | situation 은 BirthInput 에 넣지 않는 것이 안전 (계산 result_json 캐시키 영향). 별도 `UserSituation` 인터페이스 분리. |
| `src/app/api/readings/route.ts` + `src/lib/saju/readings.ts:182-206` `buildReadingInsertPayload` | `birth_*, gender, result_json` 만 저장 | DB 마이그레이션 추가 필요: `situation_json JSONB NULL`. PR 1 의 핵심 작업. |
| `supabase/migrations/001_initial.sql:33-43` readings table | 6 column + RLS | 신규 migration `0010_reading_situation.sql` 로 `ALTER TABLE readings ADD COLUMN situation_json JSONB`. |

**데이터 흐름도 (PR 1 권고)**

```
[Intake UI step1]
  └→ SajuOnboardingDraft.{relationshipStatus, occupation, currentConcern}
      └→ submit() 의 readingInput 빌드 시
          ├─ readingInput.userSituation = {relationshipStatus, occupation, currentConcern}
          └→ POST /api/readings { ...birthInput, userSituation }
              └→ buildReadingInsertPayload(input, user) 가 situation_json 컬럼에 저장
                  └→ resolveReading(slug) 가 reading.userSituation 으로 복원
                      └→ buildSajuPersonalizationContext(data, userSituation)
                          └→ promptFacts 에 "연애중", "자영업", "사업 구상" 같은 phrase 주입
                              └→ AI 풀이 + interpretation-rule-table 매핑 시점에서 호명
```

`buildSajuPersonalizationContext` 시그니처를 `(data, userSituation?)` 로 확장하고 `promptFacts` 끝에 1~3 string 추가하면 **AI / 룰 베이스 양쪽 모두에서 호명 가능**해짐.

`grounding-types.ts:151` `personalizationContext: SajuPersonalizationContext` 가 이미 grounding 안에 들어가 있어, 풀이 7~10 곳(today/love/wealth/career/relationship/lifetime/yearly + premium + deep) 이 모두 같은 컨텍스트를 받는 구조. → **userSituation 을 personalizationContext 한 곳에 주입하면 전 페이지가 동시 수혜**.

---

## §2. 대운 풀이 코드 매핑

| 라우트 / 파일 | 현재 구조 | 8단 프레임워크 도입 위치 |
| --- | --- | --- |
| `src/domain/saju/engine/saju-data-v1.ts:262-263, 1500-1602` | `majorLuck: SajuMajorLuckCycle[]` 산출. 각 cycle 은 `ganzi, startAge, endAge, notes` 정도. 12운성 / 원진 / 천간합 작용 없음. | **§7 명리 엔진 강화** 대상. 각 cycle 에 `twelveStage: TwelveStage`, `wonjinWith: string[]`, `stemCombineWith: string[]`, `yanginActivated: boolean`, `keyTenGod: TenGodCode` 등 metadata 부착. |
| `src/domain/saju/report/build-lifetime-report.ts:257-291` `buildMajorLuckCycles()` | cycle → `{ganzi, ageLabel, phase('성장기'\|'표현기'\|'기반기'\|'결정기'\|'준비기'\|'전환기'), summary, task, isCurrent}`. **2필드 본문(summary + task)**. | 8단 sub-section 으로 재정의:<br>① `hook: string` (사용자 상황 호명)<br>② `chapterTitle: string` (10 패턴 중 1개)<br>③ `chapterBody: string` (상세 해설)<br>④ `mental: string`<br>⑤ `relationship: string`<br>⑥ `wealthCareer: string`<br>⑦ `practicalActions: PracticalAction[]` (4개)<br>⑧ `closingNote: string` |
| `src/domain/saju/report/lifetime-types.ts:97-120` | `LifetimeLuckPhase` enum + `LifetimeMajorLuckCycle` (5 필드) | 위 8단 dataclass 로 type 확장. |
| `src/app/saju/[slug]/deep/page.tsx:240-244, 483-548` | 가로 스크롤 chip 리스트 + 현재 대운 1문단 텍스트 (`현재 신묘 대운 진행 중. 일주 기준 큰 결정의 호흡을 길게...`) | hero strip 유지 + **클릭 시 8단 expanded view** (Accordion or 별도 sheet). 사용자 자료 6-2의 카피·구조 그대로. |
| `src/components/ai/lifetime-report-panel.tsx:333-421` `MajorLuckTimeline` | 세로 dot-timeline. 각 cycle 카드에 `ageLabel, phase 뱃지, ganzi 한자, summary, task` | 카드 자체를 8단 ExpandableCard 로 재설계. Mobile-first 접힘/펼침. `cycle.isCurrent` 인 카드는 default expanded. |
| `src/app/saju/[slug]/premium/print/page.tsx:673` | A4 인쇄 — cycle 한 줄씩 | 인쇄에는 hook + chapterTitle + chapterBody 까지만 (필러 줄임). |
| `src/app/saju/[slug]/premium/page.tsx:520-554` | "10년 단위 대운으로 인생의 결을 봅니다" 헤더만 amber 톤 | majorLuckTimeline 자리에 신규 8단 컴포넌트 import. |

**현재 cycle 본문 sample** (`build-lifetime-report.ts:280-291`):

```
note = cycle.notes.slice(0, 2).join(' ')
summary = `${note} ${reading.summary}` (3 문장 정도)
task = `${baseTask} ${branchHint}` (1~2 문장)
```

→ 본문 분량 약 **4~5 문장 / 200~250자**. 사주아이의 약 **1,500~2,500자 / 10~15 문단** 과 비교 시 분량만 6배 이상 차이.

---

## §3. 깊은/상세 풀이 코드 매핑

| 라우트 | 현재 섹션 | 8단/카피 도입 권고 |
| --- | --- | --- |
| `src/app/saju/[slug]/page.tsx` (768) | §1 Hero / §1.5 일주 캐릭터 / §1.6 narrative / §1.7 격국·용신 fact / §1.8 합충·공망 / §2 4기둥 / §3 분야별 흐름 / §4 더 보고 싶은 질문 / §5 CTA | hero 옆 **"내 현재 상황" 카드 1줄** 추가 — 입력한 연애/직업/고민 echo. §3 분야별 흐름의 카드 헤드라인 4종에 카피 10 패턴 적용. |
| `src/app/saju/[slug]/deep/page.tsx` (622) | §1 Hero / §2 4기둥 / §3 오행 donut / §4 십성 / §5 대운 timeline + 1문단 / §6+ (생략) | §5 가 핵심. 8단 컴포넌트 정착 후, 같은 컴포넌트를 lifetime-report-panel 에 재사용. |
| `src/app/saju/[slug]/premium/page.tsx` (742) | jade/amber/indigo 톤별 hero + 평생 리포트 9 챕터(`lifetime-report-panel`) + CTA | majorLuckTimeline 자리에 신규 8단. yearlyAppendix 자리에 6요소 세운 카드. |
| `src/app/saju/[slug]/overview/page.tsx` (303) | 종합 보기 — `cover, coreIdentity, lifetimeStrategy` 요약 | 본문 변화 없음. 단 "현재 상황" 컨텍스트 echo 추가. |
| `src/app/saju/[slug]/nature/page.tsx` (245) | 일주 / 본성 | userSituation 의 occupation 호명 (예: "자영업이신 갑신일주는..."). |
| `src/app/saju/[slug]/elements/page.tsx` (336) | 오행 균형 | 변화 적음 — 개운법 §6-6 (3단 구체화) 와 연동 가능. |
| `src/app/saju/[slug]/today-detail/page.tsx` (316) | 오늘 심화 | concern 와 currentConcern 호명 명확히 분리. |
| `src/components/ai/lifetime-report-panel.tsx:69-79` `SECTION_META` 9 챕터 | coreIdentity, strengthBalance, patternAndYongsin, relationshipPattern, wealthStyle, careerDirection, healthRhythm, majorLuckTimeline, lifetimeStrategy | 각 챕터의 헤드라인을 `interpretation-rule-table.ts` 의 신규 `headlinePatterns` 10종에서 추출. relationshipPattern 은 `userSituation.relationshipStatus` 분기, wealthStyle/careerDirection 은 `userSituation.occupation` 분기. |

**카피 일관 적용이 필요한 풀이 흐름 7~10 곳** (사용자 명시 "전체 풀이 흐름 7~10곳 일관 적용"):

1. `saju/[slug]/page.tsx` 메인 결과 (focusTopic 4 분야 카드 헤드라인)
2. `saju/[slug]/deep/page.tsx` §5 대운 cycle 카드
3. `saju/[slug]/premium/page.tsx` (lifetime-report-panel embedded)
4. `lifetime-report-panel.tsx` 9 챕터
5. `build-yearly-report.ts` `monthlyFlows[].theme/summary` 12달
6. `build-yearly-report.ts` `categories[]` 6 분야 헤드라인
7. `today-fortune` 결과 페이지 oneLine.headline (`src/lib/today-fortune/types.ts:50-54`)
8. `compatibility-result-view.tsx` 헤드라인
9. `nature/page.tsx` 일주 캐릭터 카드 헤드라인
10. `today-detail/page.tsx` 챕터 헤드라인

→ 전부 `interpretation-rule-table.ts` 의 `summaryLeads` / `actionTitles` / `cautionTitles` 를 호출. **이 한 파일이 carrier**. 카피 패턴 10종은 이 한 파일에 추가하면 7~10곳 동시 적용 가능 (= 변경 면적 최소화).

---

## §4. 명리 엔진 산출 vs 노출 매트릭스

| 도메인 항목 | 산출 여부 | 산출 위치 | 노출 여부 | 카피화 여부 |
| --- | --- | --- | --- | --- |
| 천간합 (병신합 등) | YES | `orrery-adapter.ts:580-589` | 부분 (`grounding.evidenceCards.relations`) | NO (label "천간합" 만, 사주아이의 "무언가 하나에 꽂히면…" 같은 일상어 번역 없음) |
| 천간충 | YES | `orrery-adapter.ts:591-598` | 부분 | NO |
| 육합 | YES | `orrery-adapter.ts:601-610` | 부분 | NO |
| 충 (자오·묘유 등) | YES | `orrery-adapter.ts:612-620` | 부분 | NO |
| 형 (인사신 등) | YES | `orrery-adapter.ts:622-630` | 부분 | 약함 (1줄 detail) |
| 파 | YES | `orrery-adapter.ts:632-640` | 부분 | 약함 |
| 해 | YES | `orrery-adapter.ts:642-650` | 부분 | 약함 |
| 반합 / 삼합 / 방합 | YES | `orrery-adapter.ts:652-690` | 부분 | 약함 |
| **원진 (묘신·자미 등)** | **NO** | (없음) | NO | NO |
| **12운성 (장생/목욕/관대/건록/제왕/쇠/병/사/묘/절/태/양)** | **NO** | line 436 주석만 있고 실제 함수/필드 0 | NO | NO |
| 양인살 | YES | `orrery-adapter.ts:717` | YES (`grounding.evidenceCards.specialSals`) | 약함 (`build-report.ts:434` "양인" label) — 사주아이의 "추진력이 엄청나지만 자칫 무리한 투자" 같은 카피 없음 |
| 백호·괴강·도화·천을·천덕·월덕·문창·홍염·금여 | YES | line 718-720 | YES | 약함 |
| 역마살 | YES (도화와 함께) | DOHWA_GROUPS / yi-ma 추정 | 부분 | NO |
| 십성 (10개) | YES | `saju-data-v1.ts` tenGods | YES | 약함 (`TEN_GOD_INTERPRETATION` `build-report.ts`) |
| 격국 / 용신 / 희신 / 기신 | YES | yongsin 객체 + `orrery-adapter.ts:1430-1500` | YES | 중간 (`patternAndYongsin` 챕터 존재) |
| 오행 개수 / 강약 / 조후 | YES | `fiveElements`, strength, `formatSeasonLabel` | YES | 중간 |
| 공망 | YES | `gongmang` evidence | YES | 약함 |

**가장 큰 도메인 갭 2건**:
1. **원진** 완전 누락. 사주아이가 부부/연인 갈등 설명에 가장 강하게 쓰는 기제 (사용자 자료 §6-3 ★ 표시). 구현은 12쌍 페어 테이블 (`자미, 축오, 인유, 묘신, 진해, 사술`) 추가 + `buildRelations` 에 케이스 추가만 하면 됨 — **약 30 LOC**.
2. **12운성** 완전 누락. 사주아이가 사회적 위치 설명에 활용 ("목욕지에 해당하니 사회적으로 주목받고…"). 구현은 stem × branch 60 셀 매트릭스 1개 (불변 상수) — **약 80 LOC**.

---

## §5. 카피 시스템 현황

### 5-1. interpretation-rule-table 의 lead 통계

`src/domain/saju/report/interpretation-rule-table.ts:22-217`:
- 5개 focus topic × 5종 lead × 3 band = **총 75 슬롯** (summaryLeads 15 + actionTitles 15 + actionLeads 15 + cautionTitles 15 + cautionLeads 15)
- 모든 슬롯이 **평서 단정형 1문장**. 사용자 자료의 챕터명 카피 10 패턴(질문형/감탄+FOMO/경고형/비밀형/공감형/위기형/희망형/변환형/시그널형/반전형) 적용률 **0%**.
- 위 75 슬롯은 `build-report.ts:1042-1140` `buildTopicActions()`, `build-report.ts:1536` `getInterpretationScoreBand()` 등에서 사용 → **이 1 파일이 §3 의 7~10곳 풀이의 카피 carrier**.

### 5-2. 일상어 번역 사전 현황 vs 사용자 자료 50개 목표

`src/lib/saju/terminology.ts:15-89` `FRIENDLY_TERM_MAP`:
- 현재 매핑 약 **45개** (사주 구조 4 / 4기둥 4 / 천간·지지 6 / 운 6 / 강약·격국·용신 13 / 십성 6 / 관계·변화 3 / 시점 4 / 부드럽게 9)
- 사용자 자료 §6-5 의 14개 핵심 매핑 중 커버 현황:
  - 정관/편관 → ‘책임·도전 역할’ : **커버**
  - 정인/편인 → ‘배움·휴식 역할’ : **커버** (단 "도덕적 강박" 같은 늬앙스는 없음)
  - 편재 → ‘돈·기회 역할’ : **부분** (사용자 자료의 "정당한 재물을 거머쥐는 기회 / 횡재수" 톤 없음)
  - 식상 → ‘표현·재능 역할’ : **부분** (마케팅·홍보·고객응대 늬앙스 없음)
  - 비견·겁재 → ‘동료·경쟁 역할’ : **커버**
  - 관성 → (정관/편관 묶음 적용) : **커버**
  - **양인살** : **미커버** (terminology 에 미등록)
  - **역마살** : **미커버**
  - **원진** : 도메인 자체가 미산출이므로 N/A
  - **12운성 목욕지** : 미커버
  - **재다신약** : 미커버
  - **병신합** : 미커버 (도메인 산출은 되지만 텍스트 매핑 없음)
  - **인신사 삼형** : 미커버
- → **추가 매핑 필요 약 14~20개**. terminology.ts 한 파일에 추가만 하면 `simplifySajuCopy` 가 호출되는 모든 풀이에 자동 전파됨 (carrier 효과). 변경 면적 최소.

### 5-3. 챕터 헤드라인 패턴별 적합 위치

| 카피 패턴 | 적합 위치 | 현재 코드 카피 sample |
| --- | --- | --- |
| 질문형 | 대운 chapterTitle (cycle 시작 시) · `lifetime-report-panel` 챕터 헤더 | "10년 단위 큰 흐름 (대운)" (line 77) |
| 감탄+FOMO | 세운 Peak 연도 chapterTitle | (해당 슬롯 없음) |
| 경고형 | 세운 Pitfall 연도 + `cautionTitles` | "균형이 무너지는 선택 피하기" (line 43) |
| 비밀형 | 개운법 헤드라인 | "지금 바로 살릴 흐름" (line 32) |
| 공감형 | 멘탈 섹션 | (해당 슬롯 없음) |
| 위기형 | 로맨스 위기 섹션 | "반응을 재촉하지 않기" (line 71) |
| 희망형 | 상승기 cycle | "오늘은 원국의 강점이 바로 살아나는 날입니다" (line 27) |
| 변환형 | 결실기 cycle | (해당 슬롯 없음) |
| 시그널형 | 대운 시작 첫 cycle | (해당 슬롯 없음) |
| 반전형 | 조정기 cycle + cautionLeads | "잘 풀릴수록 선을 넘기 쉽습니다" (line 47) — 부분 |

→ 현재 75 슬롯에 패턴 인덱스 컬럼 추가 + 신규 슬롯 40~50개 (10 패턴 × 4~5 band) 보강 권고.

---

## §6. 우선순위 PR 시퀀스 권고

### PR 1 (Phase 1-1): 사용자 입력 단계 ‘현재 상황 3개’ 수집 + 영구 저장

**변경 파일**
- `src/features/saju-intake/saju-intake-page.tsx:118-146` — `PROFILE_STEP` 구조 확장 또는 step1 inline chip group 3개 (연애 / 직업 / 고민)
- `src/features/saju-intake/onboarding-storage.ts:9-29, 47-69, 90~120` — `SajuOnboardingDraft` 3 필드 + initial + normalize
- `src/lib/saju/unified-birth-entry.ts` — 변화 0 (birth 책임만 유지)
- `src/lib/saju/types.ts` — 새 `UserSituation` interface 추가 (BirthInput 과 분리)
- `src/lib/saju/readings.ts:182-206` `buildReadingInsertPayload` — situation_json 컬럼 채움
- `src/app/api/readings/route.ts` — POST body 확장
- `supabase/migrations/0010_reading_situation.sql` — 신규 migration `ALTER TABLE readings ADD COLUMN situation_json JSONB`
- `src/domain/saju/report/personalization-context.ts:28-49, 190-235` — `SajuPersonalizationContext` 에 `userSituation?: UserSituation` + `promptFacts` 끝에 1~3 phrase append
- `src/domain/saju/report/grounding-types.ts:151` — type 변화 없음 (이미 personalizationContext 포함)
- `src/components/saju/shared/compact-birth-fields.tsx` — `showCurrentSituation?: boolean` prop 추가 (today/MY/궁합 점진 적용)

**데이터 흐름** (§1 흐름도 참조)

**예상 작업량**: 12~16시간 (DB migration + 4 UI 진입점 + 1 context builder)

**회귀 위험**: situation_json 이 NULL 인 기존 reading 도 정상 동작해야 함 → `buildSajuPersonalizationContext()` 에서 `userSituation ?? null` 처리 가드 필수. existing fixture/spec (saju-data-v1.test.ts, build-grounding.test.ts, build-lifetime-report.test.ts, build-yearly-report.test.ts) 깨지지 않게 optional.

---

### PR 2 (Phase 1-2): 대운 cycle 데이터 구조 8단으로 확장

**변경 파일**
- `src/domain/saju/report/lifetime-types.ts:97-120` — `LifetimeMajorLuckCycle` 에 8 필드 추가 (hook / chapterTitle / chapterBody / mental / relationship / wealthCareer / practicalActions[] / closingNote). 기존 `summary/task` 는 deprecated 표시 후 유지 (회귀 방지).
- `src/domain/saju/report/build-lifetime-report.ts:257-291` `buildMajorLuckCycles()` — 신규 빌더 함수 8개 (각 sub-section 별로 1개씩) 추가. 기존 `buildMajorLuckReading` 은 유지하고 wrapper.
- `src/components/ai/lifetime-report-panel.tsx:333-421` `MajorLuckTimeline` — 카드 UI 를 ExpandableCard 로 재설계. mobile-first.
- `src/app/saju/[slug]/deep/page.tsx:483-548` — chip strip 그대로 두고 클릭 시 sheet/accordion 으로 expanded view.
- `src/app/saju/[slug]/premium/print/page.tsx:673` — 인쇄용으로 hook+chapterTitle+chapterBody 만.

**예상 작업량**: 20~28 시간

**회귀 위험**: `lifetime-report-panel.test`/`build-lifetime-report.test` 가 cycle 구조에 의존하므로 — 기존 필드 유지하고 신규 필드는 optional 로 부착. 단계적 마이그레이션.

---

### PR 3 (Phase 1-3): 챕터 헤드라인 카피 패턴 10종 일관 적용

**변경 파일**
- `src/domain/saju/report/interpretation-rule-table.ts:22-217` — 각 topic 의 lead 객체에 `headlinePatterns: { question, fomo, warning, secret, empathy, crisis, hope, transform, signal, twist }` 추가 (band 별 1문장씩).
- `src/domain/saju/report/build-report.ts:1042-1140` `buildTopicActions()` — pattern 선택 로직 (score band + cycle phase 기반).
- 같은 파일 `getInterpretationScoreBand()` 옆에 `selectHeadlinePattern(topic, scoreBand, cyclePhase): Pattern` 신규 함수.
- 7~10곳 carrier 는 자동 적용됨 (§3 의 carrier 효과).
- `src/app/saju/[slug]/page.tsx` §3 분야별 흐름 카드 헤더에 신규 헤드라인 적용.
- `src/components/ai/lifetime-report-panel.tsx:69-79` `SECTION_META` 라벨 옆에 동적 헤드라인 적용.

**예상 작업량**: 12~16 시간 (카피 라이팅 시간 별도)

**회귀 위험**: 기존 lead 시그니처 유지. 신규 헤드라인은 optional fallback.

---

### PR 4 (Phase 1-4): 개운법 ‘왜→무엇을→어떻게’ 3단 구체화

**변경 파일**
- `src/domain/saju/report/interpretation-rule-table.ts` — `actionLeads` 옆에 `actionReasons` / `actionMethods` 추가 (3단 구조).
- `src/domain/saju/report/build-report.ts:1042-1140` `buildTopicActions()` — 신규 `PracticalAction = { why, what, how }` 객체로 응답.
- `src/components/saju/saju-fact-evidence-panel.tsx` — practicalActions 렌더 카드 3단 분리.
- `src/components/ai/lifetime-report-panel.tsx` — `patternAndYongsin` 챕터의 `practicalActions` 노출 부분 3단 렌더.
- `src/app/saju/[slug]/page.tsx` §3 의 primaryAction.description 을 3단 break 표시.

**예상 작업량**: 8~12 시간

**회귀 위험**: `interpretation-rule-table.test.ts` / `build-report.test` (간접) 시그니처 확장만. 기존 description 폴백.

---

### PR 5 (Phase 2-1): 명리 일상어 사전 +14~20 매핑 + 세운 6요소 확장

**변경 파일**
- `src/lib/saju/terminology.ts:15-89` — FRIENDLY_TERM_MAP 에 양인살 / 역마살 / 12운성 라벨 / 재다신약 / 병신합 / 인신사 삼형 / 묘신원진 등 14~20 매핑 추가. 총 50+개 도달.
- `src/lib/saju/public-copy.ts` — TERM_REPLACEMENTS 변화 0 (terminology 가 source of truth).
- `src/domain/saju/report/build-yearly-report.ts:638-694` `createMonthlyFlow()` — 신규 6요소 (genjyo-myori / mechanism / coreKeywords / areaImpact / doAction / dontAction / closingMessage) 부착. 기존 fields 유지.
- `src/domain/saju/report/yearly-types.ts:70-83` `YearlyMonthFlow` 에 6 필드 추가 (optional).
- `src/components/ai/lifetime-report-panel.tsx` `yearlyAppendix` 렌더에 6요소 표시 옵션 추가.
- **Peak/Pitfall 마킹**: `momentum: 'rise' | 'steady' | 'caution'` 옆에 `peakLevel: 'peak' | 'pitfall' | 'normal'` 추가 (`yearly-types.ts:27`). `build-yearly-report.ts:625-636` `getMonthlyMomentum()` 옆에 `getPeakLevel()` 신설.

**예상 작업량**: 14~18 시간

**회귀 위험**: `topic-mapping.test.ts`, `build-yearly-report.test.ts` 가 momentum 에 의존 → optional peakLevel 만 추가, 기존 그대로.

---

### PR 6 (Phase 2-2): 원진·12운성·천간합·양인살 명리 엔진 강화

**변경 파일**
- `src/domain/saju/engine/orrery-adapter.ts:560-693` `buildRelations()` — `BRANCH_WONJIN_PAIRS = [['자','미'],['축','오'],['인','유'],['묘','신'],['진','해'],['사','술']]` 상수 + 케이스 추가 (~30 LOC).
- 같은 파일 — `buildTwelveStage(stem, branch): TwelveStage` 신규 함수 + 60셀 매트릭스 (~80 LOC).
- `saju-data-v1.ts:262` — `majorLuck[].twelveStage`, `wonjinRelations: string[]` 등 필드 추가. **카운팅 / 출력**.
- `src/domain/saju/report/build-grounding.ts` — relations evidence 에 원진 케이스 텍스트 추가.
- `src/domain/saju/report/build-lifetime-report.ts` — cycle 빌더에서 twelveStage / wonjin 활용한 카피 생성 (사주아이 톤).
- `src/lib/saju/terminology.ts` — 원진/12운성 라벨 매핑 PR 5 와 함께.

**예상 작업량**: 20~26 시간 (60셀 매트릭스 단위 테스트 포함)

**회귀 위험**: 기존 relations 동작 변화 0 (원진은 추가 케이스만). 12운성은 신규 필드 — optional. orrery-adapter test (saju-cross-fixtures.spec / saju-data-v2-verification.spec) 깨지지 않게.

---

### PR 7 (Phase 3): 시각화 / Peak·Pitfall UI / 마이크로 세분화

- 대운 타임라인 가로 스크롤 + 오행 색상 입히기 (`deep/page.tsx:483-548` 의 카드 UI 확장)
- 세운 카드 🚨/⚠️ 아이콘 + 컬러 마킹 (`lifetime-report-panel` `yearlyAppendix`)
- 사주 원국 + 대운 + 세운 합/충/원진 선 연결 SVG
- 음양관식 마이크로 세분화 (재물운 → 부동산/주식/사업/부업) — `yearly-types.ts:19-25` `YearlyCategoryKey` 확장
- 흐름사주식 교운기 체감 현상 리스트 (`build-lifetime-report.ts` 의 전환기 cycle 에 `transitionSigns: string[]` 부착)

**예상 작업량**: 40~60 시간

---

## §7. 절대 원칙 준수 가드 (audit 자체에 박아두기)

다음 항목은 PR 1~7 모두에서 **변경 0** 으로 유지해야 한다 (`/Users/kionya/ganji-saju/AGENTS.md` 가이드 + 과거 회귀 사례 기준):

- **Toss 결제 / Supabase Auth / Server Action / `href` / analytics handler 임의 변경 0**. 입력 폼은 client-side state 만 수정, submit() 의 fetch payload key 만 1 필드 (`userSituation`) 추가.
- **`as any` / `@ts-ignore` 0**. UserSituation 은 정식 interface로.
- **위험 action disabled** — `applySavedProfile()` `applyRecentGuestInput()` 등 기존 폼 자동복원 로직 그대로.
- **기존 spec 회귀 0** — fixture-19820129.spec, saju-cross-fixtures.spec, saju-data-v1.test, saju-data-v2-verification.spec, build-grounding.test, build-lifetime-report.test, build-yearly-report.test, build-fortune-calendar.test, classic-corpus-grounding.test, grounding-decision-trace.test, interpretation-rule-table.test, topic-rule-table.test, topic-mapping.test, build-narrative.test, kasi-calendar.test, birth-input.test, today-fortune 14건. PR 마다 변경 파일 옆 spec 먼저 grep 확인.
- **읽기 전용 영역**: `src/server/`, `src/proxy.ts`, `next.config.ts`, `vercel.json`, `src/lib/payments/`, `src/lib/credits/`, `src/lib/analytics-events.ts` 는 이번 시리즈 변경 금지.
- **Reading slug / cache key 안정성** — `buildReadingInsertPayload` 의 `birth_*` 필드와 `toSlug(input)` 함수는 절대 시그니처 변경 금지. `userSituation` 은 별도 컬럼 + 별도 JSON 으로만.
- **AGENTS.md 의 "This is NOT the Next.js you know"** 경고대로 — App Router/Server Component 규칙 임의 추정 금지. PR 마다 `node_modules/next/dist/docs/` 확인.

---

## §8. 단일 carrier 파일 4종 (변경 면적 최소화 키)

이 audit 의 가장 강력한 발견은, 사용자 자료의 요구 7건 중 5건이 **딱 4개 파일**에 집중 변경하면 7~10곳 풀이에 자동 전파된다는 점:

| Carrier | 파일 | 효과 범위 |
| --- | --- | --- |
| Personalization Context | `src/domain/saju/report/personalization-context.ts` | `userSituation` 1회 주입 → grounding을 거쳐 lifetime / yearly / today / love / wealth / career / relationship / compatibility 8 풀이 동시 호명. |
| Terminology Glossary | `src/lib/saju/terminology.ts` | FRIENDLY_TERM_MAP 14~20 추가 → `simplifySajuCopy` 호출하는 lifetime-report-panel / public-copy / build-report / build-yearly-report / build-lifetime-report 5 곳 동시 적용. |
| Interpretation Rule Table | `src/domain/saju/report/interpretation-rule-table.ts` | 75 슬롯에 10 패턴 + 3단 개운법 + headlinePatterns 추가 → `buildTopicActions` 가 호출되는 모든 풀이 동시 적용. |
| Orrery Adapter (relations + twelve stage) | `src/domain/saju/engine/orrery-adapter.ts` | 원진 + 12운성 add → grounding.evidenceCards.relations / specialSals / personalizationContext 의 promptFacts 자동 전파. |

→ Phase 1 / Phase 2 의 PR 1~6 은 사실상 이 4 carrier + UI 4개를 손보는 작업. UI는 `saju-intake-page` `lifetime-report-panel` `compact-birth-fields` `saju/[slug]/deep/page` 정도.

---

## §9. 다음 행동 1줄 요약

> **PR 1 (현재상황 3입력 + DB migration + personalization-context 확장)** 부터 시작. 4 carrier 파일 중 personalization-context 1개에 손대는 가장 작은 변경이지만, 이게 통과하면 PR 2~6 모두 "이 컨텍스트를 어떻게 카피로 풀어낼지" 의 문제가 되므로 risk-adjusted ROI 가 가장 높다.

— audit by Claude Opus 4.7 (read-only) · 2026-05-15
