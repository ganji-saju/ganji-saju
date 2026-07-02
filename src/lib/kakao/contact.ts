// 사용자 전화번호 + 광고 수신동의 (카카오 알림톡/친구톡 대상).
// 정보성 알림톡 = phone 필요, 광고성(친구톡) = ad_consent 필요.
import { createClient } from '@/lib/supabase/server';

export interface UserContact {
  userId: string;
  phone: string | null;
  adConsent: boolean;
  adConsentAt: string | null;
}

/**
 * 국내 휴대폰 정규화: 하이픈/공백/국가코드 제거 후 `010########`(11자리) 검증.
 * 유효하지 않으면 null. Solapi 발송 포맷(하이픈 없는 국내번호)에 맞춘다.
 */
export function normalizeKoreanMobile(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  // +82 10... → 010...
  const local = digits.startsWith('8210') ? `0${digits.slice(2)}` : digits;
  return /^010\d{8}$/.test(local) ? local : null;
}

/** 표시용 마스킹: 010-1234-**** */
export function maskKoreanMobile(phone: string | null): string {
  if (!phone || !/^010\d{8}$/.test(phone)) return '';
  return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-****`;
}

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
