// 2026-05-18 Phase 7b — PATCH/DELETE /api/reviews/[id]. 본인 후기 수정/삭제.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  deleteOwnReview,
  getReviewById,
  updateOwnReview,
} from '@/lib/reviews/queries';
import { validateReviewInput } from '@/lib/reviews/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getReviewById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { rating?: unknown; content?: unknown; displayName?: unknown }
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  // validation 은 기존 productId 포함 형태로 실행 (productId 변경 불가).
  const errors = validateReviewInput({
    productId: existing.productId,
    rating: body.rating ?? existing.rating,
    content: body.content ?? existing.content,
    displayName: body.displayName,
  });
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'validation_failed', errors },
      { status: 400 }
    );
  }

  const result = await updateOwnReview({
    userId: user.id,
    reviewId: id,
    rating: typeof body.rating === 'number' ? body.rating : undefined,
    content: typeof body.content === 'string' ? body.content : undefined,
    displayName:
      body.displayName === undefined
        ? undefined
        : typeof body.displayName === 'string'
          ? body.displayName
          : null,
  });

  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, review: result });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteOwnReview({ userId: user.id, reviewId: id });
  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
