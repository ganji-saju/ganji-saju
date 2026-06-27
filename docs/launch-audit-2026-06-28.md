# 라이브 판매 직전 전수 감사 (2026-06-28)

> 나이스페이 실결제(live) 개시 직전, 5개 심층 감사(읽기전용 병렬) + 자동 게이트(tsc·vitest).
> 자동 게이트: **tsc 0 에러 / vitest 65 passed (5 files)**. ✅

감사 영역: ① 결제·체크아웃 end-to-end ② 법무·환불·가격정합 ③ 깨진링크·미구현·빈상태 ④ 모바일·반응형 ⑤ 보안·인증·시크릿.

---

## 0. 이번 PR 에서 코드로 고친 것

| # | 등급 | 항목 | 파일 | 조치 |
|---|---|---|---|---|
| 1 | P1 | '가문 선생'(family-report 미구현) 카드가 '출시 예정'인데 클릭 시 `/saju/new?product=family-report`(무효 product)로 빠져 광고한 기능이 동작 안 함 | `specialist-mentor-grid.tsx` | '출시 예정' 카드는 **비클릭 라벨('준비 중')**로 렌더 |
| 2 | P1(법무) | 과장/단정 카피 "내 운명 확인"(소비자보호 리스크) | `gangi-market.ts:97·99` | "내 **사주 풀이**"로 변경 |

---

## 1. 거짓 양성(오탐) — 조치 불필요, 기록만

| 주장(에이전트) | 실측 결과 |
|---|---|
| `.env.local`이 git에 커밋됨 → 시크릿 노출, history purge 필요 | **오탐**. `.gitignore` 가 `.env`·`.env.*`·`.env*.local` 모두 무시(37~51행) → 미커밋. 로컬 dev 파일을 노출로 오인. |
| bundle_today_set 가격 불일치(9,900 vs 19,800) | **오탐**. 화면 렌더·청구 모두 `displayPrice`=`paymentPackage.price`=**19,800**(checkout 356·373·523·530행). BUNDLE_GUIDE의 9,900은 paymentPackage 있으면 미사용(죽은 값). |
| 나이스페이 ediDate(ISO)·signData 포맷 의심 → 승인 실패 위험 | **무효**. 실결제 live E2E 성공(결제완료→사주풀이) = 포맷 경험적 검증됨. |
| 결제후 라우팅 nicepay/toss 분기 불일치 | **이미 수정(#512)**. order.product 1순위 + buildPurchasedProductHref 폴백으로 통일. |
| score-total/score-factor/compat-reading client requiresSlug 검증 누락(P0) | **P2 강등**. 셋 다 catalog `requiresSlug:true`(141·151·162) → checkout 페이지 `needsResultFirst` 가드(299행)가 이미 차단. client handlePayment 목록은 보조 중복(무해). |

---

## 2. 남은 실제 항목 — 우선순위별

### P0 (런치 차단) — **없음 (코드)**
자동 게이트 green + 위 2건 수정 후, 코드 레벨 차단 이슈 없음. 단 아래 **운영(env/DB) 확인**은 필수.

### P0 (운영 확인 — 사용자 액션)
- [ ] **Vercel Production env: 사업자 정보 11개**(상호·대표·사업자번호·통신판매업신고·주소·CS연락처/이메일/시간·개인정보책임자 3종). `assertProductionBusinessEnv()` 가 누락 시 **빌드 실패**시키므로, **현재 사이트가 떠 있으면 충족**된 것. 표시값 1회 육안 확인 권장. (통신판매업: 제2025-서울중랑-1862호 — env 입력됨)
- [ ] **DB `policy_versions` 본문**: 이용약관/개인정보/**환불·청약철회** 정책 실제 내용이 저장됐는지(빈 정책은 `/legal` 탭에 'PolicyNotReady'로 표시). 결제 전 동의 흐름은 구조적으로 완성(consent-rules.ts, 필수 강제).
- [ ] **나이스페이**: 운영 키 + `NEXT_PUBLIC_NICEPAY_MODE=live` + `NICEPAY_API_BASE` 미설정(MODE 우선 함정) 확인. → [[reference_payment-env-toggle]]

### P1 (런치 후 가까운 시점)
- **나이스페이 취소/입금 웹훅 서명검증 미구현** (`webhook/nicepay/route.ts`): 현재 **나이스페이 재조회 backstop**로 위변조 방어(사기 차단은 충분, 컴플라이언스 미완). 결제 승인 경로(return route)는 서명검증 정상. → 공식 서명규칙으로 웹훅 검증 추가.
- **모바일(디바이스 실측 권장, 코드추론)**: ① 결제 모달 grid 좌/우 고정폭(subpages.css:1993) 356px cramping ② dock clearance `:has()` 미지원 폴백(app-shell.css:366) — 단 `:has()`는 최신 크롬/사파리 지원이라 한국 모바일 위험 낮음. ③ 회원가입 overflow는 #501에서 영구 E2E 게이트로 잠금(재발 시 그 게이트가 red). → **iPhone SE/360px 실기 확인** 후 필요시 조정(런치 직전 무차별 CSS 변경은 회귀 위험이라 지양).
- **환불 idempotencyKey**(admin 환불 경로): `cancelNicepayPayment`는 받는데 `executeRefund`가 생성/전달 안 함 → admin 이 동일 환불 더블클릭 시 중복요청 가능(웹훅 dedup으로 이중지급은 차단되나 PG 호출 중복). admin 전용이라 노출 낮음.

### P2 (개선)
- BUNDLE_GUIDE 죽은 가격값 9,900 → 19,800 정리(현재 미렌더). specialist requiresSlug 보조가드 3종 추가. 모바일 gap/터치타깃 폴리시(0.35→0.5rem, 36→44px 1곳). safe-area-inset 좌우. 검색 빈상태 확인.

---

## 3. 정상 확인된 것 (✓)

- **보안**: admin 라우트/ API 인가(super_admin), CRON_SECRET, IDOR 소유권 검증(readings/credits/family/reviews/confirm), 웹훅 idempotency(event_hash unique), NEXT_PUBLIC 외 시크릿 서버 격리 — 전부 정상.
- **법무**: 사업자정보 footer, /terms·/privacy·/legal(9탭), 결제 전 필수 동의 강제, PG 안내, 면책문구 — 구조 완성.
- **링크**: href 55개 전부 유효 라우트 매핑, notFound 처리, 결제 실패 페이지, 미구현(락스크린/카카오·이메일 알림/사람상담)은 명시적 '출시 예정' 가드.
- **결제**: catalog 단일 가격소스 → displayPrice/amount 정합, #512 라우팅 수정, 금액·서명 검증(return).

---

## 4. 라이브 직전 최종 체크리스트
```
[코드] ✅ tsc 0 / vitest 65 passed / 가문선생 카드·운명확인 카피 수정 (이 PR)
[운영] ⬜ Vercel Prod 사업자정보 11종 표시 육안확인
[운영] ⬜ DB 환불정책 본문 저장 확인 (/refund-policy·/legal 환불탭 렌더)
[운영] ⬜ 나이스페이 live 키·MODE=live·NICEPAY_API_BASE 미설정 확인
[권장] ⬜ iPhone SE(360px) 결제모달·회원가입·홈 실기 확인
[후속] ⬜ 나이스페이 웹훅 서명검증 / 환불 idempotencyKey
```
