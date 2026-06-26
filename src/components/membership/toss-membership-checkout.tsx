'use client';

import { useEffect, useMemo, useState } from 'react';
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import TossPaymentMethodPicker from '@/components/payments/toss-payment-method-picker';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  getTossPaymentMethodOption,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import { trackMoonlightEvent } from '@/lib/analytics';
import { savePendingLifetimeReportSlug } from '@/lib/payments/lifetime-report';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
// 2026-05-18 Phase 3-C-1: 결제 전 동의 체크박스 + prepare API 검증.
import { PaymentConsentCheckboxes } from '@/components/policies/payment-consent-checkboxes';
import { getPackage } from '@/lib/payments/catalog';
import { requestNicepayPayment, toNicepayMethod } from '@/lib/payments/nicepay-checkout';
import type { PolicyKind } from '@/shared/policies/types';

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

interface PaymentPrepareResponse {
  ok?: boolean;
  authenticated?: boolean;
  alreadyPurchased?: boolean;
  redirectHref?: string;
  loginHref?: string;
  error?: string;
  orderId?: string;
  provider?: 'toss' | 'nicepay';
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
  // Phase 3-C-1: 동의 체크 상태. valid 시만 결제 버튼 활성.
  const [consentValid, setConsentValid] = useState(false);
  const [acceptedKinds, setAcceptedKinds] = useState<PolicyKind[]>([]);

  const pkg = useMemo(() => getPackage(packageId), [packageId]);

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
      setErrorMessage('결제 클라이언트 키가 설정되어 있지 않습니다.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const prepareResponse = await fetch('/api/payments/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          product,
          plan,
          slug,
          scope,
          from: entrySource,
          paymentMethod,
          // Phase 3-C-1: 결제 전 동의 정책 종류. prepare API 가 활성 PolicyVersion 으로 변환 후 DB insert.
          acceptedKinds,
        }),
      });
      const prepare = (await prepareResponse
        .json()
        .catch(() => null)) as PaymentPrepareResponse | null;

      if (prepareResponse.status === 401 || prepare?.authenticated === false) {
        location.href = prepare?.loginHref ?? `/login?next=${encodeURIComponent(checkoutPath)}`;
        return;
      }

      if (!prepareResponse.ok || prepare?.error) {
        setErrorMessage(prepare?.error ?? '결제 사전 확인에 문제가 생겼습니다.');
        return;
      }

      if (prepare?.alreadyPurchased && prepare.redirectHref) {
        location.href = prepare.redirectHref;
        return;
      }

      if (!prepare?.orderId) {
        setErrorMessage('결제 주문번호를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
        return;
      }

      const orderId = prepare.orderId;

      // 2026-06-26 — 나이스페이 분기: 결제창 SDK·승인 방식이 달라(서버승인 returnUrl) 별도 흐름.
      //   토스(successUrl/failUrl 클라 redirect) ↔ 나이스페이(returnUrl 서버 승인) 차이.
      if (prepare.provider === 'nicepay') {
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
        await requestNicepayPayment({
          orderId,
          amount,
          goodsName: orderName,
          method: toNicepayMethod(paymentMethod),
          onError: (message) => setErrorMessage(message),
        });
        return;
      }

      const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: ANONYMOUS });
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
      // A8: 결제창 실패 사유 무관하게 가장 흔한 원인(이미 결제한 상품) 안내.
      // 메시지 초안: docs/payment-duplicate-block-verification.md §5
      toast.error('결제에 실패했습니다. 이미 결제하신 상품인지 확인해주세요.', {
        duration: 6000,
        action: {
          label: '내 결제 내역',
          onClick: () => {
            location.href = '/my/billing';
          },
        },
      });
    } finally {
      setIsLoading(false);
    }
  }

  const selectedMethod = getTossPaymentMethodOption(paymentMethod);
  const confirmationItems = useMemo(() => {
    if (!pkg) return [];

    const items = [
      `상품: ${orderName}`,
      `결제 금액: ${amount.toLocaleString('ko-KR')}원`,
      `결제 수단: ${selectedMethod.label}`,
    ];

    if (pkg.kind === 'subscription') {
      items.push(
        '다음 결제일: 결제 승인일로부터 30일 후',
        '해지 방법: MY > 결제 관리에서 해지',
        '무료체험 여부: 없음'
      );
    }

    return items;
  }, [amount, orderName, pkg, selectedMethod.label]);

  return (
    <div className="space-y-3">
      <TossPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
      {/* Phase 3-C-1: 결제 전 동의 — 필수 동의 모두 체크해야 결제 버튼 활성 */}
      {pkg && (
        <PaymentConsentCheckboxes
          pkg={pkg}
          confirmationItems={confirmationItems}
          onValidChange={(valid, kinds) => {
            setConsentValid(valid);
            setAcceptedKinds(kinds);
          }}
        />
      )}
      <Button
        type="button"
        onClick={handlePayment}
        disabled={isLoading || isLoggedIn === null || !consentValid}
        className="w-full"
      >
        {isLoading
          ? '결제창 여는 중...'
          : !consentValid
            ? '결제 전 동의가 필요합니다'
            : `${amount.toLocaleString()}원 ${selectedMethod.shortLabel}로 결제하기`}
      </Button>
      {errorMessage ? (
        <p className="text-center text-sm leading-6 text-rose-600">{errorMessage}</p>
      ) : (
        <p className="text-center text-sm leading-6 text-[var(--app-copy-soft)]">
          결제 완료 후 서버에서 이용권을 확인하고 바로 반영합니다. 카드와 계좌이체를 모두 지원합니다.
        </p>
      )}
    </div>
  );
}
