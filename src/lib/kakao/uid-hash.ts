// 카카오 회원번호 → 대조 키. 계정이 사라진 뒤에도 남는 기록의 키라 평문을 두지 않는다.
//   075(쿠폰 원장)·076(무료 사용량 원장)이 같은 키를 쓴다.
import { createHash } from 'node:crypto';

/**
 * ⚠️ 카카오 회원번호는 짧은 숫자라 해시만으로 완전한 비가역성은 아니다.
 *   목적은 "유출돼도 카카오 ID 가 평문으로 나가지 않는다" 까지다.
 */
export function kakaoUidHash(verifiedKakaoUid: string): string {
  return createHash('sha256').update(verifiedKakaoUid).digest('hex');
}

/**
 * 로그인 세션의 user.identities 에서 카카오 회원번호를 꺼내 해시한다.
 *
 * 🔴 2026-09-11 — 예전엔 user_metadata(provider_id/sub)에서 읽었다. user_metadata 는 로그인한 사용자가
 *   `supabase.auth.updateUser({ data })` 한 줄로 덮어쓸 수 있어, 탈퇴 직전에 바꾸면 076 원장(무료 사용량)을 우회했다.
 *   identities 는 GoTrue 가 검증된 id_token 으로만 쓴다(사용자 수정 불가). `id` 는 제공자 사용자 ID(= 카카오 회원번호),
 *   `identity_id` 가 행 uuid 다 — 기존 원장 키(sha256(회원번호))와 같은 값이 나온다.
 * 카카오 신원이 없는 계정(이메일·구글)은 null.
 */
export function kakaoUidHashFromIdentities(
  identities: ReadonlyArray<{ provider: string; id: string }> | null | undefined
): string | null {
  const uid = identities?.find((identity) => identity.provider === 'kakao')?.id?.trim();
  return uid ? kakaoUidHash(uid) : null;
}
