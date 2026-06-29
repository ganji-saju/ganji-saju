# 구글 로그인 동의화면 도메인을 내 도메인으로 (Supabase Custom Domain)

> 증상: 구글 로그인 시 "계속하려면 **bgtzkjxihlbmxehmhtwg.supabase.co**(으)로 이동" 표시.
> 원하는 것: "계속하려면 **ganjisaju.kr**(으)로 이동"으로.

## 왜 supabase.co 가 뜨나
OAuth 흐름:
1. 앱 → `supabase.auth.signInWithOAuth({ provider:'google', redirectTo: ganjisaju.kr/... })`
2. **Supabase 가 구글로 redirect** 하면서 `redirect_uri = https://<ref>.supabase.co/auth/v1/callback` 를 사용(고정).
3. 구글 동의화면은 이 **redirect_uri 의 호스트**(= supabase.co)를 "이동할 곳"으로 표시.
4. 동의 후 구글 → supabase.co/auth/v1/callback → 앱(ganjisaju.kr/api/auth/callback).

즉 앱 코드의 `redirectTo`(이미 ganjisaju.kr)는 **4단계**만 바꾸고, 동의화면이 보는 건 **2단계의 supabase.co**다. 이걸 바꾸려면 Supabase auth 엔드포인트를 내 도메인(예: `auth.ganjisaju.kr`)으로 올려야 한다 = **Supabase Custom Domain**.

## 전제: 비용·플랜
- Supabase **Custom Domain 은 유료 애드온**(Pro 플랜 필요, 약 $10/월).
- 무료 플랜에서는 불가. (코드/리버스프록시 우회는 비공식·취약 → 권장 안 함.)

## 단계별 (프로젝트: ref `bgtzkjxihlbmxehmhtwg`, 도메인 `ganjisaju.kr`)

### 1) 서브도메인 결정
`auth.ganjisaju.kr` 권장(auth 전용). 아래 모두 이 값 기준.

### 2) Supabase 커스텀 도메인 등록 (CLI)
```bash
# 로그인/프로젝트 연결돼 있다고 가정
supabase domains create \
  --project-ref bgtzkjxihlbmxehmhtwg \
  --custom-hostname auth.ganjisaju.kr

# 위 명령이 DNS 에 넣을 CNAME + TXT(검증) 레코드를 출력한다.
```
(대시보드 경로: Project Settings → General → **Custom Domains** 섹션에서도 가능)

### 3) DNS 레코드 추가
`ganjisaju.kr` DNS 관리처(Vercel DNS 또는 도메인 등록기관)에:
- **CNAME**: `auth` → Supabase 가 알려준 타깃(보통 `<ref>.supabase.co` 또는 SSL 전용 호스트)
- **TXT**: Supabase 가 준 `_acme-challenge`/검증용 TXT 값

> Vercel 에서 도메인 DNS 관리 중이면 Vercel → 도메인 → DNS Records 에서 추가.

### 4) 검증·활성화 (CLI)
```bash
supabase domains reverify --project-ref bgtzkjxihlbmxehmhtwg   # DNS 전파·SSL 발급 확인
supabase domains activate --project-ref bgtzkjxihlbmxehmhtwg   # 활성화
```
활성화되면 auth 엔드포인트 = `https://auth.ganjisaju.kr` (SSL 자동 발급).

### 5) 구글 클라우드 콘솔 (가장 중요 — 동의화면 변경 지점)
APIs & Services → **Credentials** → 해당 OAuth 2.0 Client ID:
- **Authorized redirect URIs** 에 추가:
  `https://auth.ganjisaju.kr/auth/v1/callback`
  (기존 `https://bgtzkjxihlbmxehmhtwg.supabase.co/auth/v1/callback` 는 전환 안정화까지 **남겨두고** 나중 제거)
- **Authorized JavaScript origins**: `https://ganjisaju.kr` 포함 확인

APIs & Services → **OAuth consent screen**:
- App name: `간지사주`
- **Authorized domains**: `ganjisaju.kr` 추가
- 홈페이지/개인정보/약관 URL: ganjisaju.kr 경로로
- (게시 상태 `In production` + 도메인 소유확인 시 동의화면이 앱이름+도메인으로 더 깔끔하게 표시)

### 6) Supabase 인증 설정
Authentication → URL Configuration:
- **Site URL**: `https://ganjisaju.kr`
- **Redirect URLs**: `https://ganjisaju.kr/api/auth/callback` 포함(이미 OK)
- Google provider: Client ID/Secret 동일 유지

### 7) 앱 환경변수 전환 (커스텀 도메인 활성 확인 후)
Vercel 환경변수:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://auth.ganjisaju.kr`
  → 클라이언트가 auth 호출을 내 도메인으로 하게 되고, signInWithOAuth 의 `redirect_uri` 가 `https://auth.ganjisaju.kr/auth/v1/callback` 로 나간다.
- (서버 `SUPABASE_URL` 도 동일하게 두면 일관)
- 재배포.

> ⚠️ 순서 중요: 5)에서 새 redirect URI 를 **먼저 등록**하고 4) 활성화·7) env 전환을 한다. 안 그러면 전환 순간 `redirect_uri_mismatch` 로 로그인 깨짐.

### 8) 검증
- 시크릿창에서 구글 로그인 → 동의화면이 `auth.ganjisaju.kr`(또는 앱이름 간지사주 + ganjisaju.kr)로 표시되는지 확인.
- 로그인 정상 완료(콜백 → ganjisaju.kr) 확인.

