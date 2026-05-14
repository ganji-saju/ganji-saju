// 2026-05-15 handoff PR-H: 보드 `lock-screen` (18-0) SHELL 라우트.
// 실제 PWA OS lockscreen 푸시 위젯은 manifest + service worker 영역이라 web 상에서는
// visual shell 만 제공. handoff `source/04_FUTURE_PAGE_IMPLEMENTATION_GUIDE.md` 의
// SHELL 정의: visual route + mock data + disabled 액션 + "준비 중" badge.
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export const metadata: Metadata = {
  title: '락스크린 위젯 (준비 중)',
  description: '간지사주 락스크린 푸시 위젯 — 모바일 잠금 화면에서 오늘 흐름을 미리 볼 수 있는 기능 프리뷰입니다.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/lock-screen' },
};

const MOCK_LOCK_PREVIEWS = [
  {
    time: '오전 7:00',
    title: '오늘 흐름 한 줄',
    body: '오늘은 천천히 확인하면 풀리는 날이에요. 작은 정리부터 시작해보세요.',
  },
  {
    time: '오후 1:30',
    title: '컨디션 신호',
    body: '한 박자 쉬고 다음 일을 잡으세요. 점심 후 짧은 산책 권장.',
  },
  {
    time: '오후 9:00',
    title: '내일 미리 보기',
    body: '내일 일진은 작은 결정이 잘 풀리는 결입니다. 핵심 한 줄을 적어두세요.',
  },
];

export default function LockScreenShellPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="락스크린 위젯" backHref="/my" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-white"
              style={{ background: 'var(--app-amber)' }}
            >
              준비 중
            </span>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              락스크린 푸시 위젯
            </div>
          </div>
          <h1
            className="mt-2 text-[20px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            잠금 화면에서 오늘 흐름을 바로 보는 위젯
          </h1>
          <p
            className="mt-2 text-[12.5px] leading-[1.7] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            지금은 시안만 보여드리고 있어요. 실제 잠금 화면 위젯은 모바일 앱(PWA) 전환과 함께 열릴 예정입니다.
          </p>
        </article>

        <section className="grid gap-2.5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
            미리 보기
          </h2>
          {MOCK_LOCK_PREVIEWS.map((item) => (
            <article
              key={item.time}
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--app-copy-soft)]">
                  {item.time}
                </span>
                <span className="text-[11px] font-extrabold text-[var(--app-pink-strong)]">
                  · 간지사주
                </span>
              </div>
              <div className="mt-1.5 text-[14px] font-extrabold text-[var(--app-ink)]">
                {item.title}
              </div>
              <p
                className="mt-1 text-[12.5px] leading-[1.6] text-[var(--app-copy)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {item.body}
              </p>
            </article>
          ))}
        </section>

        <article
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
            기능 안내
          </div>
          <ul className="mt-2 grid gap-1.5 text-[12.5px] leading-[1.55] text-[var(--app-copy)]" style={{ wordBreak: 'keep-all' }}>
            <li>· 매일 아침 7시 · 오후 1시 · 저녁 9시 푸시 (사용자 설정 변경 가능)</li>
            <li>· 잠금 화면에서 한 줄 요약만 노출 — 민감 정보 없음</li>
            <li>· iOS Safari PWA, Android Chrome PWA 양쪽 지원 예정</li>
          </ul>
          <button
            type="button"
            disabled
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--app-copy-soft)] px-5 text-[13px] font-extrabold text-white opacity-60"
            aria-disabled="true"
          >
            위젯 켜기 (준비 중)
          </button>
        </article>
      </AppPage>
    </AppShell>
  );
}
