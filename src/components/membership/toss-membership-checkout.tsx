'use client';

import { useEffect, useMemo, useState } from 'react';
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { Button } from '@/components/ui/button';
import TossPaymentMethodPicker from '@/components/payments/toss-payment-method-picker';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  getTossPaymentMethodOption,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import { trackMoonlightEvent } from '@/lib/analytics';
import { savePendingLifetimeReportSlug } from '@/lib/payments/lifetime-report';
import { createClient, getCurrentBrowserUser } from '@/lib/supabase/client';

const hasSupabaseBrowserEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface Props {
  packageId: string;
  plan: string;
  product?: string;
  amount: number;
  orderName: string;
  slug?: string;
  scope?: string;
  entrySource?: string;
}

export default function TossMembershipCheckout({
  packageId,
  plan,
  product,
  amount,
  orderName,
  slug,
  scope,
  entrySource = 'membership',
}: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TossPaymentMethodCode>(
    DEFAULT_TOSS_PAYMENT_METHOD
  );

  const checkoutPath = useMemo(() => {
    const params = new URLSearchParams(product ? { product } : { plan });
    if (slug) params.set('slug', slug);
    if (scope) params.set('scope', scope);
    if (entrySource) params.set('from', entrySource);
    return `/membership/checkout?${params.toString()}`;
  }, [entrySource, plan, product, scope, slug]);

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      setIsLoggedIn(false);
      return;
    }

    const supabase = createClient();
    void getCurrentBrowserUser(supabase).then((user) => {
      setIsLoggedIn(Boolean(user));
    });
  }, []);

  async function handlePayment() {
    if (
      (packageId === 'lifetime_report' ||
        packageId === 'taste_today_detail' ||
        packageId === 'taste_monthly_calendar' ||
        packageId === 'taste_year_core') &&
      !slug
    ) {
      setErrorMessage('이 상품은 먼저 결과를 만든 뒤 해당 화면에서 결제할 수 있습니다.');
      return;
    }

    if (!isLoggedIn) {
      location.href = `/login?next=${encodeURIComponent(checkoutPath)}`;
      return;
    }

    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
      setErrorMessage('Toss 클라이언트 키가 설정되어 있지 않습니다.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: ANONYMOUS });
      const orderId = `membership_${packageId}_${paymentMethod.toLowerCase()}_${Date.now()}`;
      const successParams = new URLSearchParams({
        packageId,
        plan,
        from: entrySource,
      });
      const failParams = new URLSearchParams({
        plan,
        error: 'payment',
        from: entrySource,
      });

      if (product) {
        successParams.set('product', product);
        failParams.set('product', product);
      }

      if (slug) {
        successParams.set('slug', slug);
        failParams.set('slug', slug);
      }

      if (scope) {
        successParams.set('scope', scope);
        failParams.set('scope', scope);
      }

      if (packageId === 'lifetime_report' && slug) {
        savePendingLifetimeReportSlug(slug);
      }

      trackMoonlightEvent('payment_started', {
        from: entrySource,
        packageId,
        product,
        paymentMethod,
        amount,
        plan,
      });

      const paymentRequest = {
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: `${location.origin}/membership/success?${successParams.toString()}`,
        failUrl: `${location.origin}/membership/checkout?${failParams.toString()}`,
      } as const;

      if (paymentMethod === 'CARD') {
        await payment.requestPayment({
          ...paymentRequest,
          method: 'CARD',
          card: {
            flowMode: 'DEFAULT',
          },
        });
        return;
      }

      await payment.requestPayment({
        ...paymentRequest,
        method: 'TRANSFER',
        transfer: {
          cashReceipt: {
            type: '소득공제',
          },
          useEscrow: false,
        },
      });
    } catch (error) {
      console.error(error);
      setErrorMessage('결제창을 여는 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }

  const selectedMethod = getTossPaymentMethodOption(paymentMethod);

  return (
    <div className="space-y-3">
      <TossPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
      <Button
        type="button"
        onClick={handlePayment}
        disabled={isLoading || isLoggedIn === null}
        className="w-full"
      >
        {isLoading
          ? '결제창 여는 중...'
          : `${amount.toLocaleString()}원 ${selectedMethod.shortLabel}로 결제하기`}
      </Button>
      {errorMessage ? (
        <p className="text-center text-xs leading-6 text-rose-600">{errorMessage}</p>
      ) : (
        <p className="text-center text-xs leading-6 text-[var(--app-copy-soft)]">
          Toss 결제 완료 후 서버에서 이용권을 확인하고 바로 반영합니다. 카드와 계좌이체를 모두 지원합니다.
        </p>
      )}
    </div>
  );
}
