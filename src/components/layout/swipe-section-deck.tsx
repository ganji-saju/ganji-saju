'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SwipeSectionDeckProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

interface SwipeSectionSlideProps {
  eyebrow?: string;
  title: string;
  description?: string;
  navLabel?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

function getSlideLabel(child: ReactNode, index: number) {
  if (!isValidElement(child)) return `${index + 1}`;

  const props = child.props as Partial<SwipeSectionSlideProps>;
  return props.navLabel ?? props.title ?? `${index + 1}`;
}

export function SwipeSectionDeck({
  children,
  title = '핵심 보기',
  description,
  className,
}: SwipeSectionDeckProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => Children.toArray(children).filter(Boolean), [children]);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndex = Math.max(0, items.length - 1);

  const scrollToIndex = useCallback(
    (nextIndex: number) => {
      const viewport = viewportRef.current;
      const clamped = Math.min(Math.max(nextIndex, 0), lastIndex);
      setActiveIndex(clamped);

      if (!viewport) return;
      viewport.scrollTo({
        left: viewport.clientWidth * clamped,
        behavior: 'smooth',
      });
    },
    [lastIndex]
  );

  if (items.length === 0) return null;

  return (
    <section className={cn('app-swipe-section-deck', className)}>
      <div className="mb-4 rounded-[1.4rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--app-ink)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--app-copy-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-[var(--app-pink)]/25 bg-[var(--app-pink)]/10 px-3 py-1 text-sm text-[var(--app-pink-strong)]">
              {activeIndex + 1} / {items.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="이전 섹션"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={activeIndex === lastIndex}
              aria-label="다음 섹션"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, index) => (
            <button
              key={`${getSlideLabel(item, index)}-${index}`}
              type="button"
              onClick={() => scrollToIndex(index)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                activeIndex === index
                  ? 'border-[var(--app-pink)]/35 bg-[var(--app-pink)]/14 text-[var(--app-pink-strong)]'
                  : 'border-[var(--app-line)] bg-white text-[var(--app-copy-muted)] hover:bg-[var(--app-pink-soft)] hover:text-[var(--app-ink)]'
              )}
            >
              {getSlideLabel(item, index)}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={viewportRef}
        className="app-swipe-section-viewport"
        onScroll={(event) => {
          const viewport = event.currentTarget;
          const nextIndex = Math.round(viewport.scrollLeft / Math.max(viewport.clientWidth, 1));
          setActiveIndex(Math.min(Math.max(nextIndex, 0), lastIndex));
        }}
      >
        {items.map((item, index) => (
          <div key={index} className="app-swipe-section-page">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SwipeSectionSlide({
  eyebrow,
  title,
  description,
  children,
  className,
  bodyClassName,
}: SwipeSectionSlideProps) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="mb-4 rounded-[1.35rem] border border-[var(--app-line)] bg-white px-4 py-4 sm:px-5">
        {eyebrow ? <div className="app-caption">{eyebrow}</div> : null}
        <h3 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--app-ink)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--app-copy-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className={cn('space-y-4', bodyClassName)}>{children}</div>
    </section>
  );
}
