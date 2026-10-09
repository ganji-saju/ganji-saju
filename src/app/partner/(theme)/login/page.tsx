// 올해운 노트 — 로그인(설계 §3-4). 카카오·구글만. 기존 시작 경로를 그대로 부르고 next 로 결제 페이지에 돌아온다.
//   카카오 버튼 노랑(#FEE500)은 카카오 로그인 디자인 가이드 색이라 테마 색으로 바꾸지 않는다.
import { redirect } from 'next/navigation';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import { NOTE_CARD, NOTE_PRIMARY_BUTTON, NOTE_TITLE_STYLE } from '@/features/partner-theme/note-theme';
import { safePartnerNext } from '@/features/partner-theme/partner-next';

export const dynamic = 'force-dynamic';

export default async function PartnerLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safePartnerNext((await searchParams).next);
  if (hasSupabaseServerEnv) {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (user) redirect(next);
  }
  const q = `next=${encodeURIComponent(next)}`;
  return (
    <section className={`${NOTE_CARD} grid gap-3`}>
      <h1 style={NOTE_TITLE_STYLE} className="text-[22px] font-extrabold leading-[1.4]">로그인하고 이어서 볼게요</h1>
      <p className="text-[15px] leading-[1.7] text-[var(--note-muted)]">결제한 운세를 언제든 다시 열어 볼 수 있게 계정에 저장해요.</p>
      <a href={`/api/auth/kakao/start?${q}`} className="block w-full rounded-[14px] bg-[#FEE500] py-3.5 text-center text-[17px] font-extrabold text-[#191919]">카카오로 계속하기</a>
      <a href={`/api/auth/google/start?${q}`} className={NOTE_PRIMARY_BUTTON}>구글로 계속하기</a>
      <a href={`/login?${q}`} className="mt-1 text-center text-[14px] text-[var(--note-muted)] underline">이메일로 로그인</a>
    </section>
  );
}
