# 간지사주 리디자인 보드 매니페스트
이 문서는 `간지사주 리디자인.html`에서 추출한 보드 목록입니다. Claude Code 작업 전후로 누락 여부를 검수하는 기준표로 사용합니다.
- 추출 기준 전체 보드: 65개
- 모션 보드: 13개
- 정적/시스템/컴포넌트/페이지 보드: 52개
- 사용자가 지정한 “34개 정적 보드 + 13개 모션 보드”는 구현 대상 보드로 간주하되, 실제 handoff HTML에 존재하는 시스템/컴포넌트 보드까지 별도 검수한다.
## 섹션별 보드
### 간지사주 · 디자인 시스템 (`brand`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `tokens` | 컬러 & 타입 토큰 | `SystemBoard` | `` | 760×520 | TODO | TODO |  |
| `characters` | 십이간지 캐릭터 시스템 | `CharacterBoard` | `` | 420×520 | TODO | TODO |  |

### 컴포넌트 라이브러리 (`components`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `comp-form` | 컴포넌트 · 폼·인풋·버튼 | `ScreenComponentsForm` | `screens-i.jsx:33` | 740×1280 | TODO | TODO |  |
| `comp-feedback` | 컴포넌트 · 피드백·모달·스켈레톤 | `ScreenComponentsFeedback` | `screens-i.jsx:442` | 740×1500 | TODO | TODO |  |
| `comp-data` | 컴포넌트 · 캘린더·차트·테이블 | `ScreenComponentsData` | `screens-j.jsx:9` | 740×1700 | TODO | TODO |  |
| `comp-interactive` | 컴포넌트 · 업로드·자동완성 | `ScreenComponentsInteractive` | `screens-j.jsx:478` | 740×1500 | TODO | TODO |  |

### 마이크로 인터랙션 · 모션 (`motion`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `m-loading` | 51 · 사주 분석 로딩 (6s) | `MotionSajuLoading` | `screens-l.jsx:9` | 390×680 | TODO | TODO |  |
| `m-reveal` | 52 · 결과 카드 등장 (6s) | `MotionResultReveal` | `screens-l.jsx:154` | 390×740 | TODO | TODO |  |
| `m-tarot` | 53 · 타로 카드 플립 (6s) | `MotionTarotFlip` | `screens-l.jsx:295` | 390×740 | TODO | TODO |  |
| `m-coin` | 54 · 코인 충전 성공 (5s) | `MotionCoinSuccess` | `screens-l.jsx:447` | 390×680 | TODO | TODO |  |
| `m-page` | 55 · 페이지 전환 (5s) | `MotionPageTransition` | `screens-m.jsx:6` | 390×780 | TODO | TODO |  |
| `m-modal` | 56 · 모달 등장 (5s) | `MotionModalAppear` | `screens-m.jsx:121` | 390×780 | TODO | TODO |  |
| `m-toast` | 57 · 토스트 시퀀스 (6s) | `MotionToastStack` | `screens-m.jsx:225` | 390×780 | TODO | TODO |  |
| `m-push` | 58 · 푸시 알림 도착 (5s) | `MotionPushArrive` | `screens-m.jsx:310` | 390×780 | TODO | TODO |  |
| `m-hanja` | 59 · 한자 변환 (6s) | `MotionHanjaMorph` | `screens-m.jsx:435` | 390×720 | TODO | TODO |  |
| `m-spinners` | 60 · 로딩 스피너 6종 (3s) | `MotionSpinners` | `screens-n.jsx:6` | 520×520 | TODO | TODO |  |
| `m-input` | 61 · 인풋 포커스/검증 (5s) | `MotionInputFocus` | `screens-n.jsx:151` | 390×780 | TODO | TODO |  |
| `m-chart` | 62 · 차트 그리기 (6s) | `MotionChartDraw` | `screens-n.jsx:329` | 390×780 | TODO | TODO |  |
| `m-palshja` | 63 · 사주팔자 셔플 (6s) | `MotionPalshjaShuffle` | `screens-n.jsx:485` | 390×720 | TODO | TODO |  |

