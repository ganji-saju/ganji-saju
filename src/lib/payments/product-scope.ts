import {
  isTasteProductPackage,
  type PaymentPackage,
  type TasteProductId,
} from '@/lib/payments/catalog';
import {
  buildPersonalityCompatibilityResultHref,
  isPersonalityCompatibilityMiniProductId,
} from '@/lib/payments/personality-compatibility';
import { resolveReading, type ReadingRecord } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';

export type PaidProductId = TasteProductId | 'lifetime-report';

export type PaymentProductScopeKind =
  | 'global'
  | 'reading'
  | 'today'
  | 'calendar-month'
  | 'year'
  | 'lifetime-reading'
  | 'personality-compatibility';

export interface PaymentProductScope {
  productId: PaidProductId;
  scopeKey: string | null;
  kind: PaymentProductScopeKind;
  reading: ReadingRecord | null;
  readingKey: string | null;
  slug: string | null;
  targetYear: number | null;
  targetMonth: number | null;
}

export interface ResolvePaymentProductScopeInput {
  pkg: PaymentPackage;
  slug?: string | null;
  scope?: string | null;
  now?: Date;
}

export function buildReadingProductScopeKey(readingKey: string) {
  return `reading:${readingKey}`;
}

export function buildTodayDetailScopeKey(sourceSessionId: string) {
  return `today:${sourceSessionId}`;
}

export function buildMonthlyCalendarScopeKey(readingKey: string, year: number, month: number) {
  return `calendar:${readingKey}:${year}-${String(month).padStart(2, '0')}`;
}

export function buildYearCoreScopeKey(readingKey: string, year: number) {
  return `year:${readingKey}:${year}`;
}

export function buildLifetimeReportScopeKey(readingKey: string) {
  return `lifetime:${readingKey}`;
}

export function normalizeEntitlementScopeKey(scopeKey: string | null | undefined) {
  const trimmed = scopeKey?.trim() ?? '';
  return trimmed || 'global';
}

export function parseYearMonthScope(scope: string | null | undefined) {
  const match = scope?.trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

export function parseYearScope(scope: string | null | undefined) {
  const match = scope?.trim().match(/^(\d{4})$/);
  if (!match) return null;

  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}

export function getKoreaYear(now: Date = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
    }).format(now)
  );
}

async function resolveReadingIdentity(slug: string | null | undefined) {
  const normalizedSlug = slug?.trim() || null;
  if (!normalizedSlug) {
    return {
      reading: null,
      readingKey: null,
      slug: null,
    };
  }

  const reading = await resolveReading(normalizedSlug);
  return {
    reading,
    readingKey: reading ? toSlug(reading.input) : normalizedSlug,
    slug: normalizedSlug,
  };
}

export function getPaidProductIdFromPackage(pkg: PaymentPackage): PaidProductId | null {
  if (isTasteProductPackage(pkg)) return pkg.tasteProductId;
  if (pkg.kind === 'lifetime_report') return 'lifetime-report';
  return null;
}

export async function resolvePaymentProductScope({
  pkg,
  slug,
  scope,
  now,
}: ResolvePaymentProductScopeInput): Promise<PaymentProductScope | null> {
  const productId = getPaidProductIdFromPackage(pkg);
  if (!productId) return null;

  if (productId === 'love-question' || productId === 'money-pattern' || productId === 'work-flow') {
    return {
      productId,
      scopeKey: null,
      kind: 'global',
      reading: null,
      readingKey: null,
      slug: slug?.trim() || null,
      targetYear: null,
      targetMonth: null,
    };
  }

  if (isPersonalityCompatibilityMiniProductId(productId)) {
    return {
      productId,
      scopeKey: scope?.trim() || null,
      kind: 'personality-compatibility',
      reading: null,
      readingKey: null,
      slug: null,
      targetYear: null,
      targetMonth: null,
    };
  }

  const readingIdentity = await resolveReadingIdentity(slug);
  if (!readingIdentity.slug || !readingIdentity.readingKey) {
    return {
      productId,
      scopeKey: null,
      kind: 'global',
      ...readingIdentity,
      targetYear: null,
      targetMonth: null,
    };
  }

  if (productId === 'today-detail') {
    return {
      productId,
      scopeKey: buildTodayDetailScopeKey(readingIdentity.slug),
      kind: 'today',
      ...readingIdentity,
      targetYear: null,
      targetMonth: null,
    };
  }

  if (productId === 'monthly-calendar') {
    const yearMonth = parseYearMonthScope(scope);
    if (!yearMonth) {
      return {
        productId,
        scopeKey: buildReadingProductScopeKey(readingIdentity.readingKey),
        kind: 'reading',
        ...readingIdentity,
        targetYear: null,
        targetMonth: null,
      };
    }

    return {
      productId,
      scopeKey: buildMonthlyCalendarScopeKey(
        readingIdentity.readingKey,
        yearMonth.year,
        yearMonth.month
      ),
      kind: 'calendar-month',
      ...readingIdentity,
      targetYear: yearMonth.year,
      targetMonth: yearMonth.month,
    };
  }

  if (productId === 'year-core') {
    const targetYear = parseYearScope(scope) ?? getKoreaYear(now);
    return {
      productId,
      scopeKey: buildYearCoreScopeKey(readingIdentity.readingKey, targetYear),
      kind: 'year',
      ...readingIdentity,
      targetYear,
      targetMonth: null,
    };
  }

  return {
    productId,
    scopeKey: buildLifetimeReportScopeKey(readingIdentity.readingKey),
    kind: 'lifetime-reading',
    ...readingIdentity,
    targetYear: null,
    targetMonth: null,
  };
}

export function buildPurchasedProductHref(
  productId: PaidProductId,
  slug: string | null | undefined,
  options: {
    from?: string | null;
    scope?: string | null;
  } = {}
) {
  const normalizedSlug = slug?.trim();

  if (productId === 'today-detail') {
    if (normalizedSlug && options.from?.startsWith('saju')) {
      return `/saju/${encodeURIComponent(normalizedSlug)}/today-detail`;
    }
    if (normalizedSlug) {
      return `/today-fortune/detail?paid=today-detail&sourceSessionId=${encodeURIComponent(normalizedSlug)}`;
    }
    return '/today-fortune';
  }

  if (productId === 'monthly-calendar' && normalizedSlug) {
    return `/saju/${encodeURIComponent(normalizedSlug)}/premium#fortune-calendar`;
  }

  if (productId === 'year-core' && normalizedSlug) {
    return `/saju/${encodeURIComponent(normalizedSlug)}/premium#yearly-report`;
  }

  if (productId === 'lifetime-report' && normalizedSlug) {
    return `/saju/${encodeURIComponent(normalizedSlug)}/premium`;
  }

  if (productId === 'love-question') return '/compatibility/input';
  if (isPersonalityCompatibilityMiniProductId(productId)) {
    return buildPersonalityCompatibilityResultHref(options.scope);
  }
  if (productId === 'money-pattern') return '/saju/new?topic=wealth';
  if (productId === 'work-flow') return '/saju/new?topic=career';

  return '/my/results';
}
