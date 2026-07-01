// 2026-06-26 — 결제 실패 안내. 나이스페이 서버승인 returnUrl 핸들러의 실패 redirect 대상.
//   (인증 실패·서명 검증 실패·금액 불일치·승인 실패 등). 참고: docs/payment-nicepay-migration.md
//   다른 결과 페이지와 동일하게 AppShell 로 감싸 전역 레이아웃을 받게 한다(단독 main 은 빈 화면).
import Link from 'next/link';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata = {
  title: '결제 미완료 · 간지사주',
  robots: { index: false },
};

export default async function CreditsFailPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; provider?: string; retry?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason?.trim() || '결제가 취소되었거나 완료되지 않았습니다.';
  // 2026-06-28 — "다시 결제하기" 가 전충전(/credits)이 아니라 원래 결제하던 상품으로 돌아가게 한다.
  //   retry 는 nicepay return 핸들러가 주문 metadata.checkoutPath 를 실어 보낸 내부 경로.
  //   open-redirect 차단: 내부 절대경로('/'로 시작, '//' 제외)만 허용, 없으면 /credits 폴백.
  const retryRaw = params.retry?.trim() ?? '';
  const retryHref =
    retryRaw.startsWith('/') && !retryRaw.startsWith('//') ? retryRaw : '/credits';

  return (
    <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-32 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page">
        <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center px-5 text-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-full"
            style={{ background: '#fdecec', color: '#e2574c', fontSize: 30, fontWeight: 800 }}
            aria-hidden="true"
          >
            !
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold" style={{ color: '#2b2b35', wordBreak: 'keep-all' }}>
            결제가 완료되지 않았어요
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: '#6b6b76', wordBreak: 'keep-all' }}>
            {reason} 결제 금액은 청구되지 않았습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <div className="mt-6 grid w-full gap-2">
            <Link
              href={retryHref}
              className="flex h-12 items-center justify-center rounded-full text-[15px] font-bold text-white no-underline"
              style={{ background: '#e85b8a' }}
            >
              다시 결제하기
            </Link>
            <Link
              href="/my/billing"
              className="flex h-12 items-center justify-center rounded-full border text-[15px] font-bold no-underline"
              style={{ borderColor: '#e5e5ea', color: '#6b6b76' }}
            >
              내 결제 내역
            </Link>
          </div>
        </div>
      </AppPage>
    </AppShell>
  );
}
