# Navigation Update Notes

## Summary

전체 사이트의 공통 shell은 기존 `AppShell`과 `SiteHeader`, `SiteFooter` 구조를 유지하고, navigation source만 새 IA에 맞춰 정리했다.

이번 변경은 라우트를 새로 만들지 않고 기존 경로를 재배치하는 작업이다. 결제, DB, Supabase migration, 사주 계산, 성향 계산, 리포트 생성 로직은 수정하지 않았다.

## Shared Shell

| 영역 | 파일 | 처리 |
|---|---|---|
| AppShell | `src/shared/layout/app-shell.tsx` | 기존 구조 유지 |
| Header | `src/features/shared-navigation/site-header.tsx` | desktop top nav, mobile top actions, mobile bottom nav 정리 |
| Footer | `src/components/site-footer.tsx` | 정책/사업자/면책 문구 유지 |
| Navigation source | `src/content/moonlight.ts`, `src/shared/config/site-navigation.ts` | primary/secondary nav data 정리 |

## Desktop Navigation

상단 header에서 동일한 primary navigation을 사용한다.

| 메뉴 | href | active match |
|---|---|---|
| 홈 | `/` | `/` |
| 내 풀이 | `/saju/new` | `/saju`, `/daewoon`, `/myeongri` |
| 관계 | `/compatibility` | `/compatibility` |
| 오늘 | `/free` | `/free`, `/today-fortune`, `/tarot`, `/zodiac`, `/star-sign`, `/interpretation` |
| 대화 | `/dialogue` | `/dialogue` |

우측 영역은 기존 코인, 알림, 로그인/로그아웃, 모바일 메뉴 trigger 흐름을 유지한다.

## Mobile Navigation

모바일은 상단 logo + 코인/로그인 구조와 하단 sticky nav를 사용한다.

| 영역 | 구성 |
|---|---|
| Mobile top | 달빛인생 logo, context note, 코인, 로그인/로그아웃, 메뉴 |
| Mobile bottom nav | 홈, 내풀이, 관계, 오늘, 대화 |
| Safe area | 기존 `env(safe-area-inset-bottom)` 기반 dock padding 유지 |
| Mobile menu | 성향사주, 성향궁합, 오늘운세, 타로, 보관함, 가격, 코인, 알림, 설정 |

모바일 상단의 알림 버튼은 공간 충돌을 줄이기 위해 desktop에서만 직접 노출하고, mobile에서는 menu 안에서 접근하도록 유지했다.

## Preserved Routes

| 기능 | route |
|---|---|
| 달빛 성향사주 | `/saju/personality` |
| 달빛 성향궁합 | `/compatibility/personality` |
| 기본 사주 | `/saju/new` |
| 기본 궁합 | `/compatibility` |
| 오늘운세 | `/today-fortune` |
| 타로 | `/tarot/daily` |
| 띠운세 | `/zodiac` |
| 별자리 | `/star-sign` |
| 대화방 | `/dialogue` |
| 보관함 | `/my` |
| 가격 | `/pricing` |
| 코인 | `/credits` |
| 알림 | `/notifications` |

## Files Changed

| 파일 | 변경 내용 |
|---|---|
| `src/content/moonlight.ts` | primary nav를 홈/내 풀이/관계/오늘/대화로 변경, secondary shortcut을 신규 핵심 기능과 보관함/가격 중심으로 정리 |
| `src/features/shared-navigation/site-header.tsx` | desktop nav group과 mobile bottom nav를 같은 primary data로 렌더링, 모바일 메뉴 카피와 바로가기 정리 |
| `src/app/styles/home.css` | 홈 모바일에서 로그인 버튼을 숨기던 예외 제거 |
| `src/app/styles/mobile-polish.css` | 모바일 상단 코인 chip 크기 보정 |

## Validation Plan

필수 검수:

| 명령 | 목적 |
|---|---|
| `npm run lint` | import/정적 규칙 검수 |
| `npm run typecheck` | TypeScript 타입 검수 |
| `npm run build` | production build 검수 |
| `git diff --check` | 공백/patch 품질 검수 |

수동 확인:

| 항목 | 기대 결과 |
|---|---|
| Desktop header | 홈/내 풀이/관계/오늘/대화 표시 |
| Mobile top | logo와 코인/로그인 표시 |
| Mobile bottom nav | 5개 이하 nav, safe-area 하단 여백 유지 |
| 성향사주 진입 | `/saju/personality` 정상 이동 |
| 성향궁합 진입 | `/compatibility/personality` 정상 이동 |
| 기존 route | 사주/궁합/오늘운세/타로/대화/보관함/가격 링크 유지 |

## Risks

| 리스크 | 대응 |
|---|---|
| 모바일 상단에 코인/로그인/메뉴가 함께 표시되어 작은 화면에서 좁을 수 있음 | 알림 직접 버튼은 mobile에서 숨기고 menu 안에 유지 |
| `/free`가 오늘 카테고리 hub 역할을 하므로 사용자 기대와 다를 수 있음 | `/today-fortune`, `/tarot`, `/zodiac`, `/star-sign` active match를 함께 지정 |
| 과거 문서에는 기존 tab 이름이 남아 있음 | 이번 산출물은 code navigation 기준 변경 내역을 따로 기록 |

## Next Step

1. 실제 모바일 360px, 375px, 390px에서 header action overflow를 확인한다.
2. 홈/내 풀이/관계/오늘/대화 각 primary flow 진입을 브라우저로 확인한다.
3. 다음 task에서 page shell, result shell, step shell까지 같은 IA와 visual rhythm으로 확장한다.
