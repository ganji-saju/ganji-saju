// Redesign 2026-05-13 (Claude Design / screens-f.jsx ScreenCoinPackages):
// ink-dark 현재 잔액 + 코인 패키지 list (POPULAR/BEST 배지) + 결제 수단 + sticky CTA.
// Toss 결제 로직 · 라우팅 · 트래킹 모두 무수정.
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { toast } from 'sonner';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  getTossPaymentMethodOption,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import TossPaymentMethodPicker from '@/components/payments/toss-payment-method-picker';
import { PaymentConsentCheckboxes } from '@/components/policies/payment-consent-checkboxes';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
// 2026-05-18 Phase 5-D: 정책/CS 링크. (잔액 영역은 ink-dark 배경이라 ErrorState 표준 카드 대신 inline retry button 사용.)
import Link from 'next/link';
import { BUSINESS_INFO } from '@/lib/business-info';
import { trackMoonlightEvent } from '@/lib/analytics';
import { PAYMENT_PACKAGES, type PaymentPackage } from '@/lib/payments/catalog';
import type { PolicyKind } from '@/shared/policies/types';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { cn } from '@/lib/utils';

const CREDIT_PACKAGE_DESCRIPTIONS: Record<
  string,
  { desc: string; badge?: 'POPULAR' | 'BEST' | '보너스' }
> = {
  credit_1: { desc: '입문 패키지' },
  credit_3: { desc: '첫 결제 추천', badge: 'POPULAR' },
  credit_7: { desc: '주제 여러 개 안정적인 묶음' },
  subscription_30: { desc: '+6코인 보너스 묶음', badge: '보너스' },
};

const PACKAGES = PAYMENT_PACKAGES.filter((pkg) =>
  ['credit_1', 'credit_3', 'credit_7', 'subscription_30'].includes(pkg.id)
);

interface PaymentPrepareResponse {
  ok?: boolean;
  authenticated?: boolean;
  alreadyPurchased?: boolean;
  redirectHref?: string;
  loginHref?: string;
  error?: string;
}

function getPricePerCoin(pkg: PaymentPackage) {
  if (!pkg.credits) return null;
  return Math.round((pkg.price / pkg.credits) * 10) / 10;
}

function CreditsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // 2026-05-17 — ink-dark "현재 보유" 카드의 잔액 binding. redesign 시 placeholder
  //   ("✦ —" / "로그인 후 잔액과 충전 내역이 표시됩니다") 가 hardcoded 로 남아
  //   로그인한 사용자에게도 "로그인하세요" 안내가 노출되던 회귀 fix.
  //   SiteHeader / mega-nav 와 동일한 user_credits 직접 조회 패턴 + event listen.
  const [credits, setCredits] = useState<number | null>(null);
  // 2026-05-18 Phase 5-D: 잔액 fetch 실패 상태 + retry trigger.
  const [creditsFetchError, setCreditsFetchError] = useState(false);
  const [creditsFetchVersion, setCreditsFetchVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TossPaymentMethodCode>(DEFAULT_TOSS_PAYMENT_METHOD);
  const [consentValid, setConsentValid] = useState(false);
  const [acceptedKinds, setAcceptedKinds] = useState<PolicyKind[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    PACKAGES.find((p) => CREDIT_PACKAGE_DESCRIPTIONS[p.id]?.badge === 'POPULAR')?.id ??
      PACKAGES[0]?.id ??
      ''
  );
  const entrySource = searchParams.get('from') ?? 'credits';
  const hasPaymentError = searchParams.get('error') === 'fail';

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      setIsLoggedIn(false);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    setCreditsFetchError(false);

    void (async () => {
      try {
        const user = await getCurrentBrowserUser(supabase);
        if (cancelled) return;
        setIsLoggedIn(Boolean(user));
        if (!user) {
          setCredits(null);
          return;
        }
        const { data, error } = await supabase
          .from('user_credits')
          .select('balance, subscription_balance')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setCreditsFetchError(true);
          return;
        }
        setCredits((data?.balance ?? 0) + (data?.subscription_balance ?? 0));
      } catch {
        if (!cancelled) setCreditsFetchError(true);
      }
    })();

    // 결제 완료 / 코인 소진 시 SiteHeader 가 dispatch 하는 event 를 listen — 즉시 갱신.
    const syncFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ credits?: number; remaining?: number }>).detail;
      const next = typeof detail?.credits === 'number' ? detail.credits : detail?.remaining;
      if (typeof next === 'number') {
        setCredits(next);
      }
    };
    window.addEventListener('moonlight:credits-updated', syncFromEvent);

    return () => {
      cancelled = true;
      window.removeEventListener('moonlight:credits-updated', syncFromEvent);
    };
  }, [creditsFetchVersion]);

  const selectedPackage = useMemo(
    () => PACKAGES.find((p) => p.id === selectedPackageId) ?? PACKAGES[0],
    [selectedPackageId]
  );
  const selectedMethod = getTossPaymentMethodOption(paymentMethod);
  const confirmationItems = useMemo(() => {
    if (!selectedPackage) return [];
    return [
      `상품: ${selectedPackage.name}`,
      `충전 코인: ${selectedPackage.credits.toLocaleString('ko-KR')}코인`,
      `결제 금액: ${selectedPackage.price.toLocaleString('ko-KR')}원`,
      `결제 수단: ${selectedMethod.label}`,
    ];
  }, [selectedMethod.label, selectedPackage]);
  const purchaseDisabled =
    !selectedPackage ||
    loading !== null ||
    isLoggedIn === null ||
    (isLoggedIn === true && !consentValid);

  async function handlePurchase(pkg: PaymentPackage) {
    if (!isLoggedIn) {
      location.href = `/login?next=${encodeURIComponent(`/credits?from=${entrySource}`)}`;
      return;
    }

    if (!consentValid) {
      setErrorMessage('결제 전 필수 동의 항목을 확인해 주세요.');
      return;
    }

    if (!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY) {
      setErrorMessage('Toss 결제 키가 아직 설정되지 않았습니다. 운영 설정을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    setLoading(pkg.id);
    setErrorMessage('');
    try {
      const prepareResponse = await fetch('/api/payments/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          from: entrySource,
          acceptedKinds,
        }),
      });
      const prepare = (await prepareResponse
        .json()
        .catch(() => null)) as PaymentPrepareResponse | null;

      if (prepareResponse.status === 401 || prepare?.authenticated === false) {
        location.href =
          prepare?.loginHref ?? `/login?next=${encodeURIComponent(`/credits?from=${entrySource}`)}`;
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
      setLoading(null);
    }
  }

  return (
    <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-32 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="코인 충전" backHref="/my" />

        <section className="space-y-5 px-1">
          {/* §1 현재 잔액 ink-dark */}
          <article
            className="rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              현재 보유
            </div>
            {/* 2026-05-18 Phase 5-D: 잔액 skeleton + 에러 시 RetryButton. */}
            {creditsFetchError ? (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCreditsFetchError(false);
                    setCredits(null);
                    setCreditsFetchVersion((v) => v + 1);
                  }}
                  className="rounded-[10px] bg-white/15 px-3 py-2 text-[12.5px] font-bold text-white"
                >
                  잔액 확인 다시 시도
                </button>
                <p className="mt-2 text-[11.5px]" style={{ opacity: 0.7 }}>
                  잔액 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-1.5 flex items-end gap-2">
                  {isLoggedIn === false ? (
                    <div
                      className="text-[36px] font-extrabold tracking-tighter"
                      style={{ color: 'var(--app-pink)' }}
                    >
                      {/* audit-mockup: intentional — 비로그인 사용자에게 dash 표시 (의도된 UX) */}
                      ✦ —
                    </div>
                  ) : credits === null ? (
                    <div
                      aria-label="잔액 확인 중"
                      className="h-[36px] w-32 animate-pulse rounded bg-white/15"
                    />
                  ) : (
                    <div
                      className="text-[36px] font-extrabold tracking-tighter"
                      style={{ color: 'var(--app-pink)' }}
                    >
                      ✦ {credits.toLocaleString()}
                    </div>
                  )}
                  <span className="pb-1.5 text-[14px] font-bold" style={{ opacity: 0.6 }}>
                    코인
                  </span>
                </div>
                <p className="mt-2 text-[11.5px]" style={{ opacity: 0.6 }}>
                  {isLoggedIn === false
                    ? '로그인 후 잔액과 충전 내역이 표시됩니다'
                    : credits === null
                      ? '잔액 확인 중입니다'
                      : '결제 즉시 잔액에 반영됩니다'}
                </p>
              </>
            )}
          </article>

          {/* §2 사용 안내 */}
          <article
            className="rounded-[14px] border px-4 py-3 text-[12px] leading-[1.55] text-[var(--app-pink-strong)]"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            ✦ <strong>오늘 자세히 보기 1코인</strong> · <strong>연애 마음 확인 2코인</strong> ·
            결제 즉시 잔액 반영
          </article>

          {/* §3 패키지 list */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">충전 패키지</h2>
            <p className="mt-1 text-[12px] text-[var(--app-copy-muted)]">
              원하는 만큼 골라 결제하면 즉시 코인이 충전됩니다.
            </p>
            <div className="mt-3 grid gap-3">
              {PACKAGES.map((pkg) => {
                const info = CREDIT_PACKAGE_DESCRIPTIONS[pkg.id];
                const active = selectedPackageId === pkg.id;
                const each = getPricePerCoin(pkg);
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={cn(
                      'relative w-full rounded-[16px] p-4 text-left transition'
                    )}
                    style={
                      active
                        ? {
                            background: 'var(--app-pink-soft)',
                            border: '2px solid var(--app-pink)',
                          }
                        : {
                            background: '#fff',
                            border: '1px solid var(--app-line)',
                          }
                    }
                  >
                    {info?.badge ? (
                      <span
                        className="absolute -top-2 left-4 rounded-[6px] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-white"
                        style={{
                          background:
                            info.badge === 'BEST' ? 'var(--app-ink)' : 'var(--app-pink)',
                        }}
                      >
                        {info.badge}
                      </span>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[18px] font-extrabold"
                        style={
                          active
                            ? {
                                background:
                                  'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                                color: '#fff',
                              }
                            : {
                                background: 'var(--app-pink-soft)',
                                color: 'var(--app-pink-strong)',
                              }
                        }
                        aria-hidden="true"
                      >
                        ✦
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[18px] font-extrabold tracking-tight text-[var(--app-ink)]">
                            {pkg.credits.toLocaleString()}
                          </span>
                          <span className="text-[11.5px] font-bold text-[var(--app-copy-soft)]">
                            코인
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--app-copy-soft)]">
                          {info?.desc}
                          {each !== null ? ` · 1코인 ≈ ${each}원` : ''}
                        </div>
                      </div>
                      <div
                        className="shrink-0 text-right text-[16px] font-extrabold tracking-tight"
                        style={{ color: active ? 'var(--app-pink-strong)' : 'var(--app-ink)' }}
                      >
                        {pkg.price.toLocaleString()}원
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {isLoggedIn === false ? (
            <article
              className="rounded-[14px] border bg-white px-4 py-3 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="font-extrabold text-[var(--app-ink)]">계정 연결 뒤 결제할 수 있습니다</div>
              <p className="mt-1">
                코인팩과 환불 기준은 먼저 확인할 수 있고, 선택한 패키지는 로그인 뒤 결제로 이어집니다.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`/credits?from=${entrySource}`)}`}
                className="mt-2 inline-flex rounded-full bg-[var(--app-pink)] px-4 py-2 text-[12px] font-extrabold text-white"
              >
                로그인하고 충전하기
              </Link>
            </article>
          ) : null}

          {/* §4 결제 수단 */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">결제 수단</h2>
            <div className="mt-3">
              <TossPaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
            </div>
          </section>

          {selectedPackage ? (
            <PaymentConsentCheckboxes
              pkg={selectedPackage}
              confirmationItems={confirmationItems}
              onValidChange={(valid, kinds) => {
                setConsentValid(valid);
                setAcceptedKinds(kinds);
              }}
            />
          ) : null}

          {/* 에러 안내 */}
          {hasPaymentError ? (
            <article
              className="rounded-[12px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--app-ink)]"
              style={{
                background: 'rgba(248,113,113,0.08)',
                borderColor: 'rgba(248,113,113,0.3)',
              }}
            >
              결제가 완료되지 않았습니다. 결제창을 닫으셨거나 승인에 실패했을 수 있습니다.
            </article>
          ) : null}

          {errorMessage ? (
            <article
              className="rounded-[12px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--app-ink)]"
              style={{
                background: 'rgba(248,113,113,0.08)',
                borderColor: 'rgba(248,113,113,0.3)',
              }}
            >
              {errorMessage}
            </article>
          ) : null}

          <p className="text-[11.5px] leading-[1.6] text-[var(--app-copy-soft)]">
            토스페이먼츠 카드 결제 · 계좌이체 · 모든 필수 동의가 확인된 뒤 결제창이 열립니다.
          </p>
        </section>

        {/* §4-b 정책 + CS 링크 (Phase 5-D 사용자 directive) — 결제 sticky CTA 위 */}
        <section
          className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] leading-[1.6] text-[var(--app-copy-muted)]"
          aria-label="코인 정책 및 고객센터"
        >
          <Link href="/coin-policy" className="underline">
            코인 정책
          </Link>
          <Link href="/refund-policy" className="underline">
            환불·청약철회
          </Link>
          <Link href="/help" className="underline">
            고객센터
          </Link>
          {BUSINESS_INFO.email ? (
            <a href={`mailto:${BUSINESS_INFO.email}`} className="underline">
              {BUSINESS_INFO.email}
            </a>
          ) : null}
        </section>

        {/* §5 Sticky bottom CTA */}
        <div
          className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--app-line)] bg-white/95 px-4 py-3.5 backdrop-blur"
          style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => selectedPackage && handlePurchase(selectedPackage)}
            disabled={purchaseDisabled}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] disabled:opacity-60"
          >
            {loading
              ? '처리중...'
              : selectedPackage
                ? isLoggedIn === false
                  ? `로그인하고 ${selectedPackage.price.toLocaleString()}원 충전하기`
                  : !consentValid
                    ? '결제 전 동의가 필요합니다'
                  : `${selectedPackage.price.toLocaleString()}원 충전하기 · ${selectedMethod.shortLabel}`
                : '패키지를 선택하세요'}
          </button>
        </div>
      </AppPage>
    </AppShell>
  );
}

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-24 md:pb-12">
          <AppPage className="gangi-subpage saju-result-page text-center">
            <p className="px-1 py-8 text-[12.5px] text-[var(--app-copy-muted)]">
              코인 센터 표시 준비
            </p>
          </AppPage>
        </AppShell>
      }
    >
      <CreditsPageContent />
    </Suspense>
  );
}
