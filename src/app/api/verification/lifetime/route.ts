import { NextRequest, NextResponse } from 'next/server';
import { getLifetimeVerificationAudit } from '@/server/verification/lifetime-audit';
import { requireVerificationApiAccess } from '@/lib/verification-access';
import { parseTargetYear } from '@/lib/api-utils';

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
