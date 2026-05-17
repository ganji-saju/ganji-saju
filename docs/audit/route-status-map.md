# Route Status Map — 2026-05-17

라우트별 상태 / 위험 / 후속 작업 매핑. [`production-hardening-audit.md`](production-hardening-audit.md) §1 의 상세 버전.

범례: 🟢 양호 / 🟡 보강 필요 / 🔴 차단 / 🔵 미공개·내부

---

## 1. 홈 / 온보딩

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/` | `src/app/page.tsx` | 🟡 | `force-dynamic` + cookie 검사. www 비일관성 P0 |
| `/onboarding` | `src/app/onboarding/page.tsx` | 🟡 | 4 슬라이드, cookie `moonlight:onboarded` |

## 2. 운세 / 사주

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/today-fortune` | `src/app/today-fortune/page.tsx` | 🟡 | KST 처리 정상 (`getLocalDateTimeSnapshot`) |
| `/today-fortune/detail` | `src/app/today-fortune/detail/page.tsx` | 🟡 | 결제 unlock 후 진입 |
| `/today-fortune/result` | `src/app/today-fortune/result/page.tsx` | 🟡 | — |
| `/today` | `src/app/today/page.tsx` | 🟡 | — |
| `/saju` | `src/app/saju/page.tsx` | 🟡 | robots disallow (`/saju/`) — 사주 진입 페이지가 SEO 대상이면 정책 재검토 |
| `/saju/new` (+ birth/consent/empathy/nickname) | `src/app/saju/new/**` | 🟡 | 회원가입과 결합된 사주 입력 흐름. 동의 처리 P0 영향 |
| `/saju/[slug]/{overview,deep,elements,nature,premium,share,today-detail}` | `src/app/saju/[slug]/**` | 🟡 | 결과 페이지. lifetime-report 결제 흐름 결합 |
| `/saju/[slug]/premium/print` | `src/app/saju/[slug]/premium/print/page.tsx` | 🟢 | 인쇄용 |

## 3. 타로 / 궁합 / 띠 / 별자리 / 꿈해몽

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/tarot`, `/tarot/daily`, `/tarot/daily/{pick,result}` | `src/app/tarot/**` | 🟡 | KST 정상 (`getKoreaDateKey`). 78카드 SEO landing 미존재 (P2) |
| `/compatibility/{,input,result}`, `/gunghap` | `src/app/compatibility/**`, `src/app/gunghap/page.tsx` | 🟡 | gunghap 과 compatibility 중복 검토 |
| `/zodiac` | `src/app/zodiac/page.tsx` | 🟡 | — |
| **`/zodiac/[slug]`** | `src/app/zodiac/[slug]/page.tsx` | 🔴 | **L69 raw `new Date()` UTC drift (P0)** |
| `/star-sign`, `/star-sign/[slug]`, `/star-sign/[slug]/cross`, `/star-sign/compat`, `/star-sign/compat/[a]/[b]` | `src/app/star-sign/**` | 🟡 | `toKstDateKey` offset 방식. slug og 누락 P1 |
| `/dream`, `/dream-interpretation`, `/dream-interpretation/[slug]` | `src/app/dream*/**` | 🟡 | `DREAM_ENTRIES` 8 vs `DREAM_DICTIONARY` 10+ 데이터 이원화 (P2) |

## 4. AI 상담 (dialogue)

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/dialogue` | `src/app/dialogue/page.tsx` | 🟡 | — |
| `/dialogue/[expert]` | `src/app/dialogue/[expert]/page.tsx` | 🟡 | 12간지 페르소나 |
| **`/dialogue/appointment`** | `src/app/dialogue/appointment/page.tsx` | 🔴 | **L29 가짜 평점 (P0 표시광고법)** |
| `/dialogue/safe-redirect` | — | 🟢 | — |
| `/dialogue/history`, `/dialogue/history/[sessionId]` | `src/app/dialogue/history/**` | 🟡 | 인증 필요 |

