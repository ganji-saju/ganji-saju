// 2026-05-15 — 회원가입 직링크 alias. /signup → /login?mode=signup.
// 사용자가 명시적 URL 로 회원가입 페이지에 접근 가능 (북마크·외부 공유 친화).
import { redirect } from 'next/navigation';

export default function SignupAliasPage() {
  redirect('/login?mode=signup');
}
