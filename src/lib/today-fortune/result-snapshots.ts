import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { toSlug } from '@/lib/saju/pillars';
import { isReadingId, type ReadingRecord } from '@/lib/saju/readings';
import type {
  ConcernId,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
} from '@/lib/today-fortune/types';
import type { MoonlightCounselorId } from '@/lib/counselors';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';
import { attachTodayPremiumNarrative } from '@/server/ai/today-premium-service';
import { getUserProfileById } from '@/lib/profile';
import { getTodayFortuneRunDisplayName } from '@/lib/today-fortune/run-log';
import { resolveFamilySubjectNameForUser } from '@/lib/saju/family-access';
import { resolveTodayDisplayName } from '@/lib/today-fortune/resolve-display-name';
import type { BirthInput } from '@/lib/saju/types';

// 2026-06-05 Bug A(detail page) — 오늘 payload 엔 이름 필드가 없어 persisted reading.input.name
//   이 undefined → snapshot 으로 빌드되는 detail hero 가 항상 '달빛이' fallback.
//   snapshot 시점에 profile.display_name 을 input.name 으로 보강(순수). 빈 값이면 원본 유지.
//   2026-08-31 — 원본에 이름이 있으면 그게 대상자 본인의 이름이므로 **덮어쓰지 않는다**.
//   (/saju/new 가족 제출은 reading.input.name 에 가족 이름을 담는데, 계정 주인 표시명으로
//    무조건 치환돼 유료 상세·달력이 남의 이름으로 호명하던 원인.)
export function applyDisplayNameToInput(
  input: BirthInput,
  displayName: string | null | undefined
): BirthInput {
  if (input.name?.trim()) return input;
  const trimmed = displayName?.trim();
  return trimmed ? { ...input, name: trimmed } : input;
}

// 2026-06-05 Bug A 재발(전 결제 후 hero 가 '달빛이') — 스냅샷 이름 해석이 profile.display_name
//   단일 소스라 소셜 로그인(display_name 미설정) 유저가 '달빛이'로 떨어졌다.
//   today-fortune API(route.ts)와 동일하게 소셜 메타데이터까지 보도록 resolver 일원화한다.
//   I/O(프로필·auth 메타 조회)는 주입형 deps 로 분리해 순수 단위 테스트가 가능하다.
export interface SnapshotDisplayNameDeps {
  loadProfileDisplayName: (userId: string) => Promise<string | null | undefined>;
  loadAuthMetadata: (userId: string) => Promise<Record<string, unknown> | null>;
  /**
   * 2026-08-31 — 이 사주가 등록된 본인·가족 중 누구인지(정체성 매칭) 이름으로 답한다.
   *   프로필·소셜보다 먼저 본다: 계정 주인 이름은 "이 계정의 이름"일 뿐 "이 사주 주인의
   *   이름"이 아니라서, 가족 오늘운세·달력이 전부 계정 주인으로 호명되던 원인이었다.
   */
  loadSubjectName?: (userId: string, input: BirthInput) => Promise<string | null>;
  /**
   * 그 오늘운세를 실행할 때 폼이 보낸 이름(today_fortune_runs.display_name).
   *   등록 가족이 아닌 대상(폼 직접 입력)에서 무료 결과와 결제 후 상세의 호명이
   *   갈리지 않게 하는 다리 — 계정 표시명 폴백보다 앞선다.
   */
  loadRunDisplayName?: (userId: string, sourceSessionId: string) => Promise<string | null>;
}

export async function resolveSnapshotInputName(
  userId: string | null | undefined,
  deps: SnapshotDisplayNameDeps
): Promise<string | undefined> {
  if (!userId) return undefined;
  let profileDisplayName: string | null | undefined;
  let authMetadata: Record<string, unknown> | null = null;
  try {
    profileDisplayName = await deps.loadProfileDisplayName(userId);
  } catch {
    // 프로필 조회 실패는 비차단 — 다음 소스(소셜 메타데이터)로 진행.
  }
  try {
    authMetadata = await deps.loadAuthMetadata(userId);
  } catch {
    // auth 메타 조회 실패도 비차단 — '달빛이' fallback 으로 graceful degrade.
  }
  return resolveTodayDisplayName({ profileDisplayName, authMetadata });
}

