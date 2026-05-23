// Redesign 2026-05-13 (Claude Design / screens-f.jsx ScreenPaymentResult):
// 결제 콜백 — loading/success/error 3 state. mockup 96px pink circle hero.
// 결제 승인·라우팅·트래킹 무수정.
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  clearPendingLifetimeReportSlug,
  readPendingLifetimeReportSlug,
} from '@/lib/payments/lifetime-report';
import { trackMoonlightEvent } from '@/lib/analytics';
import { buildSajuTodayDetailHref } from '@/lib/saju/today-detail-links';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
// 2026-05-15 handoff P0: 54 m-coin + 51 m-loading 연결.
import { MotionCoinSuccess, MotionSajuLoading } from '@/components/motion/motion-primitives';
import '@/components/motion/motion-primitives.css';

type ConfirmStatus = 'loading' | 'success' | 'error';

function buildCompleteHref(plan: string, slug: string | null) {
  const params = new URLSearchParams({ plan, payment: 'confirmed' });
  if (slug) params.set('slug', slug);
  return `/membership/complete?${params.toString()}`;
}

function buildPremiumResultHref(plan: string, slug: string | null) {
  if (!slug || (plan !== 'premium' && plan !== 'lifetime')) return null;
  const params = new URLSearchParams({ payment: 'confirmed', plan });
  return `/saju/${encodeURIComponent(slug)}/premium?${params.toString()}`;
}

function buildTasteProductHref(
  product: string | null,
  slug: string | null,
  scope: string | null,
  entrySource: string | null
) {
  if (product === 'today-detail') {
    if (slug && entrySource?.startsWith('saju')) {
      return `${buildSajuTodayDetailHref(slug)}?paid=today-detail`;
    }
    const params = new URLSearchParams({ paid: product, concern: scope || 'general' });
    if (slug) params.set('sourceSessionId', slug);
    return `/today-fortune/detail?${params.toString()}`;
  }
  if (product === 'love-question') {
    // 2026-05-14: 궁합 결과 페이지에서 결제로 진입한 경우 결과로 돌아가서 깊은 풀이를
    // 보여준다. 그 외엔 기존대로 입력 화면으로. ManualCompatibilityResultClient 가
    // sessionStorage 의 payload (selfName/partnerName/birthInput 등) 를 그대로
    // 다시 읽으므로 입력을 다시 받지 않아도 결과가 복원된다.
    if (entrySource?.startsWith('compatibility-result')) {
      return '/compatibility/result?source=manual&paid=love-question';
    }
    return '/compatibility/input?relationship=lover&paid=love-question';
  }
  if (slug && product === 'monthly-calendar') {
    return `/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&product=${product}#fortune-calendar`;
  }
  if (slug && product === 'year-core') {
    return `/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&product=${product}#yearly-report`;
  }
  // 오늘 풀세트(묶음) — 점수 풀이 5항목은 사주 결과 화면에서 직접 열리고 오늘 자세히도
  // 여기서 이어진다. 구성품을 모두 볼 수 있는 허브(사주 결과)로 보낸다.
  if (slug && product === 'bundle_today_set') {
    return `/saju/${encodeURIComponent(slug)}?payment=confirmed&product=${product}`;
  }
  return null;
}

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
        <span className="text-[48px] font-extrabold leading-none" style={{ color: iconText }}>
          {iconChar}
        </span>
      </div>
      <div>
        <h1 className="text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
          {title}
        </h1>
        <p className="mt-2 px-4 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
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
      description={`결제 승인과 이용권 반영을 확인하고 있어요.\n잠시만 기다려 주세요.`}
    >
      {/* 2026-05-15 handoff 51 m-loading — Phase 3 결제 spinner motion 교체. */}
      <div className="mx-auto flex w-full max-w-md justify-center pt-2">
        <MotionSajuLoading
          active
          labels={['결제 승인', '이용권 반영', '확인 완료']}
          moonGlyph="可"
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
      description="결제는 진행되었지만 이용권 연결을 확인하지 못했습니다. 잠시 후 다시 시도하거나 결제 상태에서 확인해 주세요."
    >
      <article
        className="mx-auto max-w-md rounded-[14px] border bg-white p-4 text-left"
        style={{ borderColor: 'var(--app-coral)' }}
      >
        <div
          className="text-[11.5px] font-extrabold uppercase tracking-[0.04em]"
          style={{ color: 'var(--app-coral)' }}
        >
          오류 안내
        </div>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--app-copy-muted)]">
          {errorMessage}
        </p>
      </article>

      <div className="mx-auto grid w-full max-w-md gap-2 px-4 pt-2">
        <Link
          href="/membership"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
        >
          멤버십으로 돌아가기
        </Link>
        <Link
          href="/my/billing"
          className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[13px] font-bold text-[var(--app-copy-muted)]"
        >
          결제 상태 확인
        </Link>
      </div>
    </CenteredCard>
  );
}

