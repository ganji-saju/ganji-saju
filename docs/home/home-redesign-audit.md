# 홈 리디자인 구조 감사

작성일: 2026-05-11

## 1. Current Home Structure

현재 홈 라우트는 `src/app/page.tsx`다. 이 파일은 서버에서 `getHomeBanners()`를 호출한 뒤 `src/features/home/gangi-home-client.tsx`의 `GangiHomeClient`에 `initialBanners`를 전달한다.

| 항목 | 위치 | 확인 내용 |
|---|---|---|
| 홈 route | `src/app/page.tsx` | `dynamic = 'force-dynamic'`, `getHomeBanners()` 호출 |
| 홈 client UI | `src/features/home/gangi-home-client.tsx` | 실제 홈 UI 조립 지점 |
| 홈 배너 data source | `src/server/home/home-banners.ts` | 오늘운세, 띠운세, 별자리 배너 생성 |
| 홈 카드 data source | `src/content/gangi-market.ts` | 배너, 무료 액션, 카테고리, 서비스 카드 상수 |
| 보조 홈 data source | `src/features/home/content.ts` | 개인화 카피, 서비스 엔트리, 무료 경험, 멤버십 카피 |
| 개인화 요약 유틸 | `src/features/home/personalized-today.ts` | 저장 프로필 기반 오늘 요약 생성 가능 |

현재 렌더링 흐름은 `AppShell` 안에 `SiteHeader`를 넣고, `GangiSeasonBanner`, 무료 액션 카드, 카테고리 탭, 서비스 카드 그리드를 순서대로 표시하는 모바일 카드몰 구조다. 달빛 성향사주와 달빛 성향궁합은 라우트가 존재하지만 현재 홈의 핵심 CTA나 서비스 카드에는 직접 노출되어 있지 않다.

## 2. Current Navigation

| 역할 | 위치 | 확인 내용 |
|---|---|---|
| 전역 layout | `src/app/layout.tsx` | `Noto Sans KR`, Vercel Analytics, SpeedInsights 설정 |
| App shell | `src/shared/layout/app-shell.tsx` | 기본 header, footer, main wrapper 제공 |
| Header | `src/features/shared-navigation/site-header.tsx` | 상단 header와 모바일 하단 dock 구성 |
| Footer | `src/components/site-footer.tsx` | 약관, 개인정보처리방침, 가격, 알림 링크 |
| Navigation config | `src/shared/config/site-navigation.ts` | `src/content/moonlight.ts`의 navigation 상수 재노출 |
| Navigation source | `src/content/moonlight.ts` | `PRIMARY_TABS`, `HEADER_SHORTCUTS`, `MY_MENU_ITEMS` 정의 |

`HEADER_SHORTCUTS`에는 오늘운, 타로, 사주, 궁합, 띠운세, 별자리가 있다. `PRIMARY_TABS`는 홈, 사주추가, 무료운세, 대화방, 보관함 중심이며, `/compatibility`가 대화방 탭의 match prefix에 포함되어 있다. 성향궁합을 홈 CTA로 노출하는 것은 안전하지만, 하단 탭 활성 상태까지 정교하게 맞추려면 navigation IA 검토가 별도로 필요하다.

## 3. Current Home Components

| 컴포넌트 | 위치 | 현재 역할 |
|---|---|---|
| `GangiHomeClient` | `src/features/home/gangi-home-client.tsx` | 홈 전체 화면 조립 |
| `GangiSeasonBanner` | `src/components/gangi/gangi-market.tsx` | 상단 배너 carousel |
| `GangiQuickActionCard` | `src/components/gangi/gangi-market.tsx` | 무료 시작 카드 |
| `GangiCategoryTabs` | `src/components/gangi/gangi-market.tsx` | 서비스 카테고리 필터 |
| `GangiServiceCardLink` | `src/components/gangi/gangi-market.tsx` | 서비스 카드 링크 |
| `GANGI_HOME_CARDS` | `src/content/gangi-market.ts` | 오늘운세, 타로, 사주, 궁합, 올해 흐름, 좋은 날, 띠운세, 상담 카드 |
| `GANGI_FREE_ACTIONS` | `src/content/gangi-market.ts` | 오늘운세, 타로 한 장 |
| `GANGI_HOME_CATEGORIES` | `src/content/gangi-market.ts` | 전체, 사주, 운세, 상담 필터 |

현재 홈 전용 analytics는 `home_view`, `home_service_menu_click`, `home_free_today_click`, `home_free_tarot_click` 중심으로 동작한다.

## 4. Existing Service Routes

