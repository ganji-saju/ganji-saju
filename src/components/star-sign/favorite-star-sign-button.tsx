// 2026-05-16 PR #138 — 별자리 즐겨찾기 토글 버튼.
// /star-sign/[slug] 페이지의 hero 옆에 노출.
// 비로그인 사용자가 누르면 /login 으로 리다이렉트 (next 파라미터로 복귀).
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { StarSignSlug } from '@/lib/star-sign/sign-content';

interface Props {
  slug: StarSignSlug;
  /** 서버에서 미리 알고 있는 초기 follow 여부 (없으면 client 가 fetch). */
  initialFavorited?: boolean;
  /** 비로그인 상태 (서버 측에서 확정). */
  isAnonymous?: boolean;
}

export function FavoriteStarSignButton({
  slug,
  initialFavorited,
  isAnonymous,
}: Props) {
  const [favorited, setFavorited] = useState<boolean | null>(initialFavorited ?? null);
  const [pending, setPending] = useState(false);

  // initialFavorited 가 안 주어졌고 비로그인이 아니면 client fetch.
  useEffect(() => {
    if (favorited !== null || isAnonymous) return;
    let cancelled = false;
    fetch('/api/star-sign/favorites')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.ok) return;
        const list = (payload.favorites as string[]) ?? [];
        setFavorited(list.includes(slug));
      })
      .catch(() => {
        // silent
      });
    return () => {
      cancelled = true;
    };
  }, [favorited, isAnonymous, slug]);

  if (isAnonymous) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/star-sign/${slug}`)}`}
        className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-[13.2px] font-bold text-[var(--app-copy-muted)]"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <span aria-hidden="true">♡</span>
        로그인하고 즐겨찾기
      </Link>
    );
  }

  const handleToggle = async () => {
    if (pending) return;
    setPending(true);
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      const res = await fetch(`/api/star-sign/favorites/${slug}`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        setFavorited(!next); // rollback
      }
    } catch {
      setFavorited(!next);
    } finally {
      setPending(false);
    }
  };

  const isFavorited = favorited === true;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.2px] font-bold transition-transform active:scale-95 disabled:opacity-60"
      style={
        isFavorited
          ? {
              background: 'var(--app-pink)',
              color: 'white',
              borderColor: 'var(--app-pink)',
            }
          : {
              background: 'white',
              color: 'var(--app-pink-strong)',
              borderColor: 'var(--app-pink-line)',
            }
      }
      aria-pressed={isFavorited}
    >
      <span aria-hidden="true">{isFavorited ? '♥' : '♡'}</span>
      {isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
    </button>
  );
}
