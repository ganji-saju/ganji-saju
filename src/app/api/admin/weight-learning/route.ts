// 2026-05-15 — 신살 가중치 ML 학습 API (admin).
// GET  /api/admin/weight-learning             — 학습 + diff 미리보기 (저장 X)
// GET  /api/admin/weight-learning?list=1      — 저장된 버전 목록
// POST /api/admin/weight-learning             — 학습 + DB 저장 (draft)
// POST /api/admin/weight-learning?activate=ID — 특정 버전 활성화
import { NextRequest, NextResponse } from 'next/server';
import { diffWeights, learnSinsalWeights } from '@/lib/admin/weight-learning';
import { createClient } from '@/lib/supabase/server';

interface FeedbackRow {
  overall_rating: number;
  detected_sinsals: Array<{ name: string }> | null;
}

async function fetchFeedbackInWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  days: number
): Promise<{ rows: FeedbackRow[]; windowStart: Date; windowEnd: Date }> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowEnd.getDate() - days);
  const { data } = await supabase
    .from('today_fortune_feedback')
    .select('overall_rating, detected_sinsals')
    .gte('created_at', windowStart.toISOString())
    .limit(20_000);
  return {
    rows: (data ?? []) as FeedbackRow[],
    windowStart,
    windowEnd,
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // 저장된 버전 목록.
  if (req.nextUrl.searchParams.get('list') === '1') {
    const { data, error } = await supabase
      .from('sinsal_weight_versions')
      .select('id, learned_at, window_start, window_end, sample_size, lambda, mse, r_squared, status, note, weights')
      .order('learned_at', { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, versions: data ?? [] });
  }

  // 미리보기 학습 (저장 X).
  const daysParam = req.nextUrl.searchParams.get('days');
  const lambdaParam = req.nextUrl.searchParams.get('lambda');
  const days = Math.max(7, Math.min(730, parseInt(daysParam ?? '180', 10)));
  const lambda = Number.isFinite(parseFloat(lambdaParam ?? '1')) ? parseFloat(lambdaParam ?? '1') : 1;

  const { rows, windowStart, windowEnd } = await fetchFeedbackInWindow(supabase, days);
  const result = learnSinsalWeights(rows, { lambda });
  if (!result) {
    return NextResponse.json({
      ok: true,
      preview: null,
      sampleSize: rows.length,
      reason: '학습 가능한 표본 부족',
      windowStart,
      windowEnd,
    });
  }
  const diffs = diffWeights(result);
  return NextResponse.json({
    ok: true,
    preview: result,
    diffs,
    windowStart,
    windowEnd,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // 버전 활성화.
  const activateId = req.nextUrl.searchParams.get('activate');
  if (activateId) {
    // 1) 기존 active → archived.
    const { error: archiveErr } = await supabase
      .from('sinsal_weight_versions')
      .update({ status: 'archived' })
      .eq('status', 'active');
    if (archiveErr) {
      return NextResponse.json({ ok: false, error: archiveErr.message }, { status: 500 });
    }
    // 2) 지정 버전 → active.
    const { error: activateErr } = await supabase
      .from('sinsal_weight_versions')
      .update({ status: 'active' })
      .eq('id', activateId);
    if (activateErr) {
      return NextResponse.json({ ok: false, error: activateErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activatedId: activateId });
  }

  // 학습 + 저장.
  const payload = (await req.json().catch(() => ({}))) as {
    days?: number;
    lambda?: number;
    note?: string;
  };
  const days = Math.max(7, Math.min(730, payload.days ?? 180));
  const lambda = typeof payload.lambda === 'number' && Number.isFinite(payload.lambda) ? payload.lambda : 1.0;

  const { rows, windowStart, windowEnd } = await fetchFeedbackInWindow(supabase, days);
  const result = learnSinsalWeights(rows, { lambda });
  if (!result) {
    return NextResponse.json(
      { ok: false, error: '학습 가능한 표본 부족' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('sinsal_weight_versions')
    .insert({
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      sample_size: result.sampleSize,
      lambda: result.lambda,
      mse: result.mse,
      r_squared: result.rSquared,
      weights: result.weights,
      per_sinsal_stats: result.perSinsalStats,
      status: 'draft',
      created_by: user.id,
      note: payload.note ?? null,
    })
    .select('id, learned_at')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'insert failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, version: data, result });
}
