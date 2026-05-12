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
import { PAYMENT_PACKAGES, formatWon, type PaymentPackage } from '@/lib/payments/catalog';
import { buildTossOrderId } from '@/lib/payments/order-id';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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

function CreditNotice({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title?: string;
  description: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-3 text-sm leading-6 text-[var(--gyeol-muted)]">
      <p className="text-xs font-bold text-[var(--gyeol-moon)]">{eyebrow}</p>
      {title ? <strong className="mt-1 block text-[var(--gyeol-text)]">{title}</strong> : null}
      <p className="mt-1">{description}</p>
    </div>
  );
}

function CreditPurchaseRow({
  pkg,
  selectedMethodLabel,
  isLoading,
  onPurchase,
}: {
  pkg: PaymentPackage;
  selectedMethodLabel: string;
  isLoading: boolean;
  onPurchase: (pkg: PaymentPackage) => void;
}) {
  const packageInfo = CREDIT_PACKAGE_DESCRIPTIONS[pkg.id];

  return (
    <div
      data-emphasis={packageInfo?.highlight ? 'true' : undefined}
      className="flex min-h-20 flex-col gap-3 rounded-[1.15rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] px-4 py-4 data-[emphasis=true]:border-[var(--gyeol-moon)]/35 data-[emphasis=true]:bg-[var(--gyeol-moon)]/8 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gyeol-muted)]">
            {packageInfo?.badge ?? '코인 패키지'}
          </span>
          {packageInfo?.highlight ? (
            <span className="rounded-full bg-[var(--gyeol-moon)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--gyeol-moon)]">
              추천
            </span>
          ) : null}
        </div>
        <strong className="mt-1 block text-base font-bold text-[var(--gyeol-text)]">
          {pkg.name} · {pkg.credits}코인
        </strong>
        <span className="mt-1 block text-sm leading-6 text-[var(--gyeol-muted)]">
          {packageInfo?.desc ?? '필요한 풀이를 이어 열 수 있는 코인 충전권입니다.'}
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <strong className="text-base font-bold text-[var(--gyeol-moon)]">{formatWon(pkg.price)}</strong>
        <button
          type="button"
          onClick={() => onPurchase(pkg)}
          disabled={isLoading}
          className="min-h-11 rounded-full border border-[var(--gyeol-line)] bg-[var(--gyeol-text)] px-4 text-sm font-bold text-[var(--gyeol-paper)] transition-colors hover:bg-[var(--gyeol-moon)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isLoading ? '처리중...' : `${selectedMethodLabel} 구매`}
        </button>
      </div>
    </div>
  );
}

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
      const orderId = buildTossOrderId({
        prefix: 'credits',
        packageId: pkg.id,
        paymentMethod,
      });
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
      <AppPage className="gangi-subpage space-y-5">
        <PageIntro
          eyebrow="코인 센터"
          title="필요한 풀이만 코인으로 열어요"
          description="무료로 먼저 보고, 더 궁금한 흐름만 코인으로 이어 엽니다. 결제 방식과 상품 가격은 기존 정책을 그대로 사용합니다."
          actions={
            <>
              <Link href="/pricing" className="gangi-secondary-button">
                가격 한눈보기
              </Link>
              <Link href="/membership" className="gangi-secondary-button">
                멤버십 비교
              </Link>
            </>
          }
        />

        <LightSection
          eyebrow="결제 방식"
          title="카드 또는 계좌이체로 충전"
          description="결제 수단만 고른 뒤 필요한 코인팩을 선택하세요."
          surface="soft"
        >
          <TossPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />

          <div className="mt-4 grid gap-2">
            {hasPaymentError ? (
              <CreditNotice
                eyebrow="다시 확인"
                title="결제가 완료되지 않았습니다"
                description="결제창을 닫으셨거나 승인에 실패했을 수 있습니다."
              />
            ) : null}

            {errorMessage ? (
              <CreditNotice
                eyebrow="결제 설정 확인"
                title="결제창을 열지 못했습니다"
                description={errorMessage}
              />
            ) : null}
          </div>
        </LightSection>

        <LightSection
          eyebrow="코인팩"
          title="필요한 만큼만 충전"
          description="카드형 가격표 대신 한 줄씩 비교할 수 있게 정리했습니다."
        >
          <div className="grid gap-3">
            {PACKAGES.map((pkg) => (
              <CreditPurchaseRow
                key={pkg.id}
                pkg={pkg}
                selectedMethodLabel={selectedMethod.shortLabel}
                isLoading={loading === pkg.id}
                onPurchase={handlePurchase}
              />
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-[var(--gyeol-muted)]">
            토스페이먼츠 카드 결제 · 계좌이체 · 진행 시{' '}
            <LegalLinks className="text-[var(--gyeol-muted)]" /> 동의
          </p>
        </LightSection>

        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
          <AppPage className="gangi-subpage space-y-5">
            <LightSection surface="soft" className="text-center text-[var(--gyeol-muted)]">
              코인 센터를 불러오는 중입니다.
            </LightSection>
          </AppPage>
        </AppShell>
      }
    >
      <CreditsPageContent />
    </Suspense>
  );
}
