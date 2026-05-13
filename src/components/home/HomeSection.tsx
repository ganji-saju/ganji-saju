import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { cn } from '@/lib/utils';
import type { HomeSectionTone } from './home.types';

type HomeSectionProps = {
  id?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: HomeSectionTone;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function HomeSection({
  id,
  eyebrow,
  title,
  description,
  actions,
  tone = 'panel',
  className,
  contentClassName,
  children,
}: HomeSectionProps) {
  return (
    <SectionSurface id={id} surface={tone} size="lg" className={cn('home-redesign-section', className)}>
      {title ? (
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
        />
      ) : null}
      <div className={cn(title ? 'mt-5' : '', contentClassName)}>{children}</div>
    </SectionSurface>
  );
}
