// 2026-06-21 운영 — 결제 idempotency 회귀 데이터 감사(서버 재사용 모듈).
// scripts/audit-payment-idempotency.mjs 의 핵심 쿼리를 서버에서 재사용 가능하게 추출.
// 같은 user + 같은 KST 일에 detail_report 가 2+ 차감된 row(일일 멱등 위반)를 찾는다.
// prod DB 조회라 service_role 필요. cron 엔드포인트에서 호출한다.
import { createServiceClient } from '@/lib/supabase/server';

export interface IdempotencyAuditRow {
  user_id: string;
  kst_date: string;
  daily_charges: number;
  overcharged: number;
}

export interface IdempotencyAuditResult {
  ok: boolean; // 회귀 0건이면 true
  sinceIso: string;
  rowCount: number;
  totalOvercharged: number;
  rows: IdempotencyAuditRow[];
  source: 'rpc' | 'fallback';
}

function toKstDate(iso: string): string {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    .toISOString()
    .slice(0, 10);
}

export async function runPaymentIdempotencyAudit(
  options: { sinceDays?: number } = {}
): Promise<IdempotencyAuditResult> {
  const sinceDays = Number.isFinite(options.sinceDays) ? (options.sinceDays as number) : 7;
  const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const supabase = await createServiceClient();

  // 1) 전용 RPC 가 있으면 사용.
  const rpc = await supabase.rpc('audit_payment_idempotency_duplicates', { p_since: sinceIso });
  if (!rpc.error && Array.isArray(rpc.data)) {
    const rows = rpc.data as IdempotencyAuditRow[];
    return {
      ok: rows.length === 0,
      sinceIso,
      rowCount: rows.length,
      totalOvercharged: rows.reduce((s, r) => s + (r.overcharged ?? 0), 0),
      rows,
      source: 'rpc',
    };
  }

  // 2) Fallback — credit_transactions 직접 집계(RPC 미설치 환경 대비).
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('user_id, created_at')
    .eq('feature', 'detail_report')
    .eq('type', 'use')
    .eq('amount', -1)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const groups = new Map<string, { user_id: string; kst_date: string; count: number }>();
  for (const row of data ?? []) {
    const userId = (row as { user_id: string }).user_id;
    const createdAt = (row as { created_at: string }).created_at;
    const kstDate = toKstDate(createdAt);
    const key = `${userId}|${kstDate}`;
    const group = groups.get(key) ?? { user_id: userId, kst_date: kstDate, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }

  const rows: IdempotencyAuditRow[] = Array.from(groups.values())
    .filter((g) => g.count > 1)
    .map((g) => ({
      user_id: g.user_id,
      kst_date: g.kst_date,
      daily_charges: g.count,
      overcharged: g.count - 1,
    }))
    .sort((a, b) => (a.kst_date < b.kst_date ? 1 : -1));

  return {
    ok: rows.length === 0,
    sinceIso,
    rowCount: rows.length,
    totalOvercharged: rows.reduce((s, r) => s + r.overcharged, 0),
    rows,
    source: 'fallback',
  };
}
