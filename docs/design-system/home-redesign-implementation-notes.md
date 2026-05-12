# Home Redesign Implementation Notes

## Summary

`/` 홈 화면을 달빛 결 디자인 시스템의 흐름 중심 구조로 정리했다. 기존 카드 나열형 확장을 늘리지 않고, `FusionHero`와 `FlowEntryList`, `LightSection`을 활용해 사용자가 먼저 고를 수 있는 흐름을 `나의 결 / 관계의 결 / 오늘의 결 / 12간지 대화`로 압축했다.

## Modified Files

- `src/features/home/gangi-home-client.tsx`

## Home Route

- 유지 route: `/`
- route 파일: `src/app/page.tsx`
- 실제 홈 UI 구성 파일: `src/features/home/gangi-home-client.tsx`

## Applied Structure

1. `FusionHero`
   - 사주 네 기둥과 16유형 성향이 만나는 곳
   - `年 月 日 時 × I/E S/N T/F J/P` 브랜드 맥락 유지
   - 핵심 CTA는 `내 성향사주 보기`, `우리 성향궁합 보기`로 유지

2. `FlowEntryList`
   - `01 나의 결 보기`: 달빛 성향사주 진입
   - `02 관계의 결 보기`: 달빛 성향궁합 진입
   - `03 오늘의 결 보기`: 오늘운세 진입

3. `TodayLine`
   - 기존 오늘의 한 줄 배너 데이터 재사용
   - 무료 오늘운세 CTA 유지
   - 타로, 띠운세, 별자리 보조 CTA 추가

4. `ZodiacDialogueCTA`
   - 기존 대화방 route 유지
   - 12간지 캐릭터 세계관으로 표현
   - 홈에서는 대형 이미지 없이 한자 glyph만 사용

5. `ContinueSection`
   - 로그인 상태에 따라 보관함 또는 로그인 안내 유지
   - 기본 사주풀이와 기본 궁합 링크 유지

6. `PricingTeaser`
   - 가격 안내, 멤버십 링크 유지
   - `HOME_PRODUCT_COPY` 가격 데이터 재사용

## Preserved Links

- 달빛 성향사주: `/saju/personality`
- 달빛 성향궁합: `/compatibility/personality`
- 오늘운세: `/today-fortune?concern=general`
- 타로: `/tarot/daily`
- 띠운세: `/zodiac`
- 별자리: `/star-sign`
- 기본 사주풀이: `/saju/new`
- 기본 궁합: `/compatibility`
- 12간지 대화방: `/dialogue`
- 보관함: `/my`
- 가격 안내: `/pricing`
- 멤버십: `/membership`

## Client Component Impact

홈 전체는 서버 컴포넌트 흐름을 유지했다. 기존 `HomeAnalyticsBoundary` client island만 클릭 이벤트와 `home_viewed` 이벤트를 담당하며, 이번 작업으로 추가 client boundary는 만들지 않았다.

## What Was Not Changed

- 결제 로직
- DB 또는 Supabase migration
- 사주 계산 로직
- 성향 계산 로직
- 결과 생성 로직
- 대화방 route 또는 채팅 저장 구조
- 12간지 persona 구조

## Performance Notes

- 12간지 CTA는 이미지 대신 텍스트 glyph를 사용해 홈 above-the-fold 이후 부담을 줄였다.
- 카드 grid를 추가하지 않고 기존 row/list/panel 구조를 유지했다.
- 애니메이션, blur, heavy dependency를 추가하지 않았다.

## Next Step

- 내 풀이 페이지군에 `StepFlowShell`, `ChoiceRow`, `StickyActionBar`를 점진 적용한다.
- 성향사주와 성향궁합 입력 페이지에서 active step 중심 렌더링을 확인한다.
- 실기기 모바일에서 홈 첫 화면 CTA 노출과 bottom nav 간격을 확인한다.
