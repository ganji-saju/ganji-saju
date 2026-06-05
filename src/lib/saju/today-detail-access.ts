// 2026-05-14: today-detail 중복 결제 방지 — 결제는 slug 방식으로 저장됐지만,
// 사주를 다시 만들면 slug가 바뀌어 같은 사람이 또 결제하라는 메시지를 받는
// 버그가 있었다. 또 today-fortune 1코인 unlock 과 saju 555원 결제가 별도
// 사일로로 동작해 cross-flow 인식이 안 됐다. 이 함수는 다음 3가지를 모두
// 시도해 본인이 이미 권한을 가지면 entitlement-like 객체를 반환한다.
//   1) product_entitlements 의 slug-기반 scope key  (legacy)
//   2) product_entitlements 의 readingKey-기반 scope key (input-deterministic)
//   3) credit_transactions 의 today-fortune 1코인 unlock 기록
// 반환 형태는 호출자가 truthy/falsy 만 확인하면 되도록 단순화.
import {
  buildTodayDetailScopeKey,
  hasTodayDetailEntitlementForDay,
} from '@/lib/product-entitlements';
import {
  getKoreaAccessDay,
  hasDetailReportAccess,
  hasTodayFortunePremiumAccess,
} from '@/lib/credits/detail-report-access';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

type TodayDetailAccess =
  | { kind: 'product-entitlement'; via: 'slug' | 'reading-key' | 'same-day' }
  | { kind: 'credit-unlock'; via: 'today-fortune' };

export interface SajuTodayDetailAccessResult {
  hasAccess: boolean;
  source: TodayDetailAccess | null;
}

// 2026-05-24 — today-detail 결제 권한 조회 scope(우선순위) 단일 출처.
//   readingKey(생년월일 결정적 = 안정)를 primary 로, slug(reading id = 불안정, legacy
//   readingId 결제분)를 보조로 둔다. grant 도 product-scope 에서 readingKey 로 통일하므로
//   재생성·경로 교차로 slug 가 바뀌어도 readingKey scope 로 인식 → 결제 무한반복 해소.
export function todayDetailEntitlementScopeKeys(identity: {
  slug: string | null;
  readingKey: string | null;
}): string[] {
  const keys: string[] = [];
  if (identity.readingKey) keys.push(buildTodayDetailScopeKey(identity.readingKey));
  if (identity.slug && identity.slug !== identity.readingKey) {
    keys.push(buildTodayDetailScopeKey(identity.slug));
  }
  return keys;
}

export async function getSajuTodayDetailEntitlement(slug: string) {
  const result = await checkTodayDetailAccess(slug);
  return result.hasAccess ? { source: result.source } : null;
}

export async function checkTodayDetailAccess(slug: string): Promise<SajuTodayDetailAccessResult> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return { hasAccess: false, source: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasAccess: false, source: null };

  // 1) product_entitlements — readingKey(안정) primary + legacy readingId(slug) 병행.
  //    grant 가 readingKey 로 통일됐으므로 사주 재생성으로 slug 가 바뀌어도 인식되고,
  //    과거 readingId 로 결제한 분은 legacy slug scope 로 인식된다.
  // 2026-06-05 today-detail 일일 만료 fix(영구 접근 버그) — 영구 scope-key entitlement
  //   조회를 제거하고, 모든 접근을 오늘(KST=todayKey) 생성분으로 한정한다.
  //   unlock 라우트(resolveTodayFortuneUnlockAccess)와 동일 정책으로 정합성 유지.
  const todayKey = getKoreaAccessDay();
  const reading = await resolveReading(slug);
  const readingKey = reading ? toSlug(reading.input) : null;

  // 1) product_entitlements — 오늘(KST) 결제한 today-detail entitlement 만.
  if (await hasTodayDetailEntitlementForDay(user.id, todayKey)) {
    return { hasAccess: true, source: { kind: 'product-entitlement', via: 'same-day' } };
  }

  // 2) Today-fortune 1코인 unlock — 오늘(KST) unlock 만 인정 (slug / readingKey / legacy 키).
  if (await hasTodayFortunePremiumAccess(user.id, slug, todayKey)) {
    return { hasAccess: true, source: { kind: 'credit-unlock', via: 'today-fortune' } };
  }
  if (
    readingKey &&
    readingKey !== slug &&
    (await hasTodayFortunePremiumAccess(user.id, readingKey, todayKey))
  ) {
    return { hasAccess: true, source: { kind: 'credit-unlock', via: 'today-fortune' } };
  }
  if (readingKey && (await hasDetailReportAccess(user.id, readingKey, todayKey))) {
    return { hasAccess: true, source: { kind: 'credit-unlock', via: 'today-fortune' } };
  }

  return { hasAccess: false, source: null };
}
