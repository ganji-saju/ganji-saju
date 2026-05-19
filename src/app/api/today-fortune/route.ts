import { NextRequest, NextResponse } from 'next/server';
import { loadSajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { buildSajuInterpretationGrounding, buildSajuReport } from '@/domain/saju/report';
import { createClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { createReading, resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { normalizeMoonlightCounselor } from '@/lib/counselors';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';

export const runtime = 'nodejs';

function parseTodayPayload(payload: unknown): TodayFortuneBirthPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;

  return {
    concernId:
      typeof data.concernId === 'string' ? (data.concernId as TodayFortuneBirthPayload['concernId']) : 'general',
    calendarType: data.calendarType === 'lunar' ? 'lunar' : 'solar',
    timeRule:
      data.timeRule === 'trueSolarTime' ||
      data.timeRule === 'nightZi' ||
      data.timeRule === 'earlyZi'
        ? (data.timeRule as TodayFortuneBirthPayload['timeRule'])
        : 'standard',
    year: typeof data.year === 'string' ? data.year : '',
    month: typeof data.month === 'string' ? data.month : '',
    day: typeof data.day === 'string' ? data.day : '',
    hour: typeof data.hour === 'string' ? data.hour : '',
    minute: typeof data.minute === 'string' ? data.minute : '',
    unknownBirthTime: data.unknownBirthTime === true,
    gender: typeof data.gender === 'string' ? data.gender : '',
    birthLocationCode: typeof data.birthLocationCode === 'string' ? data.birthLocationCode : '',
    birthLocationLabel: typeof data.birthLocationLabel === 'string' ? data.birthLocationLabel : '',
    birthLatitude: typeof data.birthLatitude === 'string' ? data.birthLatitude : '',
    birthLongitude: typeof data.birthLongitude === 'string' ? data.birthLongitude : '',
  };
}

export async function POST(req: NextRequest) {
  const rawPayload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const payload = parseTodayPayload(rawPayload);

  if (!payload) {
    return NextResponse.json({ error: '오늘 운세 요청 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const parsed = resolveUnifiedBirthInput(payload, {
    requireGender: false,
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const sajuData = loadSajuDataV2(parsed.input, null);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const counselorId = normalizeMoonlightCounselor(rawPayload?.counselorId);

  // PR #166 — 사용자 이름 누락 fix. 로그인 사용자는 profile.display_name 자동 주입.
  // TodayFortuneBirthPayload 에 name 필드가 없어서 input.name = undefined 였고,
  // result.userName 이 null 이 되어 hero 에서 "달빛이님" fallback 으로 표시되던 버그.
  let resolvedDisplayName: string | undefined;
  if (user?.id) {
    try {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const name = (profileRow as { display_name?: string | null } | null)?.display_name?.trim();
      if (name) resolvedDisplayName = name;
    } catch {
      // silent — 이름 없어도 풀이는 정상 동작.
    }
  }
  // 클라이언트가 직접 보낸 name 도 지원 (비로그인 사용자가 닉네임 입력하는 경우 대비).
  if (!resolvedDisplayName && typeof rawPayload?.name === 'string') {
    const clientName = rawPayload.name.trim();
    if (clientName) resolvedDisplayName = clientName;
  }
  const enrichedInput = resolvedDisplayName
    ? { ...parsed.input, name: resolvedDisplayName }
    : parsed.input;

  let sourceSessionId = toSlug(parsed.input);
  let persistedGrounding = buildSajuInterpretationGrounding(
    parsed.input,
    sajuData,
    buildSajuReport(parsed.input, sajuData, 'today')
  );
  let persistedKasiComparison = null;

  if (hasSupabaseServiceEnv) {
    try {
      sourceSessionId = await createReading(parsed.input, user?.id ?? null);
      const persistedReading = await resolveReading(sourceSessionId);
      if (persistedReading) {
        persistedGrounding = persistedReading.grounding;
        persistedKasiComparison = persistedReading.kasiComparison;
      }
    } catch {
      sourceSessionId = toSlug(parsed.input);
    }
  }

  const result = buildTodayFortuneFreeResult(enrichedInput, sajuData, {
    concernId: payload.concernId,
    sourceSessionId,
    calendarType: payload.calendarType,
    timeRule: payload.timeRule,
    counselorId,
    grounding: persistedGrounding,
    kasiComparison: persistedKasiComparison,
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}
