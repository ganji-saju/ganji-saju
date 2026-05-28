// 2026-05-22 — Phase 2+3 스펙 §6: 잠금 UI + 결제 유도 모달(per-factor 550원).
//   무료: 🔒 자세히 → 클릭 시 결제 모달. 유료(isUnlocked): navigateTo 이동.
//   ※ 실제 결제 로직 없음 — 모달 UI + console.log (결제 플로우는 별도 PR).
//   기존 모달 idiom(terms-consent-modal) 준수: motion-modal-dim/sheet · ESC · scroll-lock · bottom-sheet/center.
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import '@/components/motion/motion-primitives.css';

export type LockFactorId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

interface LockGateProps {
  factorId: LockFactorId;
  factorTitle: string;
  /** 현재 사주 결과 slug — 결제 scope 연결용. */
  slug?: string;
  navigateTo?: string;
  isUnlocked?: boolean;
  className?: string;
}

const FACTOR_VALUE_LINES: Record<LockFactorId, string> = {
  F1: '일주 60갑자 캐릭터 풀이와 타고난 성향의 구체적 패턴',
  F2: '격국 종류와 본인 격국의 강도 — 사회적 역할의 명확성',
  F3: '용신·기신 구체 풀이와 평생 보강 가이드',
  F4: '부족·과다 기운의 일상 적용 — 구체적 보강 방법',
  F5: '작동하는 신살 목록과 각각의 의미 및 활용법',
};

const PRICE = '550원';

export function LockGate({
  factorId,
  factorTitle,
  slug,
  navigateTo,
  isUnlocked = false,
  className = '',
}: LockGateProps) {
  const [open, setOpen] = useState(false);

  // 유료 사용자: 바로 링크 이동
  if (isUnlocked && navigateTo) {
    return (
      <a
        href={navigateTo}
        className={`flex items-center gap-1 text-[12.5px] font-semibold text-[var(--app-copy-muted)] transition-colors hover:text-[var(--app-ink)] ${className}`}
      >
        자세히 →
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${factorTitle} 자세한 풀이 보기 (유료)`}
        className={`flex items-center gap-1 text-[12.5px] font-semibold text-[var(--app-copy-soft)] transition-colors hover:text-[var(--app-copy-muted)] ${className}`}
      >
        <span aria-hidden="true">🔒</span>
        <span>자세히 →</span>
      </button>

      {open
        ? createPortal(
            <LockPaymentModal
              factorId={factorId}
              factorTitle={factorTitle}
              slug={slug}
              valueLine={FACTOR_VALUE_LINES[factorId]}
              price={PRICE}
              onClose={() => setOpen(false)}
            />,
            document.body
          )
        : null}
    </>
  );
}

interface LockPaymentModalProps {
  factorId: LockFactorId;
  factorTitle: string;
  slug?: string;
  valueLine: string;
  price: string;
  onClose: () => void;
}

function LockPaymentModal({ factorId, factorTitle, slug, valueLine, price, onClose }: LockPaymentModalProps) {
  // ESC 닫기 + body scroll 잠금 (terms-consent-modal idiom)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
      className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="motion-modal-dim absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <article
        className="motion-modal-sheet w-full max-w-sm overflow-y-auto border bg-white p-5 shadow-[0_20px_60px_rgba(17,17,20,0.28)] sm:p-6"
        style={{
          borderColor: 'var(--app-pink-line)',
          position: 'relative',
          inset: 'auto',
          borderRadius: '22px',
          maxHeight: 'min(78dvh, 520px)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border bg-white text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          더 자세한 풀이가 있어요
        </div>
        <h2
          id="lock-modal-title"
          className="mt-1 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {factorTitle} 자세한 풀이
        </h2>

        <div
          className="mt-4 rounded-[14px] p-4"
          style={{ background: 'var(--app-surface-muted)' }}
        >
          <p className="text-[13px] leading-[1.7] text-[var(--app-copy)]" style={{ wordBreak: 'keep-all' }}>
            {valueLine}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="rounded-full bg-[var(--app-pink-soft)] px-3 py-1.5 text-[13px] font-bold text-[var(--app-pink-strong)]">
            {price}
          </span>
          <button
            type="button"
            onClick={() => {
              // 기존 Toss 결제 플로우(taste_product) 재사용 — score-factor 상품, factor 는 scope.
              if (slug) {
                window.location.href = `/membership/checkout?product=score-factor&slug=${encodeURIComponent(slug)}&scope=${factorId}&from=saju-result`;
                return;
              }
              onClose();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            풀이 보기
          </button>
        </div>

        <p className="mt-3 text-center text-[11.5px] text-[var(--app-copy-soft)]">
          결제 후 보관함에서 다시 볼 수 있어요
        </p>
      </article>
    </div>
  );
}
