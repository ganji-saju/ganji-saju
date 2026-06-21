# 오늘운세 하이브리드 LLM 풀이 — 설계 (2026-06-22)

## 1. 문제 (Problem)

오늘운세는 매일 재방문하는 핵심 기능인데, 사용자 피드백:
- **"큰 변화없이"** — 날마다 풀이가 비슷하게 느껴짐.
- **"대화의 연결이 부자연스럽게"** — 문장 흐름이 끊김.
- **"지금 상황에 맞게"** 풀이가 나와야 함.

### 코드 근거 진단
현 엔진은 결정론 템플릿(`src/server/today-fortune/build-today-fortune.ts`, 2941줄 + `src/lib/today-fortune/*`)이다. 날짜 변화가 아예 없지는 않다(일진으로 발동 케이스가 매일 바뀌고 변형 시드에 `dateKey` 포함). 그러나 체감 사이즈가 작은 구조적 원인:

1. **고정 우선순위 top-3** (`iljin-case-picker.ts: pickIljinMessages`): 발동 케이스를 고정 PRIORITY로 정렬해 상위 3개만 노출 → 높은 우선순위 케이스가 매일 같은 슬롯 차지 → 주제가 매일 비슷.
2. **케이스당 변형 5개뿐** (`iljin-message-library.ts`: 50 케이스 × 5 변형) → 같은 주제가 뜨면 1~2주면 문구 소진.
3. **독립 템플릿 3개를 연결어 없이 concat** (`top.map(...)` → 본문) → "부자연스러운 연결"의 직접 원인.
4. **메인 풀이(`oneLine.headline`/`oneLine.body`)가 작은 템플릿 풀에서 조립** (`buildPublicTodayHeadline`/`buildPublicTodayBody`).

→ **다양성 부족은 구조(고정 top-3 + 변형 5)에서, 부자연스러움은 조립(연결 없는 concat)에서** 나온다.

## 2. 목표 / 비목표

**목표**
- 매일 자연스럽게 *읽히는* 풀이(연결된 한 문단).
- 날마다 의미 있게 달라지는 풀이.
- 당일 관심사 + 프로필 상황 반영.
- 점수·사실의 정확성/일관성(honesty) 유지.

**비목표**
- 점수/사실 산출 로직 변경(결정론 유지).
- 프리미엄(언락) 풀이 개편(이번 범위는 무료 데일리).
- 비로그인(게스트) 사용자 LLM 적용(결정론 유지).

## 3. 확정된 방향 (브레인스토밍 결정)

1. **하이브리드** — 결정론 점수·사실은 그대로, 그 위에 LLM이 매일 자연스러운 프로즈를 작성.
2. **무료 데일리에 적용** — 유저·관심사당 하루 1콜 캐싱.
3. **상황 반영** — 당일 관심사 = 중심 주제, 프로필 상황 = 배경 맥락.

## 4. 아키텍처

기존 `src/app/api/interpret/route.ts`의 LLM 패턴을 그대로 따른다(검증된 골격):

```
요청 (buildTodayFortuneFreeResult 경로, 인증 유저)
  → 캐시 조회 (today_fortune_ai: user_id + date_key + concern_id + prompt_version)
      ├─ 히트 → 캐시된 headline/body 반환 (추가 비용 0)
      └─ 미스 →
           1. 결정론 facts grounding 빌드 (§6)
           2. 결정론 폴백 풀이 빌드 (= 현재 buildPublicTodayHeadline/Body 출력)
           3. generateAiText({ prompt, fallbackText, model, maxOutputTokens, feature:'today_fortune', userId })
           4. 출력 검증 (§8: 금지어/한자/doom/단정 validator)
           5. 통과 → today_fortune_ai upsert + 반환 (source='openai')
              위반/실패 → 결정론 폴백 반환 (source='fallback')
           6. recordLlmRun 텔레메트리
```

- **플래그 게이팅**: `OPENAI_TODAY_FORTUNE` env (기존 `OPENAI_INTERPRET_*` 패턴). 미설정/`0` → 전부 결정론(현 동작, 회귀 0). `1` → LLM 활성. 점진 롤아웃·즉시 롤백 가능.
- LLM 호출은 `buildTodayFortuneFreeResult` 직후 결과의 `oneLine`만 덮어쓰는 **서버 측 후처리 단계**로 격리(기존 결정론 빌드는 무수정 → 폴백이 항상 현 동작과 동일).

## 5. LLM이 쓰는 것 / 결정론으로 남는 것 (경계)

