// 2026-09-26 — 2027 신년운세 열람 판정(화면·PDF 공용). 로그인 + 본인 사주 + (신년운세 이용권 || 평생 이용권).
//   이용권이 없어도 사주는 돌려준다 — 미리보기(키워드·한 줄 요약)는 결정론 계산이라 무료로 보여 준다.
import type { User } from '@supabase/supabase-js';
import { createClient, hasSupabaseServerEnv, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { resolveReading } from '@/lib/saju/readings';
import { toSlug } from '@/lib/saju/pillars';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { hasNewYearEntitlementForReading } from '@/lib/product-entitlements';

export async function resolveNewYearAccess(slug: string, year: number) {
  const reading = await resolveReading(slug);
  const closed = { reading, user: null as User | null, hasAccess: false, isOwner: false };
  if (!reading || !hasSupabaseServerEnv || !hasSupabaseServiceEnv) return closed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return closed;

  const isOwner = !reading.userId || reading.userId === user.id;
  if (!isOwner) return { ...closed, user };

  const readingKey = toSlug(reading.input);
  const [newYear, lifetime] = await Promise.all([
    hasNewYearEntitlementForReading(user.id, readingKey, year),
    getLifetimeReportEntitlement(user.id, readingKey, [slug]),
  ]);
  return { reading, user, hasAccess: newYear || Boolean(lifetime), isOwner };
}
