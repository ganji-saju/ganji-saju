// 2026-06-26 — 결제 실패 안내. 나이스페이 서버승인 returnUrl 핸들러의 실패 redirect 대상.
//   (인증 실패·서명 검증 실패·금액 불일치·승인 실패 등). 참고: docs/payment-nicepay-migration.md
import Link from 'next/link';

export const metadata = {
  title: '결제 미완료 · 간지사주',
  robots: { index: false },
};

export default async function CreditsFailPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; provider?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason?.trim() || '결제가 취소되었거나 완료되지 않았습니다.';

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <div
        className="grid h-16 w-16 place-items-center rounded-full"
        style={{ background: '#fdecec', color: 'var(--app-coral)', fontSize: 30, fontWeight: 800 }}
        aria-hidden="true"
      >
        !
      </div>
      <h1
        className="mt-4 text-[22px] font-extrabold"
        style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
      >
        결제가 완료되지 않았어요
      </h1>
      <p
        className="mt-2 text-[15px] leading-relaxed"
        style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
      >
        {reason} 결제 금액은 청구되지 않았습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <div className="mt-6 grid w-full gap-2">
        <Link
          href="/credits"
          className="flex h-12 items-center justify-center rounded-full text-[15px] font-bold text-white no-underline"
          style={{ background: 'var(--app-pink)' }}
        >
          다시 결제하기
        </Link>
        <Link
          href="/my/billing"
          className="flex h-12 items-center justify-center rounded-full border text-[15px] font-bold no-underline"
          style={{ borderColor: 'var(--app-line)', color: 'var(--app-copy-muted)' }}
        >
          내 결제 내역
        </Link>
      </div>
    </main>
  );
}
