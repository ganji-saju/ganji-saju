import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  align = 'left',
  className,
  titleClassName,
  descriptionClassName,
}: SectionHeaderProps) {
  const centered = align === 'center';

  return (
    <div className={cn('app-section-header', centered && 'mx-auto text-center', className)}>
      {eyebrow ? <div className="app-caption">{eyebrow}</div> : null}
      <h2
        className={cn(
          'app-section-title',
          centered && 'mx-auto',
          titleClassName
        )}
      >
        {title}
      </h2>
      {description ? (
        <div
          className={cn(
            'app-section-copy',
            centered && 'mx-auto',
            descriptionClassName
          )}
        >
          {description}
        </div>
      ) : null}
      {actions ? (
        <div className={cn('app-section-actions', centered && 'flex justify-center')}>{actions}</div>
      ) : null}
    </div>
  );
}
