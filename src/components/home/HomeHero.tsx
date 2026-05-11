import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { HOME_HERO_COPY } from '@/config/home/homeCopy';
import { HOME_ROUTES } from '@/config/home/homeNavigation';
import { cn } from '@/lib/utils';

type HomeHeroProps = {
  className?: string;
};

export function HomeHero({ className }: HomeHeroProps) {
  return (
    <section className={cn('app-hero-card app-section-frame-lg', className)}>
      <div className="relative z-[1] grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] md:items-end">
        <div>
          <p className="app-caption">{HOME_HERO_COPY.eyebrow}</p>
          <h1 className="mt-3 text-[1.94rem] font-bold leading-[1.12] tracking-[-0.04em] text-[var(--app-ink)] sm:text-[2.6rem] md:mt-4 md:text-[3rem]">
            <span className="block">오늘 무엇을</span>
            <span className="block">보고 싶나요?</span>
          </h1>
          <div className="app-hero-description mt-4 grid gap-1 md:mt-5 md:gap-1.5">
            {HOME_HERO_COPY.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="mt-5 grid gap-2.5 sm:flex sm:flex-wrap md:mt-7 md:gap-3">
            <Link
              href={HOME_ROUTES.sajuPersonality}
              data-analytics-event="home_hero_primary_clicked"
              data-analytics-section="hero"
              data-analytics-target="saju-personality"
              className={buttonVariants({ size: 'lg', className: 'min-h-11 w-full md:min-h-12 sm:w-auto' })}
            >
              {HOME_HERO_COPY.primaryCtaLabel}
              <ArrowRight data-icon="inline-end" className="h-4 w-4" />
            </Link>
            <Link
              href={HOME_ROUTES.personalityCompatibility}
              data-analytics-event="home_hero_secondary_clicked"
              data-analytics-section="hero"
              data-analytics-target="personality-compatibility"
              className={buttonVariants({
              variant: 'secondary',
              size: 'lg',
                className: 'min-h-11 w-full md:min-h-12 sm:w-auto',
              })}
            >
              {HOME_HERO_COPY.secondaryCtaLabel}
            </Link>
          </div>
        </div>
        <div className="hidden rounded-[1.6rem] border border-[var(--app-line)] bg-white/80 p-4 shadow-[0_18px_42px_rgba(216,27,114,0.10)] md:block">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--app-pink-strong)]">
            <Sparkles className="h-4 w-4" />
            사주 × 성향
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
            타고난 기질과 지금의 선택 습관을 함께 놓고, 오늘 필요한 풀이로 바로 이어갑니다.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[var(--app-copy-muted)]">
            <span className="rounded-full bg-[var(--app-pink-soft)] px-3 py-2 text-center">내 흐름</span>
            <span className="rounded-full bg-[var(--app-surface-muted)] px-3 py-2 text-center">우리 관계</span>
          </div>
        </div>
      </div>
    </section>
  );
}
