import { NextRequest, NextResponse } from 'next/server';
import {
  recordChapterFeedback,
  type ChapterId,
} from '@/lib/saju/chapter-feedback';
import { createClient } from '@/lib/supabase/server';

// 2026-05-20 V2-5 PR R — 챕터 피드백 POST endpoint (옵션 A: 별점 + Yes/No).
//
// 입력 schema:
//   { readingId: string, chapterId: 1~9, rating?: 1~5, helpfulBool?: boolean, comment?: string }
//
// 응답:
//   { ok: true, saved: ChapterFeedbackRecord | null }
//   ok=false 시 status 400 + error 메시지.

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function readBoolean(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];
  if (typeof value === 'boolean') return value;
  return null;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json(
      { ok: false, error: '피드백 정보가 필요합니다.' },
      { status: 400 }
    );
  }

  const readingId = readString(payload, 'readingId');
  const chapterIdRaw = readNumber(payload, 'chapterId');
  const rating = readNumber(payload, 'rating');
  const helpfulBool = readBoolean(payload, 'helpfulBool');
  const comment = readString(payload, 'comment') || null;

  if (!readingId) {
    return NextResponse.json(
      { ok: false, error: 'readingId 가 필요합니다.' },
      { status: 400 }
    );
  }
  if (
    typeof chapterIdRaw !== 'number' ||
    chapterIdRaw < 1 ||
    chapterIdRaw > 9 ||
    !Number.isInteger(chapterIdRaw)
  ) {
    return NextResponse.json(
      { ok: false, error: 'chapterId 는 1~9 정수여야 합니다.' },
      { status: 400 }
    );
  }
  const chapterId = chapterIdRaw as ChapterId;

  // rating 또는 helpfulBool 중 하나는 필수 (DB CHECK 제약과 일치).
  if (rating === null && helpfulBool === null) {
    return NextResponse.json(
      { ok: false, error: 'rating 또는 helpfulBool 중 하나는 필요합니다.' },
      { status: 400 }
    );
  }

  if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return NextResponse.json(
      { ok: false, error: 'rating 은 1~5 정수여야 합니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS 정책: user_id 가 auth.uid() 와 일치해야 INSERT/UPDATE 가능.
  // 비로그인 사용자 (user 없음) 는 피드백 저장 불가 — 401 반환.
  if (!user) {
    return NextResponse.json(
      { ok: false, error: '로그인 후 피드백을 남길 수 있어요.' },
      { status: 401 }
    );
  }

  const saved = await recordChapterFeedback({
    userId: user.id,
    readingId,
    chapterId,
    rating,
    helpfulBool,
    comment,
  });

  if (!saved) {
    return NextResponse.json(
      { ok: false, error: '피드백 저장에 실패했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved });
}
