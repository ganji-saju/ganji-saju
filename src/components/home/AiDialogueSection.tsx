import Link from 'next/link';
import { ArrowRight, MessageCircleHeart } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { HOME_ROUTES } from '@/config/home/homeNavigation';
import { HomeSection } from './HomeSection';

type AiDialogueSectionProps = {
  className?: string;
};

export function AiDialogueSection({ className }: AiDialogueSectionProps) {
  return (
    <HomeSection
      id="home-ai-dialogue"
      tone="hero"
      className={className}
      contentClassName="mt-0"
    >
      <div className="relative z-[1] grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--app-ink)] text-white">
          <MessageCircleHeart className="h-6 w-6" />
        </span>
        <div>
          <p className="app-caption">{HOME_SECTION_COPY.aiDialogue.eyebrow}</p>
          <h2 className="app-section-title mt-2">{HOME_SECTION_COPY.aiDialogue.title}</h2>
          <p className="app-section-copy mt-3">{HOME_SECTION_COPY.aiDialogue.description}</p>
        </div>
        <Link
          href={HOME_ROUTES.dialogue}
          data-analytics-event="home_ai_dialogue_clicked"
          data-analytics-section="ai-dialogue"
          data-analytics-service-id="dialogue"
          data-analytics-target="dialogue"
          className={buttonVariants({ size: 'lg', className: 'min-h-12 w-full md:w-auto' })}
        >
          {HOME_SECTION_COPY.aiDialogue.ctaLabel}
          <ArrowRight data-icon="inline-end" className="h-4 w-4" />
        </Link>
      </div>
    </HomeSection>
  );
}
