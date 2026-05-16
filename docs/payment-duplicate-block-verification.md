# 결제 중복 차단 9곳 production 검증 체크리스트

> 작업: PROGRESS.md §4 Tier A6
> 대상 배포: PR #177 (서버 5곳) + PR #178 (client 4곳 + 공유 API/hook), 2026-05-16
> 소요: 검증 0.5일 (계정 셋업 포함)
> 자동화 도구: `npm run audit:user-entitlements <user-id-or-email>`

---

## 0. 사전 준비

### 0.1 테스트 계정 4종 (production)
| 계정 | 보유 상태 | 셋업 방법 |
|---|---|---|
| **A. 활성 멤버 (basic)** | `subscriptions.status='active' AND plan='plus_monthly'` | 실 결제 또는 admin grant |
| **B. 활성 멤버 (premium)** | `subscriptions.status='active' AND plan='premium_monthly'` | 실 결제 또는 admin grant |
| **C. lifetime 보유** | `product_entitlements.product_id='lifetime-report'` | 사주 1개에 lifetime 결제 |
| **D. taste 다종 보유** | today-detail + love-question + monthly-calendar (2026-05) | 각 상품 실결제 |

> 활성 계정이 없으면 `admin` 으로 `product_entitlements` / `subscriptions` 직접 insert 후 검증.

### 0.2 진단 명령
```bash
npm run audit:user-entitlements <user-id-or-email>
```
- subscriptions / product_entitlements / credit_transactions(legacy) 전부 출력
- 9 진입점별 예상 동작 (🟢 차단 / ⚪ 허용) 매트릭스 출력
- 결제 진입점 클릭 직전 실행 → 화면과 매트릭스 일치 여부 즉시 검증

---

## 1. PR #177 — 서버 페이지 5곳

### [1] `/membership/checkout` — 활성 plan 일치 시 결제창 미실행
**파일**: `src/app/membership/checkout/page.tsx:191,219,230,234`
| 계정 | URL | 기대 |
|---|---|---|
| A (basic 활성) | `/membership/checkout?package=plus-monthly` | 🟢 결제 위젯 X, "이미 이용 중" + `/my/billing` CTA |
| A (basic 활성) | `/membership/checkout?package=premium-monthly` | ⚪ premium 미보유 → 결제 위젯 노출 |
| C (lifetime 보유) | `/membership/checkout?package=lifetime-report&slug=<보유 slug>` | 🟢 차단 + 풀이 보기 CTA |
| D (today-detail 보유) | `/membership/checkout?package=today-detail&slug=<보유 slug>` | 🟢 차단 |
| 신규 계정 | `/membership/checkout?package=plus-monthly` | ⚪ 결제 위젯 정상 |

### [2] `/membership` plan 카드 — "이용 중" jade 뱃지
**파일**: `src/app/membership/page.tsx:103`
| 계정 | 기대 |
|---|---|
| A (basic) | basic 카드에 🟢 "이용 중" 뱃지 + `/my/billing` link |
| B (premium) | premium 카드에 🟢 "이용 중" 뱃지 |
| 비활성 | ⚪ 모든 plan 결제 button 정상 |

### [3] `/pricing` plan 카드 — "✓ 이용 중 · 결제 내역" 버튼
**파일**: `src/app/pricing/page.tsx:52`
| 계정 | 기대 |
|---|---|
| A | basic 카드 button → "✓ 이용 중 · 결제 내역" (`/my/billing`) |
| B | premium 카드 button → "✓ 이용 중 · 결제 내역" |
| 비활성 | ⚪ 결제 button 정상 |

### [4] `/saju/[slug]/deep` lifetime CTA — 보유 시 "구매한 풀이 보기"
**파일**: `src/app/saju/[slug]/deep/page.tsx:333`
| 계정 | 검증 slug | 기대 |
|---|---|---|
| C | 보유 slug | 🟢 "✓ 구매한 풀이 보기" → `/saju/<slug>/premium` |
| C | 미보유 다른 slug | ⚪ lifetime 결제 CTA 정상 |
| 비보유 | 임의 slug | ⚪ lifetime 결제 CTA 정상 |

### [5] `/saju/[slug]/premium` — premium 멤버십 button
**파일**: `src/app/saju/[slug]/premium/page.tsx:298-300`
| 계정 | 기대 |
|---|---|
| B (premium 활성) | premium 멤버십 button → 🟢 "✓ 멤버십 이용 중" (비활성) |
| C (lifetime 보유 slug) | lifetime CTA → 🟢 "✓ 구매한 풀이 보기" |
| A (basic) | premium button ⚪ 결제 가능 (basic ≠ premium) |

---

## 2. PR #178 — Client 진입점 4곳

