import { NextRequest, NextResponse } from 'next/server';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { createClient } from '@/lib/supabase/server';
import { getUserProfileById } from '@/lib/profile';
import { resolveMoonlightCounselor } from '@/lib/counselors';
import {
  getKoreaAccessDay,
  hasDetailReportAccess,
  hasTodayFortuneDailyAccess,
  hasTodayFortunePremiumAccess,
  hasTodayFortunePremiumAccessByReading,
  unlockTodayFortunePremium,
} from '@/lib/credits/detail-report-access';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import {
  buildTodayDetailScopeKey,
  getTasteProductEntitlement,
  hasTodayDetailEntitlementForDay,
} from '@/lib/product-entitlements';
import { todayDetailEntitlementScopeKeys } from '@/lib/saju/today-detail-access';
import type { ReadingRecord } from '@/lib/saju/readings';
import type { ConcernId } from '@/lib/today-fortune/types';
import type { MoonlightCounselorId } from '@/lib/counselors';
import {
  buildTodayFortuneResultSnapshotScopeKey,
  buildTodayFortuneSnapshotContent,
  getTodayFortuneResultSnapshotByScope,
  upsertTodayFortuneResultSnapshot,
} from '@/lib/today-fortune/result-snapshots';
import { resolveTodayFortuneUnlockAccess } from './route-helpers';

export const runtime = 'nodejs';

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

async function getOrCreateTodayDetailSnapshot(input: {
  userId: string;
  reading: ReadingRecord;
  readingKey: string;
  sourceSessionId: string;
  concernId: ConcernId;
  counselorId: MoonlightCounselorId | null;
  occurredOn: string;
  now: Date;
  accessSource: string | null;
}) {
  const scopeKey = buildTodayFortuneResultSnapshotScopeKey({
    readingKey: input.readingKey,
    occurredOn: input.occurredOn,
    concernId: input.concernId,
  });
  const existing = await getTodayFortuneResultSnapshotByScope(input.userId, scopeKey);
  if (existing) {
    return {
      snapshotId: existing.id,
      occurredOn: existing.occurredOn,
      freeResult: existing.freeResult,
      result: existing.premiumResult,
    };
  }

  const written = await upsertTodayFortuneResultSnapshot({
    userId: input.userId,
    reading: input.reading,
    sourceSessionId: input.sourceSessionId,
    concernId: input.concernId,
    counselorId: input.counselorId,
    now: input.now,
    accessSource: input.accessSource,
  });
  if (written) {
    return {
      snapshotId: written.id,
      occurredOn: written.occurredOn,
      freeResult: written.freeResult,
      result: written.premiumResult,
    };
  }

  const fallback = await buildTodayFortuneSnapshotContent({
    reading: input.reading,
    sourceSessionId: input.sourceSessionId,
    concernId: input.concernId,
    counselorId: input.counselorId,
    now: input.now,
  });
  return {
    snapshotId: null,
    occurredOn: fallback.occurredOn,
    freeResult: fallback.freeResult,
    result: fallback.premiumResult,
  };
}