## 주의·한계
- 동의화면 표시 도메인 = redirect_uri 호스트 = `auth.ganjisaju.kr`(서브도메인). 완전한 apex `ganjisaju.kr` 단독 표기는 구글이 redirect 호스트를 쓰므로 보통 `auth.ganjisaju.kr` 로 나온다. 사용자 체감상 "내 도메인"으로 충분.
- 게시·검증된 OAuth 앱은 동의화면에 **App name(간지사주)** 이 더 크게 표시되어 supabase.co 느낌이 사라진다.
- 카카오 로그인도 동일 원리: 카카오 콘솔 Redirect URI 에 `https://auth.ganjisaju.kr/auth/v1/callback` 추가.

## 비용 없이 가능한가?
- 동의화면 도메인 자체를 바꾸려면 redirect_uri 가 내 도메인이어야 하고, 그건 Supabase Custom Domain(유료)이 정식 경로. 아래 Cloudflare 프록시는 무료 우회 시도이나 **호스팅 GoTrue 가 고정 외부URL 을 쓰면 안 통할 수 있음**(4단계에서 먼저 검증).

---

# 부록 A — Cloudflare Worker 프록시 (무료 우회 시도)

> ⚠️ 정직한 전제: 프록시가 동의화면을 바꾸려면 Supabase Auth(GoTrue)가 redirect_uri 를 "들어온 호스트(auth.ganjisaju.kr)" 기준으로 생성해야 한다. 호스팅 Supabase 는 고정 외부URL(supabase.co)을 쓸 수 있어 **프록시만으로 안 바뀔 가능성**이 있다. 그래서 **4단계에서 실제 redirect_uri 를 먼저 검증**하고, 바뀔 때만 끝까지 진행한다.
>
> 참고: 이 앱은 realtime/storage/edge functions 미사용 → 프록시는 일반 HTTPS(auth+DB REST)만 다루면 됨(WebSocket 불필요).

## 전제
`ganjisaju.kr` 이 **Cloudflare DNS**여야 함(네임서버 → Cloudflare). 지금 Vercel DNS 면: Cloudflare 에 사이트 추가 → 기존 레코드(apex/www→Vercel, MX, TXT 등) 그대로 이전 → 등록기관에서 NS 변경. 앱은 계속 Vercel 호스팅, Cloudflare 는 DNS+프록시만.

## 1) Worker 생성
Cloudflare → **Workers & Pages → Create → Worker**(이름 예 `supabase-auth-proxy`) → 코드 붙여넣고 Deploy:

```js
const UPSTREAM = 'bgtzkjxihlbmxehmhtwg.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = UPSTREAM;        // 업스트림으로 라우팅
    url.protocol = 'https:';
    url.port = '';

    const headers = new Headers(request.headers);
    headers.set('Host', UPSTREAM); // ★ Host 재작성(없으면 프로젝트 식별 실패)

    const init = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',          // ★ Supabase 의 302(→구글)를 그대로 브라우저에 전달
    };

    const resp = await fetch(url.toString(), init);
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,        // set-cookie 등 그대로 패스스루
    });
  },
};
```

## 2) auth 서브도메인 연결 (Custom Domains 방식 — 가장 깔끔)
Worker → **Settings → Triggers → Custom Domains → Add Custom Domain** → `auth.ganjisaju.kr`
→ DNS 레코드 + SSL 자동 생성. (대안: Routes 에 `auth.ganjisaju.kr/*` + 더미 프록시 DNS)

## 3) 프록시 동작 확인
```bash
curl -s https://auth.ganjisaju.kr/auth/v1/health
# → GoTrue 응답 비슷하게 오면 Host 재작성·라우팅 OK
```

## 4) 🔑 핵심 검증 — redirect_uri 가 실제로 바뀌나 (여기서 결정)
```bash
curl -sI "https://auth.ganjisaju.kr/auth/v1/authorize?provider=google" \
  -H "apikey: <ANON_KEY>" | grep -i '^location:'
```
반환된 `Location:`(구글 authorize URL)의 **`redirect_uri=` 값** 확인:
- ✅ `redirect_uri=...auth.ganjisaju.kr%2Fauth%2Fv1%2Fcallback` → 바뀜! 5단계 진행 → 동의화면 내 도메인.
- ❌ `redirect_uri=...bgtzkjxihlbmxehmhtwg.supabase.co...` → GoTrue 고정URL → 프록시 무효. 멈추고 Custom Domain 또는 직접 OAuth 구현.

## 5) (4번 ✅일 때만) 구글 콘솔 + env
- Google Cloud → Credentials → OAuth Client → Authorized redirect URIs 에 `https://auth.ganjisaju.kr/auth/v1/callback` 추가(기존 supabase.co 는 전환 안정화까지 유지)
- OAuth consent screen → Authorized domains 에 `ganjisaju.kr`
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL = https://auth.ganjisaju.kr`(서버 `SUPABASE_URL` 동일) → 재배포

## 6) 검증
시크릿창 구글 로그인 → 동의화면 `auth.ganjisaju.kr` + 로그인 정상 완료.

## 4번이 ❌라면 (프록시 무효)
무료 대안 = **직접 Google OAuth 구현**: 내 도메인에서 authorize URL 직접 생성(redirect_uri=ganjisaju.kr/api/auth/google/callback) → 콜백의 `code` 를 Supabase 세션으로 교환. (코드 작업 필요)

## 비교표
| | Cloudflare Worker | Vercel rewrites | Supabase Custom Domain |
|---|---|---|---|
| 비용 | 무료 | 무료 | ~$10/월 |
| 난이도 | 중 | 중상 | 하 |
| 동의화면 변경 | 4번 검증 통과 시 | 4번 검증 통과 시 | 보장 |
| 안정성 | 비공식 | 비공식 | 공식·자동SSL |
