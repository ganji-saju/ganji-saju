export interface SpecialistMentorCardData {
  slug: string;
  hanja: string;
  title: string;
  specialty: string;
  description: string;
  href: string;
  statusLabel: string;
  ctaLabel: string;
}

export const SPECIALIST_MENTORS: readonly SpecialistMentorCardData[] = [
  {
    slug: 'wollyeong',
    hanja: '🐲',
    title: '월령 선생',
    specialty: '격국·용신·원국 분석',
    description: '내 사주의 바탕과 오늘 선택을 짚어드립니다.',
    href: '/saju/new',
    statusLabel: '리포트에서 먼저 보기',
    ctaLabel: '풀이 시작하기',
  },
  {
    slug: 'sewoon',
    hanja: '🐴',
    title: '세운 선생',
    specialty: '올해·월별 전략',
    description: '대운 위에서 올해의 촉발점과 월별 리듬을 봅니다.',
    href: '/saju/new?product=yearly-2026',
    statusLabel: '리포트에서 먼저 보기',
    ctaLabel: '연간 전략서 시작하기',
  },
  {
    slug: 'inyeon',
    hanja: '🐑',
    title: '인연 선생',
    specialty: '궁합·관계',
    description: '두 사람의 결이 어디에서 맞고 어긋나는지 봅니다.',
    href: '/compatibility?product=relationship-standard',
    statusLabel: '리포트에서 먼저 보기',
    ctaLabel: '궁합 풀이 보기',
  },
  {
    slug: 'gamun',
    hanja: '🐶',
    title: '가문 선생',
    specialty: '가족·자녀·부모',
    description: '가족 구성원의 기질과 충돌 지점을 함께 정리합니다.',
    href: '/saju/new?product=family-report',
    statusLabel: '준비 중',
    ctaLabel: '가족 리포트 흐름 보기',
  },
] as const;
