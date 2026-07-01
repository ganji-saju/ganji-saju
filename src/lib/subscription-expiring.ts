// 2026-05-16 PR #143 — 만료 임박 구독자 추출 + push 본문 생성.
// D-7 / D-3 / D-day 분기로 본문 다르게.
// dispatch 가 매일 KST 10:00 cron 으로 실행되며 active 구독 + renews_at 가
// 다음 정확히 7일/3일/0일 후인 사용자에게 push.

import type { SupabaseClient } from '@supabase/supabase-js';

export type ExpiringStage = 'd7' | 'd3' | 'd0';

export interface ExpiringRecipient {
  userId: string;
  plan: string;
  renewsAt: string;
  stage: ExpiringStage;
}

/** KST 자정 단위 days 후의 24시간 윈도우 [start, end) UTC ISO. */
function getKstDayWindow(daysAhead: number): { start: string; end: string } {
  const now = new Date();
  // KST = UTC+9. KST 자정 = UTC 15:00 전날.
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstMidnightUtcMs =
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      0,
      0,
      0,
      0
    ) - 9 * 60 * 60 * 1000; // KST midnight in UTC ms
  const start = kstMidnightUtcMs + daysAhead * 24 * 60 * 60 * 1000;
  const end = start + 24 * 60 * 60 * 1000;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

/**
 * D-7 / D-3 / D-day 임박 구독자 추출.
 * 각 단계마다 별도 윈도우. 같은 구독이 D-7 → D-3 → D-day 단계로 3번 알림 받을 수 있음.
 */
export async function listExpiringSubscribers(
  service: SupabaseClient
): Promise<ExpiringRecipient[]> {
  const stages: Array<{ stage: ExpiringStage; days: number }> = [
    { stage: 'd7', days: 7 },
    { stage: 'd3', days: 3 },
    { stage: 'd0', days: 0 },
  ];

  const all: ExpiringRecipient[] = [];

  for (const { stage, days } of stages) {
    const { start, end } = getKstDayWindow(days);
    const { data, error } = await service
      .from('subscriptions')
      .select('user_id, plan, renews_at')
      .eq('status', 'active')
      .gte('renews_at', start)
      .lt('renews_at', end)
      .limit(5000);
    if (error || !data) continue;
    for (const row of data as Array<{
      user_id: string;
      plan: string;
      renews_at: string;
    }>) {
      all.push({
        userId: row.user_id,
        plan: row.plan,
        renewsAt: row.renews_at,
        stage,
      });
    }
  }

  return all;
}

/**
 * 사용자 + 단계에 따라 push 본문 생성. plan 라벨 + D-X 표시 + CTA 한 줄.
 */
export function buildExpiringPushBody(input: {
  stage: ExpiringStage;
  planLabel: string;
}): { title: string; body: string; url: string } {
  const url = '/membership/checkout?plan=plus&from=expiring';
  if (input.stage === 'd0') {
    return {
      title: '오늘 멤버십이 만료돼요',
      body: `${input.planLabel} 가 오늘 만료됩니다. 지금 연장하시면 전이 그대로 이어집니다.`,
      url,
    };
  }
  if (input.stage === 'd3') {
    return {
      title: '멤버십 만료 3일 전',
      body: `${input.planLabel} 가 3일 뒤 만료됩니다. 미리 연장해두시면 안전해요.`,
      url,
    };
  }
  return {
    title: '멤버십 만료 일주일 전',
    body: `${input.planLabel} 가 일주일 뒤 만료됩니다. 잊지 마시고 한 번 확인해 보세요.`,
    url,
  };
}

/**
 * 오늘 같은 (user, slot) 로그가 이미 있는지 확인 — 중복 발송 방지.
 * dispatch 가 같은 사용자에게 3번 (D-7/D-3/D-0) 보내는 건 단계가 달라 OK 지만,
 * 단일 단계 안에서는 하루에 1번만.
 */
export async function hasAlreadySentToday(
  service: SupabaseClient,
  userId: string,
  slotKey: 'subscription-expiring'
): Promise<boolean> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(today.getTime() - 9 * 60 * 60 * 1000); // KST midnight ≈ this
  const { count } = await service
    .from('notification_delivery_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('slot_key', slotKey)
    .eq('status', 'sent')
    .gte('created_at', todayStart.toISOString());
  return (count ?? 0) > 0;
}
