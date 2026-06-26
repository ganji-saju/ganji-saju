// 임시 디버그(Preview 환경 검증용) — 값 노출 없이 boolean/provider 만. 테스트 후 브랜치째 폐기.
import { NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payments/provider';
import { hasSupabaseServerEnv, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export async function GET() {
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? '(none)',
    provider: getPaymentProvider(),
    hasNicepayClientKey: Boolean(process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY),
    hasNicepaySecretKey: Boolean(process.env.NICEPAY_SECRET_KEY),
    nicepayApiBase: process.env.NICEPAY_API_BASE ?? '(미설정 → 운영 기본)',
    hasSupabaseServerEnv,
    hasSupabaseServiceEnv,
  });
}
