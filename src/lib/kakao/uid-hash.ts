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
 * 로그인 세션의 user 객체에서 카카오 회원번호를 꺼내 해시한다.
 *
 * Supabase 카카오 로그인(signInWithIdToken)은 OIDC 클레임을 user_metadata 에 담는다 —
 * `provider_id` 와 `sub` 둘 다 카카오 회원번호다(실측: 전 계정에 존재).
 * 카카오가 아닌 경로(이메일 등)로 가입한 계정은 null — 그 경우 대조가 불가능하다.
 */
export function kakaoUidHashFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const raw = metadata?.provider_id ?? metadata?.sub;
  const uid = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
  return uid ? kakaoUidHash(uid) : null;
}
