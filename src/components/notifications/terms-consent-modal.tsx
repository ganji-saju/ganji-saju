// 2026-05-15 handoff PR-H: 보드 `terms-modal` (28) SHELL 컴포넌트.
// 풀스크린 약관 동의 모달 — GDPR/14세 미만 등 강한 동의가 필요한 시점에만 mount.
// 현재는 회원가입 흐름이 implicit consent (이용약관 페이지 링크) 라 미사용.
// caller 가 explicit consent 필요한 시점(예: 외국인 가입, 14세 미만 보호자 동의) 에 mount.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/components/common/use-focus-trap';
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
  // 2026-05-15 PR-M: SHELL 단계 disabled 체크 → 실제 state 관리.
  // items 가 바뀌면 state 리셋. 한 모달에서 다른 items 를 노출할 일은 거의 없으나 안전.
  const [consents, setConsents] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of items) initial[item.id] = false;
    return initial;
  });
  const trapRef = useFocusTrap<HTMLElement>(open);

  // open 이 true 가 될 때 항상 초기화 (재오픈 시 이전 체크 상태가 남지 않도록).
  useEffect(() => {
    if (open) {
      const reset: Record<string, boolean> = {};
      for (const item of items) reset[item.id] = false;
      setConsents(reset);
    }
  }, [open, items]);

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

  // 필수 항목 모두 체크되었는지 + 전체 체크 여부 derive.
  const allChecked = useMemo(() => items.every((item) => consents[item.id]), [items, consents]);
  const requiredItems = useMemo(() => items.filter((item) => item.required), [items]);
  const requiredAllChecked = useMemo(
    () => requiredItems.every((item) => consents[item.id]),
    [requiredItems, consents]
  );

  function toggleAll(next: boolean) {
    const update: Record<string, boolean> = {};
    for (const item of items) update[item.id] = next;
    setConsents(update);
  }

  function toggleOne(id: string, next: boolean) {
    setConsents((prev) => ({ ...prev, [id]: next }));
  }

  if (!open) return null;

  function handleConfirmClick() {
    if (!requiredAllChecked) return;
    onConfirm({ ...consents });
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
        ref={trapRef}
        tabIndex={-1}
        className="motion-modal-sheet relative w-full max-w-md overflow-hidden rounded-t-[22px] border bg-white p-5 shadow-[0_-22px_50px_-18px_rgba(17,17,20,0.32)] sm:rounded-[22px] sm:p-6 focus:outline-none"
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
          약관 동의
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

        {/* 2026-05-15 PR-M: 전체 동의 row — 한국 사주 사이트 표준 패턴. */}
        <label
          className="mt-4 flex cursor-pointer items-center justify-between gap-2 rounded-[12px] border p-3"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <span className="text-[14px] font-extrabold text-[var(--app-pink-strong)]">
            모든 약관에 동의합니다
          </span>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(event) => toggleAll(event.target.checked)}
            className="h-5 w-5 cursor-pointer accent-[var(--app-pink)]"
          />
        </label>

        <ul className="mt-2 grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-[12px] border bg-white p-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(consents[item.id])}
                  onChange={(event) => toggleOne(item.id, event.target.checked)}
                  className="h-5 w-5 cursor-pointer accent-[var(--app-pink)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                    {item.label}
                    {item.required ? (
                      <span className="ml-1 text-[var(--app-pink-strong)]">*</span>
                    ) : (
                      <span className="ml-1 text-[11px] font-bold text-[var(--app-copy-soft)]">(선택)</span>
                    )}
                  </div>
                </div>
              </label>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[11.5px] font-bold text-[var(--app-pink-strong)] underline-offset-2 hover:underline"
                >
                  전체 보기
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={!requiredAllChecked}
            aria-disabled={!requiredAllChecked}
            className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] disabled:bg-[var(--app-copy-soft)] disabled:opacity-60 disabled:shadow-none"
          >
            {confirmLabel}
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
