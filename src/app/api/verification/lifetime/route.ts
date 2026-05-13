import { NextRequest, NextResponse } from 'next/server';
import { getLifetimeVerificationAudit } from '@/server/verification/lifetime-audit';
import { requireVerificationApiAccess } from '@/lib/verification-access';

function parseTargetYear(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 2026;
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : 2026;
}

export async function GET(req: NextRequest) {
  const deniedResponse = await requireVerificationApiAccess();
  if (deniedResponse) return deniedResponse;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug')?.trim() || undefined;
  const counselor = searchParams.get('counselor') === 'male' ? 'male' : 'female';
  const targetYear = parseTargetYear(searchParams.get('targetYear'));

  const audit = await getLifetimeVerificationAudit({
    slug,
    targetYear,
    counselorId: counselor,
  });

  return NextResponse.json(audit);
}