| 항목 | 주체 |
|---|---|
| `oneLine.headline` (한 줄 헤드라인) | **LLM** |
| `oneLine.body` (메인 풀이 본문) — 3개 일진 메시지를 연결된 문단으로 녹임 | **LLM** |
| iljinScore·등급, 모든 영역 점수(scores) | 결정론 (불변) |
| 신살/합충 사실, 카테고리 카드, 럭키 패키지, opportunity/risk, reasonBody | 결정론 (불변) |

→ 점수와 본문이 어긋나지 않도록 점수는 결정론 단일 출처 유지. LLM은 "사실을 자연스러운 말로" 옮기는 역할만.

## 6. Facts grounding (LLM 입력)

결정론에서 추출한 구조화 사실(JSON)을 프롬프트에 주입:
- 오늘 일진: 천간+지지(`todayPillar`), 일진 점수+등급(`iljinScore`).
- 십성(일간 대비 일진 천간), **발동된 전체 케이스와 의미**(top-3 제한 없이 `detectTriggeredCases` 전부 + 각 케이스의 한 줄 의미).
- 약한 오행(`sajuData.fiveElements.weakest`), 강한 오행.
- 영역 점수(scores) 상위/하위.
- 당일 관심사(`concernId` + label), 프로필 상황(직업/연애상태/고민, `personalizationContext.userSituation`).
- 이름.

→ 고정 top-3가 아니라 **풍부한 사실 위에서** LLM이 그날 맞춤 작성 = "큰 변화없이"의 구조적 원인 제거.

## 7. 캐시 + 비용

- **테이블**: 신규 `public.today_fortune_ai`
  ```
  id uuid pk default gen_random_uuid()
  user_id uuid not null references auth.users(id) on delete cascade
  date_key text not null            -- KST 'YYYY-MM-DD'
  concern_id text not null
  prompt_version text not null
  headline text not null
  body text not null
  source text not null              -- 'openai' | 'fallback'
  model text
  fallback_reason text
  iljin_ganzi text                  -- 감사용(어느 일진인지)
  created_at timestamptz default now()
  updated_at timestamptz default now()
  unique (user_id, date_key, concern_id, prompt_version)
  ```
  - RLS enable. select 정책: `auth.uid() = user_id`. insert/update는 service_role 경로.
  - **마이그레이션 수동 적용**(memory: Supabase migration은 CLI 수동, drift 이력).
- **비용**: 유저·관심사당 하루 1콜. 재방문/새로고침/같은 관심사 = 캐시 히트(0). 관심사 변경 시에만 추가 1콜. ≈ DAU × (관심사 전환수+1)/일. 저비용 모델 tier + `maxOutputTokens` 캡(예: 500)으로 상한.

## 8. 안전 · 정직성

- 기존 validator 재사용(단정 예측·한자 노출·doom/공포 어휘·`반드시/절대/100%` 차단) — `chapter-validator`/`total-review-validator` 계열 규칙 적용.
- **위반/빈 응답/타임아웃 → 결정론 폴백**(현 동작) → 사용자에게 깨진 출력 노출 0.
- AI 생성 고지(`/ai-disclaimer` 링크/배지) 노출.
- `recordLlmRun`으로 비용·소스·폴백 사유 텔레메트리.

## 9. 테스트

- grounding 빌더: 같은 입력 → 같은 facts(결정론) 단위테스트.
- validator: 금지 표현 포함 출력은 reject + 폴백 픽스처.
- 캐시 멱등: 같은 (user,date,concern,version) 재호출 → LLM 재생성 0(캐시 히트).
- 폴백 경로: LLM 실패/위반 → 결정론 headline/body 반환(현 출력과 동일).
- 플래그 OFF: 전 경로 결정론(회귀 0).

## 10. 받아들인 트레이드오프 (원래 보류 사유)

- **DB**: 신규 테이블 + 수동 마이그레이션.
- **비용**: ≈ DAU × 1콜/일(캐싱 통제). 모델·토큰 캡으로 상한.
- **safety**: validator + 폴백 + 고지로 관리(완벽 차단 아님 → 고지 동반).

## 11. 롤아웃

1. 마이그레이션 적용(테이블 생성).
2. 코드 배포(플래그 OFF = 현 동작).
3. 스테이징/소수 유저 `OPENAI_TODAY_FORTUNE=1` → 출력·비용·폴백률 관찰.
4. 이상 없으면 프로덕션 플래그 ON. 문제 시 플래그 OFF로 즉시 롤백.
