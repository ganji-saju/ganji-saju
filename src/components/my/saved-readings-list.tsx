'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GangiCharacter, type GangiZodiacKey } from '@/components/gangi/gangi-ui';
import type { AccountReading } from '@/lib/account';

interface SavedReadingsListProps {
  readings: AccountReading[];
  totalCount: number;
  visibleStartIndex?: number;
}

interface DeleteReadingResponse {
  success?: boolean;
  readingCount?: number;
  error?: string;
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatShortCreatedAt(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
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

const ZODIAC_BY_YEAR_MOD: GangiZodiacKey[] = [
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

function getDisplayZodiac(reading: AccountReading): GangiZodiacKey {
  return ZODIAC_BY_YEAR_MOD[((reading.birthYear % 12) + 12) % 12] ?? 'rooster';
}

export default function SavedReadingsList({
  readings,
  totalCount,
  visibleStartIndex = 1,
}: SavedReadingsListProps) {
  const router = useRouter();
  const [items, setItems] = useState(readings);
  const [count, setCount] = useState(totalCount);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const visibleRangeLabel =
    items.length > 0
      ? `${visibleStartIndex}~${visibleStartIndex + items.length - 1}번째`
      : '현재 페이지 비어 있음';

  async function deleteReading(id: string) {
    const confirmed = window.confirm('이 결과를 보관함에서 삭제할까요? 삭제 후에는 복구할 수 없습니다.');
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
      setMessage('결과보관함에서 삭제했습니다. 서버 기준 저장 개수도 함께 갱신했습니다.');
      router.refresh();
    } catch {
      setMessage('삭제 중 네트워크 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="gangi-vault-summary">
        <span>전체 {count}개</span>
        <strong>{visibleRangeLabel}</strong>
      </div>

      {message ? (
        <div className="rounded-[1.35rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-4 py-3 text-sm font-black text-[var(--app-pink-strong)]">
          {message}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[1.6rem] border border-dashed border-[var(--app-line)] bg-white p-7 text-sm leading-7 text-[var(--app-copy-muted)]">
          {count > 0
            ? '현재 페이지의 결과를 모두 삭제했습니다.'
            : '아직 저장된 풀이가 없습니다.'}
        </div>
      ) : (
        <div className="gangi-vault-list">
          {items.map((reading) => (
            <article key={reading.id} className="gangi-vault-item">
              <Link
                href={`/saju/${reading.id}`}
                className="gangi-vault-link"
              >
                <GangiCharacter zodiac={getDisplayZodiac(reading)} />
                <span className="gangi-vault-copy">
                  <em>사주 · {formatShortCreatedAt(reading.createdAt)}</em>
                  <strong>{reading.birthMonth}월 {reading.birthDay}일 풀이</strong>
                  <small>{formatBirthLabel(reading)}</small>
                </span>
                <span className="gangi-vault-arrow" aria-hidden="true">›</span>
              </Link>

              <div className="gangi-vault-actions">
                <button
                  type="button"
                  disabled={deletingId === reading.id}
                  onClick={() => deleteReading(reading.id)}
                  className="gangi-vault-delete"
                >
                  {deletingId === reading.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
