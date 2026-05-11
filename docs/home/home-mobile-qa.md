# Home Mobile UI/UX QA

## Executive Summary

- 홈 리디자인의 모바일 첫 화면에서 Hero title과 CTA가 보이고, 달빛 성향사주/달빛 성향궁합 핵심 기능 섹션이 Today Snapshot보다 먼저 노출되도록 조정했다.
- 기능 로직, 결제, DB, 사주/성향 도메인 로직은 수정하지 않았고 홈 UI spacing/order/header 노출만 조정했다.
- 인앱 브라우저는 localhost 접근이 거부되어 Chrome DevTools mobile emulation으로 360/375/390/430/tablet/desktop을 검수했다.

## Applied Mobile Fixes

| 항목 | 조치 |
|---|---|
| Hero title | 360px에서 잘리지 않도록 두 줄 고정 래핑과 모바일 폰트 크기 조정 |
| Hero CTA | 모바일 CTA 높이 48px 유지, Hero 내부 버튼 간격 압축 |
| 신규 기능 위치 | 모바일에서 `PrimaryFeatureCards`를 `TodaySnapshot`보다 먼저 배치 |
| 신규 기능 카드 | 모바일 카드 최소 높이와 섹션 여백을 줄여 첫 스크롤 전에 카드 시작점 노출 |
| Today Snapshot | 모바일에서 가로 스냅 카드로 전환하고 설명 문구를 숨겨 피로도 감소 |
| Header 충돌 | 홈 모바일에서 상단 로그인 버튼은 숨기고 메뉴 버튼을 유지해 360~430px 우측 잘림 방지 |
| Overflow | 홈 섹션과 카드에 `min-width: 0`, 모바일 문구 wrap/line clamp 적용 |

## Breakpoint Results

| Breakpoint | 결과 | 확인 내용 |
|---|---|---|
| 360px | 통과 | Hero title/CTA 노출, 신규 기능 섹션과 첫 카드 시작점 노출, `scrollWidth=360` |
| 375px | 통과 | CTA 48px, NEW badge 노출, 하단 dock과 주요 CTA 충돌 없음 |
| 390px | 통과 | 우측 header 잘림 해소, 신규 기능 카드가 초반부에 표시됨, `scrollWidth=390` |
| 430px | 통과 | 달빛 성향사주 카드와 CTA가 첫 화면 하단부에 명확히 진입 |
| Tablet 768px | 통과 | 기존 PRD 순서대로 Today Snapshot 후 Primary Feature 유지, 3열 카드 정상 |
| Desktop 1280px | 통과 | Hero, Today Snapshot, 카드 grid가 중앙 폭 안에서 정상 표시 |

## Evidence

- Chrome DevTools mobile emulation screenshots:
- `/private/tmp/ganji-home-qa/home-360-cdp.png`
- `/private/tmp/ganji-home-qa/home-375-cdp.png`
- `/private/tmp/ganji-home-qa/home-390-cdp.png`
- `/private/tmp/ganji-home-qa/home-430-cdp.png`
- `/private/tmp/ganji-home-qa/home-tablet-cdp.png`
- `/private/tmp/ganji-home-qa/home-desktop-cdp.png`

## Validation Commands

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm run build` | 통과 |
| `git diff --check` | 통과 |

## Remaining Issues

- 인앱 브라우저 localhost 검수는 `ERR_CONNECTION_REFUSED`로 직접 캡처하지 못해 Chrome DevTools emulation으로 대체했다.
- 실제 iOS Safari/Android Chrome 기기에서 safe-area, 주소창 접힘, 하단 dock 체감은 배포 전 사람이 한 번 더 확인하는 것이 안전하다.

## Next Step

- 홈 화면 최종 통합 전 `/` 모바일 실기기 smoke test를 수행한다.
- 신규 기능 CTA가 `/saju/personality`, `/compatibility/personality`로 정확히 이동하는지 배포 Preview에서 클릭 검수한다.
