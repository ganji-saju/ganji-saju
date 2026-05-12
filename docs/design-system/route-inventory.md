# Route Inventory

기준 브랜치: `main`

조사 명령:

```bash
find src/app -type f \( -name 'page.tsx' -o -name 'layout.tsx' -o -name 'template.tsx' \) | sort
```

총 조사 파일: 65개

## Root / Auth / Legal

| 파일 | 역할 | UI 위험 |
|---|---|---|
| `src/app/layout.tsx` | Root layout, font, analytics, speed insights | 전역 폰트/스크립트/배경 기준점 |
| `src/app/page.tsx` | 홈 route | 홈 허브 구조 기준점 |
| `src/app/auth/page.tsx` | 인증 보조 route | 확인 필요 |
| `src/app/login/layout.tsx` | 로그인 layout | AppShell 예외 가능 |
| `src/app/login/page.tsx` | 로그인/회원가입 | 긴 단일 client form, 임의 input style 다수 |
| `src/app/reset-password/layout.tsx` | 비밀번호 재설정 layout | AppShell 예외 가능 |
| `src/app/reset-password/page.tsx` | 비밀번호 재설정 | 로그인 화면과 중복 style |
| `src/app/privacy/page.tsx` | 개인정보처리방침 | 문서형 페이지 |
| `src/app/terms/page.tsx` | 이용약관 | 문서형 페이지 |
| `src/app/verification/page.tsx` | 검증/운영 확인 | 테이블/그리드가 많아 모바일 overflow 위험 |

## Home / Free Content

| 파일 | 역할 | UI 위험 |
|---|---|---|
| `src/app/free/page.tsx` | 무료운세 허브 | Gangi/Moonlight 혼합 |
| `src/app/today-fortune/page.tsx` | 오늘운세 입력 | 기존 Gangi shell과 신규 flow 혼합 |
| `src/app/today-fortune/result/page.tsx` | 오늘운세 무료 결과 | page wrapper와 client result wrapper 분리 |
| `src/app/today-fortune/detail/page.tsx` | 오늘운세 유료 상세 | 카드/CTA style 별도 |
| `src/app/tarot/page.tsx` | 타로 허브 | 확인 필요 |
| `src/app/tarot/daily/page.tsx` | 데일리 타로 진입 | 카드/섹션 style 혼합 |
| `src/app/tarot/daily/pick/page.tsx` | 타로 카드 선택 | 이미지/캐러셀, 모바일 성능 위험 |
| `src/app/tarot/daily/result/page.tsx` | 타로 결과 | 이미지 기반 result |
| `src/app/zodiac/page.tsx` | 띠운세 목록 | 4열 고정 grid 위험 |
| `src/app/zodiac/[slug]/page.tsx` | 띠운세 상세 | 확인 필요 |
| `src/app/star-sign/page.tsx` | 별자리 목록 | 확인 필요 |
| `src/app/star-sign/[slug]/page.tsx` | 별자리 상세 | 확인 필요 |
| `src/app/dream-interpretation/page.tsx` | 꿈해몽 목록 | ProductGrid/Card 기반 |
| `src/app/dream-interpretation/[slug]/page.tsx` | 꿈해몽 상세 | ProductGrid/Card 기반 |

## Saju / My Reading

