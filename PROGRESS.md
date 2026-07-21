# 간지사주 — 작업 진행 정리

> 최종 업데이트: **2026-07-21 (Claude — 🔴평생/보관형 리포트 "구매했는데 상세에서 PDF·본문이 안 보임" 버그: 근본원인=`toSlug` 의 readingKey 해시 토큰(`-key<hash>`)이 **이름을 포함**해, 구매(이름 있는 readingId/어드민 grant)와 열람(이름 없는 raw slug) 조합에서 readingKey 가 갈려 `product_entitlements`/`credit_transactions` **정확일치 조회가 MISS → `hasLifetimeAccess=false`**. 조회측만 해시를 벗기고 기록측은 풀해시 저장이라 다리가 안 놓였다. 수정=`lifetimeReadingKeyMatches`(정확일치 우선, 실패 시 같은 차트 prefix 로 이름 해시 드리프트 흡수·다른 생년월일은 거부) + `listProductEntitlementsByProduct` 로 저장 이용권 후처리 매칭(product·credit 양경로). 재현+회귀 테스트 3건·typecheck 0·1186+189 green. ⚠️같은 readingKey 스코프를 쓰는 **월간달력·올해핵심도 동일 잠재버그**(미수정, 후속) / ⚠️이용권 행이 환불 오탐(#632)으로 **삭제**된 경우엔 이 수정으로 못 살림(재부여 필요) — 상세 ↓ 첫 섹션)** / 직전: **2026-07-21 (Claude — P1 지표/표시 결함 3종(어제 감사 잔여): ①/pricing·/membership 취소선 미렌더(두 페이지가 compareLabel 을 안 읽음 — 데이터는 정상 유입; compareLabelFromMap 으로 line-through 렌더, GangiListLink 에 compare 슬롯 신설) ②push-ctr·web-push-status 0(집계가 인증용 anon 클라이언트 재사용→RLS `auth.uid()=user_id` deny; createServiceClient 로 교체) ③결제 전환율이 '시도 0건'을 0.0% 표시(payment-funnel rate 분모 0→null 로 통일 + 포맷터 null→'—'); 회귀 테스트 2파일 신설·typecheck 0·unit 전량 green — 상세 ↓ 첫 섹션)** / 직전: **2026-07-21 (Claude — 가격·판매정리·UI·지표UX 후속: ⑧점수 언락 6,600→3,300 통일 + **묶음 판매 중단**(점수를 내리면 따로사기 6,600<묶음 9,900 역전; 실구매 0건이라 정리) ⑨**궁합 전역권(연애 마음 확인) 판매 중단**(같은 3,300에 권한만 넓어 커플권 완전 열위; grandfather로 기존 열람은 유지) ⑩결제 CTA 4종 하단 고정(스크롤 내릴 때만 노출) ⑪동의 배너 하단→최상단 인플로우+축소(183→114px; 결제 바와 자리 겹침 해소) ⑫관리자 방문지표 4중표시→**자체 순방문 단일**(GA4/Vercel 숨김: 서로 다른 걸 세서 못 맞춤; 동의 denied라 GA4 구조적 과소) + 크롤러구간 표시 클램프(2026-07-19부터) + **유입 상위 카드**(self-referral 제외) ⑬시각모름 일진점수 조사=편향 아닌 불안정, 변경 없음(내 오판 2건 기록) ⑭**환불이 매출에 그대로 잡히던 버그**(metrics_daily 는 refunded_won 별도기록 정상인데 /admin/analytics 조회가 revenue_won 만 읽음 — #641은 쓰기만 고치고 읽기 누락; 순매출=매출−환불 파생) + 07-20 결제누락 의혹=UTC오독(KST로 07-21 정상귀속) — **🔜 남은 일은 맨 위 세션 끝 '다음 세션 바로 시작용' 섹션** — 상세 ↓ 첫 섹션)** / 직전: **2026-07-20 (Claude — 🔴**계측·결제 정합 대수술**: ①방문 집계가 실사용자를 **한 명도 센 적 없었음**(호스트 판정을 NEXT_PUBLIC_SITE_URL=퓨니코드와 비교 → canonical 사용자 전량 폐기. 남아 있던 2,540행은 크롤러) ②실유저 10명 중 8명이 가입 후 증발한 원인=**가입해도 계정이 텅 빔**(profiles 미생성 + 익명 사주 미귀속) ③CSP enforce 켰으면 **결제 사망**(나이스페이 form-action·SDK 미허용) ④관리자 환불 **3관문 연속 실패**(orderId 누락 → 취소 서명공식 오류 → 기취소 응답 미인식; 돈은 환불됐는데 장부만 failed) ⑤가격 정합(단품 6종·궁합) + money-pattern·work-flow **전달물 0**이던 것 연결 ⑥궁합 전역권 판매 중단(커플권 완전 열위 해소) ⑦카카오 채널 ID에 채널 **이름**이 들어가 링크 404 — 상세 ↓ 첫 섹션)** / 직전: **2026-07-19 (Claude — 메인 카드 구조 개편(정사각 사진 + 사진 위 제목만, 가격·부제는 사진 밖으로; 텍스트가 카드 높이의 54%를 덮던 것을 해소하면서 총높이는 233→234px 로 유지) + **카드 제목색 대비 오류 수정**: 8색을 고를 때 대비를 원본 사진에 대고 계산했는데 사진 위에는 이미 어두운 스크림(.86)이 깔려 있어, 배경이 밝은 사진에 "어두운 글씨"가 최적이라고 나왔고 실제로는 어두운 스크림 위 어두운 글씨로 묻혔다. 사용자가 지목한 3개 = 3:1 미만인 3개와 정확히 일치. 스크림 합성 후 배경 기준으로 재계산 + "전부 밝은색·서로 다른 색상 계열" 제약 → 최저 대비 2.23→4.27 — 상세 ↓ 첫 섹션)** / 직전: **2026-07-19 (Claude — 🔴**모바일 터치 스크롤 사망 수정**: 푸터 가로넘침 19px 을 가리려 넣은 `html, body{overflow-x:hidden}` 이 반대축을 auto 로 강제해 html·body 가 둘 다 스크롤 컨테이너가 되며 터치 팬이 죽었다. window.scrollTo 는 정상이라 기존 E2E 가 전부 통과 — 실제 터치로만 재현. 넘침 제거 후 html 만 클립 + 터치 회귀가드 신설. 메인 카드 제목은 4차 반복 끝에 금액 위·배경판 없음·가운데 정렬로 확정(크기 전 카드 통일) — 상세 ↓ 첫 섹션)** / 직전: **2026-07-19 (Claude — 3,300원 이벤트 잔여 정합: 배너 각인가격 재조판(Gothic A1 Black, '원'은 원본 픽셀 유지) + **전 차감량을 카탈로그 파생으로 전환**(costs.ts, floor(가격/990) → 이벤트 종료 시 자동복원; 리터럴 10전이 카드 3,300원과 3배 괴리 상태였음). 덤으로 상시 red 였던 today-fortune-audit `coinCost===1` 단언·달력 '2전' 5배 과소표시·존재하지 않는 궁합 전 결제 안내까지 수정. 묶음 할인특가 9,900원(취소선 19,800) + score-total 6,600원(취소선 9,900)으로 서열 정리(단품 3,300<점수 6,600<묶음 9,900). 두 번 깨진 가격 서열 불변식을 pricing-hierarchy.test.ts 로 고정. ⚠️6,600은 정확히 손익분기라 묶음 절약액 0원(편의 소구) — 상세 ↓ 첫 섹션)** / 직전: **2026-07-18 (Claude — 20260718 PPTX 수정안 전면 적용: 유료 카드 상단 재배치(7/4 지시 되돌림)·50대 가독성 배경판·로고 9,900원 크롭·**3,300원 이벤트**(취소선 인프라는 기존, product_prices 0행 실측)·결제창 상단중복/먹통 결제수단카드/쿠폰행 제거·약관 5→1개(감사기록 4종 유지)·무료 오늘운세 13섹션→1장 요약·하단 업셀 썸네일화·**무료 4종 하루 1회 제한 신규**(익명 쿠키+계정 RPC, 마이그레이션 불필요; 꿈해몽은 자동검색 제거가 한 세트, 타로는 기록 API 신설, 대화상담은 평생3턴→하루1턴). ⚠️E2E 미검증(환경 충돌)·배너/코인10전/묶음은 아직 9,900 기준 — 상세 ↓ 첫 섹션)** / 직전: **2026-07-13 (Claude — 결제·크론·지표 정합성 복구: E2E회귀 #628·죽은stepper정리 #630·NicePay진단 #631·환불이용권회수 #632·크론전멸(canonical301) #634·봇지표필터 #635 → 환불 상태머신 refunded #641(세경로 대칭·총매출/환불액 분리·migration 071; 코드리뷰 실버그 2건 C1 gross이중차감·I1 refunded_at드리프트 수정) → 사용방법 온보딩 자동실행 제거·메뉴 수동전용화 #643. 발단은 "무료가 잘나와 결제 안함→블러페이월" 요청이나 조사결과 문제는 페이월 아닌 죽은 계측이었음 — 상세 ↓ 첫 섹션)** / 직전: **2026-07-07 (Claude — /admin/analytics 날짜별 상세 테이블 #614 + 15일 페이지네이션 #615 → 관리자 전상품 가격 제어 Phase 1 #616(product_prices/감사 DB·price-resolver 카탈로그폴백·머니패스 order.amount 스냅샷·/admin/pricing super_admin 현재/과거/변경가+되돌릴수없음 확인창; 4-lens 적대리뷰 CRITICAL 1건 수정=체크아웃 청구액을 prepare.amount로 통일해 가격변경시 결제거부 차단; ⚠️migration 067 수동·실가격변경은 Phase 2 후 권장) — 상세 ↓ 첫 섹션)** / 직전: **2026-07-06 (Claude — 사주풀이 밀착 개인화 #607(5개 프롬프트+fallback show-don't-tell) → LLM 조용한 fallback 근본수정 #608(GPT-5.x temperature 400·모델 env 오표기·interpret 한자 스트립) → admin 방문/결제 오늘·주간·월간·누적 구분 #609 → GA4+GTM 정제 임베드 #610(사주/공유 URL의 생년월일·이름 미전송 sanitize) → 자체 쿠키/분석 동의 배너 Consent Mode v2 #611(기본 denied·재방문 복원·푸터 재선택·above-dock 충돌해소) → 오늘 자세히보기·달력 '오늘의 흐름' 이름 '선생님'으로 새던 버그 #612(오늘payload 무이름→premium/달력에 raw input 전달, Bug A가 free만 보강) → /admin/analytics 누적 일별 지표 그래프 #613(자체 first-party 롤업: 방문·전환·유입UTM·결제, migration 066·크론·백필; 4-lens 리뷰 8건 반영) — 상세 ↓ 첫 섹션)** / 직전: **2026-07-04 (Claude — admin 신뢰성 집중: 지표 전수검증 #593·#594(3대 근본원인: anon집계·퍼널INSERT정책부재·결제소스stale) → 사용자요약 stale 근본수정+목록보강 #597 → 계정관리(정지/수정/삭제) #598 → 재감사 15건 중 12건 수정 #599(LLM 1000행 클램프·UTC버킷·캐시hit 0%·퍼널 비율왜곡 4곳)+누적결제 SQL RPC #600(migration 063 ⚠️수동적용). 카카오 KOE205 인시던트 해결 #596(scope env게이트)+함께로그아웃 #595 — 상세 ↓ 첫 섹션)** / 직전: **2026-07-03 (Claude — 카카오 연동 전면 구현: 공유 SDK 5메뉴(사주·궁합·별자리·띠·타로) + 알림톡/친구톡 발송엔진(Solapi, env-gated dormant)+webhook+채널추가버튼+전화번호수집(설정·결제화면)+migration 059. PR #576~#583. 공유 4019 **해결**(2026-07-03, 근본원인=카카오 콘솔 JS키 SDK 도메인 오타 `httpa://` — 콘솔 정정으로 종결, 진단페이지 #588→제거). 알림톡 템플릿 2종 승인·크론 등록(#587) 완료, 남은 건 Solapi env 입력뿐. 개인정보처리방침 admin 반영·059 수동적용 완료 — 상세 ↓ 첫 섹션) / 2026-07-01 (Claude — 재화 명칭 리브랜딩: 사이트 전역 "코인"→"전" 치환(97파일·324곳). 가상화폐/투기 의미의 "코인"(재물운 해석 7곳·타로 크립토질문 감지·safe-redirect FINANCIAL_KEYWORDS)만 유지. URL 경로(/coin-policy)·DB 값(kind='coin')·영문 식별자는 보존. ⚠️ 정책 본문은 DB policy_versions(032/057 seed) 우선 서빙이라 라이브 법률/코인정책 텍스트는 별도 DB 업데이트 필요) / 2026-07-01 (Claude — PC 메가내브 우상단 로그아웃 버튼 "작동 안 함" 수정: `MegaNavBar` 가 영속 마운트 클라 컴포넌트라 로그아웃의 `router.refresh()` 로는 리마운트 안 됨 → `getUser` 마운트 1회 판정 + `onAuthStateChange` 미구독으로 세션 state stale. SiteHeader 처럼 `onAuthStateChange` 구독 추가) / 2026-06-27 (Claude — 저장프로필 선택 자동입력 첫 슬라이드 이동 #507 / 나이스페이 결제후 사주풀이 라우팅 회귀수정 #505·sandbox/live 단일토글 #506 / step스크롤 #504·인증E2E복구 #502·커서복원 #503·회원가입폼 overflow 근본 #501·하단dock·로그인UI #485~#500 / 실운영 전 데이터 초기화(docs/data-reset.sql) + 나이스페이 결제 프로덕션 가동+admin환불+문구중립화 #473~#484(탭트랩/U116 해결) / 오늘 자세히보기 10코인·묶음 19800 #472 / 꿈해몽 배너+가격제거 #469·#471 / 보너스36코인 삭제 #470 / HOT·추천 이동 #468 / 인물 사진 8종 #467 / 메인 카드 인물사진형+이미지 배너 #466 / 오늘 자세히보기 매일 일진+plain #464·#465 / 제목 폰트 확대+정렬 #463 / 전역 폰트 ×1.15 #462 / 대운·택일 9,900원+4메뉴 결제 검증 #461 / 붓글씨 로고 #459·#460 / 메인 리디자인 #458)**. 상세 ↓ 첫 섹션. 직전: **2026-06-22 (#448~#452)**. 직전: **2026-05-29 Codex 모바일 하단 고정 CTA 겹침 수정**. 그 직전: **Codex 코인 환불 관리자 플로우 + 모바일 저사양 성능 최적화**. 결제 안정성 세션: **Next 16.2.6 + 서버 orderId/payment_orders + Toss webhook/reconciliation**. **상세: ↓ 첫 세션 섹션.**
> 대상 도메인: `https://ganjisaju.kr` (canonical) · www / 간지사주.kr / xn--s39at50bo6fmwa.kr → 301 → canonical
> 브랜드: 간지사주 (2026-05-18 구 브랜드명 → 간지사주 통일 완료)
> 2026-05-22 종합 검수: `audit-reports/2026-05-22-comprehensive-audit.md` — 🟢 12 / 🟡 2 / 🔴 0 (점수 Phase 1~3 + 어휘 정책 + P0 6종 완료 · 잔존 🟡 2: 총평 25~35문장 enforce 미확인 / 대운 LLM 다양성 미검증). `audit:user-entitlements` exit 1은 인자 필수 CLI 오탐(`audit-reports/2026-05-22-user-entitlements-diagnosis.md`).

---

## 2026-07-21 세션 (Claude) — 평생/보관형 리포트 "구매했는데 상세에서 PDF·본문 안 보임"

> 사용자 제보: "보관형 사주리포트 PDF리포트가 상세보기에 있었던 것 같은데 사라졌어".
> (내 첫 답 "PDF 없음"은 오답 — `grep --include=*.ts` 가 zsh 글롭 오류로 실행조차 안 됨. 재검색으로 정정.)

### 사실 확인
- PDF 인프라 **현존**: `/saju/[slug]/premium/print`(8페이지 A4) + `report-document`·`ReportPrintActions`·
  `lib/saju/pdf-report-text`. 진입 버튼 "📄 PDF로 저장하기"는 premium("상세") 페이지 line 587.
- 단 버튼은 `hasLifetimeAccess` 게이트 — **평생/보관형 리포트(lifetime_report) 구매자에게만** 노출.
  Premium 멤버십 구독자는 `hasLifetimeAccess`가 false로 남아 안 보이는 갭도 있음.

### 근본원인 (systematic-debugging + 병렬 조사)
`hasLifetimeAccess`는 `getLifetimeReportEntitlement(user.id, readingKey, [slug])` 결과.
- `readingKey = toSlug(reading.input)` 의 마지막 세그먼트 `getBirthSlugHashToken` 의 해시 payload가
  **이름을 포함**(`buildBirthSlugHashPayload` = [name, y, m, d, timeCode, gender]).
- **구매/부여**는 이름 있는 소스(persisted readingId, 어드민 grant #571)에서 → `lifetime:{...-key<hashWithName>}` **한 개만** 저장.
- **열람**이 이름 없는 raw slug면 `fromSlug`→`deriveBirthInputFromSajuData(name: fallback.name=undefined)`
  → `toSlug` 가 다른 해시 → `lifetime:{...-key<hashNoName>}`.
- 조회의 `normalizeEntitlementReadingKeys` 는 해시를 벗긴 변형을 만들지만 **조회측에서만**, 기록은
  풀해시라 product·credit **양경로 정확일치 MISS** → 구매했는데 `hasLifetimeAccess=false`.

### 수정 (`lifetimeReadingKeyMatches` + 후처리 매칭)
- `report-entitlements.ts`: `lifetimeReadingKeyMatches(storedKey, acceptedKeys)` — 정확일치 우선,
  실패 시 `-key<hash>` 를 벗긴 **같은 차트 prefix** 로 이름 해시 드리프트를 흡수. 해시 없는 키는
  정확일치만(광역 오탐 방지), 생년월일이 다르면 prefix 가 달라 매칭 안 됨. (같은 출생정보면 사주
  차트·풀이 내용은 이름과 무관하게 동일하므로 같은 리포트로 본다.)
- `product-entitlements.ts`: `listProductEntitlementsByProduct(userId, productId)` 추가 → 정확일치
  MISS 후 저장 lifetime-report 이용권을 스캔해 `lifetimeReadingKeyMatches` 로 매칭. credit_transactions
  폴백도 같은 매처로 교체.
- 재현+회귀 테스트 3건(`report-entitlements.test.ts`): 이름 유무로 키 갈림 / 정확일치 MISS / 수정이
  드리프트 흡수·다른 차트 거부. typecheck 0 · 전체 1186+189 green.

### 미해결/주의
- ⚠️ **월간달력·올해핵심 이용권도 같은 readingKey 스코프**(`buildMonthlyCalendarScopeKey`·
  `buildYearCoreScopeKey`) → 동일 이름 해시 드리프트 잠재버그. 이번엔 lifetime 만 수정, **후속 필요**.
- ⚠️ 사용자의 실제 케이스가 **이용권 행 삭제(환불 오탐 #632 회수 경로)** 라면 이 수정으로 못 살림
  (매칭할 행이 없음) → 재부여 필요. 확정하려면 승인 하에 해당 이용권/reading 데이터 확인.
- Premium 멤버십에도 PDF 허용할지는 별도 결정(현재 lifetime 구매자 전용 게이트).

---

## 2026-07-21 세션 (Claude) — P1 지표/표시 결함 3종 (어제 감사 잔여)

> 어제 감사에서 남긴 P1 3건을 systematic-debugging 으로 각각 근본원인 확정 후 최소 수정.
> 병렬 조사(Explore ×3)로 파일·코드·대조군을 먼저 확보 → 결함마다 회귀 테스트 신설(2 파일).
> 검증: `typecheck` exit 0 · unit 전량 green(회귀 4건 포함) · 손댄 파일 8 + 신규 테스트 2.

### ① /pricing·/membership 취소선(compare-at) 미렌더
근본원인: 두 페이지(서버 컴포넌트)가 `priceLabelFromMap` 만 읽고 `compareLabel` 을 **안 읽음**
(ComparePrice import 자체 없음). 데이터(catalog.compareAt → compareLabel "9,900원"/"69,000원")는
priceMap 에 정상 유입 — 읽는 코드가 없어서 안 보였다. 작동 대조군(score-lock-gate·gangi-market·
premium/deep)은 전부 `<Price>` 옆에 `<ComparePrice line-through>` 를 명시 배치.
- 서버용 순수 헬퍼 `compareLabelFromMap(map,key)` 로 각 가격 옆에 line-through span 렌더.
- pricing: taste 단품 — `GangiListLink` 에 `compareLabel` 슬롯 신설(price 를 flex-col wrapper 로
  감싸 취소선을 가격 위에, 레이아웃 유지). membership: 소액 풀이 taste 칩 + 보관형 리포트
  (lifetime_report). 멤버십 플랜·hero 는 compareAt 없어 제외(죽은 마크업 회피 — catalog 전수 확인).
- 회귀 가드: `price-display-shared.test.ts` — product_prices 0행(빈 리졸버)이어도 catalog.compareAt
  로 취소선 라벨이 조립됨을 못박음(taste 9,900 / lifetime 69,000 / 멤버십 null).

### ② push-ctr·web-push-status 지표 0 (RLS deny)
근본원인: 두 API 라우트가 **인증 가드용 anon 클라이언트(`createClient`)를 집계 쿼리에도 재사용**.
notification_delivery_logs·push_subscriptions 의 RLS 는 `auth.uid()=user_id`(본인 행만, migration
004)라 관리자가 자기 행만 보고 0. 대조군(push-ab-policy·analytics·metrics rollup)은 인증만 anon,
집계는 `createServiceClient`. → 메모리 원칙 "집계=service 필수" 위반.
- 집계를 service role 로 교체 + `hasSupabaseServiceEnv` 가드. **정책 변경 아님**(의도된 사용자 격리).
- web-push-status 는 env 진단이 주 목적이라 service env 없어도 env 는 반환(집계만 조건부 skip,
  `env.hasServiceEnv` 로 상태 노출).

### ③ 결제 전환율이 '시도 0건'을 0.0% 로 표시
근본원인: `payment-funnel-stats` 의 rate 4종(overall/confirmSuccess/prepareBlock/confirmFail) +
byPackage.conversionRate 가 분모 0 일 때 `:0` fallback. 렌더 포맷터(page.tsx `?? 0`,
dashboard `value:number`)도 null→0 강등. 대조군 `analytics-metrics` 의 `rate()` 는 분모 0→null,
`formatPct` 는 null→'—'(무트래픽 선끊김). payment-funnel 만 null 계약이 없었다.
- 계산: `rate(numer,denom)=denom>0?numer/denom:null` 헬퍼로 통일, 타입 `number|null`.
- 렌더: 두 `fmtPct` 를 null→'—'(대조군과 동일). 소비처는 이 두 파일뿐(타입 파급 확인).
- 회귀 가드: `payment-funnel-stats.test.ts` — 시도 0건→null, 정상 분모→정확 비율, 패키지 시도0→null.

### 미해결/후속
- 결함③ 계열의 **operations-dashboard `todayConversionRate`**(결제/활동자, 분모=DAU)도 같은 `:0`
  버그이나 라벨이 '결제 전환율'이 아니고 분모가 '시도'가 아니라 이번 스코프에서 제외 — 필요 시 후속.
- 실제 브라우저 렌더 확인은 dev 서버 미기동(env 접근 sandbox 차단)으로 생략. 취소선은 데이터 계약
  테스트 + JSX 조건부 렌더 + typecheck 로 논리 완결(프로덕션 product_prices 0행 = 빈 리졸버 케이스).

---

## 2026-07-20~21 세션 (Claude) — 가격·판매 정리 · 결제 UI · 지표 UX

> 앞 세션(계측·결제 정합)에서 이어짐. 사용자가 폰으로 화면을 훑으며 나온 후속 요청들.

### ⑧ 점수 언락 3,300 통일 + 묶음 판매 중단 (86bd14f8)
사용자: "점수 왜 6,600? 3,300 으로 바꿔야 할 듯". 6,600 이던 건 서열 때문이었다 —
묶음(9,900) ≡ today-detail(3,300) + 점수 언락 이라, 점수를 3,300 으로 내리면
따로 사기 합계가 6,600 이 돼 **묶음이 3,300원 더 비싸지는 역전**(가드 2건 red 로 확인).
→ 사용자 판단으로 **묶음 자체를 판매 중단**(B안). 제약이 사라져 3,300 통일.
- premium-lock-card '단품 vs 묶음' 비교 블록 제거 → 단품 단독 CTA 로 수렴. bundleHref 제거.
- prepare 가드: bundle_today_set → 410(bundle_retired). 카탈로그 정의는 유지(이용권·과거주문 조회).
- 서열 가드 3종(묶음 파는 전제) 폐기 → "단품 전부 동일가" + "묶음 차단 가드 살아있나"로 대체.
- 실측: 묶음 성공결제 0건, 이용권 6건 전부 내부 테스트 계정.

### ⑨ 궁합 전역권(love-question=연애 마음 확인) 판매 중단 (5f691aee·ff7862b0)
발단: "3,300 궁합인데 9,900 결제화면". 원인 2개 —
① CTA 는 플래그로 상품이 갈리는데 **가격 표시는 taste_love_question 고정**(버튼 3,300/청구 9,900).
② compat-reading 도 3,300 이벤트 누락 → 전역권 3,300 vs 커플권 9,900, **좁은 권한이 3배 비싼 완전 열위**.
⚠️ **메모리 정정**: COMPAT_PER_COUPLE_PRICING 을 "미활성"으로 알고 있었으나 **프로덕션 ON**이었다
(42일 전 설정). 인덱스 한 줄이 본문과 모순 → 정정.
정렬 후: 둘 다 3,300 이면 전역권을 팔 이유 없음 → **전역권 판매 중단**(사용자 A안).
- love-question 은 이름만 다른 우회로였다(사면 grandfather 로 **모든 커플 영구** 열람).
- moonlight TASTE_PRODUCTS·홈 카드 priceKey·궁합 CTA 전역권 폴백 제거 + prepare 410(love_question_retired).
- **판매 중단 ≠ 열람 차단** — grandfather·카탈로그 정의 유지(가드 6종이 이 구분까지 고정).
- 실측: 전역권 보유자 0명.

### ⑩⑪ 결제 CTA 하단 고정 + 동의 배너 최상단 이동 (4d14a1c4·f4c920bf·9f06f210)
두 요청이 사실 한 문제였다 — **하단 자리 다툼**.
- 결제 CTA 4종(사주 점수·대운·택일·궁합)을 StickyBottomBar(above-dock)로 상시 노출.
  ⚠️ 그냥 fixed 금지 — page-transition transform 이 containing block 을 가로챈다
  (body portal + dock 높이 실측하는 기존 컴포넌트 재사용, project_fixed-cta-needs-body-portal).
- 동의 배너가 같은 above-dock 자리라 **겹침** → 배너를 **최상단 인플로우**로. 선택하면
  그 공간이 통째로 사라진다(183px 소멸 실측). 인플로우라 body portal 불필요.
- 후속: 문구·글씨 축소(183→114px, 의미요소 4개 유지). 결제 바는 **스크롤 내릴 때만** 노출
  (revealOn='scroll-down', opt-in — 체크아웃·예약 등 "지금 해야 하는" 바는 always 유지).
  8px 임계값(떨림 무시)·최상단 120px 숨김(인라인 카드와 중복 회피).
- 부수: 점수 결제 카드가 세로로 길어지자 **섹션 밖으로 잘림**(스켈레톤 흐름/카드 absolute).
  스택 반전 — 카드가 높이 정하고 스켈레톤이 배경(실측 섹션 426>카드 376).

### ⑫ 관리자 방문지표 단일화 + 크롤러 클램프 + 유입 카드 (464c5c63~0d9952b1)
사용자: "자체순방문·GA4활성·GA4PV·VercelPV 가 다 제각각이라 헷갈린다. 뭐가 정확하냐."
**넷은 서로 다른 걸 센다 — 같아질 수 없다**: 자체=사람(봇·내부 제외) / GA4활성=동의한 사람 중
머문 사람(이중필터) / PV 2종=사람 아닌 **열람 횟수**(1인 3~4회라 배수로 벌어짐).
GA4 가 유독 적은 건 버그 아님 — Consent Mode 기본 denied(개인정보 설정이 제대로 된 결과).
- 기준값 = **자체 순방문**(동의 무관 전원 집계 + 봇 제외 + 결제·가입과 같은 DB 라 퍼널 연결).
  GA4·Vercel 화면에서 숨김(수집은 유지, 원본은 /admin/analytics; Vercel 은 집계死 감시용).
- 크롤러구간(7/19 이전) 표시 클램프: **VISIT_TRACKING_START_KEY='2026-07-19'**.
  ⚠️ 자르는 건 **표시 계층뿐** — 데이터 함수에 넣었더니 고정 NOW 테스트 4건 깨짐(날짜 종속 회피).
  크롤러 행 롤백은 SQL 로 실행 완료(2,540행 삭제, 백업 site_visits_crawler_archive_20260719 보존).
- **유입 상위 카드** 추가(자체 순방문 옆). getDailyMetrics 재사용(두 화면 숫자 갈림 방지).
  self-referral(자기 도메인) 제외 — isOwnSiteHost 로 canonical+별칭까지, '(direct)'는 유지.
  실측: link.inpock.co.kr 이 최대 유입(오늘 방문의 63%).

### ⑬ 시각 모름(3기둥) 일진점수 — 조사만, 변경 없음 (96c3d96e)
"결제하면 오늘운세 전부 보이게"는 **이미 되어 있었다**(7/18에 무료서 걷은 섹션이 유료에 다 있고
시각 없어도 채워짐). 파생 조사에서 **내 결론이 두 번 틀림** → 기록:
① "시각 모르면 점수 구조적으로 낮다" 틀림(사례 1건 일반화; 표본 246건 평균 -0.5점=편향 없음).
   진짜 특성은 **불안정성**(변화폭 중앙값 7점, 최대 ±35~38). ② "기준점으로 당기면 안정" 틀림
   (구현·측정하니 없던 하락편향 생김, 극단값 그대로 → 되돌림). **시주 없으면 4기둥 점수 복원 불가**.
결론: 편향 없으니 급하지 않음 → 산식 변경 없음. 다루려면 산식 아닌 **표현**으로(구간 표시/안내).

### 카카오 채널 링크 404 후속(운영 조치 완료)
env NEXT_PUBLIC_KAKAO_CHANNEL_ID 를 `_QVQxbX`(간지사주 공개 ID)로 교체+재배포 → 버튼 복구.
값 검증(isValidKakaoChannelId, `_`+영숫자)이 오설정을 걸러 "버튼 보이면 값 맞다"는 신호가 됨.

### ⑭ 환불이 매출에 그대로 잡히던 문제 (a6aad3b2)
사용자 제보: "9,900원 환불했는데 관리자에서 차감 안 되고 매출에 그대로".
**데이터는 맞고 조회가 틀렸다** — payment_orders(refunded)·RPC(refunded 제외 3,300)·
metrics_daily(revenue_won 9900 + **refunded_won 9900** 별도 기록)는 전부 정상.
🔴 getDailyMetrics(=/admin/analytics 조회)가 **revenue_won 만 읽고 refunded_won 을 무시**해서
화면이 매출만 그렸다. 어제 #641 에서 롤업(쓰기)은 고쳤는데 **읽기 경로가 안 따라온** 것.
→ netRevenueWon(=매출−환불) 파생, 요약카드 '매출'→'순매출'(환불 부기), 표에 환불·순매출 열.
매출·환불 원본은 보존. 이 버그가 안 잡힌 이유=환불 반영 테스트가 없었음 → 가드 2종 신설.
사용자 배포 후 순매출 정상 확인.

### 07-20 결제 누락 의혹 — 버그 아님(내 UTC 오독)
"07-20 결제 1건이 metrics_daily 에 paid_orders=0" 은 착오였다. 그 결제는 15:06 **UTC** =
익일 00:06 **KST** 라 metrics_daily 는 **07-21 에 1건 3,300원**으로 정확히 귀속했다.
내가 payment_orders.created_at(UTC 저장)을 보고 "07-20"으로 오독한 것. 시스템은 KST 축을
정확히 처리한다(자정 크론 00:10 KST 롤업 실측). 파묘할 버그 없음.

---

## 🔜 다음 세션 바로 시작용 — 남은 일 (2026-07-21 기준)

> 급한 불은 다 껐다. 아래는 "여유 있을 때" 항목. 우선순위 순.

### 데이터 관찰 (코드 아님 — 며칠 뒤)
- **방문 데이터 추세 보기**: 계측이 7/19 살아났다. 지금 하루 27명·결제 1건은 진짜 숫자지만
  표본이 작다. 며칠 쌓이면 유입(현재 inpock=인스타 60%+)·이탈·결제도달을 본다.
  → 그때 비로소 "결제율 올리기"를 근거 위에서 논의 가능.
- 백업 테이블 `site_visits_crawler_archive_20260719`(2,540행) — 문제없으면 그때 drop.

### P1 (지표가 거짓말 / 표시 결함) — 어제 워크플로 감사에서 나온 잔여
- **/pricing·/membership 이 취소선(ComparePrice)을 한 번도 안 그림**. 단품에 compareAt 다 있는데
  가격 전용 두 화면에서 사장. GangiListLink 에 compare prop 추가 + membership pill 옆 line-through.
  ⚠️ e2e/readability-visual.spec.ts 가 /membership 390px 가로오버플로 ≤1px 하드게이트 — flex-wrap 확인.
- **push-ctr·web-push-status 가 anon 클라이언트로 집계** → RLS deny 로 값 0. 형제 라우트
  push-ab-policy 는 이미 createServiceClient. 두 라우트를 service 로 전환 + max-rows(1000) 클램프 3곳
  (ORDER BY 부재 → fetchAllPages + order 로 교체). 참조 테스트 0건이라 회귀 위험 낮음.
- **결제 전환율이 "시도 0건"을 0.0% 로 표시**(payment-funnel-stats). 분모 0 → null 로,
  fmtPct 시그니처를 number|null 로 넓혀 '—' 표시(analytics-metrics 는 이미 그렇게 함 — 화면 규칙 불일치).

### 운영 판단 (코드보다 결정이 먼저)
- **CSP enforce 승격**: 허용목록은 실측 교정 완료(6360b3e5). 켜기 전 며칠 더 /api/csp-report 관찰
  (결제수단별 안 밟은 경로 존재 가능). 리포트 깨끗하면 CSP_MODE=enforce + 재배포. 켜기 전 나 부르면 재확인.
- **결제 하단 바 revealOn='scroll-down'**: 위로 스크롤 시 사라지는 게 불편하면 "인라인 카드가
  화면 밖일 때 방향 무관 상시" 로 조건 변경 가능(사용자 실사용 후 판단).
- **동의 배너 추가 축소**: 더 줄이려면 의미요소 4개(쿠키/목적/제3자/거부가능) 중 뺄 것 정해야 함.

### 미결·잠복 (건드리기 전 필독)
- **나이스페이 취소 어댑터**: 승인만 실검증됐던 스캐폴드. 취소 3관문(orderId·서명·기취소)을 오늘
  처음 끝까지 밟았다. 응답 필드명 전수 미확인(normalizeNicepayPaymentForRefund 방어적). 또 다른
  문구 나오면 refund_requests.error_message 확인(API 는 실패도 HTTP 200).
- **H-B(세션 미부착) 가설 미해결**: mr7990 이 가입 21분 뒤에도 익명 reading. 카카오 인앱 브라우저
  컨텍스트 의심. 진단 로그(85b2acf0) 심어둠 — 프로덕션에 [auth-diag] 찍히면 확정.
- **이메일 로그인은 익명 사주 귀속 미적용**(클라 signInWithPassword 라 서버 응답 없음). 실유입 9/10
  카카오라 후순위.
- **today_fortune_feedback 수집 중단**: 무료 화면서 TodayFeedbackCard 제거로 ML 학습데이터 유입 끊김.
  필요하면 유료 detail 화면으로 옮겨붙일 것.

---

## 2026-07-19~20 세션 (Claude) — 🔴 계측·결제 정합 대수술

> 발단은 사용자 한마디였다: **"만든지 세 달이 다 되어가는데 실유저는 단 한 명도 결제를 하지 않았어."**
> 결제 버튼을 손대려다 **결제 도달자가 애초에 0명**임을 확인했고, 거기서부터 파고들었다.

### ① 방문 집계가 실사용자를 **한 명도 센 적이 없다** (5a06e9c3)
`shouldSkipVisitAnalytics` 가 "우리 사이트인가"를 `NEXT_PUBLIC_SITE_URL` 로 판정했는데,
프로덕션 값이 `https://xn--s39at50bo6fmwa.kr`(간지사주.kr 퓨니코드)였다. 사용자는 canonical
(ganjisaju.kr)에 있으므로 **항상 불일치 → 전량 폐기**. 클라이언트(VisitPing)도 같은 env 로
선판정해 **비콘조차 발사되지 않았다**.

실측(수정 전): `POST /api/visit` (정상 Android UA) → `{"skipped":"non_canonical_host"}`
남아 있던 2,540행(07-04~07-09)은 퓨니코드 도메인을 긁던 **크롤러** — 그래서 전 행이
`page_views=1` 로 균일했다. 봇 필터(#635) 후 0행이 된 것을 "필터가 과했나"로 오해했으나,
실제로는 **사람 경로가 처음부터 막혀 있었다.**

수정: 판정을 코드의 도메인 목록(`isOwnSiteHost`)으로. **`siteUrl` 입력 통로 자체를 제거** —
통로를 남기면 env 가 또 어긋날 때 재발한다.
배포 2분 뒤 실사람 2명이 **각각 5페이지**씩 기록됐다(이 DB 최초의 `page_views>1`).

⚠️ 과거 크롤러 행 되돌리기: `docs/crawler-visits-rollback.sql`(백업→삭제→롤업 백필, 수동 실행).
판정 근거는 **1인당 페이지뷰** — 크롤러 구간 정확히 1.00 vs 수정 후 4.6.

### ② 가입해도 계정이 텅 빈다 — 실유저 8/10 증발의 원인 (388d4a84)
워크플로 조사(발견 12건 중 **11건 반증**). 내 "06-30 코드 회귀" 가설도 반증됐다.
결함 3개가 한 지점에서 만난다:
- **A** 가입이 `profiles` 를 안 만듦 — `handle_new_user()` 는 `user_credits` 만 INSERT
- **B** 소셜 콜백도 안 만듦 — `if (profile && !profile.display_name) update` 는 **UPDATE 전용**.
  신규 가입자는 행이 없어 통째로 no-op → 카카오 심의까지 받아 수집한 이름이 매번 버려졌다
- **C** 익명 사주가 계정에 안 붙음 — `ensureReadingOwnedByUser` 의 **유일한 호출처가 결제 이행**.
  즉 **돈을 낸 사람만 자기 사주를 가질 수 있었다**

경로: 익명으로 사주 봄 → 벽에서 가입 → 돌아왔는데 **방금 본 사주가 없고 프로필도 빈칸** → 이탈.
수정: 콜백에서 profiles 부트스트랩 + 익명 사주 귀속(httpOnly 영수증 쿠키로 **본인 것만** claim).
⚠️ **함정**: 부트스트랩을 `if (contact.phone || contact.name)` 안에 넣으면 무효 —
현재 scope 가 openid 뿐이라 그 값들이 거의 항상 null 이다. 연락처 수집과 분리해야 한다.
실기기 검증: 12:57:08 익명 생성(그 시점 `/api/kakao/contact` 401) → 로그인 후 소유자 부여 확인.

### ③ CSP enforce 로 켰으면 결제가 죽는 상태였다 (6360b3e5)
인벤토리가 2026-06-21 **토스 시절** 기준. 그 뒤 PG 가 나이스페이로 바뀌고 카카오 SDK·광고가 붙었다.
report-only 라 아무도 못 느꼈다. 실측 위반: `form-action pay.nicepay.co.kr`(결제창 제출),
`script-src pay.nicepay.co.kr/v1/js`(SDK), `t1.kakaocdn.net`(20건), `analytics.google.com`(76건).
⚠️ 와일드카드 함정: **`*.analytics.google.com` 은 apex 를 매치하지 않는다** — 목록에 있는
것처럼 보여 더 안 잡혔다. 가드 5종 신설(나이스페이를 빼면 red 가 되는 것까지 실제로 확인).

### ④ 관리자 환불 — 관문이 **셋**이었다
사용자 제보 "환불처리가 안 됨". 진단이 늦은 이유: 이 API 는 실패도 **HTTP 200 + `{ok:false}`** 라
로그엔 200 만 찍힌다. **실패 사유는 `refund_requests.error_message` 에만 남는다.**

| | PG 응답(원문) | 원인 | 커밋 |
|---|---|---|---|
| 1차 | "orderId 필수입력항목이 누락되었습니다" | 취소에 orderId 미전송(타입이 `orderId?:` 라 컴파일 통과) | 9a1e9708 |
| 2차 | "SIGN DATA 검증에 실패하였습니다" | 취소가 **승인용 서명 공식** 재사용. 취소는 `sha256(tid+ediDate+secret)` — **금액 없음** | fddad668 |
| 3차 | "해당거래 취소실패(기취소성공)" | 이미 취소됨 백스톱이 토스 문구만 알고, 조회도 토스만 하고, 판정기도 토스 스키마만 이해 | f5aa3ac5 |

3차 시점 실제 상태: **돈은 환불·이용권도 회수됐는데 장부만 failed**(주문 `canceled`, `refunded_at` NULL).
가드에서 가장 중요한 건 "**무관한 실패를 이미-취소로 오인하지 않는지**" — 과매칭하면
환불 안 된 건을 완료로 기록해 훨씬 나쁘다.

### ⑤ 가격 정합 + 전달물 없는 상품 (9a1e9708 · ab737889 · 5f691aee)
- 3,300원 이벤트가 **단품 6종 중 2건(money-pattern·work-flow)을 누락** → 사용자가 화면 보고 발견.
  "형제는 같은 가격" 불변식을 가드로 고정(손으로 훑는 방식은 실패한다는 증거).
- 그런데 그 둘은 **결제만 되고 여는 게이트가 앱 전체에 0곳**이었다(`getTasteProductEntitlement`
  호출 26곳 중 0). 착지도 빈 입력폼. **인하가 문제를 키웠다**(최저가 티어로 올라감). 실구매자 0명.
  → today-detail 이 이미 계산하는 5주제 중 재물·직장 슬라이스로 연결(새 화면 없이).
- 궁합: 표시가 3,300(love-question) ↔ 청구 9,900(compat-reading) **분기 어긋남** + compat-reading 도
  이벤트 누락. 정렬 후 "**좁은 권한이 전역권보다 비싸지 않다**" 가드 추가.

### ⑥ 궁합 전역권(love-question) 판매 중단 (ff7862b0)
전역권은 1회 결제로 **모든 커플 영구** 해제인데 커플권과 같은 3,300원 → 커플권 완전 열위.
`hasCompatibilityAccess` 의 grandfather 가 전역권 보유자를 무조건 통과시키므로,
전역권을 계속 팔면 **커플 단위 과금이 통째로 무의미**해진다.
⚠️ 이 상품은 화면에 **'연애 마음 확인'이라는 다른 이름**으로 팔리고 있었다(사실상 우회로) —
진행 전 확인받고 내렸다. 중단 시점 보유자 0명.
**판매 중단 ≠ 열람 차단** — grandfather·카탈로그 정의는 유지(가드가 이 구분까지 고정).

### ⑦ 카카오 채널 링크 404 (f910f94d)
`NEXT_PUBLIC_KAKAO_CHANNEL_ID` 에 공개 ID 대신 **채널 이름('간지사주')** 이 들어가 있었다.
사용자가 붙여준 링크 `pf.kakao.com/%EA%B0%84%EC%A7%80%EC%82%AC%EC%A3%BC/friend` 가 확정 증거.
형식(`_`+영숫자) 검증 → 틀리면 **미설정 취급(버튼 미노출)**. 깨진 버튼보다 없는 버튼이 낫다.
⚠️ **운영 조치 대기**: Vercel 값을 `_QVQxbX` 로 교체 + 재배포(사용자가 직접 하기로).
   `NEXT_PUBLIC_` 은 빌드 시점 인라인이라 **재배포 필수**. 버튼이 보이면 값이 맞다는 신호.

### 이 세션이 남긴 패턴 — **env 를 코드가 검증하지 않으면 조용히 깨진다**
하루에 세 번 반복됐다: `NEXT_PUBLIC_SITE_URL`(방문 집계 전멸) · `COMPAT_PER_COUPLE_PRICING`
(메모리 인덱스에 '미활성'으로 잘못 적혀 있어 오판) · `NEXT_PUBLIC_KAKAO_CHANNEL_ID`(링크 404).
**"우리 도메인인가 / 우리 채널인가"는 배포 환경변수가 정할 문제가 아니라 코드가 아는 사실이다.**

### 조사만 하고 **변경하지 않기로 한 것** — 시각 모름(3기둥) 일진 점수
"결제하면 오늘운세 전부 보이게"는 이미 되어 있었다(7/18에 무료에서 걷어낸 섹션들이 유료
`오늘 자세히 보기` 로 전부 옮겨져 있고, 시각을 몰라도 8영역 내역·행운패키지·명식이 다 채워진다).

파생 조사에서 **내가 낸 결론이 두 번 틀렸다** — 기록해 둔다(같은 걸 다시 파지 않도록).

1. **"시각 모르면 점수가 구조적으로 낮다"는 틀렸다.**
   사례 하나(30점 → 6점)를 보고 일반화했는데, 표본 246건으로 재보니
   **평균 변화 -0.5점**(하락 46% / 동일 18% / **상승 36%**). 편향은 없다.
   그 사례는 시주 午 가 화(火)의 **유일한 출처**라 화가 12.9% → 0% 가 된 특수 케이스였다.
   진짜 특성은 편향이 아니라 **불안정성**: 변화폭 중앙값 7점, 최대 -35 ~ +38점.
   (오행 0% 발생률 18% → 42%)

2. **"기준점(50)으로 당기면 안정된다"도 틀렸다.** 실제로 구현해 측정했더니
   평균 -0.5 → **-2.5점**(없던 하락 편향이 생김), 10점 이상 하락 15% → **27%**,
   극단값은 -35/+38 → -35/+35 로 **거의 그대로**, 변화폭 중앙값 7점 **개선 없음**. → 되돌렸다.
   이유: 줄이려던 건 "3기둥 점수 분포의 폭"이 아니라 "같은 사람의 4기둥 ↔ 3기둥 **차이**"였다.
   4기둥 점수가 50에서 먼 사람은 3기둥 점수를 50 쪽으로 당길수록 **오히려 멀어진다**.
   **시주가 없으면 4기둥 점수는 복원 불가** — 3기둥 점수는 "덜 정확한 같은 값"이 아니라
   애초에 **다른 추정치**다. 상수 배율로는 진실에 가까워지지 않는다.

결론: 편향이 없으므로 급한 결함이 아니다 → **산식 변경 없음**(사용자 판단).
나중에 다루려면 산식이 아니라 **표현**으로 — 점수 대신 구간 표시(구간 폭의 근거 = 실측
변화폭 중앙값 7점) 또는 "시각을 입력하면 더 정확해집니다" 안내.
참고: 최근 30일 사주 185건 중 **86건(46.5%)이 시각 모름** — 표현을 바꾸면 영향 범위는 크다.

### 미해결 / 다음
- **P1**: `/pricing`·`/membership` 이 취소선을 한 번도 안 그림 · push-ctr·web-push-status 가
  anon 클라이언트로 집계해 RLS 에 막힘(값 0) · 결제 전환율이 "시도 0건"을 0.0% 로 표시
- CSP enforce 승격은 **며칠 더 리포트 관찰 후**(결제수단별 미밟은 경로 존재 가능)
- 크롤러 행 롤백 SQL 수동 실행 + metrics_daily 백필
- 나이스페이 어댑터는 승인만 실검증된 스캐폴드였다 — 취소 경로를 오늘 처음 끝까지 밟았다

---

## 2026-07-19 세션 (Claude) — 메인 카드 구조 개편 + **제목색 대비 계산 오류 수정**

### 카드 구조 개편 (5차 — 사용자: "제목만 카드에 남기고 가격·서브는 하단에")
- 3:4 세로 사진 → **정사각**, 사진 위에는 **제목만**, 가격·부제는 사진 **밖(흰 배경)** 으로.
- 동기(실측): 기존 카드에서 텍스트 스택이 **카드 높이의 54%(125/233px)** 를 덮고 있었다.
  세로 사진을 쓰면서 아래 절반을 그늘막·글자로 가린 셈 = 인물 사진값을 절반만 쓰는 구조.
- **총높이 유지**가 핵심: 글자를 밖으로 빼는 만큼 사진을 줄여 카드 233→**234px**,
  그리드 979→985px. 스크롤 비용 없이 사진은 온전히 보이고 글자는 흰 배경에서 읽힌다.
- 얼굴 잘림 금지(사용자 조건): 원본이 전부 560×720 이라 `object-top` 정사각 크롭은 위 77.8%.
  얼굴은 머리끝 0.8%~턱 ≈29% 구간 — **8장 전수 크롭해 눈으로 확인**.
- 부수 효과: 가격·부제가 흰 배경으로 나오면서 그늘막·그림자·외곽선이 불필요해졌고,
  취소선(9,900원)도 회색으로 정리돼 8개 가격을 훑기 쉬워졌다.

### 🔴 제목색이 안 보이던 버그 — 대비를 **잘못된 배경**에 대고 계산했다
사용자 제보: "사주·간단운세·꿈해몽 글씨색이 잘 안 보여". 지목된 3개는 **팔레트에서 가장
어두운 3색 그대로** — 우연이 아니라 계산 기준이 틀렸다는 신호였다.

**원인**: 8색을 고를 때 대비를 **원본 사진**의 밴드 평균색에 대고 계산했다.
  그런데 사진 위에는 이미 비네팅이 깔려 있다 —
  `linear-gradient(to top, rgba(12,7,14,.86) → transparent 62%)`.
  즉 글자가 실제로 놓이는 배경은 사진이 아니라 **어두운 스크림**이다.
  배경이 밝은 사진(꿈해몽 L=.88 · 간단운세 .71 · 사주 .69)에 대해 최적화가
  "어두운 글씨"를 내놨고, 렌더에서는 **어두운 스크림 위 어두운 글씨** = 묻혔다.

**검증**: 스크림 합성 후 배경으로 기존 8색 재측정 →
  간단운세 2.23 · 꿈해몽 2.32 · 사주 2.65 (최하위 3개) / 나머지 5개 4.12~6.38.
  **3:1 미만인 것이 정확히 사용자가 지목한 3개**. 지각과 수치가 완전 일치 → 원인 확정.

**수정**: 대비 기준을 **스크림 합성 후** 배경(글자가 놓이는 하단 6~28% 띠의 밝은쪽 85퍼센타일)
  으로 바꾸고, "**8색 전부 밝은색 + 서로 다른 색상 계열**"(흰/노랑/주황/분홍/보라/하늘/민트/라임)
  제약 아래 최저 대비를 최대화. 최저 **2.23 → 4.27** (큰 글씨 기준 3:1 충족).
  전부 밝아지면서 기존 어두운 그림자·외곽선이 이제 실제로 글자를 띄워준다.
  → 사주 #FFFFFF(5.37) · 대운 #FFC08A(4.98) · 택일 #7CF0C4(4.27) · 궁합 #9FE4FF(4.56) ·
    간단운세 #FFE066(4.38) · 타로 #FFB3DA(7.79) · 꿈해몽 #D6FF6E(4.50) · 대화상담 #D9BFFF(5.31)

⚠️ **재발 방지**: 사진·제목 위치·스크림 중 하나라도 바꾸면 대비를 **합성 후 배경**에 대고
  다시 계산할 것. 산출 근거와 이번에 틀렸던 이력을 `gangi-market.ts` 의 `titleColor` 주석에 고정.
  (교훈: 텍스트 위에 겹겹의 레이어가 있으면 "대비 계산의 배경"은 자산이 아니라 **합성 결과**다.)

**검증**: tsc · build · 커스텀러너 1142 · E2E 53 통과. 렌더 8색 실측 + 시각 확인 + 사용자 실기기 확인 완료.

---

## 2026-07-19 세션 (Claude) — 메인 카드 제목 개편 + **모바일 터치 스크롤 사망 수정**

### 🔴 모바일 터치 스크롤이 아예 안 되던 버그 (사용자 제보: 회사폰 6대 전부)
systematic-debugging 으로 추적. **원인 사슬 3단계**:
1. 푸터 사업자정보 행이 ≤360px 화면에서 가로 19px 넘침
   (`dt` 는 `minWidth:106`+nowrap 인데 `dd` 에 `min-width:0` 이 없어 flex 아이템이 안 줄어듦)
2. 그 넘침을 가리려고 `@media(max-width:767px){ html, body { overflow-x:hidden } }` 투입
3. **`overflow-x` 를 지정하면 CSS 규칙상 반대 축이 `visible`→`auto` 로 강제** →
   html·body 가 **둘 다 스크롤 컨테이너**가 되고 터치 팬이 어느 쪽에도 전달되지 않음

**진단이 어려웠던 이유**: `window.scrollTo` 는 멀쩡히 동작한다 → 기존 E2E 가 전부 통과했다.
  **실제 터치 이벤트로만 재현**된다. 데스크톱은 미디어쿼리 밖이라 증상 없음.

**수정**: 푸터 넘침 자체를 제거(`dd` 에 `min-width:0`+`overflow-wrap`, 법적 고지 문구는 무수정)
  → 가로 넘침 0 실측(6개 라우트) → CSS 는 `html` 만 클립.
  ⚠️ `body` 만 남기는 안은 실패 — 넘침이 남으면 **모바일 레이아웃 뷰포트가 넓어져**
  (`innerWidth` 360→379) `fixed` 모달·하단바가 화면 밖으로 나간다(system-guide 스펙이 잡아냄).
  `overflow-x: clip` 도 대안이 아니다(실측: 그래도 막힘).

**회귀 가드 신설** `e2e/mobile-touch-scroll.spec.ts` — CDP 실제 터치 스와이프 +
  html·body 동시 스크롤 컨테이너 금지 단언. **수정 전 2건 실패 → 수정 후 2건 통과** 확인 후 반영.

**검증**: tsc·build·커스텀러너 1142·E2E 50 passed/3 failed.
  남은 3건(배너 가로스와이프·알림채널 2)은 CSS stash A/B 로 **기준선에서도 실패**함을 확인
  (기준선 4 → 수정후 3, 신규 실패 0). 사용자 실기기 확인 완료.

### 메인 카드 제목 개편 (4차 반복)
- 하단 배지 → 사진 위 오버레이 밴드 → 독립 헤더 행 → **최종: 금액 위·배경판 없음·가운데 정렬**.
- 중간 반려 사유가 설계에 그대로 남음: ①오버레이 밴드는 **인물 얼굴을 가림**(사진마다 얼굴
  높이가 달라 위치 조정으로는 해결 불가) ②길이별 크기 분기는 **크기 통일** 요구와 충돌.
- 크기는 전 카드 통일(`clamp(21px, 24cqw, 50px)`). cqw 로 카드 폭에 비례 → 데스크톱에서도 큼.
  ⚠️ **통일 크기의 상한은 가장 긴 제목이 결정한다** — 긴 제목 하나가 나머지 카드까지 작게 만든다.
- 그래서 제목 단축: '한 단어 꿈해몽'→'꿈해몽', '질문 하나 대화상담'→'대화상담', '딱 3장 타로'→'타로'.
  ⚠️ 20260718 PPTX 의 "무료 제한을 제목에 노출" 뉘앙스는 빠졌다. 되살리려면 부제로 옮길 것.
- 배경판 제거에 맞춰 비네팅을 radial → 하단 방향 그라데이션으로 교체(글자 영역만 어둡게).

### 이미지로 카드를 제작하는 안(사용자 문의)에 대한 판단
**반대** — 오늘만 제목이 3번, 가격이 3번 바뀌었다. 이미지였다면 매번 디자인 왕복이다.
  실제로 로고·배너의 각인 가격 때문에 크롭·재조판을 했고, 배너는 원본 폰트가 없어 근사치로만 복원됐다.
  그 외 검색 색인·접근성·A/B 불가. **권장: 그림(인물·배경·장식)은 이미지, 글자(제목·가격)는 코드.**

---

## 2026-07-19 세션 (Claude) — 3,300원 이벤트 잔여 정합(배너 이미지 · 전 차감량)

> 7/18 이벤트가 **KRW 축에만** 반영돼 있어 남아 있던 ①배너 각인 가격 ②전(코인) 축을 마감.
> 전수조사는 4각도 병렬 + 발견 건별 적대적 반증(52건 중 6건만 생존)으로 수행.

### 배너 이미지 (①)
- `banners/saju-9900.{png,webp,avif}` 의 "9,900원" → "3,300원" 재조판.
- 원본 디자인 폰트가 구글폰트에 없어(IoU 최고 0.73) **숫자만 Gothic A1 Black 으로 재조판**하고
  **'원' 글자는 원본 픽셀 그대로 유지**(변경 0px 검증) — 한 숫자 안에서 폰트가 섞이는 것보다
  숫자 전체를 한 폰트로 통일하고 한글만 원본을 남기는 쪽이 덜 티난다.
- 실측 후 맞춤: stroke 16px · cap height 72px · 폭 261px 고정(레이아웃 보존) ·
  세로 그라데이션 #7AAC45→#449846 · 배경 순백(패치 후 비초록 비백색 픽셀 0 = seam 없음).
- 파일명·id `saju-9900` 은 **가격이 아니라 배너 식별자**라 유지(추적 연속성).
  alt/title 을 이미지 실제 문구와 일치시킴(기존 "내 사주 풀이"는 이미지의 "내 운명 확인"과 불일치였음).

### 전(코인) 차감량 (②) — 리터럴 → 카탈로그 파생
- `CREDIT_COSTS` 가 카탈로그와 import 링크 0인 리터럴이라 자동 정합이 안 됐다. 그 결과
  **같은 상품이 카드 3,300원 vs 전 10개(명목 9,900원)로 3배 괴리** —
  `deduct.ts` 가 명문화한 "전 결제 = 직접결제 대비 우대" 의도가 정확히 역전돼 있었다.
- `src/lib/credits/costs.ts` 신설(순수 모듈 → 클라도 import 가능).
  **전 차감량 = floor(상품가/990), 최소 1전.** detail_report·calendar 3전,
  compat 은 매핑 상품이 여전히 9,900원이라 10전 유지.
  **이벤트 종료로 가격이 복귀하면 자동으로 10전 복원**된다.
- 내림(3전=2,970원)을 택한 근거: 올림 4전은 3,960원 상당이라 카드가보다 비싸져 의도가 또 뒤집힌다.
  floor(9900/990)=10 이라 기존 정책과도 무모순.
- `deduct.ts` 는 re-export 로 축소. server-only import 때문에 클라가 못 쓰던 것이
  표시값 하드코딩 5곳으로 번진 근본 원인이었다.

### 함께 고친 기존 버그 (이번 변경과 무관하게 이미 깨져 있던 것)
- **`today-fortune-audit.ts:197·205` 가 `coinCost === 1` 단언** — 2026-06-26 에 실제값이 10 이
  된 뒤 갱신되지 않아 **두 체크가 상시 red**. 파생 비교로 교체.
  테스트가 `checks[].ok` 를 단언하지 않아 "테스트 green / 검증페이지 red" 가 은폐됐던 것도
  ok 단언 추가로 차단.
- **`fortune-calendar-panel.tsx` 가 "2전" 하드코딩**(실제 차감 10전) — 5배 과소표시.
  서버가 이미 내려주던 `payload.coinCost` 사용으로 교체.
- **`credits/page.tsx` 의 "연애 마음 확인 10전"** — compat 은 전 차감 호출부가 0건이라
  **존재하지 않는 결제 경로를 안내**하고 있었다. 실제 전이 쓰이는 항목만 파생값으로 노출.
- `today-premium-panel.tsx` 의 '✦ 10전' 배지 제거(언락 완료 후에만 렌더되는 화면).
- `audit-user-entitlements.mjs` 의 550/990/1,900원 라벨(두 세대 stale) — 금액 문자열 제거.

### 게이트 / 남은 일
- 통과: `tsc` · `build` · 커스텀러너 186 · vitest 204. `costs.test.ts` 신설로
  파생 관계 + "전이 카드보다 비싸지지 않는다" 불변식 회귀 가드.
- ~~⚠️ **`bundle_today_set` 19,800원 미해결**~~ → **해결**: 할인특가 **9,900원**(취소선 19,800).
  실가치(today-detail 3,300 + 점수언락 9,900 = 13,200) 대비 25% 할인이자 단품 3,300 × 3 배수 정리.
  앵커는 직전 실판매가 19,800 — 구성품 명목합(52,800)은 score-factor 가 inert(개별 판매 안 됨)라
  못 사는 가격을 원가로 표시하게 돼 부당표시 소지가 있다.
  **묶음 compareAt 은 원래 렌더 소비처가 0곳**이라 취소선이 안 보였다 → 묶음 CTA 에 ComparePrice 추가.
  덤으로 구성품 개수 오표기('7종'·'점수 6종' → 실제 entitlement 6개·점수 5항목) 수정.
- ~~⚠️ **묶음 9,900 = `taste_score_total` 9,900 동가 → 묶음이 strictly dominant**~~ → **해결**:
  score-total **9,900 → 6,600**(취소선 9,900). 서열 복원 = 단품 3,300 < 점수 6,600 < 묶음 9,900.
  원인은 `score-unlock-access.ts:79` grandfather 가 묶음의 score-factor F1~F5 를 점수 언락으로
  인정해 **묶음 ≡ today-detail + 점수 언락** 이 되는 것.
  ⚠️ **6,600 은 정확히 손익분기**: 따로 사기 3,300 + 6,600 = 9,900 = 묶음가라 묶음의 절약액은 0원이다.
  묶음은 "더 싸서"가 아니라 **한 번 결제로 둘 다**라는 편의로 존재한다(CTA 문구도 편의 소구).
  실제 할인폭을 주려면 score-total > 6,600(7,700 → 묶음 10% 절약), 6,600 미만이면 이번엔
  묶음이 따로 사기보다 비싸져 열위가 뒤집힌다. → **가격 정책 판단이 필요하면 이 값만 조정**.
- **가격 서열 회귀 가드 신설**(`pricing-hierarchy.test.ts`): 서열 · 묶음의 score-total 비지배 ·
  묶음 ≤ 구성품 합계 · 취소선 > 현재가. 이 불변식이 **두 번 깨졌다**(①단품 인하로 묶음이 실가치 초과
  ②묶음 인하로 score-total 완전열위) — 둘 다 "가격 하나만 바꾸고 관계를 안 본" 탓이라 관계를 고정.
- ⚠️ **취소선은 렌더를 따로 붙여야 보인다** — `compareAt` 을 카탈로그에 넣어도 `<ComparePrice>`
  소비처가 없으면 화면에 안 나온다. 묶음·score-total 둘 다 이 함정을 겪어 CTA 에 직접 추가했다.
- 테스트 수치 정정: 커스텀러너의 실제 카운트는 **1142**다(직전 커밋들이 적은 186 은 별도 리포터 값).
- ⚠️ 파생 기준은 **카탈로그 기본가**다. `/admin/pricing` 런타임 오버라이드가 걸리면
  전 차감량은 따라가지 않는다(costs.ts 주석에 명시).

---

## 2026-07-18 세션 (Claude) — 20260718 PPTX 수정안 전면 적용 (사주아이 벤치마크)

> 입력: `2026-07-18_ 간지사주 수정.pptx` (9슬라이드, 사주아이 벤치마크). 브랜치 `feat/pptx-20260718-revisions`.
> 확인이 필요한 7건은 진행 전 사용자 확정 후 적용(가격 범위·제한 방식·카드 순서·약관·결제상품·무료 축소범위).

### 메인 화면 (slide 2·3·4)
- **카드 순서 유료 상단으로 전환** — 사주·대운·택일·궁합을 위로, 무료 4종을 아래로. HOT 배지도 유료로 이동.
  **2026-07-04 "무료 우선" 지시를 의도적으로 되돌린 것**(무료를 먼저 보면 결제 욕구가 떨어진다는 진단).
- 유료 부제를 "얻는 것"으로 통일: 불안한 앞날 준비하기 / 인생 반전의 순간 / 놓치면 안 될 길일 / 나와 맞는 사람은?
- 무료 4종은 제한을 제목에 노출: 간단운세 · 딱 3장 타로 · 한 단어 꿈해몽 · 질문 하나 대화상담.
- **가독성(50대 이상)**: 인물 사진 위 흰 글씨만으론 대비가 들쭉날쭉 → 제목=먹빛 판/부제=노란 판 **불투명 배경판**.
  제목 길이가 2~9자로 편차가 커 길이별 폰트 단계 조절(고정 크기면 긴 제목이 카드를 넘침).
- **로고에서 9,900원 제거** — 텍스트가 아니라 `logo.png`에 그려져 있어 이미지 크롭(png/webp/avif) + alt 정정.

### 가격 3,300원 이벤트 (slide 5)
- 카드 4종 상품 `price 3300 + compareAt 9900`. 홈 카드에 `<ComparePrice>` 취소선 렌더 추가.
- **취소선 인프라는 이미 있었다**(2026-07-07 Phase 2) — 렌더 커버리지만 부족했음(원래 lifetime_report 3곳뿐).
- **`product_prices` 실측 0행** → 카탈로그가 곧 라이브 청구가. "궁합 프로덕션 990 오버라이드" 주석은 stale이라 정정.
- 가격 리터럴을 직접 단언하던 테스트 4건을 카탈로그 기준으로 변경(마케팅 값 바뀔 때마다 무관한 테스트가 깨지지 않게).

### 결제 단순화 (slide 7·8)
- 체크아웃 상단 `SiteHeader` 제거(`header={false}`) — GangiPageHeader와 2겹이던 것을 포커스 체크아웃 의도에 맞춤.
- **먹통이던 정적 "결제 수단" 카드 삭제** — 라디오처럼 생겼지만 아무것도 선택되지 않았고, 진짜 선택기가 아래에 또 있었음.
- 기능 없는 "할인/쿠폰" 행 삭제(값이 늘 "결제창에서 적용" 고정).
- **약관 체크박스 5개 → 1개**. UI만 축소하고 `acceptedKinds`는 전체를 그대로 올려 `user_policy_consents`
  항목별 감사기록 유지(청약철회·디지털콘텐츠 고지 입증 보존). 각 정책 전문 링크 병기.
  문장 조립 시 `it.label`("이용약관 확인 및 동의")을 쓰면 "…동의에 동의합니다" 비문 → `POLICY_LABELS` 사용.

### 무료 축소 · 하단 메뉴 (slide 6·9)
- **무료 오늘운세를 13섹션 → 1장 요약**(총운·점수·언락 CTA·내 사주·공유·추천).
  일진내역/카테고리별/행운패키지/명식은 **유료 '오늘 자세히 보기'의 가치로 남김**(무료에서 다 보여주던 걸 되돌린 것).
  ⚠️ `TodayFeedbackCard` 제거로 `today_fortune_feedback` 유입 중단 — ML 학습 데이터 필요하면 유료 화면으로 이전 필요.
- 결과 하단 업셀을 **썸네일 + 질문형 카피** 리스트로("이런 운세는 어때요?"). 시안의 '연도별 운세' 행은
  해당 기능·라우트가 앱에 없어 제외(없는 메뉴를 만들지 않음).
- 사주 카드는 정보입력 후 중간 맛보기 없이 바로 결제(`?product=today-detail`).

### 무료 하루 1회 제한 (slide 3) — 신규 구조
- 조사 결과 **무료 4종에 하루 제한이 전혀 없었고**(대화상담만 '평생 3턴'), 오늘운세·타로·꿈해몽은 익명에게도 무제한.
- 공통 primitive `src/lib/free-usage/daily-limit.ts`: **익명=쿠키(KST 날짜키) / 로그인=`consume_member_benefit`**.
  `membership_benefit_usage`가 generic이라 **마이그레이션 불필요**. 유료 멤버는 면제.
  패턴: **판정(읽기)은 비싼 작업 전, 소비는 성공 후** — 한 번에 consume 하면 실패 시 결과도 못 받고 기회만 잃음.
- 표면별 구조가 달라 구현이 다름:
  - **꿈해몽은 페이지 개편이 한 세트** — 타이핑마다 디바운스 검색 + 마운트 시 '이빨' 자동검색이라
    API만 막으면 **페이지 열기만 해도 소진**. 자동검색 제거 → 명시적 제출 1회로 전환.
  - **타로는 서버 API가 없던 표면** — `/api/tarot/daily-draw`(기록 전용·비차단) 신설 + pick 페이지 진입 게이트.
  - **대화상담은 평생 3턴 → 하루 1턴**(`AI_CHAT_FREE_TURNS` 3→0, billing status `free_daily` 추가).
    번들 과금 3전/3턴·멤버 일일 5턴 경로는 불변.
- 조사(은/는) 하드코딩 시 '꿈해몽는' 비문이 그대로 노출 → 받침 판정 헬퍼 + 테스트.

### 게이트 / 남은 일
- 통과: `tsc` · `build` · 커스텀러너 186 · vitest 204.
- ⚠️ **E2E 미검증**: 실행 중인 dev 서버와 `.next` 공유 충돌로 로컬에서 신뢰성 있게 안 돌아감.
  동일 커맨드 baseline(4c9be118) 50 failed vs 본 브랜치 32 failed/19 passed 로 **환경 문제임은 확인**했으나
  스펙 통과 자체는 확인 못 함. 무료 축소로 6영역 카드가 사라져 점수일치 스펙은 총운 일치로 범위 조정(`expect.poll`).
- ⚠️ **E2E 계정쿼터**: 로그인 E2E가 같은 날 두 번 돌면 계정 카운트에 걸려 실패. CI가 프로덕션 빌드라
  NODE_ENV 가드형 우회는 불가 — 테스트 유저의 `free_*_daily` 행을 setup에서 정리하는 방식 필요.
- ⚠️ **3,300원과 어긋난 채 남은 가격 지점**: ①홈 배너 `saju-9900.png`에 9,900원이 **그려져 있음**(새 에셋 필요)
  ②코인 경로 `coinCost: 10`(≈9,900원) — 같은 상품이 카드 3,300 vs 전 10개로 3배 차이
  ③`bundle_today_set` 19,800원(구성품이 3,300이 되며 비합리). `credit_15`는 전 경제 붕괴 방지로 의도적 미변경.

---

## 2026-07-10~13 세션 (Claude) — 결제·크론·지표 정합성 복구 + 환불 상태머신(refunded)

> 발단: "무료 오늘운세가 너무 잘 나와서 결제를 안 한다 → 내용 블러+결제팝업" 요청. 조사해보니 **문제는 페이월이 아니라 계측이 죽어 있던 것** — 결제 실패, 크론 전멸(canonical 301), 봇 지표 과대. 페이월 손대기 전에 "믿을 수 있는 지표"부터 세움. 퍼널 현실점검 결과 "무료라서 안 산다"·"가입 병목" 근거 없음(가입은 결제 직전에만 필요).

### 결제·인프라 버그 5종 (머지 완료)
- **E2E 회귀 #628**: "무료 결과 보기" 셀렉터 실패 근본원인=#625 가 죽은 birth-info-stepper CTA 를 "오늘 운세 보기"로 개명. 셀렉터 교정(#627 탓 아님). 이후 죽은 stepper 정리(#630).
- **결제 실패 진단 #631**: NicePay 인증 거부("사용자 정보가 존재하지 않습니다")=clientKey/secretKey 폴백 짝 불일치 의심 → nicepay-health 진단 엔드포인트. 실측 audit.ok=true(env 이미 정상), 실결제 승인·취소·환불까지 성공 확인.
- **환불이 이용권 회수 안 함 #632**: 웹훅이 `pkg.credits>0` 만 회수해 credits=0 단품(score-total 등)은 환불 후에도 이용권 잔존 → 실제 지급기록(order_id) 기준 회수로 수정.
- **크론 전멸 #634**: canonical 301(proxy.ts)이 *.vercel.app 을 튕겨 **모든 Vercel 크론이 한 번도 실행 안 됨** → /api/* 예외. 지표가 얼면 이걸 먼저 의심.
- **봇 지표 #635**: site_visits 가 크롤러를 사람으로 셈 → isBotUserAgent 필터(인스타·카카오·네이버 인앱은 사람이라 오탐 금지).

### 사용방법 온보딩 자동 실행 제거 (#643)
- 피드백: 첫 화면(로그인 감지)에서 온보딩 모달이 자동으로 떠 불편. → **auto-open 삭제, 메뉴 수동 실행 전용**.
- `system-guide-launcher`에서 인증(supabase) 감지 auto-open useEffect 전면 삭제. 수동 이벤트(`openSystemGuide`) + 워크스루 도중 기능 이동→back 복원(navigationRef)만 유지. `shouldAutoOpenSystemGuide` 는 dead code 라 제거.
- e2e: 자동실행 검증 describe(authenticated) 삭제 + "마운트만으로 자동실행 안 됨" 회귀 테스트 추가. `playwright.config` 의 `chromium-auth-guide` project 삭제(안내 spec 인증 불필요→기본 chromium 실행). 런처 단위테스트 수동전용 재작성.
- 유지: `/guide` 메뉴(메가내브·모바일시트)·6단계 카드·'처음부터 안내 보기' 수동 모달. 게이트: tsc·build·E2E·vitest 54·커스텀러너 통과.

### 환불 상태머신 — refunded 종료 상태 (#641)
- 서비스 첫 성공결제(score-total 9,900원) 취소 실측 → **두 방향 모두 회계 붕괴**: PG취소(웹훅/정산)는 `canceled` 로 덮여 매출 소실, 관리자환불은 `fulfilled` 로 남아 과대계상.
- 결제까지 간 취소를 새 종료상태 `refunded` 로 통일(세 경로 대칭: 웹훅·정산·admin). 총매출(revenue_won, 판 날) / 환불액(refunded_won, 환불한 날) 분리 집계 — 표준 회계.
- `cancellation.ts` 순수판정(resolveCancellationTerminalStatus/isFullRefund) + `order-ledger` markPaymentOrderRefunded + `analytics-rollup` refunded 컬럼. **migration 071**(⚠️수동, 070 동반) — CHECK+refunded_at+metrics_daily 컬럼.
- **코드리뷰(머니패스) 실버그 2건 반영**: **C1** gross fetch 가 `refunded` 제외 → 재롤업 시 판 날 매출 소실 → net 이중차감(단위테스트가 paymentRows 주입으로 가림). `REVENUE_ORDER_STATUSES`에 refunded 포함+회귀가드. **I1** markPaymentOrderRefunded 가 refunded_at 매 호출 덮어써 귀속일 드리프트 → neq 로 최초1회 stamp(멱등).
- 후속(문서화): C2 부분취소 비례회수(기존 한계 §6), M4 operations-stats 누적매출 gross 통일(RPC 063 마이그레이션 동반 필요).
- 게이트: tsc·build·E2E·커스텀러너 통과. ⚠️ 070+071 선적용 후 머지(미적용 시 취소통보 CHECK 위반→회수 실패+지표 동결). 070+071 적용 완료.

---

## 2026-07-07 세션 (Claude) — /admin/analytics 테이블·페이지네이션 + 관리자 전상품 가격 제어 Phase 1

### /admin/analytics 날짜별 상세 테이블 + 페이지네이션 (#614·#615)
- #614: 방문자·PV 그래프 바로 아래 날짜별 상세 테이블(최신순·컬럼 날짜/방문/PV/신규가입/결제/매출/결제·방문). 기존 `snap.daily`+포맷터 재사용(순수 프레젠테이션).
- #615: 15일 페이지네이션 — 하단 중앙 숫자 네비(슬라이딩 윈도우 최대5)+좌우 화살표(경계 disabled). 윈도우 전환 시 1p 리셋.

### 관리자 전상품 가격 제어 — Phase 1 (#616)
- 요청: admin 에서 모든 상품 가격 변경(현재/과거/변경가), 수정 시 "한 번 변경하면 되돌릴 수 없습니다" 확인창, 가격정책·약관 등 전 페이지 한 번에 동기화. → **3단계 PR** 로 결정, 이 PR 은 **Phase 1(인프라+청구정합+admin메뉴)**.
- 설계: `docs/superpowers/specs/2026-07-07-admin-price-control-design.md` · 계획: `docs/superpowers/plans/2026-07-07-admin-price-control-phase1.md`.
- **검수 결과**: 가격이 카탈로그 상수(`PAYMENT_PACKAGES.price`, 청구+검증) + 표시 문자열 ~30파일 하드코딩으로 이원화. 법률 약관 본문은 대부분 가격 없음(마케팅/가격페이지에 집중). 과거 주문은 실결제액(`metadata.amount`) 보존 — 소급 왜곡 없음.
- **구현**: **migration 067**(⚠️수동) `product_prices`(런타임 오버라이드)+`product_price_changes`(append-only 감사, RLS deny-all, **시드없음**=리졸버 카탈로그 폴백). `price-resolver`(카탈로그 기본가+DB 오버라이드 병합, env/DB오류 폴백). 머니패스 **스냅샷**: prepare 가 `order.amount`=리졸버값 저장 → confirm/return 은 `order.amount` authoritative 검증(중복 카탈로그 상수비교 제거 — 가격변경시 정상주문 거부하던 버그). `/admin/pricing`(super_admin, 현재/과거/변경가 표+확인창+감사)+`/api/admin/pricing`+nav+Phase2 전 표시불일치 안내배너.
- **적대적 리뷰(4렌즈)** — 🔴 **CRITICAL 1건 수정**: 체크아웃(`membership/checkout`→`TossMembershipCheckout`)이 PG 청구를 카탈로그 상수로 → order.amount(리졸버)와 갈라져 가격변경시 해당상품 **전 결제 100% 거부**. **prepare 응답에 amount(=order.amount) 포함→클라가 `prepare.amount`로 청구**(prop 폴백, 렌더~결제 레이스도 제거)+체크아웃 표시가도 리졸버 통일. 5번째 머니패스 지점. minor: `prepare_ready` 퍼널 amount resolved(엔트리 카운터 prepare_attempt 는 주문전이라 카탈로그 proxy 유지). admin 보안(권한·검증·RLS·감사) 직접 검증 통과.
- 게이트: typecheck 0 · 커스텀러너 **1063(0실패)** · vitest spec · build(`/admin/pricing`·`/api/admin/pricing`). 신규/갱신 테스트: resolver5·product-pricing6·order-ledger스냅샷1·confirmation2·dup-audit spec.
- ⚠️ 배포 후: 067 `supabase db push` → super_admin `/admin/pricing`. **실가격변경은 Phase 2(전 노출 단일화, ~30파일) 완료 후 권장**(그전 롱테일 표시가≠청구 가능, 배너 노출). 청구·체크아웃·확인창은 지금도 정상. **다음: Phase 2(가격 노출 지점 전수감사→price-registry+PriceProvider), Phase 3(정책/가격텍스트 `{{price:*}}` 토큰).**

---

## 2026-07-06 세션 (Claude) — 사주풀이 밀착 개인화 + LLM fallback 근본수정 + admin 기간구분 + GA4/GTM + 자체 동의배너

### 사주풀이 밀착 개인화 (#607)
- 사용자 요청 "훨씬 풍성하고 간지나게". **5개 LLM 프롬프트 소스**(interpret `saju-interpretation.ts` / chapters `COMMON_SYSTEM_PROMPT` / total-review / yearly / lifetime) + 결정론 fallback 전부에 **show-don't-tell 하이퍼 개인화** 지침 주입(사주 원국 근거를 구체 장면으로).
- 적대 리뷰 2건 반영: yearly 예시가 미명시 사실 전제 → 조건부+반(反)날조 절, "X의 결" 신조어(naming-policy §3 금지) → "차이/성향".

### LLM 조용한 fallback 근본수정 (#608)
- 배포 실측 "실제 풀이 뽑아 확인" → interpret/chapters 가 **조용히 fallback** 중이던 것 발견. 2대 근본원인:
  1. **GPT-5.x 는 `temperature` 미지원**(400 Unsupported parameter) — interpret·chapter 클라이언트에서 temperature 제거(total-review 패턴에 맞춤). ⚠️재추가 금지.
  2. **모델 env 가 표시명 'GPT‑5.3 Instant'**(무효 id) → env 교정.
- interpret 경로엔 chapter-validator 같은 런타임 한자 가드가 **없어** cleanText 에 한자 스트립 추가.

### admin 방문/결제 기간 구분 (#609)
- 사용자 요청 "오늘만 말고 주간·월간·누적도, 결제도 동일하게". `operations-stats.ts` 에 방문·결제 **오늘/주간/월간/누적** 브레이크다운 섹션 + 대시보드 PeriodRow·fmtVisitor·fmtWonCompact. 집계=service 클라(RLS deny), KST 축, payment_orders 원장.

### GA4 + GTM 정제 임베드 (#610)
- GA4(`G-F6BP90L8E2`)·GTM(`GTM-N9MSPMCG`) 를 layout `<head>` 에 임베드. **개인정보 정제 필수**: 이 앱의 사주/공유 URL 은 경로·쿼리에 생년월일·시간·성별·이름을 담음(toSlug + a·b·n·d·c) → 자동 page_view 끄고(`send_page_view:false`) `<GaPageView/>`(client, usePathname) 가 정제 경로만 수동 전송.
- `ga-sanitize.ts`(순수함수, 테스트 7): 생년월일 세그먼트·key 해시 → `redacted`, 쿼리는 utm/gclid/fbclid/ref 화이트리스트. CSP 에 googletagmanager/google-analytics 출처 허용. ⚠️GTM 컨테이너엔 이 속성 GA4 page_view 태그 넣지 말 것(코드 정제 우회).

### 자체 쿠키/분석 동의 배너 — Consent Mode v2 (#611)
- GA4·GTM 무조건 로드 → **Consent Mode v2**: 기본 전부 `denied` 로 로드(쿠키·식별자 없이 익명 모델링), 자체 배너에서 '동의' 시 `granted` 승격. 재방문자는 인라인 스크립트가 즉시 복원(재노출 없음).
- `analytics-consent.ts`(공유 로직: readConsent/applyConsent, localStorage `ganji:analytics-consent:v1`, gtag consent update, openConsentBanner/CONSENT_REOPEN_EVENT) / `analytics-consent-banner.tsx`(StickyBottomBar body-portal, 동의·거부·/privacy) / layout `consentInitScript`(스텁+default denied+복원) **GTM·gtag.js 보다 먼저** 실행+gaConfigScript 분리 / 푸터 '쿠키 설정' 재노출.
- 3-lens 적대 리뷰 6건 CONFIRMED 전부 수정: 철회 UI 부재→푸터 재노출(PIPA), `variant="bottom"` 이 dock·결제CTA 와 bottom:0 충돌→`above-dock`(dock 위/포커스라우트 8rem clearance 위), GA-only 고지→1P 방문분석 포함 문구.
- ⚠️ **남은 결정**: 현재 advanced 모드(동의 전에도 Google 로 쿠키리스 핑 전송, 표준 기본값). 의료 인접이라 *동의 전 3P 전송 0* 원하면 basic 모드(동의 전 로더 미주입, 모델링 손실)로 전환 가능. `/privacy` 에 GA·1P 방문분석 상세 고지 추가 권장.

### /admin/analytics 누적 일별 지표 그래프 (#613)
- 요청: admin 에서 방문자·전환율·유입링크·결제를 매일 측정·누적해 그래프로. 소스는 Vercel/GA 무엇이든 정확하면 OK.
- 결정: **자체(first-party)** — GA4/GTM·Vercel Analytics 는 client-only·서버 read API 없음·GA4 동의모드 추정치라 부정확. 이미 수집중인 `site_visits`·`payment_orders`·`payment_funnel_events` 를 일별 롤업(정확·자체보유). 유입=referrer+**UTM**(신규 수집). 배치=새 `/admin/analytics`.
- 구현: **migration 066**(⚠️수동) `metrics_daily`(KST 일1행)+site_visits UTM 컬럼+`metrics_daily_source` RPC(서버 group-by→일별 방문/PV+상위 referrer/utm jsonb). VisitPing UTM 전송+`/api/visit` 저장(당일 first-touch fill). `computeDailyMetrics`(순수)+`runDailyMetricsRollup`(멱등 upsert). 크론 `/api/admin/metrics/rollup`(매시 :10, 최근3일)+super_admin 백필(?backfill/?from&to, 400캡). `getDailyMetrics`(gap-fill·전환파생·상위유입)+`/api/admin/analytics`+페이지(30/90/365, SVG 라인차트+유입표)+nav. 단위테스트 9.
- **4-lens 적대 리뷰 8 CONFIRMED 반영**(SQL/RPC 무결점): 결제 fetch 를 귀속시각(confirmed/fulfilled/created) OR 하한으로(지연확정 누락 방지) / 전환율 그래프 null→0% 강등 제거(선 끊김) / fetchAllPages 200k 절단 throw / resolveDateKeys 초장기 span 클램프(to-399) / 크론 :10 오프셋(요약갱신 뒤) / '방문→결제' 혼합지표 라벨 정직화.
- ⚠️ 배포 후: 066 `supabase db push`+062/065 적용 확인 → super_admin `?backfill=90` 1회 → 매시 자동 누적. UTM 소급 불가.
- 게이트: typecheck 0 · 커스텀러너 1050(신규 9) · build 성공(3 신규 라우트).
- **후속 #614**: 방문자·PV 그래프 **바로 아래 날짜별 상세 테이블** 추가(최신순·컬럼 날짜/방문/PV/신규가입/결제/매출/결제·방문(참고)). 기존 `snap.daily`+포맷터 재사용, 순수 프레젠테이션(데이터 파이프라인 무변경). 차트 그리드를 (방문+PV)/테이블/(나머지5) 3블록 분리. typecheck 0·build 성공.
- **후속 #615**: 날짜별 테이블 **15일 페이지네이션** — 하단 중앙 숫자 네비(1,2,3,4,5, 슬라이딩 윈도우 최대5)+좌우 화살표(‹›, 경계 disabled). 윈도우(30/90/365) 전환 시 1p 리셋·page 방어 clamp. 헤더 '총 N일'. typecheck 0·build 성공.

### 오늘 자세히보기·달력 '오늘의 흐름' 이름 '선생님' 버그 (#612)
- 증상: '오늘 자세히 보기' → '오늘의 흐름' iljin 메시지가 "**선생님 님**"으로 표기.
- 근인: 오늘운세 birth payload(`reading.input`)엔 **이름 필드가 없다**(이름은 사주 계산과 무관 → 프로필/소셜 메타에서 별도 해석). 2026-06-05 Bug A 가 이 해석을 **free 결과에만** 적용(`namedInput`)하고 **premium 엔 raw `reading.input`** 전달 → iljin `"[이름] 님"` 이 `vars.name ?? '선생님'` fallback(premium topN=5 = 사용자가 본 5줄).
- 수정: premium 빌더도 `namedInput` 사용. `resolveNamedReadingInput()` 공용 헬퍼 추출 + `buildTodayFortuneSnapshotContent` 에 `nameDeps` 주입 seam. **운세 달력**도 같은 버그(일자 메시지) → route·unlock 이 `buildFortuneCalendarMonth` 에 `namedInput` 전달. ⚠️ `toSlug`(pillars)는 `input.name` 포함 → `readingKey`/entitlement 은 raw `reading.input` 유지(슬러그 안정).
- 회귀 가드 2종(수정 전 실제 fail 확인). 카테고리 메시지는 `[이름]` 미사용→무해. `'선생님'` 은 `'달빛이'` hero fallback 가드(display-name-blindspot) 바깥의 **별도 blind spot** 이라 재발.
- 게이트: typecheck 0 · 커스텀러너 1041 · build 성공.

---

## 2026-07-02~03 세션 (Claude) — 카카오 연동(공유+알림톡/친구톡) + 코인→전 리브랜딩 + 메가내브 로그아웃

### 메가내브 로그아웃 (#572)
- `MegaNavBar`(app-shell 영속 클라 컴포넌트)가 `onAuthStateChange` 미구독 → 로그아웃 후 UI stale("작동 안 함"). SiteHeader 처럼 구독 추가해 반응형 갱신.

### 코인 → "전" 재화명 리브랜딩 (#573·#574·#575)
- **#573**: 전역 "코인"→"전" 324곳/97파일. **crypto/투기 의미 10곳 유지**(재물운 해석 7·타로 크립토질문 감지·safe-redirect FINANCIAL_KEYWORDS). URL 경로(/coin-policy)·DB 값(kind='coin')·영문 식별자 보존.
- **#574**: migration **058**(policy_versions content in-place 치환 + content_hash 재계산) + scripts 5파일. ⚠️058 수동적용 완료.
- **#575**: 단독/제목 라벨 모호성 → **"재화(전)"**(사용자 선택). 인접충돌(결제/충전/지급/사용 "전"=before 오독) → "재화"로 교정.

### 카카오 연동 전면 구현 — PR #576~#583
- **#576** Phase A(공유 SDK, 5메뉴: 사주·궁합·별자리·띠·타로)+B1(전화번호·광고동의·migration **059**: user_contact/kakao_message_log)+B2(Solapi 알림톡 엔진·webhook·dispatch cron·결제완료 after() 트리거)+B3(친구톡·야간가드·(광고)표기). **전부 env-gated dormant**.
- **#578** 코드리뷰 반영: 멱등 insert 오류구분(23505 vs 실오류)·webhook fail-closed+timingSafeEqual·상태매핑 실패우선·dispatch dormant 가드.
- **#577** 채널추가 버튼(`NEXT_PUBLIC_KAKAO_CHANNEL_ID`).
- **#579** `docs/solapi-setup.md`(설정 단계별 가이드).
- **#580** webhook `X-Solapi-Secret` 유연화(헤더-해시/평문/URL토큰 모두 수용)+GET 검증핑. + `scripts/solapi-channels.mjs`(pfId 조회).
- **8eac37c**(⚠️main 직접커밋) 템플릿 변수 다듬기: `#{product}`=pkg.name(상품명), `#{days}`→`#{when}`("오늘"/"3일 뒤").
- **#581** `scripts/solapi-templates.mjs`(템플릿 ID 조회).
- **#582** 결제화면 전화번호 수집(선택, PaymentConsentCheckboxes에 배치, **ad_consent 기존값 보존**).
- **#583** JS키 `.trim()`(공유 4019 대응 — 값 끝 공백 방어).
- migration **059 수동적용 완료**. **개인정보처리방침 admin 반영 완료**(휴대폰 수집·Solapi 수탁자).

### 공유 버튼 전수감사 (2026-07-03, ultracode 워크플로 22에이전트)
- 7표면 병렬감사→dedupe→적대검증으로 **14건 확정(기각 0)** 전부 수정:
  - **[보안] 궁합 페이월 우회**: `?paid=love-question` 쿼리만으로 990원 유료 무결제 열람 — result·manual·input 3곳에서 paid 쿼리 신뢰 제거(서버 entitlement만).
  - **[critical] 궁합 공유링크 수신자 재현 불가**(familyId=공유자 계정 스코프+로그인벽) → 공유 URL을 초대 랜딩(/compatibility/input?relationship=)으로 분리(본인 redirectPath 유지). 근본해결(공개 스냅샷 /compatibility/share/[slug])은 후속.
  - **[critical] 보관함 구매카드 죽은 "↗ 공유" 버튼** 제거(grid 3→2).
  - 카카오 카드 썸네일 404(DEFAULT_OG_IMAGE 옛 경로) 교정+page-metadata와 단일화 / saju 공유 레거시 간지사주.kr→canonical / 허위 "전 50개" 추천보상 블록 제거 / 가짜 QR 제거 / zodiac 공유 birthYear 보존 / tarot 공유쿼리를 확정 결과에서 재조립(날짜종속 폴백 차단)+shared=1 수신자 저장 게이트(result·spread) / spread 페이지 공유 신규 / star-sign 날짜 명시 / Web Share 사용자취소(AbortError) 구분.
- 게이트: typecheck 0 · 커스텀러너 995 · vitest 129. 후속: 궁합 공개 공유 스냅샷 뷰 → **같은 날 구현됨(아래)**.

### 궁합 공개 공유 스냅샷 + 전체 풀이 공유 커버리지 (2026-07-03)
- 설계: `docs/superpowers/specs/2026-07-03-share-snapshot-design.md` (원칙: 수신자 재현성·개인ID 비노출·유료 비포함·noindex·toSlug 재사용).
- **`/compatibility/share/[slug]` 공개 뷰 신설**: slug=`{relationship}--{selfSlug}--{partnerSlug}`(기존 toSlug/fromSlug 재사용, 이름은 ?a=&b= 쿼리), 로그인 없이 결정론 재계산 → CompatibilityResultView 무료 화면+유료CTA(심층은 수신자 본인 entitlement만, 멤버쿼터 미소모), 재공유 섹션, robots noindex.
- 발신측: result 페이지(저장 프로필)·**직접입력(manual) 결과**(기존 sessionStorage라 공유 불가였음) 모두 스냅샷 URL로 공유. `lib/compatibility/share-slug.ts`(+테스트 6, 순수·클라 안전).
- **꿈해몽 상세 공유 버튼**(공개 SEO 페이지 quick win). 커버리지 매트릭스: 사주·별자리·띠·타로 완료, 오늘운세 무료 티저 스냅샷은 후속 설계로 기록(유료/개인 풀이는 정책상 비대상).
- ⚠️ fromSlug 의 key 해시 토큰은 검증 안 함(무시) — 변조=다른 생년 재계산일 뿐 보안 무관(테스트로 명문화).
- 게이트: typecheck 0 · 커스텀러너 1001 · vitest 129 · next build 성공(신규 라우트 등록 확인).

### 오늘운세 공개 티저 스냅샷 (2026-07-03, 커버리지 Part 3)
- **`/today-fortune/share/[slug]?d=YYYY-MM-DD&n=이름&c=걱정`**: slug=생년 toSlug → fromSlug+loadSajuDataV2+`buildTodayFortuneFreeResult({now:고정날짜})` 로 발신자가 본 그 날 **무료 결과(한 줄+점수 6종)만** 로그인 없이 재계산. 유료(상세/프리미엄) 미포함. noindex. 날짜 파서 `lib/today-fortune/share-date.ts`(+테스트 5, KST 정오·실존날짜 검증).
- free result 에 `shareSlug: toSlug(input)` 서버 주입(sajuSlug 는 reading id 일 수 있어 별도) — **게스트 결과도 공유 가능**. 발신측=결과 클라이언트에 공유 섹션(shareSlug 있는 신규 결과부터; 구 sessionStorage payload 는 미노출).
- 재현성 회귀 가드 `share-teaser.test.ts`(라운드트립·고정날짜 결정론·dateKey=고정날짜) 3종.
- 게이트: typecheck 0 · 커스텀러너 1009 · vitest 129 · next build 성공.

### admin 지표 전수검증 (2026-07-04, 워크플로 감사 51건→수정)
- 사용자 보고 "유입자·가입자·모든 수치 이상" — 워크플로 감사(6표면 완주, 51 raw findings)로 **3대 근본원인** 확정·수정:
  1. **운영 API가 anon 클라이언트로 집계**(admin_user_summary=RLS 정책 0개 deny-all) → 가입자·신규가 항상 0, 타 테이블은 본인 행만 → service 클라이언트로 교체(#A).
  2. **payment_funnel_events INSERT 정책 부재** → 유저 세션의 퍼널 기록 전부 조용히 거부(퍼널 대시보드 공백) → funnel-log 를 service 로 기록+에러 관측. 나이스페이 경로 confirm_* 로그 신설(기존 Toss 전용).
  3. **결제 지표 소스 stale**: credit_transactions purchase(코인충전 폐지로 신규 0) → **payment_orders**(카드·멤버십·PG 공통, 원화) 전환. "충전 재화"→"결제 금액" 라벨.
- 구조 수정: PostgREST 1000행 절단(ops·funnel·cohort·user-detail credit/llm) → count-head/range 페이지네이션 / 시리즈 축 KST 통일(KST 00~09시 '오늘' 소실) / 활성구독 renews_at>now(만료 lazy 과대) / **payment_orders 를 buildPaymentHistory 3번째 소스**(orderId dedupe — 코인 sunset 후 멤버십이 LTV·빌링·paid_count 에서 누락되던 문제, admin+/my/billing 공통) / paid_count=LTV 동일소스 / 수동지급 admin_manual_grant 제외 / summary-refresh: 만료 정규화·완주시 탈퇴자 행 정리·10병렬 / 가입자 목록 헤더=정확 총원(countAdminUsers, 기존=페이지 행수 50) / KST 가입일 필터·상세 날짜 표기 / 요약 신선도(summaryRefreshedAt) 노출 / 라벨 정정(활동 사용자·결제/활동자 비율·산출방식·퍼널 /credits 표기) / 구 전팩 환불판정 복구 / prepare_blocked(sunset) 관측.
- **"유입자" 지표는 원래 존재하지 않음**: trackMoonlightEvent=dataLayer 전용(DB 저장 없음), DAU 라벨이 오해 유발 → "활동 사용자(풀이·피드백·대화)"로 정정+방문은 Vercel Analytics 안내. 실방문 카운트 신설은 후속 설계.
- 보류 2건 → **같은 날 후속 구현**: ①자체 방문 카운트(migration **062** site_visits+RPC, VisitPing 일1회 익명핑, /api/visit, 대시보드 방문자 카드 — 062 수동적용 후 수집·미적용시 '—' graceful; 설계 docs/superpowers/specs/2026-07-04-site-visits-design.md) ②환불 provider 표기 'unknown' 도입(주문 미매칭시 toss 단정 제거 — 실행 분기는 기존 getOrderProviderByPaymentKey+cancelNicepayPayment 로 나이스페이 이미 지원 확인).
- 게이트: typecheck 0 · 커스텀러너 1014(신규/갱신 10) · vitest 129 · build ✓. ⚠️ 가입자 수·LTV 정정은 다음 시간별 summary cron 완주 후 반영.

### ✅ 카카오 공유 4019 해결 (2026-07-03) + 발송 활성화 잔여
- **4019 근본원인 = 카카오 콘솔 오타**: [플랫폼 키 > JavaScript 키]의 "JavaScript SDK 도메인"이 **`httpa://ganjisaju.kr`**(https 오타)로 등록돼 있었음. 새 콘솔은 JS 키별 SDK 도메인을 검증하므로 영구 불일치 → 4019. 코드·env·제품링크관리는 전부 정상이었음. `https://`로 정정 후 **공유 성공 확인**. 진단은 임시 페이지 `/dev/kakao-share-debug`(#588)로 클라 측 전부 정상임을 확정한 뒤 콘솔 대조로 특정 — 해결 후 페이지 제거.
- **알림톡 템플릿 2종(결제완료·멤버십만료) 심의 승인 완료**. 회원가입 안내 템플릿은 예비 승인만(트리거 넣지 않기로 — 사용자 지시). 구독만료 자동발송 크론 등록됨(#587, 매일 KST10 + GET 지원).
- **남은 활성화(콘솔/env만)**: Solapi env(`SOLAPI_API_KEY`/`SECRET`/`KAKAO_PFID`/`SENDER`/`WEBHOOK_SECRET`) + `KAKAO_TPL_PAYMENT_COMPLETE`/`SUBSCRIPTION_EXPIRING`(승인 ID, `node scripts/solapi-templates.mjs`로 조회) → 재배포 → 테스트 결제로 수신 확인.
- ⚠️ **Solapi 필드명(templateId/pfId/adFlag/messageId)·HMAC salt는 go-live 전 vendor.ts에서 현행 문서 재확인**(어댑터 국소 조정).
- 인스타 공유 "안 됨"은 정상(인스타가 웹→앱 자동공유 차단 → 링크복사 폴백).
- 상세: `docs/kakao-integration-guide.md`, `docs/solapi-setup.md`, 메모리 `project_kakao-integration`.

### ⚠️ 카카오 로그인 KOE205 인시던트 (2026-07-04, 해결)
- #591(scope `openid name phone_number` 확장) 배포 후 **카카오 로그인 전면 중단** — 동의항목 심사가 실제로는 **진행중**이었는데 승인으로 오인. **미설정 동의항목 scope 요청 = KOE205 전면 거부**(승인≠자동활성화 — [동의항목]에서 직접 "필수 동의" 설정 필요).
- **#596 핫픽스**: 기본 scope=`openid`, 추가는 `KAKAO_LOGIN_EXTRA_SCOPES` env 게이트(현재 꺼짐). **로그인 복구 확인됨**.
- **재활성화 순서(엄수)**: ①심사 승인 → ②[동의항목] 이름·전화번호=필수 동의 설정 → ③env=`name phone_number`+재배포. **env 선입력 금지**(자동배포 타는 순간 재발). OIDC 토글(사용함)도 전제.
- 함께 배포: 카카오 함께 로그아웃(#595, SSO 세션 종료 — 콘솔 로그아웃 리다이렉트 URI=`https://ganjisaju.kr/` 등록됨).

### admin 사용자 요약 stale("기준 06-05") 근본수정 + 목록 보강 (#597, 2026-07-04)
- **근본원인**: 배치 refresh 가 200명 페이지 전체 계산 후에야 upsert → 사용자 증가로 함수 타임아웃 → **6/5 이후 모든 실행이 통째로 무효**(원자적 전멸). #593 감사는 집계 로직만 보고 갱신 파이프라인 실패는 못 잡았음.
- 수정: **chunk(10명) 단위 즉시 upsert**(타임아웃 나도 처리분은 저장 — 자가치유) + 완주 게이트된 stale 행 삭제 + 진행 로그. 헤더에 "요약 기준 {시각}" + 2시간 초과 시 ⚠️ 경고 + super_admin "지금 갱신" 버튼(`POST /api/admin/users/summary/refresh`).
- 목록 컬럼 추가: 가입 경로(email/kakao/google) · 연락처(📱전화 📢광고동의, user_contact 조회). 날짜 표기 KST 통일.

### admin 계정 관리 — 이용정지/해제·정보수정·삭제 (#598, 2026-07-04)
- `POST /api/admin/users/manage`(super_admin 전용): **ban/unban**(Supabase `ban_duration` 87600h/'none' — 신규 토큰 차단, 기존 토큰은 만료까지 유효), **update_info**(표시명=profiles 행 존재 시만·전화=user_contact 정규화·빈값=삭제·**ad_consent 불변**), **delete**(대상 이메일 타이핑 확인 → push 구독 비활성 → auth 삭제 → 요약 행 즉시 제거). 본인 ban/delete 차단. 전 액션 감사로그(logAdminAccess 4종 신설)+요약 즉시 갱신.
- 상세 페이지 "계정 관리" 카드 + 헤더 ⛔ 이용정지 배지(`banned_until` 미래시각만 정지로 판정).

### 운영지표·LLM사용량·결제퍼널 정확성 감사 (#599·#600, 2026-07-04)
- #593 머지 후 재검증(워크플로 3감사 → 15건 발견 → 전건 코드 대조 → **12건 수정**):
- **LLM(/admin/llm-cost) — 사실상 전부 부정확했음**: ①(critical) `.limit(50000)`이 PostgREST max-rows(1000)에 클램프 → 30일 1000행 초과 시 총비용·호출·일별차트가 최신 1000행만 집계 → range 페이지네이션 ②일별 버킷 UTC→KST ③오늘운세 캐시 hit 미계측(hit률 항상 0%) → recordLlmRun(cache) ④윈도우 KST 자정 스냅 ⑤오행가이드 feature 오귀속(total_review→ohaeng_guidance).
- **운영지표**: fetchAllPages 에러 시 부분집계 침묵 반환 → throw(500 관측) / offset 페이지네이션 정렬 tiebreak(id) / '오늘' 헤더 UTC→KST / 활성구독 문구=쿼리(renews_at null 포함) 일치 / 주석 060→062 정정.
- **결제퍼널 — 기록은 작동하나 비율 왜곡 4곳**: ①toss confirm 재진입(성공페이지 새로고침)마다 attempt만 누적 → 성공률 하향 왜곡 → attempt 를 이미-지급 조기반환 뒤로(nicepay와 의미 통일) ②웹훅/정산(reconciliation) 경유 성공이 confirm_success 미기록(원장≠퍼널 괴리) → 기록 추가 ③nicepay 인증실패(사용자취소·카드거절=실전 최다)·서명실패·주문미조회·paymentKey 불일치 전부 퍼널 공백 → attempt+failed 쌍 기록 ④prepare sunset 차단이 attempt 없는 blocked 단독(blockRate>100% 모순 가능) → 쌍 기록.
- **#600(후속)**: 누적 결제 건수/금액을 행 전량 fetch+JS 합산 → **SQL 집계 RPC**(migration **063** `payment_order_totals`) 전환. 5만 행 절단 리스크 제거+로드 경량화. **RPC 미적용 시 행 페이지네이션 폴백**(무중단). 적대검증 2렌즈 결함 0.
- 게이트: typecheck 0 · 커스텀러너 1018(신규 2: LLM KST 경계·RPC 경로) · vitest 129 · build ✓. ~~⚠️ migration 063 수동적용 필요~~ → **062·063 적용 확인됨**(migration list). 비문제 확인: 퍼널 조회는 이미 guard→service-role 패턴.

### ⚠️ dialogue_messages 프로덕션 drift 발견·복구 (#601, 2026-07-04)
- #599 배포 직후 /admin '오늘' 카드 "데이터를 불러오지 못했습니다(service env 확인)" — **env 아님**. Vercel 로그: `Could not find the table 'public.dialogue_messages'`. **프로덕션 DB에 테이블 실부재**(migration 024는 히스토리에 적용 기록만 — inspect table-stats 로 확정. 마이그레이션 생성 테이블 전수 vs 원격 비교: 누락은 이 하나뿐).
- 그동안 안 보였던 이유: 구 코드는 조회 실패를 침묵 부분집계(활동 사용자에서 대화 누락=틀린 수치 표시) — #599의 throw 전환이 **의도대로 잠복 drift 를 드러낸 것**.
- **더 큰 영향**: AI 대화 기록 저장이 프로덕션에서 조용히 전멸 중이었음(클라 best-effort 라 500 무시, 서버 로그도 없어 무관측 — 대화 히스토리 미보존).
- 수정: migration **064**(024 동일 DDL 멱등 복원판 — 히스토리상 024 '적용됨'이라 db push 미재실행, 새 번호 필수) + /api/dialogue/messages 저장실패 서버로그 + /admin 오도 문구 교체. ⚠️ **064 수동적용 필요**.
- 교훈: **마이그레이션 히스토리 '적용됨' ≠ 실존재** — drift 의심 시 `supabase inspect db table-stats --linked` 로 실사.

### 메인 카드 무료 진입점 우선 배치 (#602, 2026-07-04)
- GANGI_HOME_CARDS 재정렬: 1줄 무료운세·무료타로(**HOT**) / 2줄 사주·대운(**추천**, 사주 HOT→추천) / 3줄 택일·궁합 / 4줄 꿈해몽·대화상담. 데이터 순서·태그만 변경(렌더러·라우트·가격 라벨 무변경).

### 실운영 전 SEO 전수감사·하드닝 (#603·#604, 2026-07-04~05)
- 워크플로 3감사(라우트 커버리지·메타데이터·한국검색) → 17건 발견 → **#603에서 14건 수정** + 인라인 적대검증(세션한도로 워크플로 사망 → 인라인 대체).
- **[critical] robots 자기모순**: disallow `/saju/`가 핵심 전환 랜딩 `/saju/new`(sitemap priority 0.95)까지 차단 → allow 병기(최장일치). disallow `/my`(prefix)가 공개 콘텐츠 `/myeongri`(명리)까지 차단 → `/my/`+`/my$`로 축소.
- **sitemap 정합**: 리다이렉트 스텁 6종·폐지 /credits 제거, Phase1(5/18) 이후 신규 공개 라우트(궁합·대운·택일·꿈해몽 허브·명리·별자리궁합 12×12 등) 추가. 리다이렉트 스텁 10곳 `redirect()`→`permanentRedirect()`(308).
- **키워드 메타**: 홈 title '간지사주' 단독 → 검색어형, 랜딩 title 교체(타로/궁합/사주/대운/꿈해몽), canonical 보강. **noindex 5곳**(결제 checkout·개인 결과 2·회원가입·잔액).
- **한국 검색엔진**: 네이버 서치어드바이저 소유확인 meta를 env(`NEXT_PUBLIC_NAVER_SITE_VERIFICATION`) 게이트로 추가 + Organization/WebSite JSON-LD 루트 주입.
- **#604 후속**: `/rss.xml` RSS 2.0 피드(꿈해몽+띠+별자리, 92항목, buildRssFeed 순수함수+테스트4) + `/support/faq` FAQPage JSON-LD(기존 FAQ_GROUPS 재사용). Service/Offer 가격 스키마는 **의도 제외**(무료 시작 랜딩에 고정가=실제 불일치).
- 사이트맵 `https://ganjisaju.kr/sitemap.xml` · RSS `https://ganjisaju.kr/rss.xml`(둘 다 라이브 200 확인). **네이버 RSS 제출 500 오류=배포 전 404였던 것**(#604 머지·배포로 해결). 네이버 소유확인 meta·sitemap·rss 제출 완료(사용자).
- 게이트: typecheck 0 · 커스텀러너 1022 · vitest 129 · build ✓.

### 콘텐츠 내부 링크 확충 + 계정 격리 (#605·#606, 2026-07-05)
- **#605 꿈해몽 관련 링크 2→6 자동 확충**: 감사 결과 띠·별자리 상세는 이미 형제 링크 풍부(중복 미추가), 꿈만 curated 2개로 얇음. `buildRelatedDreamSlugs`(순수·결정론, 테스트7): 큐레이션 우선 + 결정론적 회전 이웃으로 6개까지 보강 → **68개 전부 유입 링크(강연결)**·링크 균등 분산. 실데이터 검증(68/68 6링크). "꿈해몽 목록" 링크 스텁→`/dream` 직결. `docs/internal-link-map.md`(URL 레퍼런스 꿈68·띠12·별자리12·궁합144).
- **#606 GitHub 계정 격리**: gh 전역 활성 계정을 타 프로젝트가 kionya 로 바꾸면 push/PR 이 비협업자로 실패하던 문제. `scripts/gh-ganji`(keyring 의 ganji-saju 토큰 런타임 조회→GH_TOKEN 오버라이드, 전역 무관) + repo-local git credential 고정(`scripts/setup-project-account.sh`) + AGENTS.md 규칙. 토큰 파일 저장 안 함. **앞으로 PR/머지는 `./scripts/gh-ganji` 사용**([[reference_gh-account-for-pr]] 갱신).

---

## 2026-06-30 세션 (Claude) — 관리자 평생리포트 권한 부여 + dead-code 정리 + codebase-memory

- **관리자 평생리포트 수동 부여(PR 예정, branch feat/admin-grant-lifetime-report)**: super_admin이 유저의 특정 사주 결과에 lifetime-report 권한 부여. 설계 `docs/superpowers/specs/2026-06-30-admin-grant-lifetime-report-design.md`. SDD 백엔드+프론트 각 task-review clean.
  - 백엔드: `AdminAction`에 `grant_lifetime_report` 추가; `src/lib/admin/user-readings.ts`(`listUserReadingsForAdmin`+`buildReadingLabel`, readings.ts에 `ReadingRow`/`mapReadingRow` export 추출=behavior-preserving); `POST /api/admin/lifetime-report/grant`(super_admin 가드→getReadingById→**소유자 검증**→readingKey=toSlug 서버도출→grantLifetimeReportEntitlement{amount:0} 멱등→logAdminAccess). 평생리포트는 reading 단위 스코프(`lifetime:{readingKey}`)라 결과별 부여.
  - 프론트: `grant-lifetime-report-actions.tsx`(결과 드롭다운+✓보유중+사유, /admin/users/[id] 환불·운영 탭). readingKey는 클라 미전송(readingId만).
  - 신규 결제상품·마이그레이션 0. v1 부여만(revoke 제외). Minor(비차단): listUserReadingsForAdmin N+1 hasLifetime 조회.
- **dead-code 정리(PR #570)**: 미사용 19파일 삭제(메인 리디자인 잔재 8 + 옛 컴포넌트 11). ripgrep 심볼+경로 교차검증(codebase-memory 그래프 OPTIONAL MATCH count가 관계 미바인딩으로 못 씀). −2,443줄.
- **codebase-memory**: ganji-saju 인덱싱(11,826노드) + auto_index on + 협업자 온보딩 문서(PR #569). detectComprehensiveSinsals 핫패스=오탐 확인(루프 4지지 고정상수, O(1)).

---

## 2026-06-30 세션 (Claude) — 코인→카드+멤버십 전환 Phase 1+2 머지 + Phase 3 설계

> 코인충전 PG차단/전금법 이슈 → 코인 발행 중단+멤버십 정액이용권화. **Phase 1+2 머지 완료(PR #563, main CI 그린)**. Phase 3(페이월 카드/멤버십 재배치+코인카피 정리) 계획 수립.

- **Phase 1+2 (머지됨, PR #563)**: 코인 발행 중단(충전 410·가입보너스0(057, user_credits 행은 유지)·멤버십 코인미지급·관리자차단·/credits 잔액화) + 멤버십 정액이용권화(MEMBER_QUOTAS premium 상세/달력 무제한·대화일5·궁합월3 / plus 3·1·2·1, getMemberTier, 상세풀이/달력/궁합 멤버십 게이트, 카피 재표현). 코인 차감은 레거시 잔액 소진용 유지. SDD 18태스크 전부 task-review + opus whole-branch 리뷰(머니패스 SOUND) + 172 node·103 vitest·E2E 그린.
  - 머지 전 review-driven fix 2건: 상세풀이 게이트를 고아 detail-unlock→**라이브 unlockTodayFortunePremium(오늘 자세히보기)**로 이전; 관리자 가입카운터를 admin_user_summary.signup_at으로 repoint(057 후 signup_bonus 0 회귀 방지).
  - ⚠️ 057 마이그레이션 supabase 수동 적용 완료(사용자). 법무/PG 확인은 별도.
- **⭐ Phase 3 핵심 정정(2회 오판 끝 확정)**: **상세풀이·달력 카드 단건상품은 신규 제작 불필요 — 이미 존재**. 상세풀이=`taste_today_detail`('today-detail' 9,900), 달력=`monthly-calendar`. 코인경로(credit_transactions kind)와 카드경로(product_entitlements)가 동일 콘텐츠 두 결제경로, 수렴=`resolveTodayFortuneUnlockAccess`(today-detail) / fortune-calendar unlock(달력). 오판 원인: 코인 접근체크와 카드 entitlement 체크가 다른 함수에 분리.
- **Phase 3 계획**(`docs/superpowers/plans/2026-06-30-phase3-paywall-card-membership.md`): Wave0 인프라 → Wave1 페이월 → Wave3 카피정리. 신규상품·마이그레이션 0. 가정: 상세풀이 per-day 유지, 비회원=비구독 로그인, 코인 fallback 잔액소진까지 유지.
- **Phase 3 실행 완료(PR #564 예정, branch feat/phase3-paywall)**: SDD 12커밋, 전부 task-review + **opus 최종 whole-branch 리뷰 = DEPLOY 안전(머니패스 SOUND, Critical/Important 0)** + 114 vitest·172 node·build 그린.
  - Wave0 인프라: `userHasLegacyCoins`(balance>0) + entitlement route/hook에 `hasLegacyCoins`·`memberFreeEligible`(premium 무제한/plus 쿼터잔여/covered=today-detail·monthly-calendar) read-only 노출.
  - Wave1 페이월(멤버 인지 3분기): premium-lock-card(오늘자세히)·fortune-calendar-panel(달력, 402→/membership/checkout)·dialogue-chat-panel(대화=멤버십전용). 멤버="멤버십에 포함·바로 열기"(결제 CTA 0), 비회원=멤버십우선+카드9,900, 코인은 hasLegacyCoins만.
  - Wave3 정리: 전역 stale 코인충전 CTA→멤버십/잔액(site-header·today-detail·membership-section·my/billing·home dock·credits success/loading/layout), **subscription-manager 멤버십버튼 /credits 오링크 버그 수정→/membership**, 상담예약 가짜 100코인 경제 전면 제거(api 무차감)·정책 v1.1, pricing 코인팩 섹션 제거, stale 주석/토스트(550원·1코인)·faq '코인 자동충전' 정정.
  - 범위 외 보류: T6/T8(궁합·saju premium 멤버십 CT**추가**=폴리시), T7(점수 가격 550 vs 9,900 코드 충돌=확인필요 블로커).
  - ⚠️ Fast-follow(최종리뷰 Minor, 비차단): ①premium-lock-card 멤버 플리커 ②bundled-policies 코인정책 문구 ③cancelled grace 의미 — **전부 PR #567에서 처리**(아래).
- **Phase 3 follow-ups (PR #567, branch feat/phase3-followups)**: 백로그 정리. opus 최종 whole-branch 리뷰 SAFE AS-IS, npm test 172/172.
  - **해지예약(cancelled) grace 실버그 수정**: billing UI가 "해지예약해도 기간 끝까지 혜택 유지" 명시 약속하나 코드는 즉시 회수했음. `isEntitledStatus`(active||cancelled)로 멤버십 게이트 전체(isPremiumMember/isPlusMember/getMemberTier) + saju-premium·yearly-interpret 게이트까지 통일(FU1+FU6). expireIfNeeded가 renews_at 경과 시 expired로 정규화 → cancelled=grace 내. 알림 만료리마인더·재구매차단은 의미상 active-only 유지.
  - premium-lock-card entitlement 로딩 중 결제 CTA 차단(멤버 플리커 과금 race 방지, FU2). 궁합 페이월 멤버십 업셀 CTA(FU3). 코인정책 문서 v1.1.0 충전종료 반영(FU5).
  - T7 점수 가격: **코드 변경 0** — score-total=9,900 이미 일관(catalog=배포진실; 메모 550은 #456 이전 stale), 메모리만 정정.
  - 의도 보류: FU4(평생리포트 멤버십 CTA) — 멤버십 혜택 아니라 '포함' 오인 우려로 skip.

---

## 2026-06-30 세션 (Claude) — 결제 버튼 포커스 체크아웃(하단 진짜 고정 CTA) + sticky 잠복버그 수정

> 피드백: "결제 버튼이 너무 하단에 있어 결제가 불편". 멤버십/단품 체크아웃·코인충전 양쪽 적용. tsc + next build(EXIT 0) + Playwright 렌더/측정/상호작용 검증 그린. 아직 PR 미생성(로컬 변경).

- **발견(검증 완료)**: 기존 코인충전 "sticky" CTA 는 **실제로 고정돼 있지 않았음**. `motion-page-transition-frame`(`will-change: transform`)·`app-shell-content`(애니메이션 잔여 `transform: matrix(1,0,0,1,0,0)`)가 `position:fixed` containing block 을 가로채 CTA 가 뷰포트가 아니라 **콘텐츠 끝**에 붙음(맨 위에선 안 보임, 끝까지 스크롤해야 보임). Playwright 측정 `pinnedToViewport:false`(top=2354 / vh=844). → 사용자 "버튼이 멀다" 피드백의 실제 원인.
- **해법(코드베이스 검증 패턴)**: 모바일 dock·"맨 위로" FAB 이 쓰는 `createPortal(→document.body)` 방식으로 CTA 를 body 에 직접 mount → 진짜 viewport 고정 보장. 공용 컴포넌트 **`src/components/payments/sticky-checkout-cta.tsx`** 신설(멤버십·코인 공통).
- **포커스 체크아웃**: 결제 라우트(`/membership/checkout`·`/credits`·`/pay`)에서 하단 글로벌 dock + 스크롤 FAB 숨김 → CTA 하나만 하단 고정(이탈/주의분산↓, 토스·쿠팡 표준). 라우트 판정 **`src/shared/layout/focused-checkout.ts`**. site-header MobileChrome(dock portal gate)·scroll-to-top-button(usePathname gate) 수정. 비결제 라우트(홈·/membership)는 dock/FAB 정상 유지(회귀 검증).
- **법적 순서 보존**: 결제수단·동의 체크박스는 흐름상 위에 유지(전자상거래법 결제-전-동의). 버튼만 하단 고정. 동의→버튼 활성 흐름 정상(상호작용 테스트: 비활성"결제 전 동의가 필요합니다"→`전체 동의`체크→활성"49,000원 카드로 결제하기").
- 멤버십 체크아웃 `footer={false}`(코인 페이지와 동일, 고정 CTA 와 footer 겹침 방지). 콘텐츠 하단여백은 `.app-shell-with-navigation`의 `--app-mobile-dock-clearance`(8rem)가 확보 → 별도 spacer 불필요.

### 2차: 비결제 고정 CTA 4종 동일 버그 정리 + 공용 컴포넌트화
- 공용 컴포넌트 일반화: `sticky-checkout-cta.tsx` → **`src/components/ui/sticky-bottom-bar.tsx`**(`StickyBottomBar`). `variant`: `'bottom'`(결제 등 dock 숨김 라우트=화면 맨 아래) / `'above-dock'`(기본, dock 보이는 일반 페이지=dock 바로 위). above-dock 은 dock 높이를 **런타임 실측**(getBoundingClientRect, 측정 전엔 `--app-mobile-dock-clearance` fallback 으로 겹침 방지; ResizeObserver+resize 갱신)해 flush 배치(폰트배율·safe-area·reading-comfort 자동 대응). 결제 2곳(멤버십·코인)은 `variant="bottom"` 으로 전환(재검증 OK).
- 적용 4종(전부 dock 유지, `above-dock`): `dialogue/appointment`(예약 확정)·`my/settings/delete-account`(이전/계속/탈퇴)·`reset-password`(비번변경)·`compatibility/input`(궁합 보기). Playwright 실측 `sitsAboveDock:true`(barBottom=736=vh844−dock108)·`visibleAtTop:true`.
- 엣지케이스: **reset-password** 는 `type="submit"`(form 내부) → portal 로 form DOM 밖으로 나가므로 `<form id>`+버튼 `form="..."` 연결로 네이티브 submit 유지. **compatibility/input** 은 기존 `md:static`(모바일 fixed/데스크탑 inline) 유지 위해 모바일 portal 바(`md:hidden`)+데스크탑 인라인(`hidden md:block`) 분리. delete-account 은 form 없음(onClick) — 안전.
- 비결제 페이지는 dock·"맨 위로" FAB 그대로 유지(포커스 라우트 아님). FAB 이 CTA 바 우측에 약간 겹침은 기존 동작.

### 추가: 나이스페이 "카드전용" 제약 — 코인/멤버십 영향 분석 + 전환 계획(미실행)

> PG(나이스)가 사주업종에 카드결제만 허용, 코인충전·정기결제·계좌이체·가상계좌·휴대폰결제 금지 통보. 병렬 조사 워크플로(코인 코드맵·멤버십 코드맵·규제 리서치) 후 종합. 분석=`docs/payments-card-only-restructure.md`, 구현계획=`docs/superpowers/plans/2026-06-30-coin-to-card-membership-migration.md`.

- **핵심 진단(코드 확인)**: 멤버십은 빌링키 자동결제 아님 = "30일권 1회 카드결제"(빌링/재청구 미구현 dead code) → 카드전용과 정합, 생존. 단건상품(taste_*/lifetime/bundle)·궁합은 이미 코인 미경유 카드 직접결제 → 생존. **진짜 문제는 코인충전(stored-value 선불충전) 한 곳** — PG 차단 1순위 + 유일한 법적층(전금법 선불전자지급수단; 자가형/소액예외 면제, 초과 시 등록의무·형사).
- 코인 실제 차감 기능은 3개뿐: 상세풀이(10)·달력(10)·대화상담(3턴/3코인). compat·daewoon 은 정의만·미차감.
- **사용자 결정(2026-06-30)**: ①A+C 하이브리드(코인 폐지+카드 직접결제+대화는 멤버십 쿼터) ②코인 끄기는 "계획 확정 후 한꺼번에"(지금 미적용) ③기존 잔액=만료일까지 소진 유예(환불X) ④멤버십=코인지급→정액 이용권(premium 상세/달력 무제한+대화 일5턴+궁합 월3회 / plus 소량 쿼터).
- **전환 계획 4 Phase**: ①신규 코인 발행 중단(충전 410·가입보너스0·멤버십 코인지급중단·관리자차단·/credits 잔액화) ②멤버십 정액이용권화(기존 `consumeMemberBenefit` 쿼터엔진 확장+멤버십 게이트 삽입) ③비회원 페이월을 카드/멤버십으로(코인옵션은 레거시 잔액자만) ④정리·E2E. 코인 차감경로는 레거시 잔액 소진용으로 유지.
- ⚠️ 실행 전 필수: 나이스 심사팀(차단 사유코드)·전자금융 변호사(선불수단 등록의무) 확인. 정기결제·휴대폰결제는 범위 밖(별도 PG 트랙).
- 상태: **분석·계획만 완료, 코드 미실행.** 멤버십 plus 쿼터 수치는 계획서 "제안 쿼터" 표에서 확정 필요.

---

## 2026-06-28 세션 (Claude) — 대화 충전CTA·결제실패 재시도·코인 만료보정 테스트·코인 수동지급·관리자 콘솔 (#529~#534)

> 결제/코인/어드민 라운드. 전부 main 머지·배포. 각 PR tsc+next build+npm test+CI+E2E 그린 확인 후 머지.

- **#529 대화방 코인충전 CTA**: 3회 무료 소진+`insufficient_credits` 시 하단 안내에 "코인 충전 바로가기"(/credits) 링크. `needsRecharge` 상태(전송시작·프리셋 리셋). dialogue-chat-panel.tsx.
- **#530 결제 실패 '다시 결제하기' 회귀**: 실패페이지 버튼이 상품 무관 `/credits`(코인충전) 하드코딩 → 상품결제 실패도 충전창으로 오라우팅. 주문 `metadata.checkoutPath`(prepare 저장 원결제 경로)를 nicepay return 핸들러가 `retry`로 동봉 → fail 페이지가 원래 상품으로 복귀. 적용: 인증실패/서명실패/금액불일치/승인실패(미청구 안전). 미적용(이중청구 위험): 이미연결·지급실패(청구됨). open-redirect 차단(내부 절대경로만).
- **#531 코인 표시 만료보정 테스트**: 마이페이지 코인=`dashboard.credits.total`=비만료 `credit_lots` 합+`subscription_balance`. 기존 `.gt('expires_at',now)` DB필터 단일의존 → `sumNonExpiredLots()` 순수함수 분리(JS 이중가드) + 7케이스 회귀테스트(경계=now 제외·null 제외·전부만료=0). lib/credits/lot-balance.ts.
- **#532 어드민 코인 수동지급**: 유저상세 환불·운영 탭에 "코인 수동 지급" 카드(super_admin). `validateGrantCredits`(정수·양수·상한1000·type·사유) 9테스트 + POST /api/admin/credits/grant → addCredits RPC(purchase=1년만료/subscription=무만료) → logAdminAccess('grant_credit'). paymentKey 미주입(멱등스킵 방지). 회수는 환불(deduct_credits).
- **#533·#534 관리자 콘솔**(설계: docs/admin-console-design.md): 진단=기능 13섹션 풍부하나 `/admin` 랜딩·내비 부재(고립된 섬). **#533** 영속 내비(lib/admin/nav.ts config + 사이드바/모바일 햄버거 components/admin/admin-nav.tsx + layout role기반, operations 인라인 내비 제거) 8테스트. **#534** `/admin` 랜딩 대시보드(getAdminDashboardSummary=운영+퍼널+LLM 스냅샷+대기건수(환불/후기)+활동피드 통합, 오늘/누적 KPI·전환율·만족도·14일 스파크라인·기간토글7/14/30·사용자검색·섹션 바로가기).

---

## 2026-06-23~24 세션 (Claude) — 꿈 RPC·파일럿 + 메인 캐릭터 카드 + 9,900원 단일가·코인팩 + 라이트 멤버십 폐지 + 메인 리디자인(claude_design) + 붓글씨 로고·별자리 이동 (#453~#475)

> 꿈해몽 Phase 0 마무리(#453) → 꿈 사전 파일럿 20(#454) → PPTX 시안 기반 메인 8카드 개편(#455) → 가격 9,900 통일+코인팩(#456). 전부 main 머지·배포.

### #453 꿈 무결과 로깅 RPC 잠금
- `record_dream_search_miss` anon/authenticated EXECUTE 잔존(REVOKE FROM PUBLIC 부족) → `REVOKE EXECUTE FROM anon, authenticated`(055). `db query --linked`로 권한 직접 검증(anon/auth=false, service=true).

### #454 꿈해몽 사전 파일럿 20개 (305→325)
- LLM 배치 생성→적대적 가드 자가검증(4건 수정)→결정론 재검증(한자·공포어·신조어·중복·스키마 0)→렌더 품질. 흔한 누락 키워드(시체·화장실·귀신·태풍 등). LLM은 오프라인 1회 생성, 서빙은 결정론 사전(쿼리당 비용 0).

### #455 메인화면 캐릭터 카드 개편 (PPTX 시안 slide3)
- 메인 서비스 영역을 8개 캐릭터 일러스트 카드(사주·대운·택일·궁합 / 꿈해몽·대화상담·무료타로·무료운세)로. 각 카드 = 캐릭터 + 메뉴명 + 후킹 카피 + "바로 확인하기". 8개 메뉴 라우트 전부 기존 존재(신규 개발 0). 카테고리 탭·무료액션 분리 섹션 제거. 별자리·띠운세는 그리드 제외(라우트·진입 보존).
- 이미지 최적화(sharp): 원본 ~2MB → avif 30~156KB·webp(90%+ 절감). picture(avif/webp/png) 직접 서빙. 변환본만 커밋.

### #456 소액상품 9,900원 단일가 통일 + 코인팩 재편
- **전략 결정**: 표시만 vs 결제가 → "소액상품 결제가 9,900"(결제 정합 우선). 코인 경로 충돌(고정 차감) → 코인 차감 비례 + 코인팩 재편.
- catalog 10개 소액상품 price → 9,900(결제 단일 출처). 표시 라벨 19파일 동기화(워크플로) — 표시≠결제 불일치 0. 번들 거짓원가·"소액 풀이" 포지셔닝 정리.
- 코인팩 재편: credit_1/3/7(소액) 폐지 → **credit_15(9,900원=15코인, 50% 보너스)**. 상품 차감 10코인. 9,900 팩으로 상품 1개+5코인 여유(코인 우대·충전 한계 해소).
- 유지: 멤버십(4,900/9,900월)·평생리포트(49,000).

### #457 코인팩 2종 추가 + 라이트 멤버십 폐지
- 코인팩 추가: credit_40(19,800원=40코인, 495원/코인)·credit_100(44,900원=100코인, 449원/코인). 벌크 우대(15코인 660 > 40코인 495 > 100코인 449원/코인).
- 라이트 멤버십(basic, 4,900원) 신규 판매/노출 중단: PLAN_BLUEPRINT에서 basic 제거 → 멤버십·pricing 라이트 카드 미노출(렌더 확인). faq·billing·subscription-manager 문구 일반화. **plan 'basic' 타입·MEMBERSHIP_PACKAGE_BY_PLAN·CHECKOUT_PLAN_GUIDE(Record<PlanSlug> 제약)·구독 해지/재개·기존 구독자는 레거시 보존**. catalog membership_plus 유지(직접 URL 외 노출 0).
- E2E(payment-blocks) 프리미엄 구독 기준으로 수정(라이트 폐지로 "이용 중" 배지 단언 깨진 것 — 정당한 회귀).

### #458 메인 리디자인 적용 (claude_design MCP)
- claude_design MCP(DesignSync)로 "간지사주 메인 리디자인.html" import → 메인화면 적용. [적용 가이드.md] 원칙: 라우팅·데이터·이벤트 불변, 시각 레이어만.
- 카드 UI: 세로 큰이미지(#455) → 가로 레이아웃(원형 아바타 + 텍스트 + 파스텔 틴트 7색). 원형 아바타는 기존 캐릭터 이미지 object-top 재활용(에셋 추가 0). 디자인 카피·틴트로 desc/필드 갱신.
- 홈 구조: 배너 캐러셀(현재 데이터) → 카테고리 칩 복원(#455에서 뺀 것) → 8카드 그리드 → 신규 유저 CTA. 별자리 slot·하단 독 유지.
- 가격 라벨 현재값 유지(디자인 '대운/택일 9,900' 표기는 시안 단순화 — 실제 무료 허브라 '무료' 유지, 표시≠결제 오해 방지).
- 배너 이미지는 사용자가 별도 제작 전달 예정 → 캐러셀 골격 + 현재 배너데이터 유지.
- **claude_design 연결**: get_project로 design-system 스코프(user:design:read/write) 자동 인증 — /design-login 불필요.

### #459 헤더 붓글씨 로고 + 별자리 slot 이동
- 헤더 로고: 한자 인장(干)+텍스트 → 사용자 제공 붓글씨 "간지사주 9,900원" 이미지(picture avif 12KB/webp/png, trim+120 최적화, 표시 28px). 전역 헤더(app-top-brand).
- 메인 별자리 slot(MyStarSignCard): 배너 아래 → 신규 유저 CTA 다음(푸터 직전) 이동(로그인 사용자 노출).

### #460 데스크톱 메가내브 로고도 붓글씨 (#459 후속)
- #459가 모바일/태블릿 헤더(app-top-header, lg:hidden)만 교체 → 데스크톱(lg+)은 mega-nav 별도 헤더라 옛 로고(干) 잔존. mega-nav-logo 도 붓글씨 이미지로 통일. (교훈: 헤더가 반응형 분기로 2개 — 한쪽만 바꾸면 다른 뷰포트에서 안 보임)

### #461 대운·택일 카드 9,900원 + 4메뉴 결제 경로 검증
- **검증(워크플로 4메뉴 적대적)**: 사주(score-total)·궁합(compat-reading)·대운(year-core)·택일(monthly-calendar) 결제 플로 전부 정합(prepare 금액=catalog → confirm 불일치 거부 → fulfillment scope grant → 접근게이트). catalog 단일 출처 9,900 → 표시=결제 자동 일치.
- "slug=null → global 권한" 적대적 가설 → prepare L87 가드(requiresSlug && !slug → 400)로 **기각**(안전).
- 수정: 대운·택일 카드 '무료' → '9,900원'(year-core·monthly-calendar catalog 9,900과 표시 일치). href 유지(/daewoon·/taekil 무료 예시 + 9,900 결제 CTA). → 사주·대운·택일·궁합 4메뉴 모두 9,900.

### #462 전역 폰트 ×1.15 확대
- "전체적으로 폰트가 작다" 피드백 → px 폰트 전역 비례 확대. text-[Npx] 2,547곳 + 인라인 fontSize 36곳 ×1.15(163파일, 소수1자리 반올림). 루트 font-size는 미변경(rem spacing 동반 확대 회피 — '폰트만' 키움). 오버플로 게이트 10/10 통과·렌더 확인.

### #463 제목 폰트 확대 + 정렬/박스 전수조사
- "제목은 안 커져 어색 / 정렬·박스 안 맞음" 피드백. #462가 text-[Npx]만 ×1.15 → Tailwind 시맨틱 클래스(제목 text-2xl 등)는 미반영이었음. **Tailwind 텍스트 클래스(text-xs~5xl) 526곳 한 단계 ↑**(61파일, font-size+line-height 세트 유지 → 정렬 안전). base.css h태그엔 font-size 없음(className 따름)이라 클래스 ↑가 정답.
- 정렬/박스: 워크플로 9그룹 전수조사. 박스 대부분 패딩/min-height 기반이라 폰트 흡수 → 명백한 깨짐만 보수 수정(leading-none→tight: CJK 한자 글리프 상하 잘림 / 고정폭 배지 w-16→min-w-16 / footer dt minWidth 등). 게이트 10/10·렌더(pricing·dream) 정상.
- ⚠️ 인증/데이터 표면(사주·궁합 결과)은 게이트 자동 커버 못 함 — 로그인 시각 점검 권장.

### #464 오늘 자세히보기 — 매일 오늘 일진 기반 (결제 가치 회복)
- 버그: "오늘 자세히보기"(결제) 풀이가 매일 똑같음. 실측(같은 사주·다른 날짜 4개)으로 확정 — 본문 80~90% 사주 고정, 오늘 일진은 element 형용사로만 약하게 반영.
- 근인: 오늘 일진(60갑자) 메시지 라이브러리(pickIljinMessages, 412줄)를 free 만 쓰고 결제 premium 은 안 씀(아이러니: 무료가 유료보다 오늘 반영 큼).
- 수정: premium 빌더에 todayIljinReading 통합(발동 케이스 50종 — 천을귀인·충·삼합·도화 등, topN=5, seed 'premium' prefix). 일진 점수도 노출(매일 변동). today-premium-panel 에 "오늘의 흐름 풀이" 섹션. 회귀 테스트(5날짜 고유≥3).
- 실측: 4날짜 메시지 전부 다름, 점수 95/95/95/67.

### #465 일진 메시지 250문장 plain 톤 통일
- #464 후속. 일진 메시지에 명리 전문어(용신·삼합·천을귀인·겁재 등) 많아 거부감 → naming-policy "알아들을 수 있는 문장".
- 250문장(50케이스×5) plain 재작성(워크플로 5그룹 병렬). 십성·신살·합충형해·용신/기신 → 쉬운 일상어, 한자 0. 변수([이름]/[오행])·길흉·5변형 다양성 보존. "[오행] 기운"은 허용.
- 가드 테스트: ILJIN_MESSAGE_LIBRARY 전체 명리 전문어/한자 0. (조립: 워크플로 반환 → node 스크립트로 객체 재생성, 같은 파일 동시 Edit 충돌 회피)

### #466 메인 카드 인물 사진형(시안 C) + 상단 이미지 배너 4종 (20260625 PPTX)
- 시안 2~3개 렌더 비교(card-samples 임시 페이지) → 사용자가 시안 C 선택. (Claude Read 이미지는 사용자에 안 보임 → Downloads 복사 + 합성 비교본으로 전달하는 패턴 확립)
- 카드: 가로 원형 아바타 → 인물 사진 풀블리드 세로(3:4) + 비네팅 + 하단 외곽선·그림자 강조 텍스트(가독성). 인물 PNG(배경 제거) 7종 최적화 → public/images/gangi/people. 택일은 사진 미제공 → 기존 캐릭터 임시 placeholder. 인물 이미지는 추후 같은 경로로 덮어쓰기 교체.
- 배너: 동적 텍스트 배너(AI/띠/별자리) → 사용자 제작 이미지 배너 4종(3:1, picture 풀블리드). GangiHomeBanner.image 분기, getHomeBanners→GANGI_HOME_BANNERS. 동적 로직 git history 보존.

### #467 메인 카드 인물 사진 8종 정식 교체 (택일 포함)
- 사용자 제작 인물 사진 8종으로 전체 교체(#466 임시 7종 + 택일 placeholder → 정식 8종). 사주(할머니)·궁합(홍한복)·대운(백발 도사)·꿈해몽(도복)·대화상담(보라)·택일(오방색)·무료타로(자주)·무료운세(황룡포).
- 각 560×720 cover/top, avif 26~76KB. 경로·구조 동일(people/{id})이라 카드 코드 무변경, 에셋만 덮어쓰기 — 인물 이미지 교체 워크플로 확립.

### #468 HOT·추천 배지를 사주·대운으로 이동
- 무료타로(HOT)·무료운세(추천) → 사주(HOT)·대운(추천). 주력 유료 메뉴에 강조 배지. card.tag 4곳.

### #469 상단 꿈해몽 배너 추가
- 사용자 제작 꿈해몽 이미지 배너(2.69:1) 캐러셀 5번째 추가. href /dream, avif 30KB. (이미지 비율 다르나 3:1 cover로 텍스트·핵심 노출.)

### #470 보너스 36코인(9,900원) 상품 삭제
- subscription_30('보너스 36 코인', 9,900원/36코인, kind subscription) 제거. catalog + 전 참조처(dialogue/appointment·pricing·credits·toss 코인팩 목록, credits desc, BONUS_COIN_PACKAGE fallback) 정리. 코인팩 credit_15/40/100 3종만. 관련 테스트 2개 제거. 과거 결제 이력 영향 없음(신규 경로만 제거).

### #471 꿈해몽 배너 1,900원 가격 제거
- #469 배너에 '1,900원' 박혀 표시≠결제(/dream 무료) 오해 → sharp 로 '1,900원'만 박스 내부색(rgb 58,48,115)으로 덮어 제거('꿈 한 단어 풀이' 유지). 노랑 잔여 픽셀 0 검증. (픽셀 스캔으로 글자 좌표 정밀 측정 → composite 사각형 패턴 확립.)

### #472 오늘 자세히보기 10코인 표시 정정 + 묶음 19,800원
- **표시≠실제 버그 발견**: 오늘 자세히보기는 unlockTodayFortunePremium → deductCredits('detail_report')로 **실제 10코인 차감** 중인데 표시만 '1코인'이었음. 사용자 '1→10' 요청이 불일치 해소와 일치.
- coinCost 1→10(build-today-fortune free/premium, types coinCost:1→number). UI 전 노출(premium-panel·premium-lock-card 동적+옵션·detail-client 메시지·credits·verification) + audit 테스트 10.
- 묶음(bundle_today_set = today-detail + 점수 6종 7개) 9,900→19,800원. premium-lock-card 묶음 버튼/설명 동기화.

### #473~#483 나이스페이(NICEPAY V2) 결제 — 프로덕션 가동+취소회수+admin환불+문구중립화 완료 (토스 입점 심사 지연 대비)
- 결정(공식 문서 github.com/nicepayments/nicepay-manual 검증): **서버승인 + Basic 인증**(현행 토스와 동일 패턴). docs/payment-nicepay-migration.md.
- #473 어댑터 스캐폴드: provider.ts(PAYMENT_PROVIDER 스위치, 기본 toss) + nicepay.ts(Basic base64(clientKey:secretKey) + SHA256 hex 서명 + 승인/취소/조회). 가드 테스트(서명·변조거부).
- #474 서버승인 returnUrl 라우트(/api/payments/nicepay/return): authResultCode→signature 검증→orderId 주문조회(cross-site user세션X)→금액정합→approve→**TossPaymentObject 호환 어댑팅으로 기존 fulfillment 무변경 재사용**. PaymentOrderSource 'nicepay-return'.
- #475 결제창 분기(nicepay-checkout.ts SDK 동적로드+AUTHNICE.requestPay) + prepare 응답 provider + credits/membership 결제창 분기 + credits/success(confirm 스킵) + credits/fail.
- #476 **운영 실결제 E2E 검증 완료**(Vercel Preview, api.nicepay.co.kr). 검증 중 발견·수정: (1) **clientKey/secretKey trim** — env 복사 시 딸려온 trailing 탭(\t)이 Basic 인증 clientId 오염 → 승인 401 U116 반복(진짜 원인, 서명은 깨끗한 콜백 clientId 써서 통과했음). (2) success '+0 코인' → returnUrl이 credits 쿼리 전달. (3) fail 빈 화면 → AppShell 래핑.
- #477 **취소 통보 웹훅**(/api/payments/webhook/nicepay): 취소 통보→멱등(recordPaymentWebhookEvent 재사용)→결제재조회 backstop→주문 canceled+코인 회수(addCredits 음수, fulfilled만). 콘솔 '결제데이터통보' URL 등록 필요.
- ⚠️ 후속(샌드박스 E2E): 통보 payload/서명식·취소상태문자열·회수정책(음수잔액/부분취소)·멤버십/단품 success 정합·가상계좌·구독 빌링키.
- 환경변수: NEXT_PUBLIC_NICEPAY_CLIENT_KEY·NICEPAY_SECRET_KEY·NICEPAY_API_BASE(운영=api.nicepay.co.kr)·PAYMENT_PROVIDER=nicepay. **운영 상점 키는 R2_ prefix(푸꼬컴퍼니); 운영 키↔운영 API 일치 필수**(sandbox-api에 운영키 보내면 U116).
- #478 취소 웹훅 응답 plain text 'OK'(나이스페이 등록 규약 — JSON이면 "OK 문자열 응답" 안내로 등록 실패) + GET 핑 핸들러.
- **프로덕션 가동 완료(2026-06-26)**: Production env 4종 + 콘솔 통보URL(ganjisaju.kr/api/payments/webhook/nicepay, 200/OK) 등록 + ganjisaju.kr 실결제→나이스페이 결제창→충전 정상 확인(프로덕션 nicepay/return 303). PAYMENT_PROVIDER 미설정/오타 시 toss로 안전 복귀.
- #479~#481 취소→코인 회수 실거래 검증·수정: #479 통보 status 진단(form 아닌 **JSON**, status='cancelled')+partialCancelled 회수대상 추가, #480 **회수 RPC 버그 수정** — addCredits(음수)는 add_credits(양수 lot 적립) RPC라 차감 안 됨(조용히 실패) → deduct_credits 기반 revokeCredits 신설, #481 진단로그 제거(회수 실패만 운영로깅). **전체 E2E(결제·충전·취소·회수) 프로덕션 검증 완료**. (회수 상세 [[credit-refund-revoke]])
- #482 결제 문구 PG 중립화: 사용자 노출 '토스 결제/토스페이' 7곳(checkout 로고T→💳·라벨·안내, credits 안내·에러, complete 수단라벨, faq 처리시간) → 카드·계좌이체. 결제수단 코드(CARD/TRANSFER)·SDK 무수정. operations/payment-funnel은 결제 type 기준이라 PG 무관(나이스페이 자동 포함).
- #483 admin 환불 나이스페이 대응: 기존 admin/refund 가 토스 cancel 전용 → 나이스페이 결제 환불 실패. prepare createPaymentOrder metadata.provider 저장 + getOrderProviderByPaymentKey(payment_key→provider, 없으면 toss) + refund tossCancel deps PG 분기(nicepay=cancelNicepayPayment, 옵션 매핑·idempotency 멱등). ⚠️ provider 저장은 #483 이후 신규결제부터(기존 나이스페이 결제 환불은 콘솔 취소). 토스 경로 무수정.
- ⚠️ 잔여: 부분취소 비례 회수·음수잔액 정책·가상계좌·구독 빌링키·나이스페이 already-canceled backstop. test/nicepay-sandbox 브랜치 삭제완료, Preview env(사용자 대시보드 정리).

### 데이터 초기화 — 실운영 전환 (2026-06-26, 실행 완료)
- 실유저 없음 확인 후 테스트 데이터 전체 초기화. **유지**: 가입/로그인(auth.users·profiles)·관리자(admin_*)·콘텐츠(classic_* 13)·약관(policy_versions)·동의(user_policy_consents)·알림설정(notification_preferences·push_subscriptions)·가중치(sinsal_weight_versions). **초기화**: 결제(payment_*)·코인(user_credits·credit_lots·credit_transactions)·구독·권한(product_entitlements)·풀이(readings·dialogue_messages)·AI(ai_* 7)·결과스냅샷·피드백·예약·리뷰·즐겨찾기·family_profiles.
- SQL: **docs/data-reset.sql**(#484) — TRUNCATE CASCADE(유지대상은 auth/policy/classic만 참조라 미연루). 백업·외부PG·검증 절차 주석 포함. ⚠️ 외부 PG(나이스페이/토스) 실제결제는 DB와 별개 — 환불은 PG 콘솔.

### UI·결제문구 후속 (2026-06-26~27)
- #485/#486 입력 폼 2컬럼→1컬럼: /my/profile 가족사주의 좁은 2컬럼에서 라벨+입력+긴 안내문이 세로로 wrap되던 문제. #485 가족사주(page 요약·내정보 폼/카드·가족목록/입력·이름·관계), #486 생년월일 공통입력(unified-birth-info-fields lg 패널). Workflow 전수 점검 — 짧은 숫자/버튼 2칸(성별·년월일·관계카드)은 의도 유지. 결과/카드형(상품·홈·결과표)은 미변경.
- #487/#488 결제 PG 문구 정리: #487 결제창 잔여 토스 문구 4곳 중립화(picker '결제 방식'·'별도 결제창', checkout 키 에러·완료 안내 — #482 후속). #488 admin PG 동적 표기 — user-detail refund fetch 에 payment_key→order provider 배치 1쿼리(N+1 회피), refund-actions PG_LABEL(toss=Toss·nicepay=나이스페이)로 취소노트·confirm 분기, payment-funnel 'confirm 실패율' 설명 PG 무관화. provider 없는 기존결제는 toss 폴백. 코드 식별자·키 변수 무수정.
- #489 결제수단 라벨 '계좌이체'→'실시간 계좌이체'(나이스페이 콘솔 명칭 일치, methods.ts TRANSFER label·shortLabel·desc). picker·결제버튼 자동 반영, method 코드(bank) 무수정.
- #490 나이스페이 계좌이체 임시 숨김 가드: 계좌이체 선택 시 **W004(결제수단 유효하지 않음)** — method 'bank'(나이스페이 매뉴얼상 유일·정확)·콘솔 실시간계좌이체 활성·카드 정상이라 **발급 clientId 에 계좌이체 미연결(키 권한)** 으로 확정(directbank 부재 교차검증). picker: provider(prop)??NEXT_PUBLIC_PAYMENT_PROVIDER==='nicepay' && NEXT_PUBLIC_NICEPAY_TRANSFER_ENABLED!=='true' → TRANSFER 숨김+카드 폴백(useEffect). ⚠️ 작동조건: **NEXT_PUBLIC_PAYMENT_PROVIDER=nicepay**(클라이언트 env, 서버 PAYMENT_PROVIDER 와 쌍). 복구: NEXT_PUBLIC_NICEPAY_TRANSFER_ENABLED=true. 실해결은 나이스페이 기술지원에 키-계좌이체 연결 요청(코드 변경 0).
- #491 결제수단 picker 단일 옵션 빈칸 제거: 계좌이체 숨김으로 카드 1개만 남을 때 sm:grid-cols-2 고정이라 빈 칸 → options.length>1 일 때만 2열, 1개면 grid-cols-1(full-width).
- #492 화면전환 스크롤 미상단 만성 재발 근본 수정(#268·#270·#391 후속, 네 번째): Workflow 5가설 다각 검증으로 근본 확정 — template.tsx page-transition(will-change:transform) 프레임에서 Next 기본 scroll-to-top 좌표 교란/누락 × ScrollReset 의 useEffect(paint 후 1프레임 지연). useEffect→useIsomorphicLayoutEffect + #해시 가드(Next 앵커 존중) + behavior:'instant' 로 수정. **세 번 재발한 메타 원인=매번 증상만 고치고 메모리 미기록** → [[project_scroll-reset-on-navigate]] 강하게 기록(재수정 전 체크리스트 포함).
- #493 로그인 시 사주 입력 단계 자동 넘어감 제거: loadSavedProfiles 가 로그인 프로필을 자동 applySavedProfile→setActiveIndex(profileStepIndex) 로 입력단계 점프 → '자동으로 넘어간다'는 버그 오인. 자동 적용 블록만 제거(hasReusableBirthDraft·hasAutoAppliedProfileRef 정리), 저장 프로필 chip(수동 '내 정보 불러오기')은 유지.
- ⚠️ 환경 이슈(반복): 로컬 `npm run build` ENOTEMPTY('.next/server' rmdir) — Turbopack 빌드캐시 충돌. .next 를 scratchpad 로 mv 후 clean build 로 우회(루트에 .next_* 잔재 금지).
- #494~#496 하단 dock full-width 바닥 bar 화: 플로팅(중앙 max-w·둥근모서리·여백)→화면 맨아래 full-width(좌우/하단 여백 0, 상단만 둥글게, safe-area inner 이동). #495 footer clearance 가 floating 시절 5.2rem 이라 dock 가림 → token(--app-mobile-dock-clearance) 통일. #496 실측 가림으로 clearance 6.75→8rem.
- #497~#498 모바일 로그인 화면: #497 게이트웨이 상단여백 180→64px(소셜/이메일 한 화면)·회원가입/비번 위·약관동의 아래·회원가입 카드/섹션 패딩 축소. #498 '간지사주' 텍스트 z-10+장식 top↑(가림 해소), 회원가입 폼 overflow 근본=생년월일 grid(gangi-birth-date-grid) min-width 270px 가 카드 밀어냄→180px 축소(양력음력/성별/시간/출생지 전부 박스 안).
- #499~#500 회원가입 폼 overflow 실측 재발(아이폰15 Pro): #498/#499(생년월일 min-width·카드 overflow-x-clip)가 무력했던 진짜 근본=app-page 가 width min(100%,88rem)+padding 1rem 인데 login(gangi-login-subpage)은 flow-polish 480px 캡(gangi-subpage)에 안 걸려 카드가 넓게 감. #500: login AppPage max-w-full+overflow-x-hidden(페이지 가로 스크롤 차단)+생년월일 grid 480px↓ 세로 1컬럼(기존 380px만). 교훈: overflow 디버깅은 자식 grid 추측보다 컨테이너 width 체인(app-page→card)부터 실측. ⚠️ login 은 gangi-subpage 가 아니라 flow-polish 480 캡 미적용(별도 처리 필요).
- **#501 회원가입 폼 overflow 진짜 근본(5번째·종결, systematic-debugging 실측)**: #498~#500 이 4번 실패한 이유 = 매번 자식 `.gangi-birth-date-grid` 만 만짐. Playwright 로 393/375/360px width 체인 실측 → 범인은 **`.unified-birth-form`(display:grid)의 base 에 grid-template-columns 가 없어 암묵적 `auto` 트랙이 컨테이너(270px)를 무시하고 max-content(842.5px)로 부풂** → 모든 자식이 843px 로 늘어 카드(330px)를 +511px 뚫음. **documentElement 가로 스크롤은 0**(카드 overflow-x-clip 이 숨김) — 그래서 기존 readability 게이트(scrollWidth 기반)가 4번 다 통과시킴(버그가 안 잡힌 메타 원인). 유일한 클램프 룰 `.gangi-subpage .unified-birth-form { minmax(0,1fr) }` 은 login(`.gangi-login-subpage`)에 안 닿음. **수정: base `.unified-birth-form` 에 `grid-template-columns: minmax(0,1fr)`**(폼은 컴포넌트에 grid-cols 없는 항상 1컬럼, `.unified-birth-form` 클래스는 실측상 login 단독 사용 → 영향범위 login 한정·.gangi-subpage 는 동일값이라 무변경). **신규 영구 게이트 `e2e/login-overflow.spec.ts`**: documentElement 스크롤이 아니라 '뷰포트 밖으로 나가는 요소(가로 스크롤 컨테이너 자식 제외)'를 직접 검출 → clip 으로 숨겨도 잡음(red 45개 → green 6/6). readability 게이트 10/10·typecheck 통과·스크린샷 1컬럼 전부 화면 내 확인.

- **#502 인증 E2E red 복구 (#484 데이터 초기화 여파, 견고 리팩터)**: saju.spec·payment-blocks 가 `#484` 머지 이후 계속 red(머지 직전 #500·#501 CI 도 Playwright failure였음). 근인 = 두 spec 이 `E2E_TEST_READING_SLUG`(영속 readings 행)을 전제했는데 #484 가 readings 를 TRUNCATE → `/saju/{slug}` notFound(`resolveReading`→`getReadingById` null). /saju 진입 테스트(saju #1·#4, payment #4)만 깨지고 /saju 안 거치는 건 정상인 것과 일치. **수정: 영속 행 의존 제거 — 보존된 프로필에서 앱 정식 슬러그(`buildProfileReadingSlug`=`toSlug(toBirthInputFromProfile)`)를 런타임 유도**. 신규 `e2e/fixtures/reading-slug.ts` 가 인증 page 로 `/star-sign` 의 "내 사주와 함께 보기" `/saju/{slug}` 링크에서 슬러그 추출(앱 로직 그대로 재사용 → /today-fortune 자동완성과 동일 입력이라 점수 일치 #4 견고, DB 행 0개여도 동작). payment-blocks #4 는 beforeAll 에서 인증 컨텍스트(storageState)로 슬러그 유도 후 `lifetime:{slug}` 시드. **CI 검증 완료: Playwright 48 passed 0 failed**(인증 테스트 실제 실행 후 전부 green). ⚠️ 로컬은 E2E creds 없어 skip → CI 전용 검증. [[reference_gh-account-for-pr]]
- **#503 인터랙티브 요소 기본 커서(손가락) 전역 복원**: "마우스 올려도 화살표가 손가락으로 안 바뀐다" 피드백. 실측 → 대부분 버튼은 pointer(shadcn Button 컴포넌트가 `cursor-pointer` 포함)지만 **bare `<button>`·`[role=button]`·`select`·`summary`·`label[for]`·체크박스는 `default`(화살표)**. 근인 = **Tailwind v4 Preflight 가 bare button 의 cursor:pointer 를 제거**(브라우저 기본). 수정: `base.css @layer base` 에 인터랙티브 요소 `:where(...) { cursor: pointer }` + 비활성 `not-allowed` 전역 기본. `:where()` 특이도 0 + base 레이어라 carousel grab(home.css unlayered)·disabled·의도적 default 같은 명시 커서는 그대로 우선(기존 디자인 무영향). 실측 검증: 홈 bare button default→pointer, 회원가입(버튼30·select5·label11·체크박스)·멤버십 전부 pointer ✓.
- #504 /saju/new 단계 '다음' 상단 스크롤(in-page step): swipe wizard step 전환은 pathname 불변→전역 ScrollResetOnNavigate(pathname 기반) 미적용. step(activeIndex) 변화마다 useEffect scrollTo(top,instant). #492(pathname)의 in-page 변형 → [[project_scroll-reset-on-navigate]] (e) 케이스 추가.
- **#505 나이스페이 결제 후 상품별 라우팅(Explore 에이전트 전수조사)**: nicepay/return 이 pkg.kind 무관 항상 /credits/success → 사주풀이(lifetime_report, credits=0)가 코인페이지로 새어 '코인0+오늘운세 무료보기'만 뜨고 풀이를 못 보던 회귀(#473~ nicepay 도입 시 toss membership/success 정합 누락, 코인결제만 정상이었음). toss(membership/success)의 우선순위 분기(taste_product→사주premium/lifetime→코인→멤버십완료)를 서버 헬퍼 resolveNicepayResultHref 로 재사용. fulfillment 결과 수신(이전 무시)+이미지급 재진입도 동일 분기. ⚠️ 실결제 경로 — 사주 소액결제 E2E 확인 권장.
- #506 나이스페이 sandbox/live 단일 토글: NEXT_PUBLIC_NICEPAY_MODE 하나로 API_BASE·clientKey·secretKey MODE별 자동선택(nicepay-env.ts 공유헬퍼; secretKey 는 서버전용 nicepay.ts·클라번들 미노출). MODE별 키 없으면 기존 단일키 폴백→무중단. PG전환(PAYMENT_PROVIDER 쌍)과 합쳐 토글 2종 → [[reference_payment-env-toggle]].
- **#507 저장 프로필(내 사주·가족) 선택 자동입력을 첫 슬라이드로 이동**: #493(로그인 시 사주입력 자동넘김 제거)에서 picker 자체는 유지됐으나 저장 프로필 선택 chip 이 마지막 step(profile/concern) 하단에 있어 "첫 화면에서 안 보이고 젤 하단에서 선택" 현상. picker 를 `renderSavedProfilePicker()` 로 추출해 첫 슬라이드(birth) 최상단으로 이동. chip 선택 시 `applySavedProfile` 가 전 항목(달력·시간·출생지·성별) 채우고 concern(마지막) step 으로 점프→바로 제출 흐름 유지. ready 카드에 "저장한 사주로 바로 채우기 · 내 정보·가족 중 선택" 헤더 추가, 익명 카드 무의미 '새 정보 입력' 버튼·중복 '직접 입력' CTA·미사용 birthStepIndex 정리. tsc 0 에러. ⚠️ 가족 chip 은 #484 데이터 초기화로 family_profiles 비워진 상태 → /my/profile 재등록 시 노출(내 정보 chip 은 profiles 유지로 즉시 표시).
- **나이스페이 실결제(live) 가동 — U116 디버깅(요약)**: 결제창·서명검증 통과 후 승인만 U116("사용자 정보 없음"). 근인=**운영 키 × NEXT_PUBLIC_NICEPAY_MODE=sandbox 불일치**(승인을 sandbox-api 로 보내 운영 TID 미존재). MODE=live 로 실결제 E2E 정상. ⚠️ `NICEPAY_API_BASE` 가 MODE 보다 우선하는 함정. 결제창 host `web.nicepay.co.kr/v3/smart` 는 UI host 일 뿐 V2 연동 정상. 진단 노출 코드는 일반 문구로 환원. → [[reference_payment-env-toggle]]
- **#512 결제 후 상품별 라우팅 — order.product 1순위(라이브 직전 치명)**: "결제 후 그 위치로 안 돌아오고 엉뚱한 창" 회귀. 근인=`resolveNicepayResultHref`(나이스페이)·토스 success 가 **주문 실제 상품(order.product)을 무시**하고 pkg/fulfillment 만 봄 → bundle 은 fulfillment.product=null 라 누수, **score-total·score-factor 는 buildTasteProductHref 분기 자체가 없어** `/membership/complete` 로 샘. 수정: ① order.product/order.plan 1순위(fulfillment/pkg 폴백) ② buildTasteProductHref 에 score-total/score-factor→`/saju/{slug}` ③ 미커버 단품은 `buildPurchasedProductHref`(=이미 구매 시 위치) 폴백 → "결제후 위치==이미구매 위치" 불변식. 나이스페이·토스 동시 적용 + 진단 노출 일반 문구 환원 동봉. tsc 0. ⚠️ "체크아웃 화면 상품 자체가 다름"(charge-side)이 남으면 결제창 URL(`?product=`)로 CTA 추적 필요 — 확인한 CTA(score-total/today-detail/lifetime)는 정상.
- **라이브 직전 전수 감사(2026-06-28) — `docs/launch-audit-2026-06-28.md`**: 5개 심층감사(결제·법무·링크·모바일·보안) 병렬 + 자동게이트(tsc 0/vitest 65 passed). **코드 수정 2건**: ① '가문 선생'(family-report 미구현) '출시 예정' 카드가 클릭 시 무효 product 로 빠지던 것 → 비클릭 라벨('준비 중'), ② 과장카피 "내 운명 확인"→"내 사주 풀이"(소비자보호). **오탐 확정**: .env.local git 커밋(=.gitignore 무시·미커밋), bundle 9,900 vs 19,800(=displayPrice 19,800 정상), ediDate/signData 포맷(=실결제 통과로 무효). **운영 확인 필요(코드 아님)**: Vercel 사업자정보 env(빌드가드 통과=충족), DB 환불정책 본문, 나이스페이 live 키/MODE. **P1 후속**: 나이스페이 웹훅 서명검증(현재 재조회 backstop), 모바일 결제모달 grid·dock :has() 폴백(실기확인 권장), admin 환불 idempotencyKey.
- **대화 메뉴 12간지 선생 → 메인 8카드 대응 8명으로 축소**: 사용자 요청 — 메인은 그대로 두고 '대화 메뉴'만 메인 8카드(사주/대운/택일/궁합/꿈해몽/대화상담/무료타로/무료운세) 대응 8명 + 별자리(별닭선생) = 9명으로. 신규 `MENU_DIALOGUE_EXPERTS`(dialogue-experts.ts, 메인 카드 순서 + 별자리: dragon·tiger·horse·sheep·snake·dog·rabbit·ox·rooster)를 ① 상단 '선생님과 대화' 드롭다운(mega-nav-data) ② /dialogue 허브 picker 양쪽에 적용. **뺀 3명(rat 성향·monkey 관상·pig 행운)은 `/dialogue/<id>` 라우트·in-chat 전환기는 유지**(직접링크·SEO 보존, 메뉴에서만 숨김). 메인 화면(GANGI_HOME_CARDS)은 무변경. tsc 0. (이전에 메인 카드를 대화로 바꾼 PR #514는 오해로 닫음.)
- **대화 선생 명칭을 서비스명으로 통일(드롭다운·허브·인사말·부제·헤더 전부)**: 사용자 요청 — '사주용선생' 류 페르소나명 제거, 짧은 서비스명(사주/명리/길일/궁합/꿈해몽/대화상담/타로/오늘운세/별자리, 숨김 3명=성향/관상/행운)으로. `DIALOGUE_EXPERTS.teacherName` 12개 값 자체를 변경 → 드롭다운·/dialogue 허브·in-chat 인사말("안녕하세요, 사주예요…")·헤더·기록 모두 자동 통일. 인사말 받침 문법은 `withCopula`(받침 유무로 예요/이에요) 보정. 드롭다운 부제는 선생명 제거하고 동작구(내 흐름 보기 등)만. 예약상담 페이지(/dialogue/appointment)도 '명리'로 통일(#517).
- **메가메뉴 정리 + 대화 선생 명칭에 '선생' 부착(서비스명+선생)**: ① 메가메뉴 운세·사주 그룹 라벨의 "· ○○선생"(오늘소선생·엠지쥐선생·사주용선생 등) suffix 전부 제거 → 깔끔한 서비스명만(오늘운세·타로 세 장·띠운세·별자리·꿈해몽·좋은 날·내 사주·궁합). ② 대화 그룹 라벨 + `teacherName` 12개를 '사주선생/명리선생/길일선생/궁합선생/꿈해몽선생/대화상담선생/타로선생/오늘운세선생/별자리선생'(숨김 3=성향/관상/행운선생)으로 → 드롭다운·허브·인사말("안녕하세요, 사주선생이에요…")·헤더·예약 전부 일치(withCopula 로 선생=받침→이에요). tsc 0.
- **빌드 깨짐 복구 + CI/E2E green(에러메일 중단)**: #512에서 토스 success(client)가 product-scope→supabase/server(next/headers)를 클라 번들로 끌어와 `next build` 실패 → **#512~#522 동안 Vercel 배포·CI·Playwright 전부 실패(프로덕션 미반영)**, push마다 에러메일. tsc 는 client/server 경계 못 잡음. **#523** 해당 import 제거로 빌드 복구, **#524** '준비 중'(가문선생 카드, #513) → '출시 예정'(incomplete-ui 금지문구)로 E2E 복구 → 양쪽 green. **교훈: 결제/페이지 변경은 tsc 아닌 `next build`까지 확인 후 머지.**
- **대화방 OpenAI 실패 — 모델명 오기**: `OPENAI_MODEL`에 표시이름 'GPT-5.3 Instant'(대문자+공백) 입력 → `400 model does not exist`(키는 정상). `gpt-5.2`로 복구→정상. 진단 패치(#525 실제 errorMessage 화면 노출)로 원인 1턴에 확정 후 #526 환원. 모델 전환은 `OPENAI_MODEL` env(소문자·하이픈 정확 id).
- **최종 전수검사(goal, 2026-06-28)**: 자동게이트(tsc 0·유닛 936 passed·next build 0) + 병렬 심층감사(결제 e2e·메뉴흐름·문구/한자-한글). 결과: **결제 배선 정상**(가격 9,900 일치·prepare/fulfillment/나이스페이 order.product 라우팅·중복차단·서명·환불 ✓; 멤버십 그리드 미게재 상품은 맥락구매로 정상=버그아님), **한자/한글 괴리 0**(toKoreanGanzi·formatTodayDateMarker 한글변환 정상, plain티어 한자0), 메뉴 흐름 정상(P2 엣지는 기존 graceful 처리). **수정**: category/iljin 메시지 단정어('절대/무조건') 31곳 완화 + 가드 테스트 추가(#527). score-total 가격은 9,900(메모리 550은 구버전).

### 교훈(추가)
- **`overflow-x:hidden/clip` 은 회귀 게이트를 멀게 한다**: 카드에 clip 을 걸면 콘텐츠가 화면 밖으로 나가도 documentElement 가로 스크롤=0 → scrollWidth 기반 게이트가 통과시켜 버그가 4번 재발. 게이트는 element 단위 boundingRect.right > viewport 로 '잘림'을 직접 봐야 한다.
- **데이터 초기화는 인증 E2E 시드를 깬다**: TRUNCATE 류 운영 작업 후 영속 행에 의존하는 E2E 는 조용히 red. 테스트는 외부 시드 대신 보존 데이터(프로필)에서 런타임 유도해 self-contained 로 만들면 재초기화에도 견딘다.
- **grid 트랙 `auto` vs `minmax(0,1fr)`**: 명시 트랙 없는 `display:grid` 의 암묵적 `auto` 트랙은 컨테이너 width 를 무시하고 max-content 로 부푼다. 단일 컬럼 폼은 base 에서 `minmax(0,1fr)` 로 클램프해야 좁은 카드에서 안전(자식 grid 만 고치면 부모 트랙 폭이 그대로 내려와 무력).

### 교훈(추가, 기존)
- **가격은 catalog 단일 출처 + UI 20+곳 하드코딩 흩어짐**: 결제가만 바꾸면 표시≠결제 인시던트. 전수 조사(워크플로)로 상품별 분류 후 일괄. 결제 정합 가드(`pkg.price !== amount` 거부)가 옛 금액 fixture를 잡아줌 → 테스트가 안전망.
- **코인 경제는 소액가 전제로 설계**: 단가 인상 시 차감·충전팩·충전한계가 연쇄 → 코인 1개 가치를 일관(990원)시켜 재설계해야 정합.

## 2026-06-22 세션 (Claude) — 마이그레이션 049 충돌 복구·타로 보관함 + 사주 점수 이용권 정체성 매칭 + 진행로그 자동화 + 텍스트 가독성(기반·결과표면) + 꿈해몽 무결과 로깅 (#448·#449·#450·#451·#452)

> 세션 재개 → 마이그레이션 장부 드리프트 복구 → 결제 버그(990 번들 ↔ 550 재청구) 근인 추적·수정 → 작업종료 자동 진행로그(이 PROGRESS.md) Stop 훅 설정. 모두 main 머지·배포.

### #448 마이그레이션 049 번호 충돌 → 타로 보관함 복구 + CI 가드
- **증상**: `tarot_result_snapshots` 테이블이 원격에 없어 타로 보관함 저장/조회가 **에러 없이 조용히** 데드(`tarot/result-snapshots.ts` 가 에러 삼킴 → console.warn 후 null/[]).
- **근인**: `049_admin_user_summary`(#402)와 `049_tarot_result_snapshots`(#401)가 같은 버전 `049` 공유 → supabase 가 admin 을 049 로 적용 후 tarot 은 "이미 적용"으로 영구 skip.
- **수정**: tarot 마이그레이션 → `053` 리네임(R100·내용 멱등). 원격 장부 정리(`repair reverted 20260607144500`=051 중복 + `repair applied 051 052`) 후 `db push` 로 테이블 생성. 원격 스키마 덤프로 6객체(테이블·인덱스2·트리거·함수·RLS enable·정책) 실재 검증.
- **재발 방지**: `scripts/audit-migration-numbers.mjs`(DUPLICATE/AMBIGUOUS/MALFORMED, --strict) + `npm run audit:migration-numbers` + ci.yml 편입. 자릿수는 강제 안 함(기존 0060/0061 혼용 보존).

### #449 사주 점수 이용권을 사주팔자 정체성으로 매칭 (번들 ↔ 게이트 이중과금)
- **증상**: 990 '오늘 풀세트'(score-factor F1~F5 부여) 구매 후 사주 종합점수 게이트가 550원(score-total) 재요구 → 이중과금(실사용자 550 2회 청구 확인).
- **근인(실측)**: 이용권 scope 가 `readingKey=toSlug(input)` 에 묶임 → 같은 사람이라도 입력 경로/분 정밀도가 다르면 readingKey 갈림(오늘운세 8시 vs 직접입력 8시45분) → grandfather 불발.
- **수정**: 점수 게이트 매칭을 readingKey 문자열이 아니라 **사주(4기둥 간지 + 성별) 정체성**으로(`src/lib/saju/reading-identity.ts` + score-factor/score-unlock-access 재작성, `listTasteProductEntitlementScopeKeys`). grant·DB·기존 scope_key **무변경(체크만)** → 기존 결제 보존 + 분 변형 깨진 케이스 자동 복구. 신규 테스트 10(실측 키) + 회귀 933 통과.

### 진단 / 운영
- **8시 vs 9시 reading 갈림(워크플로 조사)**: 두 폼 모두 raw 0-23 시 `<select>`(지지 매핑·야자시·진태양시 시프트 없음) → **사용자 입력 차이**(진짜 다른 사주, 시주 甲辰 vs 乙巳) = 코드 버그 아님. 분(m45) 비대칭만 경로 차이(today-fortune `minute:''` 강제 vs saju-intake 프로필 분 복원, birth-info-stepper.tsx:99) — #449 가 흡수.
- **환불**: 6/18·6/22 550 청구 = 영수증 `dashboard-sandbox.tosspayments.com` = 샌드박스 → 실청구 0 → **환불 불필요**(라이브 키 전환 전).

### 진행로그 자동화 (이 세션 설정)
- `.claude/settings.local.json` Stop 훅: `[ PROGRESS.md -nt PROGRESS.html ] && npm run progress:html` — PROGRESS.md 변경 시에만 HTML 자동 렌더(무변경 턴 skip). gitignore(PROGRESS.html).
- 메모리 `feedback_progress-log-on-work-done`: substantive 작업 종료 시 PROGRESS.md 세션 항목 갱신을 기본화.

### #450 텍스트 가독성 기반 개선 (판단→예측→검증→실행)
- **판단(정량 감사 워크플로)**: 대비 `--app-copy-soft` 3.99:1(AA 미달, 223+곳)·`--app-copy-muted`는 4.78:1 통과 / 글자 ≤12px 1,305곳(63%)·≤9.5px 35곳 / body·p line-height 미설정(Tailwind 1.5).
- **실행(광역·저위험)**: `--app-copy-soft` 0.82→0.88(4.52:1, 223+곳 동시) + 하드코딩 저대비 3곳(global-error·app-shell·daewoon)→토큰/AA / `:where(p·li·dt·dd) line-height 1.65` / 타입스케일·행간 토큰(`--app-text-*`·`--app-leading-*`, additive) / 최악 마이크로텍스트(사주명식 8.5·9px→10.5·11px).
- **검증**: 933 tests·typecheck·build·CI 정적가드 5종 통과. 색-only/additive/외과적 → 레이아웃 위험 최소.
- **후속 #451 (C단계)**: 결과 표면 ≤12px 상향(today 60·saju+score 92·compat·홈배너 8, 워크플로 3에이전트 판단 기반, tabular/고정폭/배지/차트 스킵) + 가독성 회귀 하니스(`e2e/readability-visual.spec.ts` 오버플로 게이트+캡처). unauth 게이트 10/10·입력/홈 눈으로 확인 후 머지·배포.

### #452 꿈해몽 무결과 검색 로깅 (커버리지 확장 Phase 0)
- 피드백 "검색해도 없다"(커버리지 갭). **전략 결정**: 런타임 LLM/스크래핑 ❌ → 기존 결정론 사전(304개)을 **LLM 배치 생성→가드→머지**로 확장(쿼리당 비용 0·SEO·정직성 유지)이 장기 우위. (decision-framer)
- **Phase 0(수요 신호)**: `searchDream` fallback 플래그(코어 무변경 래퍼, TDD) + `/api/dream/search` 무결과 시 빈도 누적 로깅(비차단) + 마이그레이션 054 `dream_search_misses`(RLS service 전용 + 멱등 RPC). 054 적용·원격 덤프로 테이블·RPC·인덱스·RLS 실재 검증 → **로깅 가동**.
- **#453(055) 보강**: 덤프 검증 중 발견 — `record_dream_search_miss` 가 Supabase 기본 권한으로 anon/authenticated EXECUTE 잔존(`REVOKE FROM PUBLIC` 만으론 부족) → 익명 PostgREST `/rpc` 직접 호출로 hit_count 오염 가능(SECURITY DEFINER·쓰기전용이라 노출 0, 무결성 리스크만). `REVOKE EXECUTE FROM anon, authenticated` 로 잠금(서버 service_role 유지). 적용 후 `db query --linked` 로 권한 직접 검증(anon/auth=false, service=true).

### #454 꿈해몽 사전 파일럿 20개 확충 (Phase 1, 305→325)
- 흔하지만 누락 키워드 20개(시체·화장실·엘리베이터·귀신·벌레·모기·바퀴벌레·다람쥐·상어·딸기·바나나·커피·케이크·소나무·장미·태풍·터널·오토바이·컴퓨터·침대).
- **생성 파이프라인(워크플로 40에이전트)**: 키워드별 LLM 생성(스키마 강제) → 적대적 가드 자가검증(4건 수정: 단정어 '분명히'·비문·naming-policy `안정과` 정규식 충돌) → **머지 전 결정론 재검증**(테스트 정규식 직접: 한자0·공포어0·신조어0·유니크·스키마 = 위반 0) → 렌더 출력 문장 품질 확인.
- LLM은 **오프라인 1회 생성만** → 서빙은 결정론 사전(쿼리당 비용 0·SEO·정직성). detailSlug 없음(가드 강제). 933 tests·typecheck 통과.
- 다음: 같은 파이프라인으로 #452 수요 Top-N 쌓이면 데이터 주도 확장 / 톤 OK면 배치 확대.

### 교훈(추가)
- **Supabase RPC 권한은 REVOKE FROM PUBLIC 만으론 부족**: public 스키마 함수는 anon/authenticated 에 EXECUTE 기본 부여 → service 전용 RPC 는 `REVOKE EXECUTE FROM anon, authenticated` 명시 필요. 마이그레이션 적용 후 원격 덤프(GRANT 라인)로 실검증.

### 교훈
- **무성(無聲) 실패**: 에러를 삼키는 코드(타로 보관함)는 기능이 죽어도 안 보임 → CI 정적 가드로 회귀 차단.
- **이용권은 입력 문자열이 아니라 도메인 정체성에**: readingKey(toSlug)는 경로/정밀도로 흔들림 → 사주팔자 기반 매칭이 일반해(today-detail·year-core·monthly-calendar 등 다른 reading-scope 상품은 아직 잔존 — 후속).
- **프로덕션 장부/결제/권한·settings 변경은 분류기가 차단** → 사용자가 `!` 로 직접 실행(migration repair·db push·settings.local 훅).

---

## 2026-06-05 세션 (Claude) — 페이지 전환 스크롤 + 오늘운세 본문 구조화(Phase 1) + 프리미엄 LLM Phase 2 로드맵 (#391~#392)

> 같은 흐름에서 앞서 #386~#390(띠운세 입력 단순화·상세 기간별 콘텐츠 / 헤더 네비 PC 마이홈 드롭다운·모바일 MY 상단 / 리뷰 모달 정중앙 / 결제 퍼널 500 service-role 픽스 / 세션 docs) 머지·배포 완료. 본 섹션은 그 뒤 #391·#392 + 오늘운세 프리미엄 LLM Phase 2 설계. 모두 코드만(DB 마이그레이션 없음).

### #391 페이지 전환 스크롤 최상단 보장
- **증상**: 페이지 이동 후 스크롤이 최상단으로 가지 않고 이전 위치/푸터가 보임(사용자 보고, 전체 사이트).
- **진단**: 스크롤 컨테이너 = window(정상). 코드상 scroll-to-top 차단 없음(`scroll={false}`는 zodiac 기간 탭 등 쿼리 변경·주석뿐). **dev + production 빌드 모두** 일반 전환에서 scroll-to-top 정상(클라이언트 네비 마커 확정 + scrollY 0). template transform 애니메이션 가설도 기각 → **특정 재현 케이스 미발견**.
- **수정**: 신규 `src/shared/layout/scroll-reset-on-navigate.tsx`(`usePathname` 변경 시 `window.scrollTo(0,0)`)를 `layout.tsx`에 추가 — Next 기본에 의존하지 않고 명시적 보장(미발견 엣지 케이스·실기기 방어). 쿼리만 바뀌는 탭(zodiac `?period=`·search·legal)은 `usePathname` 불변이라 **보존**(검증: 기간 탭 scrollY 유지, 일반 전환 scrollY 0).
- ⚠️ 특정 재현을 못 해 **배포 후 실사용 확인 필요**.

### #392 오늘의 운세 본문 구조화 (Phase 1 — 무료, LLM 없이)
- **증상**: 본문이 점수 요소별(천간/지지/용신/신살/오행) 한 줄 템플릿을 무맥락 이어붙여 — "오늘은~날입니다" 반복, 천간/지지 **상충**("누르는 흐름"+"받쳐주는 흐름"이 한 문단), 끝맺음 누락("나눠보세요 정답을"), 성향 중복으로 빈약.
- **수정** (`src/server/today-fortune/build-today-fortune.ts`):
  - `buildTodayFlowSignal`: 천간/지지 2문장 → **겉·바탕 통합 1문장**(상충 제거)
  - `buildPublicTodayBody`: **흐름 → 성향 → 핵심 포인트 → 조언 → 주의 → 마무리** 구조화, 성향 중복(roleBodyVariant) 제거, actionBody "오늘은" 접두 제거
  - `asSentence` 헬퍼: 조각 끝맺음(마침표) 통일 / `cautionBody` 두 조각 마침표 보장
- 무료 티어 한정(운영비 0). 유닛 760 통과(vocab-quality: naming-policy **"기운"·한자·명리어 0** 가드 — flowSignal "기운"→"에너지" 수정으로 통과). 본문 3케이스 실측 — 상충·중복·끝맺음·구조 개선 확인.

### Phase 2 로드맵 — 오늘운세 프리미엄 LLM 풀이 (다음 세션, 미구현)
> **결정**: 캐시 **생략**(today 프리미엄은 언락 후 snapshot 저장 + 일진 매일 변경 → 캐시 hit 거의 없음, snapshot 이 재조회 커버). 비용은 텔레메트리로 추적.
> **비용 연동 확정**(사용자 질문): `generateAiText(feature:'today_premium')` → `recordLlmRun` 자동(openai-text.ts:113) → `ai_llm_runs`(토큰·USD 비용·캐시 hit) → `/admin/llm-cost` 자동 집계(`aggregateByFeature` 동적 그룹핑이라 새 feature 자동 노출). 별도 연동 코드 불필요.

구현 순서:
1. `lib/today-fortune/types.ts` — `TodayFortunePremiumResult` 에 `aiNarrative?: string | null` 추가
2. `server/ai/llm-telemetry.ts` — `LlmFeature` 에 `'today_premium'` 추가
3. **신규** `server/ai/today-premium-service.ts` — `generateTodayPremiumInterpretation(점수/근거)` → `generateAiText(feature:'today_premium')`. naming-policy 프롬프트(한자/명리어/"기운" 0, Phase 1 톤). 실패 시 `null`
4. `lib/today-fortune/result-snapshots.ts` — `buildTodayFortuneSnapshotContent` **async 전환**(현재 동기, l.~165) + `premiumResult.aiNarrative` 주입. 호출처(unlock route POST·`today-fortune-audit`·write) await 연쇄
5. `components/today-fortune/today-premium-panel.tsx` — `aiNarrative` 있으면 최상단 "AI 깊은 풀이" 블록 렌더(현재 recommendedActions/scenarios/evidenceLines 렌더 위)
6. 캐시/마이그레이션 불필요. snapshot JSON 에 `premiumResult` 포함 → `aiNarrative` 자동 저장·복원.

- **참고 패턴**: `server/ai/saju-lifetime-service.ts`(generateAiText + recordLlmRun 통합, #377/#378). lifetime 은 캐시 사용, today 는 캐시 생략만 다름.
- **리스크**: ① `buildTodayFortuneSnapshotContent` async 전환의 호출처 연쇄 ② 언락 시 LLM 지연(결제 후라 허용) ③ 프롬프트 품질.

### 교훈
- **디버깅**: dev·production 빌드 모두 재현 안 되면 단정 수정 금지. 명시적 보장(scroll reset)으로 미발견 엣지 방어 + 배포 후 확인.
- **LLM 비용 연동은 한 줄**: `generateAiText` 의 `feature` 태그만 주면 중앙 계측(#378)이 토큰·비용 자동 기록, 대시보드(#381)는 동적 그룹핑이라 새 feature 자동 노출. 신규 LLM 도입 시 별도 연동 작업 불필요.
- **gh active 계정 주의**: 세션마다 active 계정이 바뀌어 PR/머지 시 `gh auth switch --user ganji-saju` 필요(push 는 SSH 라 영향 없음).
- **오늘운세 본문은 plain 티어**: vocab-quality.test 가 "기운"까지 명리어로 차단 → 무료 본문 카피는 "에너지/흐름/성향" 등 일상어만.

---

## 2026-05-29 세션 — Codex 모바일 하단 고정 CTA 겹침 수정

> 목적: 회원탈퇴 화면에서 하단 고정 버튼(`이전` / `계속 진행하기`)이 마지막 사유 항목 `기타`를 가리는 문제를 수정하고, 같은 구조의 화면을 전수조사해 재발 가능성이 있는 하단 고정 CTA 화면까지 함께 정리한다.

### 구현 완료
- **공통 하단 CTA 여백 클래스 추가**: `src/app/styles/components.css`에 `app-fixed-bottom-cta-clearance`를 추가해 fixed bottom CTA가 문서 흐름에서 차지하지 않는 높이를 명시적으로 예약.
- **회원탈퇴 화면 수정**: `/my/settings/delete-account` step 2 사유 목록의 마지막 `기타` 카드가 `이전`/`계속 진행하기` CTA 아래로 들어가지 않도록 CTA 직전 clearance 적용.
- **같은 위험 패턴 전수 반영**:
  - `/credits`: 코인 정책/고객센터 링크가 결제 CTA에 가려지지 않도록 보강.
  - `/dialogue/appointment`: 상담 예약 메모 입력 영역이 예약 CTA에 가려지지 않도록 보강.
  - `/reset-password`: 보조 액션/약관 문구가 비밀번호 변경 CTA에 가려지지 않도록 보강.
  - `/compatibility/input`: 기존 inline spacer를 공통 클래스 기반으로 정리.
- **제외 범위 확인**: 전역 모바일 dock(`SiteHeader`)과 홈 전용 dock은 페이지 CTA가 아니라 navigation surface라 이번 overlap fix 대상에서 제외.

### 검증
- `git diff --check`: 통과.
- `npm run typecheck`: 통과.
- `npm run build`: 통과 (Next.js 16.2.6, 191 static pages).
- Playwright mobile smoke(390x844):
  - `/my/settings/delete-account` step 2: `기타` 카드 bottom 366px, CTA top 469px, gap 103px, overlap false.
  - `/credits`: 정책 링크 섹션과 CTA gap 103px, overlap false.
  - `/dialogue/appointment`: 메모 입력 영역과 CTA gap 78px, overlap false.
  - `/reset-password`: 하단 문구와 CTA overlap false.

### 운영 적용
- Branch: `codex/mobile-cta-clearance-20260529`
- Implementation commit: `f3db6fa`
- Main merge: fast-forward 완료, `main` push 완료.
- Documentation commit: `3a4f4a8`
- Vercel production deploy: `dpl_6pyMyLKKRWZCLjdu4shrWywBF1QR`
- Production URL: `https://ganji-saju-jnfvefjkd-ganji-sajus-projects.vercel.app`
- Alias: `https://ganjisaju.kr`
- Production smoke:
  - `https://ganjisaju.kr/my/settings/delete-account`: HTTP 200.
  - `https://ganjisaju.kr/credits`: HTTP 200.
  - `https://ganjisaju.kr/dialogue/appointment`: HTTP 200.

---

## 2026-05-28 세션 — Codex 코인 환불 관리자 플로우 + 모바일 저사양 성능 최적화

> 목적: 코인 구매 환불을 기존 상품 entitlement 환불 경로에 억지로 끼우지 않고 별도 관리자 플로우로 분리하고, 휴대폰 저사양/절전/모션감소 환경의 scroll/menu 버벅임을 줄인다. 일반 기기는 기존 디자인을 최대한 유지하고, 저사양 계열에서만 blur/glow/shadow/animation 비용을 낮추는 정책으로 구현했다.

### 구현 완료
- **관리자 코인 환불 가능 섹션**: `/admin/users/[id]` 사용자 상세에서 `credit_transactions.type='purchase'` + `metadata.paymentKey` 결제건을 기준으로 코인 환불 가능 항목을 표시.
- **코인 lot 기준 잔여량 계산**: `credit_lots`의 `paymentKey/orderId/packageId` metadata를 기준으로 `amount_initial`, `amount_remaining`, 사용량, 환불 가능 금액을 계산.
- **보수적 환불 정책 적용**:
  - 미사용 lot: 전액 환불 가능.
  - 일부 사용 lot: 남은 코인 기준 부분 환불 가능.
  - 전부 사용 lot: 환불 불가로 표시.
- **Toss 부분 취소 지원**: `cancelPayment()`에 `cancelAmount`를 추가해 남은 코인만 환불하는 부분 취소를 지원.
- **코인 회수/감사 기록**: Toss 취소 후 `credit_lots.amount_remaining` 차감 또는 0 처리, `sync_credit_balance_from_lots(user_id)` 호출, `credit_transactions` 감사 row 추가.
- **refund_requests 확장**: `entitlement_id=null`인 코인 환불 요청도 표현할 수 있도록 DB/서비스 경로를 확장. `processed_credit_payments`는 삭제하지 않아 confirm 재시도 시 중복 적립을 막는 ledger를 보존.
- **모바일 성능 모드**: 루트 layout inline script가 `prefers-reduced-motion`, Save-Data/2G, 낮은 RAM/CPU 신호를 감지해 `data-performance-mode=lite`를 설정.
- **저사양 전용 효과 감쇄**: 새 `src/app/styles/performance.css`에서 lite 모드에만 모바일 header/dock/menu의 blur, glow, shadow, animation을 낮춤. 일반 기기는 기존 blur/pulse/glow를 유지.
- **공통 렌더링/스크롤 최적화**: 터치 응답(`touch-action`), 내부 스크롤 격리(`overscroll-behavior`), 긴 패널 `content-visibility`를 적용.
- **모바일 FAB 메뉴 렌더 경량화**: 하단 dock 부채꼴 메뉴 좌표를 render 중 `Math.cos/sin` 계산하지 않고 모듈 레벨에서 사전 계산.

### DB/운영 적용
- 신규 migration: `047_credit_refund_workflow.sql`
  - 코인 환불 요청/lot 차감/잔액 재동기화가 가능한 DB 경로 보강.
  - 사용자 확인 기준: prod 수동 적용 완료 후 배포 진행.
- Vercel production deploy:
  - Branch: `codex/refund-credit-performance-20260528`
  - Implementation commit: `5fc7dcc9f0c3b11f0bc14e0c740f528f1d237742`
  - Main merge: fast-forward, `main` push 완료.
  - Deployment: `dpl_M9xfzwD2wzhyYRYnFZrqNM8RmNVN`
  - Production URL: `https://ganji-saju-iy7j8vdw4-ganji-sajus-projects.vercel.app`
  - Alias: `https://ganjisaju.kr`

### 검증
- `npm run typecheck`: 통과.
- `npm test`: 754 tests passed.
- `npm run build`: 통과 (Next.js 16.2.6, 191 static pages).
- `git diff --check`: 통과.
- Playwright mobile smoke(390x844):
  - 일반 모드: `performanceMode=standard`, header/dock blur와 center FAB pulse 유지.
  - reduced-motion 모드: `performanceMode=lite`, header/dock blur `none`, FAB/menu animation `none`.
- Production smoke:
  - `https://ganjisaju.kr/today-fortune`: HTTP 200.
  - `https://ganjisaju.kr/credits`: HTTP 200.
  - `https://ganjisaju.kr/admin/users`: HTTP 307 → `/login?next=/admin`.
- Vercel build audit notice: `5 moderate severity vulnerabilities` 경고 유지. 빌드 차단은 아니며 Next high는 16.2.6 패치로 제거된 상태.

### 산출물
- `PROGRESS.md`: 본 릴리스 기록 추가.
- `PROGRESS.html`: `npm run progress:html`로 로컬 HTML 산출물 재생성(`gitignore` 대상, 커밋 제외).

---

## 2026-05-27 세션 — Codex 환불 워크플로우 보강 (`refund_requests` dedupe + already-canceled 흡수)

> 목적: admin 사용자 상세 화면에 보이던 “환불 실패: 이미 취소된 결제 입니다.” row를 실제 환불 실패로 오인하지 않도록, 중복 요청을 차단하고 Toss에서 이미 전액 취소된 결제는 권한 회수 후 정상 완료 상태로 흡수한다.

### 구현 완료
- **중복 환불 요청 차단**: `/api/admin/refund` request 단계에서 같은 `entitlement_id` 또는 `payment_key`의 `requested/processing/completed/failed/revoke_pending` 요청이 있으면 새 요청을 만들지 않고 409로 기존 요청 상태를 반환.
- **DB 레벨 dedupe**: 신규 migration `046_refund_request_dedupe.sql` 추가. 기존 중복 row는 대표 row 1개만 남기고 나머지는 `rejected`로 정리한 뒤, `refund_requests_active_entitlement_uidx`/`refund_requests_active_payment_key_uidx` partial unique index 생성.
- **이미 취소된 Toss 결제 흡수**: Toss cancel이 “이미 취소된 결제”를 반환하면 `getPayment(paymentKey)`로 재조회하고, `status=CANCELED` + `balanceAmount=0`이면 실패가 아니라 entitlement 회수를 실행한 뒤 `completed`로 종료.
- **권한 회수 재시도 보강**: `revoke_pending` 재시도는 Toss cancel을 다시 호출하지 않고 권한 회수만 재시도.
- **admin 화면 표시 개선**: 환불 요청 목록에 `error_message`, `payment_key`, Toss 취소 확인(`CANCELED`, 잔여 0원)을 표시.

### 운영 적용
- Supabase prod `046_refund_request_dedupe.sql` 적용 완료: migration list `046 Local=Remote` 확인.
- 기존 49,000원 lifetime 결제(`paymentKey=tviva20260515165740t9DA0`) 정리 완료:
  - Toss 조회: `CANCELED`, `balanceAmount=0`, `cancelAmount=49,000`, 취소 시각 `2026-05-16T13:20:31+09:00`.
  - 남아 있던 `product_entitlements` 1건 삭제.
  - legacy `credit_transactions` lifetime grant 1건 삭제.
  - `credit_transactions.feature='entitlement_revoke'` audit row 1건 추가.
  - 대표 `refund_requests` row `96ee874e-646d-4417-a285-a7c50819f0bb`를 `completed`로 변경하고 Toss 취소 확인 payload 저장.
  - 같은 `payment_key` 중복 failed row 2건은 `rejected`로 정리.
- 기존 550원 중복 환불 row도 046 migration으로 완료 row 1개만 active로 남고 duplicate failed row는 `rejected` 처리됨.

### 검증
- `npm run typecheck`: 통과.
- `npm test -- --grep refund`: 전체 unit runner 통과(750 tests passed + node:test 172 pass).
- Prod DB active 중복 확인: `duplicateEntitlements=[]`, `duplicatePaymentKeys=[]`.

---

## 2026-05-27 세션 — Codex 결제 안정성 P0 (`Next 16.2.6` + `payment_orders` + Toss webhook/reconciliation)

> 목적: 남은 결제 P0 후보였던 Next high audit, client timestamp orderId, success page confirm 의존 리스크를 닫는다. DB/서버/클라이언트/cron까지 한 경로로 묶어 **결제 원장 일치성**을 높인 작업.

### 구현 완료
- **Next.js security patch**: `next`를 `16.2.3` → `16.2.6`으로 올려 audit high 제거. `shadcn`은 build-time/dev dependency로 이동해 `qs`를 production graph에서 제외.
- **서버 orderId 발급**: `/api/payments/prepare`가 `payment_orders` 원장 row를 만들고 `ord_${crypto.randomUUID()}` 형식의 Toss `orderId`를 반환. `/credits`, `/membership/checkout`은 prepare 응답 `orderId`로 Toss 결제창을 연다.
- **동의 기록 orderId 연결**: 결제 동의 기록(`user_policy_consents.order_id`)이 prepare에서 만든 서버 orderId와 연결됨.
- **confirm 원장 대조**: `/api/payments/confirm`은 success URL payload만 믿지 않고 `payment_orders.user_id/package_id/amount/currency`와 Toss 결제 객체를 대조한 뒤 지급.
- **공통 fulfillment**: confirm/webhook/reconciliation이 모두 `fulfillPaymentOrder`를 사용. `claim_payment_order_fulfillment()` RPC가 원자적으로 지급 작업을 claim해 멤버십 기간 연장/권한 grant/코인 적립 중복을 막는다. 이미 `fulfilled/fulfilling` 상태인 주문은 재확정하지 않아 중복 webhook/confirm 레이스도 차단한다.
- **Toss webhook endpoint**: `/api/payments/webhook/toss` 추가. `PAYMENT_STATUS_CHANGED` payload는 원문 저장 후 Toss payment 조회 API로 검증하고 처리. 중복 webhook은 `payment_webhook_events.event_hash`로 dedupe.
- **reconciliation cron**: `/api/payments/reconcile` 추가 + `vercel.json` hourly cron 등록. `prepared/in_progress/confirmed/fulfillment_failed` 주문을 Toss `paymentKey` 또는 `orderId` 조회로 보정.
- **운영 env**: Vercel production `CRON_SECRET` 신규 설정 완료. reconciliation endpoint는 `Authorization: Bearer $CRON_SECRET` 또는 `x-payment-reconciliation-secret`만 허용.

### DB 적용
- 신규 migration: `045_payment_orders_reconciliation.sql`
  - `payment_orders`
  - `payment_webhook_events`
  - `claim_payment_order_fulfillment(p_order_id)`
  - `mark_payment_order_reconciliation_attempt(p_order_id)`
- Supabase prod 적용 완료: `supabase db push` → migration list `045 Local=Remote` 확인.

### 검증
- `npm run typecheck`: 통과.
- `npm test`: 747 tests passed + node:test 172 pass.
- `npm run test:spec -- src/lib/payments/payment-duplicate-audit.spec.ts src/lib/payments/confirmation.test.ts src/lib/payments/order-ledger.test.ts src/lib/payments/bundle.test.ts src/lib/payments/consent.test.ts`: 18 tests passed.
- `npm run build`: 통과 (Next.js 16.2.6, 191 static pages).
- `npm audit --omit=dev --json`: high 0 / critical 0. 남은 production advisory는 Next 내부 `postcss` moderate 2건이며 npm 제안 fix가 `next@9.3.3`로 비정상이라 별도 upstream 추적.
- `npm audit --json`: high 0 / critical 0. dev-only `qs` moderate는 `shadcn` 경로에만 남음.
- `npm run audit:payment-idempotency:strict`: Supabase 조회 포함 통과(회귀 0건).
- `npm run audit:mockup-placeholders:strict`: 의심 패턴 0.
- `git diff --check`: 통과.

### 운영 상태
- **Toss 개발자센터 webhook 등록 완료**(사용자 확인): URL `https://ganjisaju.kr/api/payments/webhook/toss`, event `PAYMENT_STATUS_CHANGED`.
- **실결제 smoke 필요**: 코인 1건, 단건 상품 1건, 중복 confirm, success page 미도달 시나리오. 실제 결제수단/환불 처리가 필요한 운영 검증이라 코드 배포 후 별도 수행.

---

## 2026-05-27 세션 — Codex 후속 정리 (`docs` 어휘/브랜드 톤 + audit + branch cleanup)

> 목적: 사용자 화면 어휘 전수 정리 릴리스(`c063bef`) 이후 남은 문서/운영 후속을 닫고, 결제 안정성·취약점 리스크를 다음 작업 후보로 분리한다. **계산·결제 로직 변경 없음**(문서/화면 카피만 정리).

### 처리 완료
- **운영/기획 문서 어휘 정리**: `docs/claude-specs`, `docs/payments`, `docs/safety-copy-guide.md`, premium planning docs, `PROGRESS.md`의 브랜드/상품 톤을 간지사주 톤으로 맞춤. 내부 검증용 정규식·테스트 fixture는 회귀 탐지를 위해 legacy term을 유지할 수 있음.
- **잔여 화면 카피 정리**: PDF/report 문서, 비밀번호/탈퇴/안전 안내, method 읽을거리, CSS pseudo-content에 남은 구 브랜드 표기를 간지사주로 정리.
- **`/admin/payment-funnel` 검증 대기 정리**: #389의 stale "검증 대기"를 사용자 확인 완료 상태로 갱신.
- **vocabulary release 원격 브랜치 정리**: `codex/vocabulary-sweep-20260527`는 `main` fast-forward merge 완료 후 원격 삭제 완료. 로컬 브랜치 참조도 삭제 완료.
- **사용자 화면 어휘 릴리스 기록 보강**: commit `c063bef5e27768f89594ad90f57dc170cacb93f6`, Vercel production `dpl_9oP237RofyDLMjPmh89yuthnKohZ`, alias `https://ganjisaju.kr`, `/today-fortune` HTTP 200 상태를 release history에 추가.
- **이번 후속 릴리스 배포/머지**: commit `668d0022dd2e8d14b1da86db13182d06da38fb6d` pushed to `main`. Vercel production `dpl_3yLNYSfqdmAJm57Zy9SeW4FS2Smb` READY, alias `https://ganjisaju.kr` 연결 완료. Smoke: `/today-fortune` HTTP 200, `/method` HTTP 307 → `/interpretation`.
- **PROGRESS HTML 재생성**: `npm run progress:html`로 로컬 `PROGRESS.html` 갱신(`gitignore` 산출물, git 추적 제외).

### npm audit 확인
- `npm audit --json`: 3 vulnerabilities 확인(2 moderate, 1 high).
- `npm audit --omit=dev --json`: 동일 결과 → production dependency graph에도 남음.
- 항목:
  - `next` direct dependency `16.2.3`: high 묶음 advisory. semver-major 없이 `16.2.6`으로 fix 가능.
  - `postcss`: Next 내부 전이 의존성 moderate. `next@16.2.6`으로 함께 해소 가능.
  - `qs`: `shadcn@4.7.0` → `@modelcontextprotocol/sdk` → `express` 경유 전이 의존성 moderate. 별도 dependency override 또는 상위 패키지 업데이트 검토 필요.

### 아직 닫지 않은 운영 확인 항목
- **Toss 환불 완료 여부**: 로컬 repo에서 사실 확인 불가. Toss 관리자/운영자 확인 후 완료 처리 필요.
- **사용자 안내 완료 여부**: 현재 대화 기록만으로는 안내 발송 완료를 확정할 수 없음. 환불 완료 확인과 함께 닫을 항목.

### 후속 처리 상태
- 위 결제 안정성 P0 세션에서 **Next.js 16.2.6**, **서버 orderId/payment_orders**, **Toss webhook/reconciliation 코드·cron**까지 구현 완료.
- 남은 것은 코드가 아니라 외부 운영 확인: Toss 개발자센터 webhook 등록, 실제 결제 smoke, 환불 완료/사용자 안내 완료 여부.

---

## 2026-05-27 세션 — Codex 결제정책 P0/P1 보완 (`/credits` prepare/동의 + bundle 동의 + credit idempotency)

> Claude Code 토큰 만료로 Codex가 이어받은 결제정책 보완 작업. 기존 Claude 작업과 겹치지 않도록 범위를 네 가지로 분리하고, 코드·DB migration·문서 기록을 함께 남김.

### 수정 완료
- **코인 구매 prepare/동의 통합**: `/credits`가 Toss 결제창을 직접 열기 전에 `/api/payments/prepare`를 호출하도록 변경. `PaymentConsentCheckboxes`를 코인 충전 화면에 추가해 `terms/privacy/refund/coin` 동의가 모두 확인되어야 결제 버튼이 활성화됨.
- **prepare API 강제 동의 검증**: `/api/payments/prepare`에서 `acceptedKinds` 누락 시 더 이상 통과시키지 않고 `prepare_blocked` + `consent_missing`으로 funnel 기록. non-entitlement 상품(코인/일회성 코인팩)도 consent 검증과 `prepare_ready` 로그를 거치도록 조기 반환 제거.
- **bundle digital-content 동의**: `bundle_today_set` 같은 bundle 상품도 `digital-content` 동의를 요구하도록 `getRequiredConsentKinds`/`getConsentItems` 보강. 회귀 테스트 추가.
- **credit confirm idempotency**: 신규 `044_credit_payment_idempotency.sql` 추가. `processed_credit_payments.payment_key UNIQUE`로 `add_credits` 호출을 DB 레벨에서 1회만 처리. 기존 `credit_transactions.metadata.paymentKey`도 backfill해 과거 성공 결제 재시도 중복 적립을 차단.
- **`subscription_30` 적립/동의 타입 정정**: `subscription_30`은 `kind='subscription'`이지만 관리형 월구독이 아니므로 confirm에서 `purchase` grant type으로 적립. 36코인 일회성 상품이 1년 만료 lot에 들어가도록 `getCreditGrantType`으로 분기하고, 동의 정책도 `subscription`이 아니라 `coin`을 요구하도록 정정.
- **문서 동기화**: `docs/payments/product-catalog.md`, `pricing-proposal.md`, `pricing-rollout-plan.md`를 현재 구현 상태로 갱신. 남은 리스크는 orderId 서버 발급/UUID화, Toss webhook/reconciliation으로 좁힘.

### 운영 적용
- `044_credit_payment_idempotency.sql`: 사용자 확인으로 Supabase prod 수동 적용 완료(2026-05-27).
- 이 repo는 DB migration이 CI/Vercel 배포로 자동 적용되지 않으므로, 후속 DB migration도 별도 수동 적용 상태를 `PROGRESS.md`에 기록한다.

### 검증
- `git diff --check`: 통과.
- `npm test`: 740 tests passed.
- `npm run test:spec -- src/lib/payments/payment-duplicate-audit.spec.ts`: 18 tests passed.
- `npm run typecheck`: 통과.
- `npm run build`: 통과 (Next.js 16.2.3, 189 static pages).
- `npm run audit:mockup-placeholders:strict`: 의심 패턴 0.

### 배포/머지
- Git: `main` 커밋 `df0a37e3b405292cda279c0722b2a2aa70a9c509` 푸시 완료.
- Vercel production: `dpl_4ZS9xDLHVpUvdeZiVuh6Z4YTZ2Ec` READY.
- Alias: `https://ganjisaju.kr` 연결 완료.
- Production smoke: `https://ganjisaju.kr/credits` HTTP 200, `/admin/payment-funnel` 비로그인 상태 `/login?next=/admin` 307.

---

## 2026-05-27 세션 — Codex 백업 스냅샷 + 로컬 구현 상태 결제/가격 정책 재점검

> 목적: Claude Code/Codex 작업물이 섞인 현재 로컬 상태를 먼저 보존하고, 문서 상태를 현재 구현과 맞추기 위한 점검. **코드 경로는 수정하지 않음.**

### 백업
- 로컬 백업 디렉터리: `.codex-backups/20260527-094309-local-current/`
- `repo-head.bundle`: 현재 `main` HEAD `4157a40c7ea756dce8123f523334e6c66c37a93f` 전체 git history 백업. `git bundle verify` 통과.
- `untracked-files.tar.gz`: 백업 생성 전 미추적 작업물 3건 보존.
  - `.claude/launch.json`
  - `docs/claude-specs/phase-0a-lifetime-cache.md`
  - `docs/검증 후 1주일 운영 데이터.md`
- `tracked-working-tree.diff` / `staged.diff`: 둘 다 0B → 백업 시점에 추적 파일은 HEAD와 일치, staged 변경 없음.
- `README.md` / `SHA256SUMS` / `git-status-short.txt` / `head-log.txt` 포함.

### 사용자 확인으로 닫힌 운영 항목
- `043_refund_requests`: 사용자가 prod 적용 확인. 환불은 진행 중.
- `/admin/payment-funnel`: 사용자가 확인 완료.
- PDF: 결제 본편 P9 포함, `PAGE 9 / 9` 사용자 확인 완료.
- 로그인 상태 UX: 사용자 검증 완료.
- 코인 만료 정책: `040_credit_lots_expiry` + `credit_lots` lot 기반 1년 만료 구현 존재. `getCredits`는 비만료 lot 합으로 표시 잔액을 재계산.

### 로컬 구현 상태 결제/가격 상태
- 카탈로그는 현재 16개 패키지: 코인 3종, 36코인 일회성 1종, 멤버십 2종, lifetime 1종, taste 8종, bundle 1종.
- `bundle_today_set` 990원은 구현됨: `today-detail` + `score-factor` F1~F5 전체를 개별 entitlement로 grant/revoke.
- `taste_score_factor` 550원과 `taste_compat_reading` 990원은 카탈로그/스코프/checkout 경로에 존재.
- 월간 달력은 `2코인` 또는 `1,900원` 양쪽 경로가 UI/FAQ에서 대안으로 노출됨. 정책상 “이중 경로 허용”이면 정합, “단일 경로 강제”면 아직 정책 결정 필요.

### 점검 결과 후속 상태
1. ✅ **코인 구매 동의/prepare 우회**: 후속 Codex 세션에서 `/credits` prepare/`PaymentConsentCheckboxes` 통합 완료.
2. ✅ **bundle 동의 규칙**: 후속 Codex 세션에서 bundle `digital-content` 동의 추가 완료.
3. ✅ **credit idempotency**: 후속 Codex 세션에서 044 migration + `processed_credit_payments.payment_key UNIQUE`로 보강. 사용자 확인으로 prod 수동 적용 완료(2026-05-27).
4. ✅ **문서 동기화**: 결제 문서와 PROGRESS 갱신 완료.

### 검증
- `npm test`: 737 tests passed.
- `npm run test:spec -- src/lib/payments/payment-duplicate-audit.spec.ts src/lib/payments/confirmation.test.ts`: 18 tests passed.
- `npm run typecheck`: 통과.

---

## 2026-05-26 세션 — 띠운세 입력 단순화·기간별 콘텐츠 + 헤더 네비 + 리뷰 모달 + 결제퍼널 500 픽스 (#386~#389)

> 프론트 UX 개선 4건 + 운영 버그픽스 1건. 모두 main 머지 → Vercel 자동 배포. **DB 마이그레이션 없음**(전부 코드/콘텐츠). 브라우저 렌더(Claude Preview)로 검증 후 PR.

### 띠운세 (#386 — 2개 커밋)
- **진입 단순화**: `/zodiac` 의 '생년월일로 내 띠 확인'이 사주 전체 폼(`/saju/new`: 출생시간·성별·출생지·닉네임·동의 멀티스텝)으로 보내던 비합리적 동선 제거 → 생년월일(+양/음력)만 받는 **인라인 펼침 입력**(신규 `zodiac-birth-check.tsx`). 제출 시 서버 액션(신규 `actions.ts`)이 **입춘 기준** 띠 계산(`deriveZodiacSlugFromBirthInput` 재사용, 음력→양력 변환) → `/zodiac/[띠]`. 시간·성별·출생지는 띠 판정에 불필요해 미수집.
  - 검증: 1990-05-15→말띠, **입춘 경계 1990-02-01(입춘 전)→뱀띠**(연도 기준 말띠가 아님).
- **상세 기간 탭별 콘텐츠 동적화**: 기존엔 점수·히어로 한 줄만 period(오늘/주/달/해)별로 바뀌고 '집중 포인트(`todayFocus`)·행동 제안(`action`)'은 '오늘' 단일 필드라 고정 → `ZodiacFortune` 에 `periodFocus`·`periodAction`(`ZodiacPeriodLines`) 추가, **12띠 전체 기간별 문구 작성**(naming-policy 준수: 한자·"결"·추상명사 신조어 금지). `zodiac/[slug]` §4·§5 를 period별 제목·내용으로, '올해 흐름' 카드는 올해 탭만 노출.
- **레이아웃·라벨**: '태어난 해로 더 보기'(연생 칩)를 히어로 아래 → 운세 콘텐츠(점수·집중포인트) 아래로 이동. 입력 폼 라벨(양력/음력·년/월/일) 제거(select `aria-label` 로 접근성 유지).
- 파일: `src/app/zodiac/{actions.ts,zodiac-birth-check.tsx,page.tsx}`, `src/app/zodiac/[slug]/page.tsx`, `src/lib/free-content-pages.ts`, `src/lib/profile-personalization.ts`(기존 재사용).

### 헤더 네비게이션 (#387)
- **PC 메가메뉴**: 우측 `/my` 아바타에 **hover 드롭다운**(마이홈 롤오버) 추가 — `MY_MENU_BLUEPRINT` 재사용(/my 페이지와 동일 항목), `top:100%` 부착으로 hover 연속성(갭 깜빡임 방지). 로그인 시만 노출, 비로그인은 현행 로그인/회원가입 유지. (`mega-nav.tsx`/`.css`)
- **모바일 시트**: MY(계정) 섹션을 시트 하단 → **검색창 위(맨 위)**로 이동, 비로그인 시 '아이디·비밀번호 찾기'(`/login?mode=recover`) 보조 링크 추가. (`mobile-nav-sheet.tsx`/`.css`)
- ⚠️ PC 아바타 드롭다운은 **로그인 상태에서만** 렌더 → dev 비로그인 세션으론 실물 hover 미검증(마크업·타입·CSS 검증 완료, 로그인 후 확인).

### 리뷰 모달 (#388)
- 후기 작성 모달이 모바일에서 화면 하단(`items-end`)에 뜨던 것을 **정중앙(`items-center`)** 레이어로. `max-h-[90vh]`+세로 스크롤로 긴 내용 잘림 방지. (`review-write-dialog.tsx`)

### 결제 퍼널 500 (#389 — 버그픽스, systematic-debugging)
- **증상**: `/admin/payment-funnel` "데이터를 불러올 수 없음". API(`/api/admin/payment-funnel`)가 3일 내내 지속 500.
- **진단(증거 기반)**: ① `payment_funnel_events` 테이블은 prod 존재(`supabase migration list` 030 Local=Remote — **drift 아님**, 초기 가설 기각). ② 인증(`getCurrentAdminCheck`)은 **service-role**로 admin_users 확인해 통과(403 아님). ③ 그러나 데이터 조회는 **사용자 세션(authenticated)** 클라이언트 → 030 테이블이 RLS만 있고 **테이블 GRANT 없어** 조회 차단 → 500. `refund`/`push-ab-policy` 의 guard(사용자 세션)→데이터(service-role) 패턴 미준수가 차이.
- **수정**: 데이터 조회를 **service-role**로 전환(코드 1파일, DB 변경 없음 → drift 위험 회피) + 원인 추적용 `console.error` 안전망. (`src/app/api/admin/payment-funnel/route.ts`)
- ✅ **사용자 확인 완료**: prod 배포 후 `/admin/payment-funnel` 정상 표시를 사용자가 확인(2026-05-27). stale "검증 대기" 상태 닫힘.

### 교훈
- 단일 목적 기능(띠운세)은 **진입 입력을 그 목적에 필요한 최소(생년월일)**로 — 공용 폼(`UnifiedBirthInfoFields`) 재사용이 과입력을 부른다.
- 기간 탭 UI는 **모든 종속 콘텐츠가 period에 반응**해야 의미. 일부만 바뀌면 "왜 안 바뀌냐" 인지.
- **admin 데이터 조회는 service-role 패턴**(getCurrentAdminCheck 통과 후) — RLS만 있고 GRANT 미비한 테이블을 사용자 세션으로 읽으면 500. 레퍼런스: `refund`/`push-ab-policy`.
- 디버깅: "테이블 부재(drift)" 같은 그럴듯한 가설도 `migration list` 같은 **증거로 검증**해야 — 이번엔 기각됐다(추측 단정했으면 오진).
- squash 머지 시 `--subject` 직접 지정하면 `(#PR)` 자동 부착 안 됨 → 생략 시 자동 부착(#389에서 확인).

---

## 2026-05-25~26 세션 — LLM 비용 캐시·텔레메트리(Phase 0) + 어드민 운영(Phase 1~3) + PDF 실데이터 전수검사 (#373~#384)

> 비용 출혈 차단 → 운영 자동화 → PDF 실데이터화의 3단계 작업. 모든 코드 작업은 **main 기반 worktree(`.claude/worktrees/*`)에서 격리** → TDD → PR → CI(typecheck·test·Playwright·Vercel preview) green → squash 머지 → Vercel 자동 배포. **DB 마이그레이션은 CI 자동 아님 → supabase CLI 수동 적용**(041·042는 적용, 043은 적용 대기 — ↓ 마이그레이션 상태).

### 감사 리포트 · 정리 (read-only / 하우스키핑)
- **#375 LLM 호출·캐시·비용 구조 진단** (docs, read-only): LLM 호출 지점·캐시 계층(L1 결정론 / L2 캐시 / L3 실시간)·비용 출혈 지점 진단. **본편(대운 평생리포트)이 무캐시라 매 조회·PDF마다 재생성 → 비용 출혈 핵심**으로 지목 → Phase 0a의 근거.
- **#376 어드민·운영 자산 인벤토리** (docs, read-only, `audit-reports/2026-05-25-admin-inventory.md`): 어드민 6개 자산 인벤토리 → Phase 1~3의 근거.
- **#354 PROGRESS.md → HTML 렌더 스크립트** (tooling): `scripts/render-progress.mjs` + `npm run progress:html`. 하이브리드 워크플로우(md 편집 → html 렌더). **PROGRESS.html은 gitignore 로컬 산출물 — 보존 대상**.
- **#341 2026-05-23 세션 기록 + 가격 정책 개편안 초안** (docs): add/add 충돌(`pricing-proposal.md`)은 main의 완성본 유지(`--theirs`), PROGRESS만 머지.
- **폴더 구조 진단·정리**: `.claude/worktrees/*`에 머지 완료된 잔재 누적 + codex/claude 혼재로 "어디가 진짜 작업 폴더?" 혼선 → **메인 트리(`/Users/kionya/ganji-saju`)로 전환 + 머지된 worktree 잔재만 정리**. PROGRESS.html은 삭제하지 않고 보존.

### 비용 출혈 차단 — Phase 0
- **#377 대운 본편 read-through 캐시 (Phase 0a)**: 신규 `041_ai_lifetime_interpretations`. **content-addressed 캐시 키 = reportHash + feedback + targetYear**(스펙 갭 보강), 30일 TTL, read-through, `source=openai|fallback|cache`. `saju-lifetime-service.generateLifetimeInterpretation`이 캐시 경유. → 무캐시 재생성 비용 차단. 041 테이블에 `input_tokens/output_tokens/cost_usd` 컬럼 선반영(Phase 0b 연계).
- **#378 LLM 텔레메트리 시드 (Phase 0b)**: 신규 `042_ai_llm_runs`. **중앙 계측 — `generateAiText` 한 곳**에서 `feature/userId/telemetryStore`로 `recordLlmRun`(성공 + fallback + **캐시 hit**) 기록. `console.log` + **DB insert(비차단 await)** 둘 다. 챕터 포함 전 영역. 라이브 검증(feature×source별 count·cost 집계 정상).

### 어드민 운영 — Phase 1~3 (사용자 원안 로드맵)
- **#379 어드민 사용자 상세 + 검색 (Phase 1)**: `/admin/users`(검색) + `/admin/users/[id]`(회원정보·사주데이터·결제이력·AI챗 사용량·**LLM 캐시 hit 통계**·환불 가능 여부). 데이터 레이어 + 순수 로직 TDD. (typecheck 교훈: `gender`는 `reading.input.gender` — SajuDataV2 union엔 없음.)
- **#380 환불 자동화 (Phase 2 · 마찰점 1 본체)**: 신규 `043_refund_requests`. **2단계 승인 — admin은 환불 요청, super_admin만 최종 승인**. 상태머신(`requested→processing→completed/failed/revoke_pending/rejected`). Toss `cancelPayment` + **Idempotency-Key(재시도 안전)**. `/api/admin/refund` 원자적 트랜잭션 + 상세 페이지 환불 버튼/pending UI. 오케스트레이션 순수 로직 TDD. ⚠️ **실제 Toss 환불은 사람(super_admin)이 실행 — 빌드 + 목 테스트만 수행**.
- **#381 LLM 비용 대시보드 (Phase 3)**: `/admin/llm-cost`. **신규 테이블 없이 `ai_llm_runs` 재활용**(원안의 `llm_usage_logs` 중복 테이블 회피 — Phase 0b가 이미 구축). feature/source별 count·token·cost 집계 + 순수 로직 TDD.

### PDF 전수검사 — 목업→실데이터
- **#382 PDF 목업→실데이터 + 결제 LLM 깊은 풀이 반영**: 진단 — `buildPdfModel`이 `reading.metadata.displayName`(미populate)→**'달빛이' 목업 이름**, generic 서사, **결제한 LLM 본편 미반영**의 하이브리드. 수정 — `resolvePdfSubjectName`(input.name 우선, never '달빛이'), print 페이지가 `generateLifetimeInterpretation`(캐시) 호출 → `interpretation`을 `buildPdfModel`에 주입, LLM 9섹션을 PDF 슬롯에 `firstSentences()`로 **레이아웃-bounded** 매핑. `pdf-report-text.ts` 순수 헬퍼 + TDD.
- **#383 대운곡선·12개월 키워드 실데이터 + LLM 9섹션 전문 페이지(P9)**: 대운 곡선 = `cycleFortuneScore`(오행 생극: 인성85/비화80/식상76/재70/관66), 12개월 = `monthKeywordForScore`. **결정론 유지(가짜 숫자 아님)**. 결제 본편이 있으면 9번째 페이지(`deepReading`)에 **LLM 9섹션 전문 노출**.
- **#384 PDF 페이지 번호 분모 동기화**: #383의 P9 추가로 footer가 "PAGE 9 / 8"(분모 8 하드코딩) 버그 → `totalPages = deepReading ? 9 : 8`를 모든 footer 분모에 주입. 무료/구버전 `/ 8`, 결제 본편 `/ 9`.

### UX (앞선 머지)
- **#373 결제 내역(현금) 전면 노출**: 단건·평생·코인팩·멤버십 모두 표시.
- **#374 회원가입 생년월일 입력 통일**: 사주 입력폼과 동일한 `UnifiedBirthInfoFields`로 교체.

### 마이그레이션 상태 (⚠️ 수동 적용 — CI 자동 아님)
- `041_ai_lifetime_interpretations`(Phase 0a) · `042_ai_llm_runs`(Phase 0b): **적용됨**(라이브 검증 통과).
- `043_refund_requests`(Phase 2): **사용자 확인으로 prod 적용 완료**(2026-05-27). 환불 처리는 진행 중.

### 운영 후속 (코드 밖 — 사용자 작업)
- ✅ `043_refund_requests` prod 적용: 사용자 확인 완료(2026-05-27).
- **super_admin 지정**(`admin_users.role` 또는 `ADMIN_USER_IDS` 부트스트랩) — 환불 최종 승인 권한. 이미 지정됐다면 닫힘.
- ✅ **결제 계정으로 PDF 시각 확인**: 사용자 확인으로 P9 포함 `PAGE 9 / 9` 확인 완료.
- 실제 Toss 환불은 사용자 확인으로 진행 중.

### 교훈
- **본편 캐시 키**는 `reportHash + feedback + targetYear` — feedback/targetYear 누락 시 캐시 오염(스펙 갭이었음).
- **Phase 0b가 이미 텔레메트리 테이블을 구축** → Phase 3는 중복 테이블 없이 대시보드만(원안의 `llm_usage_logs` 폐기).
- **PDF는 모델 주도 렌더**(`buildPdfModel` 출력이 그대로 렌더로 흐름) → 글로서리·사전이 아니라 **빌더가 조립한 실제 출력 문장**으로 검증해야 함.
- 고정 A4 슬롯에 LLM 가변 텍스트를 넣을 땐 `firstSentences(n)`로 길이 bound(레이아웃 안전).

---

## 2026-05-25 세션 — 어휘·문장 품질 + UI 정합 + 12간지 선생 리브랜드 (#364~#368)

> 사용자 production 스크린샷 제보로 시작: 오늘운세/자세히보기 한자(己亥)·비문, 메인 카드 검은 배경. 5개 PR로 처리. 모든 코드 작업 main 기반 worktree → PR → CI green → squash 머지 → Vercel 자동 배포.

### 머지 완료
- **#364 어휘·문장 품질**: (A) today-detail 마감문장 한자 일진(己亥)→한글 독음(`formatTodayDateMarker`). (B) 평생리포트 SHORTAGE/EXCESS 사전 reason 메타포 오행어(새싹/햇살/흙/쇠/물 기운)→표준 "목/화/토/금/수 기운" + "기운" 중복 제거(10건). (C)(D) 오늘운세 plain 티어 비문("말하는 쪽을 챙기면 감정이 덜 엉킵니다"/"말이 부족하면"/"생각이 내 성향과 같은 흐름")을 일상어로 자연화. **핵심 교훈: 오늘운세 본문은 "기운"조차 금지(plain 티어, 테스트가 강제) → lifetime-report만 "X 기운".** 회귀 테스트 추가(vocab-quality·practical-action-vocab).
- **#365 홈 카드 배경 흰색 복원**: #351/#352 다크 통일 revert(`gangi-market.tsx`). footer 검정(#350 globals.css)은 분리·유지.
- **#366 홈 카드 제목 선생 병기**: `GANGI_HOME_CARDS` 10개 "기능명 · 선생"(사용자 지정 매핑).
- **#367 12간지 선생 3명 리브랜드 + 메뉴 일치**: 재물닭→**별닭**(별자리)/손금멍→**상담멍**(고민 상담)/이동말→**길일말**(좋은날·택일). `dialogue-experts`(topic·keywords·answerFrame·RAG 오버레이)·`moonlight`·`gangi-ui`·메가메뉴 대화탭 일관 변경(slug/id/zodiac 라우트 유지). ⚠️ 기존 재물운·이동운·손금 대화 주제 의도적 대체. 메가메뉴(PC/모바일)·푸터 서비스명도 홈카드와 "기능명 · 선생" 일치. 관상원·복돼지선생 유지. `route.test.ts` 단언 갱신.
- **#368 V2 엔진 오행 라벨 표준화**: `FRIENDLY_ELEMENT_LABEL`(나무/불/땅/쇠/물 기운)→표준 "X 기운"(`saju-data-v2-upgrade` 모던 풀이 반영). fixture 스펙 2건 동반 갱신.

### 정합성 메모 — 아래 옛 "미해결/미착수" 상태 갱신
- ✅ **궁합 입력 폼 잘림**(2026-05-24 "미해결 1") → **#349(spacer CTA clearance)로 해결·머지됨**.
- ✅ **footer 회색**("미해결 2") → **#350(z-index로 앰비언트 오버레이 위)으로 해결·머지됨**.
- ◐ **사이트 네비/홈 카드 통일**("미착수") → #351~#353(다크 통일·별자리 뒤로가기)로 일부 진행 후, #365에서 카드 다크는 흰색으로 되돌림(사용자 요청).
- ✅ **점수 Phase 2~7**(하단 §4 Tier 표 SC2~SC5 ⬜) → #305/#307~#312/#314로 **이미 완료·배포**됨(표가 stale).
- ✅ **lifetime 환불 "회수 함수 없음"**(아래 가격정책 (b)) → `revokeProductEntitlement`·`payments/bundle.ts` 일괄회수 **존재**(#342).
- ◐ 여전히 열림(2026-05-27 갱신): 코인 만료 정책↔구현 불일치는 `040_credit_lots_expiry`로 해소. `/credits` prepare/동의, bundle digital-content 동의, credit addCredits paymentKey 멱등성은 후속 Codex 세션에서 보강. today-detail 중복 과금 환불은 진행 중. audit 🟡 2(총평 문장수 enforce·대운 LLM 다양성)는 별도.

### 후속
- 선생 명칭: 관상원·복돼지는 주제 부합으로 유지. 추가 변경 시 별도 PR.
- 시각 확인 권장: #365 카드 흰색·footer 검정 / #366·#367 긴 제목(메가메뉴·푸터) 줄바꿈 / #367 `/dialogue` 3선생(별닭·상담멍·길일말) 페이지.

---

## 2026-05-24~25 세션 — today-detail 결제 정합성 완결(#356) + 콘텐츠 대확충(궁합 LLM·띠운세·꿈해몽)

> 메인 작업 디렉토리는 `docs/progress-pricing-2026-05-23` 브랜치 유지. 모든 코드 작업은 **main 기반 worktree(`.claude/worktrees/*`)에서 격리** → PR → CI(typecheck·test·Playwright·Vercel preview) green → squash 머지 → Vercel 자동 배포. (이 PROGRESS.md 작성 외 docs 브랜치 미접촉.)

### 머지·배포 완료
- **today_fortune_feedback 테이블 복구** (SQL Editor, 코드 PR 아님): 오늘운세 피드백 "평가하기"가 PostgREST `Could not find the table 'public.today_fortune_feedback' in the schema cache` 오류. 코드·마이그레이션(023)은 존재하나 **prod DB에 테이블 부재**(`migration list`엔 023 applied인데 카탈로그엔 없는 drift). 023 SQL을 Supabase SQL Editor에서 직접 실행 + `NOTIFY pgrst 'reload schema'`로 복구. ⚠️ **교훈: DB 마이그레이션은 CI 자동 아님 → supabase CLI 수동 적용. main 머지/Vercel 배포로 스키마 반영 안 됨.**
- **#355 피드백 raw 오류 노출 fix**: `ml-feedback` API가 PostgREST raw 영문 오류를 사용자 화면에 그대로 반환 → 고정 한국어 안내만 반환 + raw는 `console.error` 서버 로그. `route-helpers.feedbackSaveErrorResponse` 분리 + 단위테스트(누출 방지 단언).
- **#356 today-detail 결제 정합성 완결** (핵심·P0): #346이 결제 grant/조회를 안정 `readingKey` 근거로 옮기고 `checkTodayDetailAccess`(단일 읽기)를 도입했으나 **unlock 라우트만 옛 `today:${sourceSessionId}`(세션마다 가변) 조회로 남아** "이미 구매 ↔ 풀이열기 누르면 무료결과로 되돌아감"의 직접 원인. (한 계정이 **6회 결제·6개 다른 scope_key**로 데이터 확인.)
  - Layer 1: unlock GET/POST 권한 판정을 `todayDetailEntitlementScopeKeys`(readingKey 우선 + legacy readingId) + **같은날(KST) fallback**으로 통일(entitlement API와 동일). 신규 `hasTodayDetailEntitlementForDay`. → readingKey 해시 드리프트·과거 readingId 결제분도 당일이면 인정.
  - Layer 2(근본): today-fortune 생성이 매 요청마다 새 reading(UUID) INSERT → `sourceSessionId` 휘발. `findReadingByInput`로 동일 사주 reading 재사용(전체 readingKey 일치).
- **#357 후속 감사/검증** (docs): today-detail 중복결제 감사 SQL + score-factor(사주풀이 550원) 정합성 검증 → 읽기·쓰기 모두 `score:${readingKey}:${factorId}` 동일 스코프, 별도 휘발성 unlock 경로 없음 → **이상 없음(수정 불필요)**.
- **#358 콘텐츠 보완 로드맵 + 궁합 LLM 활성**: 궁합·띠운세·꿈해몽 로드맵 + 확정 결정 문서. **궁합 깊은 풀이 LLM 프로덕션 활성** — `OPENAI_INTERPRET_COMPATIBILITY=1`(Vercel prod env 설정 + 재배포). #345로 코드는 있었으나 **플래그 OFF·`.env.example` 미문서화**라 무료·유료 모두 결정론 fallback(무료 4축 재포장)만 보던 게 "궁합 내용 안 바뀐 느낌"의 원인. 플래그 문서화.
- **#359 띠운세 연생별 풀이**: 12지 × 5연생 = **60편**. `ZodiacFortune.byYear`(간지·독음·오행·풀이·행동조언) + `/zodiac/[slug]?birthYear=` 연생 칩 UI(라우트 폭증 없음). `EXPECTED_BY_YEAR` 표로 간지 정확성 강제, 한자·금지어 전수 가드.
- **#362 띠운세 같은-오행 말 다양화**: 같은 천간 오행 연생이 띠 달라도 같은 문장틀 쓰던 문제 → 오행별 12지 **1:1 비유 배정**(화=화롯불/횃불/촛불/등댓불/불꽃놀이…)으로 60편 재작성(간지·길이·톤 유지).
- **#360 꿈해몽 풍부화(phase1+2)**: 구조 강화(`fortune` 길/흉/중립 뱃지·`action` 행동가이드·`detailSlug` 검색↔상세 연결) + 사전 **33→206**. 흉몽은 "주의·점검 신호" 순화 톤(공포·단정 회피) + "민속·상징 해석, 단정 아님" 안내.
- **#361 꿈해몽 추가 확충**: 206→**304**(+100, 동물·자연·사물·인물·행동·신체·음식 6카테고리 고루, 중복 0).

### 추가 머지·배포 완료
- **#363 띠운세 기간별 한 줄 + 기간탭/연생칩 스크롤 고정**: 기간 탭(오늘/주/월/년)이 점수·라벨은 바꾸나 헤드라인은 `item.summary` 고정 + 탭/연생칩 클릭 시 화면 맨위로 스크롤되던 2건. → `ZodiacFortune.periodLines`(12지×4=48문장)로 헤드라인을 `periodLines[period]` 교체(라벨-내용 일치) + 기간탭/연생칩 `<Link scroll={false}>`. typecheck 0 / 667 테스트.

### 운영 후속 (코드 밖)
- ⚠️ **today-detail 중복 과금 환불**: 감사 SQL(`docs/superpowers/plans/2026-05-24-today-detail-followups.md`)로 다건 결제자 산출 → **Toss `paymentKey`로 중복분 부분 환불**(1건은 정상 이용분 제외). 예: 본 사례 계정 6건 중 5건 ≈ 2,750원.
- 배포 후 재테스트: 오늘운세 자세히보기(결제 정상화)·궁합(LLM 풀이)·띠운세 연생 칩·꿈해몽 검색.

### 참고
- 설계/계획 문서: `docs/superpowers/specs/2026-05-24-*` (today-detail 스코프, 콘텐츠 로드맵), `docs/superpowers/plans/2026-05-24-today-detail-followups.md`.
- main 진행: #355→#356→#357→#358→#359→#360→#361→#362 순 머지(최신 `10a4bd0` 시점 이후 갱신).

---

## 2026-05-24 세션 — 결제 무한반복 fix + 온보딩 제거 + 궁합입력 잘림(미완) + footer 회색(미해결)

### 머지·배포 완료
- **#346 결제 무한반복 fix** (production 배포 완료): "오늘 자세히보기"(today-detail) 권한이 불안정한 reading id(slug, 매번 바뀜)에 묶여, 사주 재생성·경로 교차 시 결제해도 권한을 못 찾던 P0. `product-scope.ts`의 today-detail scope를 **readingKey(생년월일 결정적·안정)** 근거로 통일 + `today-detail-access.ts`에 `todayDetailEntitlementScopeKeys`(readingKey 우선 + legacy readingId 병행) + coin 3키. entitlement API·checkout을 `checkTodayDetailAccess`로 통일. dead code(entitlement/route-helpers) 제거.
- **#347 온보딩 강제 redirect 제거** (배포 완료): `app/page.tsx`에서 `moonlight:onboarded` 쿠키 미보유 시 `/onboarding` 강제 redirect 제거. 온보딩은 4슬라이드 인트로 carousel(필수 데이터 X)이라 제거해도 기능 영향 0. `/onboarding` 라우트·컴포넌트는 유지(분리).
- **#348 궁합 입력 폼 하단 잘림 fix** (배포됐으나 **여전히 잘림 — 미해결**): `app-shell.css`의 `:has(footer) { padding-bottom:0 !important }`가 main pb를 덮어, 하단 fixed CTA(약 101px)가 폼 마지막(출생지 안내)을 가림. `compatibility-input-client.tsx` AppPage에 `pb-36 md:pb-0` 추가했으나 production 여전 잘림.

### 미해결 — 다음 세션 최우선
1. **궁합 입력 폼 잘림 (재발)**: #348의 pb-36이 효과 없음. production HTML 분석 결과 `compatibility-input-client.tsx`에 **AppPage가 2개** 존재(`pb-36 md:pb-0` 적용된 것 + pb-36 없는 것). **실제 보이는 입력 폼 AppPage가 fix 안 된 쪽일 가능성**. → `grep -n "AppPage" src/features/compatibility/compatibility-input-client.tsx`로 로딩/폼 분기의 AppPage들을 모두 찾아, 실제 입력 폼 AppPage에 CTA clearance를 적용해야 함. 구조: CTA는 line ~851 `fixed inset-x-0 bottom-0`, AppPage는 app-shell-content 안, footer(SiteFooter)는 main 안(app-shell.tsx:41). app-shell.css의 `:has(footer)` pb 0 !important가 main pb를 덮으므로 보이는 폼 컨테이너 AppPage에 직접 pb 부여가 정답.
2. **footer 회색 (장기 미해결·미궁)**: `site-footer.tsx` 배경 inline `#000000` + `globals.css:18` `footer.site-footer-redesign{background:#000!important}` 둘 다 검정. computed `backgroundColor=rgb(0,0,0)` 확인. 그런데 화면(production·localhost, 사용자 육안+playwright 헤드리스 모두) 회색. **Dark Reader 아님 / Chrome 강제 다크(Auto Dark Mode) 끔 확인 — 둘 다 원인 아님.** top-layer ::backdrop·전체 가상요소·오버레이·합성 속성(opacity/filter/blend) 모두 배제. → **다음: 사용자 실제 브라우저 개발자도구로 footer 요소의 Styles/Computed `background-color`를 직접 확인(스크린샷). production(ganjisaju.kr) vs localhost 어느 쪽인지도 구분.** 자동 도구로는 코드 #000만 확인되고 화면 회색 원인 규명 실패.

### 확인 완료 (수정 불필요)
- **대운(10년 흐름)**: 의도적 무료 설계(`saju/[slug]/deep` 주석 — AI 평생리포트 49,000원 upsell 미끼). 게이팅 없음. 화면의 "무료" 표시 정상.

### 미착수
- **사이트 전반 네비게이션 개선**: 홈 하단 검은 카드(오늘운세·사주풀이) 스타일 통일 + 클릭 시 다음 페이지 바로 이동 + 모든 화면 이전/다음 네비게이션 추가. (사이트 전반 큰 UI 작업, 별도 세션 권장)

### 환경 참고
- 메인 작업 디렉토리 `/Users/kionya/ganji-saju` 현재 브랜치 `docs/progress-pricing-2026-05-23`. main 최신 `62b6178`(#347까지 머지, #348도 머지됨). 검증용 dev server는 메인에서 PORT 3000으로 띄웠음.
- worktree에서 dev server는 Turbopack이 심볼릭 node_modules를 거부함 → 메인에서 dev 실행 권장.

---

## 다음 작업 (2026-05-23 이어서 — 가격/결제 정합성)

사용자가 가격 정책 비일관성 지적(총운 무료 / 대운·오늘자세히 550 / 분야 990 / 좋은날 1,900 / 올해 3,900 / 보관형 49,000 — 구조 어색). 진행 순서:

**(a) 가격 정책 개편안 문서 완성** — `docs/payments/pricing-proposal.md` (2026-05-27 상태 기본 문서는 존재하며, 로컬 구현 반영 상태로 갱신 필요). 구조 개선 골자:
- 단건 최고가(3,900) ↔ 보관형(49,000) 사이 빈 중간 구간을 **묶음(번들) 상품(1만원대)** 으로 연결
- 콘텐츠 지속성/범위 비례 차등(현재 `taste_score_factor` 550 일괄 → 대운 등 장기 콘텐츠 상향)
- 결제 경로 정합화(코인 vs 단건 현금). 2026-05-27 상태 monthly-calendar는 `2코인`/`1,900원` 양쪽 경로를 의도적 대안으로 노출 중.
- 멤버십(`membership_*`)에 풀이 unlock 혜택 연결(현재 AI 대화 코인 전용이라 분리됨)
- 보관형 49,000 재검토

**(b) 코드/표기 P0 정합성 정비** (근거: `docs/payments/product-catalog.md §2`):
- 이중 결제 경로 — 동일 기능(예: 월간달력 1,900원 단건 = 2코인)이 코인 차감 + 단건 현금 양쪽 노출 → 통일/분리
- 화면 라벨 ↔ `catalog.ts` 표기 불일치 — 예: 화면 "올해흐름"(990?) vs catalog `taste_year_core` "올해 핵심 3줄"(3,900) → 통일
- `lifetime_report`(49,000) **환불 인프라** — revoke 함수 + admin 환불 요청/승인 + 043 테이블까지 구현. 사용자 확인으로 043 적용 완료, 환불 진행 중.
- 코인 만료 정책 불일치(FAQ "1년 유효" vs 구현 영구)는 `040_credit_lots_expiry`의 `credit_lots` 1년 만료 모델로 해소.

> ⚠️ 세션 메모: 운세+결제 상세를 채팅으로 길게 출력하면 자동 콘텐츠 안전필터 오탐으로 응답이 truncation/차단됨. → 상세 표·수치는 **문서 파일에 기록**, 채팅은 요약만.

---

## 0. 2026-05-22 (점수 결제 연동 세션) — Phase 2+3 스펙 빌드(#314) + score-factor per-factor 550원 결제 연동(#315) + 결제 동의 무한루프 fix + 레거시 정리(#316)

붙여넣은 `phase-2-3-task.md` 스펙(LockGate per-factor 550원 모델)대로 점수 UI 를 신규 빌드(#314 머지)하고, 그 LockGate "풀이 보기" 를 **실제 Toss 550원 결제 + 항목(F1~F5) 단위 해제**로 연결(#315). 작업 중 발견한 **결제 동의 체크박스 무한 렌더 루프(기존 버그, 모든 checkout 영향)** 를 근본 수정하고, score-factor 권한을 위한 **마이그 038** 을 prod 에 적용. 마지막으로 스펙 모델로 대체된 **레거시 점수 컴포넌트 4종을 제거**(#316). #314 머지 완료, #315·#316 PR open(머지 대기).

### 0.1 PR 누적 표 (#314 머지 · #315·#316 open)

| PR | commit | 상태 | 내용 |
|----|--------|------|------|
| #314 | `14b0071` | 머지 | **Phase 2+3 스펙** — LockGate per-factor(550원) 모델 + 점수 UI(원형 SajuScoreCard·ScoreBreakdownCard·OhaengChart 막대·LifetimeKeysCarousel) + v4 `@theme` 토큰(score-*/ohaeng-*) |
| #315 | `e68803a` | open | **score-factor 결제 연동** — catalog/product-scope/checkout/LockGate/score-factor-access + 결제 동의 무한루프 fix + 마이그 038(NOT VALID) |
| #316 | `23eed0f` | open | **레거시 점수 컴포넌트 제거** — SajuScoreGauge/SajuScoreBreakdown/SajuOhaengBalance/SajuOhaengChart + 배럴 정리(–281 라인) |

### 0.2 Phase 2+3 스펙 빌드 (#314, 머지)

- 붙여넣은 스펙 근거 신규 모델: `LockGate`(무료 🔒 → 결제 모달 / 유료 자세히→ 링크), 원형 `SajuScoreCard`(rAF `useCountUp`), `ScoreBreakdownCard`(F1~F5 막대 + per-factor `LockGate`), `OhaengChart`(막대, 레이더 대체), `LifetimeKeysCarousel`.
- Tailwind v4 `@theme` 토큰(`--color-score-*` 5등급+soft, `--color-ohaeng-*` 5요소+soft) + `labels` 보강 — 동적 클래스 purge 회피 위해 **LITERAL 색상 맵**(`getScoreColorClasses`/`OHAENG_COLOR_CLASSES`).
- ※ 0-prev-3(#305)의 "Phase 2~3 시각토큰+UI" 와 구분 — 이번 #314 는 붙여넣은 스펙(550원 per-factor 모델)으로 **재정의된** 빌드.

### 0.3 score-factor per-factor 550원 결제 연동 (#315)

- **catalog**: `TasteProductId += 'score-factor'`, `taste_score_factor` 패키지(550원, `requiresSlug`).
- **product-scope**: `buildScoreFactorScopeKey` = `score:{readingKey}:{factorId}`, `parseFactorScope`, `resolvePaymentProductScope`/`buildPurchasedProductHref` 의 score-factor 분기.
- **LockGate** "풀이 보기" → `/membership/checkout?product=score-factor&slug&scope=F1&from=saju-result`.
- **checkout**: score-factor 상품 안내(점수 풀이 보기, 소액 풀이, dragon zodiac).
- **score-factor-access** `getSajuScoreFactorEntitlements(slug)`: F1~F5 entitlement 조회(방어적 all-locked). 결과 페이지 `ScoreBreakdownCard unlockedFactors` 로 항목별 잠금/해제.
- **키 일치 확인**: grant 경로(`confirm` → `grantTasteProductEntitlement('score-factor', score:{readingKey}:{factorId})`) ↔ read 경로(score-factor-access) 모두 `toSlug(reading.input)` 동일 키.

### 0.4 결제 동의 무한 렌더 루프 fix (기존 버그, #315 동봉)

- **증상**: `/membership/checkout` 진입 시 "Maximum update depth exceeded" 수백 건. `?plan=premium` 등 score-factor 무관 경로 포함 **모든** 결제 checkout 재현.
- **근본 원인**: `PaymentConsentCheckboxes` notify effect 가 `onValidChange` 콜백 identity 를 deps 에 포함 → 부모(`TossMembershipCheckout`)가 매 렌더 인라인 콜백 전달 → 콜백이 `setAcceptedKinds(새 배열)` 호출 → 부모 재렌더 → 새 콜백 → effect 재실행 → ∞.
- **수정**: `onValidChange` 를 ref 로 고정, notify effect 는 `[accepted, pkg]` 변경 시에만 실행(동의→버튼 활성 동작 유지). 서버 로그(재컴파일 후 0건) + 콘솔 카운터(토글 0건)로 검증.

### 0.5 마이그 038 — product_entitlements CHECK + score-factor (prod 적용)

- `product_entitlements.product_id` CHECK 에 `'score-factor'` 추가(없으면 grant `23514`).
- **드리프트 대응**: 전체 검증형 재생성 시 prod 레거시 product_id 행이 `23514`(violated by some row)로 실패 → **`NOT VALID`** 로 추가(신규 INSERT/UPDATE 강제 + 기존 레거시 행 grandfather). prod 적용 완료(Supabase SQL Editor).

### 0.6 레거시 점수 컴포넌트 제거 (#316)

- 스펙 모델로 대체돼 참조 0건이 된 `SajuScoreGauge`·`SajuScoreBreakdown`·`SajuOhaengBalance`·`SajuOhaengChart`(레이더) 제거 + 배럴 정리(–281 라인).
- 순수 로직 `getDominantOhaeng`/`getOhaengBalanceLevel` 은 오행 LLM 가이드가 계속 사용 → 유지. 소비자 0건이 된 나머지 lib export(`getScoreLevelToken`/`getBarFillPercent`/`computeOhaengRadarPoints` 등)는 전용 테스트 동반 제거라 **별도 후속 PR**로 분리.

### 0.7 검증 / 운영

- typecheck 0 · 단위 157 + spec 64 = **221 pass** · 메인 CI 게이트(Test·Typecheck·Build) #315·#316 모두 pass.
- 브라우저(dev): 결제 루프 0건, score-factor checkout 정상 렌더(점수 풀이 보기/550원).
- 마이그 038 prod 적용 완료. #315·#316 머지 시 결제→해제 라이브.
- 📦 release(예정): `2026-05-22 점수 per-factor 결제 연동 + 동의 무한루프 fix + 레거시 정리`

---

## 0-prev. 2026-05-22 (점수 풀스택 + 도크 fix 세션) — 점수 Phase 4~7 + 가이드 캐시 + LLM 활성화 + 무료/유료 경계 + 모바일 도크 (PR #307~#312)

점수 시스템을 **Phase 4~7 로 완주**(오행 레이더 → LLM 가이드 → 가이드 영속 캐시 → 실제 결과 페이지 연결 → 무료/유료 경계)하고, **운영(마이그 037 적용 + LLM 가이드 플래그 ON)** 까지 활성화. 추가로 사용자 보고 **모바일 도크 가림 버그**를 근본 수정. 6 PR 모두 main 머지 + 프로덕션 배포 완료. 점수 시스템이 기획→구현→배포→수익화 경계까지 라이브.

### 0.1 PR 누적 표 (#307 ~ #312, 6개)

| PR | commit | 내용 |
|----|--------|------|
| #307 | `05dd53a` | **Phase 4 오행 레이더** — `computeOhaengRadarPoints`(펜타곤 5축)·`getDominantOhaeng`·`getOhaengBalanceLevel`(순수, 10 유닛) + `SajuOhaengChart`(레이더 SVG) + 카드 통합 |
| #308 | `aa161be` | **Phase 5 오행 LLM 가이드** — `ohaeng-guidance/`(content·validator·cache·prompts·generate, 플래그 OFF 기본·결정론 fallback). total-review-validator `hardTextReasons`/`countGyeol` export 재사용(naming-policy 단일 소스) |
| #309 | `f3ea496` | **가이드 영속 캐시 + 마이그 037** — `ai_ohaeng_guidance_interpretations` + cache-store(in-memory+Supabase 방어적) + TTL 30일 + read-through('llm'만 저장) |
| #310 | `95392df` | **Phase 6~7 결과 페이지 연결** — `from-saju-data` 어댑터(한자→한글) + 결과 페이지 무료 게이지 + 프리미엄 전체 카드(lifetime 게이팅) |
| #311 | `2d51ec5` | **무료/유료 경계 강화** — 결과 페이지 `SajuScoreGauge` preview(등급명+🔒, 총점 미렌더=서버 컴포넌트라 HTML 미포함=진짜 페이월) |
| #312 | `9ae2806` | **모바일 도크 가림 fix** — footer 없는 페이지 dock-clearance 복원(`:has()` 분기) |

### 0.2 점수 Phase 4 — 오행 레이더 차트 (#307)

- `src/lib/saju-score/ohaeng-chart.ts`(순수): 펜타곤 5축(목 top·시계방향 72°) 좌표 + count 비례 데이터 폴리곤(`maxScale` clamp·0 나눗셈 방지), `getDominantOhaeng`(동점 시 목화토금수), `getOhaengBalanceLevel`(F4 0~20 → high/mid/low). 10 유닛.
- `SajuOhaengChart`(서버 컴포넌트): 그리드 펜타곤+스포크 + 데이터 폴리곤(도미넌트 색) + 오행별 꼭짓점/축라벨 + 균형 캡션. viewBox 여백으로 라벨 클리핑 방지. `SajuScoreCard` 오행 섹션에 레이더+막대 병행.

### 0.3 점수 Phase 5 — 오행 LLM 가이드 (#308)

- 신규 `src/server/ai/ohaeng-guidance/`(총평 LLM 파이프라인 lean 미러): types·content(input 빌더+결정론 fallback)·validator·cache(키+`isOhaengGuidanceLLMEnabled`)·prompts·`generateOhaengGuidance`(오케스트레이터: 플래그 OFF→fallback / ON→LLM(DI)→validate→재시도→실패 fallback). 20 유닛.
- validator 는 `total-review-validator` 의 `hardTextReasons`/`countGyeol` 를 export 해 재사용(한자 0·명리어 0·"X의 기운" 차단·자극/일일톤 0·"결" ≤1).
- env `OPENAI_INTERPRET_OHAENG_GUIDANCE`(기본 OFF). `SajuOhaengChart` 가 `guidanceText` 표시.

### 0.4 가이드 영속 캐시 + 마이그 037 (#309)

- `ohaeng-guidance-cache-store.ts`: `OhaengGuidanceCacheStore`(get/set) + in-memory(DI/테스트) + Supabase **방어적**(env/테이블 없으면 no-op·null) + TTL 30일 + read-through(`source='llm'` 만 read/write).
- 마이그 **037** `ai_ohaeng_guidance_interpretations`(036 동일 구조: cache_key+prompt_version UNIQUE, RLS 활성 service-role 전용, `guidance_text TEXT`). content-addressed → 오행 분포당 1회.

### 0.5 Phase 6~7 결과 페이지 연결 + 무료/유료 경계 (#310·#311)

- 어댑터 `from-saju-data.ts`: 엔진 `SajuDataV1/V2`(한자 기둥) → 점수 `SajuData`(한글). `ganzi-korean` 변환 재사용. 격국/용신/신강약 null 폴백, 길신·흉살·공망 기본값(결과 페이지 미보유), 시주 미상 빈문자. `computeSajuScoreFromData`. 6 유닛.
- **무료/유료 경계(최종)**: 결과 페이지(`/saju/[slug]`) = `SajuScoreGauge` preview(**등급명+🔒, 총점 미렌더**) + 프리미엄 CTA. 프리미엄(`/saju/[slug]/premium`) = 전체 `SajuScoreCard`(총점+내역 F1~F5+오행 레이더+해설) **lifetime 권한 게이팅**(비엔타이틀 시 blur+🔒). preview 는 서버 컴포넌트라 총점이 클라이언트 HTML 에 미포함(진짜 페이월).

### 0.6 모바일 도크 가림 버그 fix (#312)

- **증상**: footer 없는 페이지(`footer={false}` 6개: login/today-fortune(+loading)/credits(+loading)/reset-password)에서 하단 버튼이 고정 도크(z-40)에 가려지고 스크롤로도 못 올림.
- **근본 원인**(app-shell.css 모바일 미디어쿼리, 2026-05-20 변경): main 의 dock-clearance padding 을 일괄 0 으로 만들고 도크 여백을 `site-footer-redesign` footer 패딩에 위임 → footer 없는 페이지는 여백 0.
- **수정**: `:has()` 분기 — footer 있는 페이지는 0 유지(흰 공간 회귀 방지), 없는 페이지는 `var(--app-mobile-dock-clearance)` 복원. 미지원 브라우저는 규칙 무시(악화 없음). 브라우저 실측: /login·/today-fortune padding 0→117.6px·하단 버튼 도크 위로, 홈(footer) 무회귀.

### 0.7 운영 활성화

- 마이그 **037 프로덕션 적용**(Supabase 대시보드 SQL Editor, 멱등).
- **`OPENAI_INTERPRET_OHAENG_GUIDANCE=1`**(Vercel production) + 재배포 → **오행 LLM 가이드 라이브**. 엔타이틀 사용자 프리미엄 카드에서 생성, 캐시(037)로 분포당 1회. 실패 시 결정론 fallback.

### 0.8 정량 지표 / release

- 유닛 테스트 562 → **618**(+56). 점수 시스템 Phase 1~7 + 캐시 + 어댑터 + 도크 fix.
- 모든 점수 컴포넌트 사용자 화면 라이브(무료 등급 미리보기 / 유료 전체). 도크 가림 6개 페이지 해소.
- 📦 release: `2026-05-22 점수 시스템 Phase 4~7 + 가이드 캐시 + LLM 활성화 + 무료/유료 경계 + 도크 fix`

---

## 0-prev-2. 2026-05-21~22 Codex 세션 — 공개 상용화 P0 차단 이슈 제거 + clean main 배포

작업자: **Codex**. Claude Code 2026-05-21 10시 작업 스냅샷을 로컬 백업으로 보존한 뒤, Codex 작업 브랜치에서 공개 페이지 상용화 차단 이슈를 정리했다. 최종 배포/머지는 백업 커밋을 main 에 포함하지 않도록 `origin/main`에서 만든 clean 브랜치에 P0 커밋만 cherry-pick 해서 진행했다.

### 0.1 백업 / 브랜치 원칙

| 항목 | 값 |
|------|-----|
| Claude 백업 브랜치 | `backup/claude-code-2026-05-21-1000` |
| Claude 백업 태그 | `claude-code-2026-05-21-1000` |
| 백업 커밋 | `df529d6 backup: Claude Code 2026-05-21 10시 작업 스냅샷` |
| 로컬 bundle 백업 | `.git/backups/claude-code-2026-05-21-1000.bundle` |
| Codex 작업 브랜치 | `codex/2026-05-21-1900-work` |
| clean 배포 브랜치 | `codex/2026-05-22-commercialization-p0` |
| main 반영 커밋 | `4ee2484 fix(commercialization): clear public P0 blockers` |

### 0.2 Codex P0 수정 범위

| P0 | 처리 내용 |
|----|-----------|
| 도메인 통합 | `src/proxy.ts`, `src/lib/site.ts`에서 legacy host 를 `https://ganjisaju.kr` 로 **301** 정규화. path/query 보존. Unicode/Punycode 한국어 도메인 테스트 추가 |
| `/login` | "준비 중", "불러오는 중" 제거. 로고, 서비스 설명, 카카오 로그인, Google 로그인, 약관/개인정보 링크, 고객센터 이메일, 로그인 실패 문의 안내 노출. `next` 파라미터는 OAuth callback/email login 모두 유지 |
| `/credits` | 비로그인 상태에서도 코인팩, 정책, 로그인 CTA 노출. 로딩/준비 문구 제거. 중복 footer 제거 |
| `/today-fortune` | "오늘 흐름을 불러오는 중" 제거. loading 상태와 실제 폼 동시 노출 방지. 중복 footer 제거 |
| 멤버십 문구 | "대화 상담 무제한", "무제한" 계열 판매 문구 제거. 일/월 사용량 제한 + 공정사용정책 문구로 교체 |
| `/dialogue/appointment` | 30분 상담 100코인, 50,000원 상당, 보유/부족 코인, 추천 충전팩, 취소/노쇼/상담사 불참 환불 정책 표시. 실제 데이터 없는 경력/평점/상담건수 제거 |
| 결제 동의 구조 | 기존 중복 동의 블록 제거. `PaymentConsentCheckboxes` 단일 "결제 전 확인" 블록으로 통합. 구독은 다음 결제일/해지 방법/무료체험 여부 표시 |
| 개인정보처리방침 | OAuth, PG, LLM API, 호스팅, 분석도구 수탁자와 AI 프롬프트/응답 저장, AI 학습 활용/거부, 국외이전, 보유/파기/삭제 요청, 14세 미만 아동 처리 방침 보강 |
| 정책 URL | `/terms`, `/privacy`, `/refund-policy`, `/digital-content-policy`, `/subscription-policy`, `/coin-policy`, `/appointment-policy`, `/ai-disclaimer`, `/commerce-disclosure` 접근 가능한 bundled policy fallback 추가 |
| 금지 문구 테스트 | 공개 상용화 핵심 파일 대상 금지 문구 회귀 테스트 추가: 준비 중/준비중/로딩중/불러오는 중/결과가 없습니다/TODO/FIXME/placeholder/mock/dummy |

### 0.3 신규/주요 파일

- `src/lib/bundled-policies.ts` — DB 정책이 비어 있거나 낮은 버전일 때 사용할 9개 정책 기본 본문.
- `src/lib/public-commercialization-copy.test.ts` — 공개 상용화 페이지 금지 문구 및 로그인 필수 구성 회귀 테스트.
- `src/lib/policies.ts` — bundled policy fallback / DB 정책 우선순위 보강.
- `src/app/login/page.tsx` — Codex가 정리한 로그인 완성 화면 및 fallback 필수 구성 반영.
- `src/app/credits/page.tsx`, `src/app/today-fortune/page.tsx`, `src/app/dialogue/appointment/page.tsx` — 공개 핵심 유료 흐름 상용화 차단 문구 제거 및 고지 보강.

### 0.4 검증 결과

| 명령/검증 | 결과 |
|-----------|------|
| `npm test` | PASS — 157 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next 16.2.3, 184 static pages |
| `git diff --check origin/main..HEAD` | PASS |
| `npm run audit:mockup-placeholders:strict` | PASS — 의심 패턴 0 |
| 브라우저 검증 | `/login?next=%2Fcredits`, `/credits`, `/today-fortune`, `/dialogue/appointment`, `/privacy` 핵심 문구 확인 |
| 라이브 검증 | `https://ganjisaju.kr/login?next=%2Fcredits` HTTP 200, "준비 중"/"불러오는 중" 0건 |

### 0.5 배포 / 머지

- 원격 브랜치 푸시: `origin/codex/2026-05-22-commercialization-p0`
- main fast-forward merge: `0f0e4f4..4ee2484`
- main push 완료: `origin/main = 4ee2484`
- Vercel production deployment: `dpl_5qeqzzh9jbzTti3FBzAuJTdS8Dk9`
- Production URL: `https://ganjisaju.kr`
- Inspect URL: `https://vercel.com/ganji-sajus-projects/ganji-saju/5qeqzzh9jbzTti3FBzAuJTdS8Dk9`

### 0.6 운영 메모

- `backup/claude-code-2026-05-21-1000` 커밋에는 `.mcp.json`, `.claude/`, 대량 audit report, screenshots, design docs 가 포함되어 있으나 **main 에는 병합하지 않았다**.
- Codex P0 변경만 main 에 반영되어 롤백 시 `4ee2484` 이전 `0f0e4f4` 또는 백업 브랜치/태그를 근거로 비교 가능하다.
- `npm run lint` script 는 현재 `package.json`에 없어 실행 대상 없음.

---

## 0-prev-3. 2026-05-21 (점수 UI 세션) — 점수 시스템 Phase 2~3: 시각 토큰 + UI 컴포넌트 (PR #305)

점수 시스템 Phase 1(계산 엔진 #303) 후속으로 **Phase 2(라벨/색상 시스템) + Phase 3(UI 컴포넌트)** 를 1 PR(2 원자 커밋)로 마무리. PROGRESS 로드맵 "Tailwind 토큰 → UI 컴포넌트" 구간. main 머지(squash `0f0e4f4`) + 프로덕션 배포 완료 — **단, 실제 사용자 페이지 미연결(컴포넌트만 추가)** 이라 사용자 체감 변화 없음. (시간순: 이 세션 이후 Codex 상용화 P0 세션이 main `4ee2484` 로 이어짐.)

### 0.1 PR (#305, squash `0f0e4f4`)

| 구분 | 내용 |
|------|------|
| Phase 2 | visual-tokens 단일 소스 + labels/ohaeng 파생 리팩터 + 유닛 11 |
| Phase 3 | 게이지·내역·오행·통합카드 4 컴포넌트 + /dev/saju-score QA 쇼케이스 |

### 0.2 Phase 2 — 점수 시각 토큰 단일 소스 (라벨/색상 시스템)

- 신규 `src/lib/saju-score/visual-tokens.ts`: UI 가 소비할 색상/라벨을 한 곳에서 관리(단일 소스).
  - 등급(5) `SCORE_LEVEL_TOKENS`(tailwind 클래스 6종 + SVG용 hex), 오행(5) `OHAENG_TOKENS`(hex + "X 기운"), 내역지표(F1~F5) `BREAKDOWN_FACTOR_META`(일상어 라벨·max 20·hex).
  - resolver `getScoreLevelToken`/`getScoreLevelTokenByTotal`(labels 임계값 90/75/60/45 동일)·`getOhaengToken`·`getBreakdownFactorMeta` + `getBarFillPercent`(0~100 clamp, max≤0 → 0).
- `labels.ts`/`ohaeng.ts` 를 토큰 파생으로 정리 — 색상 중복 제거, 공개 반환 shape 불변(`getLabel().color` 6필드 / `computeOhaengChart().colors|labels`) → 기존 562 테스트 그대로 통과.
- TDD: RED(모듈 부재) → GREEN(11 테스트) → REFACTOR(파생 단일소스). 라벨/설명 한자 0(naming-policy §2·§9).

### 0.3 Phase 3 — 점수 UI 컴포넌트 (서버 컴포넌트)

- 신규 `src/components/saju-score/`:
  - `SajuScoreGauge` — 총점 0~100 원형 SVG 게이지(반지름 52, 둘레로 dashoffset) + 등급 라벨(제목/부제/설명/면책).
  - `SajuScoreBreakdown` — F1~F5 막대(라벨·값/20·fill%·지표색). 표시값 정수 반올림(소수 노출 제거).
  - `SajuOhaengBalance` — 다섯 기운 상대 막대(최대치 대비) + 부족/과다 칩.
  - `SajuScoreCard` — `SajuScore` 하나로 게이지+내역+오행 통합.
- `src/app/dev/saju-score/page.tsx` — 컴포넌트 QA 쇼케이스(8 샘플, 등급 스펙트럼). **production `notFound()` + noindex**.
- 스타일 관례 준수: `app-*` CSS var + 인라인 hex(동적색 → Tailwind purge 무관). `'use client'` 불필요(순수 프레젠테이션).

### 0.4 검증

- 유닛 573(+11) green · node:test 157 · vitest 64(5파일) · **typecheck 0** · 회귀 0.
- 브라우저(`/dev/saju-score`): 등급별 게이지색 매핑(84·81=emerald / 72·68·67·61=blue / 59·54=amber) + dashoffset 점수 비례 + F1~F5 막대 + 오행 부족/과다 칩 + 콘솔 에러 0.
- CI: `Test, Typecheck, Build` ✅ · `Playwright smoke E2E (Phase 2A)` ✅ · Vercel 배포 ✅.

### 0.5 신규/변경 파일

- 신규: `saju-score/visual-tokens.ts`(+`__tests__/visual-tokens.test.ts`) · `components/saju-score/`(4 컴포넌트 + index) · `app/dev/saju-score/page.tsx`.
- 변경(파생 리팩터): `saju-score/{labels,ohaeng,index}.ts`.

### 0.6 메모 / 후속

- `saju-score-spec.md`/`phase-1-task.md` 는 미커밋(임시 기획 문서) — Phase 2/3 범위는 PROGRESS 로드맵 + 기존 코드 패턴 근거로 확정.
- 컴포넌트 렌더 테스트는 리포에 0개(러너가 `.test.ts`만 발견) → 로직은 visual-tokens 유닛으로, UI 는 브라우저/Playwright 로 검증하는 관례 유지.
- **점수 Phase 4~7**: 오행 차트 UI → LLM 가이드 연계(`OhaengChartData.guidanceText`) → 무료/유료 경계 → **실제 사주 결과 페이지에 `SajuScoreCard` 연결**(현재 미연결, 최우선 후속).
- 📦 release: `2026-05-21 점수 시스템 Phase 2~3 — 시각 토큰 + UI 컴포넌트`

---

## 0-prev-4. 2026-05-21 세션 종합 — 사주 총평 LLM 풀스택 + 영속 캐시 + 어휘 정책 + 점수 Phase 1 (PR #299~#303)

사주 결과 *총평 탭* 을 결정론 7문장 단락에서 **LLM 3섹션(한 줄 요약 + 본문 4단락 + 평생 활용 3카드)** 으로 확장하고, 비용 최적화(영속 캐시) · 어휘 정책(naming-policy) · 점수 계산 엔진(Phase 1)까지 5 PR 로 마무리. 모두 main 머지 + 프로덕션 배포 완료.

### 0.1 PR 누적 표 (#299 ~ #303, 5개)

| PR | commit | 내용 |
|----|--------|------|
| #299 | 68ae221 | 총평 LLM 파이프라인 — _easy 도출 → 3섹션 병렬 생성 → §7 검증 10항목 → fallback. env 플래그 게이팅(기본 OFF). TDD |
| #300 | cf925e6 | 영속 캐시 — content-addressed(cache_key 해시) Supabase 테이블. 조회마다 차감 → 사주+컨텍스트당 1회 |
| #301 | 96a37d7 | naming-policy 어휘 정책 반영 — GANGUK 라벨 "결" 제거 · SIPSIN_SHORT · §12 정규식 검증 |
| #302 | e5a0335 | 어휘 최종 스펙 잔여 2건 — 격국 label 설명형 · 오행 "X의 기운" 차단 |
| #303 | 69029a0 | 점수 시스템 Phase 1 — F1~F5 계산 엔진 + 50 케이스 분포(평균 65.3) |

### 0.2 총평 LLM 파이프라인 (PR #299)

- 신규 모듈 `src/server/ai/total-review/` (types · content · build-input · prompts · generate · cache · 전용 OpenAI 클라이언트) + `lib/saju/total-review-validator.ts` + `saju-total-review-service.ts` + 컴포넌트 2종(`SajuTotalReviewNarrative`·`SajuLifetimeKeysSection`).
- 입력 `_easy` 도출: `dayMaster`·`sixtyGapja`·`fiveElements`·`yongsin`·`pattern` → 일상어. 강점/약점 3개씩 보강(sixtyGapja 부족분 패딩). deepStripHanja 로 한자 0.
- 3섹션 `Promise.all` 병렬 → validateTotalReview(§7 10항목) → hard 위반 시 deterministic(`buildSajuNarrative`) fallback.
- 🐛 발견·수정: `gpt-5.2-chat-latest` 가 `temperature` 미지원(400) → 전용 클라이언트에서 미전달.

### 0.3 비용 최적화 — 영속 캐시 (PR #300)

- 결과 페이지가 dynamic 렌더라 캐시 없으면 **플래그 ON 시 총평 조회마다 3 OpenAI 호출 차감**(새로고침·fallback 포함) — 문제 발견 후 캐시로 해결.
- `ai_total_review_interpretations`(마이그 036, `cache_key`+`prompt_version`, server-role RLS). read-through: hit→source `'cache'`, `'llm'` 만 write(fallback 미캐시). 30일 TTL. content-addressed → 사용자 무관 dedup.

### 0.4 어휘 정책 (naming-policy.md) 반영 (PR #301·#302)

- `naming-policy.md` = 최상위 어휘 권위. 오행 "X 기운" / 십성·격국·강약 원어+설명 / "결" 라벨·요약·카드 0회·단락 ≤1 / 한자 사주팔자 카드만.
- GANGUK_EASY 라벨 "결" 제거("본인 기운이 강한 편" 등) · SIPSIN_SHORT(십성 설명, "X의 결" 없는 버전) · 격국 label 설명형 · validator §12 정규식 7종 + 오행 "X의 기운" hard 차단.
- §12 검증: 실제 콘텐츠 위반 0건(매칭은 시스템 프롬프트 "금지 예시" 메타 참조뿐).

### 0.5 점수 시스템 Phase 1 — 계산 엔진 (PR #303)

- 신규 `src/lib/saju-score/`(10파일, 989줄): F1(일주)·F2(격국)·F3(용신)·F4(오행균형)·F5(합충신살) + `computeSajuScore` + 5단계 라벨 + 오행 차트 + 50 케이스 + 분포 검증.
- 십성→천간 *관계식 계산*(100엔트리 테이블 대신 오행·음양). 12운성 테이블. MVP 격국/용신 판정.
- 분포(§14 가중치 튜닝): 평균 60.9→**65.3** / 표준편차 12.5 / potential 10%·excellent 0%(≤15%). 결정론 100회 확인.
- **순수 계산 엔진만** — UI·LLM·결제 미포함(Phase 2~7 후속).

### 0.6 신규 DB / 플래그 / 모듈

- DB: 마이그 **036** `ai_total_review_interpretations`(적용 완료).
- env: **`OPENAI_INTERPRET_TOTAL_REVIEW`**(프로덕션 =1, 캐시로 비용 최적화).
- 모듈: `total-review/`(11파일) · `saju-score/`(10파일) · `total-review-validator.ts`.

### 0.7 운영 적용 현황

- 총평 LLM: 프로덕션 **활성**(플래그 ON + 마이그 036 + 캐시). 사주+컨텍스트당 1회 생성, 재조회 캐시 hit(0 호출).
- 점수 시스템: 엔진만 main 반영, **UI 미연결**(사용자 화면 변화 없음).
- 권장 스테이징 QA(미완): 상황 보유 reading 으로 단락2 직업·단락4 고민 반영 육안 / 5케이스 BEFORE-AFTER / 비전문가 가독성.

### 0.8 정량 지표 (Before → After)

| 지표 | Before | After |
|------|--------|-------|
| 총평 본문 | 7문장 단락 | 4단락(25~35문장) + 평생활용 3카드 |
| 총평 한자/명리어 | 노출 | 0 (validator 차단) |
| 총평 비용(플래그 ON) | 조회마다 3호출 | 사주+컨텍스트당 1회(캐시) |
| 어휘 | "쇠의 결"/"X의 결" | "X 기운"/"…사주" (§12 0건) |
| 점수 엔진 | 없음 | F1~F5 + 50케이스(평균 65.3) |
| 유닛 테스트 | ~538 | **562** |

### 0.9 후속 (다음 주기)

- **daewoon-llm-spec 어휘 반영**(B 확정 — 태스크 칩 생성): 챕터 `COMMON_SYSTEM_PROMPT` · `chapter-validator` · `MYEONGRI_GLOSSARY`("X의 결") 한 묶음. 라이브 9챕터 + 전역 글로서리라 신중히.
- **점수 Phase 2~7**: Tailwind 토큰 → UI 컴포넌트 → 오행 차트 UI → LLM 가이드 연계 → 무료/유료 경계.
- 📦 release: `2026-05-21 총평 LLM 풀스택 + 어휘 정책 + 점수 Phase 1`

---

## 0-prev-5. 2026-05-20~21 세션 종합 — V2-5 LLM 풀스택 + 검증 1~6 사이클 + 톤 정합화 (17 PR #281~#297)

진단서 6단계 검증을 순차 진행하면서 발견된 미흡 사항을 즉시 PR 로 처리. *9 챕터 LLM 풀이 인프라 완성* + *사용자 보고 톤 정합화* + *피드백 루프 + 대시보드* 까지 한 사이클 종료.

### 0.1 검증 1~6 사이클 결과

| 단계 | 결과 | 비고 |
|------|------|------|
| 1 (회귀 테스트) | ✅ PASS | 5 보존 영역 모두 유지 |
| 2 (P0 spot-check) | ✅ PASS (PR #281) | 6 버그 중 ⑥ chapter fallback 자극 문구 잔존 발견 → 즉시 fix |
| 3 (네이밍 마이그레이션) | ✅ PASS | 옛 옛 라벨 잔존 0건 (정확 매핑 strict grep) |
| 4-A (LLM 구조) | ⚠️ PARTIAL → ✅ 완료 (PR K/L/M/N) | 9챕터 중 8 LLM 활성 + 8/8 금지 규칙 + JSON schema + 병렬 호출 |
| 4-B (콘텐츠 다양성) | ✅ PASS (실측 7/8 LLM) | §5 8개 패턴 모두 목표 이내 + 챕터 간 첫 문장 중복 0 |
| 4-C (톤 품질) | ✅ PASS (LLM 본문 87.5%) | 자극 0건 + 컨텍스트 반영 + Few-shot 톤 일치 |
| 5 (일반화) | ⚠️ PARTIAL | OpenAI rate limit (TPM 30K) 한계 — Tier upgrade 권장 |
| 6 (운영) | ⚠️ PARTIAL | telemetry 비용 추적 + 캐시 OK, multi-user 보강 필요 |

### 0.2 진단서 후속 권장 5종 — 완료 현황

| 작업 | PR | 결과 |
|------|-----|------|
| (1) chapter-telemetry 비용 추적 | PR Q (#288) | ✅ model/usage/userHash 로깅 |
| (2) 9장 fallback 변별력 | PR Q (#288) | ✅ 사주별 dominant/weakest 인용 |
| (3) OpenAI Tier upgrade | — | ⚪ 운영팀 결정 영역 |
| (4) 사용자 피드백 루프 | PR R (#289) | ✅ 별점 + Yes/No (옵션 A) + DB 마이그 035 |
| (5) 품질 모니터링 대시보드 | PR S (#289) | ✅ /admin/saju-feedback (집계 + 최근 stream) |

### 0.3 추가 작업 (admin UX + 시간축 + 자유 코멘트)

| 작업 | PR | 결과 |
|------|-----|------|
| /admin/operations admin nav grid | PR T (#291) | ✅ 8개 admin 페이지 link + saju-feedback NEW 배지 |
| chapter-feedback service-role 조회 | PR T (#291) | ✅ admin RLS 우회로 모든 사용자 피드백 집계 |
| 일별 추이 차트 | PR U (#292) | ✅ 30일 sparkline (응답/별점/helpful) |
| 자유 코멘트 활성화 | PR U (#292) | ✅ ChapterFeedbackCard textarea (200자) |

### 0.4 사용자 보고 — 총평 페이지 P0 톤 정합 (3 PR)

사용자 스크린샷 보고: *"오늘운세 무료보다 더 내용 없는 풀이, 문장 어법 어색, 한자 범벅"*

| 미흡 | PR | fix |
|------|-----|-----|
| "안정이 앞서고 정리가 비기 쉬운 날" 어법 | PR V (#293) | ELEMENT_INFO 자연 표기 → "토 기운이 강하고 금 기운이 부족한 날" |
| 한자 본문 노출 (`계미(癸未) 일간`, `金 (금)을(를)`) | PR V (#293) | `ganziForBody` 한글만 + `formatElementLabel` → "금 기운" |
| 호명 3회 (X님 · X님이) | PR V (#293) | `buildSituationClosing` 호명 제거 — headline 1회만 |
| 칩 라벨 추상명사 (기질 생각 / 강점 안정 45%) | PR W (#294) | ELEMENT_INFO 통일 → "기질 금 기운 / 강점 토 기운 45%" |
| 사주 술어 한 단락 동시 노출 (신약·식신격·대운·세운·월운·용신 6+) | PR W (#294) | sentenceLuck 대운 1개로 압축 + strengthLevel 일상어화 |
| chip 한자 잔존 (일주 계미(癸未) / 대운 경오(庚午)) | PR X (#295) | chip 한자 완전 제거 + 4 pillars 카드만 한자 정체성 유지 |

### 0.5 후속 인프라 (helper + audit)

| 작업 | PR | 결과 |
|------|-----|------|
| 사주 술어 → 일상어 변환 helper | PR Y (#296) | `toPlainKorean()` 53종 매핑 + tests 11개 |
| 9 챕터 본문 톤 audit (LLM 미호출) | PR Z (#297) | 3 케이스 × 9 영역 측정 — chapter-validator 4룰 ✅, 4 잔존 미흡 식별 |

### 0.6 PR 누적 표 (#281 ~ #297, 17개)

| PR | commit | 영역 |
|----|--------|------|
| #281 | `f690430` | P0 ⑥ 자극 문구 차단 + 회귀 가드 (chapter-pattern-templates) |
| #282 | `fbdc726` | V2-5 PR K — 9장 LLM synthesis (priorChapterDigests) |
| #283 | `20629f8` | V2-5 PR L — 2·3·6·7 LLM + 1~7 병렬 호출 (Promise.all) |
| #284 | `b7a2a4e` | V2-5 PR M — validator 룰 3종 (결 빈도/문장 길이/막연한 위로) + Few-shot 예시 |
| #285 | `ce88285` | V2-5 PR N — 명리 술어 반복 룰 + JSON structured output |
| #286 | `80a6bce` | 자연 비유 라벨 (쇠의 결) → 한글 표기 (금 기운) + chapter-validator 튜닝 |
| #287 | `a305623` | V2-5 PR P — 톤 미흡 보강 (호명 1회 + 한 문장 술어 1개) |
| #288 | `b91f04f` | V2-5 PR Q — chapter-telemetry 비용 추적 + 9장 fallback 변별력 |
| #289 | `edc9dfb` | V2-5 PR R+S — 사용자 피드백 루프 + 품질 모니터링 대시보드 |
| #290 | `ee1b00d` | 035 마이그레이션 RLS policy idempotent hotfix |
| #291 | `99e2304` | V2-5 PR T — operations admin nav grid + chapter-feedback service-role 조회 |
| #292 | `f11e349` | V2-5 PR U — 시간축 추이 차트 + 자유 코멘트 활성화 (옵션 B) |
| #293 | `a6ae824` | V2-5 PR V — 총평 narrative P0 hotfix (한자/호명/조사/카피) |
| #294 | `cc5e255` | V2-5 PR W — 칩 라벨 정합 + ELEMENT_LABELS 정리 + 술어 한 단락 감소 |
| #295 | `c1bc70b` | V2-5 PR X — chip 영역 한자 완전 제거 (정책 일관) |
| #296 | `f99df96` | V2-5 PR Y — 사주 술어 → 일상어 변환 룰 helper 사전화 |
| #297 | `989a2fb` | V2-5 PR Z — narrative deterministic 톤 audit script + 보고서 |

### 0.7 신규 DB / API / 컴포넌트

#### DB 마이그레이션
- `supabase/migrations/035_chapter_feedback.sql` — chapter_feedback 테이블 (user_id, reading_id, chapter_id, rating, helpful_bool, comment) + UNIQUE 제약 + RLS + updated_at trigger. PR #290 으로 *DROP POLICY IF EXISTS* idempotent 패턴 추가.

#### API endpoints
- `POST /api/saju/chapter-feedback` — 피드백 upsert (인증 필수, RLS auth.uid=user_id)

#### server-side helpers
- `src/lib/saju/chapter-feedback.ts` — recordChapterFeedback / listChapterFeedbackForReading / getChapterFeedbackStats / getChapterFeedbackTimeseries / listRecentChapterFeedback
- `src/lib/saju/plain-translate.ts` — toPlainKorean / strengthToPlain / luckToPlain / isMyeongriTerm (53종 사전)

#### UI 컴포넌트
- `src/components/saju/chapter-feedback-card.tsx` — 별점 5개 + Yes/No + 자유 코멘트 textarea (200자), 비로그인 시 로그인 안내
- `src/components/admin/chapter-feedback-timeseries-chart.tsx` — 30일 sparkline grid (응답 수 / 평균 별점 / helpful 비율)

#### admin 페이지
- `src/app/admin/saju-feedback/page.tsx` — 챕터 피드백 집계 표 + 시간축 차트 + 최근 50개 stream
- `src/app/admin/operations/page.tsx` — admin sub-nav grid 8개 link 추가

#### 9 챕터 LLM 인프라 (8 챕터 활성)
- `src/server/ai/chapters/build-chapter{1,2,3,4,5,6,7,9}-input.ts` — chapterId 별 LLM 입력 변환
- `src/server/ai/chapters/enhance-lifetime-chapter{1,2,3,4,5,6,7,9}.ts` — summary 교체 + fallback
- `src/server/ai/chapters/chapter-prompts.ts` — 9 챕터 lens + forbiddenTopics + FEW_SHOT_EXAMPLES (1·4·5·9)
- `src/server/ai/chapters/openai-chapter-client.ts` — JSON schema 강제 (useJsonMode default true)

#### validator (chapter-validator.ts) 10개 룰
1. hanja (한자) / 2. x-과-label (옛 오행 라벨) / 3. english (영어) / 4. absolute (자극) / 5. cross-chapter (첫 문장 중복) / 6. punch-copy-duplication / 7. gyeol-frequency ("결" 5회) / 8. sentence-length (65자) / 9. vague-comfort (막연한 위로) / 10. myeongri-jargon-repetition (명리 술어 반복)

### 0.8 측정 인프라 + 결과

#### scripts (LLM 측정 / audit)
- `scripts/measure-llm-chapters.mjs` — 1996.06.01 06:30 男 + 8 챕터 LLM 호출 측정 (~$0.05/회)
- `scripts/measure-llm-5-cases.mjs` — 5 케이스 일반화 테스트 (~$0.25)
- `scripts/audit-narrative-tone.mjs` — deterministic 본문 톤 측정 (LLM 미호출, 무료)

#### audit-reports
- `audit-reports/2026-05-20-verification-4b-llm-output.md` — 검증 4-B 실측 (7/8 LLM)
- `audit-reports/2026-05-20-verification-5-generalization.md` — 검증 5 일반화 (rate limit 발견)
- `audit-reports/2026-05-20-narrative-tone-audit.md` — PR Z deterministic 본문 audit (4 잔존 미흡 식별)

### 0.9 운영 적용 안내

#### 즉시 적용 완료
모든 PR 머지 + Vercel 자동 배포 — production 반영 완료.

#### 사용자 액션 필요
1. **DB 마이그레이션 035 적용** (PR #289):
   ```bash
   supabase db push
   # 또는 Supabase Dashboard SQL Editor 에 035_chapter_feedback.sql 실행
   ```
2. **OpenAI Tier upgrade 검토** — TPM 30K (Tier 1) → 동시 사용자 1명 한계. multi-user production 운영 시 Tier 2+ (TPM 90K+) 권장.
3. **9 챕터 LLM enabled flag** — env 활성 시 풀 LLM 풀이:
   ```
   OPENAI_INTERPRET_CHAPTERS=1
   OPENAI_INTERPRET_CHAPTER_IDS=1-9
   ```

### 0.10 후속 권장 작업 (PR Z audit 결과 기반)

| 우선순위 | 작업 | 영향 |
|---------|------|------|
| 🔥 P0 | deterministic builder fallback summary 변별력 강화 (wealthStyle/coreIdentity/careerDirection) | §5 ①·② 패턴 잔존 직접 원인 |
| ⚠️ P1 | build-lifetime-report 의 ELEMENT_LABELS 잔존 정리 (PR Y plain-translate helper 활용) | 어휘 통일 |
| ✅ P2 | 장문 65자 초과 3건 단축 (A·strengthBalance, B·lifetimeStrategy, C·strengthBalance) | 가독성 |
| ✅ P3 | chapter 8 (대운) daewoon-llm-spec 위임 구현 | 9 챕터 LLM 활성화 8/9 → 9/9 |
| ✅ P3 | 2·3·6·7 챕터 Few-shot 예시 (spec §5 추가 작성 후 코드) | LLM 톤 안정성 ↑ |
| ✅ P3 | AB 테스트 인프라 — prompt 버전별 rating 시계열 비교 | 품질 측정 객관화 |

### 0.11 진단서 검증 사이클 종료 — 정량 지표

| 지표 | 시작 | 현재 (PR #297 후) | 개선 |
|------|------|--------------------|------|
| 9챕터 LLM 활성화 | 3/9 | **8/9** | +166% |
| 응답 시간 (7챕터) | 15초 (직렬) | **5초** (병렬) | -67% |
| chapter-validator 룰 | 6 | **10** (gyeol/sentence-length/vague-comfort/myeongri) | +67% |
| Few-shot 예시 | 0/9 | 4/9 (1·4·5·9) | +∞ |
| 8 금지 규칙 | 5/8 | **8/8** ✅ | +60% |
| JSON structured output | 자유 텍스트 | **schema 강제** ✅ | — |
| 사용자 피드백 인프라 | 0 | **별점 + Yes/No + 코멘트 + admin 대시보드** | — |
| 사용자 보고 톤 정합 | 4 미흡 | **0 미흡** (PR V/W/X) | -100% |
| chapter-validator 4룰 통과 (deterministic) | — | **3 케이스 × 9 영역 모두** | ✅ |

---

## 0-prev2. 2026-05-20 저녁 세션 종합 — UX 라운드 3 + V2-5 PR J + Phase 8 SEO (10 PR 머지 + 1 close)

오후~저녁 한 세션에 PR #271 ~ #280 진행. 세 축:
1. **UX 라운드 3** (3 PR 머지 + 1 close) — 홈 UX 폴리시 / nav 폴리시 / 12별자리 StarSignChip / footer color (롤백)
2. **V2-5 PR J** (1 PR 머지) — 챕터 4·5 LLM enhancement + envelope chain
3. **Phase 8 SEO 콘텐츠 품질 개선** (5 PR 머지) — 3 area metadata 통일 + 콘텐츠 보강 + paid funnel 공통화

### 0.1 진행된 것 (완료 — main 머지) ✅

#### UX 라운드 3 — 3 PR 머지 + 1 close

| PR | 제목 | 요약 |
|---|---|---|
| #271 | UX (a) banner kbd nav + 온보딩 슬라이드 transition | GangiSeasonBanner viewport `<div>` 에 tabIndex=0 + role="region" + aria-roledescription="carousel" + ←/→/Home/End keydown handler + focus-visible:ring-2. OnboardingCarousel 슬라이드 본문 wrapper 에 `key={idx}` 로 re-mount → `motion-safe:animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-300 delay-75` 적용. prefers-reduced-motion 자동 disable |
| #272 | UX (b) 태블릿 nav vacuum 해소 + 메가메뉴 hover 마이크로 인터랙션 | hamburger button `md:hidden` → `lg:hidden` 변경 — 태블릿 (768~1023px) 영역에서 dock 안 보이고 mega-nav 도 lg+ 부터라 진입 vacuum 발생 → mobile-nav-sheet (lg+ 강제 hidden) 가 태블릿에서도 정상 펼침. mega-nav-signup/login `:hover` + `:active` 에 translateY(-1px) + box-shadow lift (signup=pink, login=dark) + prefers-reduced-motion 가드 |
| #273 | UX (c) 12별자리 StarSignChip 신설 + 메인 별자리 카드 적용 | PROGRESS.md §0.4 (12별자리 'pig' 차용 불일치) 해소. 신규 `src/components/gangi/star-sign-chip.tsx` (12 sign ♈~♓ + element 색상 + generic 밤하늘 chip). `GangiServiceCard` 에 `chipKind` / `starSign` optional 추가. 메인 카드 그리드의 별자리 카드 chip 이 12간지 'pig' (indigo) → 밤하늘 인디고 그라데이션 + ✦ + 별 점 텍스처로 명확히 차별화 |
| ~~#274~~ | ~~footer dim color 톤업~~ | **close — 사용자 결정으로 롤백**. footer default 0.72 / 브랜드 카피 0.62 / chevron 0.6 / NavLink 0.62 → 모두 0.8~1.0 로 톤업한 PR 이었으나 사용자 검토 후 원래 dim 위계 유지 결정 |

#### V2-5 PR J — 1 PR 머지

| PR | 제목 | 요약 |
|---|---|---|
| #275 | V2-5 PR J — 챕터 4·5 LLM enhance + envelope chain | PR #261 (챕터 1) 와 동일 패턴 확장. 신규 6 파일: `build-chapter4-input.ts` + `build-chapter5-input.ts` + `enhance-lifetime-chapter4.ts` + `enhance-lifetime-chapter5.ts` + 각 TDD 테스트 (12 케이스). 수정: `saju-lifetime-service.ts` 의 `interpretLifetime` 안 chain — `applyChapter1 → applyChapter4 → applyChapter5` 순차 await. envelope `_chapters[4]`, `_chapters[5]` upsert. env disable 기본값 (회귀 0). 동시 cache miss × 3 시 envelope last-write-wins (다음 request 보정, 최대 ~$0.01 1회 redundant 비용 허용). 5 commit (Task 1~5 TDD). test 89 → 101 pass (+12) |

PR J 본격 구현 전 audit: PR #261 의 production monitoring 결과 = `chapter_run` 이벤트 0건 (7d) → env disable default 의도 충족 (회귀 0). 사용자 의도 "회귀 0 확인" 으로 PR J 즉시 진행 가능 판단

#### Phase 8 SEO 콘텐츠 품질 개선 — 5 PR 머지

Phase 8 spec (꿈해몽 10 sections / 띠운세 11 sections / 별자리 9 sections / 내부링크 / 메타데이터) 의 전체 5 PR 분할 + 순차 진행 + 완결.

| PR | 제목 | 요약 |
|---|---|---|
| #276 | Phase 8-A SEO metadata + JSON-LD schema 통일 | 신규 `src/lib/seo/structured-data.ts` (Article + FAQPage + BreadcrumbList schema builder + XSS-safe serializer) + `src/lib/seo/page-metadata.ts` (`buildContentPageMetadata` 통일 helper). 3 SEO area detail 페이지 (`/star-sign/[slug]` / `/zodiac/[slug]` / `/dream-interpretation/[slug]`) 의 `generateMetadata` 통일 + 본문에 Article + BreadcrumbList JSON-LD 2개씩 inject |
| #277 | Phase 8-B 별자리 detail 내부링크 보강 (연애 타로 + 유료 CTA) | §6 연애 section 끝에 `/tarot/daily?topic=love` cross-link (pink-soft ghost). 마지막 cross-saju CTA section 에 유료 funnel 2 grid (사주 550원~ + 궁합 990원, `?from=star-sign` UTM). 12×12 호환 매트릭스 + 기존 saju upsell 모두 보존 |
| #278 | Phase 8-C 띠운세 11 sections (§궁합·조심할 띠) | 신규 `src/lib/zodiac/zodiac-relations.ts` — 12지 전통 호환 매트릭스 (삼합 三合 4 group + 육합 六合 6 pair + 육충 六沖 6 clash). 각 띠 `idealMatches` 4 (삼합 2 + 육합 1 + 보조 1) + `bewareMatches` 1 (육충) + `matchSummary` / `bewareSummary` 한 줄. 페이지에 §궁합·조심 article 추가 + chip 양쪽 grid + 사주 CTA `?from=zodiac` UTM + 유료 funnel 2 grid |
| #279 | Phase 8-D 꿈해몽 10 sections + 800자+ 본문 + FAQPage | Phase 8 spec 가장 큰 항목 — 기존 ~90 chars 의 단순 2-card 가 빈약하다는 회귀를 해소. 신규 `src/lib/dream/dream-content.ts` (8 entries × 10 sections — 제목/한 줄 요약/기본 의미/상황별 3~4/심리적/행동 3 bullet/주의/관련 꿈/FAQ 2~3). 각 entry 합산 본문 800자+ / 단정·공포·의료 말 금지. 페이지 컴포넌트 enriched 10 sections layout + FAQPage JSON-LD inject (조건부) + 무료 cross-area 3 (오늘운세/타로/꿈해몽 목록) + 유료 funnel 2 (사주/궁합) + `?from=dream` UTM 5건 |
| #280 | Phase 8-E PaidFunnelGrid 공통 컴포넌트 + 무료→유료 cross-area funnel | Phase 8-B/C/D 의 inline funnel ~40 lines × 3 = ~120 lines 의 중복을 `PaidFunnelGrid({ from, tone, includeMembership })` 로 추출. 5 페이지 적용: 별자리/띠 (tone=dark, 멤버십 X) + 꿈/타로 result/today-fortune client (tone=light, includeMembership). Phase 8 spec §4 내부링크 7개 흐름 전체 충족. Phase 8 완결 PR |

### 0.2 운영 적용

- **10 PR 모두 main 머지 + Vercel production 배포 완료** (commit 88bc305 → dbae20d → 844c8f3 → 28ff242 → a805521 → a95a764 → 9fb8a76 → 5882f14 → 82c36cb → 0c1d256)
- 모든 PR 의 CI (Test/Typecheck/Build + Playwright smoke E2E + Vercel Agent Review) 통과
- Release 라벨:
  - `2026-05-20 홈 banner 키보드 nav + 온보딩 슬라이드 transition` (#271)
  - `2026-05-20 태블릿 nav vacuum 해소 + 메가메뉴 hover 인터랙션` (#272)
  - `2026-05-20 12별자리 전용 StarSignChip 신설 + 메인 카드 적용` (#273)
  - `2026-05-20 V2-5 PR J — 챕터 4·5 LLM enhance + envelope chain` (#275)
  - `2026-05-20 Phase 8-A SEO metadata + JSON-LD schema 통일` (#276)
  - `2026-05-20 Phase 8-B 별자리 detail 내부링크 보강` (#277)
  - `2026-05-20 Phase 8-C 띠운세 11 sections (§궁합·조심할 띠)` (#278)
  - `2026-05-20 Phase 8-D 꿈해몽 10 sections + 800자+ 본문 + FAQPage` (#279)
  - `2026-05-20 Phase 8-E PaidFunnelGrid 공통화 + 무료→유료 cross-area funnel` (#280)

### 0.3 다음 세션 큐

#### V2-5 LLM 챕터 라인 (PR J 안정화 후)
- **V2-5 PR K — 챕터 2·3·6·7 LLM** — PR J (#275) 의 production 모니터링 1주일 후. PR J 와 동일 패턴 × 4 챕터. env `OPENAI_INTERPRET_CHAPTER_IDS=1-7` (range 문법 지원). 챕터별 교체 field: Ch 2 `strengthBalance.summary` / Ch 3 `patternAndYongsin.summary` / Ch 6 `careerDirection.summary` / Ch 7 `healthRhythm.summary`. 리팩토링 권장: `buildChapter{N}Input` + `applyChapter{N}LLMEnhancement` 공통화 (현재 1,4,5 의 코드 중복 해소 — PR K 안에서 또는 별도 작은 PR)
- **V2-5 PR L — 챕터 9 synthesis LLM** — PR K 완료 후. 챕터 1-7 의 LLM-enhanced summary digest 를 input 으로 받아 평생 활용 전략 생성. `ChapterLLMInput.priorChapterDigests` (이미 정의됨). cacheKey 에 1-7 digest hash 포함 → 1-7 중 하나라도 재생성되면 9 도 cache miss

#### Phase 8 후속 보강 (선택, 우선순위 낮음)
- 꿈해몽 entries 확장 — 현재 8 entries 의 `DREAM_CONTENT`. `src/lib/dream-dictionary.ts` 의 36 keyword 중 자주 검색되는 entry 추가 (추가 13~28 entry 의 800자+ 콘텐츠)
- 띠운세 호환 데이터 검증 — `ZODIAC_RELATIONS` 의 idealMatches/bewareMatches 가 전통 명리학 패턴과 100% 일치하는지 사용자 review
- 별자리 추가 sections — 신화·헬레니즘 origin / 행성 movement / 별자리 특정 시기 등 (현재 9 sections 외)

#### UI / UX 후속 (5건 모두 완료, 추가 검토 시)
- ~~부채꼴 FAB 데스크탑 대응 (태블릿 noise)~~ → ✅ #272 에서 hamburger lg:hidden 으로 해소
- ~~별자리 카드 zodiac chip 디자인~~ → ✅ #273 에서 StarSignChip 신설
- ~~온보딩 carousel 슬라이드 transition~~ → ✅ #271 에서 motion-safe animate-in 적용
- ~~GangiSeasonBanner 키보드 nav~~ → ✅ #271 에서 ←/→/Home/End 추가
- ~~PC 메가메뉴 회원가입 hover state~~ → ✅ #272 에서 translateY + box-shadow lift 추가

### 0.4 모니터링 (production)

1. **PR #275 V2-5 PR J** — chapter 4·5 LLM 의 production cost (`chapter_run` 이벤트 source=llm 비율, retries, validation_failures, durationMs). env disable default 라 현재 호출 0건 — 1주일 후 PR K 진행 전 확인. Supabase `readings.result_json._chapters` 의 4/5 entry upsert 검증 (env enable 시점 이후)
2. **PR #271 banner kbd nav** — 스크린리더 (VoiceOver/TalkBack) 에서 carousel role + aria-roledescription 정상 인식
3. **PR #272 태블릿 nav** — iPad portrait (820x1180) / iPad Pro (1024x1366 — lg 경계) 에서 hamburger → sheet 자연스럽게 펼침
4. **PR #273 StarSignChip** — iOS Safari / Android Chrome 에서 ♈~♓ 유니코드 glyph + system-ui font 정상 렌더 (font fallback 차이 확인)
5. **PR #276 JSON-LD** — Google Rich Results Test (rich-results.google.com) 통과 — Article + BreadcrumbList 인식. 8-D 의 FAQPage 도 rich result preview 정상 (Q&A snippet)
6. **PR #280 PaidFunnelGrid** — `?from=star-sign / zodiac / dream / tarot / today-fortune` UTM 5종이 사주 / 궁합 / 멤버십 페이지에서 analytics 추적 + conversion 비율 측정
7. **꿈해몽 #279 콘텐츠 톤** — 단정·공포·의료 단정 문구 없는지 (사이트 톤 일관성). 사용자 review 권장

### 0.5 알려진 위험 / 정리 후속

- **PR J chain 의 동시 cache miss × 3 last-write-wins** — 같은 request 안에서 챕터 1/4/5 모두 cache miss 시 envelope upsert 가 마지막 챕터 (5) entry 만 DB 저장. 다음 request 에서 1, 4 재생성 → eventually consistent. 비용 영향 ~$0.01 1회. 회피하려면 apply 함수 signature 변경 필요 (in-memory chaptersEnvelope 도 반환). PR K 진행 시 공통화와 함께 검토 가능
- **PR 271/272/273/275/276/277/278/279/280 의 미반영 footer color tone** — #274 (footer dim color 톤업) 가 롤백되어 main 의 footer 는 여전히 0.72/0.62/0.6 dim 위계. 추후 별도 결정 시 재시도 가능
- **꿈해몽 entries 8개 vs dictionary 36개 격차** — `/dream` (search) 페이지는 36 dictionary entries 모두 검색 가능하지만 `/dream-interpretation/[slug]` detail 페이지는 8 entry 만 enriched. 자주 검색되는 dream 의 detail 페이지 확장 권장
- **buildChapter{1..5}Input 의 helper 중복** — STEM_HANJA_TO_KOREAN / STRENGTH_TO_KOREAN / elementLabel / patternPlainCue / narrowOccupation / narrowConcern 가 5 파일 (chapter 1/4/5 의 input builder) 에 중복 정의. PR K 진행 시 `buildChapterInputBase(chapterId, sajuData, userSituation, options)` 로 추출 검토
- **PaidFunnelGrid 의 멤버십 가격** — "월정액" 으로만 표시. 실제 가격 정해지면 PaidFunnelGrid 내부 ITEMS 의 price 갱신 필요

---

## 0a. 2026-05-20 오전~오후 세션 종합 — V2-4 마이그레이션 완성 + UI 개선 (6 PR)

하루에 PR #265 ~ #270 (6 PR 모두 머지). 두 축:
1. **V2 마이그레이션 V2-4 단계 100% 완성** — production callers / hot path / internal builders 전체 `loadSajuDataV2` 전환 + engine 코어 옵션 호환 패턴
2. **사용자 보고 UI 개선** — 모바일 dock 가시성 / 헤더 MY 메뉴 / hydration 회귀 / 별자리 카드 / 부채꼴 FAB / footer 검정

### 0.1 진행된 것 (완료 — main 머지) ✅

#### V2-4 마이그레이션 완성 — 3 PR

| PR | 제목 | 요약 |
|---|---|---|
| #265 | V2-4 production callers — 8 files loadSajuDataV2 전환 | `audit-reports/2026-05-19-v2-migration-audit.md` §2-D 의 11 파일 중 production caller 8개 전환. API routes 2 (api/ai/route.ts ×2, api/taekil/find-good-days/route.ts), Verification 2 (today-fortune-audit.ts, kasi-calendar.ts), Lib utilities 4 (account.ts, notifications.ts, profile-personalization.ts, compatibility.ts). 변환 패턴: `normalizeToSajuDataV1(input, storedValue, opts?)` → `loadSajuDataV2(input, storedValue, opts?)`. 호환성: SajuDataV2 가 V1 super-set 이라 호출 본문 변경 0. PR #264 의 V1↔V2 entry invariant 30 케이스 모두 통과 |
| #266 | V2-4 hot path — buildFreshTodaySajuData loadSajuDataV2 전환 | hot path 2 파일 (`today-fortune/route.ts:58` + `today-fortune/unlock/route.ts:97,193`) 은 PR #264 의 `buildFreshTodaySajuData` helper 를 통과. helper 1 곳만 `calculateSajuDataV1` → `loadSajuDataV2(input, null)` 로 전환하면 hot path 자동 V2 전환. diff: 1 file, +7/-6. PR #264 의 30 invariant 가 정확히 본 helper 의 V2 전환을 회귀 차단하기 위해 설계됨 |
| #267 | V2-4 internal builders — multi-year cycle loadSajuDataV2 + 옵션 호환 패턴 | internal builder 2 파일 (`build-yearly-report.ts:356,863` + `build-fortune-calendar.ts:168`). 핵심: **calculatedAt/engineVersion 옵션 호환 패턴** 구현. SajuLoadOptions 에 `engineVersion` 추가 + normalizeToSajuDataV1 시그니처에 `calculatedAt`, `engineVersion` 추가 + loadSajuDataV2 가 V1 fallback path 호출 시 `calculatedAt: now` + `engineVersion` 전달. 이로써 multi-year cycle 의 referenceDate 가 V1 fallback 의 calculateLuckData 까지 정확히 전파 — 세운/월운 ganzi 가 yearly target year 근거로 계산 |

#### UI 개선 라운드 1 — PR #268

| PR | 제목 | 요약 |
|---|---|---|
| #268 | feat(navigation): 모바일 dock fix + ScrollToTop + 메뉴 MY 섹션 추가 | **critical bug fix**: 모바일 dock (홈/사주추가/무료운세/대화방/보관함) 이 화면 따라다니지 않음. 원인: `motion-page-transition-frame` 의 `transform + will-change` 가 새 containing block 을 만들어 `position: fixed` 가 깨짐 (top 2134, viewport h=812 → off-screen). 해결: PR #158 (mobile-nav-sheet) 검증된 `createPortal(<nav>, document.body)` 패턴 적용. dock top **682** (viewport 하단 정확 고정). 신규: ScrollToTopButton (Portal mount + scrollY>320 fade-in + prefers-reduced-motion 대응) + PC 메가메뉴 회원가입 ghost 버튼 + 모바일 햄버거 시트에 MY 섹션 (비로그인: 로그인/회원가입 짝꿍 CTA / 로그인: 내 정보/로그아웃 + supabase onAuthStateChange 실시간 구독) |

#### Hydration 회귀 fix — PR #269

| PR | 제목 | 요약 |
|---|---|---|
| #269 | fix(layout): hydration mismatch + script tag 경고 fix | 사용자 보고 dev 콘솔 에러 2건. **(1) Hydration mismatch (SiteFooter dl)**: `business-info.ts` 의 `getEnv(key: string)` 가 `process.env[key]` **동적 키 접근** 사용 → Webpack/Turbopack 의 NEXT_PUBLIC_* inline 은 정적 접근만 지원 → client undefined → `companyItems.filter(item => item.value)` SSR(10) ↔ CSR(0) 불일치. 해결: `BUSINESS_INFO` export 를 `readEnv(process.env.NEXT_PUBLIC_X)` 정적 접근으로 변경 (12 fields). assertProductionBusinessEnv 는 server-only 가드 + 테스트 호환 위해 동적 접근 유지 (책임 분리). **(2) Script tag 경고 (23회 반복)**: layout.tsx 의 `<script dangerouslySetInnerHTML>` 가 `<body>` 안에 위치 → React 19/Next 16 에서 client 컴포넌트 트리 안의 `<script>` 무시 + 경고. 해결: `<head>` 안으로 이동 (FOUC 차단 동작 동일 유지) |

#### UI 개선 라운드 2 — PR #270

| PR | 제목 | 요약 |
|---|---|---|
| #270 | feat(home): 별자리 카드 + 부채꼴 FAB + 온보딩 swipe + footer 검정 fix + ScrollToTop 위치 | 사용자 보고 5건 동시 fix. (1) 메인 카드 그리드에 별자리 진입점 추가 (`zodiac: pig/亥`, 무료, `/star-sign`) + 꿈해몽 위치 교체 (별자리 7번, 꿈해몽 마지막). (2) 온보딩 carousel 좌우 swipe (모바일 터치 + PC 마우스) — pointer events 통합 + `touch-action: pan-y`. GangiSeasonBanner 의 mouse-only 가드도 제거. (3) Footer 검정 (#000000) 적용 안되는 사용자 보고 + 하단 흰 공간 fix — 진단: `.app-shell.app-shell-with-navigation { padding-bottom: var(--app-mobile-dock-clearance) }` (117px, white) + PR #268 의 body padding (5.2rem, white). 해결: body padding 제거 + footer 자체에 모바일 padding-bottom 5.2rem 추가 (검정 배경이 dock 까지 덮음) + main padding-bottom 0 override. 검증: whitespace_below_footer = -1px. (4) Dock 무료운세 FAB → 부채꼴 메뉴 (운세/사주/별자리/띠운세/꿈해몽, 반경 105px, 각도 -170°~-10°). 색상: pink → mystical purple 그라데이션 (pink-strong→plum→indigo). (5) ScrollToTop 위치 `bottom: 5.6rem` → `8rem` (dock 위로 충분한 여유) |

### 0.2 운영 적용

- **6 PR 모두 main 머지 + Vercel production 배포 완료** (commit b1d0d5a / 16dd250 / 72b54c1 / b58094b / a53b111 / 88bc305)
- 모든 PR 의 CI (Test/Typecheck/Build + Playwright smoke E2E + Vercel Agent Review) 통과
- Release 라벨: `2026-05-20 V2-4 production callers` / `2026-05-20 V2-4 hot path helper` / `2026-05-20 V2-4 internal builders + 옵션 호환` / `2026-05-20 모바일 dock portal fix + ScrollToTop + MY 메뉴` / `2026-05-20 hydration mismatch + script tag fix` / `2026-05-20 별자리 카드 + 부채꼴 FAB + 온보딩 swipe + footer 검정`

### 0.3 다음 세션 큐

#### V2 마이그레이션 다음 단계
- **V2-5 PR J — 챕터 4·5 LLM enhance** (2026-05-26 이후 권장)
  - PR #261 (챕터 1 LLM) production 모니터링 1주일 후 진행
  - env: `OPENAI_INTERPRET_CHAPTERS=1` + `OPENAI_INTERPRET_CHAPTER_IDS=4,5` (또는 1,4,5)
  - 챕터 4 (**관계 패턴** — 사람 사이 거리감·전달 방식), 챕터 5 (**재물 감각** — 돈의 흐름) → 별도 `enhanceLifetimeChapter4WithLLM` / `enhanceLifetimeChapter5WithLLM` 함수
  - 챕터 1 의 LLM cost (~$0.005/call) 측정값 검토 후 확장
  - **TDD 구현 plan 작성 완료 (2026-05-20)** — `docs/superpowers/plans/2026-05-20-v2-5-pr-j-chapter4-5-llm.md` (8 Task, 변경 9 파일 / +~600 -3 lines)
  - Pre-flight 확인 (2026-05-20): `CHAPTER_META[4,5]` 및 `CHAPTER_OUTPUT_SPECS[4,5]` 이미 정의됨 (`src/server/ai/chapters/chapter-prompts.ts:53-69, 160-177`) → plan 의 Task 0-2 (META 보강) skip 가능
  - 핵심 trade-off: 동시 cache miss × 3 시 envelope last-write-wins (다음 request 에서 보정, 최대 ~$0.01 1회 redundant). 회피 시 apply 함수 signature 변경 필요 → 본 PR scope 밖
  - chain 호출: `interpretLifetime` 안 `applyChapter1 → applyChapter4 → applyChapter5` 순차 await (각 챕터 env disable 시 baseReport pass-through)
- **V2-5 PR K — 챕터 2·3·6·7 LLM** (PR J 안정화 후)
- **V2-5 PR L — 챕터 9 synthesis LLM** (모든 챕터 정착 후 최종)

#### UI / UX
- **부채꼴 FAB 데스크탑 대응** — 현재 모바일 (md 미만) 만 dock 노출. 데스크탑에서는 PC 메가메뉴 사용 → 부채꼴 메뉴는 모바일 전용으로 OK. 다만 태블릿 (md~lg) 의 noise 검토 필요
- **별자리 카드 zodiac chip 디자인** — 현재 `pig/亥` (indigo) 차용. 12별자리 (Pisces/Aries 등) 전용 chip 컴포넌트 신설 검토
- **온보딩 carousel 슬라이드 transition** — 현재는 즉시 전환. swipe 동작 시 미세한 translate animation 추가 검토 (UX 부드러움)
- **GangiSeasonBanner 키보드 nav** — pointer drag + dots click 만 지원. ←/→ 화살표 키 지원 검토 (접근성)
- **PC 메가메뉴 회원가입 hover state** — 현재 ghost 버튼. hover 시 fill + transform scale 등 마이크로 인터랙션 검토

#### 모니터링 (production)
1. **PR #266 hot path** — `/api/today-fortune` + `/api/today-fortune/unlock` latency drift. Vercel runtime logs + Sentry saju calc error
2. **PR #267 internal builders** — yearly report 페이지의 monthly ganzi 정확성 + Vercel function memory peak (12개월 × 31일 = 372 V2 객체 추가 메모리)
3. **PR #268 dock portal** — 모바일에서 dock 정상 고정 (실기기 사파리/크롬). PR #268 의 createPortal 패턴이 production 빌드 후에도 SSR 정상 동작하는지
4. **PR #269 hydration fix** — production 콘솔 에러 0건 유지 (Sentry frontend errors). SiteFooter dl 정상 렌더
5. **PR #270 부채꼴 FAB** — 사용자 클릭률 (analytics) + 부채꼴 메뉴 각 항목 클릭 빈도. 만약 운세/사주 외 항목 클릭이 거의 없으면 메뉴 항목 재구성 검토
6. **PR #270 footer 검정** — 모든 페이지의 footer 하단 흰 공간 0 보장 (다양한 viewport)

### 0.4 알려진 위험 / 정리 후속

- **부채꼴 FAB pathname 변경 시 닫힘 로직** — `useEffect(() => { setFanMenuOpen(false); }, [pathname])` 적용. SPA 라우팅에서 정상 동작 확인 필요 (특히 prefetch + push)
- **온보딩 swipe vs 세로 스크롤 충돌** — `touch-action: pan-y` 로 세로 스크롤 보존. 모바일 실기기 테스트 권장 (특히 안드로이드 chrome)
- **GangiSeasonBanner mouse-only 가드 제거** — pointer events 가 native scroll-snap 과 동시 동작 시 일부 안드로이드 버전에서 jank 가능성. 후속 사용자 테스트 필요
- **V2-4 internal builder 메모리** — yearly report 1회 호출당 V2 객체 약 372개 생성. interpretation/verification 필드 동봉으로 V1 대비 ~25-40 KB / object. 372 × 30 KB = ~11 MB 추가. Vercel function memory limit (1024 MB) 대비 무난하나 모니터링
- **별자리 카드 zodiac 'pig' 차용** — 12간지 chip 중 indigo 톤. 12별자리 전용 디자인 미반영 (시각적 일관성 측면)

---

## 0a. 2026-05-18~19 세션 종합 — 결제 라우트 통일 + Phase 7 신뢰 장치 구축 (8 PR)

이틀에 걸쳐 PR #236 ~ #243 (8 PR 모두 머지). 두 축:
1. **결제 → 상세 화면 라우트 통일** (사용자 보고로 발견된 SKU별 분기 불일치)
2. **Phase 7 신뢰 장치 4축** (샘플 디스클로저 / 후기 인프라 / 상담사 AI-사람 구분 / 보관함 환불 안내) — 가짜 후기·상담실적·평점 0건 원칙 100% 준수

### 0.1 진행된 것 (완료 — main 머지) ✅

#### 결제 라우트 통일 — 2 PR

| PR | 제목 | 요약 |
|---|---|---|
| #236 | monthly-calendar(1,900원) 단독 구매자 Branch D | premium/page.tsx 분기에 `monthlyAccessLabel` 추가 + `hasAnyMonthlyCalendarForReading(userId, readingKey)` 헬퍼 (product_entitlements + legacy credit_transactions 양쪽 prefix 매칭). Branch 우선순위: lifetime → A → yearly → B → **monthly → D (NEW)** → 없음 → C. Branch D 구성: hero ✓월간달력 배지 + 월별 흐름 챕터(FortuneCalendarPanel) + 1·2장 잠금 미리보기 + 49,000원 풀팩 업셀 + 3,900원 year-core 대안 |
| #240 | today-detail 두 라우트 UI/풀이 통일 | 사용자 보고 — `/saju/[slug]/today-detail` (PR #206 inline 777줄, single topic) vs `/today-fortune/detail` (5 topic + 6+ 카드) 풀이·디자인 차이. **777줄 → 30줄** 로 wrapper 화, TodayFortuneDetailClient 재사용. backHref prop 추가로 사주 컨텍스트 (`/saju/{slug}`) 유지. resolveReading(slug) 으로 잘못된 link 사전 차단 |

#### Phase 7 신뢰 장치 구축 — 4 PR + 2 후속

| PR | 제목 | 요약 |
|---|---|---|
| #237 | Phase 7a /sample-report '리포트 제작 안내' 디스클로저 | 결제 CTA 직전에 4 카드 (생성 약 1~2분 / 14 섹션·A4 5~7페이지 / AI 모델 작성 / 사람 검수 없음) + /refund-policy /support/faq link. 디자인 토큰 (PANEL_STYLE / SOFT_FEATURE_STYLE) 재사용 |
| #238 | Phase 7b 후기 인프라 풀스택 (DB + API + 작성 UX + 표시 UI + admin moderation) | migration 033_reviews (table + RLS 4 policy + 3 인덱스 + updated_at trigger + UNIQUE user·product·scope). lib: types/queries/hash(SHA-256 12자)/verification(productId+scopeKey → entitlement 검증). API 5: POST·GET /api/reviews, /mine, /[id] PATCH·DELETE, /admin/reviews, /admin/reviews/moderate. UX: ReviewWriteDialog (별점·본문·표시명·검증) + saved-readings-list 통합 (구매 항목 카드 '✎ 후기 작성/심사 중/공개됨' 동적). 표시: ReviewList(server, productId='lifetime-report', 0건 empty state). Admin: /admin/reviews moderation queue + 공개·비공개 + 비공개 사유 |
| #239 | env: REVIEW_USER_HASH_SALT placeholder + 32-byte hex 생성 안내 | `.env.example` 문서화. 미설정 시 `ganji-saju-review-hash-v1` default |
| #241 | reviews policies repair migration 034 | 033 production push 시 `CREATE POLICY` IF NOT EXISTS 미지원으로 첫 select policy 충돌 → insert/update/delete 3 policy 누락. 034 가 `DROP POLICY IF EXISTS` + `CREATE POLICY` 4개 idempotent 재생성. `supabase migration repair --status applied 033 --linked` + `supabase db push --linked` 로 production 정상화 |
| #242 | Phase 7c 상담사 AI/사람 구분 + 환불·예약 정책 link | SpecialistMentorMode = 'ai-report' \| 'human-planned' 타입 + 4 mentor 모두 mode='ai-report'. 가문 선생 statusLabel '준비 중' → '출시 예정' (Phase 5f 톤). 각 카드 eyebrow 에 ModeBadge (AI 풀이 분홍 / 사람 상담·출시 예정 회색). footer 상담 안내 박스: AI 풀이 설명 + 사람 상담사 예약 출시 예정 + `/refund-policy` + `/appointment-policy` link |
| #243 | Phase 7d /my/results '보관함 안내' footer | 3 항목 (환불 가능 여부 / 환불 요청 / 개인정보·계정 삭제) + 4 link pill (`/refund-policy` / `/support/contact` / `/my/settings/delete-account` / `/support/faq`). 환불 자동 판정 X — 정책 페이지 link 만 (가짜 정보 차단) |

### 0.2 운영 적용

- **supabase migration 033 + 034 production 적용 완료** (linked project bgtzkjxihlbmxehmhtwg). `supabase migration list` 양쪽 Remote 컬럼 채워짐.
- **REVIEW_USER_HASH_SALT** (32-byte hex) Vercel `production` + `development` 등록 완료 + 로컬 `.env.local`. preview 는 CLI v52 비대화식 한계로 수동 대시그 (default salt fallback OK).
- Release 라벨 (사용자 자체 기록용): `2026-05-18 monthly-calendar 단독 구매 상세 화면` / `2026-05-18 샘플 페이지 정직 디스클로저` / `2026-05-18 구매 인증 후기 인프라` / `2026-05-19 today-detail 라우트 통일` / `2026-05-19 reviews policies 복구 migration` / `2026-05-19 상담사 AI/사람 구분` / `2026-05-19 보관함 환불·삭제 안내 footer`

### 0.3 다음 세션 큐

- **love-question 2 라우트 데이터 차이 통일** — `/compatibility/input?paid=love-question` vs `/compatibility/result?source=manual&paid=love-question`. Phase 2C agent 조사 시점에서 "데이터 다름" 보고됨. 별도 PR.
- (선택) lifetime/yearly 페이지에도 ReviewList 추가 (구매자에게 본인·타인 후기 노출)
- (선택) 평균 별점 표시 (실제 후기 쌓인 후)
- (선택) 후기 신고 기능

### 0.4 알려진 위험 / 정리 후속

- Vercel `preview` 환경에 `REVIEW_USER_HASH_SALT` 미설정 — preview 결제 후 작성된 후기의 userIdHash 가 production 과 다름 (preview 는 보안 영향 미미하나 일관성 위해 대시그 권장).
- Phase 7b 의 review-write-dialog 가 무한 textarea — 한글 모바일 IME 입력 시 onChange race condition 가능성 (미확인). 후속 사용자 테스트 필요.

---

## 0a. 2026-05-17~18 세션 종합 — 상용화 하드닝 Phase 1~5

이틀에 걸쳐 PR #218 ~ #234 (14 머지 + 1 OPEN). 사용자 directive "유료 상용화 가능 수준 하드닝" 으로 audit → 도메인 → KST → 정책 → 사업자 정보 → 결제 동의 → 미완성 UI 순차 진행.

### 0.1 진행된 것 (완료 — main 머지) ✅

#### Audit & Plan (Phase 0 / 1)

| PR | 제목 | 요약 |
|---|---|---|
| #218 | audit-lifetime-report — 49,000원 회귀 + 환불 정책 | scripts/audit-lifetime-report.mjs (manual 정기 회귀 도구) |
| #219 | audit-business-activity 분기 재실행 1회차 | 우선순위 등급 변동 0건 — 분기 모니터링 정착 |
| #220 | production-hardening Phase 1 audit + master plan (코드 변경 0건) | docs/audit/* 9개 (production-hardening-audit / route-status-map / incomplete-ui-inventory / legal-required-fields / policy-versioning / product-catalog / production-readiness-checklist / seo-content-plan / master plan) |

#### 도메인 / Canonical (Phase 1, 5 PR — hotfix 포함)

| PR | 제목 | 요약 |
|---|---|---|
| #221 | 도메인 canonical = ganjisaju.kr (영문 ASCII) + 브랜드 간지사주 | SITE_CONFIG + LEGACY 반전 + 38 파일 구 브랜드명 → 간지사주 + sitemap canonical + robots noindex 보강 + site.test.ts 16 시나리오 |
| #222 | KST 유틸 통합 + UTC drift P0 fix + /api/health/daily | src/shared/utils/kst.ts 6 함수 (getKstNow/Parts/DateKey/StartOfDay/formatKoreanDate/getDailyVersion) + 21 시나리오 + zodiac/[slug] periodSeed + buildTodayFortune raw new Date() fix |
| #223 | getTodayPillarSnapshot stored calculatedAt → 실제 오늘 | systematic-debugging Phase 1-4 — saju 페이지 (stored sajuData) vs today-fortune (fresh sajuData) calculatedAt 차이로 점수 95/71 deterministic mismatch root cause fix |
| #224 | hotfix canonical = www.ganjisaju.kr swap | ERR_TOO_MANY_REDIRECTS 긴급 (Vercel primary = www 와 코드 apex 충돌) — admin override |
| #225 | proxy single source of truth + punycode 정규화 보강 | proxy.ts hardcoded 조건 → src/lib/site.ts shouldRedirectHost 사용. 간지사주.kr (xn--) 도 canonical 정규화 |
| #226 | canonical = ganjisaju.kr (apex) 복귀 — Vercel 정상화 후 directive 원안 | 운영자 Vercel 대시보드 변경 (ganjisaju.kr primary + alias 308) 후 SITE_CONFIG.canonicalHost swap back. **308 vs 307** 답변: 도메인 정규화는 영구라 308 (Permanent + body 보존) 가 표준 |

#### Phase 3 (전자상거래 고지) — 3 PR

| PR | 제목 | 요약 |
|---|---|---|
| #227 | Phase 3-A 사업자 정보 env config + production 빌드 가드 + 푸터 개선 | src/lib/business-info.ts (BUSINESS_INFO 11 필드 + assertProductionBusinessEnv) + .env.example 11 키 + 푸터/help BusinessInfoCard env 기반 + 가드 조건 VERCEL_ENV='production' 한정 + 12 env 실제값 운영자 입력 후 production 검증 통과 (회사명/대표자/사업자번호/통신판매번호/주소/CS 전화·이메일·운영시간/CPO 이름·이메일·전화/공시 URL) |
| #228 | Phase 3-B 정책 페이지 9개 + DB 버저닝 + admin UI | migration 031 (policy_versions + user_policy_consents + RLS + ip_hash 익명화) + src/shared/policies/types.ts + src/lib/policies.ts (server fetch/create/recordConsent + computeContentHash) + policies.test.ts 12 시나리오 + 3 골격 컴포넌트 (PolicyContent markdown lite / PolicyNotReady / PolicyPageShell) + 7 신설 정책 페이지 (/refund-policy /digital-content-policy /subscription-policy /coin-policy /appointment-policy /ai-disclaimer /commerce-disclosure) + /admin/policies UI + admin CRUD API |
| #229 | Phase 3-C-1 결제 동의 체크박스 + recordUserConsent (membership 연결) | src/shared/payments/consent-rules.ts (client-safe) + src/lib/payments/consent.ts (recordConsentsForPayment server) + 10 단위 테스트 + PaymentConsentCheckboxes (master + 항목별 + 정책 link + valid callback) + /api/payments/prepare 가드 (acceptedKinds 검증 + funnel_log consent_missing) + toss-membership-checkout 연결 |
| #230 | /legal hub 탭 UI + /terms /privacy 새 패턴 + 푸터 #000 강제 | /legal?tab={kind} 가로 chip 탭 + 푸터 정책 nav 단축 (9 줄줄이 → '정책 모아보기' 한 줄) + 푸터 inline `background-color: #000000` + globals.css `!important` override + /terms /privacy hardcoded JSX → PolicyPage 패턴 + migration 032 seed (기존 본문 markdown import + pgcrypto SHA-256 자동 계산 + on conflict do nothing) |

#### Phase 5 (미완성 UI / 로딩 / 빈 상태) — 4 PR

| PR | 제목 | 요약 |
|---|---|---|
| #231 | Phase 5-A+B 상태 컴포넌트 6 표준화 + 미완성 문구 제거 | src/components/state/* 6 컴포넌트 (LoadingState / EmptyState / ErrorState / RetryButton / SkeletonCard / FeatureUnavailable) + 10 위치 미완성 문구 제거 (membership 3 카드 comingSoon filter / lock-screen FeatureUnavailable / search LoadingState / help "✦ 준비 중" 배지 제거 / 3 loading.tsx "준비 중" → "불러오는 중" / 홈 그리드 filter / 알림 "준비 중" → "출시 예정" / legal aria-label) |
| #232 | Phase 5-C 로그인 / reset-password skeleton + 로그인 고객센터 링크 | LoginPageFallback (로고/안내/카카오/Google 위치 skeleton + disabled button + sr-only) + reset-password skeleton + 로그인 안내에 /help 고객센터 링크 추가 |
| #233 | Phase 5-D 코인 센터 잔액 skeleton + 재시도 + 정책/CS 링크 | creditsFetchError state + creditsFetchVersion retry + 잔액 영역 skeleton (animate-pulse) + inline retry button (다크 배경 ErrorState 시각 충돌 회피) + audit-mockup intentional 마커 ✦ — + /coin-policy /refund-policy /help + 사업자 이메일 link |

### 0.2 진행 중 — main 머지 대기 (1 PR)

| PR | 제목 | 상태 |
|---|---|---|
| #234 | Phase 5-E 택일 결과없음 EmptyState + 4 CTA | OPEN — CI 전단 pass, 사용자 머지 신호 대기 |

PR #234 변경:
- /taekil 의 "결과가 없습니다" 단순 문구 → 표준 EmptyState
- title: "현재 조건에 맞는 좋은 날을 찾지 못했습니다"
- 4 CTA: 다른 목적으로 다시 찾기 / 생년월일 확인 / 추천 날짜 생성 / 유료 상세 풀이

### 0.3 진행했으면 하는 것 (master plan / sub-PR 큐)

**Phase 5 잔여**:
- **5-F**: Playwright 금지 문구 회귀 차단 테스트 — "준비 중" / "TODO" / "로딩중..." 등 공개 페이지 노출 시 fail. Phase 5 의 완결 (자동 회귀 차단).

**Phase 6 (안전 고지 + AI 한계 + 위기 대응)**:
- **6-A**: 공통 면책 고지 (푸터 / AI 상담 / 결제 전) + AI 사용 고지 (입력값 사용 / 결과 한계 / 저장 보관 / 삭제 요청 방법)
- **6-B+C**: AI 위험 키워드 감지 (자해·자살 / 타해 / 응급의료 / 법률 / 투자 / 도박 / 미성년자 고위험 / 개인정보 과다 입력) + 위기상황 응답 템플릿 (112/119/지역 정신건강위기상담전화 안내)

**Phase 3-C-2** (Phase 3 완결):
- 회원가입 TermsConsentModal 실연결 + DB insert (consent_method='signup_explicit')

**Phase 3-C-1-B** (Phase 3-C-1 의 후속):
- credits / saju lifetime-report / today-detail 등 다른 결제 페이지에 PaymentConsentCheckboxes + prepare 호출 추가 (Phase 3-C-1 은 membership 만)

**Phase 4 (가격 / 코인 / 구독 / 예약상담 UX)** — 대규모, 3 sub-PR:
- **4-A**: 상품 카탈로그 중앙화 (Product type one_time_digital / subscription / coin_pack / appointment / report)
- **4-B**: 코인 원화 환산 UI + "무제한" 문구 → 월 N회 (MEMBERSHIP_LIMITS config)
- **4-C**: 결제 전 요약 카드 + 결제 실패/취소/완료/webhook 미수신/콘텐츠 생성 실패 상태 분리

**Phase 6+** (이후 audit 추가 사항):
- **Phase 7** 상담 예약 취소/노쇼 정책 + UI/API (PATCH /api/appointments)
- **Phase 8** 코인 유효기간 정책-구현 정합 (FAQ "1년" vs DB 영구 — 운영자 결정 필요)
- **Phase 9** CI 보강: vitest *.spec.ts (payment-duplicate-audit 포함) + audit:payment-idempotency:strict + audit:ai-chat-idempotency:strict + eslint
- **Phase 10** SEO 확장: 32 slug 페이지 openGraph/twitter + sitemap dateKey 동적화 + 꿈해몽 사전 100건 + 별자리 144 compat

### 0.4 운영자 입력 / 확인 대기 항목

- **/admin/policies**: 9 정책 중 terms/privacy 외 7 정책 (refund / digital-content / subscription / coin / appointment / ai-disclaimer / commerce-disclosure) 본문 admin 입력 필요. 입력 전엔 PolicyNotReady ("고객센터로 문의") + noindex 자동
- **Vercel 대시보드**: production 도메인 alias 정합 (현재 정상 — 정기 점검 권장)
- **policy_versions seed migration (032)**: pgcrypto extension 활성 확인 (Supabase production 의존)
- **legal 본문 검토**: 사용자가 admin UI 통해 직접 입력한 terms/privacy 본문은 법무 검토 필요

### 0.5 알려진 위험 / 정리 후속

- 기존 4 KST 유틸 (getKoreaAccessDay / getKoreaDateKey / getSeoulDateKey / toKstDateKey) 점진 마이그레이션 필요 (PR #222 에서 single utility 도입했으나 caller 미통일)
- gangi-ui.tsx GANGI_TEACHERS 의 "준비 중" 가격 잔존 (홈 / pricing filter 됨, 다른 위치 nav 검토)
- PR #229 의 결제 동의: membership 만 연결 — 다른 결제 페이지는 acceptedKinds 미전달 (backward compat) → Phase 3-C-1-B 에서 전체 연결
- PR #218 / #219 의 audit script 들 manual 실행 — Phase 9 에서 CI strict 통합 권장 (audit:payment-idempotency / audit:ai-chat-idempotency / audit:lucky-hybrid)

---

## 0b. 2026-05-16 세션 종합 (9 PR + 자동 검증 시스템 도입)

이날 하루에 PR #176-#184 (총 9 PR) 머지 + 회귀 자동 검출 시스템 1세대 구축.

### 0.1 작업 흐름 요약 (시간 순)

| Phase | PR 범위 | 핵심 변경 | 사용자 보고 / 발견 |
|---|---|---|---|
| 1. UI 회귀 + 결제 차단 | #176/#177/#178 | UI 7건 + 결제 진입점 9곳 차단 + entitlement API/hook | 사용자 보고 (토스 "no healthy upstream") |
| 2. 점수 통일 | #179/#180/#181 | iljinScore.totalScore single source + helper 추출 + 6 영역 카드 통일 | 사용자 보고 (사주 페이지 69 vs 운세 페이지 45 → 24점 차이) |
| 3. OPEN PR 일괄 머지 | #168-#175 (8개) | 미머지 누적 PR (settings, font, onboarding, my routes, mobile sheet, admin funnel 등) batch 머지 | 사용자 보고 (로그아웃 부재 / 메뉴 탭 변경 미적용) |
| 4. dead anchor fix | #182 | premium hero 카드 3 버튼 미존재 anchor (#yearly-chapter-1/2/3) → 실제 anchor 매핑 | 사용자 보고 (메인 카드 버튼 무반응) |
| 5. 자동 회귀 검증 시스템 | #183/#184 | audit-dead-anchors + score invariant test + Playwright smoke E2E | 사용자 메타 피드백 ("끝없이 지적하지 않게 해줘") |

### 0.2 핵심 결정 사항

1. **iljinScore.totalScore single source of truth** (PR #179-#181): 사주 페이지의 모든 영역별 점수가 오늘 운세 페이지와 1:1 일치. helper (`unifyScoresWithIljinScore` / `computeSajuAreaScores`) + 공유 컴포넌트 (`SajuAreaCardsSection`) 패턴으로 통일.

2. **6 영역 카드 통일** (PR #181): 사주 메인/상세/오늘 운세 페이지 모두 동일 6 카드 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운). 라벨/색상/순서/score 모두 single source.

3. **자동 회귀 검증 시스템 도입 (사용자 메타 피드백 대응)** (PR #183/#184):
   - **audit-dead-anchors.mjs**: `href="#xxx"` 미존재 anchor 자동 검출 (PR #182 류 회귀 차단)
   - **score invariant test**: 사주 페이지 ↔ 운세 페이지 6 영역 score 1:1 일치 strict assertion (PR #179-#181 가정 매 PR 자동 검증)
   - **Playwright smoke E2E**: 페이지 진입 깨짐 / console error / dead internal link 자동 차단
   - 자동화 즉시 효과: PR #183 도입 시점에 사용자가 보고 안 한 dailyDelta 누락 회귀 검출 + fix

4. **conflict resolution** (PR #169 ↔ #179, build-today-fortune.ts): PR #179 helper 추출이 PR #169 의 부분 boundary fix를 더 완전한 방식으로 포함 → PR #179 채택. PR #169가 도입한 invariant test 는 PR #179 helper가 자동 보장.

5. **admin override 머지 유지**: CI npm ci 만성 실패 (typescript@4.9.5 peer-dep 충돌) — A5 작업으로 fix 예정. 그동안 PR #176-#184 모두 admin override squash merge.

### 0.3 산출물 (모두 production 배포 완료)

- 신규 helper 5개: `unify-saju-scores.ts`, `compute-saju-area-scores.ts`, `computeSajuIljinScore` wrapper, `SajuAreaCardsSection`, `payment-duplicate-audit.spec.ts`
- 신규 API 1개: `GET /api/payments/entitlement` + `useProductEntitlement` hook
- 신규 script 2개: `scripts/audit-user-entitlements.mjs`, `scripts/audit-dead-anchors.mjs`
- 신규 E2E 1개: `e2e/smoke.spec.ts` (Playwright chromium)
- 신규 doc 1개: `docs/payment-duplicate-block-verification.md`
- 새 invariant test 2건 (PR #169 boundary + PR #183 score 일치)

### 0.4 사용자 검증 일치 항목

- ✅ 결제 중복 차단 9곳 (멤버십/lifetime/today-detail/monthly-calendar)
- ✅ 사주 페이지 ↔ 오늘 운세 페이지 점수 1:1 일치 (3 페이지 모두)
- ✅ 6 영역 카드 통일 (사주 메인/상세/운세 동일 항목)
- ✅ premium hero 카드 3 버튼 작동 (anchor scroll + lifetime 업셀)
- ✅ 로그아웃 버튼 노출 (메가 메뉴 우상단 + /my/settings)
- ✅ 모바일 시트 4탭 균등 너비

### 0.5 다음 세션 우선순위 (✅ 모두 완료 — 2026-05-16 PR #185-#187)

1. ✅ **Tier 0-1 (Phase 2B)**: 사주 페이지 인증 E2E — Supabase test user (hybrid storage state) → PR #186 + #187 fix
2. ✅ **Tier A5**: CI `npm ci --legacy-peer-deps` fix → PR #185. admin override 의존 종료, PR #186-#187 모두 정상 CI 통과 머지
3. ✅ **Tier 0-2/0-3**: Playwright CI workflow + audit:dead-anchors strict gate (ci.yml step) → PR #185

### 0.6 2026-05-16 Tier 0 완료 후 — Phase 2C / A7 / A4 까지 (자동 회귀 검증 6 도구)

- **자동 회귀 검증 시스템 3 세대 가동** (CI 매 PR push 자동 실행):
  ```
  ├─ npm test                              (355 unit + score invariant + lucky-hybrid matrix)
  ├─ audit:dead-anchors:strict             (PR #182 류 dead anchor 정적 검출)
  ├─ audit:lucky-hybrid:strict             (PR #167 hybrid 120 조합 invariant — PR #190)
  ├─ chromium project (Phase 2A)           (5 public page smoke + console error + dead link)
  ├─ chromium-auth project (Phase 2B)
  │  ├─ auth.setup.ts                       (test 계정 로그인 + storage state)
  │  └─ saju #1-#4                          (6 카드 / hero anchor / 결제 진입점 / 점수 일치)
  └─ chromium-payment-blocks (Phase 2C)
     ├─ auth-setup                          (재사용)
     ├─ active subscription seed/cleanup    (subscription "이용 중" 차단)
     │  ├─ /membership "이용 중" 배지
     │  ├─ /pricing "✓ 이용 중 · 결제 내역" CTA
     │  └─ /membership/checkout "이미 이용 중인 멤버십입니다"
     └─ lifetime entitlement seed/cleanup
        └─ /saju/[slug]/deep "✓ 구매한 풀이 보기" CTA
  ```
- **활성화 자산**:
  - dev project `bgtzkjxihlbmxehmhtwg` 의 전용 test 계정 `e2e-test@ganjisaju.kr` + reading `b104b797-5da7-4bec-a0e1-eaa4ff8af710`
  - GitHub Secrets: `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `E2E_TEST_USER_EMAIL` / `_PASSWORD` / `E2E_TEST_READING_SLUG` / `SUPABASE_SERVICE_ROLE_KEY`
  - `.env.local`: 동일 env (로컬 검증용)
  - Playwright CI: Node 22 (Supabase admin client WebSocket 의존성 — PR #188)
- **A7 production 동작 (실시간 entitlement 반영)**:
  - 단일 CTA (deep / main): client wrapper + `useProductEntitlement` (focus 시 자동 재요청)
  - 복합 conditional (premium / print): `EntitlementRefresher` 컴포넌트 (focus 시 `router.refresh()` → server component 재실행)
  - 다른 탭 결제 후 본 탭 자동 갱신 — 사용자 reload 불필요

---

## 1. 작업 흐름 (PR 단위)

### 1.1 별자리 시스템 구축 (PR #127–#135)

| PR | 내용 |
|---|---|
| #127 | 12 별자리 상세 페이지 — 콘텐츠 라이브러리 (`sign-content.ts`) + 일별 Mulberry32 PRNG (`daily-fortune.ts`) + 12×12 호환 매트릭스 |
| #128 | `/star-sign` 메인 — TOP 3 / 살짝 주의 / 12 sign 점수 grid / 원소·모달리티 분류 |
| #129 | `/star-sign/[slug]/cross` — 서양 element × 동양 일간 합성 (상생/상극 5 관계) |
| #130 | `/star-sign/compat/[a]/[b]` — 두 별자리 6 영역 궁합 + 데이트/갈등 팁 |
| #131 | `MyStarSignCard` — `profile.birthMonth/Day` 자동 매칭, `/my` 노출 |
| #132 | 홈 (`GangiHomeClient`) 에 `MyStarSignCard` server-render slot 전달 |
| #133 | 오늘 별자리 일진 다이제스트 — `/notifications` 헤더 카드 + TOP 3 + 주의 1 |
| #134 | `/star-sign/compat` — 12×12 = 144 칸 매트릭스 미리보기 |
| #135 | `today-star-sign` push 슬롯 — 사용자 생년월일 → 별자리 자동 매칭 |

### 1.2 Push / A/B / 운영 (PR #136–#142)

| PR | 내용 |
|---|---|
| #136 | 별자리 push A/B 본문 variant (A 점수 / B 부스터 / C 럭키), FNV-1a 해시 결정적 선택 |
| #137 | 클릭률 추적 — URL `?notif=<logId>` + Portal 자동 ack + `/api/admin/push-ctr` |
| #138 | 별자리 즐겨찾기 — `star_sign_favorites` 테이블, FavoriteButton, MY strip |
| #139 | `/star-sign/[slug]/cross` 의 `cachedCalculateSaju` LRU+TTL 캐시 |
| #140 | 신살 active weight 자동 production 적용 — stale-while-revalidate cache |
| #141 | `/admin/*` 화이트리스트 가드 — `admin_users` 테이블 + env `ADMIN_USER_IDS` |
| #142 | VAPID 발급/배포 가이드 + `/api/admin/web-push-status` 진단 |

### 1.3 리텐션 / 자동화 (PR #143–#146)

| PR | 내용 |
|---|---|
| #143 | 멤버십 만료 임박 push — D-7 / D-3 / D-day 단계별 본문, KST 10:00 cron |
| #144 | 컴백 push — `lastSeenAt + inactivityReminderDays` 기반, KST 19:00 |
| #145 | A/B winner 자동 선택 — ε-greedy 90% exploit + 10% explore |
| #146 | `/admin/push-ctr` UI — variant CTR 시각화 + winner 정책 |

### 1.4 사용자 상황 입력 UX (PR #147–#149)

| PR | Part | 내용 |
|---|---|---|
| #147 | A | 입력 hero + "정확도 ↑" 뱃지 + live preview chip strip |
| #148 | B | 사주 결과 페이지 "상황 반영" chip + amber CTA |
| #149 | C | 오늘 운세 영역 점수 재정렬 + perspective 한 줄 + compact chip |

### 1.5 상황 호명 후속 (PR #150–#153)

| PR | 내용 |
|---|---|
| #150 | 사주 narrative `buildHonorificPrefix` + `buildSituationActionLine` — "직장인이신 김영민님, …" |
| #151 | `/my/situation` 분리 페이지 + `profiles.user_situation` 컬럼 + 자동 fallback |
| #152 | `/compatibility` 에 `SituationReflectionCard` compact |
| #153 | 신살 모델 R² < 0.05 promote 차단 + `?force=1` 우회 |

### 1.6 로딩 모션 통일 (PR #154 / #157 / #164)

| PR | 내용 |
|---|---|
| #154 | `<ZodiacWheelLoading>` — 회전 12지지 한자 + 별 입자 + cosmic gradient. saju-intake 적용 |
| #157 | `GangiLoadingOverlay` 자체를 `ZodiacWheelLoading` 으로 통합 → 모든 호출자 (5곳) 자동 12간지 로딩 |
| #164 | `/today-fortune/detail` unlock 흐름에 `MIN_LOADING_MS=600` 가드 |

### 1.7 네비게이션 메가 메뉴 / 모바일 시트 (PR #155 / #156 / #158 / #159)

| PR | 내용 |
|---|---|
| #155 | PC 메가 메뉴 — 운세 / 사주 / 대화 / 멤버십 4 group + 풀폭 3컬럼 패널, lg+ 표시 |
| #156 | 모바일 시트 — 같은 `MEGA_NAV` 데이터 + bottom sheet (PR #158 에서 top sheet 로 변경) |
| #158 | PC 호버 닫힘 fix (SiteHeader `lg:hidden`) + 모바일 시트 Portal + **bottom → top sheet** |
| #159 | PC SiteHeader 강제 숨김 — Tailwind specificity 보강 (CSS `!important`) |

### 1.8 호명·점수 정합성 (PR #160 / #161 / #163 / #165 / #166 / #167 / #162)

| PR | 내용 |
|---|---|
| #160 | 대화 메가 메뉴 선생 → `DALBIT_TEACHERS` 매핑 (명리호 / 타로토 / 사주용 / 궁합양) |
| #161 | 12간지 선생 12명 모두 `status='active'` 복원 + 메가 c1 전체 노출 |
| #162 | 오늘 운세 "무료 결과 보기" 전환 매끄럽게 — overlay + `setFreeResult` 제거 + min-loading |
| #163 | 구 브랜드 임의 호명 9 파일 일괄 정리 |
| #165 | **점수 전수 통일** — `iljinScore.totalScore` single source, 영역별 평균 normalize |
| #166 | 사용자 이름 자동 주입 (`profile.display_name`) + storage prefix v2 |
| #167 | 행운 패키지 일진 hybrid — 일진 element 가 lucky/unlucky 와 다르면 9 항목 합집합 |

### 1.9 UI 회귀 정리 (PR #176)

7건 사용자 보고 회귀 일괄 fix. 모두 `/today-fortune/*` 흐름.

| Issue | 핵심 |
|---|---|
| 1 | 점수 통일 회귀 — `clampScore (48~92 floor)` 가 `iljinScore.totalScore (5~95)` 를 강제로 끌어올려 "총운 banner = 산출내역 합계" 가 깨짐. unification 전용 `clampUnified(5~95)` 추가. |
| 2 | `TodayFortuneScoreGrid` (2컬럼 grid) 와 `TodayCategoryReadings` (stacked) 가 같은 영역 점수를 중복 노출 → grid 제거. |
| 3 | 사주 명식 카드의 오행 분포가 5행 vertical → 1행 5열 compact grid. 부족/과다는 셀 배경+외곽선으로 표시. |
| 4 | 1코인 unlock 후 page 최상단으로 점프 → `premiumRef` + 220ms `scrollIntoView({behavior:'smooth'})` 로 프리미엄 패널 위치 자동 스크롤. |
| 5 | "💭 깊이 들어갈 만한 질문" Q1/Q2/Q3 가 정적 `<li>` → 클릭 핸들러 없음. `TodayPremiumQuestionChips` client 컴포넌트 신설, `/dialogue?question=...` prefill (autoStart 제거 — 사용자가 전송). |
| 6 | `ELEMENT_INFO.name` 어색한 단어 페어 교체: 성장기운→**시작과 추진** / 화기운→**열정과 드러냄** / 안정기운→**안정과 중심** / 정리기운→**결단과 마무리** / 생각기운→**지혜와 유연**. `trimEasySentence` 의 "흐름→분위기", "기준→생각할 점" 치환 제거. |
| 7 | 모든 nav 클릭 시 푸터로 점프 후 페이지 전환 → `site-header` 6 곳 `scroll={false}` 제거 (긴 페이지 → 짧은 페이지 이동 시 footer 근처 착륙 회귀). 결과 페이지 unlock 의 `window.location.href` → `router.push` soft navigation. |

### 1.23 행운 패키지 hybrid 매트릭스 audit + 전수 invariant test (PR #190)

**배경**: PR #167 의 `deriveHybridElements` 분기 4종 (no-iljin / ignored-iljin(기신) / emphasized(같은 오행) / union(합집합)) 가 5 lucky × 4 unlucky × 6 stem = **120 조합** 모두에서 의도대로 동작하는지 운영 + CI 자동 검증.

**신규 자산**:

1. `scripts/audit-lucky-hybrid.mjs` — standalone Node 22+ CLI audit
   - 전수 모드 (기본): 120 케이스 매트릭스 + invariant 위배 보고
   - 단일 모드: `--lucky 화 --unlucky 금` → 5 stem 시뮬레이션
   - `--strict`: 위배 시 exit 1 (CI 통합 가능)
   - 룰만 재현 (src/ import 없음). lucky-package.ts 변경 시 본 스크립트 + test 동기 필요

2. `lucky-package.test.ts` 전수 매트릭스 invariant — 매 `npm test` 자동 실행
   - 실 `buildTodayLuckyPackage` 함수로 120 조합 호출
   - 분기별 cardinality (단일=2, 합집합=4) 검증

3. `package.json` 신규: `audit:lucky-hybrid` / `audit:lucky-hybrid:strict`

**운영 가치**: 사용자 보고 ("오늘 행운 색이 어제와 같은데 일진은 달라요") 시 audit 으로 즉시 (lucky, unlucky, stem) 조합 예상 분기 + cardinality 진단. 신규 lookup 추가 시 matrix invariant 가 회귀 자동 검출.

**검증**: npm test 355 ok / 0 fail (matrix +1), audit:strict ✅ 120/120 통과.

### 1.22 A7 useProductEntitlement 일관화 — 4 saju 페이지 실시간 entitlement 반영 (PR #189)

**사용자 동기**: 다른 탭/창에서 결제 완료 후 사주 결과 페이지로 돌아오면 CTA 가 아직 "결제하기" 로 남아있는 회귀 해소.

**Hook 강화** (`useProductEntitlement`):
- `initialEntitlement`: 서버 SSR 결과를 초기값 → 첫 paint 깜빡임 0
- `revalidateOnFocus` / `revalidateOnVisibility` (default true): focus/visible 시 자동 재요청
- `refresh()`: 외부 결제 confirm callback 등에서 명시적 trigger
- 네트워크 실패 시 fail-open

**Hybrid 마이그레이션 패턴** (4 페이지):
| 페이지 | 패턴 | 이유 |
|---|---|---|
| `/saju/[slug]` | `TodayDetailResultCta` 클라이언트 wrapper | 단일 CTA → granular update |
| `/saju/[slug]/deep` | `LifetimeDeepCta` 클라이언트 wrapper | 단일 CTA → granular update |
| `/saju/[slug]/premium` | `EntitlementRefresher` (router.refresh on focus) | hero/sections/CTAs 다수 conditional → 페이지 전체 server re-render |
| `/saju/[slug]/premium/print` | `EntitlementRefresher` (양 분기) | gated ↔ accessible 양방향 전환 |

**신규 컴포넌트**: `src/components/saju/lifetime-deep-cta.tsx` / `today-detail-result-cta.tsx` / `entitlement-refresher.tsx`

**검증**: typecheck 0 / Phase 2A+2B 회귀 0 / Phase 2C 14/14 CI pass.

### 1.21 Phase 2C 결제 차단 활성 entitlement E2E (PR #188)

**배경**: Phase 2A (인증 X smoke) → Phase 2B (인증 O free user 4 시나리오) → **Phase 2C (활성 entitlement 사용자 결제 차단 4 시나리오)** 확장. PR #177 결제 차단 9곳 중 핵심 4곳 매 PR 자동 검출.

**검증 시나리오** (4 시나리오, PR #177 회귀 차단):
1. `/membership` 활성 구독 plan 카드 "이용 중" 배지
2. `/pricing` 활성 구독 plan "✓ 이용 중 · 결제 내역" CTA
3. `/membership/checkout?plan=basic` "이미 이용 중인 멤버십입니다" 안내
4. `/saju/[slug]/deep` lifetime 보유 시 "✓ 구매한 풀이 보기" CTA

**Hybrid entitlement seed/cleanup 패턴**:
- `e2e/fixtures/supabase-admin.ts` — service_role admin client (dev/staging only)
- `e2e/fixtures/entitlement-helpers.ts` — `seedSubscription` / `seedProductEntitlement` (upsert idempotent) + cleanup (`UPDATE status='expired'` safe)
- `test.describe.configure({ mode: 'serial' })` — beforeAll/afterAll race 차단 (parallel worker 환경에서 다른 worker cleanup 이 다른 worker test 의 UI check 전 실행되는 회귀 방지)

**CI Node 22 upgrade (playwright.yml)**: `@supabase/supabase-js@^2.103.1` admin client 가 Node 20 의 native WebSocket 부재로 실패 → Node 22+ 의 native 지원으로 해결. `ci.yml` 은 Vercel runtime 호환 위해 20.x 유지.

**로컬 환경 gotcha 발견** (§3.1d 참조): `.env.development.local` (vercel CLI 자동 생성) 의 빈 값 override 가 `.env.local` 우선순위 보다 높아 `SUPABASE_SERVICE_ROLE_KEY` 가 사라지는 문제.

**검증**: Phase 2A 5 + Phase 2B 5 + Phase 2C 5 = 14/14 pass (CI 2m22s).

### 1.20 Phase 2B selector + flow fix — 4 시나리오 실측 통과 (PR #187)

**배경**: PR #186 직후 활성화 단계 (dev project 의 test 계정 e2e-test@ganjisaju.kr + reading slug `b104b797-5da7-4bec-a0e1-eaa4ff8af710`) 에서 발견한 회귀 3건.

| # | 원인 | Fix |
|---|---|---|
| 1, 4 | `section:has(h2:text("오늘의 분야별 흐름"))` 가 outer wrapper section 까지 매칭 → 페이지 article 15 개 카운트 (vs 6 기대). 추가로 /today-fortune 결과 페이지는 heading "영역별로 자세히 보기" 사용 → 단일 selector 로 양 페이지 처리 불가 | `extractAreaScores` 를 label exact-match 기반으로 재작성 (heading/section 비의존). `article.filter({ has: page.getByText(label, { exact: true }) })` 패턴. 양 페이지 DOM 차이 모두 수용 |
| 4 | /today-fortune 은 입력 form 페이지 (생년월일 + 주제), 6 카드는 `/today-fortune/result` 에서 노출 | "무료 결과 보기" 클릭 → result URL wait → score 추출. logged-in 사용자 MY 프로필 자동 채움 활용 |
| 2 | paid 사용자만 hero card 렌더 → free user 에선 무조건 fail (실 회귀 아님) | hero anchor count === 0 일 때 `test.skip` graceful fallback. paid 시엔 각 `#premium-*` href 가 가리키는 id 존재 strict 검증 |

**CI 1차 실패 — GitHub Secrets 누락**: PR #186 의 `playwright.yml` 이 `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` 를 `secrets.*` 로 참조했지만 repo Secrets 에 미설정 → 빈 env → `hasSupabaseBrowserEnv=false` → 로그인 button disabled → click 영구 대기 → timeout. 활성화 절차 보강 (Secrets 5종 추가) 후 재실행 성공.

**검증**: chromium-auth 5 test 모두 pass (auth-setup 1.9s + saju #1 4.2s + #2 4.1s + #3 4.0s + #4 6.8s = 총 10.2s 로컬, CI 1m44s).

### 1.19 CI hardening — admin override 종료 (PR #185)

**배경**: PR #176-#184 (9 PR 연속) 모두 `npm ci` 의 `typescript@4.9.5` peer-dep 충돌 (`@tosspayments/payment-widget-sdk` 가 typescript 4.x 요구 vs `package.json` typescript ^5) 로 CI fail → admin override squash merge 패턴 만성화.

**Fix 3건 1 PR 통합**:
1. **A5**: `.github/workflows/ci.yml` 의 `npm ci` → `npm ci --legacy-peer-deps`
2. **0-3**: ci.yml step 으로 `npm run audit:dead-anchors:strict` 추가 — PR #182 류 dead anchor PR 머지 전 차단
3. **0-2**: `.github/workflows/playwright.yml` 신규 — Phase 2A smoke E2E 매 PR 자동 실행 (chromium only, ~1.5분). 실패 시 `playwright-report` artifact 14일 보관

**효과**: PR #185 자체가 첫 admin override 없는 정상 squash merge 통과. PR #186/#187 모두 동일하게 정상 통과.

### 1.18 Phase 2B 사주 페이지 인증 E2E 인프라 (PR #186)

**배경**: Phase 2A 가 인증 X 페이지만 검증. 사주 메인/상세 + /membership 등 로그인 페이지의 회귀 (PR #177-#181 류) 는 사용자 보고에 의존.

**Hybrid auth fixture 패턴**:
- `e2e/auth.setup.ts` — credentials 환경변수 있으면 `/login?mode=login` 에서 이메일 로그인 1회 수행 후 `e2e/.auth/test-user.json` 에 storage state 저장. 미설정 시 `setup.skip` 처리
- `e2e/fixtures/test-user.ts` — `E2E_TEST_USER_EMAIL` / `_PASSWORD` / `E2E_TEST_READING_SLUG` helper + `hasTestUser()` / `getTestReadingSlug()`
- `playwright.config.ts` — `chromium` (Phase 2A) + `auth-setup` + `chromium-auth` (Phase 2B, dependencies: auth-setup, storageState 재사용) 3 project 구조
- `.github/workflows/playwright.yml` — `E2E_TEST_USER_*` secrets 통과

**4 회귀 시나리오** (e2e/saju.spec.ts):
1. `/saju/[slug]` 6 영역 카드 (PR #181)
2. `/saju/[slug]/premium` hero anchor (PR #182, paid 시 strict)
3. `/membership` 활성 구독자 "이용 중" 배지 (PR #177/#178)
4. `/saju/[slug]` ↔ `/today-fortune/result` 6 영역 score 1:1 일치 (PR #179-#181)

**CI 안전 설계**: credentials 미설정 시 dependency chain 으로 chromium-auth 의 모든 spec 자동 skip → 회귀 0. Secrets 활성 시점부터 자동 검증 시작.

### 1.17 자동 회귀 검증 시스템 Phase 2A — Playwright smoke E2E (PR #184)

**배경**: PR #183 audit/invariant 다음 단계. 페이지 진입 자체 깨짐 / console error / dead internal link 류 회귀를 매 PR 자동 검출.

**setup**:
- `@playwright/test 1.60.0` devDependency
- `playwright.config.ts` — chromium project + webServer (npm run dev 자동 시작 + reuse)
- `e2e/smoke.spec.ts` — 5 test (홈/pricing/membership/compatibility/input + dead link 검증)
- npm scripts: `e2e` / `e2e:headed` / `e2e:ui` / `e2e:install`

**검증 범위 (인증 X 페이지)**:
- 페이지 status 200-399
- 핵심 HTML 골격 (main/header/nav/h1) 노출
- console error 0 (analytics/manifest 외부 무해 error 제외)
- 홈 internal link 20개 sampling — dead link 검출

**결과**: `npm run e2e` → 5/5 pass (~6s, chromium).

### 1.16 자동 회귀 검증 시스템 Phase 1 + dailyDelta 누락 fix (PR #183)

**배경 — 사용자 메타 피드백 (2026-05-16)**:
> "기본적으로 사람이 사용하면서 느끼는 불편함을 하나하나 지적해서 수정하다 보니 끝이 없는거 같아. 어느정도는 학습이 되어서 편하게 이용할 수있도록 해줬으면 좋겠어."

→ 사용자 보고 전 회귀를 자동 검출하는 시스템 도입.

**자동화 추가**:

1. `scripts/audit-dead-anchors.mjs` (신규)
   - `src/` 전체 *.tsx/*.ts 에서 `href="#xxx"` 패턴 추출
   - 해당 `id="xxx"` 가 src 어디에도 없으면 dead anchor 보고
   - hex color (#fff7e6) / hash 비교 literal 등 false positive 차단
   - `--strict` 모드: dead anchor 1건이라도 있으면 exit 1 (CI 통합 가능)
   - npm scripts: `audit:dead-anchors` / `audit:dead-anchors:strict`

2. `build-today-fortune.test.ts` 점수 invariant test
   "saju area scores match today-fortune free result scores 1:1 (PR #181 invariant)"
   - 사주 메인/상세 페이지의 `computeSajuAreaScores` 결과 6 영역 score 가
     오늘 운세 페이지의 `buildTodayFortuneFreeResult.scores` 와 1:1 일치 보장
   - 매 `npm test` 자동 검증

**검출된 회귀 fix (자동화 즉시 효과)**:

- `compute-saju-area-scores.ts` dailyDelta 누락 회귀
- 원인: 운세 페이지의 `toTodayScores` 는 5 영역 score 에도 `+dailyDelta` 적용, helper 는 condition 만 적용 → 미세 차이
- 새 invariant test 가 즉시 실패로 보고 → `+dailyDelta` 5 영역에도 적용 fix
- 사용자가 보고 안 한 회귀를 사전 검출 + fix → 자동화 시스템 가치 입증

**검증**: npm test 354/354 pass, audit dead anchor 0, typecheck 0 error.

### 1.15 사주 상세 hero 카드 dead anchor fix (PR #182)

**사용자 보고**: 사주 "상세" 탭 (`/saju/[slug]/premium`) hero 카드 (2026 올해 흐름) 3 버튼 (올해/달력/확장) 클릭 무반응. 하단 yearly-report-panel 의 버튼들은 정상.

**Root cause**: `yearlyAccessLabel` 분기 (Premium 이용권) 의 `readingSteps` href 가 `#yearly-chapter-1/2/3` 였는데 페이지 어디에도 해당 id 정의 없음. lifetime 분기에만 #premium-lifetime/yearly/calendar 정의됨, yearly 분기 누락.

**Fix**:
| 버튼 | Before | After |
|---|---|---|
| 올해 | `#yearly-chapter-1` | `#premium-yearly` (YearlyReportPanel — 이미 존재) |
| 달력 | `#yearly-chapter-2` | `#premium-monthly` (SmallQuestionProducts section 에 id 신규) |
| 확장 | `#yearly-chapter-3` | `/membership/checkout?plan=lifetime&...&from=saju-premium-extend` (lifetime 업셀) |

### 1.14 6 영역 카드 통일 — 모든 페이지 동일 항목 (PR #181)

**배경**: PR #179/#180 으로 점수는 통일됐지만 **항목 자체가 페이지마다 다름** — 사주 메인 4 카드 (총운/연애/재물/직장) / 사주 상세 5 카드 (직장/재물/연애/관계/건강) / 운세 페이지 5 카드 (연애/재물/직장/관계/컨디션). 사용자 요구: "총운 직장운 재물운 연애운 관계운 컨디션" 6 항목 모두 동일하게 노출.

**해결**:
- `src/lib/today-fortune/compute-saju-area-scores.ts` (신규) — 사주 페이지에서 호출. buildSajuReport 5개 + buildConditionScore (운세 builder 와 동일 산식) + unifyScoresWithIljinScore 통합. 6 영역 통일 score 반환.
- `src/components/saju/saju-area-cards-section.tsx` (신규) — 6 카드 grid 공유 컴포넌트. 사주 메인 + 사주 상세에서 import.
- `UNIFIED_AREA_LABELS` 상수: 운세 페이지 긴 라벨 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운).
- `UNIFIED_AREA_COLORS` / `UNIFIED_AREA_ORDER` 상수.
- build-today-fortune.ts: `buildConditionScore` / `buildDailyDelta` export 추가 (helper 재사용).
- 사주 메인 (`/saju/[slug]/page.tsx`) — 기존 4 카드 inline → SajuAreaCardsSection.
- 사주 상세 (`/saju/[slug]/premium/page.tsx`) — 페이지 헤더 직후 SajuAreaCardsSection 추가.
- 운세 페이지 (`today-category-readings.tsx`) — overall 카드 filter 제거 (5 카드 → 6 카드). overall 라벨 '오늘의 운세 총론' → '총운'.

**보장**:
- 3 페이지 모두 동일 6 항목 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운)
- 동일 score (single source — `iljinScore.totalScore` 평균 정규화 6 영역)
- 동일 색상/순서

**검증**: npm test 353/353 pass, typecheck 0 error.

### 1.13 점수 단일화 완성 — yearly-report + credits/use (PR #180)

**배경**: PR #179 후속 회귀 사용자 보고. 사주 6 탭의 "상세" (`/saju/[slug]/premium`) 페이지에서 영역별 카드 점수가 77/76/75/76 (clampScore 48~92) 으로 노출됨. 같은 사용자/같은 날 사주 메인 (45/44/45/46) / 오늘 운세 (46/47/48/47) 와 불일치. PR #179 의 통일이 `build-yearly-report.ts` 와 `/api/credits/use/route.ts` 에는 적용 안 됐던 회귀.

**Root cause**:
- 사주 6탭 "상세" = `/saju/[slug]/premium` (`saju-screen-nav.tsx:11`)
- premium 페이지 → `YearlyReportPanel` → `build-yearly-report.ts:332-336` 가 `buildSajuReport` 5번 호출 후 통일 helper 미적용
- `/api/credits/use/route.ts:165-169` 도 동일 패턴 — 코인 결제 후 detail 풀이 텍스트 "재물운 ${score}점" 노출

**해결**:
- `build-yearly-report.ts`: `getReportMap` 직후 `computeSajuIljinScore(data)` 호출 후 5개 report (today/love/wealth/career/relationship) 의 scores 를 `unifyScoresWithIljinScore` 로 후처리. categories / overview / yearly score 모두 자동 통일.
- `/api/credits/use/route.ts`: 동일 패턴, `unifyReport` inline helper.

**최종 보장 — 모든 사주 화면 single source**:
- `/saju/[slug]` (메인) = `/saju/[slug]/today-detail` = `/saju/[slug]/share` = `/saju/[slug]/premium` ("상세") = `/today-fortune` = 코인 결제 후 detail 풀이 → **overall 1:1 일치**

**검증**: npm test 353/353 pass, typecheck 0 error.

### 1.12 OPEN PR 8개 batch 머지 (PR #168~#175)

**배경**: 2026-05-15 작업한 PR 8개가 머지 안 된 채 OPEN 상태로 누적됐고, 사용자가 production에서 "기존 작업이 반영 안 됨" (로그아웃 버튼 부재, 메뉴 탭 변경 미적용 등) 보고. 8개 모두 admin squash merge (CI npm ci 만성 실패 회피).

| PR | 핵심 변경 |
|---|---|
| #168 | `site-header.tsx` dead-code 정리 (-440줄) — PR #156 false-guarded inline 메뉴 패널 + 미사용 legacy `src/components/site-header.tsx` 제거 |
| #169 | `/my/settings` 통합 (LogoutButton + ReadingComfortControl) + 점수 boundary 회귀 잠금 test (`scores.overall === iljinScore.totalScore` strict assertion) |
| #170 | Noto Sans KR weight 6→4 슬림 — `@font-face` Sans 6×124=744 → 4×124=496 선언 (-33%), 모바일 LCP 폰트 비용 감소 |
| #171 | admin `/admin/operations` 만족도 분포 → stacked horizontal bar 차트 (jade/amber/coral 3색 분절) |
| #172 | 첫 방문자 시작가이드 → 풀스크린 carousel + 12간지 wheel hero (4 슬라이드 immersive) |
| #173 | `/my` 자매 라우트 디자인 통일 + 결과보관함 탭 노출 복구 + 메가 메뉴 우상단 `HeaderLogoutButton` (아이콘 only) |
| #174 | 모바일 시트 4탭 `flex:1 1 0` 균등 + 대화방 헤더 `whitespace-nowrap` + 궁합 결과 button `w-full` + 메가 대화 12 선생 `/dialogue/<zodiac>` 라우팅 통일 |
| #175 | admin **결제 funnel 대시보드** (B1 — migration 030 + funnel-log + `/api/admin/payment-funnel`) + 메가 메뉴 chip font-weight 800 고정 (layout shift 차단) |

**Conflict 해결**:
- PR #169 ↔ #179 (main HEAD) `build-today-fortune.ts` 통일 로직 충돌. PR #179 의 helper 추출이 PR #169 의 부분 fix를 더 완전한 방식으로 포함 → **PR #179 (origin/main) 채택**. PR #169가 도입한 `scores.overall === iljinScore.totalScore` strict test는 PR #179 helper가 자동으로 보장하므로 conflict 후에도 통과.
- 나머지 7개 PR은 conflict 없음.

**검증**:
- npm test: 353/353 pass (회귀 0)
- typecheck: 0 error
- 사용자 보고 회귀 매핑: 로그아웃 부재 → PR #169/#173, 메뉴 탭 변경 → PR #174

### 1.11 사주 페이지 ↔ 운세 페이지 점수 단일화 (PR #179)

**사용자 보고**: 같은 사주 페이지에 총운 69 / 영역별 75-77 노출되는데, 오늘 운세 페이지엔 45 노출. 24점 차이로 "어느 게 맞는 점수냐" 신뢰도 폭격.

**Root cause**:
- 사주 페이지의 `buildSajuReport()` (build-report.ts:969) 가 자체 `clampScore(48~92) + 출생일 mod` 산식으로 점수 계산 — 오늘 일진과 거의 무관, 매일 비슷한 값
- 오늘 운세의 `buildTodayFortune()` 는 `calculateIljinScore()` 8 영역 정밀 산출 (5~95 자연 범위)
- PR #165 의 single source of truth 통일 절차가 오늘 운세 빌더 안에서만 일어났음 → 사주 페이지는 통일 누락

**해결**:
| # | 변경 | 위치 |
|---|---|---|
| 1 | 통일 helper 신규 | `src/lib/today-fortune/unify-saju-scores.ts` — generic `unifyScoresWithIljinScore(rawScores, iljinTotalScore)` (clampUnified 5~95 + 평균 보존 정규화) |
| 2 | helper unit test 10개 | `src/lib/today-fortune/unify-saju-scores.spec.ts` |
| 3 | `computeSajuIljinScore(sajuData)` wrapper | `src/server/today-fortune/build-today-fortune.ts` — getTodayPillarSnapshot + deriveLuckyElements + buildSajuOriginForIljin + calculateIljinScore 4단계 묶음. 의존 함수 3개 export 추가 |
| 4 | 빌더 inline 통일 로직(45줄) → helper 호출(7줄) | `src/server/today-fortune/build-today-fortune.ts:2586-2604` |
| 5 | 사주 페이지 3곳 helper 적용 | `src/app/saju/[slug]/page.tsx:285`, `today-detail/page.tsx:177`, `share/page.tsx:53` |

**보장**:
- 사주 페이지 = 오늘 운세 페이지 overall 1:1 일치
- 영역별 = totalScore + (영역점수 - 영역평균) 정규화 → 평균이 totalScore, 상대 차이 보존
- 시 미입력 사주 → iljinScore 계산 불가 → raw scores fallback (안전)
- PR #176 회귀 패턴 (clampScore 48~92 floor가 통일 점수 끌어올리기) 차단

**검증**:
- npm test: 351/351 pass (회귀 0)
- npm run test:spec (vitest): 64/64 pass (helper 10개 포함)
- typecheck: 0 error

### 1.10 결제 중복 차단 (PR #177 / #178)

**증상**: 토스 계좌이체 마지막에서 "no healthy upstream". 토스 인프라 이슈가 아니라 활성 멤버십 사용자가 동일 plan 재결제 요청 시 client 가 차단하지 않아 발생.

#### PR #177 — 서버 페이지 5곳

| # | 위치 | 변경 |
|---|---|---|
| 1 | `/membership/checkout` | `isSubscriptionPackage` 분기 추가 — 활성 plan 일치 시 결제창 미실행, "이미 이용 중" UI + /my/billing CTA |
| 2 | `/membership` plan 카드 | jade "이용 중" 배지 + 결제 link → /my/billing |
| 3 | `/pricing` plan 카드 | "✓ 이용 중 · 결제 내역" 버튼으로 교체 |
| 4 | `/saju/[slug]/deep` lifetime CTA | 보유 시 "✓ 구매한 풀이 보기" → `/saju/[slug]/premium` |
| 5 | `/saju/[slug]/premium` premium 멤버십 button | 활성 premium 시 "✓ 멤버십 이용 중" |

#### PR #178 — Client 진입점 4곳 + 공유 인프라

**신설 공유**:
- `GET /api/payments/entitlement` — productId/slug/scope/plan 으로 `{hasEntitlement, openHref, reason}` 반환. taste/lifetime/subscription 모두 지원.
- `useProductEntitlement()` hook (`src/lib/payments/use-product-entitlement.ts`) — client mount 시 자동 fetch.

| # | 위치 | 상품 |
|---|---|---|
| 1 | `premium-lock-card.tsx` | today-detail (550원) — 이미 구매한 sourceSessionId 면 "✓ 이미 구매한 풀이" + 즉시 열람 link |
| 2 | `compatibility/result/page.tsx` manual 분기 | love-question (990원) — server-side entitlement 도 확인 (URL `paid` 만 의존하던 회귀 fix) |
| 3 | `fortune-calendar-panel.tsx` | monthly-calendar (1,900원) — 선택된 월 구매 시 "✓ 이미 구매한 N월 캘린더 열기" |
| 4 | `/api/notifications/feed` subscription-expiring | 활성 멤버 사용자에게 href 를 /membership/checkout → /my/billing 으로 동적 분기 |

**누적 결제 중복 차단 적용 현황: 9 곳 + 공유 API 1 개 + hook 1 개**.

#### PR #191 — 결제 실패 catch fallback toast (A8)

entitlement 차단이 잡지 못하는 결제창 실패 경로 (`loadTossPayments` / `requestPayment` reject) 에서 "no healthy upstream" 등 의미 없는 토스 에러 대신 가장 흔한 원인(이미 결제한 상품) 안내.

| # | 위치 | 패턴 |
|---|---|---|
| 1 | `toss-membership-checkout.tsx` catch | `toast.error` + "내 결제 내역" action → `/my/billing` |
| 2 | `credits/page.tsx` catch | 동일 |

- 메시지: `결제에 실패했습니다. 이미 결제하신 상품인지 확인해주세요.` (`docs/payment-duplicate-block-verification.md` §5 초안 준수)
- duration 6초, 실패 사유 무관 노출 (기존 `setErrorMessage` inline 에러 유지)
- 메시지 초안의 markdown link 는 sonner native `action` 버튼으로 치환 — 클릭 영역 명확 + 다른 toast 와 시각 일관성

#### PR #192 — A6 회귀 fix: 코인 결제 detail_report_access kind 누락

사용자 보고 (2026-05-17 16:30/17:00 동일 사주 1코인 중복 결제 시도) 로 발견. PR #178 이 entitlement 조회 시 `today_fortune_premium_access` kind 만 시도했으나, 1코인 결제 경로 (`/api/credits/use` POST → `unlockDetailReport`) 는 `detail_report_access` kind 로 저장 — 두 kind 불일치로 결제 후에도 entitlement 항상 false → 결제 button 계속 노출.

**저장 vs 조회 mismatch**:
| 단계 | 함수 | metadata kind | 키 |
|---|---|---|---|
| 저장 (1코인 결제) | `credits/use POST` → `unlockDetailReport()` | `detail_report_access` | `readingKey` |
| 조회 (entitlement API) | `hasTodayFortunePremiumAccess()` | `today_fortune_premium_access` | `sourceSessionId` / `readingKey` |

(실제로는 `unlockDetailReport` 내부 `hasDetailReportAccess` 가 `reused=true` 반환해 코인 차감 안 됐으나, UI 가 일반 결제 성공 UX 라 사용자가 중복 결제로 오인.)

**fix**:
- 신규 `entitlement/route-helpers.ts`: `resolveTodayDetailCoinUnlock(userId, scope, deps)` — 두 kind 모두 fallback. deps 주입 단위 테스트 가능 (`profile/route.ts` 패턴 동일).
- 신규 `entitlement/route-helpers.test.ts`: 6 시나리오 (PR #178 키 by slug / by readingKey, `detail_report_access` 단독 — 회귀 fix 핵심, neither, missing slug, redundant key skip).
- `entitlement/route.ts`: helper 사용 + `hasDetailReportAccess` import 추가.

같은 reading 의 detail 콘텐츠는 today-fortune / saju-detail 양쪽 동일 (`buildDetailReportContent` 공유) — `detail_report_access` row 가 있는 사용자는 today-detail entitlement 도 가져야 함 (의미적으로 정합).

**배포 즉시 효과**: 이미 결제한 `detail_report_access` row 가 DB 에 존재 → 배포 즉시 PremiumLockCard 가 "이미 구매" UI 로 자동 전환. DB 마이그레이션 불필요.

**남은 follow-up**: A6 Phase 2C E2E (PR #188) 가 1코인 결제 시나리오 미커버 → 회귀 자동 차단 못함. E2E 보강 필요 (Tier 0 후속 후보).

### 1.11 코인 충전 success 페이지 redesign (PR #193)

사용자 보고 (2026-05-17, production `/credits/success` 진입 시 구형 디자인) 로 발견. `BOARD_MANIFEST.md` 의 redesign 항목에 `credits/success` 는 누락 — `pay-result` (16-1 결제 결과 3상태) 가 `membership/success` 만 IMPLEMENTED 였음.

`membership/success` 와 동일 **CenteredCard 패턴** (96px pink circle hero + 22px title + 13px desc, `screens-f.jsx ScreenPaymentResult` mockup 기반) 적용:

| State | Hero | Motion |
|---|---|---|
| loading | pink circle "…" | `MotionSajuLoading` (moonGlyph "貨", labels "결제 승인 / 코인 반영 / 확인 완료") |
| error | white circle "!" + coral 오류 article | — |
| success | pink circle "✓" | `MotionCoinSuccess` ("+ N 코인") |

비즈니스 로직 (`/api/payments/confirm` POST, `trackMoonlightEvent`, `moonlight:credits-updated` event) 무수정 — UI 만 교체.

**CTA 어댑트**: success primary `오늘 운세 보러 가기` → `/today-fortune` (코인 사용 가장 흔한 다음 흐름), secondary `결제 내역 보기` → `/my/billing`.

**남은 follow-up**: `BOARD_MANIFEST.md` 에 `credits-success` 행 추가 (현재 누락 — redesign 추적 정합성).

### 1.12 /credits 잔액 binding 치명적 회귀 (PR #194)

사용자 보고 (2026-05-17, 88코인 보유자가 `/credits` 진입 → 우측 상단 SiteHeader 는 `✦ 88 코인` 정상이지만 페이지 안 ink-dark 카드는 `✦ — / 로그인 후 잔액과 충전 내역이 표시됩니다` 노출). **모든 사용자에게 동일하게 보이는 치명적 회귀**.

**Root cause**: 2026-05-13 redesign 시 mockup placeholder 가 **그대로 hardcoded** 상태로 머묾.
- `credits/page.tsx:170` `✦ —` — 잔액 변수 binding 없음
- `credits/page.tsx:180` `로그인 후 잔액과 충전 내역이 표시됩니다` — 분기 없는 hardcoded 문구
- `isLoggedIn` state 는 page.tsx 결제 분기에만 사용 — ink-dark 카드는 분기 자체 X.

**Fix**: SiteHeader / mega-nav 와 동일 패턴 (`user_credits` 직접 조회 + `moonlight:credits-updated` event listen) 적용. ink-dark 카드 3 state 분기 (미인증 / 로딩 / 잔액 확정).

**전수조사 — 동일 binding 누락 패턴은 이 카드만 (`credits/page.tsx:170, 180` 단일 지점)**:
| 위치 | 상태 |
|---|---|
| `SiteHeader.tsx:660-707` | `user_credits` fetch + cache + event ✓ |
| `mega-nav.tsx:153-` | SiteHeader 와 동일 패턴 ✓ |
| `/my/page.tsx:137` | server-side `dashboard.credits.total` ✓ |
| `detail-unlock.tsx:424, 484` | `remaining` 변수 binding ✓ |
| `membership/page.tsx:256` "— 닭띠 · 1991" | 의도된 mockup 후기 attribution (사회증명 카드), bug 아님 |

**자동화 후속**: ✅ PR #195 — `audit-mockup-placeholders` script + CI strict step 추가. 동일 패턴 (mockup placeholder → dynamic binding 누락) 회귀 즉시 차단. 사용자가 first detector 되는 패턴 방지.

### 1.13 오늘 운세 detail 새로고침마다 1코인 차감 idempotency 회귀 (PR #196)

사용자 보고 (2026-05-17): 무료 운세 → 하단 1코인 버튼 → 상세 풀이 → **새로고침마다 또 차감**.

**Root cause**: `TodayFortuneDetailClient` (today-fortune-detail-client.tsx:79) 의 useEffect 가 mount 시마다 자동 POST `/api/today-fortune/unlock` 호출. `attemptedRef` 는 같은 컴포넌트 인스턴스에서만 중복 차단인데 **새로고침 = 새 React tree = ref 리셋 → POST 다시**.

정상이면 unlock route 의 idempotency 가 reused 반환해야 하나, 기존 entitlement check 가 `today_fortune_premium_access` (sourceSessionId 키) 만 봤음. 1코인 결제로 저장되는 `detail_report_access` (readingKey 키) row 가 있어도 매치 안 됨 → `unlockCreditsOnce` RPC deduct path → 매번 차감. **PR #192 (entitlement API 의 같은 패턴 회귀) 와 본질적으로 동일** — 두 endpoint 가 같은 access 의미를 봐야 함.

**Fix** (PR #192 패턴 그대로 — deps 주입 + 단위 테스트, profile/route-helpers 컨벤션):
- 신규 `unlock/route-helpers.ts`: `resolveTodayFortuneUnlockAccess(userId, scope, deps)` — 3 path 우선순위:
  1. taste-product entitlement (550원 직접 결제 DB row)
  2. coin-session — `hasTodayFortunePremiumAccess(sourceSessionId)`
  3. **coin-reading** — `hasDetailReportAccess(readingKey)` ← **회귀 fix 핵심** (credits/use 가 저장하는 레거시 키)
- 신규 `unlock/route-helpers.test.ts`: 6 시나리오 (taste / session / reading / none / 2 short-circuit).
- `unlock/route.ts`: helper 사용, `accessSource` null 일 때만 `unlockTodayFortunePremium` 호출.

**배포 즉시 효과**: 기존 `detail_report_access` row 있는 사용자 → 다음 새로고침부터 reused, 차감 안 됨. DB 마이그레이션 불필요.

**남은 follow-up**: 자동 POST 자체를 사용자 액션 (버튼 클릭) 으로 옮기는 UX 리팩토링 — 새로고침이 read-only 임을 코드 의도로 명시 (defense in depth). server-side idempotency 는 본 PR 에서 끝났지만 UX 명료성은 별도 작업 후보.

### 1.14 saju/today-detail named CSS class → inline token redesign (PR #198)

사용자 보고 (2026-05-17): `/saju/[slug]/today-detail` (550원 결제 후 풀이화면) 가 구스타일 페이지. PR #197 `audit-redesign-coverage` 의 CRITICAL 30건이 모두 이 페이지에 집중 — 단일 페이지 fix 로 audit CRITICAL 0 달성.

**Root cause**: 페이지가 `flow-polish.css` 의 `.gangi-today-detail-*` / `.gangi-paid-detail-*` / `.gangi-detail-kicker` 같은 **named CSS class** 사용. 다른 redesign 페이지 (PR #193 credits/success, `/today-fortune/detail` 등) 는 inline + Tailwind + design token 패턴 — architecture 불일치.

**Fix**:
- named class 30개 → inline style 1:1 변환. design token (`var(--app-pink)`, `var(--app-ink)` 등) + shadow/radius/padding 정확값 유지 → 시각 동일.
- 공통 inline snippet (`CARD_SURFACE_STYLE` / `KICKER_STYLE` / `SECTION_TITLE_STYLE`) 로 중복 감소.
- 파일 상단에 `// Redesign 2026-05-17 ...` 주석 추가 → audit WARNING marker 도 해결.
- `audit-redesign-coverage.mjs` regex 강화 — 주석 안의 class reference (trailing `-`) false positive 차단.

**Audit baseline 변화**:
| | Before | After |
|---|---|---|
| CRITICAL | 30 (전부 본 페이지) | **0** ✅ |
| WARNING | 59 | 58 (본 페이지 marker 추가) |

비즈니스 로직 (resolveReading / entitlement check / buildSajuReport / scoreCards 계산) 무수정 — UI 만 교체.

**남은 follow-up**:
1. **WARNING 58 분류** — auth/compatibility/dialogue/dream/forgot-password/free/guide 등 진짜 redesign candidate vs intentional stub (skip marker). 분류 후 CI `audit:redesign-coverage:strict` step 통합 (audit-mockup-placeholders 와 같은 패턴).
2. **flow-polish.css cleanup** — `.gangi-today-detail-*` / `.gangi-paid-detail-*` / `.gangi-detail-kicker` / `.gangi-result-flow-strip` rule 들 dead code. 다른 페이지 미사용 audit 으로 확인됨 — 후속 cleanup PR 에서 삭제.

### 1.18 audit-redesign-coverage WARNING 분류 (PR #202)

PR #197 audit script 의 baseline WARNING 58 분류 (PR #199~201 idempotency series 후속 4번 작업).

**Fix**: audit script 의 `SKIP_PATTERNS` 카테고리화 — 명확히 redesign 영향 없는 entry path glob:
- auth flow: `auth` / `login` / `signup` / `forgot-password` / `reset-password` (별도 redesign track)
- legal: `privacy` / `terms` (text-only)
- utility / redirect / lock: `safe-redirect` / `lock-screen` / `about-engine`
- info / help: `help` / `guide` / `support/faq` / `support/contact`
- onboarding step: `onboarding` / `saju/new/consent` / `saju/new/empathy` / `saju/new/nickname`
- notification widget (embedded): `notifications/widget`

**Baseline 변화**: 87 page → 68 page 스캔, WARNING 58 → **41** (SKIP_PATTERNS) → **21** (PR #203 wrapper detection).

`isWrapperContent` content-based skip 추가 (PR #203) — redirect-only 또는 thin wrapper (메타데이터 + 1-2 component import) 페이지 20개 자동 제외. 사용자가 보는 큰 UI 가 page.tsx 가 아닌 client component 에 있는 패턴 (예: `today-fortune/page.tsx` → `TodayFortuneExperience`, `today-fortune/detail/page.tsx` → `TodayFortuneDetailClient`) 모두 skip.

**남은 21 candidate 카테고리** (후속 PR 들로 순차 redesign):

| 카테고리 | 페이지 (real UI, wrapper 제외) | 우선순위 |
|---|---|---|
| ~~사주~~ | ~~`saju/[slug]/deep/page.tsx`~~ ✅ PR #204 | 완료 |
| 궁합 / 별자리 | `compatibility/page.tsx` (242), `compatibility/input/page.tsx` (51), `compatibility/result/page.tsx` (187), `star-sign/[slug]/cross/page.tsx` (430), `star-sign/compat/page.tsx` (314), `star-sign/compat/[a]/[b]/page.tsx` (413) | 중간 |
| 대화 | `dialogue/[expert]/page.tsx` (112), `dialogue/history/page.tsx` (183), `dialogue/history/[sessionId]/page.tsx` (175) | 중간 |
| 명리 / 보조 | `myeongri/page.tsx` (144), `daewoon/page.tsx` (100), `interpretation/page.tsx` (131) | 낮음 |
| 꿈해몽 / 타로 | `dream-interpretation/[slug]/page.tsx` (131), `tarot/daily/pick/page.tsx` (56) | 낮음 |
| MY / 결제 | `my/billing/page.tsx` (364), `my/settings/page.tsx` (282), `pricing/page.tsx` (191) | 중간 |
| ~~메인 / 보조~~ | ~~`free`, `zodiac`, `sample-report`~~ ✅ PR #205/#206/#207 | 완료 |

### 1.22 lifetime-report (49,000원) 환불 정책 + audit (PR #218)

사용자 후속 작업 2번. audit-business-activity 가 lifetime-report 8 events / 4 users (MEDIUM) 검출 — 49,000원 = 가장 비싼 단일 상품, 회귀 시 환불 부담 크다.

**audit baseline (전체 history)**:
- 총 결제 row: 8
- 순결제 (user × scope 유니크): 8
- unique users: 4
- 매출 (gross, KRW): **392,000**
- 회귀 (같은 user + 같은 scope 2+ row): **0** ✅
- 환불 history: 0건

**신규 script** (`scripts/audit-lifetime-report.mjs`):
- product_entitlements 의 lifetime-report row 통합 + 같은 user/scope 중복 결제 검출
- credit_transactions 의 regression_refund metadata 추적
- 매출 (gross) + 환불액 + 순매출 보고
- option: `--days N` / `--strict`

**환불 발생 시 절차** (audit 결과 회귀 발견 시):
1. 본 audit 로 회귀 row 식별 (id / user_id / scope_key / 결제일)
2. Toss 결제 환불 API (paymentKey 로 전액 또는 부분 환불)
3. `product_entitlements` row → status `'refunded'` (schema 추가 필요) 또는 row 삭제 + audit row 기록
4. 사용자 알림 (이메일 / push)

**남은 follow-up**:
- 분기 1회 audit:lifetime-report 실행으로 회귀 monitoring
- `product_entitlements.status` column schema 추가 검토 (refund 기록용)
- Toss 결제 환불 자동화 함수 (현재는 manual)

### 1.21 사용자 traffic 기반 우선순위 발굴 (PR #216 — audit-business-activity)

사용자 후속 작업 3번. PV 데이터 (Vercel Analytics 등) 없음 — production 의 business action 빈도 = activity proxy.

**신규**: `scripts/audit-business-activity.mjs` — readings / credit_transactions / product_entitlements / fortune_feedback / appointments 통합 집계. event × product 별 events + unique users.

**Last 30 days baseline (2026-04-17 ~ 2026-05-17, 9 unique users 활성)**:

| 등급 | event / product | events | users |
|---|---|---|---|
| 🔴 TOP | reading_created | 221 | 9 |
| 🔴 TOP | credit_deduct / detail_report (1코인) | 46 | 4 |
| 🔴 TOP | entitlement_purchased / today-detail (550원) | 35 | 7 |
| 🟡 MEDIUM | fortune_feedback / general (오늘 운세) | 24 | 4 |
| 🟡 MEDIUM | credit_deduct / ai_chat (3코인) | 22 | 3 |
| 🟡 MEDIUM | entitlement_purchased / lifetime-report (49,000원) | 8 | 4 |
| 🟡 MEDIUM | entitlement_purchased / monthly-calendar (1,900원) | 6 | 3 |
| 🟡 MEDIUM | entitlement_purchased / year-core | 5 | 3 |
| 🟢 LOW | love-question / money-pattern / work-flow / appointment / saju_personality_mini / personality_compatibility_mini / calendar / fortune_feedback work_meeting | 1-3 | 1-3 |

**해석**:
- **사주 + today-fortune detail = 핵심 흐름** (events 합 302 = 전체 86%). 회귀 발생 시 사용자 영향 가장 큼. 이미 PR #196~#201 (idempotency 4-tier + client marker) + PR #214 audit-payment-idempotency 모니터링 도구로 보호.
- **ai_chat (22 events, MEDIUM)** — 이전 분석에서 누락. dialogue 결제 흐름 검증 후보.
- **lifetime-report (8 events, MEDIUM)** — 가장 비싼 상품 (49,000원). 결제 회귀 발생 시 환불 부담 큼 → audit 강화 검토.
- **LOW 등급 (1-3 events)** — 회귀 발생 시 사용자 영향 작음, 사전 작업 defer.

**남은 follow-up**:
1. ai_chat 결제 흐름 검증 — credit_transactions 의 ai_chat feature row (3코인 차감) 가 idempotent 한지 audit. PR #196~#201 의 today-detail 류 회귀와 같은 패턴 가능성.
2. lifetime-report entitlement 회귀 / 환불 정책 — 49,000원 결제 회귀 발생 시 audit 도구 (lifetime-specific).
3. 분기 1회 `npm run audit:business-activity` 실행으로 우선순위 재산정 (회귀 발생 패턴 변화 모니터링).

### 1.20 redesign series 전체 완료 — audit baseline CRITICAL 0 + WARNING 0 + CI strict 통합 (PR #208~#213)

사용자 "1~5 순차 진행" 명시. PR #197 audit-redesign-coverage 의 17 candidate 모두 처리 + CI strict 통합으로 자동 회귀 차단 5종 완성.

**1~5 순차 진행 결과**:
| # | 그룹 | PR | 페이지 | 작업 |
|---|---|---|---|---|
| 1 | 궁합/별자리 (6) | #208 | compatibility 3 + star-sign 3 | 모두 marker (이미 redesigned) |
| 2 | 대화 (3) | #209 | dialogue/[expert] + history × 2 | 모두 marker |
| 3 | MY/결제 (3) | #210 | my/billing + my/settings + pricing | 모두 marker |
| 4 | 명리/보조 (3) | #211 | myeongri (redesign) + interpretation (redesign) + daewoon (marker) | 2 visual + 1 marker |
| 5 | 꿈해몽/타로 (2) | #212 | dream-interpretation/[slug] (redesign) + tarot/daily/pick (marker) | 1 visual + 1 marker |

**Audit baseline 추이**:
- 1.2.3 series 시작 시점: WARNING 21
- 1번 종료: 11
- 2번 종료: 8
- 3번 종료: 5
- 4번 종료: 2
- **5번 종료: 0** ✅

**CI strict 통합 (PR #213)**: `.github/workflows/ci.yml` 의 Test/Typecheck/Build job 에 `audit:redesign-coverage:strict` step 추가. 향후 누군가 신규 페이지에 구스타일 named CSS class (`gangi-today-detail-*` 등) 또는 redesign marker 누락 → CI exit 1 → 머지 차단.

**자동 회귀 차단 도구 5종 완성** (§2.10 참조).

### 1.19 1.2.3 redesign series 완료 — 사용자 1.2.3 순차 진행 (PR #204~#207)

PR #197/#202/#203 audit-redesign-coverage 의 baseline 정리 + 점진적 redesign. 사용자 명시 우선순위 (1번 사주, 2번 오늘 운세, 3번 메인) 순차 진행 결과:

| PR | 페이지 | 작업 | 결과 |
|---|---|---|---|
| #204 | `saju/[slug]/deep` (517줄) | marker only | 이미 design token 적용, marker 누락만 |
| #205 | `free` (43줄) | marker only | design system component 기반 (GangiIntro/GangiListLink) |
| #206 | `zodiac` (113→167줄) | visual redesign | PageHero/SectionSurface → inline + design token |
| #207 | `sample-report` (239→388줄) | visual redesign | 7 section + ink-dark "다음 단계" hero |

**2번 오늘 운세**: candidate 0개 (모두 wrapper — UI 가 client component 에 있음). 작업 없음.

**Audit baseline 추이**: 21 → 20 → 19 → 18 → **17** (4 페이지 처리, sample-report 의 `TrackedLink` style prop 추가 부수 변경).

**남은 17 candidate** (다음 순차 작업 후보):
- 궁합 / 별자리 6개 (compatibility 3 + star-sign 3)
- 대화 3개 (dialogue/[expert] / history × 2)
- MY / 결제 3개 (my/billing / settings / pricing)
- 명리 / 보조 3개 (myeongri / daewoon / interpretation)
- 꿈해몽 / 타로 2개

순차 진행 시 동일 패턴 (PR #206 zodiac / PR #207 sample-report) 적용 — 같은 layout component (PageHero/SectionSurface/FeatureCard) 사용 페이지는 inline + design token 변환, design system component 만 사용하는 페이지는 marker only.



**남은 follow-up**:
1. 41 candidate 페이지 순차 redesign — 우선순위 높음 (사주/오늘운세/메인) 부터.
2. **CI strict step 통합** — 41 → 0 만든 후 `audit:redesign-coverage:strict` ci.yml step 추가. 그때 사용자가 first detector 되는 패턴 자체 차단 완료.

### 1.17 today-fortune detail 자동 POST → 사용자 액션 UX 리팩토링 (PR #201)

PR #199 / #200 의 server-side idempotency 가 backstop. 본 PR 은 **client 의도 명확화** — 새로고침이 read-only 임을 코드 흐름으로 명시 (defense in depth + server load 절감).

**신규 흐름**:
1. 무료 페이지 "1코인 열기" → `markPendingUnlock(sourceSessionId)` (sessionStorage) + navigate.
2. detail page mount → `consumePendingUnlock` 으로 marker 확인:
   - 있음 → POST (deduct trigger) + marker clear
   - 없음 (새로고침 / 직접 URL) → GET (read-only)
3. GET 응답 `hasAccess: false` → 무료 페이지 redirect (사용자 결제 안 함).

**변경**: 신규 `unlock-marker.ts`, unlock route 에 GET handler 추가, detail-client useEffect 분기, 무료 페이지 2곳 handleUnlock 에 marker 호출.

**defense in depth 3-layer 완성**:
| Layer | 보호 | PR |
|---|---|---|
| client | 새로고침 시 deduct request 자체 안 보냄 | #201 |
| server (daily) | POST 와도 daily fallback → reused | #199 |
| server (reading) | reading-scoped 정확 매치 → reused | #200 |

### 1.16 today-fortune/unlock coin-reading path 의 잘못된 kind fix (PR #200 — PR #199 evidence 기반 정확한 fix)

PR #199 의 supabase MCP evidence 가 확정: production row 모두 `kind=today_fortune_premium_access`. PR #196 의 coin-reading path 가 `hasDetailReportAccess` 사용 — `kind=detail_report_access` 만 조회해서 매번 false (kind 미스매치).

**Fix**: `hasTodayFortunePremiumAccessByReading(userId, readingKey)` 신규 — JSONB `@>` 매치 (`{kind: today_fortune_premium_access, readingKey}` 가 row metadata 에 포함, sourceSessionId 무관). coin-reading path 가 두 kind OR 조회 — today-fortune 경로 (PR #200 추가) + saju-detail 경로 (기존).

**최종 4-tier matrix**:
| Path | Source | 매치 키 | PR |
|---|---|---|---|
| 1 | taste-product | 550원 결제 row | #178 |
| 2 | coin-session | `today_fortune_premium_access` by sourceSessionId | #178 |
| 3 | coin-reading | `today_fortune_premium_access` by readingKey **OR** `detail_report_access` by readingKey | #196 + #200 |
| 4 | coin-daily | `feature='detail_report'` + `type='use'` + KST 같은 일자 (kind 무관) | #199 |

PR #199 (daily, 사용자 명시 비즈니스 룰) + PR #200 (reading-scoped, 정확성) 보완 — daily 가 못 잡는 edge case (어제 결제 사주 → 오늘 첫 진입) 도 path 3 catch. defense in depth.

### 1.15 today-fortune/unlock "같은 날 두 번 결제 차단" daily idempotency (PR #199 — supabase MCP evidence 기반 root cause 확정)

사용자 보고 (2026-05-17): `/today-fortune/detail` 에서 1코인 결제 후 다시 보려고 하면 또 차감. PR #196 의 3-path fallback (taste-product / coin-session / coin-reading) 후에도 production 에서 재현. "로그인한 사람들의 코인 결제내역을 확인해서 해당하는 년월일시 확인해서 같은 날에 두번 결제가 이뤄지지 않게 시스템화해야해" 명시 요구.

**supabase MCP evidence (production credit_transactions 24-48h)**:
| user_id | row_count | kinds | reading_keys (distinct) | source_session_ids (distinct) |
|---|---|---|---|---|
| 8d7efd3c… | **6** | `[today_fortune_premium_access]` | **1** (단일) | **6** (매번 새 UUID) |
| 331ab9f9… | 5 | `[today_fortune_premium_access]` | 1 | 5 |
| adad3be3… | 2 | `[today_fortune_premium_access]` | 2 | 2 |

**Root cause 확정**: production row 가 **전부 `today_fortune_premium_access` kind** (today-fortune/unlock 경로) + 단일 readingKey + **매번 새 sourceSessionId** (today-fortune 무료 결과 생성마다 UUID).

PR #196 fallback 이 작동 못한 이유:
- `hasTodayFortunePremiumAccess(sourceSessionId)`: sourceSessionId 매번 새로 생성 → 매번 false.
- `hasDetailReportAccess(readingKey)`: **`detail_report_access` kind 만 조회**. production row 는 `today_fortune_premium_access` kind → **kind 미스매치, 매번 false**.
- 두 fallback 모두 false → unlockTodayFortunePremium RPC → 새 sourceSessionId 라 idempotency 미매치 → deduct + 새 row → 매번 차감.

**Fix — 4-path matrix (broadest fallback 추가)**:
| Path | Source | 매치 키 | 추가 PR |
|---|---|---|---|
| 1 | taste-product | 550원 직접 결제 DB row | #178 |
| 2 | coin-session | `today_fortune_premium_access` (sourceSessionId) | #178 |
| 3 | coin-reading | `detail_report_access` (readingKey) | #192 / #196 |
| 4 | **coin-daily** | `feature='detail_report'` + `type='use'` + KST 같은 일자 (metadata kind 무관) | **#199** |

`hasTodayFortuneDailyAccess` 신규 (detail-report-access.ts) — Korea timezone day [00:00 KST, +24h), metadata kind 무관. 사용자 명시 비즈니스 룰 "같은 user 가 같은 날 today-detail 결제했다면 어떤 reading / sourceSessionId 로 진입해도 reused".

**배포 즉시 효과**: evidence 의 user 8d7efd3c / 331ab9f9 / adad3be3 등 이미 오늘 차감 row 보유자 → 다음 진입부터 `coin-daily` 매치, 차감 안 됨. DB 마이그레이션 / 데이터 정정 불필요.

**남은 follow-up**:
1. ✅ **유저 환불 완료** — supabase MCP execute_sql 로 직접 환불 (2026-05-17 KST). 8d7efd3c +6 코인 (5/14·5/16·5/17 각 2 잉여), 331ab9f9 +3 코인 (5/17 3 잉여). adad3be3 는 다른 readingKey 라 의도된 행동 가능성 — 환불 제외. audit row 3개 (`type=purchase`, `metadata.kind=regression_refund`) credit_transactions 에 기록.
2. ✅ **정확한 fix 완료** — PR #200 `hasTodayFortunePremiumAccessByReading` 신규, coin-reading path 가 두 kind OR 조회.
3. ✅ **자동 POST → 사용자 액션 UX 리팩토링 완료** — PR #201. sessionStorage marker (`unlock-marker.ts`) + detail-client GET/POST 분기 + 신규 GET handler. 새로고침 시 server POST 호출 자체 없음. defense in depth 3-layer 완성 (client 의도 명시 + server daily idempotency + reading-scoped).

---

## 2. 핵심 기술 결정

### 2.1 12간지 로딩 모션
- After Effects HTML 그대로 사용 X (512KB). CSS/SVG 재구현 (~6KB)
- 모든 `GangiLoadingOverlay` 호출자 자동 12간지 — 디자인 단일화
- `MIN_LOADING_MS=600ms` 가드 + `router.prefetch + push + didNavigate`

### 2.2 점수 single source of truth (`iljinScore.totalScore`)
- `result.scores` (SajuReport 기반) vs `result.iljinScore` (운세톡톡 벤치마크) **공존이 원인**
- 빌더에서 `scores.overall = iljinScore.totalScore` 덮어쓰기
- 영역별: `totalScore + (영역점수 - 영역평균)` 정규화 → 평균이 totalScore, 상대 차이 보존
- `TODAY_RESULT_STORAGE_PREFIX = ...:v3:` (v1 → v2 → v3 마이그레이션으로 옛 캐시 무효화)
- **PR #179 — 통일 범위 확장**: 오늘 운세 빌더 안에만 있던 통일 로직을 `src/lib/today-fortune/unify-saju-scores.ts` helper 로 추출. 사주 페이지 3곳 (`/saju/[slug]`, `/saju/[slug]/today-detail`, `/saju/[slug]/share`) 도 동일 helper 호출해서 두 페이지 점수 일치 보장.
- **PR #180 — yearly-report + credits/use 추가 통일**: `build-yearly-report.ts` 의 5개 buildSajuReport 결과 + `/api/credits/use/route.ts` 의 5개 report scores 모두 통일.
- **PR #181 — 6 영역 카드 통일**: `compute-saju-area-scores.ts` 신규 helper + `SajuAreaCardsSection` 공유 컴포넌트. 3 페이지 (사주 메인/상세/운세) 동일 6 카드 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운).
- **PR #183 — invariant test 잠금**: 사주 페이지 6 영역 score === 오늘 운세 페이지 score 1:1 일치 strict assertion. 회귀 발생 시 즉시 npm test 실패.

### 2.10 자동 회귀 검증 시스템 (PR #183/#184) — "사용자 매번 보고하지 않게"

사용자 메타 피드백 대응. production 화면에서 사용자가 first detector 역할을 줄이는 자동화.

**5 종 도구 매트릭스** (2026-05-17 자동 회귀 차단 완성):
| 도구 | 차단 가능 회귀 | 실행 | 도입 PR |
|---|---|---|---|
| `audit-dead-anchors` | `href="#xxx"` 가 페이지에 정의 안 된 anchor (PR #182 류) | `npm run audit:dead-anchors` (+ `--strict` for CI) | #183 |
| score invariant test | 사주 페이지 ↔ 운세 페이지 영역별 score 불일치 (PR #179-#181 류) | `npm test` 자동 (build-today-fortune.test.ts) | #183 |
| Playwright smoke E2E | 페이지 진입 깨짐 / console error / dead internal link | `npm run e2e` (chromium, ~6s) | #184 |
| `audit-mockup-placeholders` | redesign 컴포넌트 mockup placeholder binding 누락 (PR #194 류 — `✦ —` / "로그인 후 ..." hardcoded) | `npm run audit:mockup-placeholders` (+ `--strict` for CI) | #195 |
| `audit-redesign-coverage` | 구스타일 named CSS class 사용 (`gangi-today-detail-*` 등) + redesign 마커 누락 페이지 (PR #193 류 / saju/today-detail 류) | `npm run audit:redesign-coverage:strict` (CI 통합 완료) | #197 / #202 / #203 / #213 |

**자동화 즉시 효과 (PR #183 도입 시점)**:
- 새 audit script 실행 → 사용자가 본 dead anchor 외에 추가 false positive 1건 즉시 분류 (regex 개선)
- 새 invariant test 실행 → PR #181의 `compute-saju-area-scores.ts` dailyDelta 누락 회귀 검출 → 사용자가 보고 안 한 score 미세 차이 사전 fix

### 2.3 사주 + 일진 hybrid (행운 패키지)
- 사주 lucky element = 평생 동일 (명리 이론 정합)
- 오늘 일진 천간 element 보조 source 도입:
  - 일진 = 기신 → 무시 (lucky 만)
  - 일진 = lucky → 강조 (변동 없음)
  - 일진 = 다른 element → **두 element 항목 합집합** (9 항목 매일 일부 변동)

### 2.4 메가 메뉴 vs SiteHeader
- lg ≥ 1024px: 메가 메뉴 단독 노출, SiteHeader CSS `!important` 로 강제 숨김
- 모바일 시트는 **top sheet** (햄버거가 우상단이라 자연스러움) + `createPortal(document.body)` (부모 transform 영향 0)

### 2.5 admin 화이트리스트
- `ADMIN_USER_IDS` env (부트스트랩) + `admin_users` 테이블 (운영)
- `getCurrentAdminCheck()` 가 in-memory 5분 TTL 캐시
- `/admin/*` layout 가드 + API guard 양쪽

### 2.6 상황 데이터 흐름
- 입력: `/saju/new` (live preview), `/my/situation` (default 저장)
- 저장: `reading_situation` (per-reading) + `profiles.user_situation` (user default fallback)
- 활용: `personalizationContext.userSituation` → narrative honorific + chip 카드 + 오늘 점수 재정렬 + perspective

### 2.7 ML 학습 → production 자동 루프
```
admin /admin/weight-tuning 학습 → draft 저장
  ↓ R² ≥ 0.05 검증 (PR #153)
admin 활성화 → status='active'
  ↓ 5분 stale-while-revalidate (PR #140)
production today-fortune 의 scoreHint 자동 override
```

### 2.8 결제 entitlement 통합 API (PR #178, 보존 필수)

**API 계약**:
```
GET /api/payments/entitlement
  ?productId=<taste|lifetime|subscription productId>
  &slug=<reading slug, optional>
  &scope=<scope key, optional>     // 예: 'general', '2026-05'
  &plan=<basic|premium|plus>         // productId='subscription' 일 때만

응답:
{
  hasEntitlement: boolean,
  openHref: string | null,   // 보유 시 열람 페이지 URL
  reason: 'product-purchased' | 'coin-unlocked' | 'active-subscription'
        | 'lifetime-purchased' | 'unauthenticated' | null
}

productId 지원:
- 'today-detail'      → coin unlock + product entitlement 모두 검사
- 'love-question' / 'money-pattern' / 'work-flow' (글로벌)
- 'monthly-calendar' (scope=YYYY-MM)
- 'year-core' (scope=YYYY)
- 'lifetime-report' (slug 필수)
- 'subscription' (plan 필수, plus→basic 정규화)
```

**Client hook** `useProductEntitlement(input)`:
- mount 시 fetch, `cancelled` flag 로 unmount race 방지
- 네트워크 실패 시 `hasEntitlement=false` (결제 button 막지 않음 — fail-open 안전)
- `enabled=false` 면 fetch skip (slug 미준비 등)

**확장 가이드**:
- 새 상품 추가 시 → `route.ts` 의 productId 분기 + `buildPurchasedProductHref` 에 매핑 추가
- 새 client 진입점 → `useProductEntitlement({productId, slug?, scope?})` 만 호출, 결과 분기

### 2.9 결제 DB 스키마 (보존 필수)

#### 2.9.1 `product_entitlements` (canonical)
```sql
-- src/lib/product-entitlements.ts ProductEntitlementRow 참조
id           uuid PK
user_id      uuid (FK auth.users)
product_id   text  -- 'today-detail' | 'love-question' | 'money-pattern' |
                   --  'work-flow' | 'monthly-calendar' | 'year-core' |
                   --  'lifetime-report'
scope_key    text  -- 'global' (single-purchase) 또는 build*ScopeKey() 결과
order_id     text  nullable
payment_key  text  nullable (토스 paymentKey)
package_id   text  nullable
amount       int   nullable
metadata     jsonb -- {kind, productId, scopeKey, orderId, paymentKey, amount, packageId}
created_at   timestamptz

UNIQUE INDEX (user_id, product_id, scope_key)
```

**scope_key 빌더** (`src/lib/payments/product-scope.ts`):
- `buildTodayDetailScopeKey(sourceSessionId)` — `today-detail` 용 (사주 + 오늘 단위)
- `buildReadingProductScopeKey(readingKey)` — 사주별 단위
- `buildMonthlyCalendarScopeKey(readingKey, year, month)` — 사주 + 월 단위
- `buildYearCoreScopeKey(readingKey, year)` — 사주 + 년 단위
- `buildLifetimeReportScopeKey(readingKey)` — 사주별
- 글로벌 상품 (love-question 등): scope_key = `'global'` (insert) / `null` (select)

#### 2.9.2 `subscriptions` (멤버십)
```sql
-- src/lib/subscription.ts SubscriptionRow 참조
user_id            uuid PK / FK
status             text  -- 'active' | 'cancelled' | 'expired'
plan               text  -- 'plus_monthly' | 'premium_monthly'
renews_at          timestamptz nullable
toss_billing_key   text  nullable
toss_customer_key  text  nullable
created_at         timestamptz
updated_at         timestamptz
```

- `getManagedSubscription(userId)` 가 `renews_at <= now()` 인데 status≠'expired' 면 자동 'expired' 갱신.
- plan slug → subscriptionPlan 매핑: `basic → plus_monthly`, `premium → premium_monthly`, `lifetime → 별도 (product_entitlements 의 lifetime-report)`

#### 2.9.3 `credit_transactions` (legacy + audit)
```sql
-- src/lib/product-entitlements.ts EntitlementTransactionRow 참조
id          uuid PK
user_id     uuid
type        text  -- 'purchase' | 'consume' | ...
feature     text  -- 'taste_product' | 'lifetime_report' | ...
amount      int   -- 코인 변동량 (purchase 의 경우 0 가능 — entitlement audit 용)
metadata    jsonb -- entitlement audit 정보 (kind/productId/readingKey/scopeKey/orderId/paymentKey)
created_at  timestamptz
```

**역할**:
- 코인 거래 원장 (PRIMARY)
- product_entitlements 가 도입되기 전 entitlement 저장소 (LEGACY)
- 새 entitlement 도입 시 product_entitlements 에 PRIMARY 저장 + credit_transactions 에 audit 미러링 (`recordLegacyTasteProductTransaction`)

#### 2.9.4 entitlement 조회 우선순위
```
1. product_entitlements 에서 (user_id, product_id, scope_key) 조회
2. 없으면 credit_transactions 의 legacy 행 조회 (`feature='taste_product'` + metadata.scopeKey 일치)
3. today-detail 한정: hasTodayFortunePremiumAccess(coin unlock) 도 검사
```

---

## 3. 알려진 이슈 / 미해결

### 3.1 ~~Pre-existing test failure~~ ✅ FIXED (PR #176)
- ~~`not ok - day master summary is separated from topic highlight cards`~~
- PR #176 에서 정규식 `/타고난 기질/` → `/핵심 기질/` 로 보정. 코드는 47e533a 이후 "내 핵심 기질" 사용 중이었음.

### 3.1b ~~사주 페이지 ↔ 오늘 운세 페이지 점수 불일치~~ ✅ FIXED (PR #179)
- ~~같은 사용자 같은 날 사주 페이지 69 vs 오늘 운세 페이지 45 → 24점 차이~~
- PR #179 에서 `unifyScoresWithIljinScore` helper 추출 + 사주 페이지 3곳 적용. iljinScore.totalScore single source of truth 확장.

### 3.1d 로컬 `.env.development.local` override gotcha (vercel CLI 자동 생성 파일)

- `vercel env pull` 이 만든 `.env.development.local` 이 `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` 등을 빈 문자열 `""` 로 두는데, Next.js env precedence 가 **`process.env` > `.env.development.local` > `.env.local`** 이라 .env.local 의 실 값이 가려진다.
- 증상: `/api/payments/entitlement` 500 `supabaseKey is required` / `/membership` 활성 구독자 "이용 중" 배지 미노출.
- Workaround (로컬 dev):
  ```bash
  set -a
  source <(grep -E "^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|E2E_TEST_USER_EMAIL|E2E_TEST_USER_PASSWORD|E2E_TEST_READING_SLUG)=" .env.local)
  set +a
  npm run dev
  ```
- CI 영향 0: `.env.development.local` 미존재 (gitignored), `process.env` 에 GitHub Secrets 매핑된 값 적용.
- 본질 해결: Vercel development 환경에 실 service role 키 등록 후 `vercel env pull --environment=development` 재실행. 또는 본 파일 삭제 + 필요 시 수동 작성.

### 3.1c ~~CI npm ci 만성 실패~~ ✅ FIXED (PR #185)
- ~~`Missing: typescript@4.9.5 from lock file` — `@tosspayments/payment-widget-sdk` 의 peer dep 충돌~~
- PR #185 에서 `.github/workflows/ci.yml` + `.github/workflows/playwright.yml` 의 `npm ci` 에 `--legacy-peer-deps` 추가. typescript 4.x ↔ 5.x peer-dep 충돌 우회.
- PR #186/#187 모두 admin override 없이 정상 squash merge 통과로 fix 확인.

### 3.2 운영 적용 필요 마이그레이션
- migration 025 (sinsal_weight_versions)
- migration 026 (notification_log_variant + clicked_at)
- migration 027 (star_sign_favorites)
- migration 028 (admin_users) — **`ADMIN_USER_IDS` env 필수**
- migration 029 (profile_user_situation)

### 3.3 VAPID 키 발급 필요
- `npm run generate:web-push-keys` 후 Vercel env 3종 설정
- `docs/web-push-setup.md` 6 단계 점검표 참조

### 3.4 사이드바 부가 기능 이동 미완
- PR #155/#159 가 PC SiteHeader 의 사이드바를 가렸지만, 기존 사이드바의 LayoutMode/ReadingComfort 토글 / 로그아웃 버튼 등이 PC 에서 접근 불가
- → 다음 정리 PR 에서 우상단 avatar drawer 또는 `/my/settings` 로 이동 필요

### 3.5 site-header.tsx dead-code
- PR #156 에서 inline 드롭다운을 `false && mobileMenuOpen` 으로 비활성. 약 160줄 dead-code 잔존.
- 다음 정리 PR 에서 완전 삭제 예정.

---

## 4. 다음에 이어서 할 일 (우선순위)

### Tier 총평·점수 (2026-05-21 세션 follow-up) — 최우선
| # | 작업 | 예상 | 상태 |
|---|---|---|---|
| **TR1** | **daewoon-llm-spec 어휘 정책 반영** — 챕터 `COMMON_SYSTEM_PROMPT`(§9 오행/§10 십성/결 강화) + `chapter-validator`(§12 정규식) + `MYEONGRI_GLOSSARY` "X의 결" ~10종 재작성. 라이브 9챕터 + 전역 글로서리라 글로서리·검증기·프롬프트·테스트 **한 묶음**으로 (총평 PR #301/#302 패턴 재사용) | 1일 | ⬜ **B 확정**(다음 주기), 태스크 칩 생성 |
| **SC2** | **점수 Phase 2** — Tailwind 토큰 등록(`tailwind.config`) + 면책 문구 시스템 + 라벨별 UI 분기 준비 | 0.5일 | ⬜ |
| **SC3** | **점수 Phase 3** — `SajuScoreCard`(원형 점수) + `ScoreBreakdownCard`(5요소 산출) + 카운트업 애니메이션 | 1.5일 | ⬜ |
| **SC4** | **점수 Phase 4** — `OhaengChart` 막대 차트 + 부족/과다 가이드 카드 | 1일 | ⬜ |
| **SC5** | **점수 Phase 5~6** — LLM `guidanceText` 연계(총평 파이프라인 활용) + 무료/유료 경계 재설계 | 1일 | ⬜ |
| **TR2** | 총평 스테이징 QA — 상황 보유 reading 단락2 직업·단락4 고민 반영 육안 / 5케이스 BEFORE-AFTER / 비전문가 가독성 | 0.5일 | ⬜ |

### Tier 0 — 자동 회귀 검증 시스템 완성 (Phase 2B, 2026-05-16 세션 follow-up) ✅ 완료
| # | 작업 | 예상 | 상태 |
|---|---|---|---|
| **0-1** | **Phase 2B: 사주 페이지 인증 E2E** — Hybrid auth fixture (storage state + real login) + 4 회귀 시나리오 (6 카드 / hero anchor / 결제 차단 / 점수 일치) | 1-1.5일 | ✅ PR #186 + #187 fix |
| 0-2 | Playwright CI workflow — `.github/workflows/playwright.yml` + Phase 2A 5 test 자동 실행 + Phase 2B Secrets 활성 시 자동 추가 | 0.5일 | ✅ PR #185 |
| 0-3 | `audit:dead-anchors:strict` 를 ci.yml step 으로 통합 — 새 dead anchor PR 머지 차단 | 0.2일 | ✅ PR #185 |

### Tier A — 직전 작업 자연스러운 연장
| # | 작업 | 예상 | 상태 |
|---|---|---|---|
| A1 | 사이드바 부가 기능 (LayoutMode / ReadingComfort / 로그아웃) 새 위치 — 우상단 avatar drawer 또는 `/my/settings` 통합 | 0.5일 | ✅ PR #169/#173 완료 |
| A2 | `site-header.tsx` dead-code (`false && mobileMenuOpen` 약 160줄) 완전 삭제 | 0.3일 | ✅ PR #168 완료 |
| A3 | 점수·이름 통일 운영 검증 (`v3` prefix 후 새 응답 흐름 확인) | 0.5일 | ✅ PR #179-#181 + #183 invariant test 로 자동화 |
| A4 | 행운 패키지 hybrid 운영 검증 + 일진 흉신 케이스 실측 | 0.3일 | ✅ PR #190 (5×4×6=120 케이스 matrix audit + invariant test) |
| **A5** | **CI npm ci 만성 실패 fix** — `--legacy-peer-deps` 추가, admin override 의존 종료 | 0.3일 | ✅ PR #185 완료 |
| A6 | **결제 중복 차단 활성 계정 검증** — 멤버십/lifetime 각각 entitlement seed/cleanup E2E 매 PR 자동 검증 | 0.5일 | ✅ PR #188 (Phase 2C 4 시나리오) + PR #192 회귀 fix (1코인 결제 `detail_report_access` kind 추가 조회). E2E 가 1코인 시나리오 미커버 → 보강 필요 |
| A7 | 사주 결과 페이지 CTA 를 `useProductEntitlement` 로 일관화 (서버 props 대신) — 다른 탭 결제 후 실시간 반영 | 0.5일 | ✅ PR #189 (4 saju 페이지 hybrid 패턴: client wrapper + EntitlementRefresher) |
| A8 | "no healthy upstream" 사용자에게 안내 — 결제창 실패 시 client toast 로 "이미 결제한 상품인지 확인해주세요" 가이드 | 0.3일 | ✅ PR #191 (결제 catch 2곳 sonner toast + "/my/billing" action 버튼, duration 6초) |

### Tier B — 수익 · 리텐션
| # | 작업 | 예상 |
|---|---|---|
| B1 | 결제 funnel 통계 (`/credits → prepare → confirm`) admin 대시보드 | 1일 |
| B2 | 결제 후 만족도 follow-up push (24h 후 feedback 유도) | 0.5일 |
| B3 | LTV / cohort 분석 | 1일 |

### Tier C — ML / 분석 후속
| # | 작업 | 예상 |
|---|---|---|
| C1 | 영역별 가중치 학습 — overall 외 5 영역 각각 | 1.5일 |
| C2 | 별자리 push D/E variant 추가 (신화 · 궁합 본문) | 0.5일 |

### Tier D — 콘텐츠 확장
| # | 작업 | 예상 |
|---|---|---|
| D1 | 띠 × 별자리 크로스 (12 × 12 = 144 조합 통합 풀이) | 1.5일 |
| D2 | 사주 공유 이미지 (OG image generation) | 1일 |
| D3 | 시간대별 운세 (오전/오후/저녁 구분) | 1일 |
| D4 | 꿈해몽 36 → 100 단어 + 카테고리 필터 | 1일 |

### Tier E — 성능 / 운영 안정성
| # | 작업 | 예상 |
|---|---|---|
| E1 | 모바일 LCP — Noto Sans KR 6 weight → 2-3 weight | 0.5일 |
| E2 | Rate limit (`/api/payments`, `/api/notifications/test`) | 1일 |
| E3 | Sentry 통합 + source map upload | 0.5일 |
| E4 | `/admin/operations` 차트화 (grid → SVG bar/line) | 0.5일 |

### Tier F — 신규 기능
| # | 작업 | 예상 |
|---|---|---|
| F1 | 가족 그룹 운세 (5인 한 화면) | 2일 |
| F2 | 신년 운세 특별 페이지 `/new-year` | 1일 |
| F3 | 친구 추천 referral | 1-1.5일 |
| F4 | 사주 PDF 다운로드 | 1일 |

---

## 5. 운영 적용 체크리스트

### 5.1 환경 변수 (Vercel)
- [ ] `ADMIN_USER_IDS=<owner-uuid>` (PR #141)
- [ ] `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` (PR #135–#142)
- [ ] `WEB_PUSH_PRIVATE_KEY`
- [ ] `WEB_PUSH_SUBJECT=mailto:owner@your-domain.com`
- [ ] `CRON_SECRET` / `NOTIFICATION_CRON_SECRET`

### 5.2 Supabase Migrations (순서대로)
- [ ] 025_sinsal_weight_versions
- [ ] 026_notification_log_variant
- [ ] 027_star_sign_favorites
- [ ] 028_admin_users
- [ ] 029_profile_user_situation

### 5.3 Vercel Cron 확인
- KST 08:00 / UTC 23:00 — today-fortune
- KST 09:00 / UTC 00:00 — today-star-sign
- KST 10:00 / UTC 01:00 — subscription-expiring
- KST 12:00 / UTC 03:00 — today-tarot
- KST 19:00 / UTC 10:00 — comeback-reminder
- KST 20:00 / UTC 11:00 — today-zodiac

### 5.4 운영 검증 절차
1. `/today-fortune` 무료 결과 → 4 위치 점수 일치 + 이름 본인 nickname 노출
2. 행운 패키지 9 항목 매일 일부 변동 (사주 lucky ≠ 일진 element 인 날)
3. `/admin/web-push-status` → `fullyConfigured: true`
4. 테스트 사용자 push 구독 → dry-run → 실발송 → 클릭 ack → CTR 확인
5. `/admin/push-ctr` → variant 별 CTR 노출
6. `/admin/operations` 진입 (admin only) → 운영 지표 노출

---

## 6. 핵심 파일 / 경로 빠른 참조

### 데이터 / 빌더
- `src/server/today-fortune/build-today-fortune.ts` — 오늘운세 빌더 + 점수 통일
- `src/lib/today-fortune/lucky-package.ts` — 행운 패키지 hybrid
- `src/lib/today-fortune/iljin-score-engine.ts` — 8영역 점수
- `src/lib/star-sign/daily-fortune.ts` — 별자리 일별 PRNG
- `src/domain/saju/report/build-narrative.ts` — 사주 narrative + honorific

### 컴포넌트
- `src/components/saju/situation-reflection-card.tsx` — 상황 chip (default/compact)
- `src/components/star-sign/my-star-sign-card.tsx` — MY 별자리
- `src/components/saju/zodiac-wheel-loading.tsx` — 12간지 로딩 모션
- `src/components/today-fortune/today-lucky-package-card.tsx` — 행운 패키지 UI
- `src/components/today-fortune/today-iljin-breakdown-card.tsx` — 점수 산출 내역
- `src/components/today-fortune/today-premium-question-chips.tsx` — Q1/Q2/Q3 prefill 대화방 link (PR #176)
- `src/components/today-fortune/premium-lock-card.tsx` — today-detail 결제 lock + entitlement 분기 (PR #178)

### 결제 entitlement (PR #177/#178)
- `src/lib/payments/catalog.ts` — PAYMENT_PACKAGES, isSubscriptionPackage, isTasteProductPackage
- `src/lib/payments/product-scope.ts` — scope key 빌더 + resolvePaymentProductScope + buildPurchasedProductHref
- `src/lib/product-entitlements.ts` — getTasteProductEntitlement, grantProductEntitlement
- `src/lib/report-entitlements.ts` — lifetime report entitlement
- `src/lib/subscription.ts` — getManagedSubscription
- `src/lib/payments/use-product-entitlement.ts` — client hook
- `src/app/api/payments/entitlement/route.ts` — 통합 GET 엔드포인트

### Navigation
- `src/features/shared-navigation/mega-nav.tsx` — PC 메가
- `src/features/shared-navigation/mobile-nav-sheet.tsx` — 모바일 top sheet
- `src/features/shared-navigation/mega-nav-data.ts` — 4 group 데이터

### Admin
- `src/lib/admin-auth.ts` — `getCurrentAdminCheck`
- `src/app/admin/layout.tsx` — server-side redirect
- `src/app/admin/weight-tuning/` — ML 학습 + R² 가드
- `src/app/admin/push-ctr/` — variant CTR UI

### Content / Config
- `src/content/moonlight.ts` — DALBIT_TEACHERS (12간지 선생), MY_MENU_BLUEPRINT, NotificationSlotKey
- `src/features/shared-navigation/mega-nav-data.ts` — 메가 메뉴 4 group
- `src/lib/saju/types.ts` — BirthInput, UserSituation

---

## 7. 테스트 상태 & 자동 검증 명령
- `npm test` — **354 ok / 0 failure** (PR #183 invariant 1건 +1)
- `npm run test:spec` — vitest 64/64 pass (unit/spec)
- `npm run typecheck` — 0 error
- `npm run audit:dead-anchors` — 작동 안 하는 # 링크 자동 검출 (PR #183)
- `npm run audit:dead-anchors:strict` — dead anchor 1건이라도 있으면 exit 1 (CI 통합 가능)
- `npm run audit:user-entitlements <user-id-or-email>` — 사용자 결제 상태 + 9 진입점 차단 매트릭스
- `npm run e2e` — Playwright smoke E2E (chromium, ~6s, 5 test) — 페이지 진입 깨짐/console error/dead internal link 자동 차단 (PR #184/#185)
- `npm run e2e -- --project chromium-auth` — Phase 2B 사주 페이지 인증 E2E (auth-setup + 4 시나리오 ~10s) — 6 카드 / hero anchor / 결제 차단 / 점수 일치 자동 검증 (PR #186/#187). credentials (`E2E_TEST_USER_*` env) 미설정 시 자동 skip
- `npm run e2e -- --project chromium-payment-blocks` — Phase 2C 결제 차단 활성 entitlement E2E (PR #188). subscription / lifetime entitlement seed/cleanup + 4 시나리오 (멤버십/pricing/checkout/deep). `SUPABASE_SERVICE_ROLE_KEY` 필요, 미설정 시 자동 skip
- `npm run audit:lucky-hybrid` — 행운 패키지 hybrid 룰 매트릭스 audit (PR #190). 전수 120 케이스 + 단일 모드 `--lucky 화 --unlucky 금`
- `npm run audit:lucky-hybrid:strict` — invariant 위배 1건이라도 있으면 exit 1 (CI 통합 가능)
- `npm run e2e:ui` — Playwright UI mode (디버깅)
- ✅ CI 환경 `npm ci` peer-dep 충돌 해소 — PR #185 의 `--legacy-peer-deps` flag 적용 후 admin override 없이 정상 squash merge 통과 (PR #186/#187 확인)

---

## 8. 최근 배포 이력

| 날짜 | Release | PR | 핵심 |
|---|---|---|---|
| 2026-05-29 | **Codex 모바일 하단 고정 CTA 겹침 수정 + production 배포** | commit `f3db6fa` | `codex/mobile-cta-clearance-20260529` → `main` fast-forward merge. 회원탈퇴 step 2 `기타` 항목이 `이전`/`계속 진행하기` fixed CTA에 가리던 문제를 공통 `app-fixed-bottom-cta-clearance`로 해결. 동일 위험 패턴 `/credits`, `/dialogue/appointment`, `/reset-password`, `/compatibility/input`까지 전수 반영. Mobile 390px smoke에서 overlap false 확인. Vercel prod `dpl_6pyMyLKKRWZCLjdu4shrWywBF1QR`, alias `https://ganjisaju.kr`, smoke `/my/settings/delete-account` 200 · `/credits` 200 · `/dialogue/appointment` 200 |
| 2026-05-28 | **Codex 코인 환불 관리자 플로우 + 모바일 저사양 성능 최적화 + production 배포** | commit `5fc7dcc` | `codex/refund-credit-performance-20260528` → `main` fast-forward merge. 관리자 사용자 상세 코인 환불 가능 섹션, credit lot 잔여량 기반 전액/부분 환불, Toss `cancelAmount`, 코인 회수/감사 기록, `047_credit_refund_workflow.sql` prod 적용 확인 기준 배포. 모바일 `data-performance-mode=lite`로 저사양/모션감소 기기에서 blur/glow/shadow/animation 비용 감쇄, 일반 기기는 기존 디자인 유지. Vercel prod `dpl_M9xfzwD2wzhyYRYnFZrqNM8RmNVN`, alias `https://ganjisaju.kr`, smoke `/today-fortune` 200 · `/credits` 200 · `/admin/users` 307 |
| 2026-05-27 | **Codex 사용자 화면 어휘 전수 정리 + production 배포** | commit `c063bef` | today-fortune 등 사용자-facing copy의 legacy 어휘 제거. `codex/vocabulary-sweep-20260527` → `main` fast-forward merge. Vercel prod `dpl_9oP237RofyDLMjPmh89yuthnKohZ`, alias `https://ganjisaju.kr`, `/today-fortune` HTTP 200. 후속으로 원격/로컬 브랜치 정리 완료 |
| 2026-05-27 | **Codex 결제정책 P0/P1 보완 + 044 prod 적용 + production 배포** | commit `df0a37e` | `/credits` prepare/동의 통합, prepare API 동의 강제, bundle digital-content 동의, credit confirm `paymentKey` DB 멱등성(044), `subscription_30` coin 동의/purchase lot 정정. Supabase prod 044 적용 완료 → Vercel prod `dpl_4ZS9xDLHVpUvdeZiVuh6Z4YTZ2Ec` |
| 2026-05-23 | **사주 풀이 텍스트 품질 전면 정비** | #336/#337/#338/#339/#340 | 상세 풀이 문장 반복·역할/기운 중복 제거(#336) · 키워드 자연화/격국명 과치환/잔존 결/lifetimeRule 중복(#337) · `simplifySajuCopy` 받침 조사 자동정정 normalizer + 전 화면 감사 조사457→0·중복어171→0(#338) · 오행 추상어 cue→표준 "X 기운"(#339) · 균형 문장 자연화 + 궁합 한자 노출/택일 표기 정정(#340). 캐시 마이그레이션 불필요(리포트 매 로드 재빌드) |
| 2026-05-23 | **PDF 저장 화면 (보관형 리포트)** | #334/#335 | 8페이지 A4 리포트 디자인 적용(브라우저 인쇄 · 결정론 데이터+매핑) + 모바일 반응형 화면 + `print-color-adjust` 인쇄 배경 표시 정정 |
| 2026-05-22 | **Codex 상용화 P0 차단 이슈 제거 + clean main 배포** | commit `4ee2484` | 로그인/코인/오늘운세 SSR 문구 정리, 301 canonical redirect, 멤버십 무제한 문구 제거, 예약상담 가격/환불 고지, 결제 동의 단일화, 9개 정책 bundled fallback, 공개 금지 문구 회귀 테스트. 백업 커밋 제외 후 clean branch cherry-pick → Vercel prod `dpl_5qeqzzh9jbzTti3FBzAuJTdS8Dk9` |
| 2026-05-19 | **2026-05-19 9 챕터 LLM 통합 인프라 (chapter prompts + client + enhance + V1\|V2 호환)** | #250/#251/#252/#253/#256 | report-llm-spec.md §2-4 의 9 챕터 system prompt + ChapterMeta/OUTPUT_SPECS + ChapterLLMClient interface (DI) + OpenAIChapterClient (openai-text wrap) + generateChapter (validator 후처리 + 재생성 max 2) + enhanceLifetimeChapter1WithLLM (LifetimeCoreIdentitySection.summary 만 교체) + buildChapter1Input (SajuDataV1\|SajuDataV2 union, narrowOccupation/narrowConcern) |
| 2026-05-19 | **2026-05-19 P0 풀이 엔진 재설계 (chapter-validator + cycle 본문 십성 + 한자/단정 제거)** | #245/#246/#248/#249 | cycleSipsin infra (getCycleSipsin + 5 빌더 시그니처) → 본문 4 빌더 (relationship/wealthCareer/mental/practicalActions) 십성 10 base × status/occupation 4 분기 곱 (9 cycle distinct 10/10/10) → P0 본문 버그 4건 fix (B01 '내 내' regex chain / B05 '커안쪽' word-boundary / B03 timing / B04 종결문 비문) + chapter-validator 6 룰 (한자/X과/영어/단정/cross-chapter/punch-copy) + 빌더 본문 한자 ganzi→한글 + '절대/반드시' 제거 |
| 2026-05-19 | **2026-05-19 ELEMENT_INFO 자연 비유 + formatElementName + B06 헤드라인** | #247/#254/#255 | "X과/와 Y" 5 라벨 → 새싹/햇살/흙/쇠/물 의 결 (ㄹ 받침 통일로 호출처 "이/을" 자연) + ELEMENT_INFO.keyword 도입 + formatElementName .split 제거 + buildHeadline "흙·정인격" → "흙에 정인격" 자연 연결 |
| 2026-05-19 | **2026-05-19 love-question 사주 cross-sell 정리** | #244 | /saju/[slug]/premium + /sample-report 의 TASTE_PRODUCTS 그리드에서 love-question 카드 제거 + MoonlightTasteProduct.compatibilityOnly flag + getTasteProductHref love-question 분기 dead code 제거 |
| 2026-05-18 | **2026-05-18 phase-5e 택일 EmptyState + 4 CTA** | #234 | OPEN. /taekil "결과가 없습니다" → EmptyState + 다시찾기/생년월일/추천날짜/유료 4 CTA |
| 2026-05-18 | **2026-05-18 phase-5d 코인 센터 skeleton + 재시도** | #233 | 잔액 fetch error state + skeleton + inline retry button + 정책/CS 링크 |
| 2026-05-18 | **2026-05-18 phase-5c 로그인 / reset-password skeleton + 고객센터 링크** | #232 | LoginPageFallback (로고/안내/카카오/Google skeleton + disabled) + reset-password skeleton |
| 2026-05-18 | **2026-05-18 phase-5ab 상태 컴포넌트 6 + 미완성 문구 제거** | #231 | LoadingState/EmptyState/ErrorState/RetryButton/SkeletonCard/FeatureUnavailable 6 + membership/lock-screen/search/help/3 loading/홈/알림 10 위치 fix |
| 2026-05-18 | **2026-05-18 legal hub + /terms /privacy 새 패턴 + 푸터 #000** | #230 | /legal?tab={kind} 가로 chip 탭 + 푸터 정책 nav 단축 + #000 강제 + migration 032 seed |
| 2026-05-18 | **2026-05-18 phase-3c-1 결제 동의 체크박스 + recordUserConsent** | #229 | PaymentConsentCheckboxes + prepare API 가드 + recordConsentsForPayment + membership 연결 |
| 2026-05-18 | **2026-05-18 phase-3b 정책 페이지 9개 + DB 버저닝 + admin UI** | #228 | migration 031 (policy_versions + user_policy_consents) + 7 신설 정책 페이지 + /admin/policies |
| 2026-05-18 | **2026-05-18 phase-3a 사업자 정보 env config + production 빌드 가드** | #227 | BUSINESS_INFO 11 필드 + assertProductionBusinessEnv + 푸터/help BusinessInfoCard |
| 2026-05-18 | **2026-05-18 canonical = ganjisaju.kr (apex) 복귀** | #226 | Vercel 정상화 후 directive 원안 복귀. 308 (도메인 정규화 표준) 확정 |
| 2026-05-18 | **2026-05-18 punycode 정규화 보강 (single source of truth)** | #225 | proxy.ts hardcoded → shouldRedirectHost 사용 |
| 2026-05-18 | **2026-05-18 hotfix redirect-loop canonical www 임시 swap** | #224 | ERR_TOO_MANY_REDIRECTS 긴급 — admin override |
| 2026-05-17 | **2026-05-17 fix today-pillar stored calculatedAt → 실제 오늘** | #223 | systematic-debugging — saju vs today-fortune 점수 95/71 mismatch root cause fix |
| 2026-05-17 | **2026-05-17 phase-2 KST 유틸 통합 + UTC drift fix + /api/health/daily** | #222 | src/shared/utils/kst.ts 6 함수 + 21 시나리오 + zodiac/buildTodayFortune raw new Date() fix |
| 2026-05-17 | **2026-05-17 phase-1 도메인 canonical + 브랜드 간지사주 통일** | #221 | SITE_CONFIG + 38 파일 구 브랜드명 → 간지사주 + sitemap/robots canonical |
| 2026-05-17 | **2026-05-17 production-hardening Phase 1 audit + master plan** | #220 | 9 docs/audit/* (production-hardening / route-status / incomplete-ui / legal-required / policy-versioning / product-catalog / qa-readiness / seo-plan / plan) |
| 2026-05-17 | **2026-05-17 audit-business-activity 분기 재실행 1회차** | #219 | 우선순위 등급 변동 0건 |
| 2026-05-17 | **2026-05-17 audit-lifetime-report — 49,000원 회귀 + 환불 정책** | #218 | scripts/audit-lifetime-report.mjs |
| 2026-05-16 | **2026-05-16 lucky-hybrid matrix audit** | #190 | scripts/audit-lucky-hybrid.mjs (5×4×6=120 케이스 매트릭스 CLI) + lucky-package.test.ts 전수 invariant. 행운 패키지 hybrid 룰 (PR #167) 회귀 자동 검출 6번째 도구 추가 |
| 2026-05-16 | **2026-05-16 A7 saju CTA 실시간 entitlement 반영** | #189 | useProductEntitlement 강화 (initialEntitlement + revalidateOnFocus/Visibility) + 4 saju 페이지 hybrid 마이그레이션 (단일 CTA = client wrapper / 복합 = EntitlementRefresher router.refresh). 다른 탭 결제 후 본 탭 자동 갱신 |
| 2026-05-16 | **2026-05-16 Phase 2C 결제 차단 + Node 22 CI fix** | #188 | service_role admin client 로 subscription/lifetime entitlement seed/cleanup + 4 시나리오 E2E. test.describe.configure({mode:'serial'}) 로 race 차단. Playwright workflow Node 22 (WebSocket native). 자동 회귀 검증 시스템 3 세대 |
| 2026-05-16 | **2026-05-16 Phase 2B selector + flow fix** | #187 | saju.spec.ts 의 selector 회귀 (article 중복 카운트) + /today-fortune 결과 페이지 navigation + free user graceful skip. CI 에서 4 시나리오 실제 통과 — Phase 2B 자동 검증 2 세대 실측 가동 |
| 2026-05-16 | **2026-05-16 Phase 2B 사주 인증 E2E** | #186 | hybrid auth fixture (storage state + real login) + 4 회귀 시나리오 spec (6 카드/hero anchor/결제 차단/점수 일치). credentials 미설정 시 자동 skip 으로 CI 안전 |
| 2026-05-16 | **2026-05-16 CI hardening (admin override 종료)** | #185 | `npm ci --legacy-peer-deps` + audit:dead-anchors:strict ci.yml step + playwright.yml workflow. typescript 4.x↔5.x peer-dep 충돌 해소로 PR #176-#184 의 admin override 만성 패턴 종료 |
| 2026-05-16 | **2026-05-16 Playwright smoke E2E** | #184 | 인증 X 페이지 (홈/pricing/membership/compatibility) 자동 검증 5/5 pass. 페이지 진입 깨짐 + console error + dead internal link 자동 차단 |
| 2026-05-16 | **2026-05-16 자동 회귀 검증 시스템 + dailyDelta fix** | #183 | audit-dead-anchors script + score invariant test 도입. PR #181 의 dailyDelta 누락 회귀 자동 검출 + fix (사용자 미보고 회귀를 사전 차단) |
| 2026-05-16 | **2026-05-16 사주 상세 hero anchor fix** | #182 | premium 페이지 hero 카드 3 버튼 (#yearly-chapter-1/2/3) 미존재 anchor → #premium-yearly/monthly/업셀 link 매핑 |
| 2026-05-16 | **2026-05-16 6 영역 카드 통일** | #181 | 사주 메인/상세/운세 페이지 모두 동일 6 카드 (총운/직장·사업운/재물운/애정·연애운/인간관계운/컨디션·건강운). 공유 컴포넌트 SajuAreaCardsSection + compute-saju-area-scores helper |
| 2026-05-16 | **2026-05-16 점수 단일화 완성 (yearly + credits)** | #180 | /saju/[slug]/premium ("상세" 탭) + 코인 결제 후 풀이 텍스트도 iljinScore.totalScore 통일. 모든 사주 화면 overall 1:1 일치 완성 |
| 2026-05-16 | **2026-05-16 OPEN PR 8개 batch 머지** | #168/#169/#170/#171/#172/#173/#174/#175 | 미머지 누적 PR 일괄 반영. site-header 정리, /my/settings + 로그아웃, font 슬림, admin 차트, onboarding carousel, /my 통일 + HeaderLogoutButton, 모바일 시트 4탭, admin payment funnel |
| 2026-05-16 | **2026-05-16 사주↔운세 점수 단일화** | #179 | 사주 페이지 3곳도 iljinScore.totalScore 통일 helper 호출. 두 페이지 overall 1:1 일치 |
| 2026-05-16 | **2026-05-16 결제 중복 차단 + UI 회귀** | #176 / #177 / #178 | UI 회귀 7건, 결제 진입점 9곳 차단, entitlement API + hook |
| 2026-05-15 | 점수 통일 + 사용자 이름 + 행운 hybrid | #165 / #166 / #167 | iljinScore.totalScore single source, profile 이름 주입, hybrid 9 항목 |

production canonical: **https://ganjisaju.kr** (2026-05-18 변경, 영문 ASCII apex)
Vercel 대시보드: https://vercel.com/ganji-sajus-projects/ganji-saju

---

## 9. 2026-05-19 세션 종료 정리 (13 PR + 작업 자료 3건)

### 작업 자료 (untracked)
- `docs/superpowers/bugs/2026-05-19-p0-bug-tracker.json` — P0 6 버그 위치 + 진짜 원인 + 수정 안 추적
- `docs/superpowers/bugs/2026-05-19-naming-migration.md` — ELEMENT_INFO "X과 Y" → 자연 비유 마이그레이션 가이드 + 호출처 7곳 매핑
- `docs/superpowers/plans/2026-05-19-report-llm-spec.md` — 9 챕터 LLM 통합 전체 스펙 (1차~7차 작업 분해)
- `docs/superpowers/plans/2026-05-19-saju-daewoon-narrative-redesign-p0.md` — P0 plan 원본 (PR-A/B/C 분할)

### 미해결 항목 (다음 세션)

**B02 '근' 노출** — 코드 grep 0 매치 (`STEM_TO_KOREAN` 모두 `己: '기'` 정상). 현재 코드에서 재현 불가. 가능성: 캐싱된 옛 버전 / 글꼴 렌더링 / 외부 데이터. **main 배포 (PR #244~256) 후 화면 재확인 → 여전히 보이면 DOM inspector / 페이지 URL 공유 필요**.

**V2 마이그레이션 audit/refactor (선행 필요)** — engine/index.ts 공식 가이드 "새 코드는 가급적 v2". 현재 V1 의존 파일 전수 audit 완료 (2026-05-19, [`audit-reports/2026-05-19-v2-migration-audit.md`](audit-reports/2026-05-19-v2-migration-audit.md)). 총 V1/V2 의존 60 파일 중 V2-2~V2-4 실제 변경 대상 **30 파일** (이미 V2 호환 3 / 엔진 코어·테스트 12+ 제외). 작업 분해:
- **V2-1 (완료, 2026-05-19)**: V1 의존 파일 audit 자료 작성 (코드 변경 0). 각 파일의 V1 사용 형태·라인 위치·위험도·V2-2/3/4 단계 분류 + 권장 PR 분할안 (V2-2 PR A/B/C, V2-3 PR D, V2-4 PR E~H).
- **V2-2**: domain helpers 17 파일 시그니처 `SajuDataV1 \| SajuDataV2` union (함수 본문 변경 0). 라인 변경 ~150. build-report.ts (33 refs) / build-today-fortune.ts (29 refs) / compatibility.ts (16 refs, type 부분) / build-yearly-report.ts (14 refs, type 부분) 가 큰 파일. typecheck/test 회귀 0 예상 (V2 가 V1 super-set 인 subtype 관계).
- **V2-3**: storage layer (`lib/saju/readings.ts` + `lib/saju/report-metadata.ts`) `loadSajuDataV2` 도입. DB row 의 `result_json` envelope 변경 시 롤백 안전성 / 저장 크기 +25~40 KB / row 결정 필요. **위험도 high — 1주일 모니터링 후 V2-4 진행 권장**.
- **V2-4**: production callers 11 파일 (`calculateSajuDataV1` / `normalizeToSajuDataV1` → `loadSajuDataV2`). hot path (`today-fortune/route.ts`, `today-fortune/unlock/route.ts`) 가장 신중. lib utilities (`account.ts`, `notifications.ts`, `profile-personalization.ts`) + verification (`today-fortune-audit.ts`, `kasi-calendar.ts`) + internal builder calls (`build-yearly-report.ts` line 355, `build-fortune-calendar.ts` line 164) 포함.
- **V2-5**: V2 의 SajuModernInterpretation 필드에 LLM 결과 저장 (새 데이터 모델 — 별도 설계). (a) 2-2 LLM 통합과 합쳐서 검토.

**(a) 2-2 LLM 통합 (V2-2~V2-3 후 진행)** — enhanceLifetimeChapter1WithLLM 을 saju-lifetime-service 에 통합 + 실제 OpenAI 호출 활성. 비용 발생 시점 (호출당 ~$0.005). 결정 사항:
- env feature flag (예: `OPENAI_INTERPRET_CHAPTERS=1`) toggle 방식
- 캐싱 전략 (사주 hash + chapterId 키, TTL)
- 비용 모니터링 (console.log vs telemetry)
- 챕터 1 정착 후 4·5 → 2·3·6·7 → 9 synthesis 순 확장

**후속 시각 검증** — 13 PR 머지 후 production 화면에서 확인:
- 5월 카드 "커안쪽 결만" 사라짐 (B05)
- "내 내 사주표" 누적 사라짐 (B01)
- 세운 본문 "챙기세요과/핵심입니다를" 비문 사라짐 (B04)
- 9 대운 카드 본문이 실제로 다르게 보임 (PR-B)
- 사주 결과 헤드라인 "흙에 정인격" 자연 연결 (B06)
- elements/page.tsx 의 자연 비유 라벨 ("쇠의 결" 등)
- "쇠의" 단독 노출 0 (formatElementName fix)

### 13 PR 총 변경량
- ~3,000+ lines (코드 + 테스트 + 작업 자료)
- npm test 65 → 72 (신규 invariant 30+ 케이스)
- typecheck 0 error 유지, vitest spec 64/64 회귀 0

---

## 2026-07-10 세션 — 단일 출생정보 입력 허브 (PR #625)

**배경**: 시니어 사용성 피드백 — "오늘운세·사주 입력창이 각각이라 불편 / 사주 3번 넘기기 불편 / 입력창 너무 많다".

**결과물** (브랜치 `feat/unified-birth-intake-hub`, 15커밋, PR #625, 미머지):
- `/start` 허브 신설: 출생정보 1화면 → `[오늘의 운세][내 사주]` 선택화면. `?next=saju|today` 딥링크는 선택화면 스킵.
- 공유 입력 컴포넌트 `UnifiedIntake`(이름 선택·생년월일·시각·성별·출생지 1화면 + 관심주제 접이식). 세 진입점 공유.
- 사주 3스텝 스와이프 위저드(`saju-intake-page.tsx` 1713줄) 삭제 → 1화면.
- 재입력 제거: 게스트 공용키(`moonlight:birth-profile:last`, 레거시 흡수) + `/api/profile` 프리필. 결과 화면 크로스링크.
- 홈 대표 CTA → `/start`(상품 의도 링크는 보존).

**안전성**: 리졸버/slug/제출 API 불변. 유료 딥링크(`?product=`/`?plan=`→checkout) 순수 빌더+스펙으로 복원. 퍼널 이벤트 3종 공유 지점 재발화. 하이드레이션 초기 read→effect 이동.

**검증**: tsc 클린 · next build 성공 · 커스텀 172/172 · vitest 144/144 · e2e(unified-intake) 통과. 최종 전체 리뷰(opus) = 머지 가능(Critical/데이터손실 0).

**프로세스**: brainstorming→writing-plans→격리 워크트리→subagent-driven(태스크별 구현+독립 리뷰, 최종 전체 리뷰). 리뷰가 잡은 실회귀 3건(유료 딥링크 유실·counselorId 폴백·하이드레이션) 수정.

**후속(비차단)**: 체크박스/버튼 스타일 정합, 죽은 birth-info-stepper 정리, 홈 애널리틱스 라벨, time-rule 허브 편집(의도적 생략). DB 마이그레이션 없음.

---

## 2026-07-10 세션 — 보관함 오늘운세 다시보기 (PR #627·#629) + main E2E red 복구 (PR #628·#630)

### PR #627 — 보관함 '오늘운세 다시보기' 결정론적 재현

**문제**: 무료 오늘운세는 결과를 저장하지 않고 `readings` 행만 남겼다. 그 행은 사주 풀이와 공유되고 날짜 정보도 없어, 보관함 '다시보기'가 `/saju/{id}` 로 새어 사주 화면을 열고 총평 LLM 을 재실행했다.

**해법**: 결과 본문 대신 **재현 입력만** 저장하는 경량 실행기록. `buildTodayFortuneFreeResult` 는 `(input, sajuData, options)` 고정 시 결정론적(LLM·난수 없음)이므로, 유일한 암묵 입력 `now` 를 `generated_at` 앵커로 남겨 그날의 일진을 그대로 재계산한다. 본문 스냅샷을 안 남기므로 빌더 개선 시 과거 결과가 낡은 포맷으로 굳지 않는다.

- migration **069**: `today_fortune_runs` (RLS 본인 SELECT·service 쓰기, `(user, session, 날짜, 고민)` 유니크로 최초 `generated_at` 보존)
- `lib/today-fortune/run-log.ts`: record/list/get. 조회는 테이블 부재 시 빈 값, 기록은 비차단 try/catch → **069 미적용 상태에서도 앱은 안 깨지고 기능만 잠잠**
- `api/today-fortune`: 요청 시작 시각을 `now` 로 한 번만 고정해 두 빌더에 동일 주입(자정 경계 미세 어긋남도 제거)
- `/today-fortune/runs/[id]`: `generated_at` 을 `now` 로 재계산하는 읽기 전용 재현 페이지
- 재현 뷰: 결정론 본문만. 프리미엄 언락 CTA·푸시 prompt·피드백 카드 제외(과거 날짜에서 오늘 상세를 결제하는 경로 차단)
- 보관함: '오늘의 운세' 항목 추가. 같은 날 유료 스냅샷 있으면 숨김, 무료 항목엔 PAID 배지·후기 버튼 미노출

**⚠️ migration 069 수동 적용 필요** (`create table if not exists` 계열이라 재실행 안전).

### PR #628 — main Playwright E2E red 복구 (#625 선행 회귀)

`#625` 가 `/today-fortune` 의 `BirthInfoStepper` → `UnifiedIntake(intent="today")` 로 교체하면서 제출 CTA 가 `무료 결과 보기` → `오늘 운세 보기` 로 바뀌었는데 e2e 셀렉터는 옛 문구를 잡고 있었다. **main E2E 는 #625 머지 이후 계속 red**(마지막 green 은 #624). `#627` 의 CI 실패도 이 선행 회귀였고 #627 코드 탓이 아니었다.

- 근본원인 확정 절차: 렌더 출력 검증(`curl /today-fortune` → `오늘 운세 보기` 1건, `무료 결과 보기` 0건) + main E2E 이력 대조(green→red 전환점 = #625)
- `무료 결과 보기` 는 이제 아무도 import 하지 않는 `birth-info-stepper.tsx` 에만 잔존 → **죽은 컴포넌트 정리는 여전히 후속 과제**
- 제품 코드 변경 0, 셀렉터 문구 1곳만 갱신

**교훈**: UI 카피를 바꾸는 PR 은 e2e 셀렉터 grep 을 동반해야 한다. CI red 를 "원래 그런 것"으로 넘기면 다음 PR 이 남의 회귀를 뒤집어쓴다.

### PR #629 — 보관함 목록 문구에 생성 시각 표기

migration 069 적용 후 운영 DB 실측에서 드러난 UX 워트. `today_fortune_runs` 유니크 키에 `source_session_id` 가 들어가서 **같은 날·같은 고민이라도 세션이 다르면 별도 행**이 된다(실제로 2026-07-10 하루에 `standard` / `trueSolarTime` 두 행). 목록 문구가 날짜만 써서 제목이 똑같은 '오늘의 운세' 항목 두 개가 구분되지 않았다.

- `buildTodayFortuneRunSummary(occurredOn, generatedAt)` → `2026-07-10 오후 2시 52분에 본 오늘운세 무료 풀이`
- 0시·12시는 `12시`(자정을 `0시` 로 쓰면 어색), 0분은 생략, `generatedAt` 무효 시 날짜-only 폴백
- 기존 `getKstParts` 재사용(새 포맷 유틸 안 만듦)
- TDD: `run-log.test.ts` 4 케이스 red 확인 후 구현. 커스텀 176 pass · vitest 144/144 · tsc 클린

### migration 069 — 적용 완료 (2026-07-10)

운영 DB 실측 검증: 13 컬럼 · RLS on · 본인 SELECT 정책 1 · 인덱스 3. 배포 직후 실행기록이 정상 적재됐고, `generated_at`(요청 시작) < `created_at`(INSERT) 형태 확인 — 재현 앵커가 저장 시점이 아니라 요청 시점으로 박혔다는 뜻.

### PR #630 — 죽은 birth-info-stepper 제거 + 가드/감사 참조 이전

#625 이후 `BirthInfoStepper`(288줄)는 아무도 import 하지 않았다. 무해하지 않았다 — **#628 의 원인이 이 파일**이었다. e2e 가 죽은 컴포넌트의 옛 CTA(`무료 결과 보기`)를 잡고 있었고, grep 하면 "코드에 존재"로 나와 원인 파악이 늦어졌다.

단순 삭제가 아니라 참조 두 곳을 후속 표면으로 **이전**(그냥 지우면 구멍):
- `public-commercialization-copy.test.ts` 금지문구 스캔 대상 → `features/unified-intake/unified-intake.tsx` (삭제 **전에** 새 대상이 가드 통과함을 먼저 확인)
- `profile-linkage-audit.ts` today-fortune `sourceRefs` → `unified-intake.tsx` + `submit-today.ts`. `detail` 의 '불러오기 버튼' 서술도 실제 동작(자동 프리필)로 교정 — 이 문자열은 `/verification` 에 그대로 노출된다.
- 삭제 파일을 줄번호까지 인용하던 주석 5곳 정리. `CompactBirthFields` 는 궁합·프로필 관리자가 써서 유지.

검증: tsc 클린 · next build 성공 · 커스텀 172 · vitest 144/144 · 렌더 확인(`/today-fortune` CTA 유지, `/start` 200).

### 최종 확인 (2026-07-10)

보관함 화면 육안 확인 완료 — '오늘의 운세' 항목 정상 노출, 시각 표기로 같은 날 항목 구분됨. 로그인 게이트라 자동 검증이 못 미치던 구간이었고, 이로써 #627·#629 의 사용자 경로가 실제로 닫혔다.

### 후속
- `docs/audit/incomplete-ui-inventory.md` 등 문서의 birth-info-stepper 참조는 **시점 기록**이라 의도적으로 유지

---

## 2026-07-10 세션 — 결제 전수 진단 (PR #631·#632·#633)

**발단**: "무료 오늘운세가 너무 잘 나와서 결제를 안 하는 것 같다. 블러 처리하고 결제 팝업을 띄우면 어떨까?"

**데이터가 가설을 뒤집었다.** 운영 DB 실측:

| 항목 | 값 |
|---|---|
| `payment_orders` | 24건, `paid` **0건**, 누적 매출 **0원** |
| `payment_failed` 4건 | 전부 `last_error = "사용자 정보가 존재하지 않습니다."` (2026-06-27 19:25~20:23 KST) |
| 최근 7일 | 방문 2,540건 · 가입 **0** · 결제 시도 **1** · 결제 성공 **0** |

퍼널은 무료 콘텐츠가 아니라 **가입·진입**에서 무너진다. 페이월을 조이는 결정은 (a) 결제가 한 번도 성공한 적 없고 (b) 효과를 측정할 표본이 없어 지금 내릴 수 없다. 전체 분석 → [`docs/proposals/2026-07-10-today-fortune-paywall-and-payment-diagnosis.md`](docs/proposals/2026-07-10-today-fortune-paywall-and-payment-diagnosis.md)

⚠️ `metrics_daily.visitors` 는 `page_views` 와 항상 같다 — **고유 방문자가 아니라 방문 행 수**다. 방문 기록은 2026-07-04부터만 존재.

### 근본원인 — 06-27 승인 실패

`nicepay-env.getNicepayClientKey()` 와 `nicepay.getSecretKey()` 가 모드별 키가 없으면 **각각 독립적으로** 공용 키로 폴백한다 → `live clientKey + 공용(샌드박스) secretKey` 같은 짝이 조용히 만들어지고, 나이스페이는 그 Basic 인가를 "사용자 정보가 존재하지 않습니다." 로 거절한다. 같은 날 **18:06 #506(모드별 키 이름 도입)** 직후 1시간에만 실패가 몰린 것과 정합적이다. 이후 env 를 채우자 실패가 멎었다.

**PR #631** — 추측으로 고치지 않고 증거를 얻는 도구:
- `nicepay-config-audit.ts` — 키 출처(`mode`/`fallback`/`missing`)·접두사(`R2_`=live, `S2_`=sandbox)·`NICEPAY_API_BASE` 의 모드 덮어쓰기 감사. secretKey 값 미노출(길이만)
- `probeNicepayCredentials()` — 존재하지 않는 tid 조회 1회로 **실결제 없이** Basic 인가 유효성 판별
- `GET /api/admin/payments/nicepay-health` (super_admin 전용)

**프로덕션 실측 결과**: `audit.ok=true`, `problems=[]`, probe `resultCode=U120`("TID가 유효하지 않습니다") → **인가는 정상**. 즉 지금 결제는 깨져 있지 않다.

### 실결제 검증에서 잡은 진짜 버그 — PR #632

서비스 **첫 성공 결제**(2026-07-10 17:29, `taste_score_total` 9,900원)로 승인·지급을 증명했고, PG 취소로 환불까지 확인했다. 그런데:

```
17:29:39  score-total 이용권 지급
17:31:03  나이스페이 취소 통보 → 주문 canceled
이후      product_entitlements 행이 그대로 남음 → 환불 후에도 유료 콘텐츠 열람 가능
```

`webhook/nicepay` 의 회수 분기가 `pkg.credits > 0` 였다. `score-total`·`today-detail`·`year-core`·`lifetime` 은 `credits=0` 이라 걸리지 않는다. `revokeProductEntitlement` 는 `/api/admin/refund` 에서만 호출됐다 → **PG·카드사 취소 시 돈은 돌려주고 상품은 영구히 남는다.**

수정: 회수를 패키지 정의가 아니라 **실제 지급 기록**(`order_id` 로 열거)에 맞춘다. 번들이면 구성품 전부. 순수 함수 `buildCancellationRevokePlan()` + `listProductEntitlementsByOrder()`. 테스트 7 케이스 TDD.

(테스트로 남은 이용권 1건은 운영 DB 에서 제거 — 16 → 15)

### 조용히 새지 않게 — PR #633

06-27 실패는 결제창이 멀쩡히 뜨고 **사용자가 카드정보를 다 넣은 마지막 단계**에서 났다. 한 시간 동안 아무도 몰랐다. `prepare` 에서 `auditNicepayKeyPair()` 를 돌려 짝이 깨졌으면 주문 생성 전에 503 + `prepare_blocked(reason=nicepay_key_pair_invalid)`. `prepare_attempt` **뒤**에 둬서 `blocked ⊆ attempt` 불변식 유지(#593 교훈). 구 단일키 구성은 양쪽 출처가 같아 계속 통과.

---

## 2026-07-10 세션 — 지표 계측 복구 (PR #634·#635)

**발단**: "가입 병목을 보자"(방문 2,540건 / 가입 0명). 파보니 **병목이 아니라 지표가 얼어 있었다.**

### PR #634 — canonical 301 이 **모든 Vercel 크론**을 막고 있었다

Vercel Cron 은 프로덕션 배포의 `*.vercel.app` URL 로 핸들러를 호출한다. `proxy.ts` 의 canonical redirect 가 그 호스트를 **301** 로 `ganjisaju.kr` 에 튕겼고(`site.ts` `shouldRedirectHost`), 크론은 리다이렉트를 따라가지 않는다. → `CRON_SECRET` 을 검사하는 핸들러에 **도달조차 못 했다.**

프로덕션 로그 실측:
```
11:00:10 GET /api/admin/users/summary/refresh  301
11:10:04 GET /api/admin/metrics/rollup         301
11:00:25 GET /api/payments/reconcile           301
```

**영향**: 알림 발송(6회/일) · 결제 대사 · 지표 롤업 · 가입자 요약 갱신 · 멱등성 감사 **전부 사망**.

`admin_user_summary` 가 2026-07-07 06:52 이후 정지 → 거기서 파생되는 `metrics_daily.new_signups` 가 얼어붙어 **"최근 7일 가입 0명"이라는 거짓 지표**를 만들었다(`auth.users` 직접 조회 시 07-08 가입 1명). 지금까지 지표가 갱신된 건 super_admin 콘솔 **수동 트리거**였고, 그 운영 관행 자체가 이 버그의 우회책이었다.

**수정**: `/api/*` 를 canonical redirect 에서 제외(`isCanonicalRedirectExemptPath`). API 는 SEO 정규화 대상이 아니고 크론/웹훅은 각자 `CRON_SECRET`·서명으로 보호된다. 페이지 정규화(www·punycode·apex)는 유지.

**배포 후 실측**: `.vercel.app` 의 `/api/admin/metrics/rollup` 이 **301 → 401**(핸들러 도달, 시크릿 없어 거부). `/`·`/today-fortune` 은 여전히 301, `ganjisaju.kr` 200. 부수 발견: `/api/notifications/dispatch` 는 401이 아니라 **503** — 웹푸시 VAPID env 미설정이라 크론이 살아나도 알림은 안 나간다(별건).

### PR #635 — 방문 지표가 크롤러를 사람으로 세고 있었다

`site_visits` 2,540행이 전부 서로 다른 `vid` 에 `page_views=1`, 진입 경로가 `/zodiac`·`/star-sign`·`/dialogue` 각 57, `/help`·`/support/faq` 각 56 으로 균일. 런타임 로그도 6시간 동안 페이지마다 55~139회 균등. 사이트맵 스윕이다.

`shouldSkipVisitAnalytics` 는 admin 경로·프리뷰 호스트·제외 IP 만 걸렀다 → JS 실행 크롤러는 그대로 집계. `isBotUserAgent()` 추가(서버 `/api/visit` 에서만 검사, 클라 `VisitPing` 은 UA 미전달 → 기존 동작 불변).

**⚠️ 오탐이 치명적**: 인스타 유입 223건이 현재 유일하게 식별되는 사람 유입이다. 실제 UA 문자열로 실행해 확인 — 인스타·카카오·네이버 인앱은 HUMAN, Googlebot·HeadlessChrome·GPTBot·ClaudeBot·빈 UA 는 BOT.

기존 2,540행은 **소급 삭제하지 않았다**(과거 비교가 깨진다). 필터 적용 후 며칠치로 실제 사람 트래픽 규모를 다시 잰다.

### "가입 병목"은 없었다

가입은 결제·MY 화면에서만 요구된다. 무료 풀이는 게스트로 가능(2026-07-10 생성 37건 중 31건 게스트). 결제 퍼널에 `prepare_blocked(reason=unauthenticated)` **0건** — 아무도 로그인 벽에 부딪힌 적이 없다. **결제 버튼 자체를 안 누른다.** 방문→가입 전환이 낮은 게 아니라, 가입할 이유가 결제 직전에만 생기는 설계다.

---

## 2026-07-10 세션 — 결제·지표 조사 종합 후속

**결제**
- **`webhook/toss` 에는 취소 회수 로직이 아예 없다.** 현재 PG 가 나이스페이라 실노출 0이지만 PG 되돌리면 같은 사고(#632 와 동일 유형).
- **`NICEPAY_API_BASE` 제거 권고** — 모드를 무시하고 덮어쓰는 지뢰(#506 단일 토글 설계를 깬다). 제거 전까지는 `api_base_mode_mismatch` 가 방어(#633).
- `nicepay-checkout.ts:10` SDK URL 이 라이브 하드코딩 — 샌드박스 모드에서도 라이브 JS 로드.

**계측**
- `/api/notifications/dispatch` 는 크론 복구 후에도 **503**(웹푸시 VAPID env 미설정). 알림은 여전히 안 나간다.
- 클라이언트 퍼널(`premium_teaser_viewed`→`unlock_clicked`)과 서버 퍼널(`payment_funnel_events`)이 조인되지 않아 **무료 조회 대비 결제 전환율을 계산할 수 없다.**
- 봇 필터 적용 후 며칠치 숫자로 **실제 사람 트래픽 규모**를 다시 잰다(기존 2,540행은 소급 삭제 안 함).

**페이월 (순서 주의)**
결제 수리 ✅ → 계측 복구 ✅ → **측정 연결** → 그다음 페이월. 무료를 깎지 말고 **지금 안 보이는 유료 증분을 블러로 드러내는** 방향(제안서 §4). 점수 산출내역은 유료로 잠그지 말고 숫자 합산식만 기본 접힘(§5).
