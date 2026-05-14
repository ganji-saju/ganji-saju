# 간지사주 리디자인 보드 매니페스트 (2026-05-14)

> Source: `docs/design/ganji-redesign/source/02_BOARD_MANIFEST.md`
> 본 문서는 원본 매니페스트의 65개 보드를 실제 코드베이스 라우트·컴포넌트와 매핑하고 구현 상태(TODO/IN_PROGRESS/IMPLEMENTED/QA_PASS/SHELL/REFERENCE_ONLY)를 추적한다.
> PR1 ~ PR67 까지의 작업 결과를 반영해 status 를 갱신했다.

## 요약

| 카테고리 | 총 | IMPLEMENTED / QA_PASS | SHELL | REFERENCE_ONLY | TODO |
|---|--:|--:|--:|--:|--:|
| 디자인 시스템 (brand) | 2 | 2 | 0 | 0 | 0 |
| 컴포넌트 라이브러리 | 4 | 0 | 0 | 4 | 0 |
| 모션 보드 (motion) | 13 | 13 | 0 | 0 | 0 |
| 모바일 핵심 (mobile-core) | 10 | 10 | 0 | 0 | 0 |
| 모바일 관계 & 상담 | 13 | 12 | 1 | 0 | 0 |
| 모바일 깊은 풀이 & 결제 | 6 | 6 | 0 | 0 | 0 |
| 확장 (extras) | 10 | 9 | 1 | 0 | 0 |
| 다국어 & 디바이스 | 2 | 0 | 2 | 0 | 0 |
| 시스템 (banners/error) | 5 | 3 | 2 | 0 | 0 |
| 데스크탑 | 1 | 1 | 0 | 0 | 0 |
| **합계** | **66** | **56** | **6** | **4** | **0** |

> 컴포넌트 라이브러리 4개는 production 화면이 아닌 디자인 시스템 참조 보드로 `REFERENCE_ONLY` 처리.
> 모션 13종은 `/admin/design/motion` gallery 에 모두 구현됨 (이번 PR).
> 시스템 보드 5종(banners/errors/onboarding/push/terms) 은 실제 화면 곳곳에서 부분 적용 + design-stubs gallery 로 보존.

## 섹션별 보드

### brand · 디자인 시스템 (2)

| ID | Label | Source | 상태 | 위치 |
|---|---|---|---|---|
| `tokens` | 컬러 & 타입 토큰 | `tokens.css` | IMPLEMENTED | `src/app/styles/tokens.css` — pink/ink/jade/sky/plum/coral/amber/indigo + radius + --font-han 모두 적용 |
| `characters` | 십이간지 캐릭터 시스템 | `ui.jsx` | IMPLEMENTED | `src/components/gangi/zodiac-chip.tsx` — 12 한자 + sm/md/lg/xl |

### components · 컴포넌트 라이브러리 (4)

| ID | Label | Source | 상태 | 위치 |
|---|---|---|---|---|
| `comp-form` | 폼·인풋·버튼 | `screens-i.jsx:33` | REFERENCE_ONLY | 각 페이지 내 `Input`/`Label`/`Button` 컴포넌트로 분산 적용 |
| `comp-feedback` | 피드백·모달·스켈레톤 | `screens-i.jsx:442` | REFERENCE_ONLY | `GangiLoadingOverlay`, toast (필요 시), skeleton 등 분산 |
| `comp-data` | 캘린더·차트·테이블 | `screens-j.jsx:9` | REFERENCE_ONLY | `FortuneCalendarPanel`, `YearlyReportPanel` 등 패널 내 분산 |
| `comp-interactive` | 업로드·자동완성 | `screens-j.jsx:478` | REFERENCE_ONLY | birth-info-stepper 위치 자동완성, 파일 업로드 미사용 |

### motion · 마이크로 인터랙션 (13)

> 모두 `/admin/design/motion` gallery 에서 한 화면으로 재현 + 각 production trigger 에 연결.

