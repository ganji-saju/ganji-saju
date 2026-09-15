// 2026-09-14 — 하루 1회에 막힌 다른 사람(가족 등) 사주로 '오늘 자세히'를 바로 결제하는 경로.
//   체크아웃엔 그 입력의 reading id(slug)가 필요하다. 여기선 **무료 결과를 만들지도, 무료 1회를
//   쓰지도 않고** reading 만 만들거나 재사용해 id 를 돌려준다. 로그인은 결제 버튼이 요구한다
//   (체크아웃 → /login → 같은 slug 로 복귀). reading 규칙은 POST /api/today-fortune 과 같다.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { createReading, findReadingByInput } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { parseTodayPayload } from '../route';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const payload = parseTodayPayload(await req.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ error: '오늘 운세 요청 정보가 올바르지 않습니다.' }, { status: 400 });
  }
  const parsed = resolveUnifiedBirthInput(payload, { requireGender: false });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // DB 가 없거나 실패하면 결정론 slug — 체크아웃·unlock 의 resolveReading 이 slug 도 푼다(route.ts 와 같은 폴백).
  let readingId = toSlug(parsed.input);
  if (hasSupabaseServiceEnv) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const existing = user?.id ? await findReadingByInput(user.id, parsed.input) : null;
      readingId = existing?.id ?? (await createReading(parsed.input, user?.id ?? null));
    } catch {
      // 폴백 slug 유지
    }
  }

  return NextResponse.json({ ok: true, readingId });
}
