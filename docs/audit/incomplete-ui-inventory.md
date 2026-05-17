# 미완성 UI 인벤토리 — 2026-05-17

저장소 전체 grep 으로 "준비 중", "TODO/FIXME", placeholder/sample/mock/dummy, "로딩중", "결과가 없습니다" 를 검출하고, 사용자에게 직접 노출되는 미완성 UI 를 분류한다.

> **목적**: 결제 흐름 / 사용자 신뢰 차단 요소를 식별 → Phase 4~7 의 사용자 노출 우선순위 결정 근거.

검색 명령 (재현용):
```bash
grep -rn -E "(준비\s?중|준비중)" src/ --include="*.tsx" --include="*.ts" | grep -v ".test.ts\|.spec.ts"
grep -rn -E "(로딩\s?중|불러오는\s?중)" src/ --include="*.tsx" --include="*.ts" | grep -v ".test.ts\|.spec.ts"
grep -rn -E "결과가\s?없" src/ --include="*.tsx" --include="*.ts"
grep -rn "TODO\|FIXME" src/ --include="*.tsx" --include="*.ts" | grep -v ".test.ts\|.spec.ts"
grep -rn -E "placeholder=" src/app/ --include="*.tsx"
grep -rn -i "sample\|mock\|dummy" src/ --include="*.tsx" --include="*.ts" | grep -v ".test.ts\|.spec.ts"
```

---

## 1. 🚨 P0 — 사용자에게 직접 노출 + 결제 흐름 영향

### 1.1 `/membership/page.tsx` — 3개 멤버십 카드 가격 = "준비 중"
| 위치 | 영향 |
|---|---|
| `src/app/membership/page.tsx:48` | `price: '준비 중'` |
| `src/app/membership/page.tsx:56` | `price: '준비 중'` |
| `src/app/membership/page.tsx:64` | `price: '준비 중'` |

- 멤버십 페이지 진입 시 3개 카드의 가격이 "준비 중" 으로 노출
- 사용자가 어떤 멤버십을 선택해야 할지 판단 불가 → 결제 전환 차단
- **즉시 처리**: 가격 확정 + 카드 표시 OR 3 카드 자체를 hidden / "곧 공개" 안내로 변경

### 1.2 `/lock-screen` — 페이지 자체가 SHELL
| 위치 | 영향 |
|---|---|
| `src/app/lock-screen/page.tsx:4` | `// SHELL 정의: visual route + mock data + disabled 액션 + "준비 중" badge` |
| `:11` | `title: '락스크린 위젯 (준비 중)'` |
| `:17` | `const MOCK_LOCK_PREVIEWS = [...]` (mock data) |
| `:53` | UI 텍스트 "준비 중" |
| `:122` | CTA 텍스트 "위젯 켜기 (준비 중)" — disabled |

- robots disallow 처리됨 (`robots.ts:13`) → SEO 노출은 없으나, 직접 URL 방문 / 내부 링크로 진입 가능
- **즉시 처리**: 라우트 자체 제거 OR `notFound()` 처리 OR "곧 공개" 안내 페이지로 교체

### 1.3 `/search` — 검색 기능 미완성
| 위치 | 영향 |
|---|---|
| `src/app/search/page.tsx:383` | `<p>검색 준비 중입니다.</p>` |
| `src/app/support/faq/page.tsx:119` | FAQ Q&A: "통합 검색 기능이 곧 추가될 예정입니다" |

- 사용자가 검색하면 빈 결과 + "준비 중" 메시지
- **즉시 처리**: 검색 라우트 noindex + 내부 헤더에서 검색 진입점 hidden OR 검색 기능 완성

### 1.4 `gangi-ui.tsx` 상담사 7+ 명 가격 "준비 중"
| 위치 | 상담사 | 가격 |
|---|---|---|
| `src/components/gangi/gangi-ui.tsx:27` | 엠지쥐선생 (성향 놀이) | 준비 중 |
| `:32` | 꿈뱀선생 (꿈해몽) | 준비 중 |
| `:33` | 이동말선생 (이동운) | 준비 중 |
| `:35` | 관상원선생 (관상) | 준비 중 |
| `:37` | 손금멍선생 (손금) | 준비 중 |
| `:38` | 복돼지선생 (행운) | 준비 중 |

- DALBIT_TEACHERS 12종 중 다수가 "준비 중" — 사용자가 클릭해도 결제 불가
- pricing 페이지에서 `FALLBACK_TEACHERS = GANGI_TEACHERS.filter(price !== '준비 중')` 로 필터링됨 → pricing 노출은 차단됨
- **잔존 영향**: gangi-market / mega-nav 등에서 카드 노출 시 "준비 중" 표시
- **즉시 처리**: "준비 중" 상담사 카드 자체 hidden OR "곧 공개" 안내 명확화

