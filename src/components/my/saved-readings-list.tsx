// Redesign 2026-05-13 (Claude Design / screens-d.jsx ScreenVaultDetail):
// 보관함 카드 — ZodiacChip(md) + 날짜·태그·제목·요약 + quick actions
// (즐겨찾기 / 공유 / 다시 보기). 데이터·라우팅·삭제 API 무수정.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { ReviewWriteDialog } from '@/components/review/review-write-dialog';
import type { AccountPurchasedResult, AccountReading } from '@/lib/account';
import type { Review, ReviewModerationStatus } from '@/lib/reviews/types';

interface ReviewKey {
  productId: string;
  scopeKey: string;
}
function reviewKey(item: ReviewKey) {
  return `${item.productId}__${item.scopeKey}`;
}

interface SavedReadingsListProps {
  readings: AccountReading[];
  purchasedResults?: AccountPurchasedResult[];
  totalCount: number;
  visibleStartIndex?: number;
}

interface DeleteReadingResponse {
  success?: boolean;
  readingCount?: number;
  error?: string;
}

function formatShortCreatedAt(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatTimeOfDay(value: string) {
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatBirthLabel(reading: AccountReading) {
  const hourLabel = reading.birthHour === null ? '시간 미입력' : `${reading.birthHour}시`;
  const genderLabel =
    reading.gender === 'male'
      ? '남성'
      : reading.gender === 'female'
        ? '여성'
        : '성별 미선택';

  return `${reading.birthYear}.${reading.birthMonth}.${reading.birthDay} · ${hourLabel} · ${genderLabel}`;
}

const ZODIAC_BY_YEAR_MOD: ZodiacKey[] = [
  'monkey',
  'rooster',
  'dog',
  'pig',
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'sheep',
];

function getDisplayZodiac(reading: AccountReading): ZodiacKey {
  return ZODIAC_BY_YEAR_MOD[((reading.birthYear % 12) + 12) % 12] ?? 'rooster';
}

type VaultTag = 'NEW' | 'PAID' | 'VIP' | null;

function getTagForReading(_reading: AccountReading): VaultTag {
  // 데이터에 tag 구분이 없어 일단 null. 추후 purchased 여부에 따라 PAID/VIP 매핑 가능.
  return null;
}

function getTagForPurchased(item: AccountPurchasedResult): VaultTag {
  if (item.title?.includes('VIP') || item.title?.includes('평생')) return 'VIP';
  return 'PAID';
}

function TagBadge({ tag }: { tag: VaultTag }) {
  if (!tag) return null;
  const style =
    tag === 'VIP'
      ? { background: 'var(--app-ink)', color: '#fff' }
      : tag === 'NEW'
        ? { background: 'var(--app-pink)', color: '#fff' }
        : { background: 'var(--app-pink-soft)', color: 'var(--app-pink-strong)' };
  return (
    <span
      className="rounded-[4px] px-1.5 py-0.5 text-[10.9px] font-extrabold tracking-[0.04em]"
      style={style}
    >
      {tag}
    </span>
  );
}

function statusLabel(status: ReviewModerationStatus): string {
  if (status === 'approved') return '공개됨';
  if (status === 'pending') return '심사 중';
  return '비공개';
}

export default function SavedReadingsList({
  readings,
  purchasedResults = [],
  totalCount,
  visibleStartIndex = 1,
}: SavedReadingsListProps) {
  const router = useRouter();
  const [items, setItems] = useState(readings);
  const [count, setCount] = useState(totalCount);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // 2026-05-18 Phase 7b — 본인 후기 map (productId+scopeKey → Review).
  const [reviewByKey, setReviewByKey] = useState<Record<string, Review>>({});
  const [reviewDialog, setReviewDialog] = useState<
    | {
        productId: string;
        scopeKey: string;
        productTitle: string;
        existing: Review | null;
      }
    | null
  >(null);

  useEffect(() => {
    if (purchasedResults.length === 0) return;
    let cancelled = false;
    fetch('/api/reviews/mine', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.reviews)) {
          const map: Record<string, Review> = {};
          for (const review of data.reviews as Review[]) {
            map[reviewKey({ productId: review.productId, scopeKey: review.scopeKey })] = review;
          }
          setReviewByKey(map);
        }
      })
      .catch(() => {
        /* 실패해도 페이지는 정상 동작 */
      });
    return () => {
      cancelled = true;
    };
  }, [purchasedResults.length]);

  async function deleteReading(id: string) {
    const confirmed = window.confirm(
      '이 결과를 보관함에서 삭제할까요? 삭제 후에는 복구할 수 없습니다.'
    );
    if (!confirmed) return;

    setDeletingId(id);
    setMessage('');

    try {
      const response = await fetch('/api/readings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json().catch(() => null)) as DeleteReadingResponse | null;

      if (!response.ok) {
        setMessage(data?.error ?? '결과를 삭제하지 못했습니다.');
        return;
      }

      setItems((current) => current.filter((reading) => reading.id !== id));
      setCount((current) =>
        typeof data?.readingCount === 'number' ? data.readingCount : Math.max(0, current - 1)
      );
      setMessage('보관함에서 삭제했습니다.');
      router.refresh();
    } catch {
      setMessage('삭제 중 네트워크 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  const totalVisibleCount = count + purchasedResults.length;
  const visibleRangeLabel =
    items.length > 0
      ? `${visibleStartIndex}~${visibleStartIndex + items.length - 1}번째`
      : purchasedResults.length > 0
        ? `결제 풀이 ${purchasedResults.length}개`
        : '현재 페이지 비어 있음';

  const isEmpty = items.length === 0 && purchasedResults.length === 0;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between rounded-[12px] bg-[var(--app-pink-soft)]/40 px-3.5 py-2.5 text-[13.8px]">
        <span className="font-bold text-[var(--app-copy-soft)]">
          전체 {totalVisibleCount}개
        </span>
        <span className="text-[13.2px] text-[var(--app-copy-muted)]">{visibleRangeLabel}</span>
      </div>

      {message ? (
        <div
          className="rounded-[12px] border px-3.5 py-2.5 text-[14.4px] font-bold"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
            color: 'var(--app-pink-strong)',
          }}
        >
          {message}
        </div>
      ) : null}

      {isEmpty ? (
        <article className="rounded-[16px] border border-dashed border-[var(--app-line)] bg-white p-7 text-center">
          <div className="mx-auto inline-flex">
            <ZodiacChip kind="snake" size="lg" />
          </div>
          <div className="mt-3 text-[16.1px] font-extrabold text-[var(--app-ink)]">
            아직 저장된 풀이가 없어요
          </div>
          <p className="mt-1 text-[13.8px] leading-[1.55] text-[var(--app-copy-muted)]">
            {count > 0
              ? '현재 페이지의 결과를 모두 삭제했습니다.'
              : '사주를 본 뒤 보관함에서 다시 확인할 수 있습니다.'}
          </p>
        </article>
      ) : (
        <div className="grid gap-3">
          {purchasedResults.map((item) => {
            const tag = getTagForPurchased(item);
            const existingReview =
              reviewByKey[reviewKey({ productId: item.productId, scopeKey: item.scopeKey })] ??
              null;
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-[16px] border border-[var(--app-line)] bg-white"
              >
                <Link href={item.href} className="flex items-start gap-3 p-3.5">
                  <ZodiacChip kind="rabbit" size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12.1px] text-[var(--app-copy-soft)]">
                      <span>{item.occurredOn ?? formatShortCreatedAt(item.createdAt)}</span>
                      <span>·</span>
                      <span>{formatTimeOfDay(item.createdAt)}</span>
                      <TagBadge tag={tag} />
                    </div>
                    <div className="mt-1 text-[16.7px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {item.title}
                    </div>
                    <p className="mt-1 text-[13.8px] leading-[1.5] text-[var(--app-copy-muted)] line-clamp-2">
                      {item.summary ?? '구매 당시 풀이를 다시 엽니다.'}
                    </p>
                  </div>
                </Link>
                {/* 2026-07-03 공유 전수감사 — onClick 없는 죽은 "↗ 공유" 버튼 제거(grid 3→2).
                    구매 상품 href 는 입력 페이지(/compatibility/input 등)인 경우가 있어
                    공유 대상 URL 로 부적합 — 상품별 공유 경로가 정리되면 재도입. */}
                <div className="grid grid-cols-2 gap-1 border-t border-[var(--app-line)] p-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setReviewDialog({
                        productId: item.productId,
                        scopeKey: item.scopeKey,
                        productTitle: item.title,
                        existing: existingReview,
                      })
                    }
                    className="h-8 rounded-[8px] text-[13.8px] font-bold text-[var(--app-copy-muted)] transition hover:bg-[var(--app-pink-soft)]"
                  >
                    {existingReview
                      ? `✎ 후기 · ${statusLabel(existingReview.moderationStatus)}`
                      : '✎ 후기 작성'}
                  </button>
                  <Link
                    href={item.href}
                    className="grid h-8 place-items-center rounded-[8px] text-[13.8px] font-extrabold text-[var(--app-pink-strong)]"
                    style={{ background: 'var(--app-pink-soft)' }}
                  >
                    다시 보기 →
                  </Link>
                </div>
              </article>
            );
          })}

          {items.map((reading) => {
            const tag = getTagForReading(reading);
            return (
              <article
                key={reading.id}
                className="overflow-hidden rounded-[16px] border border-[var(--app-line)] bg-white"
              >
                <Link href={`/saju/${reading.id}`} className="flex items-start gap-3 p-3.5">
                  <ZodiacChip kind={getDisplayZodiac(reading)} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12.1px] text-[var(--app-copy-soft)]">
                      <span>{formatShortCreatedAt(reading.createdAt)}</span>
                      <span>·</span>
                      <span>{formatTimeOfDay(reading.createdAt)}</span>
                      <TagBadge tag={tag} />
                    </div>
                    <div className="mt-1 text-[16.7px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {reading.birthMonth}월 {reading.birthDay}일 풀이
                    </div>
                    <p className="mt-1 text-[13.8px] leading-[1.5] text-[var(--app-copy-muted)] line-clamp-2">
                      {formatBirthLabel(reading)}
                    </p>
                  </div>
                </Link>
                <div className="grid grid-cols-3 gap-1 border-t border-[var(--app-line)] p-1.5">
                  <button
                    type="button"
                    onClick={() => deleteReading(reading.id)}
                    disabled={deletingId === reading.id}
                    className="h-8 rounded-[8px] text-[13.8px] font-bold text-[var(--app-copy-muted)] transition hover:bg-[var(--app-coral)]/10 disabled:opacity-60"
                  >
                    {deletingId === reading.id ? '삭제 중...' : '🗑 삭제'}
                  </button>
                  <Link
                    href={`/saju/${reading.id}/share`}
                    className="grid h-8 place-items-center rounded-[8px] text-[13.8px] font-bold text-[var(--app-copy-muted)] transition hover:bg-[var(--app-pink-soft)]"
                  >
                    ↗ 공유
                  </Link>
                  <Link
                    href={`/saju/${reading.id}`}
                    className="grid h-8 place-items-center rounded-[8px] text-[13.8px] font-extrabold text-[var(--app-pink-strong)]"
                    style={{ background: 'var(--app-pink-soft)' }}
                  >
                    다시 보기 →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ReviewWriteDialog
        open={reviewDialog !== null}
        productId={reviewDialog?.productId ?? ''}
        scopeKey={reviewDialog?.scopeKey ?? 'global'}
        productTitle={reviewDialog?.productTitle ?? ''}
        existing={reviewDialog?.existing ?? null}
        onClose={() => setReviewDialog(null)}
        onSuccess={(review) => {
          setReviewByKey((prev) => ({
            ...prev,
            [reviewKey({ productId: review.productId, scopeKey: review.scopeKey })]: review,
          }));
          setMessage(
            review.moderationStatus === 'approved'
              ? '후기가 공개되었습니다.'
              : '후기가 등록되었습니다. 검수 후 공개됩니다.'
          );
        }}
      />
    </div>
  );
}
