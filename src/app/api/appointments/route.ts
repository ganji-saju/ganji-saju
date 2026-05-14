// 2026-05-14: 1:1 상담 예약 API.
// POST: 새 예약 생성 (status='requested').
// GET: 본인 예약 목록 (앞으로 다가올 + 최근 완료/취소).
// 같은 선생님×같은 날짜×같은 시간 슬롯에 이미 requested/confirmed 가 있으면 409.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';

const ALLOWED_TOPICS = new Set(['love', 'career', 'money', 'family', 'life']);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type AppointmentPayload = {
  teacherKey?: unknown;
  topic?: unknown;
  date?: unknown; // YYYY-MM-DD
  time?: unknown; // HH:MM
  note?: unknown;
};

export async function POST(req: NextRequest) {
  if (!hasSupabaseServerEnv) {
    return NextResponse.json(
      { error: '예약 처리에 필요한 서버 설정이 누락되었습니다.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as AppointmentPayload | null;
  if (!payload) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const teacherKey =
    typeof payload.teacherKey === 'string' && payload.teacherKey.trim().length > 0
      ? payload.teacherKey.trim()
      : 'moonlight';
  const topic = typeof payload.topic === 'string' ? payload.topic : '';
  const date = typeof payload.date === 'string' ? payload.date : '';
  const time = typeof payload.time === 'string' ? payload.time : '';
  const note =
    typeof payload.note === 'string' ? payload.note.slice(0, 500).trim() : '';

  if (!ALLOWED_TOPICS.has(topic)) {
    return NextResponse.json({ error: '상담 주제를 선택해주세요.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!TIME_PATTERN.test(time)) {
    return NextResponse.json({ error: '시간 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  // 과거 날짜 차단
  const todayUtc = new Date();
  const todayYmd = `${todayUtc.getFullYear()}-${String(todayUtc.getMonth() + 1).padStart(2, '0')}-${String(todayUtc.getDate()).padStart(2, '0')}`;
  if (date < todayYmd) {
    return NextResponse.json({ error: '지난 날짜에는 예약할 수 없습니다.' }, { status: 400 });
  }

  // 슬롯 중복 확인 (같은 선생님의 같은 슬롯).
  const { data: existing, error: existingErr } = await supabase
    .from('appointments')
    .select('id, user_id, status')
    .eq('teacher_key', teacherKey)
    .eq('appointment_date', date)
    .eq('appointment_time', time)
    .in('status', ['requested', 'confirmed']);

  if (existingErr) {
    return NextResponse.json(
      { error: '예약 가능 여부를 확인하지 못했습니다.' },
      { status: 500 }
    );
  }

  if (existing && existing.length > 0) {
    const ownByMe = existing.some((row) => row.user_id === user.id);
    if (ownByMe) {
      return NextResponse.json(
        { error: '이미 같은 시간으로 예약하셨습니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: '해당 시간은 이미 예약된 슬롯입니다.' },
      { status: 409 }
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('appointments')
    .insert({
      user_id: user.id,
      teacher_key: teacherKey,
      topic,
      appointment_date: date,
      appointment_time: time,
      note,
    })
    .select('id, teacher_key, topic, appointment_date, appointment_time, note, status, created_at')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message || '예약을 생성하지 못했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ appointment: inserted });
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
    .from('appointments')
    .select(
      'id, teacher_key, topic, appointment_date, appointment_time, note, status, created_at'
    )
    .eq('user_id', user.id)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: '예약 목록을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}
