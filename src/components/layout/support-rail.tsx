import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SectionHeader } from './section-header';

interface SupportRailProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  surface?: 'panel' | 'muted' | 'lunar';
  className?: string;
}

const SURFACE_CLASSNAME: Record<NonNullable<SupportRailProps['surface']>, string> = {
  panel: 'app-panel',
  muted: 'app-panel-muted',
  lunar: 'app-panel',
};

export function SupportRail({
  eyebrow,
  title,
  description,
  children,
  surface = 'muted',
  className,
}: SupportRailProps) {
  return (
    <aside className={cn(SURFACE_CLASSNAME[surface], 'p-6 sm:p-7', className)}>
      {title ? (
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          titleClassName="text-3xl"
        />
      ) : null}
      <div className={cn(title ? 'mt-5' : '')}>{children}</div>
    </aside>
  );
}