### 1.5 알림 센터 4건 "준비 중"
| 위치 | 영향 |
|---|---|
| `src/features/notifications/notification-center-page.tsx:879,885` | 알림 옵션 2건 disabled + "준비 중" |
| `:898,904` | 이메일 알림 옵션 "준비 중" |

- 사용자가 알림 설정 페이지에서 일부 옵션을 사용 불가능
- **처리**: 옵션 hidden (P1) OR 카피로 "곧 공개" 명확화

### 1.6 `/help` 페이지 "✦ 준비 중" 배지
| 위치 | 영향 |
|---|---|
| `src/app/help/page.tsx:54` | 1:1 문의 시스템 자체가 "✦ 준비 중" |

- contact-form 이 mailto: 폴백 SHELL (Phase 1 audit 에서 확인) — 정식 1:1 시스템 미구축
- **처리**: Phase 1 audit §4.3 의 CS 보강과 함께 처리

---

## 2. 🟡 P1 — 사용자 노출 있으나 영향 작음

### 2.1 시스템 fallback 메시지 (정상 사용)
- `src/app/saju/[slug]/loading.tsx`, `today-fortune/loading.tsx`, `credits/loading.tsx` — Suspense 로딩 화면 "준비 중" (정상 UX)
- `src/api/ai/route.ts:300-301` — 강약 / 격국 계산 fallback "준비 중" (AI 응답 실패 시)
- `src/domain/saju/report/build-report.ts:645,683,725` — 강약 / 격국 / 용신 계산 fallback "준비 중"
- `src/components/classics/classic-evidence-panel.tsx:15,16` — env 미설정 시 "연결 준비 중" / "원문 준비 중"
- `src/components/report/report-keepsake-section.tsx:63` — PDF 미준비 시 CTA 라벨

→ 모두 의도된 fallback. 카피 검토는 P2.

### 2.2 결제 흐름 메시지
- `src/components/membership/toss-membership-checkout.tsx:122` — `'결제 준비 중 문제가 생겼습니다.'` (에러 메시지, 정상)
- `src/features/saju-intake/saju-intake-page.tsx:1578` — `'결과 준비 중...'` (제출 후 처리 중 표시)

→ 정상 UX 텍스트.

### 2.3 "결과가 없습니다" / "검색 결과가 없습니다" — 5건 모두 정상 empty state
- `src/features/compatibility/compatibility-input-client.tsx:475`
- `src/features/taekil/taekil-client.tsx:267`
- `src/features/saju-intake/saju-intake-page.tsx:688`
- `src/components/today-fortune/birth-info-stepper.tsx:167`
- `src/components/my/profile-manager.tsx:238`

→ 검색 / 입력 시 자연스러운 empty state. 모두 정상 UX.

### 2.4 "로딩중" / "불러오는 중" — 모두 정상 fetch 표시
- `src/app/reset-password/page.tsx:349`, `src/app/login/page.tsx:1332` — 페이지 초기 로딩
- `src/app/dream/page.tsx:176` — 검색 실행 중
- `src/app/credits/page.tsx:398` — 코인 센터 로딩 (무한 로딩 가능성 모니터링 필요)
- `src/components/today-fortune/birth-info-stepper.tsx:204` — MY 프로필 불러오기
- `src/components/ai/yearly-report-panel.tsx:1087`, `lifetime-report-panel.tsx:839`, `fortune-calendar-panel.tsx:507`, `saju-ai-interpretation-panel.tsx:352` — AI 응답 대기

→ 모두 정상. P2 모니터링 — 일부는 무한 로딩 시 timeout/error 처리 검토.

---

## 3. 🟢 P2 — 카피 정리 / 내부 코드 (사용자 영향 없음)

### 3.1 TODO / FIXME — 0건 ✅
- src/ 전체에서 TODO / FIXME 발견 **0건**. 매우 깔끔.

### 3.2 placeholder= (form input UX) — 모두 정상
- 30+ 건 모두 input 의 hint 텍스트 (login, signup, contact, support, admin 등). 정상 form UX.

### 3.3 sample / mock 키워드 (대부분 정상)
- **정상**: `sample-report` 라우트 (`REPORT_SAMPLE_HREF`), `EvidenceSample` (검증 페이지), `SAMPLE_ITEMS` (admin showcase), `sampleSize` (admin weight learning 통계 변수)
- **comment 인용**: `// mockup ScreenXXX` 다수 — 디자인 명세 (mockup) 참조 주석 (정상)
- **P0 분류됨**: `MOCK_LOCK_PREVIEWS` (lock-screen SHELL — §1.2)

### 3.4 dummy — 테스트 코드만
- `src/lib/payments/payment-duplicate-audit.spec.ts:66,81,97,114` — `paymentKey: 'test_pk_dummy'` (테스트 fixture)
- production 코드에 dummy 없음 ✅

---

## 4. 사용자 명세 라우트 검증 (Phase 0 추가)

사용자 directive 의 핵심 라우트 14개 vs 실제 코드 매핑:

