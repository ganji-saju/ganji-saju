// 2026-05-15 — 궁합 entry 페이지 (관계 선택) 디자인 통일.
// 이전엔 PageHero + SectionSurface + ProductGrid + FeatureCard (옛 marketing 컴포넌트).
// 사주 결과·오늘운세 등 다른 sub-page 와 어긋남.
// 새 디자인: pink-soft hero + 1열 stacked 관계 카드 + ink-dark CTA.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '궁합',
  description: '연인, 배우자, 부모자녀, 가족과의 궁합을 관계별 질문으로 살펴보는 궁합 페이지입니다.',
  alternates: { canonical: '/compatibility' },
};

const RELATIONSHIP_TONES: Record<
  string,
  {
    icon: string;
    badge: string;
    accent: string;
    soft: string;
    line: string;
  }
> = {
  lover: {
    icon: '💕',
    badge: '연인·배우자',
    accent: 'var(--app-coral)',
    soft: 'rgba(220,79,79,0.08)',
    line: 'rgba(220,79,79,0.22)',
  },
  family: {
    icon: '🌿',
    badge: '부모·자녀',
    accent: 'var(--app-jade)',
    soft: 'rgba(45,135,88,0.08)',
    line: 'rgba(45,135,88,0.22)',
  },
  friend: {
    icon: '🌊',
    badge: '형제·친구',
    accent: 'var(--app-sky)',
    soft: 'rgba(55,142,232,0.08)',
    line: 'rgba(55,142,232,0.22)',
  },
  partner: {
    icon: '✦',
    badge: '동업·파트너',
    accent: 'var(--app-amber)',
    soft: '#fdf6e7',
    line: 'rgba(184,122,20,0.22)',
  },
};

export default function CompatibilityPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="궁합 보기" backHref="/" />

        <section className="space-y-5 px-1">
          {/* §1 Hero — pink-soft */}
          <article
            className="rounded-[18px] border p-5"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              관계 풀이 입구
            </div>
            <h1
              className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              어떤 관계의 흐름이
              <br />
              궁금하신가요?
            </h1>
            <p
              className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              연인·가족·친구·동업 중 지금 가장 마음에 걸리는 관계를 먼저 골라
              주세요. 질문이 분명할수록 풀이도 더 또렷합니다.
            </p>
          </article>

          {/* §2 관계 선택 — 1열 stacked 카드 (긴 hook 텍스트라 1열이 가독성 ↑) */}
          <section>
            <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              관계 선택
            </h2>
            <div className="mt-2 grid gap-2.5">
              {COMPATIBILITY_RELATIONSHIPS.map((item) => {
                const tone = RELATIONSHIP_TONES[item.slug];
                return (
                  <Link
                    key={item.slug}
                    href={`/compatibility/input?relationship=${item.slug}`}
                    className="flex items-start gap-3 rounded-[16px] border bg-white p-4 transition-transform active:scale-[0.98]"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[26px]"
                      style={{
                        background: tone?.soft ?? 'var(--app-pink-soft)',
                        border: `1px solid ${tone?.line ?? 'var(--app-pink-line)'}`,
                      }}
                      aria-hidden="true"
                    >
                      {tone?.icon ?? item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                        style={{ color: tone?.accent ?? 'var(--app-pink-strong)' }}
                      >
                        {tone?.badge ?? item.title}
                      </div>
                      <div
                        className="mt-1 text-[15.5px] font-extrabold leading-snug text-[var(--app-ink)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {item.hook}
                      </div>
                      <div
                        className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {item.title}
                      </div>
                    </div>
                    <span
                      className="mt-1 shrink-0 text-[var(--app-copy-soft)]"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* §3 가격 안내 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              💡 어떻게 진행되나요?
            </div>
            <ul
              className="mt-2 grid gap-1.5 text-[12px] leading-[1.65] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 font-extrabold text-[var(--app-pink-strong)]">①</span>
                <span><strong>관계 선택</strong> — 어떤 관계의 흐름을 볼지 결정</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 font-extrabold text-[var(--app-pink-strong)]">②</span>
                <span><strong>두 사람 정보 입력</strong> — 내 사주 + 상대 사주 (저장한 가족이면 클릭으로 자동 채움)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 font-extrabold text-[var(--app-pink-strong)]">③</span>
                <span><strong>궁합 점수 + 4축 분석</strong> — 닮은 결 / 어긋난 결 / 좋은 시기 / 조심할 흐름</span>
              </li>
            </ul>
          </article>

          {/* §4 Premium upsell — ink-dark */}
          <article
            className="rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              VIP · PREMIUM
            </div>
            <h2 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-tight">
              두 사람의 결이 어디서 닮고
              <br />
              어디서 어긋나는지
            </h2>
            <p
              className="mt-2 text-[12.5px] leading-[1.6]"
              style={{ opacity: 0.72 }}
            >
              풀이 형태로 깊이 정리합니다. 멤버십 가입 시 무제한 궁합 분석.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href="/membership"
                className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                멤버십으로 무제한 열기 →
              </Link>
              <Link
                href="/compatibility/input?relationship=lover"
                className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
              >
                먼저 한 번 보기
              </Link>
            </div>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
