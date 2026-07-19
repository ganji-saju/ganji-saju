import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));

function firstNonEmptyEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value && value !== '""' && value !== "''") return value;
  }
  return undefined;
}

// 2026-06-21 보안(P2 Part B) — Content-Security-Policy "Report-Only" 도입.
//   Report-Only 는 차단하지 않고 위반만 브라우저 콘솔에 보고한다(관찰→enforce 전 단계).
//   출처 인벤토리: Toss 결제 SDK(js.tosspayments.com / 결제 iframe),
//   Vercel Analytics·Speed Insights(va.vercel-scripts.com / vitals.vercel-insights.com),
//   Google Analytics 4 + Tag Manager(www.googletagmanager.com 스크립트·noscript iframe · *.google-analytics.com·*.analytics.google.com 비콘),
//   Supabase(*.supabase.co + wss), next/font/google(셀프호스팅이라 외부 폰트 출처 불필요),
//   inline script/style(Next 주입 + JSON-LD + style 속성) → 'unsafe-inline'.
//   ⚠️ 운영 권고: 콘솔 위반 로그를 일정 기간 수집한 뒤 enforce(Content-Security-Policy)로 승격.
// 2026-07-19 — 🔴 enforce 로 켰다면 **결제가 통째로 죽었을** 목록을 실측으로 교정.
//   위 인벤토리는 2026-06-21 토스 시절 기준인데, 그 뒤 PG 가 나이스페이로 바뀌고
//   카카오 공유 SDK·구글 광고 전환이 붙었다. report-only 리포트에서 실제로 관측된 위반:
//     form-action     pay.nicepay.co.kr        ← 결제창 제출. 막히면 결제 불가
//     script-src-elem pay.nicepay.co.kr/v1/js  ← 나이스페이 SDK. 막히면 결제 불가
//     script-src-elem t1.kakaocdn.net          ← 카카오 공유 SDK (20건)
//     connect-src     analytics.google.com     ← GA4 비콘 (76건)
//     connect-src     stats.g.doubleclick.net · www.google.co.kr · www.google.com  ← 광고 전환
//   ⚠️ 함정: `*.analytics.google.com` 은 **apex(analytics.google.com)를 매치하지 않는다.**
//     CSP 와일드카드는 서브도메인 한 단계용이라 apex 를 따로 적어야 한다.
//     같은 이유로 google-analytics 도 www 를 별도 명시해 두었다(기존).
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // 결제창 제출 대상(PG). PAYMENT_PROVIDER 토글로 토스↔나이스페이가 바뀌므로 둘 다 유지.
  "form-action 'self' https://*.nicepay.co.kr https://*.tosspayments.com https://*.tosspay.com",
  // Google Analytics 4 (gtag.js) — 스크립트는 googletagmanager, 수집 비콘은 google-analytics/analytics.google.com.
  "script-src 'self' 'unsafe-inline' https://js.tosspayments.com https://*.nicepay.co.kr https://t1.kakaocdn.net https://va.vercel-scripts.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tosspayments.com https://*.nicepay.co.kr https://*.kakao.com https://t1.kakaocdn.net https://vitals.vercel-insights.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://stats.g.doubleclick.net https://www.google.com https://www.google.co.kr",
  // GTM noscript iframe(googletagmanager.com/ns.html) 허용. ⚠️ GTM 컨테이너가 추가
  //   태그(광고 픽셀 등)를 붙이면 그 출처는 컨테이너별로 CSP 에 별도 추가 필요.
  "frame-src 'self' https://*.nicepay.co.kr https://*.tosspayments.com https://*.tosspay.com https://www.googletagmanager.com",
  // 2026-06-21 — 위반 보고를 /api/csp-report 로 수집(enforce 승격 전 관찰용).
  'report-uri /api/csp-report',
].join('; ');

// 2026-06-21 보안 — CSP enforce 승격 토글. 위반 로그를 충분히 관찰해 정상 트래픽이
//   깨지지 않음을 확인한 뒤, Vercel 환경변수 CSP_MODE=enforce + 재배포로 강제 모드 전환.
//   기본(미설정)은 Report-Only(차단 없이 보고만).
const CSP_ENFORCE = process.env.CSP_MODE === 'enforce';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: firstNonEmptyEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL"
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: firstNonEmptyEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY"
    ),
  },
  images: {
    qualities: [70, 75, 82],
  },
  turbopack: {
    root: projectRoot,
  },
  // 2026-06-21 보안(P2) — 안전한 하드 보안 헤더(클릭재킹/MIME 스니핑/리퍼러/권한).
  //   X-Frame-Options=SAMEORIGIN: 타 사이트의 iframe 임베드 차단(Toss 위젯은 내 페이지가
  //     부모라 무관). nosniff: MIME 스니핑 차단. Permissions-Policy: 미사용 브라우저 API 차단
  //     (출생지 검색은 텍스트 지오코더라 navigator.geolocation 미사용).
  //   CSP 는 외부 출처(Toss·Supabase·Vercel Analytics) 인벤토리 후 Report-Only 로 별도 도입.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: CSP_ENFORCE
              ? 'Content-Security-Policy'
              : 'Content-Security-Policy-Report-Only',
            value: CSP_DIRECTIVES,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
