import {
  HOME_DAILY_LINES,
  type NotificationSlotKey,
} from '@/content/moonlight';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import type { BirthInput } from '@/lib/saju/types';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';

interface NotificationReadingRow {
  id: string;
  created_at: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: number | null;
  gender: 'male' | 'female' | null;
  result_json: unknown;
}

export interface NotificationFeedItem {
  id: string;
  title: string;
  body: string;
  slotKey: string;
  status: 'queued' | 'sent' | 'failed' | 'dismissed';
  createdAt: string;
  href: string;
}

export interface NotificationSnapshot {
  displayName: string;
  latestReading: {
    id: string;
    href: string;
    createdAt: string;
    dayPillarLabel: string;
    dominantElement: string;
    weakestElement: string;
    currentLuckSummary: string;
    dailyLine: string;
    luckyColor: string;
    luckyNumber: number;
  } | null;
  feed: NotificationFeedItem[];
}

function buildPreviewSnapshot(): NotificationSnapshot {
  return {
    displayName: '선생님',
    latestReading: null,
    feed: [],
  };
}

function slotKeyToHref(slotKey: string, fallback = '/notifications') {
  if (slotKey.startsWith('today-fortune')) return '/today-fortune';
  if (slotKey.startsWith('today-tarot')) return '/tarot/daily';
  if (slotKey.startsWith('today-zodiac')) return '/zodiac';
  if (slotKey.startsWith('today-star-sign')) return '/star-sign';
  if (slotKey.startsWith('subscription-expiring')) return '/membership/checkout?plan=plus&from=expiring';
  if (slotKey.startsWith('comeback-reminder')) return '/star-sign';
  if (slotKey.startsWith('weekly')) return '/today-fortune';
  if (slotKey.startsWith('monthly')) return '/today-fortune';
  if (slotKey.startsWith('seasonal')) return '/today-fortune';
  if (slotKey.startsWith('birthday')) return '/my';
  if (slotKey.startsWith('returning')) return '/my';
  if (slotKey.startsWith('dialogue')) return '/dialogue';
  return fallback;
}

function toInput(row: NotificationReadingRow): BirthInput {
  return {
    year: row.birth_year,
    month: row.birth_month,
    day: row.birth_day,
    hour: row.birth_hour ?? undefined,
    gender: row.gender ?? undefined,
  };
}

function buildDailyLine(day: number) {
  return HOME_DAILY_LINES[day % HOME_DAILY_LINES.length]?.title ?? HOME_DAILY_LINES[0].title;
}

function getLuckyColorLabel(element: string) {
  const info = ELEMENT_INFO[element as keyof typeof ELEMENT_INFO];
  return info?.keywords[2] ?? element;
}

export async function getNotificationSnapshot(): Promise<NotificationSnapshot> {
  if (!hasSupabaseServerEnv) {
    return buildPreviewSnapshot();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildPreviewSnapshot();
  }

  const [profileResponse, readingsResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('readings')
      .select(
        'id, created_at, birth_year, birth_month, birth_day, birth_hour, gender, result_json'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const displayName = profileResponse.data?.display_name?.trim() || '선생님';
  const latest = readingsResponse.data as NotificationReadingRow | null;

  // notification_delivery_logs 에서 최근 50건을 피드로 노출 (queued/dismissed 제외).
  const { data: logs } = await supabase
    .from('notification_delivery_logs')
    .select('id, slot_key, title, body, status, created_at')
    .eq('user_id', user.id)
    .in('status', ['sent', 'failed'])
    .order('created_at', { ascending: false })
    .limit(50);

  const feed: NotificationFeedItem[] = (logs ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    slotKey: row.slot_key as string,
    status: row.status as NotificationFeedItem['status'],
    createdAt: row.created_at as string,
    href: slotKeyToHref(row.slot_key as string),
  }));

  if (!latest) {
    return {
      displayName,
      latestReading: null,
      feed,
    };
  }

  const input = toInput(latest);
  const sajuData = normalizeToSajuDataV1(input, latest.result_json);
  const dominant = sajuData.fiveElements.dominant;
  const weakest = sajuData.fiveElements.weakest;
  const currentLuckSummary =
    sajuData.currentLuck?.saewoon?.notes[0] ??
    sajuData.currentLuck?.currentMajorLuck?.notes[0] ??
    '현재 운 흐름은 차분히 정리하며 가는 편이 좋습니다.';

  return {
    displayName,
    latestReading: {
      id: latest.id,
      href: `/saju/${latest.id}`,
      createdAt: latest.created_at,
      dayPillarLabel: `${sajuData.pillars.day.ganzi} 일주`,
      dominantElement: dominant,
      weakestElement: weakest,
      currentLuckSummary,
      dailyLine: buildDailyLine(input.day),
      luckyColor: getLuckyColorLabel(dominant),
      luckyNumber: ((input.month + input.day) % 9) + 1,
    },
    feed,
  };
}

export function getNotificationSlotSummary(slot: NotificationSlotKey) {
  switch (slot) {
    case 'today-fortune':
      return '오늘의 운세';
    case 'today-tarot':
      return '오늘의 타로';
    case 'today-zodiac':
      return '오늘의 띠운세';
    case 'today-star-sign':
      return '오늘의 별자리';
    case 'subscription-expiring':
      return '멤버십 만료 임박';
    case 'comeback-reminder':
      return '오랜만이에요';
    default:
      return '';
  }
}
