// 2026-05-18 Phase 7b — admin moderation client UI.
'use client';

import { useEffect, useState } from 'react';
import type { Review, ReviewModerationStatus } from '@/lib/reviews/types';

type StatusFilter = ReviewModerationStatus | 'all';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: '심사 대기' },
  { value: 'approved', label: '공개' },
  { value: 'rejected', label: '비공개' },
  { value: 'all', label: '전체' },
];

export function ReviewsModerationClient({
  initialStatus = 'pending',
}: {
  initialStatus?: StatusFilter;
}) {
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reviews?status=${status}&limit=100`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok) {
          setError(data?.error ?? '목록을 불러오지 못했습니다.');
          setReviews([]);
          setTotal(0);
          return;
        }
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
      })
      .catch(() => {
        if (cancelled) return;
        setError('네트워크 오류가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function moderate(reviewId: string, action: 'approve' | 'reject', note?: string) {
    setActingId(reviewId);
    setError(null);
    try {
      const response = await fetch('/api/admin/reviews/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action, note: note ?? null }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; review?: Review }
        | null;
      if (!response.ok || !data?.ok || !data.review) {
        setError(data?.error ?? '검수 처리에 실패했습니다.');
        return;
      }
      // 현재 필터에 맞지 않으면 목록에서 제거, 맞으면 업데이트.
      setReviews((current) => {
        const filtered = current.filter((r) => r.id !== reviewId);
        if (status === 'all' || data.review!.moderationStatus === status) {
          return [data.review!, ...filtered];
        }
        return filtered;
      });
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className="rounded-full border px-3 py-1.5 text-[12.5px] font-extrabold transition"
            style={{
              borderColor: status === f.value ? 'var(--app-pink-strong)' : 'var(--app-line)',
              background: status === f.value ? 'var(--app-pink)' : 'white',
              color: status === f.value ? 'white' : 'var(--app-copy-muted)',
            }}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-2 text-[12px] font-bold text-[var(--app-copy-muted)]">
          총 {total}건
        </span>
      </div>

      {error ? (
        <div
          className="rounded-[10px] border px-3 py-2 text-[12.5px] font-bold"
          style={{
            background: 'rgba(255, 79, 79, 0.06)',
            borderColor: 'rgba(255, 79, 79, 0.3)',
            color: 'var(--app-coral, #c0292b)',
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[14px] border border-dashed border-[var(--app-line)] bg-white p-6 text-center text-[12.5px] text-[var(--app-copy-muted)]">
          불러오는 중...
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[var(--app-line)] bg-white p-6 text-center text-[12.5px] text-[var(--app-copy-muted)]">
          해당 상태의 후기가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <header className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 font-extrabold"
                    style={{
                      background:
                        review.moderationStatus === 'approved'
                          ? 'rgba(45,135,88,0.12)'
                          : review.moderationStatus === 'rejected'
                            ? 'rgba(255,79,79,0.12)'
                            : 'var(--app-pink-soft)',
                      color:
                        review.moderationStatus === 'approved'
                          ? 'var(--app-jade, #2d8758)'
                          : review.moderationStatus === 'rejected'
                            ? 'var(--app-coral, #c0292b)'
                            : 'var(--app-pink-strong)',
                    }}
                  >
                    {review.moderationStatus === 'approved'
                      ? '공개'
                      : review.moderationStatus === 'rejected'
                        ? '비공개'
                        : '심사 대기'}
                  </span>
                  <span className="font-bold text-[var(--app-copy-muted)]">
                    {review.productId} · {review.scopeKey}
                  </span>
                  <span className="font-bold text-[var(--app-pink-strong)]">★ {review.rating}</span>
                  {review.isVerifiedPurchase ? (
                    <span className="font-extrabold text-[var(--app-jade, #2d8758)]">
                      ✓ 구매 인증
                    </span>
                  ) : (
                    <span className="font-bold text-[var(--app-copy-muted)]">미인증</span>
                  )}
                </div>
                <span className="text-[var(--app-copy-muted)]">
                  {new Date(review.createdAt).toLocaleString('ko-KR')}
                </span>
              </header>
              <p
                className="mt-3 text-[13.5px] leading-[1.65] text-[var(--app-copy)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {review.content}
              </p>
              <footer className="mt-3 flex items-center justify-between gap-2 text-[11.5px]">
                <span className="font-bold text-[var(--app-copy-muted)]">
                  {review.displayName ?? '익명'}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => moderate(review.id, 'approve')}
                    disabled={actingId === review.id || review.moderationStatus === 'approved'}
                    className="rounded-full px-3 py-1.5 font-extrabold text-white disabled:opacity-50"
                    style={{ background: 'var(--app-jade, #2d8758)' }}
                  >
                    공개
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const note = window.prompt('비공개 사유 (선택):') ?? undefined;
                      moderate(review.id, 'reject', note ?? undefined);
                    }}
                    disabled={actingId === review.id || review.moderationStatus === 'rejected'}
                    className="rounded-full px-3 py-1.5 font-extrabold text-white disabled:opacity-50"
                    style={{ background: 'var(--app-coral, #c0292b)' }}
                  >
                    비공개
                  </button>
                </div>
              </footer>
              {review.moderationNote ? (
                <div className="mt-2 rounded-[8px] bg-[var(--app-pink-soft)]/50 px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-copy-muted)]">
                  메모: {review.moderationNote}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