| 파일 | 역할 | UI 위험 |
|---|---|---|
| `src/app/saju/page.tsx` | 사주 허브 | 확인 필요 |
| `src/app/saju/new/page.tsx` | 기본 사주 입력 | 큰 client step form |
| `src/app/saju/[slug]/page.tsx` | 기본 사주 결과 | ResultShell 일부 적용 전 old result card 잔존 |
| `src/app/saju/[slug]/overview/page.tsx` | 사주 개요 | 별도 mini result layout |
| `src/app/saju/[slug]/elements/page.tsx` | 오행 상세 | grid/차트 |
| `src/app/saju/[slug]/nature/page.tsx` | 성향 상세 | grid |
| `src/app/saju/[slug]/today-detail/page.tsx` | 오늘 상세 | 기존 result 흐름 |
| `src/app/saju/[slug]/premium/page.tsx` | 프리미엄 사주 | 긴 report, 많은 grid |
| `src/app/saju/[slug]/premium/print/page.tsx` | 프린트 | print CSS 영향 |
| `src/app/saju/personality/page.tsx` | 달빛 성향사주 입력 | StepFlow 적용, 내부 임의 style 잔존 |
| `src/app/saju/personality/result/page.tsx` | 달빛 성향사주 결과 | ResultShell 계열이나 별도 ShareCard/CTA style 잔존 |
| `src/app/daewoon/page.tsx` | 대운 | old Gangi panel |
| `src/app/myeongri/page.tsx` | 명리 | old app-panel/grid |
| `src/app/interpretation/page.tsx` | 풀이 허브 | ProductGrid/Card |
| `src/app/taekil/page.tsx` | 좋은 날 | 확인 필요 |
| `src/app/sample-report/page.tsx` | 샘플 리포트 | grid/card |

## Compatibility / Relationship

| 파일 | 역할 | UI 위험 |
|---|---|---|
| `src/app/compatibility/page.tsx` | 궁합 허브 | ProductGrid와 Moonlight 혼합 |
| `src/app/compatibility/input/page.tsx` | 기본 궁합 입력 | 기존 compatibility client form |
| `src/app/compatibility/result/page.tsx` | 기본 궁합 결과 | old result wrapper |
| `src/app/compatibility/personality/page.tsx` | 달빛 성향궁합 입력 | StepFlow 적용, 큰 client form |
| `src/app/compatibility/personality/result/page.tsx` | 달빛 성향궁합 결과 | ResultShell 계열이나 개인정보 summary 표시 기준 확인 필요 |

## Dialogue / Account / Payment

| 파일 | 역할 | UI 위험 |
|---|---|---|
| `src/app/dialogue/page.tsx` | 대화방 목록 | 12간지 데이터 위에 추천 4명 UI가 남아 있음 |
| `src/app/dialogue/[expert]/page.tsx` | 12간지 대화방 | 채팅 형식 유지 필요, 높이/overflow 민감 |
| `src/app/dialogue/safe-redirect/page.tsx` | 위기상황 안내 | 별도 panel style |
| `src/app/my/layout.tsx` | MY layout | 계정 shell 영향 |
| `src/app/my/page.tsx` | 보관함 | Moonlight list 일부 적용 |
| `src/app/my/profile/page.tsx` | 프로필 관리 | 큰 client form |
| `src/app/my/billing/page.tsx` | 결제 내역 | ProductGrid/Card |
| `src/app/my/settings/page.tsx` | 설정 | ProductGrid/Card |
| `src/app/vault/page.tsx` | 보관 route alias | 확인 필요 |
| `src/app/pricing/page.tsx` | 가격 | PricingRow 일부 적용, 기존 카드 흔적 확인 |
| `src/app/membership/page.tsx` | 멤버십 | pricing과 중복 flow |
| `src/app/membership/checkout/page.tsx` | 멤버십 결제 | 결제 로직 수정 금지 |
| `src/app/membership/complete/page.tsx` | 멤버십 완료 | 완료 panel |
| `src/app/membership/success/page.tsx` | 결제 성공 | client success, 중복 layout |
| `src/app/pay/page.tsx` | 결제 진입 | 결제 로직 수정 금지 |
| `src/app/credits/layout.tsx` | 코인 layout | 결제 flow |
| `src/app/credits/page.tsx` | 코인 충전 | Toss SDK client |
| `src/app/credits/success/layout.tsx` | 코인 성공 layout | 결제 flow |
| `src/app/credits/success/page.tsx` | 코인 성공 | 결제 flow |
| `src/app/notifications/page.tsx` | 알림 설정 | Push client, 성능/권한 민감 |

## Route Groups Noted

- `src/app/(public)/README.md`만 존재하며 실제 route group page는 없음.
- `src/pages`는 사용하지 않음.
- `template.tsx`는 현재 발견되지 않음.

