import type { ReactNode } from 'react';

export type HomeSectionTone = 'panel' | 'muted' | 'hero';

export type HomeSectionLayout = 'stack' | 'split';

export type RecentReportSummary = {
  id: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  createdAtLabel?: string;
};

export type HomeSectionAction = {
  label: string;
  href: string;
  variant?: 'default' | 'outline' | 'secondary';
};

export type HomeSectionIntro = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
};
