import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createDefaultNotificationPreferences,
  getNotificationPreferencesForUser,
  upsertNotificationPreferences,
  type NotificationStyle,
  type WidgetSize,
} from '@/lib/notification-preferences';
import { NOTIFICATION_SCHEDULE_BLUEPRINT, type NotificationSlotKey } from '@/content/moonlight';

function parseSlots(value: unknown) {
  const defaults = createDefaultNotificationPreferences().slots;
  if (!value || typeof value !== 'object') return defaults;

  const incoming = value as Record<string, unknown>;
  return Object.fromEntries(
    NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => [
      slot.key,
      typeof incoming[slot.key] === 'boolean'
        ? incoming[slot.key]
        : defaults[slot.key],
    ])
  ) as Record<NotificationSlotKey, boolean>;
}

function parsePayload(value: unknown) {
  if (!value || typeof value !== 'object') return null;

  const data = value as Record<string, unknown>;
  const defaults = createDefaultNotificationPreferences();

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    emailEnabled:
      typeof data.emailEnabled === 'boolean' ? data.emailEnabled : defaults.emailEnabled,
    slots: parseSlots(data.slots),
    style:
      data.style === 'quiet' || data.style === 'normal' || data.style === 'sound'
        ? (data.style as NotificationStyle)
        : defaults.style,
    widgetSize:
      data.widgetSize === 'small' || data.widgetSize === 'medium' || data.widgetSize === 'large'
        ? (data.widgetSize as WidgetSize)
        : defaults.widgetSize,
    inactivityReminderDays:
      data.inactivityReminderDays === 5 || data.inactivityReminderDays === 7
        ? data.inactivityReminderDays
        : defaults.inactivityReminderDays,
    lastSeenAt:
      typeof data.lastSeenAt === 'string' && data.lastSeenAt.length > 0
        ? data.lastSeenAt
        : null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const preferences = await getNotificationPreferencesForUser(user.id);
    return NextResponse.json({ preferences });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알림 설정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = parsePayload(await req.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ error: '알림 설정 값이 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const current = await getNotificationPreferencesForUser(user.id);
    await upsertNotificationPreferences(user.id, {
      enabled: payload.enabled,
      emailEnabled: payload.emailEnabled,
      slots: payload.slots,
      style: payload.style,
      widgetSize: payload.widgetSize,
      inactivityReminderDays: payload.inactivityReminderDays,
      updatedAt: current.updatedAt,
      lastSeenAt: payload.lastSeenAt,
    });

    const preferences = await getNotificationPreferencesForUser(user.id);
    return NextResponse.json({ preferences });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알림 설정을 저장하지 못했습니다.' },
      { status: 500 }
    );
  }
}
