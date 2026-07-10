// 자체 방문/페이지뷰 수집에서 GA/Vercel 비교를 흐리는 내부 트래픽을 제외하는 순수 helper.
// client(VisitPing)와 server(/api/visit)가 같은 규칙을 공유한다.

export type VisitAnalyticsSkipReason =
  | 'admin_path'
  | 'non_production_deployment'
  | 'non_canonical_host'
  | 'excluded_ip'
  | 'bot_user_agent';

export interface VisitAnalyticsFilterInput {
  path: string | null | undefined;
  host?: string | null;
  siteUrl?: string | null;
  deploymentEnv?: string | null;
  clientIp?: string | null;
  excludedIps?: string | null;
  /** 서버(/api/visit)만 안다. 클라이언트(VisitPing)는 전달하지 않으므로 undefined = 검사 안 함. */
  userAgent?: string | null;
}

// 2026-07-10 — 봇 UA 패턴. JS 를 실행해 비콘까지 쏘는 크롤러가 방문 지표를 오염시켰다
//   (site_visits 2,540행이 전부 다른 vid·page_views=1, 진입 경로가 페이지마다 균일).
//   ⚠️ 인스타/카카오 인앱 브라우저는 사람이다. UA 에 'Instagram'·'KAKAOTALK' 이 들어가지만
//     아래 패턴엔 걸리지 않는다(테스트로 고정).
const BOT_UA_PATTERNS: readonly RegExp[] = [
  /bot\b/i, // Googlebot, bingbot, PetalBot, AhrefsBot, SemrushBot, Twitterbot …
  /\bbots?\b/i,
  /crawler|spider|slurp|scrapy/i,
  /baiduspider|yandex/i,
  /headless|phantomjs|puppeteer|playwright|selenium|lighthouse/i,
  /curl\/|wget\/|python-requests|node-fetch|axios\/|go-http-client|okhttp|java\//i,
  /facebookexternalhit|whatsapp\/|telegram|discord|applebot|embedly|preview/i,
  /pingdom|uptimerobot|gtmetrix|newrelic|datadog/i,
];

/** 정상 브라우저는 UA 를 항상 보낸다 → 없거나 빈 값이면 봇으로 본다. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent ?? '').trim();
  if (!ua) return true;
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(ua));
}

function normalizePath(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '/';
  try {
    const url = new URL(raw, 'https://example.invalid');
    return url.pathname || '/';
  } catch {
    return raw.split('?')[0] || '/';
  }
}

export function isAdminAnalyticsPath(value: string | null | undefined): boolean {
  const path = normalizePath(value);
  return path === '/admin' || path.startsWith('/admin/');
}

function normalizeHost(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  try {
    if (/^https?:\/\//.test(raw)) return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (raw.startsWith('[')) return raw.replace(/^\[|\](?::\d+)?$/g, '') || null;
  const colonCount = raw.split(':').length - 1;
  return colonCount === 1 ? raw.replace(/:\d+$/, '') || null : raw;
}

function canonicalHost(siteUrl: string | null | undefined): string | null {
  return normalizeHost(siteUrl);
}

function isLocalOrPreviewHost(host: string | null): boolean {
  if (!host) return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.vercel.app')
  );
}

function parseCsv(value: string | null | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function ipv4ToInt(value: string): number | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    out = (out << 8) + octet;
  }
  return out >>> 0;
}

function ipMatchesRule(ip: string, rule: string): boolean {
  const normalizedIp = ip.trim();
  const normalizedRule = rule.trim();
  if (!normalizedIp || !normalizedRule) return false;
  if (!normalizedRule.includes('/')) return normalizedIp === normalizedRule;

  const [base, bitsRaw] = normalizedRule.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(normalizedIp);
  const baseInt = ipv4ToInt(base ?? '');
  if (ipInt == null || baseInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isExcludedAnalyticsIp(
  clientIp: string | null | undefined,
  excludedIps: string | null | undefined
): boolean {
  const ip = String(clientIp ?? '').trim();
  if (!ip) return false;
  return parseCsv(excludedIps).some((rule) => ipMatchesRule(ip, rule));
}

export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const raw = forwarded || headers.get('x-real-ip') || headers.get('cf-connecting-ip') || '';
  if (raw.startsWith('[')) return raw.replace(/^\[|\](?::\d+)?$/g, '') || null;
  const colonCount = raw.split(':').length - 1;
  return colonCount === 1 ? raw.replace(/:\d+$/, '') || null : raw || null;
}

export function shouldSkipVisitAnalytics(input: VisitAnalyticsFilterInput): VisitAnalyticsSkipReason | null {
  if (isAdminAnalyticsPath(input.path)) return 'admin_path';

  // userAgent 를 넘긴 호출부(서버)에서만 검사. 클라이언트는 UA 를 모른다.
  if (input.userAgent !== undefined && isBotUserAgent(input.userAgent)) return 'bot_user_agent';

  const deploymentEnv = String(input.deploymentEnv ?? '').trim();
  if (deploymentEnv && deploymentEnv !== 'production') return 'non_production_deployment';

  const host = normalizeHost(input.host);
  const expectedHost = canonicalHost(input.siteUrl);
  if (host && (isLocalOrPreviewHost(host) || (expectedHost && host !== expectedHost))) {
    return 'non_canonical_host';
  }

  if (isExcludedAnalyticsIp(input.clientIp, input.excludedIps)) return 'excluded_ip';

  return null;
}
