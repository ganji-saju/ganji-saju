// 2026-05-18 Phase 7b — 공개 후기 표시 컴포넌트 (server component).
// 데이터 0건이면 'empty state' 노출 — 가짜 후기 절대 금지 (사용자 스펙).
import { listApprovedReviews } from '@/lib/reviews/queries';
import type { PublicReview } from '@/lib/reviews/types';

interface ReviewListProps {
  productId?: string;
  scopeKey?: string;
  limit?: number;
  // section heading kicker / title 커스텀.
  kicker?: string;
  title?: string;
  // 0건일 때 노출할 카피 커스텀.
  emptyTitle?: string;
  emptyDescription?: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span
      aria-label={`별점 ${rating}점`}
      className="text-[16.1px] leading-none"
      style={{ color: 'var(--app-pink-strong)' }}
    >
      {'★'.repeat(rating)}
      <span style={{ color: 'rgba(17,17,20,0.18)' }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <article
      className="rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StarRow rating={review.rating} />
          <span className="text-[12.1px] font-extrabold text-[var(--app-copy-muted)]">
            {review.rating}.0
          </span>
        </div>
        {review.isVerifiedPurchase ? (
          <span
            className="inline-flex items-center gap-1 rounded-[12px] px-2 py-0.5 text-[11.5px] font-extrabold"
            style={{
              background: 'var(--app-pink-soft)',
              color: 'var(--app-pink-strong)',
            }}
          >
            ✓ 구매 인증
          </span>
        ) : null}
      </header>
      <p
        className="mt-3 text-[15px] leading-[1.65] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {review.content}
      </p>
      <footer className="mt-3 flex items-center gap-1.5 text-[12.6px] text-[var(--app-copy-muted)]">
        <span className="font-bold">{review.displayName}</span>
        <span>·</span>
        <span>{formatDate(review.createdAt)}</span>
      </footer>
    </article>
  );
}

export async function ReviewList({
  productId,
  scopeKey,
  limit = 10,
  kicker = '구매자 후기',
  title = '실제 구매자의 후기',
  emptyTitle = '아직 공개된 후기가 없어요',
  emptyDescription = '구매하신 분들의 솔직한 이야기를 받고 있어요. 첫 후기가 등록되면 이 자리에 표시됩니다.',
}: ReviewListProps) {
  const { reviews, total } = await listApprovedReviews({
    productId,
    scopeKey,
    limit,
  });

  return (
    <section className="space-y-3 px-1">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div
            className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
            style={{ color: 'var(--app-pink-strong)' }}
          >
            {kicker}
          </div>
          <h2 className="mt-1 text-[20.7px] font-extrabold text-[var(--app-ink)]">{title}</h2>
        </div>
        {total > 0 ? (
          <span className="text-[12.6px] font-extrabold text-[var(--app-copy-muted)]">
            총 {total}건
          </span>
        ) : null}
      </div>

      {reviews.length === 0 ? (
        <article
          className="rounded-[16px] border border-dashed p-6 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[16.1px] font-extrabold text-[var(--app-ink)]">{emptyTitle}</div>
          <p
            className="mt-1.5 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {emptyDescription}
          </p>
        </article>
      ) : (
        <div className="grid gap-2.5">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </section>
  );
}
