import { NextRequest, NextResponse } from 'next/server';
import { getSajuVerificationAudit } from '@/server/verification/saju-audit';
import { requireVerificationApiAccess } from '@/lib/verification-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const deniedResponse = await requireVerificationApiAccess();
  if (deniedResponse) return deniedResponse;

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? undefined;
  const compareSlug = url.searchParams.get('compareSlug') ?? undefined;
  const topic = url.searchParams.get('topic') ?? undefined;
  const audit = await getSajuVerificationAudit({ slug, compareSlug, topic });

  return NextResponse.json(audit, {
    status: audit.status === 'not-found' ? 404 : audit.status === 'error' ? 500 : 200,
  });
}