| 서비스 | 홈에서 연결할 route | 실제 route 파일 |
|---|---|---|
| 오늘운세 | `/today-fortune?concern=general` | `src/app/today-fortune/page.tsx` |
| 타로 한 장 | `/tarot/daily` | `src/app/tarot/daily/page.tsx` |
| 타로 뽑기 | `/tarot/daily/pick` | `src/app/tarot/daily/pick/page.tsx` |
| 내 사주풀이 | `/saju/new` | `src/app/saju/new/page.tsx` |
| 사주 메인 | `/saju` | `src/app/saju/page.tsx` |
| 궁합 메인 | `/compatibility` | `src/app/compatibility/page.tsx` |
| 궁합 입력 | `/compatibility/input` | `src/app/compatibility/input/page.tsx` |
| 올해 흐름 | `/daewoon` | `src/app/daewoon/page.tsx` |
| 좋은 날 | `/taekil` | `src/app/taekil/page.tsx` |
| 띠운세 | `/zodiac` | `src/app/zodiac/page.tsx` |
| 별자리 | `/star-sign` | `src/app/star-sign/page.tsx` |
| 대화방 | `/dialogue` | `src/app/dialogue/page.tsx` |
| 보관함 | `/my` 권장, `/my/results` 확인 필요 | `src/app/my/page.tsx` 존재, `src/app/my/results/page.tsx` 없음 |
| 가격 | `/pricing` | `src/app/pricing/page.tsx` |
| 멤버십 | `/membership` | `src/app/membership/page.tsx` |
| 크레딧 | `/credits` | `src/app/credits/page.tsx` |

보관함은 현재 여러 navigation/link에서 `/my/results`를 사용하지만 실제 `src/app/my/results/page.tsx`는 확인되지 않았다. 홈의 Recent Reports / Archive CTA는 구현 전 `/my`로 연결할지, `/my/results` route를 별도 정비할지 결정이 필요하다.

## 5. New Feature Routes

| 신규 기능 | 홈 노출명 | 연결 route | 실제 route 파일 |
|---|---|---|---|
| 달빛 성향사주 | 달빛 성향사주 | `/saju/personality` | `src/app/saju/personality/page.tsx` |
| 달빛 성향사주 결과 | 결과 화면 | `/saju/personality/result` | `src/app/saju/personality/result/page.tsx` |
| 달빛 성향궁합 | 달빛 성향궁합 | `/compatibility/personality` | `src/app/compatibility/personality/page.tsx` |
| 달빛 성향궁합 결과 | 결과 화면 | `/compatibility/personality/result` | `src/app/compatibility/personality/result/page.tsx` |

홈 CTA는 결과 route가 아니라 입력 route인 `/saju/personality`, `/compatibility/personality`로 연결하는 것이 안전하다.

## 6. Reusable Components

| 영역 | 재사용 후보 | 비고 |
|---|---|---|
| Shell | `AppShell`, `SiteHeader`, `SiteFooter` | 홈 전체 wrapper 유지 |
| Home cards | `GangiSeasonBanner`, `GangiQuickActionCard`, `GangiServiceCardLink` | 기존 홈의 look and feel 유지 |
| Layout | `SectionHeader`, `SectionSurface`, `FeatureCard`, `ProductGrid`, `ActionCluster` | 신규 섹션 구조화 가능 |
| UI primitives | `Button`, `Card`, `Badge`, `Separator` | CTA, 카드, 라벨 구성 가능 |
| Home data | `GANGI_HOME_CARDS`, `GANGI_FREE_ACTIONS`, `GANGI_HOME_CATEGORIES` | 카드 추가/우선순위 변경 지점 |
| Today data | `getHomeBanners`, `buildPersonalizedTodaySummary` | Today Snapshot 후보 |
| Styles | `src/app/styles/home.css`, `src/app/styles/app-shell.css`, `src/app/styles/tokens.css` | 홈 전용 스타일과 디자인 토큰 |
| Font | `src/app/layout.tsx` | `Noto Sans KR` 기반 `--font-dalbit-sans` 유지 |

성향 관련 문구는 공식 검사처럼 보이지 않도록 `16유형 성향`, `성향 체크`, `나를 이해하는 참고 콘텐츠` 톤을 유지해야 한다.

## 7. Components To Create

아래는 다음 구현 단계에서 필요할 수 있는 신규 홈 전용 컴포넌트 후보이며, 이번 감사에서는 생성하지 않았다.

