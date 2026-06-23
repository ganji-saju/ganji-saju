// 2026-05-14: 배너 시스템 showcase. handoff 보드 `banners` (24 · 배너 7종).
// 운영 노출 X (robots disallow /admin).
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiBanner } from '@/components/gangi/gangi-banner';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';

export const metadata: Metadata = {
  title: '배너 시스템 · 7종',
  description: '간지사주 리디자인 배너 7가지 variant 의 통합 showcase.',
  robots: { index: false, follow: false },
};

export default function BannersShowcasePage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-4">
        <GangiPageHeader title="배너 시스템 · 7종" backHref="/admin/design/motion" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            design QA · 운영 노출 X
          </div>
          <h1
            className="mt-1.5 text-[23px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            <code className="text-[20.7px]">GangiBanner</code> 7 variant
          </h1>
          <p className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
            새 화면을 만들 때 inline pink-soft hero 를 다시 짜지 말고{' '}
            <code>{'<GangiBanner kind="hero|soft|cosmic|inline|sticky|success|warning" ...>'}</code>{' '}
            를 사용하세요. 기존 화면도 자연스럽게 마이그레이션 가능.
          </p>
        </article>

        <section className="space-y-3">
          <BannerSection kind="hero" label="HERO · 메인 프로모션">
            <GangiBanner
              kind="hero"
              eyebrow="오늘의 한 줄"
              title={
                <>
                  오늘, 작은 결정이
                  <br />
                  큰 흐름을 바꾸는 날
                </>
              }
              ctaLabel="오늘운세 보기"
              href="/today-fortune?concern=general"
            />
          </BannerSection>

          <BannerSection kind="soft" label="SOFT · 이벤트 안내 (ZodiacChip 좌)">
            <GangiBanner
              kind="soft"
              eyebrow="오늘의 띠"
              title="12간지 운세 매일 새로 열려요"
              ctaLabel="12띠 운세 모두 보기"
              href="/zodiac"
              leading={<ZodiacChip kind="horse" size="lg" />}
            />
          </BannerSection>

          <BannerSection kind="cosmic" label="COSMIC · 별자리 콘텐츠 (ink + 별 패턴)">
            <GangiBanner
              kind="cosmic"
              eyebrow="STAR SIGN"
              title="12 별자리 메시지"
              description="매일 새로 열리는 별의 풀이"
              ctaLabel="별자리 보기"
              href="/star-sign"
              leading="♎"
            />
          </BannerSection>

          <BannerSection kind="inline" label="INLINE · 작은 풀이 업셀 (가격 칩)">
            <GangiBanner
              kind="inline"
              title="오늘 자세히 보기"
              description="지금 흐름 · 조심할 시간대 · 핵심 한 줄"
              ctaLabel=""
              pricePill="9,900원"
              href="/today-fortune/detail"
            />
          </BannerSection>

          <BannerSection kind="sticky" label="STICKY · 하단 고정형 (스티키)">
            <GangiBanner
              kind="sticky"
              eyebrow="알림"
              title="새 풀이가 도착했어요"
              ctaLabel="확인"
              href="/notifications"
            />
          </BannerSection>

          <BannerSection kind="success" label="SUCCESS · 완료 안내 (jade)">
            <GangiBanner
              kind="success"
              eyebrow="저장됨"
              title="보관함에 저장됐어요"
              description="언제든 다시 열어볼 수 있어요"
            />
          </BannerSection>

          <BannerSection kind="warning" label="WARNING · 조심 안내 (coral)">
            <GangiBanner
              kind="warning"
              eyebrow="확인 필요"
              title="다시 계산이 필요해요"
              description="오래된 풀이입니다. 새로 만들어보세요."
            />
          </BannerSection>
        </section>

        <article
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
            source of truth
          </div>
          <ul className="mt-2 grid gap-1 text-[13.2px] leading-[1.55] text-[var(--app-copy)]">
            <li>· component: <code>src/components/gangi/gangi-banner.tsx</code></li>
            <li>· spec: <code>docs/design/ganji-redesign/source/02_BOARD_MANIFEST.md</code> (board `banners`)</li>
            <li>· manifest: <code>docs/design/ganji-redesign/BOARD_MANIFEST.md</code></li>
          </ul>
        </article>
      </AppPage>
    </AppShell>
  );
}

function BannerSection({
  kind,
  label,
  children,
}: {
  kind: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`banner-${kind}`}
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          {label}
        </div>
        <a
          href={`#banner-${kind}`}
          className="text-[12.1px] font-extrabold text-[var(--app-pink-strong)]"
        >
          #banner-{kind}
        </a>
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
