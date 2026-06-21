'use client';

import { useEffect, useRef } from 'react';
import type { TarotSpreadPick } from '@/lib/tarot-api';

// 2026-06-21 — 3장 스프레드 결과 보관함 저장 트리거. 스프레드 페이지 마운트 시 1회 POST.
//   단일카드 saver와 동일하게 비차단·멱등(서버에서 user_id+scope_key upsert). 렌더 출력 없음.
export function TarotSpreadSnapshotSaver({
  question,
  picks,
}: {
  question: string;
  picks: TarotSpreadPick[];
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current || picks.length < 3) return;
    sentRef.current = true;
    void fetch('/api/tarot/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, picks }),
      keepalive: true,
    }).catch(() => {
      // 비차단 — 보관 실패해도 결과 화면은 정상.
    });
  }, [question, picks]);

  return null;
}
