'use client';

import { useEffect, useMemo, useState } from 'react';
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { readConsent } from '@/components/analytics/analytics-consent';
import { gtmAddPaymentInfo, gtmBeginCheckout } from '@/lib/analytics/gtm';
import TossPaymentMethodPicker from '@/components/payments/toss-payment-method-picker';
import { StickyBottomBar } from '@/components/ui/sticky-bottom-bar';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  getTossPaymentMethodOption,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import { trackMoonlightEvent } from '@/lib/analytics';
import { savePendingLifetimeReportSlug } from '@/lib/payments/lifetime-report';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
// 2026-05-18 Phase 3-C-1: 결제 전 동의 체크박스 + prepare API 검증.
import {
  PaymentConsentDetails,
  PaymentConsentRow,
  usePaymentConsent,
} from '@/components/policies/payment-consent-checkboxes';
import { getPackage } from '@/lib/payments/catalog';
import { requestNicepayPayment, toNicepayMethod } from '@/lib/payments/nicepay-checkout';

interface Props {
  packageId: string;
  plan: string;
  product?: string;
  /** 화면 표시·GA 용 금액(= 서버가 계산한 할인 후 청구액). PG 청구에는 쓰지 않는다 — prepare 응답만 쓴다. */
  amount: number;
  /** 체크아웃 화면이 적용해 보여 준 쿠폰. prepare 가 같은 코드로 다시 계산·귀속한다. */
  couponCode?: string;
  orderName: string;
  slug?: string;
  scope?: string;
  entrySource?: string;
  provider?: 'toss' | 'nicepay';
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
  // 2026-07-07 — 서버가 스냅샷한 청구 금액(order.amount). PG 청구는 **이 값만** 쓴다.
  amount?: number;
}

