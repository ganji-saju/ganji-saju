// 2026-05-16 PR #138 — 별자리 즐겨찾기 toggle.
// POST   /api/star-sign/favorites/[slug] — 추가 (멱등)
// DELETE /api/star-sign/favorites/[slug] — 제거
import { NextRequest, NextResponse } from 'next/server';
import {
  addFavoriteStarSign,
  isValidStarSignSlug,
  removeFavoriteStarSign,
} from '@/lib/star-sign/favorites';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string }>;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(_req: NextRequest, { params }: Props) {
  const { slug } = await params;
  if (!isValidStarSignSlug(slug)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 별자리' }, { status: 400 });
  }
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const result = await addFavoriteStarSign(supabase, user.id, slug);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const { slug } = await params;
  if (!isValidStarSignSlug(slug)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 별자리' }, { status: 400 });
  }
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const result = await removeFavoriteStarSign(supabase, user.id, slug);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}
