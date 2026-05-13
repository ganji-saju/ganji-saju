'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
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
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

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
          title="코인 충전"
        />

        <section className="grid gap-6">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="코인 패키지"
              title="원하는 만큼 고르세요"
              titleClassName="text-3xl"
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
                      className="gangi-primary-button min-w-[112px]"
                    >
                      {loading === pkg.id ? '처리중...' : `${selectedMethod.shortLabel} 구매`}
                    </button>
                  }
                />
              ))}
            </ProductGrid>
            <p className="mt-5 text-xs leading-6 text-[var(--app-copy-soft)]">
              토스페이먼츠 카드 결제 · 계좌이체 · 진행 시 <LegalLinks className="text-[var(--app-copy-soft)]" /> 동의
            </p>
          </SectionSurface>
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
