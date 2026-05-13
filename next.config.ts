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

const nextConfig: NextConfig = {
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
};

export default nextConfig;
