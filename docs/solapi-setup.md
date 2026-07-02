# Solapi(솔라피) 설정 가이드 — 간지사주 알림톡/친구톡

> 2026-07-02. 이 앱에 이미 구현된 발송 코드(`src/lib/kakao/*`, `src/app/api/kakao/*`)를
> **실제로 켜기 위한** Solapi 콘솔 + 환경변수 설정. 코드가 기대하는 값과 1:1로 맞춘다.
> 전제: 카카오 비즈니스 채널은 이미 전환됨.

---

## 0. 코드가 기대하는 것 (요약)

| 항목 | 코드 위치 | 값 |
|---|---|---|
| 인증 | `lib/kakao/vendor.ts` | Solapi HMAC-SHA256 (apiKey+secret) |
| 발신프로필 | `kakaoOptions.pfId` | `SOLAPI_KAKAO_PFID` |
| 알림톡 템플릿 | `kakaoOptions.templateId` | `KAKAO_TPL_PAYMENT_COMPLETE` / `KAKAO_TPL_SUBSCRIPTION_EXPIRING` |
| 결제완료 변수 | `payments/confirm/route.ts` | `#{product}`, `#{amount}` |
| 구독만료 변수 | `api/kakao/dispatch/route.ts` | `#{plan}`, `#{when}`(값: "오늘" 또는 "3일 뒤") |
| SMS 대체 발신번호 | `kakaoConfig.sender` | `SOLAPI_SENDER` |
| 발송결과 webhook | `api/kakao/webhook` | `x-webhook-secret` = `SOLAPI_WEBHOOK_SECRET` |
| cron 인증 | `dispatch`·`friendtalk-dispatch` | `Authorization: Bearer <KAKAO_CRON_SECRET>` |

**핵심:** 키·발신프로필·템플릿ID가 모두 채워지기 전엔 발송 코드는 **완전 dormant**(no-op). 순서대로 채우면 켜진다.

---

## 1. Solapi 가입 + 사업자 인증
1. https://solapi.com 회원가입.
2. **사업자 인증**(사업자등록증) — 알림톡·발신번호에 필수. 심사 영업일 1~2일.
3. 콘솔 로그인.

## 2. 카카오 채널 연동 → 발신프로필(pfId) 발급
1. 콘솔 → **카카오 → 채널 연동(플러스친구/채널 등록)**.
2. 간지사주 **카카오 비즈니스 채널**을 검색/연결. 채널 관리자 인증(카카오톡 채널 관리자센터에서 토큰/권한).
3. 연동 완료 시 **발신프로필 키(pfId)** 발급 → `SOLAPI_KAKAO_PFID` 에 넣을 값.
   - 형태 예: `KA01PF...` 문자열.

## 3. 발신번호 등록 (SMS 대체발송용)
1. 콘솔 → **발신번호 등록** → 사업자 명의 번호 인증(ARS 또는 서류).
2. 등록된 번호를 **하이픈 없이**(예: `0212345678`) → `SOLAPI_SENDER`.
3. 알림톡 실패 시 SMS 대체발송에 사용(코드에서 기본 `disableSms:true` — 필요 시 `enableSmsFallback` 로 켬).

## 4. API Key 발급
1. 콘솔 → **개발/연동 → API Key 관리 → 새 API Key**.
2. **API Key** → `SOLAPI_API_KEY`, **API Secret** → `SOLAPI_API_SECRET`.
   - ⚠️ Secret 은 발급 시 1회만 노출 → 즉시 안전한 곳에 복사(Vercel 에 바로 입력).

## 5. 알림톡 템플릿 등록 + 심의 ★가장 오래 걸림
알림톡은 **정보성**만 가능하고 **카카오 심의 승인**을 받아야 발송된다. 콘솔 → **카카오 → 알림톡 템플릿 → 새 템플릿**.

변수는 반드시 **코드가 보내는 이름**과 일치시킬 것(`#{...}`).

### 5-1. 결제완료 (변수: `#{product}`, `#{amount}`)
```
[간지사주] 결제가 완료되었습니다.

상품: #{product}
결제금액: #{amount}

마이페이지 > 결제내역에서 확인하실 수 있습니다.
```
- 버튼(선택): "결제내역 보기" → `https://ganjisaju.kr/my/billing`
- 승인되면 발급되는 **템플릿 ID** → `KAKAO_TPL_PAYMENT_COMPLETE`.

