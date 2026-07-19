// Phase 1 Task 6 (2026-06-30): 전 충전 종료 — 잔액·소진 안내 페이지로 전환.
// 패키지 선택·결제 CTA·결제 수단·동의 블록 제거. 잔액 표시·정책 링크 유지.
'use client';

import { Suspense, useEffect, useState } from 'react';
import { getFeatureCost } from '@/lib/credits/costs';
import { useSearchParams } from 'next/navigation';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
// 정책/CS 링크
import Link from 'next/link';
import { BUSINESS_INFO } from '@/lib/business-info';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

function CreditsPageContent() {
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // 현재 보유 잔액 (balance + subscription_balance 합산)
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsFetchError, setCreditsFetchError] = useState(false);
  const [creditsFetchVersion, setCreditsFetchVersion] = useState(0);
  const entrySource = searchParams.get('from') ?? 'credits';

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

    // 결제 완료 / 전 소진 시 SiteHeader 가 dispatch 하는 event 를 listen — 즉시 갱신.
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

  return (
    <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="전 잔액" backHref="/my" />

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
              className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              현재 보유
            </div>
            {creditsFetchError ? (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCreditsFetchError(false);
                    setCredits(null);
                    setCreditsFetchVersion((v) => v + 1);
                  }}
                  className="rounded-[10px] bg-white/15 px-3 py-2 text-[14.4px] font-bold text-white"
                >
                  잔액 확인 다시 시도
                </button>
                <p className="mt-2 text-[13.2px]" style={{ opacity: 0.7 }}>
                  잔액 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-1.5 flex items-end gap-2">
                  {isLoggedIn === false ? (
                    <div
                      className="text-[41.4px] font-extrabold tracking-tighter"
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
                      className="text-[41.4px] font-extrabold tracking-tighter"
                      style={{ color: 'var(--app-pink)' }}
                    >
                      ✦ {credits.toLocaleString()}
                    </div>
                  )}
                  <span className="pb-1.5 text-[16.1px] font-bold" style={{ opacity: 0.6 }}>
                    전
                  </span>
                </div>
                <p className="mt-2 text-[13.2px]" style={{ opacity: 0.6 }}>
                  {isLoggedIn === false
                    ? '로그인 후 잔액을 확인할 수 있습니다'
                    : credits === null
                      ? '잔액 확인 중입니다'
                      : credits > 0
                        ? '보유 전은 만료일까지 사용하실 수 있습니다'
                        : '현재 사용 가능한 전이 없습니다'}
                </p>
              </>
            )}
          </article>

          {/* §2 충전 종료 안내 */}
          <article
            className="rounded-[14px] border px-4 py-3 text-[13.8px] leading-[1.55] text-[var(--app-pink-strong)]"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            ✦ 전 추가 충전은 종료되었습니다. 보유 전은 만료일까지 계속 사용하실 수 있습니다.
          </article>

          {/* §3 잔액별 안내 카드 */}
          {isLoggedIn !== null && credits !== null && (
            credits > 0 ? (
              <article
                className="rounded-[14px] border bg-white px-4 py-3 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="font-extrabold text-[var(--app-ink)]">보유 전 사용 안내</div>
                {/* 2026-07-19 — 값이 리터럴이라 가격 이벤트 후 stale(10전 → 실제 3전)이었고,
                    '연애 마음 확인'은 전 차감 경로 자체가 없다(deductCredits(_, 'compat') 호출부 0건).
                    실제로 전이 쓰이는 항목만 차감 상수에서 파생해 노출한다. */}
                <p className="mt-1 text-[13.8px]">
                  오늘 자세히 보기 {getFeatureCost('detail_report')}전 · 월간 달력{' '}
                  {getFeatureCost('calendar')}전
                </p>
              </article>
            ) : (
              <article
                className="rounded-[14px] border bg-white px-4 py-3 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="font-extrabold text-[var(--app-ink)]">멤버십으로 계속 이용하기</div>
                <p className="mt-1">
                  전 충전은 종료되었습니다. 멤버십 구독으로 프리미엄 기능을 이용하세요.
                </p>
                <Link
                  href="/membership"
                  className="mt-2 inline-flex rounded-[12px] bg-[var(--app-pink)] px-4 py-2 text-[13.8px] font-extrabold text-white"
                >
                  멤버십 알아보기
                </Link>
              </article>
            )
          )}

          {/* 비로그인: 잔액 확인 유도 */}
          {isLoggedIn === false && (
            <article
              className="rounded-[14px] border bg-white px-4 py-3 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="font-extrabold text-[var(--app-ink)]">로그인하면 잔액을 확인할 수 있습니다</div>
              <Link
                href={`/login?next=${encodeURIComponent(`/credits?from=${entrySource}`)}`}
                className="mt-2 inline-flex rounded-[12px] bg-[var(--app-pink)] px-4 py-2 text-[13.8px] font-extrabold text-white"
              >
                로그인하기
              </Link>
            </article>
          )}
        </section>

        {/* §4 정책 + CS 링크 — 기존 잔액 보유자에게 여전히 유효 */}
        <section
          className="flex flex-wrap gap-x-3 gap-y-1 text-[13.2px] leading-[1.6] text-[var(--app-copy-muted)]"
          aria-label="재화(전) 정책 및 고객센터"
        >
          <Link href="/coin-policy" className="underline">
            재화(전) 정책
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
      </AppPage>
    </AppShell>
  );
}

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-12">
          <AppPage className="gangi-subpage saju-result-page text-center">
            <p className="px-1 py-8 text-[14.4px] text-[var(--app-copy-muted)]">
              전 잔액 확인 중
            </p>
          </AppPage>
        </AppShell>
      }
    >
      <CreditsPageContent />
    </Suspense>
  );
}
