'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { createClient, getCurrentBrowserUser } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  getTossPaymentMethodOption,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import TossPaymentMethodPicker from '@/components/payments/toss-payment-method-picker';
import SiteHeader from '@/features/shared-navigation/site-header';
import LegalLinks from '@/components/legal-links';
import { trackMoonlightEvent } from '@/lib/analytics';
import { PAYMENT_PACKAGES, type PaymentPackage } from '@/lib/payments/catalog';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

const hasSupabaseBrowserEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CREDIT_PACKAGE_DESCRIPTIONS: Record<string, { desc: string; badge: string; highlight?: boolean }> = {
  credit_1: {
    badge: '코인 패키지',
    desc: '궁금한 주제 하나를 가볍게 열어보기 좋은 입문 패키지',
  },
  credit_3: {
    badge: '첫 결제 추천',
    desc: '연애·재물·일 흐름을 작게 이어보기 좋은 첫 결제 구간',
    highlight: true,
  },
  credit_7: {
    badge: '코인 패키지',
    desc: '주제 여러 개를 이어서 보는 사용자에게 가장 안정적인 묶음',
  },
  subscription_30: {
    badge: '보너스 코인팩',
    desc: '스타터 10회보다 6코인이 더 붙는 36코인 보너스 묶음입니다. 멤버십 플랜과는 따로 관리됩니다.',
  },
};

const PACKAGES = PAYMENT_PACKAGES.filter((pkg) =>
  ['credit_1', 'credit_3', 'credit_7', 'subscription_30'].includes(pkg.id)
);

const CREDIT_FLOW_POINTS = [
  '코인은 필요한 소액 풀이를 그때그때 여는 용도로 두고, 멤버십과 역할을 분리합니다.',
  '무엇이 열리는지, 어떤 결과가 저장되는지, 멤버십과 어떻게 다른지 결제 전에 먼저 보여드립니다.',
  '결제 뒤에는 MY와 코인 센터에서 상태와 이용 흐름을 다시 확인하실 수 있습니다.',
] as const;

const UNLOCK_EXAMPLES = [
  '1코인 · 분야별 깊이보기 한 번 열기',
  '3코인 · 연애·재물·직장 세 주제를 이어서 보기',
  '7코인 · 월간 테마나 선택 심화를 넓게 펼쳐보기',
  '36코인 · 자주 여는 분을 위한 보너스 코인팩',
] as const;

function CreditsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TossPaymentMethodCode>(DEFAULT_TOSS_PAYMENT_METHOD);
  const entrySource = searchParams.get('from') ?? 'credits';
  const hasPaymentError = searchParams.get('error') === 'fail';

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      setIsLoggedIn(false);
      return;
    }
    const supabase = createClient();
    void getCurrentBrowserUser(supabase).then((user) => setIsLoggedIn(Boolean(user)));
  }, []);

  async function handlePurchase(pkg: PaymentPackage) {
    if (!isLoggedIn) {
      location.href = `/login?next=${encodeURIComponent(`/credits?from=${entrySource}`)}`;
      return;
    }

    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
      setErrorMessage('Toss 결제 키가 아직 설정되지 않았습니다. 운영 설정을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    setLoading(pkg.id);
    setErrorMessage('');
    try {
      const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: ANONYMOUS });
      const orderId = `order_${pkg.id}_${paymentMethod.toLowerCase()}_${Date.now()}`;
      const successParams = new URLSearchParams({
        packageId: pkg.id,
        from: entrySource,
      });
      trackMoonlightEvent('payment_started', {
        from: entrySource,
        packageId: pkg.id,
        paymentMethod,
        amount: pkg.price,
      });
      const paymentRequest = {
        amount: { currency: 'KRW', value: pkg.price },
        orderId,
        orderName: `${pkg.name} ${pkg.credits}코인`,
        successUrl: `${location.origin}/credits/success?${successParams.toString()}`,
        failUrl: `${location.origin}/credits?error=fail`,
      } as const;

      if (paymentMethod === 'CARD') {
        await payment.requestPayment({
          ...paymentRequest,
          method: 'CARD',
          card: { flowMode: 'DEFAULT' },
        });
        return;
      }

      await payment.requestPayment({
        ...paymentRequest,
        method: 'TRANSFER',
        transfer: {
          cashReceipt: { type: '소득공제' },
          useEscrow: false,
        },
      });
    } catch (error) {
      console.error(error);
      setErrorMessage('결제창을 여는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setLoading(null);
    }
  }

  const selectedMethod = getTossPaymentMethodOption(paymentMethod);
  const highlightedPackage = useMemo(
    () => PACKAGES.find((item) => CREDIT_PACKAGE_DESCRIPTIONS[item.id]?.highlight) ?? PACKAGES[0],
    []
  );

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <PageHero
          badges={[
            <Badge
              key="credits"
              className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
            >
              코인 센터
            </Badge>,
            <Badge
              key="usage"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              원하실 때만 조용히 여는 소액 풀이
            </Badge>,
          ]}
          title="필요한 만큼만 열고, 자주 보시면 넉넉하게 이어갑니다"
          description="코인은 필요하실 때만 소액 풀이를 여는 작은 열쇠입니다. 자주 찾는 주제는 가볍게 충전해서 쓰시고, 반복해서 읽는 분은 보너스 코인팩으로 더 넉넉하게 이어가실 수 있게 준비했습니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionSurface surface="panel" size="lg">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="코인 쓰는 방식"
              title="무료 탐색 뒤에 필요한 소액 풀이만 조용히 엽니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="코인은 멤버십과 달리, 필요하신 순간에만 결과 안쪽의 소액 풀이를 여는 방식입니다. 과하게 밀지 않고, 필요한 장면에만 쓰이도록 역할을 분리했습니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <ProductGrid columns={3} className="mt-6">
              <FeatureCard
                surface="soft"
                eyebrow="먼저 가볍게"
                description="요약 카드와 기본 해석으로 오늘의 결을 먼저 살펴봅니다."
              />
              <FeatureCard
                surface="soft"
                eyebrow="마음 가는 만큼"
                description="연애·재물·직장처럼 더 궁금한 주제만 결과 안에서 바로 엽니다."
              />
              <FeatureCard
                surface="soft"
                eyebrow="자주 찾으신다면"
                description="반복해서 읽게 되는 분은 보너스 코인팩으로 더 넉넉하게 이어가실 수 있습니다."
              />
            </ProductGrid>

            <FeatureCard
              className="mt-6"
              surface="soft"
              eyebrow="추천 시작점"
              title={`${highlightedPackage.name} · ${highlightedPackage.credits}코인`}
              description={CREDIT_PACKAGE_DESCRIPTIONS[highlightedPackage.id]?.desc}
            />
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="결제 전 기준"
            title="무엇이 열리는지 먼저 확인하고 고르시면 됩니다"
            description="무엇이 열리는지, 어떤 결과가 저장되는지, 멤버십과 어떻게 다른지는 결제 전에 먼저 보이도록 정리했습니다."
          >
            <BulletList items={CREDIT_FLOW_POINTS} />

            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="지원 결제"
              description={
                <>
                  토스페이먼츠 카드 결제 · 계좌이체
                  <br />
                  진행 시 <LegalLinks className="text-[var(--app-copy-soft)]" />에 동의한 것으로 봅니다.
                </>
              }
            />
          </SupportRail>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="코인 패키지"
              title="첫 결제부터 보너스 코인팩까지"
              titleClassName="text-3xl"
              description="패키지는 가격보다 쓰임새가 먼저 보이도록 정리했습니다. 결제 수단을 고른 뒤, 각 카드에서 바로 구매하실 수 있습니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <div className="mt-6">
              <TossPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
            </div>

            {hasPaymentError ? (
              <FeatureCard
                className="mt-5 border-rose-400/25 bg-rose-400/10"
                surface="soft"
                eyebrow="다시 확인"
                description="결제가 완료되지 않았습니다. 결제창을 닫으셨거나 승인에 실패했을 수 있습니다."
              />
            ) : null}

            {errorMessage ? (
              <FeatureCard
                className="mt-5 border-rose-300/55 bg-rose-50"
                surface="soft"
                eyebrow="결제 설정 확인"
                description={errorMessage}
              />
            ) : null}

            <ProductGrid columns={2} className="mt-6">
              {PACKAGES.map((pkg) => (
                <FeatureCard
                  key={pkg.id}
                  surface="soft"
                  eyebrow={CREDIT_PACKAGE_DESCRIPTIONS[pkg.id]?.badge ?? '코인 패키지'}
                  title={`${pkg.name} · ${pkg.credits}코인`}
                  description={
                    <>
                      <span className="block">{CREDIT_PACKAGE_DESCRIPTIONS[pkg.id]?.desc}</span>
                      <span className="mt-2 block text-[var(--app-gold-text)]">
                        {pkg.price.toLocaleString()}원
                      </span>
                    </>
                  }
                  footer={
                    <button
                      onClick={() => handlePurchase(pkg)}
                      disabled={loading === pkg.id}
                      className="gangi-primary-button moon-action-compact min-w-[112px]"
                    >
                      {loading === pkg.id ? '처리중...' : `${selectedMethod.shortLabel} 구매`}
                    </button>
                  }
                />
              ))}
            </ProductGrid>
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="이런 것이 열립니다"
            title="코인은 어디에서 쓰이는지부터 분명히 보여드립니다"
            description="코인 센터는 단순 결제창이 아니라, 어떤 해석을 여는 열쇠인지 먼저 이해시키는 역할을 합니다."
          >
            <ProductGrid columns={3} className="mt-0">
              {UNLOCK_EXAMPLES.map((item, index) => (
                <FeatureCard
                  key={item}
                  surface="soft"
                  eyebrow={String(index + 1).padStart(2, '0')}
                  description={item}
                />
              ))}
            </ProductGrid>

            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="멤버십 안내"
              description="멤버십은 결과 보관과 반복 열람 가치에 초점을 두고, 보너스 코인팩은 심화풀이를 자주 여는 분을 위한 코인 전용 흐름으로 나누어두었습니다."
            />

            <ActionCluster className="mt-5">
              <Link href="/membership" className="gangi-secondary-button">
                멤버십 자세히 보기
              </Link>
              <Link href="/my/billing" className="gangi-secondary-button">
                결제/구독 관리 열기
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>
      </AppPage>
    </AppShell>
  );
}

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
          <AppPage className="gangi-subpage space-y-6">
            <SectionSurface surface="panel" size="lg" className="text-center text-[var(--app-copy)]">
              코인 센터를 불러오는 중입니다.
            </SectionSurface>
          </AppPage>
        </AppShell>
      }
    >
      <CreditsPageContent />
    </Suspense>
  );
}