| 후보 컴포넌트 | 목적 | 생성 위치 후보 |
|---|---|---|
| `HomeHeroSection` | "오늘 무엇을 보고 싶나요?" 상단 hero | `src/features/home/gangi-home-client.tsx` 내부 또는 `src/components/home` |
| `HomeTodaySnapshot` | 오늘운세, 띠, 별자리, 개인화 요약을 짧게 표시 | `src/components/home` |
| `HomePrimaryFeatureCards` | 달빛 성향사주, 달빛 성향궁합 핵심 CTA | `src/components/home` |
| `HomeThemeServiceGrid` | 기존 서비스 grid를 목표 구조에 맞게 정리 | 기존 `GangiServiceCardLink` 재사용 우선 |
| `HomeAiDialogueSection` | AI 대화방 CTA | `src/components/home` |
| `HomeArchiveCta` | 최근 리포트/보관함 CTA | `src/components/home` |
| `HomeMembershipCta` | 가격/멤버십 CTA | `src/components/home` |

첫 구현은 컴포넌트 파일을 과하게 늘리기보다 `GangiHomeClient` 안에서 섹션 구조를 잡고, 반복되는 카드만 분리하는 방식이 안전하다.

## 8. Files To Modify

| 파일 | 예상 변경 |
|---|---|
| `src/features/home/gangi-home-client.tsx` | 목표 홈 섹션 순서로 UI 재구성 |
| `src/content/gangi-market.ts` | 달빛 성향사주, 달빛 성향궁합 카드 추가 및 서비스 우선순위 조정 |
| `src/app/styles/home.css` | 신규 hero, primary feature, snapshot, CTA 섹션 스타일 추가 |
| `src/app/styles/mobile-polish.css` | 모바일 spacing, sticky dock 간섭 보정 필요 시 수정 |
| `src/components/gangi/gangi-market.tsx` | 기존 카드 컴포넌트로 부족할 경우 variant 추가 |
| `src/content/moonlight.ts` | header shortcut 또는 mobile menu에 신규 기능 노출이 필요할 경우만 수정 |
| `src/lib/analytics-events.ts` | 신규 홈 CTA 클릭 이벤트를 별도 측정할 경우만 수정 |
| `src/server/home/home-banners.ts` | Today Snapshot을 서버 배너와 더 강하게 통합할 경우만 수정 |
| `src/app/page.tsx` | Recent Reports 등 서버 데이터가 필요할 경우만 수정 |

수정하지 말아야 할 영역은 `src/domains/saju-personality`, `src/domains/compatibility-personality`, `src/domain/saju/engine`, `src/lib/payments`, `src/app/api/payments`, `supabase/migrations`다.

## 9. Risks

| 리스크 | 영향 | 대응 |
|---|---|---|
| `/my/results` route 부재 | 보관함 CTA가 404로 이어질 수 있음 | 홈에서는 `/my` 우선 연결 또는 route 정비 후 사용 |
| 현재 홈이 430px 모바일 카드몰 중심 | 목표 홈 구조가 데스크톱에서 좁고 길어질 수 있음 | `home.css`에 responsive grid와 desktop max-width 확장 |
| 신규 기능을 홈에만 노출 | 사용자가 메뉴에서 다시 찾기 어려울 수 있음 | 필요 시 `HEADER_SHORTCUTS` 또는 서비스 grid에도 노출 |
| 성향사주/성향궁합 문구가 검사처럼 보일 위험 | 금지 표현 정책 위반 가능 | `16유형 성향`, `성향 체크` 표현 사용 |
| Today Snapshot 개인화 | 홈 화면에 이름/생년월일이 노출될 수 있음 | 원문 개인정보 없이 요약형 문구만 사용 |
| 홈 섹션 과다 | 모바일 스크롤 피로 증가 | 성향사주/성향궁합, 무료 시작 카드, 기존 서비스 grid 순으로 우선순위 고정 |
| navigation match prefix | `/compatibility`가 대화방 탭으로 활성화될 수 있음 | IA 수정이 필요하면 별도 task로 분리 |

## 10. Next Step

다음 단계는 홈 UI 구현이다. 우선 `src/features/home/gangi-home-client.tsx`, `src/content/gangi-market.ts`, `src/app/styles/home.css`만 중심으로 달빛 성향사주와 달빛 성향궁합을 Primary Feature Cards로 올리고, 기존 오늘운세/타로/사주/궁합/띠운세/별자리/대화방/보관함/가격 동선은 유지한다.

결제, DB, Supabase migration, 사주 계산, 성향궁합/성향사주 도메인 로직은 다음 구현 단계에서도 수정하지 않는다.