export const DEFAULT_SNAPSHOT_NAME_DEPS: SnapshotDisplayNameDeps = {
  loadProfileDisplayName: async (userId) => (await getUserProfileById(userId)).displayName,
  loadAuthMetadata: async (userId) => {
    if (!hasSupabaseServiceEnv) return null;
    const service = await createServiceClient();
    const { data } = await service.auth.admin.getUserById(userId);
    return data?.user?.user_metadata ?? null;
  },
  loadSubjectName: (userId, input) => resolveFamilySubjectNameForUser(userId, input),
  loadRunDisplayName: (userId, sourceSessionId) =>
    getTodayFortuneRunDisplayName(userId, sourceSessionId),
};

// 2026-07-07 — reading.input(오늘 payload)은 이름을 안 담으므로, 표시 이름(프로필→소셜 메타)을
//   해석해 input.name 을 보강한 사본을 만든다. iljin/카테고리 메시지의 "[이름] 님" 이 '선생님'
//   fallback 으로 새지 않도록 today detail·운세 달력 등 모든 소비 지점이 이걸 거쳐야 한다.
//   ⚠️ toSlug(pillars.ts)는 input.name 을 포함하므로, readingKey/entitlement 계산엔 원본
//   reading.input 을 쓰고(슬러그 안정), 이 named 사본은 메시지 빌더에만 넘긴다.
/**
 * 이 사주를 누구로 호명할지 해석한다.
 *   우선순위: ①원본 input.name ②등록된 본인·가족(정체성 매칭) ③그 실행에 쓴 폼 이름(run 기록)
 *   ④계정 표시명(프로필→소셜). ④까지 비면 호출부가 '달빛이' 폴백.
 *   ③이 있어야 "무료는 철수 · 결제 후 상세는 계정 주인 이름"으로 갈리지 않는다.
 */
export async function resolveNamedReadingInput(
  input: BirthInput,
  userId: string | null | undefined,
  deps: SnapshotDisplayNameDeps = DEFAULT_SNAPSHOT_NAME_DEPS,
  sourceSessionId?: string | null
): Promise<BirthInput> {
  // 이미 이름이 있으면 조회 자체가 불필요(그게 대상자 이름이다).
  if (input.name?.trim()) return input;
  let subjectName: string | null = null;
  if (userId && deps.loadSubjectName) {
    try {
      subjectName = await deps.loadSubjectName(userId, input);
    } catch {
      // 가족 조회 실패는 비차단 — 다음 후보로 진행.
    }
  }
  if (!subjectName && userId && sourceSessionId && deps.loadRunDisplayName) {
    try {
      subjectName = await deps.loadRunDisplayName(userId, sourceSessionId);
    } catch {
      // 실행기록 조회 실패도 비차단 — 계정 표시명 폴백으로 진행.
    }
  }
  const name = subjectName ?? (await resolveSnapshotInputName(userId, deps));
  return applyDisplayNameToInput(input, name);
}

export const TODAY_FORTUNE_RESULT_SNAPSHOT_VERSION = 'today-fortune-result-snapshot/v1';
export const TODAY_FORTUNE_RESULT_BUILDER_VERSION = 'today-fortune-builder/v1';