export default function TossMembershipCheckout({
  packageId,
  plan,
  product,
  amount,
  couponCode,
  orderName,
  slug,
  scope,
  entrySource = 'membership',
  provider,
}: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TossPaymentMethodCode>(
    DEFAULT_TOSS_PAYMENT_METHOD
  );
  const pkg = useMemo(() => getPackage(packageId), [packageId]);
  // Phase 3-C-1: 동의 체크 상태. valid 시만 결제 버튼 활성.
  //   2026-09-09 — 체크박스가 하단 고정바로 내려가면서 상태 소유자를 여기로 올렸다
  //   (체크박스 행과 결제 버튼이 같은 상태를 봐야 한다).
  const consent = usePaymentConsent(pkg);
  const { valid: consentValid, acceptedKinds } = consent;

  const checkoutPath = useMemo(() => {
    const params = new URLSearchParams(product ? { product } : { plan });
    if (slug) params.set('slug', slug);
    if (scope) params.set('scope', scope);
    if (entrySource) params.set('from', entrySource);
    return `/membership/checkout?${params.toString()}`;
  }, [entrySource, plan, product, scope, slug]);

  // 🔴 2026-08-27 — 마운트 1회 판정 + onAuthStateChange 미구독이면 세션 state 가 stale 해진다.
  //   이 저장소가 이미 같은 방식으로 데였다(2026-07-01 메가내브 로그아웃 버튼 '작동 안 함' —
  //   getUser 를 한 번만 부르고 구독을 안 해서 로그인/로그아웃이 반영되지 않았다).
  //   여기서 stale 이면 결제 버튼이 `isLoggedIn === null` 로 **disabled 에 갇히거나**,
  //   이미 로그인한 사람을 다시 /login 으로 보낸다 — 둘 다 "눌러도 아무 반응 없음"으로 보인다.
  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      setIsLoggedIn(false);
      return;
    }

    let isActive = true;
    const supabase = createClient();
    void getCurrentBrowserUser(supabase)
      .then((user) => {
        if (isActive) setIsLoggedIn(Boolean(user));
      })
      .catch(() => {
        // 조회 실패를 null 로 남기면 버튼이 영구 disabled 가 된다 — 미로그인으로 확정해
        // 최소한 로그인 경로는 열어 준다.
        if (isActive) setIsLoggedIn(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) return;
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
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
      // 2026-09-03 (migration 077) — 여기가 **퍼널의 사각지대**였다. prepare 를 부르지 않고
      //   /login 으로 보내므로 "결제하려 했지만 로그인 벽에 막힌 사람"이 흔적 0으로 사라졌다.
      //   기록은 best-effort — 실패해도 로그인 이동을 막지 않는다(await 하지 않는다).
      void fetch('/api/payments/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'login_required', packageId, product, slug, from: entrySource }),
        keepalive: true,
      }).catch(() => {});
      // returned=1 로 돌아오면 결제 화면이 login_returned 를 남긴다(둘의 차이 = 로그인 벽 손실).
      const backTo = `${checkoutPath}${checkoutPath.includes('?') ? '&' : '?'}returned=1`;
      location.href = `/login?next=${encodeURIComponent(backTo)}`;
      return;
    }

    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
      setErrorMessage('결제 클라이언트 키가 설정되어 있지 않습니다.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // GA4 전자상거래 — 결제창 호출 직전. purchase 는 서버가 보내고, 여기까지가 클라이언트 몫.
    const gtmItems = [
      {
        item_id: packageId,
        item_name: orderName,
        item_category: 'checkout',
        price: amount,
        quantity: 1,
      },
    ];
    gtmAddPaymentInfo(packageId, paymentMethod, amount, gtmItems);
    gtmBeginCheckout(packageId, amount, gtmItems);

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
          // 2026-08-26 — 동의 상태는 localStorage 라 서버가 못 읽는다. denied 면 확정 시
          //   GA 서버 전송을 건너뛴다(브라우저만 막고 서버로 우회하면 동의 배너가 거짓말이 된다).
          analyticsConsent: readConsent(),
          paymentMethod,
          // Phase 3-C-1: 결제 전 동의 정책 종류. prepare API 가 활성 PolicyVersion 으로 변환 후 DB insert.
          acceptedKinds,
          // 2026-09-11 — 코드만 보낸다. 할인율·금액은 서버가 DB 에서 다시 계산한다.
          couponCode,
          // 화면에 보여 준 최종 금액. 서버는 **대조에만** 쓴다(다르면 결제를 멈추고 새로고침 안내).
          expectedAmount: amount,
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
      // 2026-07-07 — 실제 PG 청구액은 서버가 만든 order.amount(리졸버 스냅샷)를 따른다.
      // 🔴 2026-09-11 — prop amount 폴백 **삭제**. 폴백이 있으면 서버 금액이 비었을 때 화면 금액으로
      //   결제창이 열리고, 할인쿠폰이 붙은 뒤로는 "할인 실패 → 조용히 다른 금액 청구"가 된다
      //   (설계 docs/discount-coupon-design.md §3-3). 서버 금액이 없으면 결제창을 열지 않는다.
      if (
        typeof prepare.amount !== 'number' ||
        !Number.isInteger(prepare.amount) ||
        prepare.amount <= 0
      ) {
        setErrorMessage('결제 금액을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
        return;
      }
      const chargeAmount = prepare.amount;

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
          amount: chargeAmount,
          plan,
        });
        await requestNicepayPayment({
          orderId,
          amount: chargeAmount,
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
        amount: chargeAmount,
        plan,
      });

      const paymentRequest = {
        amount: { currency: 'KRW', value: chargeAmount },
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
      <TossPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} provider={provider} />
      {/* 주문 요약·알림 필드는 본문에. 동의 체크박스는 아래 고정바(버튼 바로 위)로 갔다. */}
      {pkg && <PaymentConsentDetails confirmationItems={confirmationItems} />}
      {errorMessage ? (
        <p className="text-center text-sm leading-6 text-rose-600">{errorMessage}</p>
      ) : (
        <p className="text-center text-sm leading-6 text-[var(--app-copy-soft)]">
          결제 완료 후 서버에서 이용권을 확인하고 바로 반영합니다.
        </p>
      )}
      {/* 2026-06-30 — 결제 버튼을 화면 하단에 진짜 고정(포커스 체크아웃). body portal 로 viewport 고정.
          2026-09-09 — 동의 체크박스를 이 바 안, **버튼 바로 위**로 옮겼다(사용자 요청:
          "바로 결제하기가 더 수월하게"). 체크하러 위로 스크롤할 필요가 없다.
          ⚠️ 버튼 **위**인 이유: 전자상거래법상 동의가 결제 행위보다 앞서야 하고 화면 순서도
          그 흐름을 따른다(2026-06-30 부터 지켜온 제약). 아래로 내리지 말 것. */}
      <StickyBottomBar variant="bottom">
        <PaymentConsentRow
          items={consent.items}
          allAccepted={consent.allAccepted}
          onToggleAll={consent.toggleAll}
        />
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
      </StickyBottomBar>
    </div>
  );
}
