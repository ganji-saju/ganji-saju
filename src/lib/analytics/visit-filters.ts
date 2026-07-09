// 자체 방문/페이지뷰 수집에서 GA/Vercel 비교를 흐리는 내부 트래픽을 제외하는 순수 helper.
// client(VisitPing)와 server(/api/visit)가 같은 규칙을 공유한다.

export type VisitAnalyticsSkipReason =
  | 'admin_path'
  | 'non_production_deployment'
  | 'non_canonical_host'
  | 'excluded_ip';

export interface VisitAnalyticsFilterInput {
  path: string | null | undefined;
  host?: string | null;
  siteUrl?: string | null;
  deploymentEnv?: string | null;
  clientIp?: string | null;
  excludedIps?: string | null;
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
