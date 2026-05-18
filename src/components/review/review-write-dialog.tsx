// 2026-05-18 Phase 7b — 후기 작성 modal. /my/results 의 구매 항목에서 호출.
//
// POST /api/reviews 호출 → 성공 시 onSuccess 콜백. 이미 작성된 후기가 있으면 수정 modal 로 동작.
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  REVIEW_CONTENT_MAX,
  REVIEW_CONTENT_MIN,
  REVIEW_DISPLAY_NAME_MAX,
  validateReviewInput,
  type Review,
} from '@/lib/reviews/types';

interface ReviewWriteDialogProps {
  open: boolean;
  productId: string;
  scopeKey: string;
  productTitle: string;
  existing?: Review | null;
  onClose: () => void;
  onSuccess?: (review: Review) => void;
}

const STAR_LABELS = ['1점', '2점', '3점', '4점', '5점'];

export function ReviewWriteDialog({
  open,
  productId,
  scopeKey,
  productTitle,
  existing,
  onClose,
  onSuccess,
}: ReviewWriteDialogProps) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [content, setContent] = useState(existing?.content ?? '');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? 5);
      setContent(existing?.content ?? '');
      setDisplayName(existing?.displayName ?? '');
      setError(null);
      // focus textarea on next tick
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, existing]);

  if (!open) return null;

  const trimmedLen = content.trim().length;
  const canSubmit =
    trimmedLen >= REVIEW_CONTENT_MIN &&
    trimmedLen <= REVIEW_CONTENT_MAX &&
    rating >= 1 &&
    rating <= 5 &&
    !submitting;

  async function handleSubmit() {
    setError(null);
    const validationErrors = validateReviewInput({
      productId,
      rating,
      content,
      displayName,
    });
    if (validationErrors.length > 0) {
      setError(validationErrors[0]?.message ?? '입력값을 다시 확인해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const method = existing ? 'PATCH' : 'POST';
      const url = existing ? `/api/reviews/${existing.id}` : '/api/reviews';
      const body = existing
        ? { rating, content: content.trim(), displayName: displayName.trim() || null }
        : {
            productId,
            scopeKey,
            rating,
            content: content.trim(),
            displayName: displayName.trim() || null,
          };
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; review?: Review; error?: string }
        | null;
      if (!response.ok || !data?.ok || !data.review) {
        setError(data?.error ?? '후기를 저장하지 못했습니다.');
        return;
      }
      onSuccess?.(data.review);
      onClose();
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="후기 작성"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[18px] bg-white shadow-xl">
        <div className="border-b border-[var(--app-line)] px-5 py-4">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            {existing ? '후기 수정' : '후기 작성'}
          </div>
          <h2 className="mt-1 text-[16px] font-extrabold leading-snug text-[var(--app-ink)]">
            {productTitle}
          </h2>
          <p className="mt-1 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]">
            제출 후 검수를 거쳐 공개됩니다. 부적절한 표현은 비공개 처리될 수 있어요.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[12.5px] font-extrabold text-[var(--app-ink)]">
              별점
            </label>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={STAR_LABELS[n - 1]}
                  onClick={() => setRating(n)}
                  className="text-[28px] leading-none transition"
                  style={{
                    color: n <= rating ? 'var(--app-pink-strong)' : 'rgba(17,17,20,0.18)',
                  }}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-[12px] font-bold text-[var(--app-copy-muted)]">
                {rating}점
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="review-content"
              className="block text-[12.5px] font-extrabold text-[var(--app-ink)]"
            >
              본문
            </label>
            <textarea
              ref={textareaRef}
              id="review-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-[12px] border border-[var(--app-line)] bg-white p-3 text-[13.5px] leading-[1.6] outline-none focus:border-[var(--app-pink-strong)]"
              placeholder={`${REVIEW_CONTENT_MIN}자 이상, ${REVIEW_CONTENT_MAX}자 이내로 솔직한 사용 경험을 적어주세요.`}
              maxLength={REVIEW_CONTENT_MAX}
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--app-copy-muted)]">
              <span>
                {trimmedLen < REVIEW_CONTENT_MIN
                  ? `${REVIEW_CONTENT_MIN - trimmedLen}자 더 작성해주세요`
                  : ' '}
              </span>
              <span>
                {trimmedLen} / {REVIEW_CONTENT_MAX}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="review-display-name"
              className="block text-[12.5px] font-extrabold text-[var(--app-ink)]"
            >
              표시명 <span className="font-bold text-[var(--app-copy-muted)]">(선택)</span>
            </label>
            <input
              id="review-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={REVIEW_DISPLAY_NAME_MAX}
              placeholder="비워두면 '익명' 으로 표시"
              className="mt-2 w-full rounded-[12px] border border-[var(--app-line)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[var(--app-pink-strong)]"
            />
          </div>

          {error ? (
            <div
              className="rounded-[10px] border px-3 py-2 text-[12px] font-bold"
              style={{
                background: 'rgba(255, 79, 79, 0.06)',
                borderColor: 'rgba(255, 79, 79, 0.3)',
                color: 'var(--app-coral, #c0292b)',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-[var(--app-line)] bg-[var(--app-pink-soft)]/30 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-[var(--app-line)] bg-white py-2.5 text-[13px] font-extrabold text-[var(--app-copy)] disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-full py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60"
            style={{
              background: 'var(--app-pink)',
              boxShadow: canSubmit ? '0 8px 18px rgba(216, 27, 114, 0.32)' : 'none',
            }}
          >
            {submitting ? '저장 중...' : existing ? '수정 제출' : '등록 제출'}
          </button>
        </div>
      </div>
    </div>
  );
}
