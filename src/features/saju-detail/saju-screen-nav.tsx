import Link from 'next/link';
import { cn } from '@/lib/utils';

// Redesign 2026-05-13: 'deep' 항목 신설 — mockup screens-c.jsx ScreenSajuDeep 매핑.
// 2026-05-15 cleanup: "깊은" 은 모호하고 다른 탭과 콘텐츠가 중복돼서 사용자 피드백 부정적.
// 라벨을 "대운" 으로 변경 — 이 탭의 유일한 고유 콘텐츠가 대운 10년 흐름의 8단 풀이.
// URL `/deep` 은 외부 링크 호환을 위해 그대로 유지.
const SAJU_SCREEN_ITEMS = [
  { key: 'result', label: '총평', getHref: (slug: string) => `/saju/${slug}` },
  { key: 'deep', label: '대운', getHref: (slug: string) => `/saju/${slug}/deep` },
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
