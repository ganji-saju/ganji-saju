import Link from 'next/link';
import { ArrowRight, CalendarHeart } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { buttonVariants } from '@/components/ui/button';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { HOME_ROUTES } from '@/config/home/homeNavigation';
import { HomeSection } from './HomeSection';

export type TodaySnapshotItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  href: string;
};

type TodaySnapshotProps = {
  items?: readonly TodaySnapshotItem[];
  className?: string;
};

const DEFAULT_TODAY_SNAPSHOT_ITEMS = [
  {
    id: 'today',
    label: '오늘운세',
    title: '오늘의 한 줄',
    description: '지금 필요한 선택을 짧게 확인합니다.',
    href: HOME_ROUTES.todayFortune,
  },
  {
    id: 'zodiac',
    label: '띠운세',
    title: '내 띠의 오늘 흐름',
    description: '띠 기준으로 오늘의 분위기를 봅니다.',
    href: HOME_ROUTES.zodiac,
  },
  {
    id: 'star-sign',
    label: '별자리',
    title: '별자리 메시지',
    description: '가볍게 읽는 오늘의 힌트입니다.',
    href: HOME_ROUTES.starSign,
  },
] as const satisfies readonly TodaySnapshotItem[];

export function TodaySnapshot({ items = DEFAULT_TODAY_SNAPSHOT_ITEMS, className }: TodaySnapshotProps) {
  return (
    <HomeSection
      id="home-today-snapshot"
      tone="muted"
      eyebrow={HOME_SECTION_COPY.todaySnapshot.eyebrow}
      title={HOME_SECTION_COPY.todaySnapshot.title}
      description={HOME_SECTION_COPY.todaySnapshot.description}
      className={className}
    >
      <div className="home-today-snapshot-row">
        {items.map((item) => (
          <FeatureCard
            key={item.id}
            surface="soft"
            className="flex h-full min-h-[10rem] flex-col justify-between md:min-h-[12rem]"
            icon={
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--app-pink-strong)] ring-1 ring-[var(--app-pink-line)]">
                <CalendarHeart className="h-5 w-5" />
              </span>
            }
            eyebrow={item.label}
            title={item.title}
            description={item.description}
            footer={
              <Link
                href={item.href}
                data-analytics-event="home_free_service_clicked"
                data-analytics-section="today-snapshot"
                data-analytics-service-id={item.id}
                data-analytics-target={item.id}
                className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'min-h-12 w-full' })}
              >
                자세히 보기
                <ArrowRight data-icon="inline-end" className="h-4 w-4" />
              </Link>
            }
          />
        ))}
      </div>
    </HomeSection>
  );
}
