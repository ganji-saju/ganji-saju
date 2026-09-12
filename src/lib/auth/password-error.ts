// 2026-09-12 — 유출 비밀번호 차단(HaveIBeenPwned)을 켰다. Supabase 는 거부 사유를 영어 문장
//   ("Password is known to be weak and easy to guess…")으로 줘서, 화면에 그대로 뜨면 사용자가 이유를 모른다.
//   가입(signup 라우트)·재설정(/login 재설정 모드·/reset-password) 세 곳이 이 함수 하나로 같은 말을 한다.

type AuthErrorLike = { code?: string; message?: string } | null | undefined;

/** 비밀번호 때문에 거부된 경우의 한국어 안내. 비밀번호 사유가 아니면 null — 호출부가 기존 안내를 쓴다. */
export function passwordRejectionMessage(error: AuthErrorLike): string | null {
  if (!error) return null;
  const message = error.message?.toLowerCase() ?? '';
  if (error.code === 'same_password' || message.includes('different from the old')) {
    return '지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요.';
  }
  if (error.code === 'weak_password' || message.includes('known to be weak') || message.includes('pwned')) {
    return '유출된 적 있거나 너무 쉬운 비밀번호라 쓸 수 없어요. 다른 비밀번호를 입력해 주세요.';
  }
  return null;
}