### 5-2. 구독 만료 임박 (변수: `#{plan}`, `#{when}`)
```
[간지사주] 멤버십 만료 안내

#{plan} 멤버십이 #{when} 만료됩니다.
연장하시면 이용 중인 혜택이 계속 유지됩니다.

마이페이지 > 멤버십에서 확인하실 수 있습니다.
```
- 코드가 `#{when}` 에 D-3="3일 뒤", D-day="오늘" 을 넣음 → "오늘 만료 / 3일 뒤 만료"로 자연스럽게 표시.
- `#{when}` 심의 예시값: `3일 뒤`
- 버튼(선택): "멤버십 연장" → `https://ganjisaju.kr/membership`
- 승인 템플릿 ID → `KAKAO_TPL_SUBSCRIPTION_EXPIRING`.

> 심의 반려 흔한 사유: 광고성 표현("이벤트","할인","지금 신청") 포함, 링크 과다,
> 변수만으로 구성. 정보성·거래 고지 톤으로 작성.

## 6. 잔액 충전
콘솔 → **캐시 충전**. 알림톡 건당 대략 8~15원(+SMS 대체 시 별도). 테스트/초기 소액이면 충분.

## 7. 발송결과 webhook 설정
콘솔 → **개발/연동 → Webhook(이벤트 알림)** 에서 발송결과 수신 URL 등록:
- URL: `https://ganjisaju.kr/api/kakao/webhook`
- 우리 코드는 **`x-webhook-secret` 헤더 == `SOLAPI_WEBHOOK_SECRET`** 를 검증(미설정/불일치면 거부).
- ⚠️ **Solapi Webhook 이 커스텀 헤더를 지원하지 않으면** 이 방식이 안 맞을 수 있음.
  그 경우 (a) URL 쿼리 토큰 방식(`/api/kakao/webhook?token=...`)으로 바꾸거나
  (b) Solapi 서명검증으로 교체 필요 → **webhook 라우트 한 파일만 조정**하면 됨(요청 주면 맞춰줌).
- webhook 없이도 발송은 됨(발송 직후 status='sent'). webhook 은 최종 전달결과 갱신용.

## 8. Vercel 환경변수 (전체)
Vercel → 프로젝트 → Settings → Environment Variables (Production/Preview 권장):

| 변수 | 값 출처 |
|---|---|
| `SOLAPI_API_KEY` | 4단계 API Key |
| `SOLAPI_API_SECRET` | 4단계 API Secret |
| `SOLAPI_KAKAO_PFID` | 2단계 발신프로필 |
| `SOLAPI_SENDER` | 3단계 발신번호(하이픈 없이) |
| `SOLAPI_WEBHOOK_SECRET` | **직접 생성**한 랜덤 문자열(7단계 Solapi 에도 동일 입력) |
| `KAKAO_TPL_PAYMENT_COMPLETE` | 5-1 승인 템플릿 ID |
| `KAKAO_TPL_SUBSCRIPTION_EXPIRING` | 5-2 승인 템플릿 ID |
| `KAKAO_CRON_SECRET` | **직접 생성**한 랜덤 문자열(9단계 cron 헤더에도 동일) |
| `NEXT_PUBLIC_KAKAO_CHANNEL_ID` | 카카오 채널 공개 ID(`_xxxxx`) — 채널추가 버튼용(선택) |

- 랜덤 시크릿 생성 예: `openssl rand -hex 32`
- 입력 후 **재배포**해야 반영.

## 9. Vercel Cron 등록
`vercel.json` 의 `crons` 에 추가(또는 대시보드 Cron):
```json
{
  "crons": [
    { "path": "/api/kakao/dispatch", "schedule": "0 1 * * *" },
    { "path": "/api/kakao/friendtalk-dispatch", "schedule": "0 5 * * *" }
  ]
}
```
- 시간은 **UTC** 기준. 위 예: dispatch = 매일 UTC 01:00 = KST 10:00(구독 만료 고지),
  friendtalk = UTC 05:00 = KST 14:00(광고, 야간 아님 — 코드가 21~08 KST 자동 차단).
