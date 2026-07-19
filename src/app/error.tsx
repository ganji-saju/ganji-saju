// 2026-05-14: 클라이언트 사이드 에러 바운더리. handoff 보드 `errors` 의 5xx 분기 구현.
// Next.js App Router 의 error.tsx 는 client component 여야 한다.
// PR6+ 디자인 언어 (pink-soft hero + 干 인장 + 친근체) 로 통일.
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, Home } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 운영에서 모니터링 도구가 자동으로 잡아가도록 console.error 로 남긴다.
    // Sentry/Vercel observability 가 잡아내는 표준 경로.
    // eslint-disable-next-line no-console
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div
      className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10"
      style={{ background: '#fff' }}
    >
      <article
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border p-6 text-center"
        style={{
          background: 'linear-gradient(180deg, #fdecec 0%, #fff 100%)',
          borderColor: 'rgba(198,69,69,0.22)',
          boxShadow: '0 22px 50px -28px rgba(198,69,69,0.22)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(198,69,69,0.16), transparent 70%)' }}
        />
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full text-[39.1px] font-extrabold"
          style={{
            background: '#fff',
            color: 'var(--app-coral)',
            border: '1px solid rgba(198,69,69,0.22)',
            fontFamily: 'var(--font-han)',
            boxShadow: '0 14px 28px rgba(198,69,69,0.16)',
          }}
        >
          !
        </div>
        <div
          className="mt-3 text-[12.6px] font-extrabold uppercase tracking-[0.06em]"
          style={{ color: 'var(--app-coral)' }}
        >
          잠시 끊겼어요
        </div>
        <h1
          className="mt-1 text-[25.3px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          화면을 그리는 중 문제가 생겼어요
        </h1>
        <p
          className="mt-2 text-[15px] leading-[1.7] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          데이터를 불러오거나 화면을 그리는 중 끊긴 것 같아요. 다시 시도하거나
          홈으로 돌아가서 다시 들어와 주세요.
        </p>

        {error?.digest ? (
          <p className="mt-2 text-[12.1px] font-mono text-[var(--app-copy-soft)]">
            오류 코드: {error.digest}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-[12px] bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            <RotateCcw className="h-4 w-4" />
            다시 시도하기
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-[12px] border bg-white px-5 text-[15px] font-extrabold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <Home className="h-4 w-4" />
            홈으로
          </Link>
        </div>
      </article>
    </div>
  );
}
