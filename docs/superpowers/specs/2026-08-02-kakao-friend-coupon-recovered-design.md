# 카카오 친구추가 → 오늘 자세히보기 무료 쿠폰 (복구된 설계)

> **출처**: 2026-08-02 09:09 세션(Claude Code 트랜스크립트 `0bb952dd`)에서 확정된 설계.
> 그 세션은 스펙 문서 작성 직전에 다른 작업(오늘운세 비교)으로 전환 후 `/clear` 되어 **파일로 저장된 적이 없었음**. 이 문서는 트랜스크립트에서 복구한 것.
> **상태**: 설계 확정 · 스펙/구현 미착수 · **미구현**(코드/DB 0).

---

## 목표

카카오톡 **채널 친구추가** 시 **오늘 자세히보기(3,300원) 1회 무료 쿠폰**을 발급하고, 결제창에서 그 쿠폰으로 **0원 무료 지급**한다. 계정당 1회, 7일 만료.

## 확정된 결정 (전부 locked)

| 항목 | 결정 |
|---|---|
| 친구추가 감지 | **검증형** — 카카오 `plus_friends` 스코프로 우리 채널(_QVQxbX) 친구여부 API 확인 (신뢰형/자기신고 아님) |
| 쿠폰 내용 | **오늘 자세히보기 3,300원 1개 고정 무료** |
| 사용 한도 | **계정당 1회** (`UNIQUE(user_id, type)`) |
| 유효기간 | **발급 후 7일** (조회 시 계산, 크론 불필요) |
| 발급 흐름 | **전용 '쿠폰 받기' 흐름** — 메인 로그인 스코프는 안 건드림(전환율 보호). 별도 OAuth `/api/auth/kakao/coupon-verify` |
| 사용(redeem) | **0원 직접 지급** — PG(나이스페이)·결제원장 미경유. `grantTasteProductEntitlement(today-detail, amount:0)` + 쿠폰 redeemed 원자적 마킹 |
| 진입점 | **4곳** — 오늘자세히 결제창 · 메인 배너 · 마이/설정 · 사주 결과 하단 |
| 배포 | **`KAKAO_FRIEND_COUPON_ENABLED` env 게이트로 휴면 배포** → 카카오 콘솔 세팅 완료 시 플립(앱 기존 env-gated 패턴) |

## 왜 이 구조인가 (제약)

- 기존 **쿠폰 시스템 없음** → 신규.
- 결제금액은 `order.amount` 스냅샷(prepare 확정, confirm/return 검증)이 authoritative. 결제원장에 **`amount > 0` CHECK**가 있고 PG는 0원 카드결제 불가 → "0원 결제"는 **PG·원장을 안 태우고 이용권 직접 지급**이 정답.
- 카카오 로그인은 **커스텀 OAuth**(스코프 확장 가능). 친구톡 발송 인프라(`src/app/api/kakao/friendtalk-dispatch/route.ts` 등) 이미 존재.

## 설계

### ① 데이터 모델 — `user_coupons` (migration 신규)
- 컬럼: `user_id`, `type='kakao_friend_today_detail'`, `status`(issued·redeemed), `issued_at`, `expires_at`(=발급+7일), `redeemed_at`, `redemption_reading_key`/`entitlement_id`(감사), `verified_kakao_uid`(감사)
- **`UNIQUE(user_id, type)`** → 계정당 1회 강제(발급 멱등)
- "사용 가능" = `status='issued' AND now() < expires_at`
- RLS: 본인 조회만; 발급/사용은 service

### ② 발급 흐름 (검증형)
"카카오 친구추가하고 무료쿠폰 받기" 클릭 →
1. 채널 추가창(기존 `addKakaoChannel`)
2. **`plus_friends` 스코프 카카오 인증**(로그인과 분리된 `/api/auth/kakao/coupon-verify`) → access token
3. 카카오 `GET /v1/api/talk/channels`로 **우리 채널(_QVQxbX) 친구여부 확인**
4. 친구 + 기존 쿠폰 없음 → 발급(멱등). 아니면 "채널 먼저 추가" 안내
- 메인 로그인 스코프 불변

### ③ 사용 흐름 (0원 직접 지급)
`POST /api/coupons/.../redeem { slug, scope }` →
1. 사용가능 쿠폰 로드(없으면 거부)
2. today-detail scope 해석 + reading 소유 검증
3. **원자적**: `grantTasteProductEntitlement(today-detail, amount:0)` + `UPDATE … SET status='redeemed' WHERE status='issued'`(0행=중복사용→중단) → PG·원장 미경유
4. 성공 → 오늘자세히 결과 이동

### ④ 결제창 "0원" UX + 공용 CTA
- 오늘자세히 결제창: 쿠폰 있으면 **"무료 쿠폰 적용 · 3,300원 → 0원"** + "무료로 받기"(redeem 호출; prepare/confirm 아님)
- 공용 `KakaoFriendCouponCTA`: `GET …/status`(발급가능/적용가능/사용완료/만료) → 4곳 렌더

### ⑤ 악용 방지 / 엣지
- 계정당 1회(UNIQUE) + 실제 채널추가 검증(마찰) + 7일 만료 + 사용 원자성
- today-detail = (사람×날) 스코프 → 쿠폰은 한 reading의 오늘자세히 1회 무료
- (선택 하드닝) `verified_kakao_uid`당 1회 → 카카오 1계정 다계정 파밍 차단. v1=계정당 1회 시작

### ⑥ 외부 전제 (⚠️ 블로커 — 코드 밖)
- 카카오 콘솔: `plus_friends` 동의항목 활성 + 채널(_QVQxbX) 앱 연결 + 스코프 승인. **안 되면 검증형 불가.**
- → `KAKAO_FRIEND_COUPON_ENABLED` 휴면 배포 후 세팅 완료 시 플립.

### ⑦ 테스트
- 쿠폰 사용가능 판정(발급+미만료)·사용 원자성(중복 차단)·만료 경계·계정당 1회
- 카카오 channels 응답 파싱(채널 added/미added)
- redeem이 올바른 scope로 today-detail 이용권 지급 + 2차 사용 실패

---

## 미결/후속
- v1에 `verified_kakao_uid` 하드닝 포함 여부
- 배너/CTA 카피
- migration은 supabase CLI **수동 적용**(프로젝트 관례)
- 결제·이용권 인접 기능 → 머니패스 안전성 검증 필수
