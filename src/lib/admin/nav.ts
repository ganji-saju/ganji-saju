// 2026-06-28 — 어드민 콘솔 내비게이션 단일 소스(순수 config).
//   기존엔 operations 페이지에만 인라인 ADMIN_NAV 그리드가 있어 다른 섹션은 고립됐다.
//   이 config 를 layout 사이드바에서 영속 렌더 → 13개 섹션이 하나의 관리자모드로 묶인다.
//   role 게이트는 각 페이지/ API 가 자체적으로도 강제하므로, 여기 minRole 은 "메뉴 가시성" UX 용.
import type { AdminRole } from '@/lib/admin-auth';

export interface AdminNavItem {
  href: string;
  label: string;
  description?: string;
  /** 이 역할 이상에게만 메뉴 노출(기본 admin). */
  minRole?: AdminRole;
  badge?: string;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: '개요',
    items: [
      { href: '/admin', label: '대시보드', description: '핵심 KPI·대기 작업·바로가기' },
    ],
  },
  {
    title: '운영·분석',
    items: [
      { href: '/admin/analytics', label: '누적 지표 분석', description: '방문자·전환·유입·결제 일별 그래프' },
      { href: '/admin/operations', label: '운영 지표', description: 'DAU·결제·만족도·구독 추이' },
      { href: '/admin/payment-funnel', label: '결제 퍼널', description: '진입 → 결제 단계별 이탈률' },
      { href: '/admin/llm-cost', label: 'LLM 비용', description: '영역별 호출·토큰·비용·캐시 hit률' },
      { href: '/admin/users/segments', label: '세그먼트·코호트', description: '세그먼트 분포·잔존율' },
    ],
  },
  {
    title: '사용자',
    items: [
      { href: '/admin/users', label: '사용자 조회', description: '이메일·UUID 검색 → 회원·결제 상세' },
    ],
  },
  {
    title: '콘텐츠·품질',
    items: [
      { href: '/admin/reviews', label: '후기 검수', description: 'pending / approved / rejected' },
      { href: '/admin/saju-feedback', label: '챕터 피드백', description: 'LLM 풀이 별점·부정 응답' },
      { href: '/admin/saju-verify', label: '사주 검증', description: '슬러그별 사주 계산 traces' },
      { href: '/admin/myungri-validation', label: '명리 검증', description: 'KASI 비교·산출 정합성' },
      { href: '/admin/weight-tuning', label: '신살 가중치', description: 'ML 가중치 튜닝·학습 fixture' },
    ],
  },
  {
    title: '운영 도구',
    items: [
      { href: '/admin/push-ctr', label: '알림 CTR', description: '푸시 전송·클릭·CTR 추이' },
      {
        href: '/admin/policies',
        label: '약관·정책',
        description: '정책 버전·게시 상태',
        minRole: 'super_admin',
      },
    ],
  },
];

// role 위계: super_admin 이 admin 의 상위.
const ROLE_RANK: Record<AdminRole, number> = { admin: 1, super_admin: 2 };

function canSee(item: AdminNavItem, role: AdminRole): boolean {
  const required = item.minRole ?? 'admin';
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** 역할로 메뉴 필터 — 권한 없는 항목 제거, 항목이 0개 된 그룹은 통째로 제외. */
export function getVisibleNavGroups(role: AdminRole): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canSee(item, role)),
  })).filter((group) => group.items.length > 0);
}

/** 모든 항목 href 평탄화(활성 경로 계산용). */
export function allNavHrefs(): string[] {
  return ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
}

/**
 * 현재 경로에 대해 활성 표시할 항목 href 1개를 고른다.
 *   - 정확히 일치하거나 'href/' 로 시작하는 후보 중 "가장 긴(구체적인)" href 선택.
 *   - 그래서 /admin/users/segments 에서 /admin/users 가 아니라 segments 가 활성된다.
 *   - /admin(대시보드)은 정확히 일치할 때만(모든 경로가 /admin 으로 시작하므로).
 */
export function getActiveNavHref(currentPath: string, hrefs: string[] = allNavHrefs()): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches =
      href === '/admin'
        ? currentPath === '/admin'
        : currentPath === href || currentPath.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
