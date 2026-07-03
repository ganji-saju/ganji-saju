// 사용자 전화번호 + 광고 수신동의 (카카오 알림톡/친구톡 대상).
// 정보성 알림톡 = phone 필요, 광고성(친구톡) = ad_consent 필요.
import { createClient } from '@/lib/supabase/server';

export interface UserContact {
  userId: string;
  phone: string | null;
  adConsent: boolean;
  adConsentAt: string | null;
}

// 2026-07-03 — 순수 헬퍼는 클라이언트 공용을 위해 phone.ts 로 분리(기존 import 호환 재수출).
export { normalizeKoreanMobile, maskKoreanMobile } from './phone';

export async function getUserContact(userId: string): Promise<UserContact | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_contact')
    .select('user_id, phone, ad_consent, ad_consent_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id as string,
    phone: (data.phone as string | null) ?? null,
    adConsent: Boolean(data.ad_consent),
    adConsentAt: (data.ad_consent_at as string | null) ?? null,
  };
}

export async function upsertUserContact(
  userId: string,
  input: { phone: string | null; adConsent: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from('user_contact').upsert(
    {
      user_id: userId,
      phone: input.phone,
      ad_consent: input.adConsent,
      ad_consent_at: input.adConsent ? now : null,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