| ID | Label | Source | 상태 | Production trigger | Gallery 위치 |
|---|---|---|---|---|---|
| `m-loading` | 51 · 사주 분석 로딩 | `screens-l.jsx:9` | IMPLEMENTED | `GangiLoadingOverlay` (사주 시작하기, today-detail unlock) | `/admin/design/motion#m-loading` |
| `m-reveal` | 52 · 결과 카드 등장 | `screens-l.jsx:154` | IMPLEMENTED | 사주 결과/오늘운세 결과 페이지 진입 | `/admin/design/motion#m-reveal` |
| `m-tarot` | 53 · 타로 카드 플립 | `screens-l.jsx:295` | IMPLEMENTED | 타로 카드 선택 → 결과 페이지 | `/admin/design/motion#m-tarot` |
| `m-coin` | 54 · 코인 충전 성공 | `screens-l.jsx:447` | IMPLEMENTED | `/credits/success` | `/admin/design/motion#m-coin` |
| `m-page` | 55 · 페이지 전환 | `screens-m.jsx:6` | IMPLEMENTED | router push 시 prefetch overlay | `/admin/design/motion#m-page` |
| `m-modal` | 56 · 모달 등장 | `screens-m.jsx:121` | IMPLEMENTED | `<details>` 패널 등장, drawer 오픈 | `/admin/design/motion#m-modal` |
| `m-toast` | 57 · 토스트 시퀀스 | `screens-m.jsx:225` | IMPLEMENTED | 결제/저장 알림 토스트 (gallery 데모) | `/admin/design/motion#m-toast` |
| `m-push` | 58 · 푸시 알림 도착 | `screens-m.jsx:310` | IMPLEMENTED | push 권한 + 수신 데모 | `/admin/design/motion#m-push` |
| `m-hanja` | 59 · 한자 변환 | `screens-m.jsx:435` | IMPLEMENTED | 한자 morph (zodiac chip / 사주팔자) | `/admin/design/motion#m-hanja` |
| `m-spinners` | 60 · 로딩 스피너 6종 | `screens-n.jsx:6` | IMPLEMENTED | inline loading 곳곳 | `/admin/design/motion#m-spinners` |
| `m-input` | 61 · 인풋 포커스/검증 | `screens-n.jsx:151` | IMPLEMENTED | birth info input, login | `/admin/design/motion#m-input` |
| `m-chart` | 62 · 차트 그리기 | `screens-n.jsx:329` | IMPLEMENTED | 오행 균형 카드, fortune calendar tone bar | `/admin/design/motion#m-chart` |
| `m-palshja` | 63 · 사주팔자 셔플 | `screens-n.jsx:485` | IMPLEMENTED | 사주 분석 loading 안 8글자 슬롯 | `/admin/design/motion#m-palshja` |

### mobile-core · 핵심 화면 (10)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `home` | 01 · 홈 | `screens-a.jsx:6` | IMPLEMENTED | `src/app/page.tsx` | 펌프 hero + 5 dock + 12간지 chip |
| `step1` | 02-1 · 사주입력 STEP 1 | `screens-e.jsx:6` | IMPLEMENTED | `src/app/saju/new/page.tsx` + birth/empathy/nickname stepper | PR5 |
| `intake` | 02-2 · 사주입력 STEP 2 | `screens-a.jsx:126` | IMPLEMENTED | `src/features/saju-intake/saju-intake-page.tsx` | PR5/PR25 CompactBirthFields |
| `step3` | 02-3 · 사주입력 STEP 3 | `screens-e.jsx:93` | IMPLEMENTED | birth → empathy → nickname 흐름 | PR5b |
| `result` | 03 · 사주 결과 | `screens-a.jsx:211` | IMPLEMENTED | `src/app/saju/[slug]/page.tsx` | 5 핵심 섹션 |
| `today` | 04 · 오늘운세 | `screens-a.jsx:334` | IMPLEMENTED | `src/app/today-fortune/page.tsx` + concern picker PR53 | |
| `tarot` | 05 · 타로 (한 장) | `screens-a.jsx:422` | IMPLEMENTED | `src/app/tarot/page.tsx`, `/tarot/daily` | |
| `tarot-spread` | 05-2 · 타로 풀스프레드 (3장) | `screens-k.jsx:151` | IMPLEMENTED | `/tarot/daily/pick`, `/tarot/daily/result` | |
| `today-detail` | 04-2 · 오늘 자세히 (550원) | `screens-k.jsx:265` | IMPLEMENTED | `/today-fortune/detail`, `/saju/[slug]/today-detail` | PR55/56 |
| `taekil` | 05-3 · 택일 (좋은 날) | `screens-k.jsx:681` | IMPLEMENTED | `src/app/taekil/page.tsx` | |

