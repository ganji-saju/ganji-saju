import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  surface?: 'panel' | 'muted' | 'lunar' | 'hero';
  size?: 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

const SURFACE_CLASSNAME: Record<NonNullable<SectionSurfaceProps['surface']>, string> = {
  panel: 'app-panel',
  muted: 'app-panel-muted',
  lunar: 'app-panel',
  hero: 'app-hero-card',
};

const SIZE_CLASSNAME: Record<NonNullable<SectionSurfaceProps['size']>, string> = {
  md: 'app-section-frame',
  lg: 'app-section-frame-lg',
};

export function SectionSurface({
  as: Component = 'section',
  surface = 'panel',
  size = 'md',
  className,
  children,
  ...rest
}: SectionSurfaceProps) {
  return (
    <Component
      className={cn(SURFACE_CLASSNAME[surface], SIZE_CLASSNAME[size], className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
