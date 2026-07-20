// Redesign 2026-05-17 — design token + inline + Tailwind utility (이미 적용 상태).
// 대운 hub: 사주 입력 안내 + 대운 예시. sibling /saju/[slug]/deep (PR #204) 와 시각 통일.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { StickyBottomBar } from '@/components/ui/sticky-bottom-bar';
import { ComparePrice, Price } from '@/components/payments/price-provider';
import { AppShell } from '@/shared/layout/app-shell';
import {
  GangiIntro,
  GangiMetricBar,
  GangiPageHeader,
} from '@/components/gangi/gangi-ui';

export const metadata: Metadata = {
  title: '대운 풀이 — 10년 대운 · 올해 흐름',
  description:
    '내 사주의 10년 대운 흐름과 올해 진행하기 좋은 달을 확인하세요. 생년월일로 보는 명리 기반 대운 풀이입니다.',
  alternates: { canonical: '/daewoon' },
};

const PERIODS = [
  { age: '20대', years: '20-29세', title: '탐색기', desc: '방향을 잡는 시간', score: 65, color: '#94c094' },
  { age: '30대', years: '30-39세', title: '성장기', desc: '기반을 다지는 시간', score: 78, color: '#6db0c4' },
  { age: '40대', years: '40-49세', title: '전환기', desc: '큰 흐름이 바뀌는 시간', score: 88, color: '#e89a8a', current: true },
  { age: '50대', years: '50-59세', title: '수확기', desc: '결실이 이어지는 시간', score: 82, color: '#d49a3a' },
  { age: '60대', years: '60-69세', title: '정리기', desc: '나누고 정리하는 시간', score: 70, color: '#ecd2a5' },
] satisfies Array<{
  age: string;
  years: string;
  title: string;
  desc: string;
  score: number;
  color: string;
  current?: boolean;
}>;

export default function DaewoonPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <div className="gangi-subpage">
        <GangiPageHeader title="대운" />
        <GangiIntro
          eyebrow="10년 흐름"
          title={
            <>
              앞으로의 흐름을
              <br />
              한눈에 봐요
            </>
          }
          description="정확한 풀이는 생년월일 입력 뒤 열립니다. 여기서는 어떤 방식으로 보여드릴지 먼저 확인하세요."
        />

        <section className="px-5 pb-6">
          <div className="gangi-pink-panel p-5">
            <p className="gangi-sub-eyebrow mb-0">현재 흐름 예시</p>
            <h2 className="mt-3 text-[1.35rem] font-bold leading-snug text-[var(--app-ink)]">
              지금은 큰 흐름이
              <br />
              바뀌는 전환기예요
            </h2>
            <p className="mt-2 text-base font-medium leading-6 text-[rgba(17,17,20,0.64)]">
              실제 결과에서는 내 생년월일 정보로 현재 대운과 올해 흐름을 이어서 보여드립니다.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {PERIODS.map((period) => (
              <article
                key={period.age}
                className={`gangi-card-panel p-4 ${period.current ? 'border-[var(--app-pink)] bg-[var(--app-pink-soft)]' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <strong className="text-base font-bold text-[var(--app-ink)]">{period.age}</strong>
                    <span className="ml-2 text-sm font-medium text-[var(--app-copy-muted)]">{period.years}</span>
                    {period.current ? (
                      <span className="ml-2 rounded-[12px] bg-[var(--app-pink)] px-2 py-0.5 text-[11.5px] font-bold text-white">
                        NOW
                      </span>
                    ) : null}
                  </div>
                  <span className="text-base font-bold" style={{ color: period.color }}>
                    {period.score}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold">{period.title}</h3>
                <p className="mt-1 text-sm font-medium text-[rgba(17,17,20,0.64)]">{period.desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 gangi-card-panel p-4">
            <GangiMetricBar label="올해 움직임" value={88} color="#e6549a" />
          </div>

          <Link href="/saju/new?focus=year&product=year-core" className="mt-5 flex h-12 items-center justify-center rounded-[0.9rem] bg-[var(--app-pink)] text-base font-bold text-white">
            내 생년월일로 올해 흐름 보기
          </Link>

          {/* 2026-07-20 — 결제 CTA 를 하단에 상시 노출(사용자 요청).
              페이지가 길어 스크롤 중엔 위 CTA 가 화면 밖으로 나간다.
              ⚠️ 그냥 fixed 금지 — 상위 transform 이 containing block 을 가로챈다.
              StickyBottomBar 가 body portal + dock 높이 실측을 처리한다. */}
          <StickyBottomBar
            variant="above-dock"
            revealOn="scroll-down"
            innerClassName="flex items-center gap-3"
          >
            <span className="flex shrink-0 items-baseline gap-1.5">
              <ComparePrice
                priceKey="taste_year_core"
                className="whitespace-nowrap text-[12.6px] font-bold text-[var(--app-copy-soft)] line-through"
              />
              <span className="whitespace-nowrap text-[17px] font-extrabold text-[var(--app-pink-strong)]">
                <Price priceKey="taste_year_core" />
              </span>
            </span>
            <Link
              href="/saju/new?focus=year&product=year-core"
              className="inline-flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-[12px] bg-[var(--app-pink)] px-4 text-[16.1px] font-extrabold text-white no-underline shadow-[0_10px_24px_rgba(216,27,114,0.30)]"
            >
              올해 흐름 보기
            </Link>
          </StickyBottomBar>

          {/* 2026-07-19 — 하단 추천을 8개 메뉴 전 화면에 동일 노출(사용자 요청).
              from="daewoon" 이 목록에서 대운 자신을 제외한다. */}
          <PaidFunnelGrid from="daewoon" tone="light" className="mt-6" />
        </section>
      </div>
    </AppShell>
  );
}
