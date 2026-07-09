# 단일 출생정보 입력 허브 — 설계 (옵션 3)

> 작성 2026-07-10 · 상태: 승인됨(설계 확정) · 트리거: 시니어 사용성 피드백
> 진단·제안 배경: `docs/proposals/2026-07-10-birth-input-unification.md`

## 목표 (한 문장)
출생정보를 **1회 입력**하면 오늘운세·사주를 재입력 없이 볼 수 있게 하고, 사주 입력을 **3스텝 → 1화면**으로 합쳐 시니어도 쉽게 쓰게 한다.

## 확정된 결정 (사용자 승인)
1. **분기 모델**: 입력 → 선택화면(`[오늘의 운세] [내 사주]`) — 허브 모델.
2. **진입점 의도 보존**: 상품 지정 링크는 선택화면을 건너뛰고 바로 해당 상품으로(`?next=`). 선택화면은 "안 정한" 진입에서만.
3. **허브 라우트 신설**: `/start` 를 새로 만든다(홈 인라인 아님).
4. **관심주제(구 스텝3)**: 입력 1화면 **하단 접이식(기본 접힘, 선택)**.
5. **이름 필드**: 공용 입력에 **선택 1필드** 포함(사주=별칭, 오늘운세=표시명). 미입력 시 기존 fallback 유지(비파괴).

## 아키텍처

### 진입 흐름
```
[의도 없음]  /start           → UnifiedIntake            → 선택화면 [오늘의 운세] [내 사주]
[의도 있음]  /saju/new        → UnifiedIntake(next=saju) → 바로 사주 결과(/saju/{id})
[의도 있음]  /today-fortune   → UnifiedIntake(next=today)→ 바로 오늘운세 결과(/today-fortune/result)
[의도 있음]  광고/CTA/SEO/메가내비 → 대상 라우트 or /start?next=<product>
```

- **`next` 파라미터**: `today` | `saju`. 값이 있으면 입력 완료 후 선택화면을 건너뛰고 해당 상품 제출·라우팅. 없으면 선택화면 렌더.
- 기존 `/saju/new`·`/today-fortune`은 **유지**하되 입력부를 공용 컴포넌트로 교체(각각 next 고정).
- **결과 화면 크로스링크**: 각 결과 하단에 "이 정보로 ○○도 보기" — 공용키/프로필로 재입력 없이 다른 상품 진입.

### 컴포넌트 경계
| 유닛 | 책임 | 위치(신규/수정) |
|---|---|---|
| `UnifiedIntake` | 공용 입력 오케스트레이터: 필드 수집·검증·프로필/게스트 자동채움·제출·`next` 라우팅 | 신규 `src/features/unified-intake/` |
| 입력 필드 UI | 기존 `UnifiedBirthInfoFields`(date+gender+location-time 전 섹션) 재사용 + 이름·관심주제 접이식 | 기존 `src/components/saju/shared/unified-birth-info-fields.tsx` 활용/확장 |
| 선택화면 | 입력 후 상품 선택 카드 2종 | 신규 (허브 하위) |
| `/start` 페이지 | 허브 엔트리(의도 없음 기본) | 신규 `src/app/start/page.tsx` |
| 게스트 공용 저장 | `moonlight:birth-profile:last` read/write + 레거시 흡수 | 신규 유틸(기존 `onboarding-storage.ts` 인접) |

### 데이터 / 저장
- **게스트 공용 키** `moonlight:birth-profile:last` 신설 — 세 진입점이 읽고 씀. 기존 `moonlight:saju-recent-guest-input-v1` 값 존재 시 최초 1회 흡수(additive, 파괴 없음).
- **로그인**: 기존 `/api/profile` 자동로드·저장 경로 유지. 제출 시 프로필 갱신(기존 `shouldAutoSavePersonalProfile` 로직 유지).
- **밑단 불변**: `resolveUnifiedBirthInput`(파싱/검증), `toSlug`(결정론 slug), `BIRTH_LOCATION_PRESETS` 그대로 사용 → 결과 계산 로직 변화 없음.
- 제출 API 유지: 사주=`POST /api/readings`, 오늘운세=`POST /api/today-fortune`. `UnifiedIntake`가 `next`에 따라 올바른 API 선택.

### 입력 화면 구성 (단일 패널, 위→아래)
1. 이름 — 선택 1필드
2. 생년월일 년/월/일 + 양력/음력 토글
3. 태어난 시각 + "시간 모름"
4. 성별
5. 출생지 — 프리셋 칩 우선, 검색은 펼침
6. **▸ 관심 주제·상황 (접이식, 기본 접힘, 선택)** — 구 스텝3(focusTopic/relationshipStatus/occupation/currentConcern/concernNote)
7. 하단 큰 버튼 — next 있으면 "사주 풀이 보기"/"오늘 운세 보기", 없으면 "결과 보기"→선택화면

### 시니어 UI 원칙
- 스와이프를 주동작에서 제거 → 큰 "다음/보기" 버튼이 주동작(스와이프는 보조 허용).
- 큰 라벨·큰 터치타깃(기존 readability 토큰과 정합).
- 출생지: 검색보다 프리셋 칩 우선.
- 화면 1개 → 진행표시(step n/3) 제거.

## 에러 / 엣지 처리
- 검증 실패: 기존 `validateBirthStep`/`resolveUnifiedBirthInput` 규칙 유지(필수=생년월일·성별, 시각은 모름 허용, 출생지 필요 규칙 유지). 오류는 해당 필드 인라인 표기.
- 네트워크 실패: 기존 fallback(`toSlug`로 클라 slug 생성 후 라우팅) 유지.
- `next` 잘못된 값: 선택화면으로 폴백.
- 이름 미입력: 오늘운세 서버 이름 fallback(reading.input에 이름 없음 — 기존 동작) 유지, 사주 별칭 공란 허용.
- 2회차 진입: 저장정보 있으면 "○○님 정보로 볼게요 · [정보 바꾸기]" 요약 카드로 재입력 스킵.

## 범위 / 비범위
- **범위**: `/start` 허브·선택화면, `UnifiedIntake`, 사주 3→1 병합, 관심주제 접이식, 게스트 공용키, 시니어 UI, 결과 크로스링크, next 의도 라우팅, 진입점(메가내비/SEO/CTA) next 전달.
- **비범위(후속)**: 궁합(상대 정보 필요) 허브 편입, 결제/페이월 구조 변경, 결과 페이지 자체 리디자인.

## 테스트 전략
- **회귀(핵심)**: `resolveUnifiedBirthInput`·`toSlug` 입력→slug 불변(기존 결과 재현). 관심주제 미입력 시 사주 결과 정상 산출.
- **공용키**: `moonlight:birth-profile:last` read/write, 레거시 `saju-recent-guest-input-v1` 흡수 1회성.
- **라우팅**: next=today/saju/무 각각 목적지(선택화면 vs 상품 결과) 단위 검증.
- **자동채움**: 로그인 프로필 로드 → 필드 프리필; 게스트 공용키 → 프리필.
- **접근성/시니어**: 버튼이 주동작(스와이프 없이 완주 가능), 터치타깃 크기.

## 리스크
- `saju-intake-page.tsx`(1713줄) 단일 파일 — 스텝 병합 시 렌더 함수 분리(파일 정리) 동반 필요.
- 이름 필드 추가가 오늘운세 이름 fallback 경로에 영향 없도록 선택·비파괴 처리(메모 `project_today-fortune-name-fallback`).
- 진입점이 많음(메가내비·SEO 퍼널·CTA) — next 전달 누락 시 선택화면 노출(치명 아님, 폴백 안전).