function SuccessState({
  completeHref,
  confirmedPlan,
  resolvedSlug,
}: {
  completeHref: string;
  confirmedPlan: string;
  resolvedSlug: string | null;
}) {
  const isPremiumResult = Boolean(buildPremiumResultHref(confirmedPlan, resolvedSlug));

  return (
    <CenteredCard
      iconBg="linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))"
      iconText="#fff"
      iconChar="✓"
      title="결제가 완료됐어요"
      description={
        isPremiumResult
          ? '깊은 풀이가 준비됐어요. 지금 바로 확인해보세요.'
          : '이용권이 반영됐어요. 다음 흐름을 골라 이어가세요.'
      }
    >
      {/* 2026-05-15 handoff 54 m-coin — 결제 성공 직후 입자 + ✓ 카드. */}
      <div className="mx-auto flex w-full max-w-md justify-center pb-1">
        <MotionCoinSuccess
          active
          title="결제 완료"
          sub={isPremiumResult ? '깊은 풀이 열림' : `${confirmedPlan} 이용권 시작`}
        />
      </div>

      <div className="mx-auto grid w-full max-w-md gap-2 px-4 pt-2">
        <Link
          href={completeHref}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
        >
          다음으로 이동 →
        </Link>
        <Link
          href="/membership"
          className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[13px] font-bold text-[var(--app-copy-muted)]"
        >
          멤버십 보기
        </Link>
      </div>
    </CenteredCard>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const didConfirm = useRef(false);
  const [status, setStatus] = useState<ConfirmStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedPlan, setConfirmedPlan] = useState(searchParams.get('plan') ?? 'premium');
  const querySlug = searchParams.get('slug');
  const [resolvedSlug, setResolvedSlug] = useState(querySlug);

  const completeHref = buildCompleteHref(confirmedPlan, resolvedSlug);

  useEffect(() => {
    if (didConfirm.current) return;
    didConfirm.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    const packageId = searchParams.get('packageId');
    const plan = searchParams.get('plan') ?? 'premium';
    const product = searchParams.get('product');
    const scope = searchParams.get('scope');
    const entrySource = searchParams.get('from') ?? 'membership';
    const storedLifetimeSlug =
      packageId === 'lifetime_report' ? readPendingLifetimeReportSlug() : null;
    const slug = (querySlug ?? storedLifetimeSlug)?.trim() || null;

    setResolvedSlug(slug);

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
        amount: Number(amount),
        packageId,
        slug,
        scope,
      }),
    })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok || !data.success) {
          setStatus('error');
          setErrorMessage(data.error ?? '결제 승인 중 문제가 생겼습니다.');
          return;
        }

        const nextPlan = data.plan ?? plan;
        const nextProduct = data.product ?? product;
        const productHref = buildTasteProductHref(nextProduct, slug, scope, entrySource);
        const premiumResultHref = buildPremiumResultHref(nextPlan, slug);

        if (typeof data.totalCredits === 'number') {
          window.dispatchEvent(
            new CustomEvent('moonlight:credits-updated', {
              detail: { credits: data.totalCredits },
            })
          );
        }
        setConfirmedPlan(nextPlan);
        trackMoonlightEvent('payment_completed', {
          from: entrySource,
          packageId,
          product: nextProduct,
          amount: Number(amount),
          plan: nextPlan,
        });

        if (productHref) {
          location.replace(productHref);
          return;
        }

        if (premiumResultHref) {
          if (packageId === 'lifetime_report') {
            clearPendingLifetimeReportSlug();
          }
          location.replace(premiumResultHref);
          return;
        }

        if (packageId === 'lifetime_report') {
          clearPendingLifetimeReportSlug();
        }
        setStatus('success');
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('서버와 통신하는 중 문제가 생겼습니다.');
      });
  }, [searchParams, querySlug]);

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState errorMessage={errorMessage} />;
  return (
    <SuccessState
      completeHref={completeHref}
      confirmedPlan={confirmedPlan}
      resolvedSlug={resolvedSlug}
    />
  );
}

export default function MembershipSuccessPage() {
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
