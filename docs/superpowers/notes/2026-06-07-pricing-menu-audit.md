# 전 메뉴 가격 정합성 전수 감사 (2026-06-07)

병렬 3에이전트(표면 열거 / 라우트 게이팅 맵 / 데드링크) + 교차 대조.
canonical 가격 원천: `src/lib/payments/catalog.ts`.

## 0. Canonical 가격 카탈로그 (단일 진실)
| 상품 | id | 가격 | 구매 경로 |
|---|---|---|---|
| 체험/스타터/기본 코인 | credit_1/3/7 | 500 / 990 / 2,000 | /credits |
| 보너스 36코인(구독) | subscription_30 | 9,900 | /membership/checkout |
| 라이트 대화 멤버십 | membership_plus | 4,900/월 | /membership/checkout |
| 프리미엄 대화 멤버십 | membership_premium | 9,900/월 | /membership/checkout |
| 보관형 사주 리포트(라이프타임) | lifetime_report | 49,000 | /saju/[slug] 후 |
| 오늘 자세히 | today-detail | 550 | /today-fortune?product=today-detail |
| 점수 풀이 | score-factor | 550 | /saju/[slug] |
| 연애 마음 확인 | love-question | 990 | **/compatibility/input · /membership/checkout** |
| 돈 새는 패턴 | money-pattern | 990 | /saju/new?product=money-pattern |
| 일/직장 흐름 | work-flow | 990 | /saju/new?product=work-flow |
| 궁합 깊은 풀이 | compat-reading | 990 | /compatibility/result |
| 월간 달력 | monthly-calendar | 1,900 | /saju/new?product=monthly-calendar |
| 올해 핵심 3줄 | year-core | 3,900 | /saju/new?product=year-core |

**/saju/new(saju-intake) product 화이트리스트:** monthly-calendar·year-core·money-pattern·work-flow **만**. (today-detail/love-question/score-factor 등은 처리 안 함.)

## 1. 라우트 게이팅 맵 (무료 vs 유료)
**FREE(게이팅 없음):** /saju/new(허브), /saju/[slug](기본), /compatibility(허브), /tarot/daily(+result), /taekil, /daewoon, /myeongri, /today-fortune(+result), /dream, /star-sign, /zodiac, /dialogue(입구), /membership(안내), /sample-report, /interpretation, /search, /saju/[slug]/elements·overview
**GATED(결제):** /saju/[slug]/premium·deep·today-detail(550~49,000), /compatibility/input·result(love-question/compat-reading 990), /today-fortune/detail(today-detail 550), /dialogue/[expert](메시지 전송 시 멤버십/코인), /membership/checkout, /credits
**REDIRECT:** /guide→/interpretation, /myeongri/ten-gods→/myeongri, /dream-interpretation(index)→/dream

## 2. 발견 사항 & 우선순위

### 🟥 P1 — 깨진 구매 퍼널 (수정 완료, 2곳)
- **`/saju/new?product=love-question`**: /saju/new는 love-question 미처리(화이트리스트=monthly-calendar·year-core·money-pattern·work-flow 만) → 구매 안 되고 generic 사주입력으로 빠짐.
  - `search-index.ts:23` '연애 마음 확인 990원' → **`/compatibility/input`**
  - `app/search/page.tsx:35` 추천칩 '연애 풀이' → **`/compatibility/input`** (← /search 에 실제 렌더됨, 재스캔으로 추가 발견)

### 🟨 P2 — 링크 위생 (수정 완료, 2곳)
- 꿈해몽 → `/dream-interpretation`(index는 /dream으로 redirect) → **`/dream` 직결**:
  - `site-footer.tsx:69`, `lib/home-content.ts:68`, `features/home/content.ts:128`(← 별도 홈 콘텐츠 파일, 재스캔 추가 발견)
  - (참고: `robots.ts:30` 의 /dream-interpretation 은 [slug] 상세 크롤링용 sitemap 항목이라 정상, 유지)

### 🟩 P3 — 죽은 teacher 링크 (수정 완료)
- **moonlight `DALBIT_TEACHERS` 5개 href = `/guide?teacher=*`**(/guide는 teacher 무시·/interpretation redirect = 죽은 링크) → #423과 동일 목적지로 정정:
  mg-ji→`/dialogue/rat`, today-so→`/today-fortune?concern=general`, dream-baem→`/dream`, face-won→`/dialogue/monkey`, luck-dwaeji→`/dialogue/pig`. 미사용 공유 const(`DALBIT_TEACHER_GUIDE_HREF`) 제거.

### ✅ 정상 판정 (오인 아님)
- 사주 550원~ → /saju/new, 궁합 990원 → /compatibility/input: **freemium 정당**(기본 무료, premium/result에서 실제 과금).
- '내 사주 풀이 깊은+PDF 49,000원' → /saju/new: lifetime_report 가격 **정확**.
- moonlight taste products(money-pattern·work-flow·monthly-calendar·year-core) → /saju/new?product=*: 화이트리스트 일치 **정당**.
- '무료' 라벨 카드(today-fortune·tarot·dream·zodiac·star-sign·daewoon·taekil·myeongri·dialogue): 라우트 전부 FREE **일치**.
- search '궁합 보기 76점부터', '재회 타로'→/tarot/daily: 가격 라벨 아님/무료 타로 폴백 — 허용.
- 데드링크: /dream-interpretation 외 **전 href 정상 resolve**(동적 [expert]/[slug] generateStaticParams 확인).

## 3. 이전 세션 정정분(참고)
- coming-soon mislabel: 선생 4명(#423), FAQ 검색(#424)
- 가격 라벨 mislabel: taekil 1,900원(#425), 대운·명리호·재회타로(#426)
