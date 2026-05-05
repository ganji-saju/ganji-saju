'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  clearPendingLifetimeReportSlug,
  readPendingLifetimeReportSlug,
} from '@/lib/payments/lifetime-report';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

type ConfirmStatus = 'loading' | 'success' | 'error';

const SUCCESS_FLOW_POINTS = [
  'Toss 승인 뒤 서버에서 이용권을 다시 확인하고, 바로 열 수 있는 화면으로 연결합니다.',
  '보관형 리포트 상품이면 연결된 결과 화면으로, 멤버십이면 완료 안내 화면으로 부드럽게 이어집니다.',
  '결제 확인이 오래 걸리지 않도록 이 단계는 짧고 분명하게 유지합니다.',
] as const;

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

function buildTasteProductHref(product: string | null, slug: string | null, scope: string | null) {
  if (product === 'today-detail') {
    const params = new URLSearchParams({ paid: product, concern: scope || 'general' });
    if (slug) params.set('sourceSessionId', slug);
    return `/today-fortune?${params.toString()}`;
  }

  if (product === 'love-question') {
    return '/compatibility/input?relationship=lover&paid=love-question';
  }

  if (slug && product === 'monthly-calendar') {
    return `/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&product=${product}#fortune-calendar`;
  }

  if (slug && product === 'year-core') {
    return `/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&product=${product}#yearly-report`;
  }

  return null;
}

function LoadingState() {
  return (
    <>
      <PageHero
        badges={[
          <Badge
            key="loading"
            className="border-[var(--app-pink)]/25 bg-[var(--app-pink)]/10 text-[var(--app-pink-strong)]"
          >
            결제 확인 중
          </Badge>,
        ]}
        title="결제와 이용권 반영을 확인하고 있습니다"
        description="결제 승인과 이용권 연결을 함께 처리하는 단계입니다. 잠시만 기다려 주세요."
      />
      <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="지금 진행 중인 일"
            title="결제 확인은 짧고 분명하게 진행합니다"
            titleClassName="text-3xl"
            description="결제창이 닫힌 뒤, 이 화면에서는 승인 결과와 이용권 반영만 확인하고 다음 화면으로 바로 이어집니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />
          <FeatureCard
            className="mt-6"
            surface="soft"
            eyebrow="현재 상태"
            description="Toss 결제를 확인하고 있습니다. 잠시 뒤 자동으로 다음 단계로 이어집니다."
          />
        </SectionSurface>
        <SupportRail
          surface="panel"
          eyebrow="진행 방식"
          title="이 단계가 하는 일"
          description="확인 화면에서 오래 머무르지 않도록, 필요한 검증만 하고 바로 이어지게 설계했습니다."
        >
          <BulletList items={SUCCESS_FLOW_POINTS} />
        </SupportRail>
      </section>
    </>
  );
}

function ErrorState({ errorMessage }: { errorMessage: string }) {
  return (
    <>
      <PageHero
        badges={[
          <Badge
            key="error"
            className="border-rose-400/25 bg-rose-400/10 text-rose-100"
          >
            결제 확인 실패
          </Badge>,
        ]}
        title="이용권 반영을 끝내지 못했습니다"
        description="결제는 진행되었지만, 이용권 연결 확인에서 문제가 생겼습니다. 다시 확인할 수 있는 경로를 남겨두었습니다."
      />
      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="다시 확인"
          title="지금 바로 확인해 보실 수 있는 것"
          titleClassName="text-3xl"
          description={errorMessage}
          descriptionClassName="max-w-3xl text-rose-100"
          actions={
            <ActionCluster>
              <Link href="/membership">
                <Button>
                  멤버십으로 돌아가기
                </Button>
              </Link>
              <Link href="/my/billing">
                <Button variant="outline">
                  결제 상태 확인
                </Button>
              </Link>
            </ActionCluster>
          }
        />
      </SectionSurface>
    </>
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
    <>
      <PageHero
        badges={[
          <Badge
            key="success"
            className="border-[var(--app-pink)]/25 bg-[var(--app-pink)]/10 text-[var(--app-pink-strong)]"
          >
            결제 완료
          </Badge>,
        ]}
        title={isPremiumResult ? '결과 화면으로 이어질 준비를 마쳤습니다' : '이용권이 반영되었습니다'}
        description={
          isPremiumResult
            ? '결제 확인이 끝났습니다. 연결된 결과 화면으로 바로 이동하거나, 완료 안내에서 다음 흐름을 이어가실 수 있습니다.'
            : '결제 확인이 끝났습니다. 다음 화면에서 바로 열어보실 항목을 선택하실 수 있습니다.'
        }
      />

      <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="반영 완료"
            title="결제 뒤 흐름을 바로 이어갑니다"
            titleClassName="text-3xl text-[var(--app-pink-strong)]"
            description="확인 단계가 끝났으니, 이제 같은 흐름 위에서 리포트나 멤버십 화면으로 자연스럽게 이어집니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />
          <FeatureCard
            className="mt-6"
            surface="soft"
            eyebrow="지금 상태"
            description={
              isPremiumResult
                ? '연결된 결과 화면으로 바로 이동할 수 있습니다. 리포트와 대화, 보관함 흐름도 같은 화면에서 이어집니다.'
                : '완료 안내 화면에서 오늘 바로 열어보실 항목을 고르실 수 있습니다.'
            }
          />
        </SectionSurface>

        <SupportRail
          surface="panel"
          eyebrow="다음 단계"
          title="버튼은 두 가지만 남겨 두었습니다"
          description="이 화면은 짧게 끝나는 단계라, 주 행동과 보조 행동만 남겨 다시 선택지가 과밀해지지 않게 했습니다."
        >
          <ActionCluster>
            <Link href={completeHref}>
              <Button size="lg">
                다음으로 이동
              </Button>
            </Link>
            <Link href="/membership">
              <Button variant="outline" size="lg">
                멤버십 보기
              </Button>
            </Link>
          </ActionCluster>
        </SupportRail>
      </section>
    </>
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
        const productHref = buildTasteProductHref(nextProduct, slug, scope);
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

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState errorMessage={errorMessage} />;
  }

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
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <Suspense
          fallback={
            <SectionSurface surface="panel" size="lg" className="text-center text-[var(--app-copy)]">
              결제 확인 중...
            </SectionSurface>
          }
        >
          <SuccessContent />
        </Suspense>
      </AppPage>
    </AppShell>
  );
}
