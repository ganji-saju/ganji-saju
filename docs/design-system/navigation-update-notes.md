# AppShell / Navigation Update Notes

작성일: 2026-05-12
작업 범위: AppShell, SiteHeader, MobileBottomNav, Footer 구조 점검과 공통 navigation 정리
비범위: 결제, DB, Supabase migration, 사주 계산, 성향 계산, 결과 생성, 대화 저장 로직

## 1. 기존 Navigation 구조

| 영역 | 기존 상태 |
|---|---|
| Root layout | `src/app/layout.tsx`에서 global CSS, font, analytics, speed insights를 로드 |
| AppShell | `src/shared/layout/app-shell.tsx`가 header/footer를 기본 제공 |
| Header | `src/features/shared-navigation/site-header.tsx`가 desktop top nav, mobile top actions, mobile menu, mobile bottom nav를 모두 렌더링 |
| Footer | `src/components/site-footer.tsx`가 약관, 개인정보처리방침, 가격 안내, 알림 설정, 사업자 정보, 면책 문구를 렌더링 |
| Navigation data | `src/content/moonlight.ts`의 `PRIMARY_TABS`, `HEADER_SHORTCUTS`를 `src/shared/config/site-navigation.ts`가 재노출 |
| 중복 요소 | 실제로 숨겨져 있던 desktop secondary shortcut nav DOM이 header 안에 남아 있었음 |

## 2. 변경 후 Navigation 구조

| 영역 | 변경 내용 |
|---|---|
| AppShell | 외부 wrapper는 `div.app-shell`, 실제 본문은 `main.app-shell-content`로 정리 |
| SiteHeader | desktop 중앙 nav는 1차 IA 라벨 그대로 표시하고 `aria-current` 추가 |
| Top action | 비로그인 사용자는 `로그인`, 로그인 사용자는 `마이페이지`로 진입 |
| MobileBottomNav | 홈, 내풀이, 관계, 오늘, 대화 5개 nav 유지 |
| Mobile menu | 성향사주, 성향궁합, 오늘운세, 타로, 보관함, 가격, 코인, 알림, 설정 유지 |
| 중복 nav | 숨김 처리된 secondary shortcut nav DOM 제거 |
| 성능 | 상단 header blur를 낮추고, coarse pointer/reduced motion에서는 blur를 제거 |

## 3. Desktop Nav 구조

| 메뉴 | href | active match |
|---|---|---|
| 홈 | `/` | `/` |
| 내 풀이 | `/saju/new` | `/saju`, `/daewoon`, `/myeongri` |
| 관계 | `/compatibility` | `/compatibility` |
| 오늘 | `/free` | `/free`, `/today-fortune`, `/tarot`, `/zodiac`, `/star-sign`, `/interpretation` |
| 대화 | `/dialogue` | `/dialogue` |

Desktop 우측 영역은 코인, 알림, 로그인 또는 마이페이지를 유지합니다.

## 4. Mobile Nav 구조

| 영역 | 구성 |
|---|---|
| Mobile top | 달빛인생 logo, 현재 흐름 context, 코인, 로그인/마이페이지, 메뉴 |
| Mobile bottom nav | 홈, 내풀이, 관계, 오늘, 대화 |
| Mobile menu | 핵심 shortcut과 계정/알림/설정 utility |
| 하단 safe area | `env(safe-area-inset-bottom)`와 `--gyeol-space-3` 기준 |

모바일 bottom nav는 5개 이하 원칙을 유지하고, 12간지 대화방 구조를 변경하지 않았습니다.

## 5. 유지한 Route

| 기능 | route |
|---|---|
| 홈 | `/` |
| 기본 사주 | `/saju/new` |
| 달빛 성향사주 | `/saju/personality` |
| 기본 궁합 | `/compatibility` |
| 달빛 성향궁합 | `/compatibility/personality` |
| 오늘운세 | `/today-fortune` |
| 타로 | `/tarot/daily` |
| 띠운세 | `/zodiac` |
| 별자리 | `/star-sign` |
| 대화방 | `/dialogue` |
| 보관함 | `/my` |
| 가격 | `/pricing` |
| 코인 | `/credits` |
| 알림 | `/notifications` |
| 약관 | `/terms` |
| 개인정보처리방침 | `/privacy` |

## 6. 확인 필요 Route

| 항목 | 내용 |
|---|---|
| 오늘 hub | 1차 nav의 `오늘`은 기존 `/free`를 유지합니다. 후속 IA 작업에서 `/today` 같은 신규 route를 만들지는 않았습니다. |
| 마이페이지 | 상단 로그인 상태 CTA는 `/my`로 이동합니다. 로그아웃은 기존 mobile menu 안에 유지했습니다. |

## 7. 모바일 Safe-Area 처리 방식

| 파일 | 처리 |
|---|---|
| `src/app/styles/tokens.css` | `--gyeol-bottom-nav-clearance`, `--app-mobile-dock-clearance` 유지 |
| `src/app/styles/app-shell.css` | `.app-mobile-dock`에 `max(var(--gyeol-space-3), env(safe-area-inset-bottom))` 적용 |
| `src/app/styles/app-shell.css` | `md` 이상에서는 mobile dock을 명시적으로 숨김 |

## 8. 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `src/shared/layout/app-shell.tsx` | AppShell semantic wrapper 정리 |
| `src/features/shared-navigation/site-header.tsx` | SiteHeaderChrome 명명 정리, desktop nav 라벨/aria-current, 로그인 상태 CTA, hidden shortcut nav 제거 |
| `src/app/styles/app-shell.css` | mobile dock safe-area, header blur 축소, low-power media 처리 |
| `docs/design-system/navigation-update-notes.md` | navigation 구조와 리스크 문서화 |

## 9. 남은 리스크

| 리스크 | 대응 |
|---|---|
| 360px 모바일에서 코인, 마이페이지, 메뉴가 함께 좁을 수 있음 | 후속 모바일 QA에서 overflow 여부 확인 필요 |
| 기존 페이지들이 여전히 `header={<SiteHeader />}`를 중복 명시함 | 기능 영향은 없지만 후속 cleanup에서 기본 header 사용으로 단순화 가능 |
| hidden shortcut CSS rule이 일부 남아 있음 | DOM은 제거했으며, 후속 style debt 정리 때 CSS 잔재를 제거 가능 |
| `/free`가 오늘 hub로 쓰이는 구조 | route 추가 금지 원칙에 따라 유지. IA 변경 필요 시 별도 작업 필요 |

## 10. Next Step

1. 모바일 360px, 390px, 430px에서 header action overflow를 확인합니다.
2. 홈, 내 풀이, 관계, 오늘, 대화 nav 진입을 브라우저로 확인합니다.
3. 다음 작업에서 page shell과 내부 result/step shell의 시각 구조를 같은 navigation 기준에 맞춥니다.
