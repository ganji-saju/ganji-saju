// 2026-08-25 전면 개편 — 사주 결과 단일 페이지의 하단 스티키 결제 레이어.
//   설계(사용자 질문 "결제창 두 개 문제"의 답): 미구매자에게 가격 오퍼는 **9,900 종합
//   리포트 하나뿐**이다. 중간의 17항목 목차(ComprehensiveToc)가 설득을 하고, 이 레이어는
//   같은 상품의 두 번째 접점 — 목차를 지나쳐 무료 콘텐츠(명식~대운)를 다 읽은 시점에
//   나타난다. 목차가 화면에 보이는 동안엔 숨긴다(같은 CTA 두 개 동시 노출 금지).
//
//   portal(document.body): page-transition 조상 transform 이 position:fixed 를 깨는
//   기존 함정(고정 하단바=body portal 필수) 회피. dock(z-40) 위에 얹는다.

'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';

export function ComprehensiveCtaLayer({
  checkoutHref,
  priceLabel,
  compareLabel,
  watchTargetId,
}: {
  checkoutHref: string;
  priceLabel: string;
  compareLabel: string | null;
  /** 이 요소(17항목 목차)가 한 번 보였다가 화면에서 사라지면 레이어를 띄운다. */
  watchTargetId: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [seenTarget, setSeenTarget] = useState(false);
  const [targetInView, setTargetInView] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const target = document.getElementById(watchTargetId);
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setTargetInView(entry.isIntersecting);
          if (entry.isIntersecting) setSeenTarget(true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchTargetId]);

  if (!mounted) return null;
  const visible = seenTarget && !targetInView && !dismissed;

  return createPortal(
    <div
      aria-hidden={visible ? undefined : 'true'}
      className="fixed inset-x-0 z-[46] px-3 transition-all duration-300 motion-reduce:transition-none"
      style={{
        bottom: 'calc(var(--app-mobile-dock-clearance, 0px) + 8px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="mx-auto flex max-w-[34rem] items-center gap-3 rounded-[16px] border p-3 shadow-[0_14px_36px_-10px_rgba(28,26,23,0.4)]"
        style={{
          background: 'var(--app-ink)',
          borderColor: 'rgba(255,255,255,0.12)',
          color: '#fff',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.05em]" style={{ color: 'var(--app-gold, #d9b36a)' }}>
            출시 기념가
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[18.4px] font-extrabold leading-none">{priceLabel}</span>
            {compareLabel ? (
              <span className="text-[12.6px] line-through" style={{ opacity: 0.55 }}>
                {compareLabel}
              </span>
            ) : null}
          </div>
        </div>
        <Link
          href={checkoutHref}
          className="shrink-0 rounded-[12px] px-4 py-2.5 text-[15px] font-extrabold text-white no-underline"
          style={{ background: 'var(--app-pink)' }}
        >
          잠긴 13항목 열기 →
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="결제 안내 닫기"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