### 모바일 · 핵심 화면 (`mobile-core`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `home` | 01 · 홈 | `ScreenHome` | `screens-a.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `step1` | 02-1 · 사주입력 STEP 1 | `ScreenSajuStep1` | `screens-e.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `intake` | 02-2 · 사주입력 STEP 2 | `ScreenSajuIntake` | `screens-a.jsx:126` | PHONE_W×PHONE_H | TODO | TODO |  |
| `step3` | 02-3 · 사주입력 STEP 3 | `ScreenSajuStep3` | `screens-e.jsx:93` | PHONE_W×PHONE_H | TODO | TODO |  |
| `result` | 03 · 사주 결과 | `ScreenSajuResult` | `screens-a.jsx:211` | PHONE_W×PHONE_H | TODO | TODO |  |
| `today` | 04 · 오늘운세 | `ScreenToday` | `screens-a.jsx:334` | PHONE_W×PHONE_H | TODO | TODO |  |
| `tarot` | 05 · 타로 (한 장) | `ScreenTarot` | `screens-a.jsx:422` | PHONE_W×PHONE_H | TODO | TODO |  |
| `tarot-spread` | 05-2 · 타로 풀스프레드 (3장) | `ScreenTarotSpread` | `screens-k.jsx:151` | PHONE_W×PHONE_H | TODO | TODO |  |
| `today-detail` | 04-2 · 오늘 자세히 (550원) | `ScreenTodayDetail` | `screens-k.jsx:265` | PHONE_W×PHONE_H | TODO | TODO |  |
| `taekil` | 05-3 · 택일 (좋은 날) | `ScreenTaekil` | `screens-k.jsx:681` | PHONE_W×PHONE_H | TODO | TODO |  |

### 모바일 · 관계 & 상담 (`mobile-engage`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `gunghap-input` | 06-0 · 궁합 입력 (두 사람) | `ScreenGunghapInput` | `screens-k.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `gunghap` | 06 · 궁합 결과 | `ScreenGunghap` | `screens-b.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `dlg-list` | 07-0 · 대화방 목록 | `ScreenDialogueList` | `screens-e.jsx:328` | PHONE_W×PHONE_H | TODO | TODO |  |
| `dialogue` | 07 · 대화방 | `ScreenDialogue` | `screens-b.jsx:105` | PHONE_W×PHONE_H | TODO | TODO |  |
| `my` | 08 · MY | `ScreenMy` | `screens-b.jsx:219` | PHONE_W×PHONE_H | TODO | TODO |  |
| `profile-edit` | 08-2 · 프로필 편집 | `ScreenProfileEdit` | `screens-k.jsx:390` | PHONE_W×PHONE_H | TODO | TODO |  |
| `settings` | 08-3 · 설정 | `ScreenSettings` | `screens-k.jsx:532` | PHONE_W×PHONE_H | TODO | TODO |  |
| `help-center` | 08-4 · 고객센터 (FAQ + 1:1) | `ScreenHelpCenter` | `screens-k.jsx:840` | PHONE_W×PHONE_H | TODO | TODO |  |
| `membership` | 09 · 멤버십 | `ScreenMembership` | `screens-b.jsx:315` | PHONE_W×PHONE_H | TODO | TODO |  |
| `auth` | 10 · 로그인 (SNS 4종) | `ScreenAuth` | `screens-b.jsx:403` | PHONE_W×PHONE_H | TODO | TODO |  |
| `signup` | 11 · 이메일 회원가입 | `ScreenSignup` | `screens-e.jsx:193` | PHONE_W×PHONE_H | TODO | TODO |  |
| `pw-reset` | 11-2 · 비밀번호 찾기 | `ScreenPasswordReset` | `screens-g.jsx:528` | PHONE_W×PHONE_H | TODO | TODO |  |
| `account-delete` | 11-3 · 회원탈퇴 (3단계) | `ScreenAccountDelete` | `screens-g.jsx:311` | PHONE_W×PHONE_H | TODO | TODO |  |

