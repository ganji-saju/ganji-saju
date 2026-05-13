# 08. Technical Risk Audit — 보안 헤더 · Secret 표면 · 인프라

> 2026-05-13 · 라이브 curl + `.next/static` grep + `.env.example` 키 매핑

---

## 1. 응답 보안 헤더 — 🟠 P1

라이브 측정 (`www.xn--s39at50bo6fmwa.kr` 기준):

| 헤더 | 현재 상태 | 영향 |
|---|---|---|
| `Strict-Transport-Security` | ✅ `max-age=63072000` (2년) | OK |
| `Content-Security-Policy` | ❌ **없음** | XSS·외부 스크립트 주입 방어 부재 |
| `X-Frame-Options` / `frame-ancestors` | ❌ **없음** | 클릭재킹 위험 (특히 로그인/결제 페이지) |
| `Referrer-Policy` | ❌ **없음** | OAuth/Toss redirect 시 referrer leak |
| `X-Content-Type-Options: nosniff` | ❌ **없음** | MIME sniff 방어 부재 |
| `Permissions-Policy` | ❌ **없음** | 의도치 않은 카메라/마이크/지오로케이션 권한 |
| `X-Powered-By: Next.js` | ⚠️ 노출됨 | 정보 누설 (낮은 위험) |

### 권고 — `next.config.ts`에 `headers()` 또는 `vercel.json`에 `headers`
```ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.tosspayments.com https://*.supabase.co; ..." },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ];
}
```
+ `next.config.ts`에 `poweredByHeader: false`.

---

## 2. 도메인 / 리다이렉트 체인 — 🟡 P2

| 진입 URL | hop1 | hop2 | hop3 | 최종 |
|---|---|---|---|---|
| `https://ganjisaju.kr/` | 307 → `www.ganjisaju.kr` | 308 → `xn--s39at50bo6fmwa.kr` | 307 → `www.xn--s39at50bo6fmwa.kr` | 200 |
| `https://www.ganjisaju.kr/` | 308 → `xn--…` | 307 → `www.xn--…` | — | 200 |
| `https://xn--s39at50bo6fmwa.kr/` | 307 → `www.xn--…` | — | — | 200 |
| `https://www.xn--s39at50bo6fmwa.kr/` | 200 | — | — | — ✅ |

**3-hop 체인 (ganjisaju.kr 시작)** — Vercel 도메인 설정에서 1단계 308로 줄이기 가능.

### Canonical 호스트 불일치
- `src/lib/site.ts:5` `CANONICAL_SITE_URL = 'https://xn--s39at50bo6fmwa.kr'` (apex)
- 실제 페이지: `https://www.xn--s39at50bo6fmwa.kr` (www)
- robots.txt `Host:` 도 apex
- → 한쪽으로 통일

### 한글 도메인 `간지사주.kr` — 🟢 P3
- macOS curl로 직접 접속 시 TLS connect error (curl IDN handling 이슈)
- openssl로 확인: punycode apex 인증서는 정상 발급
- 실제 브라우저 동작은 정상 (수동 확인 권장)

---

## 3. Secret 표면 검사 — ✅ 통과

### 환경변수 (`.env.example` 키 목록만, 값 출력 금지)
**Client (NEXT_PUBLIC_*, 브라우저 노출됨)**:
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` (test_ck_*)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (RLS 보호)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (fallback)
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` (VAPID public)
- `NEXT_PUBLIC_SITE_URL`

**Server only (절대 노출 불가)**:
- `TOSS_SECRET_KEY` (test_sk_*)
- `SUPABASE_SERVICE_ROLE_KEY` (RLS 우회)
- `WEB_PUSH_PRIVATE_KEY` (VAPID private)
- `CRON_SECRET`, `NOTIFICATION_CRON_SECRET`
- `OPENAI_API_KEY`
- `KASI_SERVICE_KEY` (optional)
- `BIRTH_LOCATION_GEOCODER_URL` (optional)

### 클라이언트 번들 grep — ✅ **0건 누설**
```bash
grep -lEr --include='*.js' \
  "TOSS_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|WEB_PUSH_PRIVATE_KEY|CRON_SECRET|OPENAI_API_KEY|service_role" \
  .next/static
# (empty output)
```

### 운영 배포 직전 권고
- `TOSS_SECRET_KEY`가 `test_sk_` 접두어가 아닌 운영 키인지 1회 확인
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`도 `test_ck_` → 운영 키 전환
- 실 secret 값으로 동일 grep 자동화 (CI 단계)

---

## 4. CRON / Webhook — VERIFY

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/notifications/dispatch", "schedule": "0 22 * * *" }   // 매일 07:00 KST (UTC 22:00 전일)
  ]
}
```
- `CRON_SECRET` 헤더 검증 동작 — **VERIFY 필요** (fault injection or 운영 로그)
- 결제 webhook (`/api/payments/webhook`) — **부재**. Toss callback URL이 없으면 confirm-only 흐름. 멤버십 자동 갱신 cron도 없음.

권고:
- Toss billing key + 결제 갱신 cron 추가 (월간 멤버십 자동 결제)
- 또는 Toss webhook 엔드포인트 추가

---

## 5. Build / TypeCheck Health — ✅ 통과

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 (134 페이지 정적 생성) |
| ESLint | (별도 실행 안 함 — package.json에 스크립트 부재) |

상세 로그: [`2026-05-13-typecheck.log`](2026-05-13-typecheck.log), [`2026-05-13-build.log`](2026-05-13-build.log)

---

## 6. Next.js 16 변경 사항 영향

- `src/proxy.ts` ([line 1-115](../src/proxy.ts)) — Next.js 14의 `middleware.ts` 등가. canonical host redirect만 수행.
- Line 77-78: `if (!pathname.startsWith('/dashboard')) return response;` — `/dashboard` 라우트가 코드베이스에 **없음** → dead code (P3)
- `next.config.ts` Turbopack 활성 (`turbopack: { root: projectRoot }`)

---

## 7. 우선순위 분류

- **P0**: 0 (본 페이즈 범위 내)
- **P1**: 1 (보안 헤더 5종)
- **P2**: 3 (3-hop redirect / canonical www 불일치 / Toss webhook+갱신 cron 부재)
- **P3**: 2 (proxy.ts /dashboard dead code / X-Powered-By 노출)

---

## 8. 미검증 / VERIFY

- [ ] `CRON_SECRET` 헤더 검증 동작 (fault injection 또는 운영 로그)
- [ ] OAuth callback URL이 Google/Kakao 콘솔에 등록된 도메인과 일치
- [ ] 한글 도메인 `간지사주.kr` 모바일 Chrome/Safari/네이버 앱 접속 정상 (수동)
- [ ] 한글 IDN에 대한 SEO 노출 (구글이 punycode와 한글 도메인을 동등하게 색인하는지)
