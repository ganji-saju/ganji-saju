// 2026-05-14: 404 not-found. handoff 보드 `errors` 의 일부 구현.
import Link from 'next/link';
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import SiteHeader from '@/features/shared-navigation/site-header';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  description: '요청하신 경로를 찾지 못했어요. 홈으로 돌아가세요.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <article
          className="relative overflow-hidden rounded-[20px] border p-6 text-center"
          style={{
            background: 'linear-gradient(180deg, var(--app-pink-soft) 0%, #fff 100%)',
            borderColor: 'var(--app-pink-line)',
            boxShadow: '0 22px 50px -28px rgba(216,27,114,0.22)',
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,79,154,0.18), transparent 70%)' }}
          />
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-full text-[36px] font-extrabold"
            style={{
              background: '#fff',
              color: 'var(--app-pink-strong)',
              border: '1px solid var(--app-pink-line)',
              fontFamily: 'var(--font-han)',
              boxShadow: '0 14px 28px rgba(216,27,114,0.16)',
            }}
            aria-hidden="true"
          >
            ?
          </div>
          <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            404 · 길을 잃었어요
          </div>
          <h1
            className="mt-1 text-[22px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            여긴 비어 있는 자리예요
          </h1>
          <p className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy-muted)]">
            주소가 바뀌었거나 사라진 페이지일 수 있어요. 홈에서 다시 시작해보세요.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              홈으로 →
            </Link>
            <Link
              href="/search"
              className="inline-flex h-12 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-extrabold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              검색해보기
            </Link>
          </div>
        </article>
      </AppPage>
    </AppShell>
  );
}
