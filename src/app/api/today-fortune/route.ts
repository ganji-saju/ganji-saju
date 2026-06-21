import { NextRequest, NextResponse } from 'next/server';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import { buildSajuInterpretationGrounding, buildSajuReport } from '@/domain/saju/report';
import { createClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { createReading, findReadingByInput, resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { normalizeMoonlightCounselor } from '@/lib/counselors';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { resolveTodayDisplayName } from '@/lib/today-fortune/resolve-display-name';
import { generateTodayFortuneNarrative } from '@/server/ai/today-fortune/service';
import { buildTodayCaseSummaries } from '@/server/today-fortune/today-case-summaries';
import type { UserSituation } from '@/lib/saju/types';

/**
 * 사용자 상황 객체를 한 줄 한국어 요약으로 변환.
 * 한자 금지. null/빈 입력은 null 반환.
 */
function summarizeUserSituation(s: UserSituation | null): string | null {
  if (!s) return null;

  const occupationMap: Record<string, string> = {
    employee: '직장인',
    'self-employed': '자영업',
    student: '학생',
    homemaker: '주부',
    'job-seeking': '구직중',
    other: '기타',
  };

  const relationshipMap: Record<string, string> = {
    single: '미혼',
    dating: '연애 중',
    married: '기혼',
    separated: '이별',
  };

  const parts: string[] = [];
  if (s.occupation) {
    const label = occupationMap[s.occupation];
    if (label) parts.push(label);
  }
  if (s.relationshipStatus) {
    const label = relationshipMap[s.relationshipStatus];
    if (label) parts.push(label);
  }

  if (parts.length === 0) return null;
  return parts.join(' · ');
}

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

  const sajuData = buildFreshTodaySajuData(parsed.input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const counselorId = normalizeMoonlightCounselor(rawPayload?.counselorId);

  // PR #166 + 2026-06-05 — 오늘운세 입력엔 이름 필드가 없어 hero 가 "달빛이" fallback 으로
  //   표시되던 이슈. profile.display_name → 소셜 로그인 메타데이터 → 클라이언트 입력 순으로 보강.
  //   (display_name 이 비어 있어도 소셜 로그인 이름이 있으면 hero 에 실명 노출.)
  let profileDisplayName: string | null = null;
  if (user?.id) {
    try {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      profileDisplayName =
        (profileRow as { display_name?: string | null } | null)?.display_name ?? null;
    } catch {
      // silent — 이름 없어도 풀이는 정상 동작.
    }
  }
  const resolvedDisplayName = resolveTodayDisplayName({
    profileDisplayName,
    authMetadata: user?.user_metadata ?? null,
    clientName: rawPayload?.name,
  });
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
      // 2026-05-24 — 매 생성마다 새 reading(UUID)을 만들면 sourceSessionId 가 휘발성이 돼
      //   재방문/재생성 때 결제·결과 식별이 깨졌다(결제 무한반복의 근본 원인 중 하나).
      //   로그인 사용자는 동일 identity 의 기존 reading 을 재사용해 안정화한다.
      const existingReading = user?.id ? await findReadingByInput(user.id, parsed.input) : null;
      if (existingReading) {
        sourceSessionId = existingReading.id;
        persistedGrounding = existingReading.grounding;
        persistedKasiComparison = existingReading.kasiComparison;
      } else {
        sourceSessionId = await createReading(parsed.input, user?.id ?? null);
        const persistedReading = await resolveReading(sourceSessionId);
        if (persistedReading) {
          persistedGrounding = persistedReading.grounding;
          persistedKasiComparison = persistedReading.kasiComparison;
        }
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

  // 오늘운세 무료 LLM 풀이(플래그 ON + 로그인 시). null 이면 결정론 유지.
  if (user?.id) {
    const caseSummaries = buildTodayCaseSummaries({ sajuData });
    const situation = summarizeUserSituation(
      persistedGrounding?.personalizationContext?.userSituation ?? null
    );
    const narrative = await generateTodayFortuneNarrative({
      result,
      sajuData,
      caseSummaries,
      situation,
      userId: user.id,
    });
    if (narrative) {
      result.oneLine = { ...result.oneLine, headline: narrative.headline, body: narrative.body };
    }
  }

  return NextResponse.json({
    ok: true,
    result,
  });
}
