// 2026-05-15 handoff PR-H: 보드 `terms-modal` (28) SHELL 컴포넌트.
// 풀스크린 약관 동의 모달 — GDPR/14세 미만 등 강한 동의가 필요한 시점에만 mount.
// 현재는 회원가입 흐름이 implicit consent (이용약관 페이지 링크) 라 미사용.
// caller 가 explicit consent 필요한 시점(예: 외국인 가입, 14세 미만 보호자 동의) 에 mount.
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import '@/components/motion/motion-primitives.css';

interface TermsConsentItem {
  /** 항목 식별자 (예: 'service', 'privacy', 'marketing'). */
  id: string;
  /** 표시 라벨 (예: '서비스 이용약관'). */
  label: string;
  /** 필수 여부. 필수 항목은 미체크 시 confirm 비활성. */
  required: boolean;
  /** 전체 약관 본문 (또는 외부 페이지 href — caller 가 분기 가능). */
  href?: string;
}

interface TermsConsentModalProps {
  open: boolean;
  onClose: () => void;
  /** 사용자가 모든 필수 항목 체크 + "동의하고 계속" 클릭 시. */
  onConfirm: (consents: Record<string, boolean>) => void;
  items: TermsConsentItem[];
  title?: string;
  /** 동의 후 진행할 라벨. 기본 "동의하고 계속". */
  confirmLabel?: string;
}

export function TermsConsentModal({
  open,
  onClose,
  onConfirm,
  items,
  title = '약관에 동의해 주세요',
  confirmLabel = '동의하고 계속',
}: TermsConsentModalProps) {
  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // body scroll 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // SHELL 단계 — 실제 체크 state 와 onConfirm 분기는 후속 PR. 현재는 disabled 시연.
  function handleConfirmClick() {
    const consents: Record<string, boolean> = {};
    for (const item of items) consents[item.id] = true;
    onConfirm(consents);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center px-3 sm:items-center"
    >
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="motion-modal-dim absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <article
        className="motion-modal-sheet relative w-full max-w-md overflow-hidden rounded-t-[22px] border bg-white p-5 shadow-[0_-22px_50px_-18px_rgba(17,17,20,0.32)] sm:rounded-[22px] sm:p-6"
        style={{ borderColor: 'var(--app-pink-line)' }}
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
          약관 동의 (준비 중)
        </div>
        <h2
          id="terms-modal-title"
          className="mt-1 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {title}
        </h2>
        <p
          className="mt-2 text-[12.5px] leading-[1.65] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          서비스 이용을 위해 다음 약관 동의가 필요합니다. 필수 항목은 모두 동의해야 진행할 수 있어요.
        </p>

        <ul className="mt-4 grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-[12px] border bg-white p-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                  {item.label}
                  {item.required ? (
                    <span className="ml-1 text-[var(--app-pink-strong)]">*</span>
                  ) : null}
                </div>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-[11.5px] font-bold text-[var(--app-pink-strong)] underline-offset-2 hover:underline"
                  >
                    전체 보기
                  </a>
                ) : null}
              </div>
              {/* SHELL 단계: 체크박스 disabled — caller 가 실 동의 흐름을 붙이는 후속 PR 에서 활성화. */}
              <input
                type="checkbox"
                disabled
                aria-disabled="true"
                className="h-5 w-5 cursor-not-allowed accent-[var(--app-pink)] opacity-60"
              />
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled
            aria-disabled="true"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-copy-soft)] px-5 text-[14.5px] font-extrabold text-white opacity-60"
          >
            {confirmLabel} (준비 중)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-bold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            취소
          </button>
        </div>
      </article>
    </div>
  );
}
