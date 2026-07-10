// 2026-07-10 — 보관함 오늘운세 '다시보기' 재현용 실행기록 데이터 레이어.
//
// 왜 결과 본문을 저장하지 않는가:
//   buildTodayFortuneFreeResult 는 (input, sajuData, options) 가 고정되면 결정론적이다
//   (LLM·Math.random 미사용, 유일한 암묵 입력이 getTodayPillarSnapshot 의 `now`).
//   따라서 `now`(= generatedAt) 만 앵커로 남기면 조회 시점에 동일 결과를 재계산할 수 있다.
//   본문 스냅샷을 저장하면 빌더가 개선될 때마다 과거 결과가 낡은 포맷으로 굳는다.
//
// ⚠️ 로그인 사용자에게만 적용되는 LLM 내러티브 오버레이(route.ts 의 oneLine 치환)는
//   비결정적이라 재현 대상이 아니다. 재현 뷰는 결정론 본문만 보여준다.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import { normalizeMoonlightCounselor, type MoonlightCounselorId } from '@/lib/counselors';
import type { ConcernId, TodayCalendarType, TodayTimeRule } from '@/lib/today-fortune/types';
import type { BirthInput } from '@/lib/saju/types';

export interface TodayFortuneRunRecord {
  id: string;
  readingId: string | null;
  sourceSessionId: string;
  /** KST dateKey (YYYY-MM-DD) */
  occurredOn: string;
  /** 생성 당시의 `now` — 재현 시 빌더에 그대로 주입. */
  generatedAt: string;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  calendarType: TodayCalendarType;
  timeRule: TodayTimeRule;
  displayName: string | null;
  input: BirthInput;
  createdAt: string;
}

export interface RecordTodayFortuneRunParams {
  userId: string;
  readingId: string | null;
  sourceSessionId: string;
  occurredOn: string;
  generatedAt: Date;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  calendarType: TodayCalendarType;
  timeRule: TodayTimeRule;
  displayName: string | null;
  input: BirthInput;
}

interface TodayFortuneRunRow {
  id: string;
  reading_id: string | null;
  source_session_id: string;
  occurred_on: string;
  generated_at: string;
  concern_id: string;
  counselor_id: string | null;
  calendar_type: string;
  time_rule: string;
  display_name: string | null;
  input_json: unknown;
  created_at: string;
}

const RUN_SELECT =
  'id, reading_id, source_session_id, occurred_on, generated_at, concern_id, counselor_id, calendar_type, time_rule, display_name, input_json, created_at';

export function buildTodayFortuneRunSummary(occurredOn: string) {
  return `${occurredOn}에 본 오늘운세 무료 풀이`;
}

function normalizeCalendarType(value: unknown): TodayCalendarType {
  return value === 'lunar' ? 'lunar' : 'solar';
}

const TIME_RULES: readonly TodayTimeRule[] = [
  'standard',
  'trueSolarTime',
  'nightZi',
  'earlyZi',
];

function normalizeTimeRule(value: unknown): TodayTimeRule {
  return TIME_RULES.includes(value as TodayTimeRule) ? (value as TodayTimeRule) : 'standard';
}

function mapRow(row: TodayFortuneRunRow): TodayFortuneRunRecord {
  return {
    id: row.id,
    readingId: row.reading_id,
    sourceSessionId: row.source_session_id,
    // date 컬럼은 'YYYY-MM-DD' 로 오지만, 드라이버가 타임스탬프를 붙여줄 여지를 잘라낸다.
    occurredOn: String(row.occurred_on).slice(0, 10),
    generatedAt: row.generated_at,
    concernId: normalizeConcernId(row.concern_id),
    counselorId: row.counselor_id ? normalizeMoonlightCounselor(row.counselor_id) : null,
    calendarType: normalizeCalendarType(row.calendar_type),
    timeRule: normalizeTimeRule(row.time_rule),
    displayName: row.display_name,
    input: (row.input_json ?? {}) as BirthInput,
    createdAt: row.created_at,
  };
}

/**
 * 무료 오늘운세 생성 시 1행 기록. 실패는 비차단(호출부에서 try/catch).
 * 같은 (user, session, 날짜, 고민) 재실행은 최초 행을 유지해 generatedAt 앵커를 보존한다.
 */
export async function recordTodayFortuneRun(
  params: RecordTodayFortuneRunParams
): Promise<void> {
  if (!hasSupabaseServiceEnv) return;
  const service = await createServiceClient();
  await service
    .from('today_fortune_runs')
    .upsert(
      {
        user_id: params.userId,
        reading_id: params.readingId,
        source_session_id: params.sourceSessionId,
        occurred_on: params.occurredOn,
        generated_at: params.generatedAt.toISOString(),
        concern_id: params.concernId,
        counselor_id: params.counselorId,
        calendar_type: params.calendarType,
        time_rule: params.timeRule,
        display_name: params.displayName,
        input_json: params.input,
      },
      {
        onConflict: 'user_id,source_session_id,occurred_on,concern_id',
        ignoreDuplicates: true,
      }
    );
}

export async function listTodayFortuneRunsForUser(
  userId: string | null | undefined,
  limit = 30
): Promise<TodayFortuneRunRecord[]> {
  if (!userId || !hasSupabaseServiceEnv) return [];
  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_runs')
    .select(RUN_SELECT)
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as TodayFortuneRunRow[]).map(mapRow);
}

export async function getTodayFortuneRunById(
  userId: string | null | undefined,
  id: string
): Promise<TodayFortuneRunRecord | null> {
  if (!userId || !id || !hasSupabaseServiceEnv) return null;
  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_runs')
    .select(RUN_SELECT)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as unknown as TodayFortuneRunRow);
}
