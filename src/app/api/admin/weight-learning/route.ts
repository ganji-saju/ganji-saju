// 2026-05-15 — 신살 가중치 ML 학습 API (admin).
// GET  /api/admin/weight-learning             — 학습 + diff 미리보기 (저장 X)
// GET  /api/admin/weight-learning?list=1      — 저장된 버전 목록
// POST /api/admin/weight-learning             — 학습 + DB 저장 (draft)
// POST /api/admin/weight-learning?activate=ID — 특정 버전 활성화
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
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
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
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
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  // created_by 용 user id.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  // 버전 활성화.
  const activateId = req.nextUrl.searchParams.get('activate');
  if (activateId) {
    // PR #153 (D2) — R² 임계값 0.05 미만이면 promote 차단.
    // ?force=1 으로 우회 가능 (super_admin 의 의도적 결정 허용).
    const forceFlag = req.nextUrl.searchParams.get('force') === '1';

    // 0) 대상 버전 메타 조회 — r_squared / sample_size 확인.
    const { data: target, error: readErr } = await supabase
      .from('sinsal_weight_versions')
      .select('r_squared, sample_size, status')
      .eq('id', activateId)
      .maybeSingle();
    if (readErr || !target) {
      return NextResponse.json(
        { ok: false, error: readErr?.message ?? 'version not found' },
        { status: 404 }
      );
    }
    const rSquared = (target as { r_squared: number | null }).r_squared;
    const sampleSize = (target as { sample_size: number }).sample_size;
    const R2_THRESHOLD = 0.05;
    if (!forceFlag && (rSquared === null || rSquared < R2_THRESHOLD)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'r_squared_below_threshold',
          message: `모델 설명력 R² 가 ${R2_THRESHOLD} 미만입니다 (현재 ${rSquared === null ? 'null' : rSquared.toFixed(3)}). 표본 ${sampleSize}건 — production 적용 차단. ?force=1 로 우회 가능.`,
          rSquared,
          threshold: R2_THRESHOLD,
          sampleSize,
        },
        { status: 403 }
      );
    }

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
    return NextResponse.json({
      ok: true,
      activatedId: activateId,
      rSquared,
      sampleSize,
      forced: forceFlag,
    });
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
