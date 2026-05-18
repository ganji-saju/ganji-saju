// 2026-05-18 Phase 7b — POST /api/reviews (작성) + GET /api/reviews (공개 목록).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  insertReview,
  listApprovedReviews,
} from '@/lib/reviews/queries';
import { validateReviewInput } from '@/lib/reviews/types';
import { isVerifiedPurchaseForReview } from '@/lib/reviews/verification';

const DEFAULT_SCOPE_KEY = 'global';

function normalizeScopeKey(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SCOPE_KEY;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SCOPE_KEY;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const productId = searchParams.get('productId');
  const scopeKey = searchParams.get('scope') ?? searchParams.get('scopeKey');
  const limitRaw = searchParams.get('limit');
  const offsetRaw = searchParams.get('offset');

  const result = await listApprovedReviews({
    productId,
    scopeKey,
    limit: limitRaw ? Number(limitRaw) : undefined,
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  });

  return NextResponse.json({
    ok: true,
    reviews: result.reviews,
    total: result.total,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        productId?: unknown;
        scopeKey?: unknown;
        rating?: unknown;
        content?: unknown;
        displayName?: unknown;
      }
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  const errors = validateReviewInput(body);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'validation_failed', errors },
      { status: 400 }
    );
  }

  const productId = String(body.productId);
  const scopeKey = normalizeScopeKey(body.scopeKey);
  const rating = Number(body.rating);
  const content = String(body.content);
  const displayName =
    typeof body.displayName === 'string' && body.displayName.trim().length > 0
      ? body.displayName.trim()
      : null;

  const isVerifiedPurchase = await isVerifiedPurchaseForReview({
    userId: user.id,
    productId,
    scopeKey,
  });

  const result = await insertReview({
    userId: user.id,
    productId,
    scopeKey,
    rating,
    content,
    displayName,
    isVerifiedPurchase,
  });

  if ('error' in result) {
    const status = result.error.includes('이미 동일') ? 409 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, review: result }, { status: 201 });
}
