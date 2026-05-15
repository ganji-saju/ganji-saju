// 2026-05-15 — 신살 룰 검증 통계 API (admin).
// GET /api/admin/sinsal-validation?days=180 — 지난 N일 피드백으로 신살별 t-test.
import { NextRequest, NextResponse } from 'next/server';
import { analyzeSinsalEffects, summarizeDataset } from '@/lib/admin/sinsal-validation';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days');
  const days = Math.max(7, Math.min(730, parseInt(daysParam ?? '180', 10)));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // 향후: admin role 체크 추가. 현재는 noindex 페이지 + 로그인만 검증.

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabase
    .from('today_fortune_feedback')
    .select('overall_rating, detected_sinsals, created_at')
    .gte('created_at', cutoff.toISOString())
    .limit(20_000);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'query failed' },
      { status: 500 }
    );
  }

  const rows = data as Array<{
    overall_rating: number;
    detected_sinsals: Array<{ name: string; category: string; positions: string[] }> | null;
    created_at: string;
  }>;

  const summary = summarizeDataset(rows);
  const stats = analyzeSinsalEffects(rows);

  return NextResponse.json({
    ok: true,
    windowDays: days,
    summary,
    stats,
  });
}
