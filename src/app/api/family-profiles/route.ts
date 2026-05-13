import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createFamilyProfile,
  deleteFamilyProfile,
  updateFamilyProfile,
} from '@/lib/profile';
import { parseFamilyProfile } from './route-helpers';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const profile = parseFamilyProfile(await req.json().catch(() => null));
  if (!profile) {
    return NextResponse.json(
      { error: '가족 프로필 정보가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  try {
    const id = await createFamilyProfile(user.id, profile);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '가족 프로필을 저장하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const id =
    payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).id === 'string'
      ? ((payload as Record<string, unknown>).id as string)
      : '';
  const profile = parseFamilyProfile(payload);

  if (!id || !profile) {
    return NextResponse.json(
      { error: '수정할 가족 프로필 정보가 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  try {
    await updateFamilyProfile(user.id, id, profile);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '가족 프로필을 수정하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const id =
    payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).id === 'string'
      ? ((payload as Record<string, unknown>).id as string)
      : '';

  if (!id) {
    return NextResponse.json({ error: '삭제할 프로필이 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const deleted = await deleteFamilyProfile(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: '삭제할 가족 프로필을 찾지 못했습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '가족 프로필을 삭제하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}