### mobile-engage · 관계 & 상담 (13)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `gunghap-input` | 06-0 · 궁합 입력 (두 사람) | `screens-k.jsx:6` | IMPLEMENTED | `src/app/compatibility/input/page.tsx` | PR57 |
| `gunghap` | 06 · 궁합 결과 | `screens-b.jsx:6` | IMPLEMENTED | `src/app/compatibility/result/page.tsx` | PR58/59 |
| `dlg-list` | 07-0 · 대화방 목록 | `screens-e.jsx:328` | IMPLEMENTED | `src/app/dialogue/page.tsx` | PR? (dialogue redesign) |
| `dialogue` | 07 · 대화방 | `screens-b.jsx:105` | IMPLEMENTED | `src/app/dialogue/[expert]/page.tsx` | |
| `my` | 08 · MY | `screens-b.jsx:219` | IMPLEMENTED | `src/app/my/page.tsx` | |
| `profile-edit` | 08-2 · 프로필 편집 | `screens-k.jsx:390` | IMPLEMENTED | `src/app/my/profile/page.tsx` | PR46 |
| `settings` | 08-3 · 설정 | `screens-k.jsx:532` | IMPLEMENTED | `src/app/my/settings/page.tsx` | |
| `help-center` | 08-4 · 고객센터 (FAQ + 1:1) | `screens-k.jsx:840` | SHELL | `docs/design/ganji-redesign/future-pages/help-center.md` | `/help` 라우트 신규 SHELL — 이번 PR |
| `membership` | 09 · 멤버십 | `screens-b.jsx:315` | IMPLEMENTED | `src/app/membership/page.tsx` | |
| `auth` | 10 · 로그인 (SNS 4종) | `screens-b.jsx:403` | IMPLEMENTED | `src/app/login/page.tsx` (Apple 제외, 3종) | PR49 |
| `signup` | 11 · 이메일 회원가입 | `screens-e.jsx:193` | IMPLEMENTED | `/login` 안 mode='signup' | |
| `pw-reset` | 11-2 · 비밀번호 찾기 | `screens-g.jsx:528` | IMPLEMENTED | `src/app/reset-password/page.tsx` | |
| `account-delete` | 11-3 · 회원탈퇴 (3단계) | `screens-g.jsx:311` | IMPLEMENTED | `src/app/my/settings/delete-account/page.tsx` + `/api/account/delete` | PR42 |

### mobile-premium · 깊은 풀이 & 결제 (6)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `saju-deep` | 15 · 깊은 사주 풀이 | `screens-c.jsx:6` | IMPLEMENTED | `src/app/saju/[slug]/deep/page.tsx`, `/saju/[slug]/premium` (LifetimeReportPanel) | PR61 전면 재구성 |
| `saju-share` | 16-0 · 공유용 결과 카드 | `screens-f.jsx:189` | IMPLEMENTED | `src/app/saju/[slug]/share/page.tsx` | PR21 |
| `checkout` | 16 · 결제 페이지 | `screens-c.jsx:299` | IMPLEMENTED | `src/app/membership/checkout/page.tsx` | |
| `pay-result` | 16-1 · 결제 결과 (3상태) | `screens-f.jsx:6` | IMPLEMENTED | `src/app/membership/success/page.tsx` | |
| `coin-pkg` | 16-2 · 코인 충전 패키지 | `screens-f.jsx:794` | IMPLEMENTED | `src/app/credits/page.tsx` | |
| `appointment` | 16-3 · 1:1 상담 예약 | `screens-f.jsx:600` | IMPLEMENTED | `src/app/dialogue/appointment/page.tsx` + `/api/appointments` | PR44 |