export interface TodayFortuneResultSnapshot {
  id: string;
  userId: string;
  readingId: string | null;
  readingKey: string;
  sourceSessionId: string | null;
  sourceSlug: string | null;
  scopeKey: string;
  occurredOn: string;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  inputJson: Record<string, unknown>;
  freeResult: TodayFortuneFreeResult;
  premiumResult: TodayFortunePremiumResult;
  snapshotJson: Record<string, unknown>;
  snapshotVersion: string;
  builderVersion: string;
  accessSource: string | null;
  entitlementId: string | null;
  paymentOrderId: string | null;
  paymentKey: string | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface TodayFortuneResultSnapshotRow {
  id: string;
  user_id: string;
  reading_id: string | null;
  reading_key: string;
  source_session_id: string | null;
  source_slug: string | null;
  scope_key: string;
  occurred_on: string;
  concern_id: ConcernId;
  counselor_id: MoonlightCounselorId | null;
  input_json: Record<string, unknown> | null;
  free_result_json: TodayFortuneFreeResult;
  premium_result_json: TodayFortunePremiumResult;
  snapshot_json: Record<string, unknown> | null;
  snapshot_version: string;
  builder_version: string;
  access_source: string | null;
  entitlement_id: string | null;
  payment_order_id: string | null;
  payment_key: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface BuildTodayFortuneSnapshotContentInput {
  reading: ReadingRecord;
  sourceSessionId: string;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  now?: Date;
  /** 표시 이름 해석 deps 주입(테스트용). 미지정 시 프로필/소셜 메타 조회. */
  nameDeps?: SnapshotDisplayNameDeps;
}

export interface StoreTodayFortuneResultSnapshotInput
  extends BuildTodayFortuneSnapshotContentInput {
  userId: string;
  accessSource?: string | null;
  entitlementId?: string | null;
  paymentOrderId?: string | null;
  paymentKey?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildTodayFortuneResultSnapshotScopeKey(input: {
  readingKey: string;
  occurredOn: string;
  concernId: ConcernId;
}) {
  return `today-detail:${input.readingKey}:${input.occurredOn}:${input.concernId}`;
}

export function buildTodayFortuneResultSnapshotHref(id: string) {
  return `/today-fortune/snapshots/${encodeURIComponent(id)}`;
}

export function buildTodayFortuneResultSnapshotSummary(occurredOn: string) {
  return `${occurredOn}에 보관된 오늘운세 상세 풀이`;
}

function mapRow(row: TodayFortuneResultSnapshotRow): TodayFortuneResultSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    readingId: row.reading_id,
    readingKey: row.reading_key,
    sourceSessionId: row.source_session_id,
    sourceSlug: row.source_slug,
    scopeKey: row.scope_key,
    occurredOn: row.occurred_on,
    concernId: row.concern_id,
    counselorId: row.counselor_id,
    inputJson: row.input_json ?? {},
    freeResult: row.free_result_json,
    premiumResult: row.premium_result_json,
    snapshotJson: row.snapshot_json ?? {},
    snapshotVersion: row.snapshot_version,
    builderVersion: row.builder_version,
    accessSource: row.access_source,
    entitlementId: row.entitlement_id,
    paymentOrderId: row.payment_order_id,
    paymentKey: row.payment_key,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SNAPSHOT_SELECT = [
  'id',
  'user_id',
  'reading_id',
  'reading_key',
  'source_session_id',
  'source_slug',
  'scope_key',
  'occurred_on',
  'concern_id',
  'counselor_id',
  'input_json',
  'free_result_json',
  'premium_result_json',
  'snapshot_json',
  'snapshot_version',
  'builder_version',
  'access_source',
  'entitlement_id',
  'payment_order_id',
  'payment_key',
  'generated_at',
  'created_at',
  'updated_at',
].join(', ');

// 2026-06-05 Phase 2 (PR #393) — premium 결과에 LLM 깊은 풀이(aiNarrative)를 주입하므로
//   동기 → async 전환. 호출처(upsert·unlock route GET/POST)는 await 연쇄.
//   플래그 OFF/실패/미설정 키 시 aiNarrative=null 로 graceful degrade(기존 카드 그대로).
export async function buildTodayFortuneSnapshotContent({
  reading,
  sourceSessionId,
  concernId,
  counselorId,
  now = new Date(),
  nameDeps = DEFAULT_SNAPSHOT_NAME_DEPS,
}: BuildTodayFortuneSnapshotContentInput) {
  const todaySajuData = buildFreshTodaySajuData(reading.input, { now });
  // 2026-06-05 Bug A — reading.input(오늘 payload)엔 이름이 없어 detail hero 가 '달빛이' 로
  //   나오던 이슈. snapshot 시점에 이름을 보강한다(없으면 fallback 유지). 이름은 사주 계산과
  //   무관(userName 표기에만 영향)하므로 saju data 는 reading.input 그대로.
  //   2026-08-31 — 보강 순서를 "원본 이름 → 등록 가족 정체성 매칭 → 계정 표시명"으로 통일.
  //   ⚠️여기서 만든 이름은 본문 문자열(iljin 메시지·LLM 산문)에 굳어 사후 교정이 어렵다.
  const namedInput = await resolveNamedReadingInput(
    reading.input,
    reading.userId,
    nameDeps,
    sourceSessionId
  );
  const freeResult = buildTodayFortuneFreeResult(namedInput, todaySajuData, {
    concernId,
    sourceSessionId,
    calendarType: 'solar',
    timeRule: 'standard',
    counselorId,
    grounding: reading.grounding,
    kasiComparison: reading.kasiComparison,
    now,
  });
  // 2026-07-07 — premium 도 free 와 동일하게 namedInput 사용(이전엔 reading.input 전달 →
  //   detail '오늘의 흐름' iljin 메시지의 "[이름] 님" 이 '선생님 님' 으로 새던 버그).
  const basePremiumResult = buildTodayFortunePremiumResult(
    namedInput,
    todaySajuData,
    concernId,
    reading.grounding,
    reading.kasiComparison,
    { now }
  );
  const premiumResult = await attachTodayPremiumNarrative(freeResult, basePremiumResult, {
    userId: reading.userId,
  });
  const readingKey = toSlug(reading.input);
  const occurredOn = freeResult.dateKey;
  const scopeKey = buildTodayFortuneResultSnapshotScopeKey({
    readingKey,
    occurredOn,
    concernId,
  });
  const generatedAt = now.toISOString();

  return {
    readingKey,
    occurredOn,
    scopeKey,
    generatedAt,
    freeResult,
    premiumResult,
    snapshotJson: {
      kind: TODAY_FORTUNE_RESULT_SNAPSHOT_VERSION,
      productId: 'today-detail',
      readingKey,
      sourceSessionId,
      concernId,
      counselorId,
      occurredOn,
      generatedAt,
      builderVersion: TODAY_FORTUNE_RESULT_BUILDER_VERSION,
    },
  };
}

export async function getTodayFortuneResultSnapshotById(
  userId: string | null | undefined,
  id: string | null | undefined
) {
  if (!userId || !id || !hasSupabaseServiceEnv) return null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as unknown as TodayFortuneResultSnapshotRow);
}

export async function getTodayFortuneResultSnapshotByScope(
  userId: string | null | undefined,
  scopeKey: string | null | undefined
) {
  if (!userId || !scopeKey || !hasSupabaseServiceEnv) return null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .eq('scope_key', scopeKey)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as unknown as TodayFortuneResultSnapshotRow);
}

export async function listTodayFortuneResultSnapshotsForUser(
  userId: string,
  options: { limit?: number; offset?: number } = {}
) {
  if (!hasSupabaseServiceEnv) return [];

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 30;
  const service = await createServiceClient();
  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return [];
  return ((data as unknown as TodayFortuneResultSnapshotRow[] | null) ?? []).map(mapRow);
}

export async function upsertTodayFortuneResultSnapshot(
  input: StoreTodayFortuneResultSnapshotInput
) {
  if (!hasSupabaseServiceEnv) return null;

  const content = await buildTodayFortuneSnapshotContent(input);
  const readingId = isReadingId(input.reading.id) ? input.reading.id : null;
  const service = await createServiceClient();
  const payload = {
    user_id: input.userId,
    reading_id: readingId,
    reading_key: content.readingKey,
    source_session_id: input.sourceSessionId,
    source_slug: input.sourceSessionId,
    scope_key: content.scopeKey,
    occurred_on: content.occurredOn,
    concern_id: input.concernId,
    counselor_id: input.counselorId,
    input_json: asRecord(input.reading.input),
    free_result_json: content.freeResult,
    premium_result_json: content.premiumResult,
    snapshot_json: content.snapshotJson,
    snapshot_version: TODAY_FORTUNE_RESULT_SNAPSHOT_VERSION,
    builder_version: TODAY_FORTUNE_RESULT_BUILDER_VERSION,
    access_source: input.accessSource ?? null,
    entitlement_id: input.entitlementId ?? null,
    payment_order_id: input.paymentOrderId ?? null,
    payment_key: input.paymentKey ?? null,
    generated_at: content.generatedAt,
  };

  const { data, error } = await service
    .from('today_fortune_result_snapshots')
    .upsert(payload, {
      onConflict: 'user_id,scope_key',
    })
    .select(SNAPSHOT_SELECT)
    .single();

  if (error || !data) {
    console.warn('today fortune result snapshot write failed', error);
    return null;
  }

  return mapRow(data as unknown as TodayFortuneResultSnapshotRow);
}