| 사용자 명세 | 실제 코드 | 상태 | 비고 |
|---|---|---|---|
| `/` | `src/app/page.tsx` | ✅ 존재 | force-dynamic + onboarding redirect |
| `/onboarding` | `src/app/onboarding/page.tsx` | ✅ 존재 | 4 슬라이드 캐러셀 |
| `/pricing` | `src/app/pricing/page.tsx` | ✅ 존재 | — |
| `/membership/checkout` | `src/app/membership/checkout/page.tsx` | ✅ 존재 | — |
| **`/coins`** | ❌ 없음 | 🔴 명세 불일치 | 실제 코드는 **`/credits`** (`src/app/credits/page.tsx`) |
| `/today-fortune` | `src/app/today-fortune/page.tsx` | ✅ 존재 | — |
| `/saju/new` | `src/app/saju/new/page.tsx` | ✅ 존재 | — |
| `/dialogue` | `src/app/dialogue/page.tsx` | ✅ 존재 | — |
| `/dialogue/appointment` | `src/app/dialogue/appointment/page.tsx` | ✅ 존재 | 🚨 P0 가짜 평점 |
| `/zodiac` | `src/app/zodiac/page.tsx` | ✅ 존재 | — |
| **`/zodiac/[sign]`** | `src/app/zodiac/[slug]/page.tsx` | 🟡 param 명 다름 | param = `[slug]` (코드) vs `[sign]` (명세). 동작 동일 |
| **`/horoscope`** | ❌ 없음 | 🔴 명세 불일치 | 실제 코드는 **`/star-sign`** (`src/app/star-sign/page.tsx`) |
| **`/horoscope/[sign]`** | ❌ 없음 | 🔴 명세 불일치 | 실제 코드는 **`/star-sign/[slug]`** |
| `/dream-interpretation` | ❌ 디렉터리 자체 없음 | 🟡 | `src/app/dream-interpretation/[slug]/page.tsx` 만 존재 (인덱스 페이지 없음). 검색 진입은 `/dream` 으로 |
| `/dream-interpretation/[slug]` | `src/app/dream-interpretation/[slug]/page.tsx` | ✅ 존재 | — |
| `/login` | `src/app/login/page.tsx` | ✅ 존재 | 🚨 P0 동의 체크박스 부재 |
| `/terms` | `src/app/terms/page.tsx` | ✅ 존재 | 🚨 P0 개정일·버전 없음 |
| `/privacy` | `src/app/privacy/page.tsx` | ✅ 존재 | 🚨 P0 법정 필수항목 누락 |

### 4.1 명세 불일치 결정 필요 사항
사용자 결정 필요 (Phase 2 진행 전 권장):

| 명세 라우트 | 옵션 |
|---|---|
| `/coins` ↔ `/credits` | A) 코드를 `/coins` 로 리네임 / B) `/coins` → `/credits` 301 alias 만 / C) 명세 무시, `/credits` 유지 |
| `/horoscope` ↔ `/star-sign` | A) 코드를 `/horoscope` 로 리네임 / B) `/horoscope` → `/star-sign` 301 alias 만 / C) 명세 무시 |
| `/zodiac/[sign]` ↔ `/zodiac/[slug]` | param 명만 다름 — 코드/URL 변경 불요, 명세 표기만 정리 |
| `/dream-interpretation` 인덱스 페이지 | A) 신설 (꿈해몽 카테고리 hub) / B) `/dream` 진입점만 유지 |

→ Phase 2 (도메인 통일) 또는 Phase 10 (SEO 확장) 에서 처리 권장. 검색 SEO 키워드와 결합 — `/horoscope` 가 영문 검색 트래픽이 더 많을 수 있음.

---

## 5. 다음 단계 — Phase 4 후속 작업 후보 (긴급)

본 인벤토리 §1 의 P0 항목을 Phase 4 (가짜 평점 제거) PR 에 추가하거나 별도 PR 로 묶을 수 있다:

| Phase 4-A | 가짜 평점 제거 (이미 plan 에 있음) |
| Phase 4-B (신규 후보) | 사용자 직접 노출 "준비 중" UI 정리 |

Phase 4-B 작업 분해:
1. `/membership/page.tsx` 3개 "준비 중" 카드 → hidden 또는 "곧 공개" 명확화
2. `/lock-screen` 전체 페이지 → `notFound()` 또는 라우트 제거
3. `/search` → noindex + 헤더 검색 진입점 hidden
4. `gangi-ui.tsx` 상담사 카드 "준비 중" → hidden (`gangi-market.tsx:374` 의 `isComingSoon` 로직 활용)
5. 알림 센터 4건 → hidden 또는 카피 통일

작업 비용 = 소~중. 코드 변경 위주 (각 페이지 1~2 파일).

---

## 6. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-17 | 초기 작성 (Phase 0 — 사용자 directive 추가 요구사항) |
