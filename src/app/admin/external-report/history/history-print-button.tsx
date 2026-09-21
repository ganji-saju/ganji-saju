'use client';

import { useEffect, useRef, useState } from 'react';

export function HistoryPrintButton({ subjectName }: { subjectName: string }) {
  const pending = useRef(false);
  const mounted = useRef(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function print() {
    if (pending.current) return;
    pending.current = true;
    setPrinting(true);
    setError('');
    const previousTitle = document.title;
    try {
      await document.fonts?.ready;
      if (!mounted.current) return;
      document.title = `간지사주_깊은사주풀이_${subjectName.replace(/[\\/:*?"<>|]/g, '').slice(0, 40)}`;
      window.print();
    } catch {
      if (mounted.current) setError('인쇄 창을 열지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted.current) {
        document.title = previousTitle;
        setPrinting(false);
      }
      pending.current = false;
    }
  }

  return (
    <div>
      <button type="button" onClick={print} disabled={printing}
        className="min-h-[42px] rounded-md bg-[var(--app-ink)] px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-50">
        {printing ? '인쇄 준비 중…' : 'PDF로 저장 · 인쇄'}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
