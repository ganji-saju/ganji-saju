import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MoonlightAppPageProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PAGE_SIZE_CLASSNAME: Record<NonNullable<MoonlightAppPageProps['size']>, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
};

export function AppPage({
  children,
  className,
  size = 'md',
}: MoonlightAppPageProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8',
        PAGE_SIZE_CLASSNAME[size],
        className
      )}
    >
      {children}
    </div>
  );
}

export const MoonlightAppPage = AppPage;
