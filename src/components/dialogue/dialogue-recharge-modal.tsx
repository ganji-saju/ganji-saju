// 2026-09-01 — 대화 질문이 0회가 된 순간 띄우는 결제 창.
//   전엔 402 응답이 에러 배너로만 뜨고 결제 경로가 '멤버십 보기' 하나뿐이라, 990원
//   질문권으로 바로 이어 쓰려는 사람이 갈 곳이 없었다.
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/components/common/use-focus-trap';
import '@/components/motion/motion-primitives.css';

interface DialogueRechargeModalProps {
  open: boolean;
  onClose: () => void;
  /** 결제 후 돌아올 좌표 — 체크아웃의 from 파라미터. */
  from?: string;
}

export function DialogueRechargeModal({
  open,
  onClose,
  from = 'dialogue-room',
}: DialogueRechargeModalProps) {
  const trapRef = useFocusTrap<HTMLElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogue-recharge-title"
      className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-center"
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="motion-modal-dim absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <article
        ref={trapRef}
        tabIndex={-1}
        className="motion-modal-sheet relative w-full max-w-md rounded-[22px] border bg-white p-5 shadow-[0_-22px_50px_-18px_rgba(17,17,20,0.32)] focus:outline-none sm:p-6"
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

        <h2
          id="dialogue-recharge-title"
          className="pr-8 text-[21px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          남은 질문을 다 쓰셨어요
        </h2>
        <p
          className="mt-2 text-[15px] leading-[1.7] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          지금까지 나눈 대화는 그대로 남아 있어요. 이어서 물어보시려면 아래에서 선택해 주세요.
        </p>

        <div className="mt-5 grid gap-2">
          <Link
            href={`/membership/checkout?product=dialogue-entry&from=${encodeURIComponent(from)}`}
            className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 text-[16.7px] font-extrabold text-white shadow-[0_12px_28px_rgba(142,42,32,0.32)]"
          >
            질문 3회 990원으로 이어가기
          </Link>
          <Link
            href="/membership"
            className="inline-flex h-12 items-center justify-center rounded-[12px] border bg-white px-5 text-[15px] font-extrabold text-[var(--app-copy)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            멤버십으로 매일 5건 쓰기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-[12px] px-5 text-[14px] font-bold text-[var(--app-copy-muted)]"
          >
            나중에 하기
          </button>
        </div>
      </article>
    </div>,
    document.body
  );
}
