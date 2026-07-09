// 2026-07-09 — 관리자 분석용 외부 트래픽 소스(GA4 Data API, Vercel Web Analytics)
//   조회 계층. 외부 키가 없어도 admin 화면은 자체 지표만 정상 렌더링해야 하므로
//   source별 configured/ok/error 상태와 null gap-fill 을 명시한다.
import { createSign } from 'node:crypto';
import { recentKstDateKeys, shiftDateKey } from './analytics-rollup';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const GOOGLE_ANALYTICS_RUN_REPORT_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const VERCEL_WEB_ANALYTICS_AGGREGATE_URL =
  'https://api.vercel.com/v1/query/web-analytics/visits/aggregate';
const VERCEL_WEB_ANALYTICS_LIMIT = 100;
const VERCEL_WEB_ANALYTICS_CHUNK_DAYS = 100;
const REQUEST_TIMEOUT_MS = 12_000;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type EnvMap = Record<string, string | undefined>;

export interface ExternalDailyPoint {
  date: string;
  gaActiveUsers: number | null;
  gaPageViews: number | null;
  vercelVisitors: number | null;
  vercelPageViews: number | null;
}

export interface ExternalAnalyticsTotals {
  gaActiveUsers: number | null;
  gaPageViews: number | null;
  vercelVisitors: number | null;
  vercelPageViews: number | null;
}

export interface ExternalAnalyticsSourceStatus {
  configured: boolean;
  ok: boolean;
  error: string | null;
  warning?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ExternalAnalyticsSnapshot {
  windowDays: number;
  from: string;
  to: string;
  refreshedAt: string;
  sources: {
    googleAnalytics: ExternalAnalyticsSourceStatus;
    vercel: ExternalAnalyticsSourceStatus;
  };
  daily: ExternalDailyPoint[];
  totals: ExternalAnalyticsTotals;
}

interface GoogleAnalyticsConfig {
  propertyPath: string;
  clientEmail: string;
  privateKey: string;
}

interface VercelAnalyticsConfig {
  token: string;
  projectId: string;
  teamId: string | null;
  teamSlug: string | null;
  maxDays: number | null;
}

export interface GoogleAnalyticsDay {
  activeUsers: number;
  pageViews: number;
}

export interface VercelAnalyticsDay {
  visitors: number | null;
  pageViews: number | null;
}

interface VercelAnalyticsResult {
  rows: Map<string, VercelAnalyticsDay>;
  fromKey: string;
  toKey: string;
  warning: string | null;
}

class ExternalAnalyticsHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ExternalAnalyticsHttpError';
  }
}

