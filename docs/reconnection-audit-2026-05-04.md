# 새 GitHub/Vercel/Supabase 재연동 후 전수 점검 메모

점검일: 2026-05-04

## 결론

새 프로젝트로 옮긴 뒤 가장 큰 리스크는 화면 UI보다 운영 연결값입니다.

- 정식 운영 주소는 `https://ganji-saju.vercel.app`입니다.
- Vercel 자동 배포 주소는 계속 생성되지만, SEO/OAuth/콜백 기준 주소로 쓰면 안 됩니다.
- 신규 로그인 실패의 직접 원인은 Supabase Auth 신규 유저 저장 단계입니다.
- 코인 차감과 소액 상품 이용권은 DB 마이그레이션 적용 여부에 따라 중복 차감/저장 실패가 갈립니다.
- Toss/OpenAI/Web Push/Cron 운영 env가 빠지면 결제, AI 풀이, 알림은 정상 작동하지 않습니다.

## 1. 페이지 그룹별 영향

| 그룹 | 경로 | 새 연동 후 영향 | 조치 상태 |
| --- | --- | --- | --- |
| 홈/무료 진입 | `/`, `/today-fortune`, `/tarot/daily` | Supabase 로그인 상태, 저장/재열람 표시 영향 | 정식 URL fallback 보강 |
| 사주 입력/결과 | `/saju/new`, `/saju/[slug]`, `/saju/[slug]/premium` | 저장, 보관형 리포트 권한, 코인 해금 영향 | DB 마이그레이션 필요 |
| 궁합 | `/compatibility`, `/compatibility/input`, `/compatibility/result` | 로그인 사용자 프로필/소액 상품 권한 영향 | DB 마이그레이션 필요 |
| 마이/계정 | `/my`, `/my/profile`, `/my/results`, `/my/billing` | 로그인 세션과 service role env 영향 | Supabase Auth/DB 적용 필요 |
| 결제 | `/credits`, `/membership`, `/membership/checkout`, `/pricing` | Toss client/secret env 없으면 결제 불가 | Toss env 추가 필요 |
| 알림 | `/notifications`, `/notifications/schedule`, `/notifications/widget` | Web Push/Cron env 없으면 구독/발송 불가 | Push/Cron env 추가 필요 |
| 안내/SEO | `/guide`, `/about-engine`, `/method`, `/sitemap.xml`, `/robots.txt` | 예전 도메인/자동 도메인 노출 가능 | 예전 도메인 교체 및 site URL 정규화 |

## 2. 즉시 반영한 코드 조치

| 파일 | 조치 |
| --- | --- |
| `src/lib/site.ts` | Vercel 자동 도메인을 canonical site URL로 쓰지 않도록 필터링 |
| `src/app/login/page.tsx` | OAuth 시작 시 자동 Vercel 도메인이면 정식 도메인으로 callback 생성 |
| `src/app/api/auth/callback/route.ts` | OAuth callback 후 redirect origin을 정식 도메인으로 보정 |
| `src/app/about-engine/page.tsx` | Open Graph URL을 새 도메인으로 교체 |
| `src/app/method/page.tsx` | Open Graph URL을 새 도메인으로 교체 |
| `src/app/method/[slug]/page.tsx` | JSON-LD와 Open Graph URL을 새 도메인으로 교체 |
| `src/app/api/geo/birth-location/route.ts` | 외부 지역 검색 Referer fallback을 새 도메인으로 교체 |
| `supabase/migrations/017_auth_signup_resilience.sql` | 신규 유저 트리거 실패가 로그인 자체를 막지 않도록 보강 |
| `supabase/migrations/016_product_entitlements.sql` | 소액 상품 카탈로그와 이용권 테이블 제약 동기화 |
| `supabase/migrations/018_product_entitlements_taste_product_check.sql` | 이미 적용된 운영 DB의 product_id 제약 갱신용 마이그레이션 추가 |

## 3. 운영 DB에 반드시 적용해야 하는 마이그레이션

현재 로컬에서 원격 DB 적용을 시도했지만 저장된 DB 접속 정보가 `password authentication failed`로 실패했습니다.

운영 Supabase DB password 또는 올바른 Postgres URL을 확보한 뒤 아래 순서로 적용해야 합니다.

```bash
cd /Users/kionya/ganji-saju
supabase db query -f supabase/migrations/017_auth_signup_resilience.sql --db-url "<SUPABASE_POSTGRES_URL>"
supabase db query -f supabase/migrations/018_product_entitlements_taste_product_check.sql --db-url "<SUPABASE_POSTGRES_URL>"
```

적용 후 확인할 것:

- Google 로그인 후 URL에 `Database error saving new user`가 붙지 않는지
- 로그인 완료 후 헤더가 `로그아웃`으로 바뀌는지
- 신규 유저에게 `user_credits` 3코인이 생성되는지
- `money-pattern`, `work-flow` 소액 상품 결제 후 `product_entitlements` 저장이 실패하지 않는지

## 4. Vercel env 보강 필요 목록

현재 production env 목록 기준으로 보강이 필요한 값입니다.

| env | 없을 때 영향 |
| --- | --- |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 결제창 호출 불가 |
| `TOSS_SECRET_KEY` | 결제 승인 확인 불가 |
| `OPENAI_API_KEY` | AI 풀이 생성 불가 또는 fallback |
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` | 브라우저 푸시 구독 불가 |
| `WEB_PUSH_PRIVATE_KEY` | 서버 푸시 발송 불가 |
| `WEB_PUSH_SUBJECT` | Web Push VAPID 설정 불가 |
| `CRON_SECRET` 또는 `NOTIFICATION_CRON_SECRET` | 알림 dispatch 보호 호출 불가 |
| `KASI_SERVICE_KEY` | 공식 달력 검증 비교 생략 |

## 5. Supabase Dashboard 체크

Authentication 설정:

- Site URL: `https://ganji-saju.vercel.app`
- Redirect URLs:
  - `https://ganji-saju.vercel.app/api/auth/callback`
  - `http://localhost:3000/api/auth/callback`

Google/Kakao provider:

- Provider enabled
- 각 개발자 콘솔의 callback URL이 Supabase OAuth callback URL과 일치
- 앱 내부 callback URL(`/api/auth/callback`)은 Supabase 인증 완료 후 앱으로 돌아오는 주소로만 사용

## 6. 배포 후 QA 순서

1. `/login`에서 Google 로그인
2. 로그인 완료 후 `/`로 돌아와 헤더가 `로그아웃`인지 확인
3. `/my`에서 코인 3개 또는 실제 잔액 확인
4. `/saju/new`에서 결과 생성 후 `/my/results` 저장 여부 확인
5. `/credits`에서 Toss 결제창 호출 확인
6. `/membership/checkout?product=money-pattern`에서 이미 구매 여부/결제 흐름 확인
7. `/today-fortune`과 월간 달력 해금이 중복 차감되지 않는지 확인
