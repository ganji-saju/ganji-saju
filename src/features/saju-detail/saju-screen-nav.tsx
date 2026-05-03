import Link from 'next/link';
import { cn } from '@/lib/utils';

const SAJU_SCREEN_ITEMS = [
  { key: 'result', label: '통합 결과', getHref: (slug: string) => `/saju/${slug}` },
  { key: 'overview', label: '사주', getHref: (slug: string) => `/saju/${slug}/overview` },
  { key: 'nature', label: '성정', getHref: (slug: string) => `/saju/${slug}/nature` },
  { key: 'elements', label: '오행', getHref: (slug: string) => `/saju/${slug}/elements` },
  { key: 'premium', label: '깊은 사주풀이', getHref: (slug: string) => `/saju/${slug}/premium` },
] as const;

interface SajuScreenNavProps {
  slug: string;
  current: (typeof SAJU_SCREEN_ITEMS)[number]['key'];
}

export default function SajuScreenNav({ slug, current }: SajuScreenNavProps) {
  return (
    <nav className="app-subnav">
      {SAJU_SCREEN_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.getHref(slug)}
          className={cn('app-subnav-link')}
          data-active={current === item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
