// 2026-05-16 PR #144 — 컴백 리마인더 본문 + 발송 자격 판정.
// 사용자별 inactivityReminderDays (3 | 5 | 7) 기준으로 lastSeenAt 가 N일 이상 지났으면
// 발송. 같은 사용자에게 너무 자주 보내지 않도록 N/2 일 이내 동일 슬롯 sent 가 있으면 skip.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ComebackCandidate {
  /** 미접속 일수 (반올림). */
  daysIdle: number;
}

/** lastSeenAt 와 inactivityReminderDays 만으로 발송 자격 판정 (DB 호출 X). */
export function isEligibleForComeback(input: {
  lastSeenAt: string | null;
  inactivityReminderDays: number;
}): ComebackCandidate | null {
  if (!input.lastSeenAt) return null;
  const last = new Date(input.lastSeenAt);
  if (Number.isNaN(last.getTime())) return null;
  const now = Date.now();
  const elapsedMs = now - last.getTime();
  const daysIdle = elapsedMs / (24 * 60 * 60 * 1000);
  if (daysIdle < input.inactivityReminderDays) return null;
  return { daysIdle: Math.round(daysIdle) };
}

/**
 * 본문 빌더 — 미접속 일수에 따라 부드러운 문구.
 */
export function buildComebackPushBody(input: { daysIdle: number }): {
  title: string;
  body: string;
  url: string;
} {
  const url = '/star-sign';
  if (input.daysIdle >= 14) {
    return {
      title: '한참 만이에요',
      body: '오랜 시간 만나 뵙지 못했네요. 오늘 운세 한 줄로 가볍게 시작해 보세요.',
      url,
    };
  }
  if (input.daysIdle >= 7) {
    return {
      title: '일주일 만이에요',
      body: '지난 일주일 사이 흐름이 어떻게 변했는지 별자리·사주로 확인해 보세요.',
      url,
    };
  }
  return {
    title: '오랜만이에요',
    body: '며칠 만에 뵙네요. 오늘 운세 한 줄과 새로운 흐름을 가볍게 확인해 보세요.',
    url,
  };
}

/**
 * 최근 (N/2 일 이내) 같은 사용자에게 comeback-reminder sent 가 있는지 — 있으면 다시 안 보냄.
 */
export async function hasRecentComebackSent(
  service: SupabaseClient,
  userId: string,
  inactivityReminderDays: number
): Promise<boolean> {
  const cooldownDays = Math.max(1, Math.floor(inactivityReminderDays / 2));
  const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const { count } = await service
    .from('notification_delivery_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('slot_key', 'comeback-reminder')
    .eq('status', 'sent')
    .gte('created_at', cutoff.toISOString());
  return (count ?? 0) > 0;
}