### 모바일 · 깊은 풀이 & 결제 (`mobile-premium`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `saju-deep` | 15 · 깊은 사주 풀이 | `ScreenSajuDeep` | `screens-c.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `saju-share` | 16-0 · 공유용 결과 카드 | `ScreenSajuShare` | `screens-f.jsx:189` | PHONE_W×PHONE_H | TODO | TODO |  |
| `checkout` | 16 · 결제 페이지 | `ScreenCheckout` | `screens-c.jsx:299` | PHONE_W×PHONE_H | TODO | TODO |  |
| `pay-result` | 16-1 · 결제 결과 (3상태) | `ScreenPaymentResult` | `screens-f.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `coin-pkg` | 16-2 · 코인 충전 패키지 | `ScreenCoinPackages` | `screens-f.jsx:794` | PHONE_W×PHONE_H | TODO | TODO |  |
| `appointment` | 16-3 · 1:1 상담 예약 | `ScreenAppointment` | `screens-f.jsx:600` | PHONE_W×PHONE_H | TODO | TODO |  |

### 확장 화면 · 인쇄·알림·보관함·콘텐츠·검색 (`extras`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `pdf-print` | 17 · PDF 1페이지 (커버) | `ScreenPdfPrint` | `screens-d.jsx:6` | 595×920 | TODO | TODO |  |
| `pdf-page2` | 17-2 · PDF 2페이지 (십성) | `ScreenPdfPage2` | `screens-f.jsx:315` | 595×920 | TODO | TODO |  |
| `lock-screen` | 18-0 · 락스크린 푸시 위젯 | `ScreenLockScreen` | `screens-f.jsx:440` | PHONE_W×PHONE_H | TODO | TODO |  |
| `notifications` | 18 · 알림 센터 | `ScreenNotifications` | `screens-d.jsx:253` | PHONE_W×PHONE_H | TODO | TODO |  |
| `vault` | 19 · 보관함 상세 | `ScreenVaultDetail` | `screens-d.jsx:451` | PHONE_W×PHONE_H | TODO | TODO |  |
| `zodiac-detail` | 20 · 띠운세 상세 (양) | `ScreenZodiacDetail` | `screens-e.jsx:467` | PHONE_W×PHONE_H | TODO | TODO |  |
| `star-sign` | 20-2 · 별자리 (천칭) | `ScreenStarSign` | `screens-g.jsx:161` | PHONE_W×PHONE_H | TODO | TODO |  |
| `search` | 21 · 검색 (3가지 상태) | `ScreenSearch` | `screens-e.jsx:602` | PHONE_W×PHONE_H | TODO | TODO |  |
| `dream` | 21-2 · 꿈해몽 검색 | `ScreenDream` | `screens-g.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |

### 다국어 & 디바이스 (`i18n-device`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `i18n-en` | 22 · 영문 (English) | `ScreenI18n` | `screens-g.jsx:668` | PHONE_W×PHONE_H | TODO | TODO |  |
| `tablet` | 23 · 태블릿 (1024px) | `ScreenTablet` | `screens-g.jsx:768` | 1024×768 | TODO | TODO |  |

### 시스템 화면 · 배너·에러·온보딩·모달 (`system`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `banners` | 24 · 배너 시스템 (7 종) | `ScreenBanners` | `screens-h.jsx:6` | PHONE_W×PHONE_H | TODO | TODO |  |
| `errors` | 25 · 에러 (404/500/네트워크) | `ScreenErrorPages` | `screens-h.jsx:244` | PHONE_W×PHONE_H | TODO | TODO |  |
| `onboarding` | 26 · 온보딩 (4 슬라이드) | `ScreenOnboarding` | `screens-h.jsx:386` | PHONE_W×PHONE_H | TODO | TODO |  |
| `push-modal` | 27 · 푸시 알림 권한 모달 | `ScreenPushPermission` | `screens-h.jsx:594` | PHONE_W×PHONE_H | TODO | TODO |  |
| `terms-modal` | 28 · 약관 동의 풀스크린 모달 | `ScreenTermsModal` | `screens-h.jsx:723` | PHONE_W×PHONE_H | TODO | TODO |  |

### 데스크탑 · 반응형 (`desktop`)
| ID | Label | Component | Source | Size | 구현상태 | Route/사용처 | 비고 |
|---|---|---|---|---|---|---|---|
| `desktop-home` | 29 · 데스크탑 홈 (헤더 + 풀 푸터) | `DesktopHome` | `desktop.jsx:3` | 1440×2480 | TODO | TODO |  |