- ⚠️ Vercel Cron 은 헤더를 커스텀할 수 없어 기본적으로 `Authorization` 없이 호출됨.
  우리 라우트는 `Bearer <KAKAO_CRON_SECRET>` 또는 `x-kakao-secret` 를 요구 → **Vercel Cron 은
  자체적으로 `Authorization: Bearer <CRON_SECRET>`(프로젝트 CRON_SECRET)를 붙여줌**. 따라서
  `KAKAO_CRON_SECRET` 대신 **기존 `CRON_SECRET` 을 그대로 쓰면**(코드가 `KAKAO_CRON_SECRET ?? CRON_SECRET`
  폴백) Vercel Cron 인증이 자동으로 통과된다. → **별도 KAKAO_CRON_SECRET 안 넣어도 됨.**

## 10. 테스트 순서
1. **DB**: `supabase db push` 로 `059_kakao_messaging.sql` 적용(필수 — 없으면 전화번호 저장 불가).
2. 마이페이지 설정에서 **본인 번호 입력·저장** → `user_contact` 에 행 생성 확인.
3. **결제완료 테스트**: 실제(또는 테스트) 결제 1건 → confirm 후 알림톡 수신 확인.
   - 안 오면: Vercel 로그에서 `after()` 실행 여부, `kakao_message_log` 의 status/error 확인.
4. **구독만료 테스트**: `curl -X POST https://ganjisaju.kr/api/kakao/dispatch -H "Authorization: Bearer <CRON_SECRET>"`
   → 응답 `{sent, skipped, failed}` 확인.
5. `kakao_message_log` 에서 status 흐름(queued→sent) + webhook 갱신 확인.

## 11. 친구톡(광고) 추가 설정
- 친구톡은 **채널 친구**에게만 도달 → 사용자가 마이페이지의 **"카카오 채널 추가"** 버튼으로 친구 등록
  (`NEXT_PUBLIC_KAKAO_CHANNEL_ID` 설정 시 노출).
- 발송 대상 = `user_contact.ad_consent=true` + 채널 친구. 코드가 (광고)·무료수신거부·야간가드 자동 처리.
- 친구톡은 별도 템플릿 심의 불필요(자유 텍스트)하나, Solapi/카카오 광고 정책 준수 필요.
- `api/kakao/friendtalk-dispatch` 가 매일(주간 권장) 광고동의자에게 발송.

## 12. 트러블슈팅 / go-live 체크
- **모든 발송이 `not_configured`**: `SOLAPI_API_KEY/SECRET/KAKAO_PFID` 중 누락 → env 확인 + 재배포.
- **`no_phone`**: 대상 유저가 번호 미등록.
- **`no_ad_consent`**(친구톡): 광고 동의 안 함.
- **알림톡 반려/실패**: 템플릿 미승인 또는 `templateId`(env) 불일치, 변수명 불일치.
- **⚠️ Solapi API 필드명 재확인(go-live 전 1회)**: `vendor.ts` 의
  `kakaoOptions.templateId`/`pfId`/`disableSms`/`adFlag`, 응답 `messageId`,
  HMAC salt 길이(12~64자) 를 Solapi **현행 v4 문서**와 대조. 다르면 `vendor.ts` 한 파일만 수정.
- **webhook 401/503**: `SOLAPI_WEBHOOK_SECRET` 미설정(=503, 의도된 fail-closed) 또는 헤더 불일치.
  Solapi webhook 커스텀 헤더 미지원이면 7단계 대안으로 전환.

---

### 정리 — 최소로 알림톡부터 켜는 5단계
1. `supabase db push`(059) + 정책 DB 갱신
2. Solapi: 채널연동(pfId) + 발신번호 + API Key + **결제완료 템플릿 1개 승인**
3. Vercel env: `SOLAPI_API_KEY/SECRET/KAKAO_PFID/SENDER` + `KAKAO_TPL_PAYMENT_COMPLETE` → 재배포
4. 본인 번호 저장 → 테스트 결제 → 수신 확인
5. 이후 구독만료 템플릿·webhook·친구톡·cron 순차 확장
