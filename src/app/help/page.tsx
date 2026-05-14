// 2026-05-14: 고객센터 SHELL.
// 실제 1:1 ticket / FAQ DB 미구현. 외부 채널(전화/카카오)만 안내.
// future-pages/help-center.md 의 contract 에 따라 추후 확장.
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';

export const metadata: Metadata = {
  title: '고객센터',
  description: '결제·계정·풀이 관련 문의는 카카오/전화 채널로 받습니다.',
  alternates: { canonical: '/help' },
  robots: { index: false, follow: false },
};

const FAQ: Array<{ category: string; q: string; a: string }> = [
  {
    category: '결제',
    q: '결제했는데 또 결제하라고 나와요',
    a: '같은 사주를 다시 만들면 권한이 다른 식별자에 묶일 수 있어요. 사주를 새로 만들지 말고 보관함의 기존 사주로 들어가 주시면 권한이 인식됩니다. 그래도 계속 보이면 결제내역 화면(/my/billing)에서 확인 후 카카오로 문의 주세요.',
  },
  {
    category: '계정',
    q: '회원탈퇴는 어떻게 하나요?',
    a: 'MY → 설정 → 회원탈퇴 흐름에서 3단계(이유 확인 → 손실 확인 → "탈퇴합니다" 입력)로 진행됩니다. 결제 내역은 전자상거래법에 따라 5년간 보관됩니다.',
  },
  {
    category: '풀이',
    q: '용신은 어떻게 정해지나요?',
    a: '오행 균형 + 강약(신강/신약) + 계절 보정 3가지 기준을 종합해 1순위 도움 기운을 잡습니다. 화면의 "왜 그런지 보기" 를 펼치면 근거 데이터를 확인할 수 있어요.',
  },
];

export default function HelpCenterShellPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="고객센터" backHref="/" />

        {/* §SHELL 안내 */}
        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--app-pink-strong)]"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              ✦ 준비 중
            </span>
          </div>
          <h1
            className="mt-2 text-[20px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            지금은 카카오/전화로 받아드려요
          </h1>
          <p className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy-muted)]">
            1:1 문의 시스템은 아직 개발 중이에요. 급한 일은 아래 채널로 바로 보내주시면 빠르게 답변드립니다.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a
              href="tel:010-8123-9184"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              ☎ 010-8123-9184
            </a>
            <Link
              href="/dialogue"
              className="inline-flex h-12 items-center justify-center rounded-full border bg-white px-5 text-[13px] font-extrabold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              풀이 관련 질문은 대화방
            </Link>
          </div>
        </article>

        {/* §FAQ */}
        <section>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            자주 묻는 질문
          </div>
          <h2 className="mt-1 text-[16px] font-extrabold text-[var(--app-ink)]">
            많이 받는 질문 3가지
          </h2>
          <div className="mt-3 grid gap-2">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-[14px] border bg-white"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                      {item.category}
                    </span>
                    <span
                      className="mt-0.5 block text-[13.5px] font-extrabold text-[var(--app-ink)]"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      Q. {item.q}
                    </span>
                  </span>
                  <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden="true">▼</span>
                </summary>
                <p
                  className="border-t border-[var(--app-line)] px-4 py-3 text-[12.5px] leading-[1.7] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* §회사 정보 */}
        <article
          className="rounded-[14px] border bg-white p-4 text-[11.5px] leading-[1.7] text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            회사 정보
          </div>
          <div className="mt-1.5">푸꼬컴퍼니 · 대표 김재호</div>
          <div>사업자등록번호 215-27-64715</div>
          <div>서울특별시 중랑구 동일로 909, 3층 301호 일부호(묵동)</div>
        </article>
      </AppPage>
    </AppShell>
  );
}
