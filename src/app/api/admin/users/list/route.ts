// GET 가입자 목록(JSON, keyset). admin 게이트 + 서버 마스킹.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { fetchAdminUserList } from '@/lib/admin/user-list';
import { parseListParams, buildListItem, cursorForRow, encodeCursor } from '@/lib/admin/user-list-query';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const role = check.role;
  const params = parseListParams(req.nextUrl.searchParams);
  const page = await fetchAdminUserList(params);
  const nowIso = new Date().toISOString();

  const items = page.rows.map((r) => buildListItem(r, role, nowIso));
  const nextCursor =
    page.hasMore && page.rows.length > 0
      ? encodeCursor(cursorForRow(page.rows[page.rows.length - 1], params.sort))
      : null;

  return NextResponse.json({ ok: true, items, nextCursor, refreshedAt: page.refreshedAt });
}
