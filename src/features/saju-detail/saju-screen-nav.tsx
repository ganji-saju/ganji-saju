import Link from 'next/link';
import { cn } from '@/lib/utils';

// Redesign 2026-05-13: 'deep' 항목 신설 — mockup screens-c.jsx ScreenSajuDeep 매핑.
const SAJU_SCREEN_ITEMS = [
  { key: 'result', label: '총평', getHref: (slug: string) => `/saju/${slug}` },
  { key: 'deep', label: '깊은', getHref: (slug: string) => `/saju/${slug}/deep` },
  { key: 'premium', label: '상세', getHref: (slug: string) => `/saju/${slug}/premium` },
  { key: 'overview', label: '명식', getHref: (slug: string) => `/saju/${slug}/overview` },
  { key: 'nature', label: '성향', getHref: (slug: string) => `/saju/${slug}/nature` },
  { key: 'elements', label: '오행', getHref: (slug: string) => `/saju/${slug}/elements` },
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
