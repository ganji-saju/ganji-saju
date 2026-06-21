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
//   Supabase(*.supabase.co + wss), next/font/google(셀프호스팅이라 외부 폰트 출처 불필요),
//   inline script/style(Next 주입 + JSON-LD + style 속성) → 'unsafe-inline'.
//   ⚠️ 운영 권고: 콘솔 위반 로그를 일정 기간 수집한 뒤 enforce(Content-Security-Policy)로 승격.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://js.tosspayments.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tosspayments.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.tosspayments.com https://*.tosspay.com",
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
