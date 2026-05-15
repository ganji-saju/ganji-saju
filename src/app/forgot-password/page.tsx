// 2026-05-15 — 비밀번호 찾기 직링크 alias. /forgot-password → /login?mode=recover.
import { redirect } from 'next/navigation';

export default function ForgotPasswordAliasPage() {
  redirect('/login?mode=recover');
}