// 2026-05-17 PR #201 — 자동 POST → 사용자 액션 UX 리팩토링.
//   detail page 새로고침 시 deduct trigger 안 함 (defense in depth — PR #199/#200
//   server-side idempotency 가 backstop 이지만 client 도 의도 명확히).
//   GET 은 read-only: entitlement check + content 반환, no deduct.
//   POST 는 기존 동작 (4-tier idempotency 후 first-time 차감).
export async function GET(req: NextRequest) {
  const sourceSessionId = req.nextUrl.searchParams.get('sourceSessionId')?.trim() ?? '';

  if (!sourceSessionId) {
    return NextResponse.json({ error: '열어볼 오늘 결과가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const reading = await resolveReading(sourceSessionId);
  if (!reading) {
    return NextResponse.json({ error: '오늘 결과를 다시 불러오지 못했습니다.' }, { status: 404 });
  }

  if (reading.userId && reading.userId !== user.id) {
    return NextResponse.json({ error: '본인의 결과만 열 수 있습니다.' }, { status: 403 });
  }

  const concernId = normalizeConcernId(req.nextUrl.searchParams.get('concernId'));
  const profile = await getUserProfileById(user.id);
  const counselorId = resolveMoonlightCounselor(
    req.nextUrl.searchParams.get('counselorId'),
    profile.preferredCounselor,
  );

  const readingKey = toSlug(reading.input);
  const now = new Date();
  const todayKey = getKoreaAccessDay(now);
  const accessSource = await resolveTodayFortuneUnlockAccess(
    user.id,
    {
      sourceSessionId,
      readingKey,
      scopeKey: buildTodayDetailScopeKey(sourceSessionId),
      todayKey,
    },
    {
      // 2026-05-24 정합성 fix — entitlement API(checkTodayDetailAccess)와 동일하게
      //   readingKey(안정) + legacy readingId(slug) scope + 같은날 fallback 으로 판정.
      //   (구) today:${sourceSessionId} 단일 조회는 세션마다 달라져 결제분을 못 찾았다.
      getTodayDetailEntitlement: async (userId) => {
        for (const sk of todayDetailEntitlementScopeKeys({ slug: sourceSessionId, readingKey })) {
          if (await getTasteProductEntitlement(userId, 'today-detail', sk)) return true;
        }
        return hasTodayDetailEntitlementForDay(userId, todayKey);
      },
      hasTodayFortunePremiumAccess,
      hasTodayFortunePremiumAccessByReading,
      hasDetailReportAccess,
      hasTodayFortuneDailyAccess,
    },
  );

  if (!accessSource) {
    // 아직 결제 안 됨 — content 안 줌. client 가 결제 흐름으로 redirect.
    return NextResponse.json({ ok: true, hasAccess: false, accessSource: null });
  }

  // entitlement 있음 — content 반환 (no deduct). 같은 날짜/고민의 유료 결과가 이미
  // 저장되어 있으면 snapshot 을 우선 반환해 보관함/재방문 내용이 바뀌지 않게 한다.
  const snapshot = await getOrCreateTodayDetailSnapshot({
    userId: user.id,
    reading,
    readingKey,
    concernId,
    sourceSessionId,
    counselorId,
    occurredOn: todayKey,
    now,
    accessSource,
  });

  return NextResponse.json({
    ok: true,
    hasAccess: true,
    accessSource,
    freeResult: snapshot.freeResult,
    result: snapshot.result,
    snapshotId: snapshot.snapshotId,
    snapshotOccurredOn: snapshot.occurredOn,
    access: accessSource === 'taste-product' ? 'purchased' : 'reused',
    counselorId,
  });
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sourceSessionId = payload ? readString(payload, 'sourceSessionId') : '';

  if (!sourceSessionId) {
    return NextResponse.json({ error: '열어볼 오늘 결과가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const reading = await resolveReading(sourceSessionId);
  if (!reading) {
    return NextResponse.json({ error: '오늘 결과를 다시 불러오지 못했습니다.' }, { status: 404 });
  }

  if (reading.userId && reading.userId !== user.id) {
    return NextResponse.json({ error: '본인의 결과만 열 수 있습니다.' }, { status: 403 });
  }

  const concernId = normalizeConcernId(payload?.concernId);
  const profile = await getUserProfileById(user.id);
  const counselorId = resolveMoonlightCounselor(payload?.counselorId, profile.preferredCounselor);

  // 2026-05-17 새로고침 회귀 fix — 자동 POST /api/today-fortune/unlock 이 mount
  //   마다 호출되는데 기존 idempotency 가 `today_fortune_premium_access` (sourceSessionId)
  //   만 봤음. 같은 reading 의 1코인 결제로 저장된 `detail_report_access` (readingKey)
  //   row 가 있어도 매치 안 돼 새로고침마다 deduct. PR #192 (entitlement API 같은 패턴)
  //   와 동일 fallback — 3 path 어느 한쪽이라도 access 있으면 deduct skip.
  const readingKey = toSlug(reading.input);
  const now = new Date();
  const todayKey = getKoreaAccessDay(now);
  const accessSource = await resolveTodayFortuneUnlockAccess(
    user.id,
    {
      sourceSessionId,
      readingKey,
      scopeKey: buildTodayDetailScopeKey(sourceSessionId),
      todayKey,
    },
    {
      // 2026-05-24 정합성 fix — entitlement API(checkTodayDetailAccess)와 동일하게
      //   readingKey(안정) + legacy readingId(slug) scope + 같은날 fallback 으로 판정.
      //   (구) today:${sourceSessionId} 단일 조회는 세션마다 달라져 결제분을 못 찾았다.
      getTodayDetailEntitlement: async (userId) => {
        for (const sk of todayDetailEntitlementScopeKeys({ slug: sourceSessionId, readingKey })) {
          if (await getTasteProductEntitlement(userId, 'today-detail', sk)) return true;
        }
        return hasTodayDetailEntitlementForDay(userId, todayKey);
      },
      hasTodayFortunePremiumAccess,
      hasTodayFortunePremiumAccessByReading,
      hasDetailReportAccess,
      hasTodayFortuneDailyAccess,
    },
  );

  const access = accessSource
    ? { success: true, remaining: null, reused: true }
    : await unlockTodayFortunePremium(user.id, readingKey, sourceSessionId);

  if (!access.success) {
    return NextResponse.json({ error: '코인이 부족합니다.', remaining: access.remaining }, { status: 402 });
  }

  const responseAccess =
    accessSource === 'taste-product'
      ? 'purchased'
      : accessSource || access.reused
        ? 'reused'
        : 'charged';
  const snapshot = await getOrCreateTodayDetailSnapshot({
    userId: user.id,
    reading,
    readingKey,
    concernId,
    sourceSessionId,
    counselorId,
    occurredOn: todayKey,
    now,
    accessSource: responseAccess,
  });

  return NextResponse.json({
    ok: true,
    freeResult: snapshot.freeResult,
    result: snapshot.result,
    snapshotId: snapshot.snapshotId,
    snapshotOccurredOn: snapshot.occurredOn,
    remaining: access.remaining,
    access: responseAccess,
    counselorId,
  });
}
