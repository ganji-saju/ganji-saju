// 2026-05-14: today-detail 중복 결제 방지 — 결제는 slug 기준으로 저장됐지만,
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
  getTasteProductEntitlement,
} from '@/lib/product-entitlements';
import { hasTodayFortunePremiumAccess } from '@/lib/credits/detail-report-access';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

type TodayDetailAccess =
  | { kind: 'product-entitlement'; via: 'slug' | 'reading-key' }
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

  // 1) Slug-기반 entitlement (legacy 저장본)
  const slugEntitlement = await getTasteProductEntitlement(
    user.id,
    'today-detail',
    buildTodayDetailScopeKey(slug)
  );
  if (slugEntitlement) {
    return { hasAccess: true, source: { kind: 'product-entitlement', via: 'slug' } };
  }

  // 2) Reading-key 기반 entitlement (BirthInput-결정적). 사주를 다시 만들어
  //    slug 가 바뀌어도 같은 사람이면 같은 readingKey 가 나와 인식된다.
  const reading = await resolveReading(slug);
  const readingKey = reading ? toSlug(reading.input) : null;

  if (readingKey && readingKey !== slug) {
    const readingKeyEntitlement = await getTasteProductEntitlement(
      user.id,
      'today-detail',
      buildTodayDetailScopeKey(readingKey)
    );
    if (readingKeyEntitlement) {
      return { hasAccess: true, source: { kind: 'product-entitlement', via: 'reading-key' } };
    }
  }

  // 3) Today-fortune 1코인 unlock 기록 (별도 흐름이지만 같은 콘텐츠 unlock).
  //    slug 또는 readingKey 어느 쪽이든 매칭되면 인정.
  const coinUnlockedBySlug = await hasTodayFortunePremiumAccess(user.id, slug);
  if (coinUnlockedBySlug) {
    return { hasAccess: true, source: { kind: 'credit-unlock', via: 'today-fortune' } };
  }
  if (readingKey && readingKey !== slug) {
    const coinUnlockedByKey = await hasTodayFortunePremiumAccess(user.id, readingKey);
    if (coinUnlockedByKey) {
      return { hasAccess: true, source: { kind: 'credit-unlock', via: 'today-fortune' } };
    }
  }

  return { hasAccess: false, source: null };
}
