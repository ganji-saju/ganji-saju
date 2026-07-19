import { NextRequest, NextResponse } from 'next/server';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import { buildSajuInterpretationGrounding, buildSajuReport } from '@/domain/saju/report';
import { createClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  createReading,
  findReadingByInput,
  isReadingId,
  resolveReading,
} from '@/lib/saju/readings';
import { recordTodayFortuneRun } from '@/lib/today-fortune/run-log';
import { toSlug } from '@/lib/saju/pillars';
import { normalizeMoonlightCounselor } from '@/lib/counselors';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { resolveTodayDisplayName } from '@/lib/today-fortune/resolve-display-name';
import { generateTodayFortuneNarrative } from '@/server/ai/today-fortune/service';
import { buildTodayCaseSummaries } from '@/server/today-fortune/today-case-summaries';
import type { UserSituation } from '@/lib/saju/types';
import {
  consumeFreeDaily,
  freeDailyLimitMessage,
  isFreeDailyExempt,
  isFreeDailyUsed,
} from '@/lib/free-usage/daily-limit';

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

  // 2026-07-10 — 보관함 재현('다시보기')의 앵커. 요청 시작 시각을 한 번만 고정해
  //   sajuData 계산과 결과 빌드가 같은 `now` 를 보도록 하고, 그 값을 실행기록에 남긴다.
  //   (기존엔 두 빌더가 각자 new Date() 를 호출 → 자정 경계에서 미세하게 어긋날 수 있었다.)
  const now = new Date();
  const sajuData = buildFreshTodaySajuData(parsed.input, { now });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2026-07-18 — 무료 하루 1회 제한(20260718 PPTX slide3 "다 하루 1번으로 제한").
  //   비로그인=쿠키 / 로그인=계정(consume_member_benefit) 병행. 멤버십 회원은 면제.
  //   2단계로 나눈다: 여기서는 **읽기 판정만** 하고(무거운 사주 계산·LLM 비용을 미리 차단),
  //   실제 소비는 결과를 성공적으로 만든 뒤에 한다. 한 번에 consume 하면 이후 계산이
  //   실패했을 때 사용자가 결과도 못 받고 오늘 기회만 잃는다.
  //   (검사~소비 사이 동시 요청이 둘 다 통과할 수 있으나, 무료 티어 제한이라 감수.)
  const memberExempt = await isFreeDailyExempt(user?.id ?? null);
  if (!memberExempt && (await isFreeDailyUsed('today', user?.id ?? null))) {
    return NextResponse.json(
      { error: freeDailyLimitMessage('today'), code: 'free_daily_limit' },
      { status: 429 }
    );
  }

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
    now,
  });

  // 2026-07-10 — 보관함 '다시보기' 재현용 실행기록. 결과 본문은 저장하지 않고,
  //   재계산에 필요한 입력(now·input·표시이름·옵션)만 남긴다(run-log.ts 주석 참조).
  //   비차단: 기록 실패가 무료 결과 응답을 막지 않는다.
  if (user?.id) {
    try {
      await recordTodayFortuneRun({
        userId: user.id,
        readingId: isReadingId(sourceSessionId) ? sourceSessionId : null,
        sourceSessionId,
        occurredOn: result.dateKey,
        generatedAt: now,
        concernId: result.concernId,
        counselorId,
        calendarType: payload.calendarType,
        timeRule: payload.timeRule,
        displayName: resolvedDisplayName ?? null,
        input: parsed.input,
      });
    } catch {
      // silent — 실행기록은 부가 기능.
    }
  }

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
      result.aiSource = narrative.source;
    }
  }

  const response = NextResponse.json({
    ok: true,
    result,
  });

  // 결과를 성공적으로 만든 뒤에야 하루 1회를 소비한다(위 판정과 짝).
  //   쿠키는 응답에 실어야 브라우저에 남고, 계정 카운트는 RPC 가 원자적으로 올린다.
  if (!memberExempt) {
    const spent = await consumeFreeDaily('today', user?.id ?? null);
    response.cookies.set(spent.cookie.name, spent.cookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: spent.cookie.maxAge,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}