function envValue(env: EnvMap, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

function normalizePrivateKey(value: string): string {
  return value.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function googleAnalyticsConfig(env: EnvMap): GoogleAnalyticsConfig | null {
  const propertyId = envValue(env, 'GOOGLE_ANALYTICS_PROPERTY_ID');
  const clientEmail = envValue(env, 'GOOGLE_ANALYTICS_CLIENT_EMAIL');
  const privateKey = envValue(env, 'GOOGLE_ANALYTICS_PRIVATE_KEY');
  if (!propertyId || !clientEmail || !privateKey) return null;

  return {
    propertyPath: propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function vercelAnalyticsConfig(env: EnvMap): VercelAnalyticsConfig | null {
  const token = envValue(env, 'VERCEL_ANALYTICS_TOKEN') ?? envValue(env, 'VERCEL_TOKEN');
  const projectId = envValue(env, 'VERCEL_PROJECT_ID');
  if (!token || !projectId) return null;
  const maxDaysRaw = Number(envValue(env, 'VERCEL_ANALYTICS_MAX_DAYS') ?? '');
  const maxDays = Number.isFinite(maxDaysRaw) && maxDaysRaw > 0
    ? Math.max(1, Math.min(365, Math.floor(maxDaysRaw)))
    : null;

  return {
    token,
    projectId,
    teamId: envValue(env, 'VERCEL_TEAM_ID'),
    teamSlug: envValue(env, 'VERCEL_TEAM_SLUG'),
    maxDays,
  };
}

function requestSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createGoogleAssertion(config: GoogleAnalyticsConfig, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claim = base64UrlJson({
    iss: config.clientEmail,
    scope: GOOGLE_ANALYTICS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat,
    exp: iat + 3600,
  });
  const unsigned = `${header}.${claim}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(config.privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numeric(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = numeric(value);
    if (n != null) return n;
  }
  return null;
}

export function normalizeExternalDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return null;
}

export function parseGoogleAnalyticsRows(payload: unknown): Map<string, GoogleAnalyticsDay> {
  const out = new Map<string, GoogleAnalyticsDay>();
  const rows = toArray(toRecord(payload).rows);
  for (const rowValue of rows) {
    const row = toRecord(rowValue);
    const dimensions = toArray(row.dimensionValues).map(toRecord);
    const metrics = toArray(row.metricValues).map(toRecord);
    const date = normalizeExternalDate(dimensions[0]?.value);
    if (!date) continue;

    out.set(date, {
      activeUsers: numeric(metrics[0]?.value) ?? 0,
      pageViews: numeric(metrics[1]?.value) ?? 0,
    });
  }
  return out;
}

export function parseVercelAnalyticsRows(payload: unknown): Map<string, VercelAnalyticsDay> {
  const out = new Map<string, VercelAnalyticsDay>();
  const root = toRecord(payload);
  const nestedRows = toRecord(root.data).rows;
  const rows: unknown[] = Array.isArray(root.data)
    ? (root.data as unknown[])
    : Array.isArray(root.rows)
      ? (root.rows as unknown[])
      : Array.isArray(nestedRows)
        ? nestedRows
        : [];

  for (const rowValue of rows) {
    const row = toRecord(rowValue);
    const date = normalizeExternalDate(
      row.day ?? row.date ?? row.timestamp ?? row.start ?? row.key ?? row.x
    );
    if (!date) continue;

    out.set(date, {
      visitors: firstNumber(row.visitors, row.uniqueVisitors, row.uniqueUsers, row.users),
      pageViews: firstNumber(
        row.pageViews,
        row.pageviews,
        row.page_views,
        row.views,
        row.count,
        row.value,
        row.visits
      ),
    });
  }
  return out;
}

async function responseError(label: string, response: Response): Promise<Error> {
  const body = await response.text().catch(() => '');
  const details = body ? `: ${body.slice(0, 180)}` : '';
  return new ExternalAnalyticsHttpError(`${label} HTTP ${response.status}${details}`, response.status);
}

async function fetchGoogleAccessToken(
  config: GoogleAnalyticsConfig,
  fetcher: FetchLike,
  now: Date
): Promise<string> {
  const assertion = createGoogleAssertion(config, now);
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    signal: requestSignal(),
  });
  if (!response.ok) throw await responseError('Google OAuth token', response);

  const json = toRecord(await response.json());
  const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
  if (!accessToken) throw new Error('Google OAuth token response missing access_token');
  return accessToken;
}

async function fetchGoogleAnalyticsDaily(
  config: GoogleAnalyticsConfig,
  fromKey: string,
  toKey: string,
  fetcher: FetchLike,
  now: Date
): Promise<Map<string, GoogleAnalyticsDay>> {
  const accessToken = await fetchGoogleAccessToken(config, fetcher, now);
  const response = await fetcher(
    `${GOOGLE_ANALYTICS_RUN_REPORT_BASE}/${config.propertyPath}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        dateRanges: [{ startDate: fromKey, endDate: toKey }],
        keepEmptyRows: true,
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: '10000',
      }),
      signal: requestSignal(),
    }
  );
  if (!response.ok) throw await responseError('Google Analytics runReport', response);
  return parseGoogleAnalyticsRows(await response.json());
}