## 5. 코인 / 멤버십 / 결제

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/credits` | `src/app/credits/page.tsx` | 🟡 | Toss SDK 직접 호출. orderId Date.now() 충돌 위험 (P1) |
| `/credits/success` | `src/app/credits/success/page.tsx` | 🟡 | robots disallow ✓ |
| `/membership` | `src/app/membership/page.tsx` | 🟡 | — |
| `/membership/{checkout,complete,success}` | `src/app/membership/**` | 🟡 | toss-membership-checkout 컴포넌트 |
| `/pricing` | `src/app/pricing/page.tsx` | 🟡 | — |
| `/pay` | `src/app/pay/page.tsx` | 🟡 | — |
| `/api/payments/prepare` | `src/app/api/payments/prepare/route.ts` | 🟡 | unit test 부재 P1 |
| `/api/payments/confirm` | `src/app/api/payments/confirm/route.ts` | 🟡 | unit test 부재 P1. webhook 부재 P1 |
| `/api/payments/entitlement` | `src/app/api/payments/entitlement/route.ts` | 🟢 | route-helpers.test.ts 존재 |
| `/api/subscription/manage` | — | 🟡 | cancel/resume action |
| `/api/appointments` | `src/app/api/appointments/route.ts` | 🔴 | **PATCH/DELETE 부재 (P0 — 사용자 취소 경로 없음)** |

## 6. 알림 / 마이 / 인증 / 관리자

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/notifications`, `/notifications/{schedule,widget}` | `src/app/notifications/**` | 🟡 | web-push VAPID 가드 존재 |
| `/my`, `/my/{billing,profile,results,situation,settings,settings/delete-account}` | `src/app/my/**` | 🟡 | robots disallow `/my` ✓ |
| `/login`, `/signup`, `/auth`, `/forgot-password`, `/reset-password` | `src/app/{login,signup,...}/**` | 🔴 | 동의 체크박스 부재 (P0) |
| `/admin/{design,operations,payment-funnel,push-ctr,saju-verify,weight-tuning,myungri-validation}` | `src/app/admin/**` | 🔵 | robots disallow ✓. admin-auth check |
| `/api/notifications/dispatch` | — | 🟡 | CRON_SECRET 검증 — unit test 부재 P1 |

## 7. 정적 / 지원

| 라우트 | 파일 | 상태 | 비고 |
|---|---|---|---|
| `/free`, `/guide`, `/help`, `/sample-report`, `/about-engine`, `/method`, `/method/[slug]`, `/myeongri`, `/myeongri/ten-gods`, `/daewoon`, `/taekil`, `/interpretation`, `/verification`, `/vault`, `/lock-screen`, `/search` | `src/app/**` | 🟢 | — |
| `/support/contact` | `src/app/support/contact/page.tsx` | 🟡 | mailto: 폴백 SHELL (P2) |
| `/support/faq` | `src/app/support/faq/page.tsx` | 🟡 | 환불 / 코인 / 멤버십 정책 산재 |
| **`/terms`** | `src/app/terms/page.tsx` | 🔴 | **개정일·버전 없음 P0** |
| **`/privacy`** | `src/app/privacy/page.tsx` | 🔴 | **법정 필수항목 다수 누락 P0** |
| **`/refund-policy`** | — | 🔴 | **페이지 자체 부재 P0** |

---

## 8. SEO 확장 후보 (P2)

상세는 [`../seo/seo-content-plan.md`](../seo/seo-content-plan.md) 참고.

- 꿈해몽 사전 100~500건으로 확장 + 한글 slug
- 별자리 12×12 compat 매트릭스 활용
- 타로 78카드별 landing page 신설
- 띠 연/월/주간 별도 정적 페이지

---

## 9. 라우트 디스커버리 메모

- Next.js 16 에서 `middleware → proxy` 리네임 적용됨 (`src/proxy.ts`). 외부 lint/audit 도구가 legacy `middleware.ts` 만 검사한다면 누락 위험
- `src/app/(public)/legal/` 디렉터리 = `.gitkeep` 만. 향후 정책 페이지 신설 위치 후보
- `src/proxy.ts:82` 의 `/dashboard` 가드 = 라우트 인벤토리에 없음 → dead code 가능 (P2 확인)