### extras · 인쇄·알림·보관함·콘텐츠·검색 (10)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `pdf-print` | 17 · PDF 1페이지 (커버) | `screens-d.jsx:6` | IMPLEMENTED | `src/app/saju/[slug]/premium/print/page.tsx` | PR61 |
| `pdf-page2` | 17-2 · PDF 2페이지 (십성) | `screens-f.jsx:315` | IMPLEMENTED | 동일 print 라우트 (십성 십신 chart) | |
| `lock-screen` | 18-0 · 락스크린 푸시 위젯 | `screens-f.jsx:440` | SHELL | `/admin/design/motion#m-push` 데모로 대체. 실제 OS 락스크린은 PWA 영역 | |
| `notifications` | 18 · 알림 센터 | `screens-d.jsx:253` | IMPLEMENTED | `src/app/notifications/page.tsx` + feed API | PR23/43 |
| `vault` | 19 · 보관함 상세 | `screens-d.jsx:451` | IMPLEMENTED | `src/app/my/results/page.tsx`, `src/app/vault/page.tsx` | |
| `zodiac-detail` | 20 · 띠운세 상세 (양) | `screens-e.jsx:467` | IMPLEMENTED | `src/app/zodiac/[slug]/page.tsx` | |
| `star-sign` | 20-2 · 별자리 (천칭) | `screens-g.jsx:161` | IMPLEMENTED | `src/app/star-sign/[slug]/page.tsx` | PR26 |
| `search` | 21 · 검색 (3가지 상태) | `screens-e.jsx:602` | IMPLEMENTED | `src/app/search/page.tsx` + `/api/search` | PR28/45 |
| `dream` | 21-2 · 꿈해몽 검색 | `screens-g.jsx:6` | IMPLEMENTED | `src/app/dream/page.tsx` + `/api/dream/search` | PR27/45 |

### i18n-device · 다국어 & 디바이스 (2)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `i18n-en` | 22 · 영문 (English) | `screens-g.jsx:668` | SHELL | `docs/design/ganji-redesign/future-pages/i18n-en.md` | 다국어 미구현. next-intl 도입 후속 |
| `tablet` | 23 · 태블릿 (1024px) | `screens-g.jsx:768` | SHELL | 모든 페이지 sm/md/lg responsive 기본 적용. 별도 tablet-only layout 미구현 | |

### system · 배너·에러·온보딩·모달 (5)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `banners` | 24 · 배너 시스템 (7 종) | `screens-h.jsx:6` | IMPLEMENTED | `src/components/gangi/gangi-banner.tsx` (7 variants) + showcase `/admin/design/banners` | hero/soft/cosmic/inline/sticky/success/warning |
| `errors` | 25 · 에러 (404/500/네트워크) | `screens-h.jsx:244` | IMPLEMENTED | `src/app/not-found.tsx` (404), `src/app/error.tsx` (client 5xx), `src/app/global-error.tsx` (root) | PR #68/이번 PR |
| `onboarding` | 26 · 온보딩 (4 슬라이드) | `screens-h.jsx:386` | SHELL | login → empathy → birth 흐름이 사실상 onboarding. 별도 onboarding 화면 미구현 | |
| `push-modal` | 27 · 푸시 알림 권한 모달 | `screens-h.jsx:594` | IMPLEMENTED | `src/components/notifications/push-permission-modal.tsx` + showcase `/admin/design/push-modal` | 이번 PR · 가치 제안 3종 + requestPermission → subscribe 풀 흐름 |
| `terms-modal` | 28 · 약관 동의 풀스크린 모달 | `screens-h.jsx:723` | SHELL | 회원가입 흐름 내 implicit consent. 별도 modal 미구현 | |

### desktop · 반응형 (1)

| ID | Label | Source | 상태 | 위치 | 비고 |
|---|---|---|---|---|---|
| `desktop-home` | 29 · 데스크탑 홈 | `desktop.jsx:3` | IMPLEMENTED | `src/components/site-header.tsx` + `site-footer.tsx` 데스크탑 nav/footer | PR47/50 |

## 진행률 요약

- **IMPLEMENTED / QA_PASS**: 53 / 66 (80.3%)
- **SHELL** (shell route + future doc): 9 / 66 (13.6%)
- **REFERENCE_ONLY** (참조용 design system 보드): 4 / 66 (6.1%)
- **TODO**: 0 / 66

## 추가 메모

- 디자인 토큰 / 컴포넌트 라이브러리: 이미 `src/app/styles/tokens.css` + `src/components/gangi/*` 에 적용 완료.
- 모션 13종: 이번 PR 에서 `/admin/design/motion` gallery 신설 + 13개 모션 primitive 구현.
- SHELL 처리된 9개 보드는 `docs/design/ganji-redesign/future-pages/*.md` 에 contract 문서화.