async function fetchVercelAnalyticsDaily(
  config: VercelAnalyticsConfig,
  fromKey: string,
  toKey: string,
  fetcher: FetchLike,
  now: Date
): Promise<VercelAnalyticsResult> {
  const attempts = buildVercelRangeAttempts(fromKey, toKey, now, config.maxDays);
  let lastErr: unknown = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const range = attempts[i]!;
    try {
      const rows = await fetchVercelAnalyticsRange(config, range.fromKey, range.toKey, fetcher);
      const warning =
        range.fromKey !== fromKey || range.toKey !== toKey
          ? `Vercel 조회 가능 기간 제한으로 ${range.fromKey}~${range.toKey}만 표시`
          : null;
      return { rows, fromKey: range.fromKey, toKey: range.toKey, warning };
    } catch (err) {
      lastErr = err;
      if (!isRetryableVercelRangeError(err) || i === attempts.length - 1) throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Vercel Web Analytics request failed');
}

function isRetryableVercelRangeError(err: unknown): boolean {
  return err instanceof ExternalAnalyticsHttpError && (err.status === 400 || err.status === 422);
}

function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function clampVercelRange(
  fromKey: string,
  toKey: string,
  now: Date,
  maxDays: number | null
): { fromKey: string; toKey: string } {
  const safeToKey = toKey > utcDateKey(now) ? utcDateKey(now) : toKey;
  const safeMaxDays = maxDays && maxDays > 0 ? maxDays : null;
  const minFromForMax = safeMaxDays ? shiftDateKey(safeToKey, -(safeMaxDays - 1)) : fromKey;
  let safeFromKey = fromKey > minFromForMax ? fromKey : minFromForMax;
  if (safeFromKey > safeToKey) safeFromKey = safeToKey;
  return { fromKey: safeFromKey, toKey: safeToKey };
}

export function buildVercelRangeAttempts(
  fromKey: string,
  toKey: string,
  now: Date,
  maxDays: number | null = null
): Array<{ fromKey: string; toKey: string }> {
  const primary = clampVercelRange(fromKey, toKey, now, maxDays);
  const fallbackWindows = [30, 7, 1];
  const attempts: Array<{ fromKey: string; toKey: string }> = [];
  const seen = new Set<string>();

  for (const range of [
    primary,
    ...fallbackWindows.map((days) => clampVercelRange(fromKey, toKey, now, days)),
  ]) {
    const key = `${range.fromKey}:${range.toKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    attempts.push(range);
  }

  return attempts;
}

export function buildVercelRangeChunks(
  fromKey: string,
  toKey: string,
  chunkDays = VERCEL_WEB_ANALYTICS_CHUNK_DAYS
): Array<{ fromKey: string; toKey: string }> {
  const safeChunkDays = Math.max(
    1,
    Math.min(VERCEL_WEB_ANALYTICS_LIMIT, Math.floor(chunkDays) || 1)
  );
  const chunks: Array<{ fromKey: string; toKey: string }> = [];
  let cursor = fromKey;

  for (let i = 0; i < 366 * 5 && cursor <= toKey; i += 1) {
    const chunkTo = shiftDateKey(cursor, safeChunkDays - 1);
    const safeTo = chunkTo < toKey ? chunkTo : toKey;
    chunks.push({ fromKey: cursor, toKey: safeTo });
    cursor = shiftDateKey(safeTo, 1);
  }

  return chunks;
}

async function fetchVercelAnalyticsRange(
  config: VercelAnalyticsConfig,
  fromKey: string,
  toKey: string,
  fetcher: FetchLike
): Promise<Map<string, VercelAnalyticsDay>> {
  const out = new Map<string, VercelAnalyticsDay>();
  for (const range of buildVercelRangeChunks(fromKey, toKey)) {
    const rows = await fetchVercelAnalyticsRangeChunk(config, range.fromKey, range.toKey, fetcher);
    for (const [date, value] of rows) out.set(date, value);
  }
  return out;
}

async function fetchVercelAnalyticsRangeChunk(
  config: VercelAnalyticsConfig,
  fromKey: string,
  toKey: string,
  fetcher: FetchLike
): Promise<Map<string, VercelAnalyticsDay>> {
  const url = new URL(VERCEL_WEB_ANALYTICS_AGGREGATE_URL);
  url.searchParams.set('projectId', config.projectId);
  url.searchParams.set('by', 'day');
  url.searchParams.set('since', fromKey);
  url.searchParams.set('until', toKey);
  url.searchParams.set('limit', String(VERCEL_WEB_ANALYTICS_LIMIT));
  if (config.teamId) url.searchParams.set('teamId', config.teamId);
  else if (config.teamSlug) url.searchParams.set('slug', config.teamSlug);

  const response = await fetcher(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    signal: requestSignal(),
  });
  if (!response.ok) throw await responseError('Vercel Web Analytics', response);
  return parseVercelAnalyticsRows(await response.json());
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value == null) continue;
    total += value;
    hasValue = true;
  }
  return hasValue ? total : null;
}

export async function getExternalAnalyticsSnapshot(
  windowDays: number,
  now: Date = new Date(),
  env: EnvMap = process.env,
  fetcher: FetchLike = fetch
): Promise<ExternalAnalyticsSnapshot> {
  const days = Math.max(1, Math.min(365, Math.floor(windowDays) || 30));
  const axis = recentKstDateKeys(days, now);
  const fromKey = axis[0]!;
  const toKey = axis[axis.length - 1]!;

  const gaConfig = googleAnalyticsConfig(env);
  const vercelConfig = vercelAnalyticsConfig(env);

  let gaRows: Map<string, GoogleAnalyticsDay> | null = null;
  let vercelRows: Map<string, VercelAnalyticsDay> | null = null;
  let gaError: string | null = null;
  let vercelError: string | null = null;
  let vercelWarning: string | null = null;
  let vercelFromKey: string | null = null;
  let vercelToKey: string | null = null;

  await Promise.all([
    gaConfig
      ? fetchGoogleAnalyticsDaily(gaConfig, fromKey, toKey, fetcher, now)
          .then((rows) => {
            gaRows = rows;
          })
          .catch((err) => {
            gaError = errorMessage(err);
          })
      : Promise.resolve(),
    vercelConfig
      ? fetchVercelAnalyticsDaily(vercelConfig, fromKey, toKey, fetcher, now)
          .then((result) => {
            vercelRows = result.rows;
            vercelWarning = result.warning;
            vercelFromKey = result.fromKey;
            vercelToKey = result.toKey;
          })
          .catch((err) => {
            vercelError = errorMessage(err);
          })
      : Promise.resolve(),
  ]);

  const daily: ExternalDailyPoint[] = axis.map((date) => {
    const ga = gaRows?.get(date);
    const vercel = vercelRows?.get(date);
    return {
      date,
      gaActiveUsers: gaRows ? (ga?.activeUsers ?? 0) : null,
      gaPageViews: gaRows ? (ga?.pageViews ?? 0) : null,
      vercelVisitors: vercelRows ? (vercel?.visitors ?? null) : null,
      vercelPageViews: vercelRows ? (vercel?.pageViews ?? 0) : null,
    };
  });

  return {
    windowDays: days,
    from: fromKey,
    to: toKey,
    refreshedAt: now.toISOString(),
    sources: {
      googleAnalytics: {
        configured: Boolean(gaConfig),
        ok: Boolean(gaRows),
        error: gaError,
      },
      vercel: {
        configured: Boolean(vercelConfig),
        ok: Boolean(vercelRows),
        error: vercelError,
        warning: vercelWarning,
        from: vercelFromKey,
        to: vercelToKey,
      },
    },
    daily,
    totals: {
      gaActiveUsers: sumNullable(daily.map((d) => d.gaActiveUsers)),
      gaPageViews: sumNullable(daily.map((d) => d.gaPageViews)),
      vercelVisitors: sumNullable(daily.map((d) => d.vercelVisitors)),
      vercelPageViews: sumNullable(daily.map((d) => d.vercelPageViews)),
    },
  };
}
