// 2026-05-14: 알림 피드 조회 API.
// notification_delivery_logs 에서 sent/failed 상태 최근 50건을 반환한다.
// RLS 가 auth.uid() = user_id 로 보호하므로 anon 클라이언트로도 안전.

import { NextResponse } from 'next/server';
import {
  createClient,
  hasSupabaseServerEnv,
} from '@/lib/supabase/server';

const SLOT_HREF_MAP: Array<[prefix: string, href: string]> = [
  ['today-fortune', '/today-fortune'],
  ['today-tarot', '/tarot/daily'],
  ['today-zodiac', '/zodiac'],
  ['today-star-sign', '/star-sign'],
  ['weekly', '/today-fortune'],
  ['monthly', '/today-fortune'],
  ['seasonal', '/today-fortune'],
  ['birthday', '/my'],
  ['returning', '/my'],
  ['dialogue', '/dialogue'],
];

function slotKeyToHref(slotKey: string) {
  for (const [prefix, href] of SLOT_HREF_MAP) {
    if (slotKey.startsWith(prefix)) return href;
  }
  return '/notifications';
}

export async function GET() {
  if (!hasSupabaseServerEnv) {
    return NextResponse.json({ items: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('notification_delivery_logs')
    .select('id, slot_key, title, body, status, created_at')
    .eq('user_id', user.id)
    .in('status', ['sent', 'failed'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: '알림 내역을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  const items = (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    slotKey: row.slot_key as string,
    status: row.status as 'sent' | 'failed',
    createdAt: row.created_at as string,
    href: slotKeyToHref(row.slot_key as string),
  }));

  return NextResponse.json({ items });
}
