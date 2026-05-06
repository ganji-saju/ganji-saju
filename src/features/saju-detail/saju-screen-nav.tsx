import Link from 'next/link';
import { cn } from '@/lib/utils';

const SAJU_SCREEN_ITEMS = [
  { key: 'result', label: '요약', getHref: (slug: string) => `/saju/${slug}` },
  { key: 'overview', label: '내 사주', getHref: (slug: string) => `/saju/${slug}/overview` },
  { key: 'nature', label: '성향', getHref: (slug: string) => `/saju/${slug}/nature` },
  { key: 'elements', label: '기운 균형', getHref: (slug: string) => `/saju/${slug}/elements` },
  { key: 'premium', label: '깊게 보기', getHref: (slug: string) => `/saju/${slug}/premium` },
] as const;

interface SajuScreenNavProps {
  slug: string;
  current: (typeof SAJU_SCREEN_ITEMS)[number]['key'];
}

export default function SajuScreenNav({ slug, current }: SajuScreenNavProps) {
  return (
    <nav className="gangi-saju-subtabs" aria-label="사주 결과 메뉴">
      {SAJU_SCREEN_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.getHref(slug)}
          className={cn('gangi-saju-subtab')}
          data-active={current === item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
