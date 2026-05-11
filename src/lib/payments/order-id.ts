const TOSS_ORDER_ID_MAX_LENGTH = 64;

const PACKAGE_ORDER_ID_ALIASES: Record<string, string> = {
  credit_1: 'c1',
  credit_3: 'c3',
  credit_7: 'c7',
  subscription_30: 'c36',
  membership_plus: 'plus',
  membership_premium: 'prem',
  lifetime_report: 'life',
  taste_today_detail: 'today',
  taste_love_question: 'love',
  taste_money_pattern: 'money',
  taste_work_flow: 'work',
  taste_monthly_calendar: 'month',
  taste_year_core: 'year',
  taste_personality_compatibility_mini: 'pcmini',
};

function hashString(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function sanitizeOrderIdSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '').trim();
}

export function buildTossOrderId({
  prefix,
  packageId,
  paymentMethod,
  now = Date.now(),
  nonce = Math.random().toString(36).slice(2, 8),
}: {
  prefix: string;
  packageId: string;
  paymentMethod: string;
  now?: number;
  nonce?: string;
}) {
  const safePrefix = sanitizeOrderIdSegment(prefix).slice(0, 8) || 'order';
  const packageAlias =
    PACKAGE_ORDER_ID_ALIASES[packageId] ?? `pkg${hashString(packageId).slice(0, 8)}`;
  const methodAlias = sanitizeOrderIdSegment(paymentMethod.toLowerCase()).slice(0, 2) || 'pm';
  const safeNonce = sanitizeOrderIdSegment(nonce).slice(0, 6) || hashString(`${packageId}:${now}`);
  const orderId = `${safePrefix}_${packageAlias}_${methodAlias}_${now}_${safeNonce}`;

  if (orderId.length <= TOSS_ORDER_ID_MAX_LENGTH) return orderId;

  return `${safePrefix.slice(0, 4)}_${hashString(orderId)}_${now}`.slice(
    0,
    TOSS_ORDER_ID_MAX_LENGTH
  );
}

export function isValidTossOrderId(value: string) {
  return value.length >= 6 && value.length <= TOSS_ORDER_ID_MAX_LENGTH && /^[A-Za-z0-9_-]+$/.test(value);
}
