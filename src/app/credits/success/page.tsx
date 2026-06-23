// Redesign 2026-05-17 (Claude Design / screens-f.jsx ScreenPaymentResult):
// 코인 충전 결제 콜백 — loading/success/error 3 state. mockup 96px pink circle hero.
// membership/success 와 동일 디자인 토큰 (CenteredCard 패턴) — 신규 BOARD_MANIFEST 항목.
// 결제 승인·라우팅·트래킹 무수정.
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
// 2026-05-15 handoff P0: 54 m-coin (코인 충전 성공) + 51 m-loading 연결.
import { MotionCoinSuccess, MotionSajuLoading } from '@/components/motion/motion-primitives';
import '@/components/motion/motion-primitives.css';

type ConfirmStatus = 'loading' | 'success' | 'error';

function CenteredCard({
  iconBg,
  iconText,
  iconChar,
  title,
  description,
  children,
}: {
  iconBg: string;
  iconText: string;
  iconChar: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-5 px-4 pt-8 text-center">
      <div
        className="mx-auto grid h-24 w-24 place-items-center rounded-full"
        style={{
          background: iconBg,
          boxShadow: '0 16px 40px rgba(216,27,114,0.32)',
        }}
        aria-hidden="true"
      >
        <span className="text-[55.2px] font-extrabold leading-none" style={{ color: iconText }}>
          {iconChar}
        </span>
      </div>
      <div>
        <h1 className="text-[25.3px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
          {title}
        </h1>
        <p className="mt-2 whitespace-pre-line px-4 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function LoadingState() {
  return (
    <CenteredCard
      iconBg="linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))"
      iconText="#fff"
      iconChar="…"
      title="결제 확인 중"
      description={`결제 승인과 코인 반영을 확인하고 있어요.\n잠시만 기다려 주세요.`}
    >
      {/* 2026-05-15 handoff 51 m-loading — Phase 3 결제 spinner motion 교체. */}
      <div className="mx-auto flex w-full max-w-md justify-center pt-2">
        <MotionSajuLoading
          active
          labels={['결제 승인', '코인 반영', '확인 완료']}
          moonGlyph="貨"
        />
      </div>
    </CenteredCard>
  );
}

function ErrorState({ errorMessage }: { errorMessage: string }) {
  return (
    <CenteredCard
      iconBg="#fff"
      iconText="var(--app-coral)"
      iconChar="!"
      title="결제 확인에 실패했어요"
      description="결제는 진행되었지만 코인 충전을 확인하지 못했습니다. 잠시 후 다시 시도하거나 결제 상태에서 확인해 주세요."
    >
      <article
        className="mx-auto max-w-md rounded-[14px] border bg-white p-4 text-left"
        style={{ borderColor: 'var(--app-coral)' }}
      >
        <div
          className="text-[13.2px] font-extrabold uppercase tracking-[0.04em]"
          style={{ color: 'var(--app-coral)' }}
        >
          오류 안내
        </div>
        <p className="mt-1.5 text-[14.4px] leading-[1.55] text-[var(--app-copy-muted)]">
          {errorMessage}
        </p>
      </article>

      <div className="mx-auto grid w-full max-w-md gap-2 px-4 pt-2">
        <Link
          href="/credits"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
        >
          코인 충전으로 돌아가기
        </Link>
        <Link
          href="/my/billing"
          className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[15px] font-bold text-[var(--app-copy-muted)]"
        >
          결제 상태 확인
        </Link>
      </div>
    </CenteredCard>
  );
}

function SuccessState({ coins }: { coins: number }) {
  return (
    <CenteredCard
      iconBg="linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))"
      iconText="#fff"
      iconChar="✓"
      title="코인이 충전됐어요"
      description={`필요할 때 여는 해석을 위한 코인이 준비됐어요.\n바로 이어보거나 결제 내역에서 확인할 수 있어요.`}
    >
      {/* 2026-05-15 handoff 54 m-coin — 결제 성공 직후 입자 + ✓ 카드. */}
      <div className="mx-auto flex w-full max-w-md justify-center pb-1">
        <MotionCoinSuccess
          active
          title="충전 완료"
          sub={`+ ${coins} 코인`}
        />
      </div>

      <div className="mx-auto grid w-full max-w-md gap-2 px-4 pt-2">
        <Link
          href="/today-fortune"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
        >
          오늘 운세 보러 가기 →
        </Link>
        <Link
          href="/my/billing"
          className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[15px] font-bold text-[var(--app-copy-muted)]"
        >
          결제 내역 보기
        </Link>
      </div>
    </CenteredCard>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const didConfirm = useRef(false);
  const [status, setStatus] = useState<ConfirmStatus>('loading');
  const [coins, setCoins] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (didConfirm.current) return;
    didConfirm.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    const packageId = searchParams.get('packageId');
    const entrySource = searchParams.get('from') ?? 'credits';

    if (!paymentKey || !orderId || !amount || !packageId) {
      setStatus('error');
      setErrorMessage('결제 정보가 올바르지 않습니다.');
      return;
    }

    fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: parseInt(amount, 10),
        packageId,
      }),
    })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok || !data.success) {
          setStatus('error');
          setErrorMessage(data.error ?? '결제 처리 중 오류가 발생했습니다.');
          return;
        }

        setCoins(data.credits);
        trackMoonlightEvent('payment_completed', {
          from: entrySource,
          packageId,
          amount: Number(amount),
          credits: data.credits,
        });

        if (typeof data.totalCredits === 'number') {
          window.dispatchEvent(
            new CustomEvent('moonlight:credits-updated', {
              detail: { credits: data.totalCredits },
            })
          );
        }

        setStatus('success');
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('서버와 통신하는 중 문제가 생겼습니다.');
      });
  }, [searchParams]);

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState errorMessage={errorMessage} />;
  return <SuccessState coins={coins} />;
}

export default function CreditsSuccessPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page">
        <Suspense fallback={<LoadingState />}>
          <SuccessContent />
        </Suspense>
      </AppPage>
    </AppShell>
  );
}
