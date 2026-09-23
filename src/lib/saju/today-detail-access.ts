// 2026-05-14: today-detail 중복 결제 방지 — 결제는 slug 방식으로 저장됐지만, 사주를 다시 만들면 slug 가 바뀌어
// 같은 사람이 또 결제하라는 메시지를 받는 버그가 있었다. 또 today-fortune 1전 unlock 과 카드 결제가 별도 사일로라
// cross-flow 인식이 안 됐다. 이 함수는 본인이 이미 권한을 가지면 entitlement-like 객체를 반환한다(truthy/falsy 만 보면 된다).
//   1) product_entitlements — 오늘(KST) **이 사주로** 산 이용권(hasTodayDetailEntitlementForSaju: created_at + #699 사주 정체성 매칭)
//   2) credit_transactions — 오늘(KST)의 today-fortune 1전/멤버십/쿠폰 열람 기록
// 2026-09-23 — scope key 목록으로 정확일치 조회하던 방식은 없앴다(저장 scope 가 today:<사주>:<KST 날짜> 가 되면서
//   정확일치가 성립하지 않는다). 판정은 위 두 가지뿐이다.
import { hasTodayDetailEntitlementForSaju } from '@/lib/product-entitlements';
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

  // 2026-06-05 today-detail 일일 만료 fix(영구 접근 버그) — 모든 접근을 오늘(KST=todayKey) 생성분으로 한정한다.
  //   unlock 라우트(resolveTodayFortuneUnlockAccess)와 같은 판정으로 정합성 유지.
  const todayKey = getKoreaAccessDay();
  const reading = await resolveReading(slug);
  const readingKey = reading ? toSlug(reading.input) : null;

  // 1) product_entitlements — 오늘(KST) **이 사주로** 결제한 today-detail entitlement 만(2026-09-14 사용자 결정).
  if (await hasTodayDetailEntitlementForSaju(user.id, todayKey, { readingKey, slug })) {
    return { hasAccess: true, source: { kind: 'product-entitlement', via: 'same-day' } };
  }

  // 2) Today-fortune 1전 unlock — 오늘(KST) unlock 만 인정 (slug / readingKey / legacy 키).
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
