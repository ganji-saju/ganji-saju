# 12간지 대화방 UI 적용 보고서

## Summary

대화방의 기존 route, 채팅 UI, 입력창, 말풍선, AI 호출, 대화 저장/과금 조건을 유지하면서 persona 선택 UI와 표시 문구를 12간지 캐릭터 중심으로 정리했다. DB 컬럼 또는 API payload의 `expertId`, `teacherName` 같은 내부 명칭은 호환성을 위해 유지하고, 사용자에게 보이는 값만 `자(子)쥐`부터 `해(亥)돼지`까지의 12간지 캐릭터 체계로 교체했다.

## Checked Structure

- Dialogue routes: `/dialogue`, `/dialogue/[expert]`, `/dialogue/safe-redirect`
- Chat UI: `src/components/dialogue/dialogue-chat-panel.tsx`
- Persona config: `src/lib/dialogue-experts.ts`
- Existing API route: `src/app/api/ai/route.ts`
- Existing API helpers/tests: `src/app/api/ai/route-helpers.ts`, `src/app/api/ai/route.test.ts`
- Legacy 12간지 UI source: `src/components/gangi/gangi-ui.tsx`
- Menu/content config: `src/content/moonlight.ts`, `src/content/gangi-market.ts`

## 12간지 Config

Primary config is `src/lib/dialogue-experts.ts`.

- `rat`: 자(子)쥐 · 오늘의 흐름 · 빠른 선택, 기회 포착
- `ox`: 축(丑)소 · 안정과 루틴 · 돈, 안정, 루틴, 장기 선택
- `tiger`: 인(寅)호랑이 · 커리어와 실행 · 커리어, 도전, 실행력
- `rabbit`: 묘(卯)토끼 · 연애와 말투 · 연애, 관계 회복, 말투
- `dragon`: 진(辰)용 · 큰 흐름 · 큰 흐름, 대운, 올해 방향
- `snake`: 사(巳)뱀 · 속마음 분석 · 속마음, 심리, 관계 분석
- `horse`: 오(午)말 · 연락과 표현 · 연락, 표현, 이동
- `sheep`: 미(未)양 · 가족과 회복 · 가족, 회복, 마음 안정
- `monkey`: 신(申)원숭이 · 전략과 협상 · 전략, 문제 해결, 협상
- `rooster`: 유(酉)닭 · 정리와 계획 · 정리, 계획, 좋은 날
- `dog`: 술(戌)개 · 신뢰와 약속 · 신뢰, 약속, 장기 관계
- `pig`: 해(亥)돼지 · 복과 재충전 · 복, 여유, 마무리, 재충전

## UI Changes

- `/dialogue`의 상단 카피를 `12간지 캐릭터와 대화하기`로 변경했다.
- 추천 영역은 `오늘의 추천 간지`로 변경하고 `자쥐`, `묘토끼`, `진용` 3개를 우선 노출했다.
- 전체 목록은 `전체 12간지` compact list로 유지했다.
- `/dialogue/[expert]`의 room header와 metadata는 선택된 12간지 캐릭터 이름을 사용한다.
- 채팅 패널의 안내 문구를 `선택한 12간지 캐릭터`, `12간지 캐릭터 바꾸기`, `캐릭터에게 물어보기`로 변경했다.

## Logic Preserved

- Existing route path preserved: `/dialogue`, `/dialogue/[expert]`
- Existing dynamic segment field preserved: `expert`
- Existing API field preserved: `expertId`
- Existing chat API preserved: `/api/ai`
- Existing chat billing/free-turn logic preserved
- Existing profile context loading preserved
- Existing context handoff query params preserved
- No DB migration added
- No payment or membership logic changed

## Image Fallback

대화방 목록과 채팅 header는 기존 `GangiCharacter`를 사용한다. 이 컴포넌트는 이미지 asset 없이 emoji/glyph 기반 CSS 캐릭터를 렌더링하므로, 캐릭터 이미지가 없어도 화면이 깨지지 않는다. 12개 대형 이미지를 첫 화면에 로드하지 않았다.

## Removed Expressions Check

기존 4인 상담자 고유명과 4인 추천/선택 안내 문구는 `src`와 관련 문서에서 직접 노출되지 않도록 제거했다. 검수 검색어는 작업 지시의 제거 대상 표현 전체를 기준으로 확인했다.

## Remaining Risks

- 내부 타입명 `teacherName`은 DB/API 호환을 위해 유지했다. 추후 별도 migration 없이 프론트 alias(`characterName`)를 추가하는 리팩터는 가능하다.
- 실제 실기기 360/390/430px 대화 입력 UX는 최종 QA에서 확인이 필요하다.
- 기존 대화 저장 구조는 이번 작업에서 변경하지 않았으므로, 저장 DB 컬럼명에 `teacher` 계열 이름이 있다면 문서상 alias 정책을 유지해야 한다.

## Next Step

작업 10에서 보관함/가격 페이지를 달빛 결 디자인 시스템에 맞춰 정리한다.
