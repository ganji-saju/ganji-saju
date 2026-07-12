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
  emailEnabled: boolean;
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
    emailEnabled: false,
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
        'enabled, email_enabled, style, widget_size, inactivity_reminder_days, slot_preferences, updated_at, last_seen_at'
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
    emailEnabled:
      typeof row?.email_enabled === 'boolean' ? row.email_enabled : defaults.emailEnabled,
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
    email_enabled: preferences.emailEnabled,
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
    emailEnabled: current.emailEnabled,
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
    emailEnabled: current.emailEnabled,
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
        'user_id, enabled, email_enabled, style, widget_size, inactivity_reminder_days, slot_preferences, updated_at, last_seen_at'
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

  const emailMap = new Map<string, string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      if (user.email) emailMap.set(user.id, user.email);
    }
    if (data.users.length < 200) break;
  }

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
    email: emailMap.get(item.user_id) ?? null,
    displayName: profileMap.get(item.user_id)?.displayName ?? '',
    birthMonth: profileMap.get(item.user_id)?.birthMonth ?? null,
    birthDay: profileMap.get(item.user_id)?.birthDay ?? null,
    preferences: {
      enabled: item.enabled,
      emailEnabled: item.email_enabled === true,
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
  /** PR #137 — 호출자가 server-side 에서 미리 UUID 생성해 전달 (URL ?notif= 에 사용). */
  id?: string;
  userId: string;
  subscriptionId: string;
  slotKey: NotificationSlotKey;
  title: string;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'dismissed';
  responseStatus?: number;
  /** PR #136 — A/B 본문 variant ('A'|'B'|'C'), 별자리 슬롯에서만 채움. */
  variant?: 'A' | 'B' | 'C' | null;
}): Promise<string | null> {
  const service = await createServiceClient();
  const insertRow: Record<string, unknown> = {
    user_id: input.userId,
    subscription_id: input.subscriptionId,
    slot_key: input.slotKey,
    title: input.title,
    body: input.body,
    status: input.status,
    response_status: input.responseStatus ?? null,
    variant: input.variant ?? null,
  };
  if (input.id) insertRow.id = input.id;

  const { data, error } = await service
    .from('notification_delivery_logs')
    .insert(insertRow)
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return (data?.id as string | undefined) ?? null;
}

export async function createEmailDeliveryLog(input: {
  userId: string;
  slotKey: string;
  recipientEmail: string;
  providerMessageId?: string;
  title: string;
  body: string;
  status: 'sent' | 'failed';
  failureReason?: string;
}) {
  const service = await createServiceClient();
  const { error } = await service.from('notification_email_delivery_logs').insert({
    user_id: input.userId,
    slot_key: input.slotKey,
    recipient_email: input.recipientEmail,
    provider_message_id: input.providerMessageId ?? null,
    title: input.title,
    body: input.body,
    status: input.status,
    failure_reason: input.failureReason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function hasEmailAlreadySentToday(
  userId: string,
  slotKey: NotificationSlotKey
) {
  const service = await createServiceClient();
  const startIso = getKstDayStartIso();
  const { count, error } = await service
    .from('notification_email_delivery_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('slot_key', slotKey)
    .eq('status', 'sent')
    .gte('created_at', startIso);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export function getKstDayStartIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return new Date(`${read('year')}-${read('month')}-${read('day')}T00:00:00+09:00`).toISOString();
}

/** PR #137 — 사용자 클릭 시각 기록. */
export async function markNotificationClick(input: {
  logId: string;
  userId: string;
}) {
  const service = await createServiceClient();
  const { error, data } = await service
    .from('notification_delivery_logs')
    .update({ clicked_at: new Date().toISOString() })
    .eq('id', input.logId)
    .eq('user_id', input.userId)
    .is('clicked_at', null) // 이미 기록된 클릭은 덮어쓰지 않음 (멱등).
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return { updated: Boolean(data) };
}
