import {
  NOTIFICATION_SCHEDULE_BLUEPRINT,
  type NotificationSlotKey,
} from '@/content/moonlight';
import {
  createServiceClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

export type NotificationStyle = 'quiet' | 'normal' | 'sound';
export type WidgetSize = 'small' | 'medium' | 'large';

export interface NotificationPreferencesRecord {
  enabled: boolean;
  slots: Record<NotificationSlotKey, boolean>;
  style: NotificationStyle;
  widgetSize: WidgetSize;
  inactivityReminderDays: 3 | 5 | 7;
  updatedAt: string | null;
  lastSeenAt: string | null;
  hasPushSubscription: boolean;
}

export interface PushSubscriptionInput {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredPushSubscription extends PushSubscriptionInput {
  id: string;
  userId: string;
  userAgent: string | null;
  isActive: boolean;
  createdAt: string;
}

function createDefaultSlots() {
  return Object.fromEntries(
    NOTIFICATION_SCHEDULE_BLUEPRINT.map((slot) => [slot.key, true])
  ) as Record<NotificationSlotKey, boolean>;
}

export function createDefaultNotificationPreferences(): NotificationPreferencesRecord {
  return {
    enabled: true,
    slots: createDefaultSlots(),
    style: 'normal',
    widgetSize: 'medium',
    inactivityReminderDays: 3,
    updatedAt: null,
    lastSeenAt: null,
    hasPushSubscription: false,
  };
}

function normalizeSlots(value: unknown) {
  const defaults = createDefaultSlots();
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

function normalizeWidgetSize(value: unknown): WidgetSize {
  return value === 'small' || value === 'medium' || value === 'large'
    ? value
    : 'medium';
}

function normalizeStyle(value: unknown): NotificationStyle {
  return value === 'quiet' || value === 'normal' || value === 'sound'
    ? value
    : 'normal';
}

function normalizeInactivityReminderDays(value: unknown): 3 | 5 | 7 {
  return value === 5 || value === 7 ? value : 3;
}

function toTimestampString(expirationTime: number | null) {
  if (typeof expirationTime !== 'number' || !Number.isFinite(expirationTime)) {
    return null;
  }

  return new Date(expirationTime).toISOString();
}

function fromTimestampString(value: string | null) {
  if (!value) return null;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getNotificationPreferencesForUser(
  userId: string
): Promise<NotificationPreferencesRecord> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return createDefaultNotificationPreferences();
  }

  const service = await createServiceClient();
  const [preferencesResponse, subscriptionsResponse] = await Promise.all([
    service
      .from('notification_preferences')
      .select(
        'enabled, style, widget_size, inactivity_reminder_days, slot_preferences, updated_at, last_seen_at'
      )
      .eq('user_id', userId)
      .maybeSingle(),
    service
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);

  const row = preferencesResponse.data;
  const defaults = createDefaultNotificationPreferences();

  return {
    enabled: typeof row?.enabled === 'boolean' ? row.enabled : defaults.enabled,
    slots: normalizeSlots(row?.slot_preferences),
    style: normalizeStyle(row?.style),
    widgetSize: normalizeWidgetSize(row?.widget_size),
    inactivityReminderDays: normalizeInactivityReminderDays(
      row?.inactivity_reminder_days
    ),
    updatedAt: row?.updated_at ?? null,
    lastSeenAt: row?.last_seen_at ?? null,
    hasPushSubscription: (subscriptionsResponse.count ?? 0) > 0,
  };
}

export async function upsertNotificationPreferences(
  userId: string,
  preferences: Omit<NotificationPreferencesRecord, 'hasPushSubscription'>
) {
  const service = await createServiceClient();
  const payload = {
    user_id: userId,
    enabled: preferences.enabled,
    style: preferences.style,
    widget_size: preferences.widgetSize,
    inactivity_reminder_days: preferences.inactivityReminderDays,
    slot_preferences: preferences.slots,
    last_seen_at: preferences.lastSeenAt,
    updated_at: new Date().toISOString(),
  };

  const { error } = await service.from('notification_preferences').upsert(payload);

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureNotificationPreferences(userId: string) {
  const current = await getNotificationPreferencesForUser(userId);
  await upsertNotificationPreferences(userId, {
    enabled: current.enabled,
    slots: current.slots,
    style: current.style,
    widgetSize: current.widgetSize,
    inactivityReminderDays: current.inactivityReminderDays,
    updatedAt: current.updatedAt,
    lastSeenAt: current.lastSeenAt ?? new Date().toISOString(),
  });
}

export async function markNotificationHeartbeat(userId: string, seenAt: string) {
  const current = await getNotificationPreferencesForUser(userId);
  await upsertNotificationPreferences(userId, {
    enabled: current.enabled,
    slots: current.slots,
    style: current.style,
    widgetSize: current.widgetSize,
    inactivityReminderDays: current.inactivityReminderDays,
    updatedAt: current.updatedAt,
    lastSeenAt: seenAt,
  });
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent: string | null
) {
  await ensureNotificationPreferences(userId);

  const service = await createServiceClient();
  const { error } = await service.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      expiration_time: toTimestampString(subscription.expirationTime),
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      is_active: true,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'endpoint',
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deactivatePushSubscription(userId: string, endpoint: string) {
  const service = await createServiceClient();
  const { error } = await service
    .from('push_subscriptions')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getActivePushSubscriptionsForUser(userId: string) {
  const service = await createServiceClient();
  const { data, error } = await service
    .from('push_subscriptions')
    .select(
      'id, user_id, endpoint, expiration_time, p256dh, auth, user_agent, is_active, created_at'
    )
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return (
    data?.map((item) => ({
      id: item.id,
      userId: item.user_id,
      endpoint: item.endpoint,
      expirationTime: fromTimestampString(item.expiration_time),
      keys: {
        p256dh: item.p256dh,
        auth: item.auth,
      },
      userAgent: item.user_agent,
      isActive: item.is_active,
      createdAt: item.created_at,
    })) ?? []
  ) satisfies StoredPushSubscription[];
}

export async function listNotificationRecipients() {
  const service = await createServiceClient();
  const [preferencesResponse, profilesResponse, subscriptionsResponse] = await Promise.all([
    service
      .from('notification_preferences')
      .select(
        'user_id, enabled, style, widget_size, inactivity_reminder_days, slot_preferences, updated_at, last_seen_at'
      ),
    service.from('profiles').select('user_id, display_name, birth_month, birth_day'),
    service
      .from('push_subscriptions')
      .select(
        'id, user_id, endpoint, expiration_time, p256dh, auth, user_agent, is_active, created_at'
      )
      .eq('is_active', true),
  ]);

  if (preferencesResponse.error) {
    throw new Error(preferencesResponse.error.message);
  }

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message);
  }

  if (subscriptionsResponse.error) {
    throw new Error(subscriptionsResponse.error.message);
  }

  const profileMap = new Map(
    (profilesResponse.data ?? []).map((profile) => [
      profile.user_id,
      {
        displayName: profile.display_name ?? '',
        birthMonth: profile.birth_month ?? null,
        birthDay: profile.birth_day ?? null,
      },
    ])
  );
  const subscriptionMap = new Map<string, StoredPushSubscription[]>();

  for (const item of subscriptionsResponse.data ?? []) {
    const subscriptions = subscriptionMap.get(item.user_id) ?? [];
    subscriptions.push({
      id: item.id,
      userId: item.user_id,
      endpoint: item.endpoint,
      expirationTime: fromTimestampString(item.expiration_time),
      keys: {
        p256dh: item.p256dh,
        auth: item.auth,
      },
      userAgent: item.user_agent,
      isActive: item.is_active,
      createdAt: item.created_at,
    });
    subscriptionMap.set(item.user_id, subscriptions);
  }

  return (preferencesResponse.data ?? []).map((item) => ({
    userId: item.user_id,
    displayName: profileMap.get(item.user_id)?.displayName ?? '',
    birthMonth: profileMap.get(item.user_id)?.birthMonth ?? null,
    birthDay: profileMap.get(item.user_id)?.birthDay ?? null,
    preferences: {
      enabled: item.enabled,
      slots: normalizeSlots(item.slot_preferences),
      style: normalizeStyle(item.style),
      widgetSize: normalizeWidgetSize(item.widget_size),
      inactivityReminderDays: normalizeInactivityReminderDays(
        item.inactivity_reminder_days
      ),
      updatedAt: item.updated_at ?? null,
      lastSeenAt: item.last_seen_at ?? null,
      hasPushSubscription: (subscriptionMap.get(item.user_id)?.length ?? 0) > 0,
    } satisfies NotificationPreferencesRecord,
    subscriptions: subscriptionMap.get(item.user_id) ?? [],
  }));
}

export async function markPushDeliveryResult(input: {
  subscriptionId: string;
  endpoint: string;
  success: boolean;
  statusCode?: number;
  failureReason?: string | null;
}) {
  const service = await createServiceClient();
  const patch = input.success
    ? {
        last_success_at: new Date().toISOString(),
        failure_reason: null,
        updated_at: new Date().toISOString(),
      }
    : {
        last_failure_at: new Date().toISOString(),
        failure_reason: input.failureReason ?? null,
        is_active: input.statusCode === 404 || input.statusCode === 410 ? false : true,
        updated_at: new Date().toISOString(),
      };

  const { error } = await service
    .from('push_subscriptions')
    .update(patch)
    .eq('id', input.subscriptionId)
    .eq('endpoint', input.endpoint);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createNotificationDeliveryLog(input: {
  userId: string;
  subscriptionId: string;
  slotKey: NotificationSlotKey;
  title: string;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'dismissed';
  responseStatus?: number;
  /** PR #136 — A/B 본문 variant ('A'|'B'|'C'), 별자리 슬롯에서만 채움. */
  variant?: 'A' | 'B' | 'C' | null;
}) {
  const service = await createServiceClient();
  const { error } = await service.from('notification_delivery_logs').insert({
    user_id: input.userId,
    subscription_id: input.subscriptionId,
    slot_key: input.slotKey,
    title: input.title,
    body: input.body,
    status: input.status,
    response_status: input.responseStatus ?? null,
    variant: input.variant ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
