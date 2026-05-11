import { NextRequest, NextResponse } from 'next/server';
import { getYearlyVerificationAudit } from '@/server/verification/yearly-audit';
import { requireVerificationApiAccess } from '@/lib/verification-access';
import { parseTargetYear } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const deniedResponse = await requireVerificationApiAccess();
  if (deniedResponse) return deniedResponse;

  const searchParams = req.nextUrl.searchParams;
  const slug = searchParams.get('slug')?.trim() || undefined;
  const targetYear = parseTargetYear(searchParams.get('targetYear'));
  const counselorParam = searchParams.get('counselor');
  const counselorId =
    counselorParam === 'male' || counselorParam === 'female'
      ? counselorParam
      : 'female';

  const audit = await getYearlyVerificationAudit({
    slug,
    targetYear,
    counselorId,
  });

  const statusCode =
    audit.status === 'ready' ? 200 : audit.status === 'not-found' ? 404 : 500;

  return NextResponse.json(audit, { status: statusCode });
}
