'use client';

import { useEffect, useRef } from 'react';

// 2026-06-05 — 타로 결과 보관함 저장 트리거. 결과 페이지가 실제로 마운트될 때 1회 POST.
//   server 컴포넌트 render-side-effect(특히 Link prefetch 오발동)를 피하려 client 마운트에서 호출.
//   저장 실패는 조용히 무시 — 결과 열람에는 영향 없음. 렌더 출력 없음.
export function TarotSnapshotSaver({
  question,
  cardId,
  orientation,
}: {
  question: string;
  cardId: string;
  orientation: string;
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current || !cardId) return;
    sentRef.current = true;
    void fetch('/api/tarot/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, cardId, orientation }),
      keepalive: true,
    }).catch(() => {
      // 비차단 — 보관 실패해도 결과 화면은 정상.
    });
  }, [question, cardId, orientation]);

  return null;
}
