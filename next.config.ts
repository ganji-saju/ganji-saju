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

// P1-1 fix (audit 2026-05-13): security response headers. HSTS is already applied
// by Vercel; the headers below close the remaining gaps observed during the audit:
// CSP / X-Frame-Options / Referrer-Policy / X-Content-Type-Options / Permissions-Policy.
// `js.tosspayments.com` and `*.supabase.co` are whitelisted because the payment
// widget and Supabase client must load from those origins.
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.tosspayments.com https://*.tosspayments.com https://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tosspayments.com https://*.tosspayments.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.openai.com",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-src 'self' https://*.tosspayments.com",
      "media-src 'self' https:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/about-engine', destination: '/interpretation', permanent: true },
      { source: '/guide', destination: '/interpretation', permanent: true },
      { source: '/gunghap', destination: '/compatibility/input', permanent: true },
      { source: '/today', destination: '/today-fortune', permanent: false },
      { source: '/method', destination: '/interpretation', permanent: true },
      { source: '/method/:slug', destination: '/interpretation', permanent: true },
      { source: '/myeongri/ten-gods', destination: '/myeongri', permanent: true },
      { source: '/saju/new/consent', destination: '/saju/new', permanent: true },
      { source: '/saju/new/empathy', destination: '/saju/new', permanent: true },
      { source: '/saju/new/nickname', destination: '/saju/new', permanent: true },
      { source: '/saju/new/birth', destination: '/saju/new', permanent: true },
      { source: '/notifications/schedule', destination: '/notifications', permanent: true },
      { source: '/notifications/widget', destination: '/notifications', permanent: true },
      { source: '/my/results', destination: '/my', permanent: true },
    ];
  },
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