### [6] `premium-lock-card.tsx` today-detail 550원
**파일**: `src/components/today-fortune/premium-lock-card.tsx:36,54`
| 계정 | 검증 흐름 | 기대 |
|---|---|---|
| D (today-detail 보유) | 보유 scope 의 `/today-fortune/detail` 진입 | 🟢 "✓ 이미 구매한 풀이" + 즉시 열람 link |
| D | 다른 sourceSessionId 의 today-detail | ⚪ 결제 button 정상 (scope 다름) |
| 코인 unlock 만 한 사용자 | 해당 slug | 🟢 coin-unlocked 분기 동작 |
| 비보유 | 임의 slug | ⚪ 결제 button 정상 |

> 검증 포인트: 네트워크 탭 `GET /api/payments/entitlement?productId=today-detail&slug=<slug>` → `{hasEntitlement: true, reason: 'product-purchased'|'coin-unlocked'}` 응답.

### [7] `compatibility/result/page.tsx` manual 분기 love-question 990원
**파일**: `src/app/compatibility/result/page.tsx:99-122`
| 계정 | URL | 기대 |
|---|---|---|
| D (love-question 보유) | `/compatibility/result?source=manual` (paid 없음) | 🟢 서버 entitlement 검사 통과 → 결제 link 제거 |
| 비보유 | `/compatibility/result?source=manual&paid=love-question` | ⚪ URL paid 만 의존하던 회귀 방지 — 무료 안내 |
| 비보유 | `/compatibility/result?source=manual` | ⚪ 결제 link 정상 |

> 회귀 핵심: 이전엔 URL `?paid=love-question` 만 보면 OK 처리 → server-side `getTasteProductEntitlement` 검증 추가.

### [8] `fortune-calendar-panel.tsx` monthly-calendar 1,900원
**파일**: `src/components/ai/fortune-calendar-panel.tsx:468`
| 계정 | 월 선택 | 기대 |
|---|---|---|
| D (2026-05 보유) | 5월 선택 | 🟢 "✓ 이미 구매한 5월 캘린더 열기" |
| D | 6월 선택 | ⚪ 결제 button 정상 (scope=2026-06 미보유) |
| 비보유 | 임의 월 | ⚪ 결제 button 정상 |

> scope_key 형식: `calendar:<readingKey>:2026-05`. 월별 분리 동작 핵심.

### [9] `/api/notifications/feed` subscription-expiring 분기
**파일**: `src/app/api/notifications/feed/route.ts:30-33,55-57`
| 계정 | 시나리오 | 기대 |
|---|---|---|
| A (basic 활성) | subscription-expiring 알림 click | 🟢 href = `/my/billing` |
| 만료 임박 (활성 멤버 X) | 동일 | ⚪ href = `/membership/checkout?plan=plus&from=expiring` |

> 검증: Push notification 미발송 환경에서도 알림센터 `/notifications` 직접 진입 후 href 확인 가능.

---

## 3. 자동화 보장 (수동 검증 면제)

다음은 `npm test` (vitest) 가 매 PR 자동 검증 — 수동 확인 불필요:

| 검증 | 위치 |
|---|---|
| catalog packageId/tasteProductId 유일성 | `src/lib/payments/payment-duplicate-audit.spec.ts` |
| 가격 ↔ confirmation 검증 ±1원 거부 | 동일 |
| scope key 결정성 (같은 입력 = 같은 키) | 동일 |
| scope key 충돌 방지 (prefix 분리) | 동일 |
| productId ↔ package 1:1 매핑 | 동일 |

---

## 4. 회귀 발견 시 hotfix 흐름

1. `npm run audit:user-entitlements <문제 user>` → DB 상태 캡처
2. 브라우저 DevTools Network → `/api/payments/entitlement` 응답 캡처
3. 응답이 `{hasEntitlement: true}` 인데 UI 가 결제 button 노출 → **client 진입점 분기 누락**
4. 응답이 `{hasEntitlement: false}` 인데 DB 에 행 있음 → **scope_key 빌더 불일치 또는 product_id 매핑 버그**
5. 응답이 `{error: ...}` 5xx → **route.ts 또는 supabase RLS 이슈**
6. fix → 새 PR (PR #177/#178 amend 금지 — 이미 production)

---

## 5. A8 사전 작업 — 결제 실패 시 toast 안내

검증 중 "no healthy upstream" 등 결제창 실패가 재현되면 즉시 A8 toast 적용:
- 메시지: **"결제에 실패했습니다. 이미 결제하신 상품인지 [내 결제 내역](/my/billing) 에서 확인해주세요."**
- 위치: `loadTossPayments()` 또는 `tossPayments.requestPayment()` catch 절
- 노출 시간: 6초 (긴 안내라 충분히)
- 분기: 결제 실패 사유에 무관하게 노출 (사용자에게 가장 흔한 원인 안내)
