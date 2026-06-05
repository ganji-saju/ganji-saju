// GET CSV 내보내기. 행상한 5,000. PII 컬럼(email/display_name)은 super_admin 한정.
// 모든 export 는 admin_access_log(export_csv) 기록.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { fetchAdminUserList } from '@/lib/admin/user-list';
import {
  parseListParams,
  buildListItem,
  buildCsv,
  cursorForRow,
  encodeCursor,
  type AdminUserListItem,
} from '@/lib/admin/user-list-query';
import { logAdminAccess } from '@/lib/admin/access-log';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;
const PAGE = 500;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const role = check.role;
  const base = parseListParams(req.nextUrl.searchParams);
  const nowIso = new Date().toISOString();
  const items: AdminUserListItem[] = [];
  let cursor: string | null = null;

  for (let guard = 0; guard < Math.ceil(MAX_ROWS / PAGE) + 1; guard += 1) {
    const page = await fetchAdminUserList({ ...base, cursor, limit: PAGE });
    for (const r of page.rows) items.push(buildListItem(r, role, nowIso));
    if (!page.hasMore || items.length >= MAX_ROWS) break;
    const last = page.rows[page.rows.length - 1];
    cursor = encodeCursor(cursorForRow(last, base.sort));
  }
  const limited = items.slice(0, MAX_ROWS);
  const csv = buildCsv(limited, role);

  await logAdminAccess({
    actorId: check.userId,
    actorRole: role,
    action: 'export_csv',
    meta: {
      rowCount: limited.length,
      pii: role === 'super_admin',
      filters: Object.fromEntries(req.nextUrl.searchParams),
    },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${nowIso.slice(0, 10)}.csv"`,
    },
  });
}
