'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

type ConfirmStatus = 'loading' | 'success' | 'error';

const CREDIT_USE_CASES = [
  '오늘 더 깊게 보고 싶은 한 주제를 바로 열 수 있습니다.',
  '연애·재물·직장처럼 관심 있는 장면만 선택해서 이어볼 수 있습니다.',
  '코인 상태는 MY와 결제 관리 화면에서 다시 확인하실 수 있습니다.',
] as const;

const CONFIRMATION_FLOW = [
  'Toss 결제를 확인한 뒤 서버에서 충전 코인을 반영합니다.',
  '확인이 끝나면 다시 충전하거나, 열린 해석 흐름으로 조용히 돌아가실 수 있습니다.',
  '확인 단계는 길지 않게 유지하고, 필요한 다음 행동만 남겨 둡니다.',
] as const;

function LoadingState() {
  return (
    <>
      <PageHero
        badges={[
          <Badge
            key="loading"
            className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
          >
            결제 확인 중
          </Badge>,
        ]}
        title="코인 충전과 반영 상태를 확인하고 있습니다"
        description="결제 승인과 코인 반영을 함께 처리하는 단계입니다. 잠시만 기다려 주세요."
      />

      <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <SectionSurface surface="panel" size="lg">
          <div className="app-starfield" />
          <SectionHeader
            eyebrow="확인 중"
            title="승인과 충전 반영을 짧게 확인합니다"
            titleClassName="text-3xl text-[var(--app-gold-text)]"
            description="이 단계는 오래 머무는 화면이 아니라, 결제와 코인 상태를 확인한 뒤 다음 흐름으로 자연스럽게 넘겨드리는 짧은 관문입니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />
          <FeatureCard
            className="mt-6"
            surface="soft"
            eyebrow="현재 상태"
            description="결제 정보와 코인 반영을 확인하고 있습니다. 잠시 뒤 자동으로 다음 상태가 열립니다."
          />
        </SectionSurface>

        <SupportRail
          surface="panel"
          eyebrow="진행 방식"
          title="무엇을 확인하는 단계인가요?"
          description="결제 승인과 코인 반영만 확인하고, 나머지 선택은 완료 후 화면에서 차분하게 이어지도록 구성했습니다."
        >
          <BulletList items={CONFIRMATION_FLOW} />
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
        title="코인 반영을 끝내지 못했습니다"
        description="결제는 진행되었지만, 충전 확인 과정에서 문제가 생겼습니다. 다시 확인할 수 있는 경로를 남겨 두었습니다."
      />

      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="다시 확인"
          title="지금 바로 이어가실 수 있는 두 가지"
          titleClassName="text-3xl"
          description={errorMessage}
          descriptionClassName="max-w-3xl text-rose-100"
          actions={
            <ActionCluster>
              <Link href="/credits">
                <Button>
                  코인 센터로 돌아가기
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

function SuccessState({ coins }: { coins: number }) {
  return (
    <>
      <PageHero
        badges={[
          <Badge
            key="success"
            className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
          >
            충전 완료
          </Badge>,
        ]}
        title="필요할 때 여는 해석을 위한 코인이 준비되었습니다"
        description="코인 충전이 끝났습니다. 지금 바로 다시 열어보실 흐름과, 자주 쓰실 때의 다음 선택지를 함께 정리해 두었습니다."
      />

      <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <SectionSurface surface="panel" size="lg">
          <div className="app-starfield" />
          <SectionHeader
            eyebrow="충전 결과"
            title={`${coins}코인이 반영되었습니다`}
            titleClassName="text-3xl text-[var(--app-gold-text)]"
            description="이제 무료 탐색 뒤 더 보고 싶은 주제를 조용히 열거나, MY와 결제 관리 화면에서 상태를 다시 확인하실 수 있습니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
            {CREDIT_USE_CASES.map((item, index) => (
              <FeatureCard
                key={item}
                surface="soft"
                eyebrow={String(index + 1).padStart(2, '0')}
                description={item}
              />
            ))}
          </ProductGrid>
        </SectionSurface>

        <SupportRail
          surface="panel"
          eyebrow="다음으로 이동"
          title="버튼은 두 가지만 남겨 두었습니다"
          description="코인 충전 완료 화면에서는 다시 충전하거나, 결제 상태와 보관 흐름을 확인하는 두 방향만 남겨 과밀해지지 않도록 했습니다."
        >
          <ActionCluster>
            <Link href="/credits">
              <Button size="lg">
                코인 더 살펴보기
              </Button>
            </Link>
            <Link href="/my/billing">
              <Button variant="outline" size="lg">
                결제와 보관 상태 보기
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

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState errorMessage={errorMessage} />;
  }

  return <SuccessState coins={coins} />;
}

export default function CreditsSuccessPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <Suspense
          fallback={
            <SectionSurface surface="panel" size="lg" className="text-center text-[var(--app-copy)]">
              결제 확인 화면을 불러오는 중입니다.
            </SectionSurface>
          }
        >
          <SuccessContent />
        </Suspense>
      </AppPage>
    </AppShell>
  );
}
