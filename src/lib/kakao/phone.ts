// 국내 휴대폰 번호 순수 헬퍼 — 클라이언트/서버 공용.
// (contact.ts 는 supabase/server 를 import 해 클라이언트에서 못 쓰므로 분리.)

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
