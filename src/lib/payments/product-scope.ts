import {
  isTasteProductPackage,
  type PaymentPackage,
  type TasteProductId,
} from '@/lib/payments/catalog';
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
  // 2026-05-23 ① — 궁합 1회권. slug 가 커플 키(사주 reading 아님)라 별도 kind.
  | 'compat';

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

// buildReadingProductScopeKey 역함수 — 'reading:{readingKey}' → readingKey. 이용권을 사주
// 정체성으로 매칭(reading-identity)할 때 저장된 scope_key 에서 readingKey 를 회수하는 데 쓴다.
export function parseReadingProductScopeKey(scopeKey: string | null | undefined): string | null {
  const trimmed = scopeKey?.trim();
  if (!trimmed || !trimmed.startsWith('reading:')) return null;
  return trimmed.slice('reading:'.length) || null;
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

// 2026-05-23 ① — 궁합 per-couple scope. coupleKey 는 buildCompatibilityCoupleKey(두 생년월일).
export function buildCompatScopeKey(coupleKey: string) {
  return `compat:${coupleKey}`;
}

// buildLifetimeReportScopeKey 의 역함수 — 환불 회수 시 legacy credit_transactions
// 의 metadata.readingKey 매칭에 필요(lifetime grant 는 readingKey 로 기록됨).
export function parseLifetimeReportReadingKey(scopeKey: string | null | undefined) {
  const trimmed = scopeKey?.trim() ?? '';
  return trimmed.startsWith('lifetime:') ? trimmed.slice('lifetime:'.length) : null;
}

// 2026-05-22 — per-factor 점수 풀이 unlock. (readingKey, factorId) 당 1회.
export function buildScoreFactorScopeKey(readingKey: string, factorId: string) {
  return `score:${readingKey}:${factorId}`;
}

export type ScoreFactorId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

// buildScoreFactorScopeKey 역함수 — 'score:{readingKey}:{factorId}' → {readingKey, factorId}.
// readingKey 는 '-' 구분이라 ':' 가 없어 마지막 ':' 가 factorId 경계. 정체성 매칭에서 사용.
export function parseScoreFactorScopeKey(
  scopeKey: string | null | undefined
): { readingKey: string; factorId: ScoreFactorId } | null {
  const trimmed = scopeKey?.trim();
  if (!trimmed || !trimmed.startsWith('score:')) return null;
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon < 'score:'.length) return null;
  const readingKey = trimmed.slice('score:'.length, lastColon);
  const factorId = parseFactorScope(trimmed.slice(lastColon + 1));
  if (!readingKey || !factorId) return null;
  return { readingKey, factorId };
}

export function parseFactorScope(scope: string | null | undefined): ScoreFactorId | null {
  const v = scope?.trim().toUpperCase();
  if (v === 'F1' || v === 'F2' || v === 'F3' || v === 'F4' || v === 'F5') return v;
  return null;
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

  // 2026-05-23 ① — 궁합 1회권: slug 는 커플 키(사주 reading 아님)라 reading 조회 없이 직접 scope.
  if (productId === 'compat-reading') {
    const coupleKey = slug?.trim() || null;
    return {
      productId,
      scopeKey: coupleKey ? buildCompatScopeKey(coupleKey) : null,
      kind: coupleKey ? 'compat' : 'global',
      reading: null,
      readingKey: null,
      slug: coupleKey,
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
    // 2026-05-24 — readingId(slug)는 사주 재생성·경로 교차마다 바뀌어 결제 무한반복을
    //   유발했다. 다른 소액상품과 동일하게 안정적인 readingKey(생년월일 결정적)로 grant.
    //   조회(checkTodayDetailAccess)는 readingKey + legacy readingId 를 함께 본다.
    return {
      productId,
      scopeKey: buildTodayDetailScopeKey(readingIdentity.readingKey),
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

  if (productId === 'score-factor') {
    const factorId = parseFactorScope(scope);
    return {
      productId,
      // factor 미지정 시 reading 단위로(방어). 정상 흐름은 scope=F1~F5.
      scopeKey: factorId
        ? buildScoreFactorScopeKey(readingIdentity.readingKey, factorId)
        : buildReadingProductScopeKey(readingIdentity.readingKey),
      kind: 'reading',
      ...readingIdentity,
      targetYear: null,
      targetMonth: null,
    };
  }

  // 2026-06-07 — 사주 점수 단일 언락: reading 단위(reading:{readingKey}) scope.
  if (productId === 'score-total') {
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
      // Bug fix — checkout 가 선택한 고민을 scope(=concernId)로 넘기는데(premium-lock-card),
      //   열람 redirect 가 이를 버려 결제 후 항상 'general' 로 열리던 버그. concern 으로 복원.
      //   (상세 페이지가 normalizeConcernId 로 정규화 → 빈/유효하지 않은 scope 는 general = 현행.)
      const concern = options.scope?.trim();
      const concernParam = concern ? `&concern=${encodeURIComponent(concern)}` : '';
      return `/today-fortune/detail?paid=today-detail&sourceSessionId=${encodeURIComponent(normalizedSlug)}${concernParam}`;
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

  if (productId === 'score-factor' && normalizedSlug) {
    return `/saju/${encodeURIComponent(normalizedSlug)}`;
  }

  if (productId === 'love-question') return '/compatibility/input';
  if (productId === 'compat-reading') return '/compatibility/input';
  // 2026-07-19 — 주제 단품은 today-detail 화면을 해당 주제로 연다(재물=wealth, 일=career).
  //   기존 `/saju/new?topic=...` 은 **입력폼**이고 그 폼은 topic 을 읽지도 않아
  //   구매자가 빈 화면을 만났다.
  if ((productId === 'money-pattern' || productId === 'work-flow') && normalizedSlug) {
    const topic = productId === 'money-pattern' ? 'wealth' : 'career';
    return `/saju/${encodeURIComponent(normalizedSlug)}/today-detail?topic=${topic}`;
  }

  return '/my/results';
}
