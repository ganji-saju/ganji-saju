// 2026-05-16 A7 — /saju/[slug]/deep 의 lifetime CTA 클라이언트 wrapper.
//
// 서버 페이지가 getLifetimeReportEntitlement 로 초기 entitlement 를 계산해서
// initialEntitlement 로 전달 (SSR 일치 paint, 깜빡임 0).
// 이후 client hook 이 focus/visibility 시 자동 재요청 → 다른 탭에서 결제 후
// 돌아온 경우 실시간 반영.
'use client';

import Link from 'next/link';
import { TrackedLink } from '@/components/common/tracked-link';
import {
  useProductEntitlement,
  type InitialEntitlement,
} from '@/lib/payments/use-product-entitlement';

interface Props {
  slug: string;
  initialEntitlement: InitialEntitlement;
}

export function LifetimeDeepCta({ slug, initialEntitlement }: Props) {
  const { hasEntitlement, openHref } = useProductEntitlement({
    productId: 'lifetime-report',
    slug,
    initialEntitlement,
  });

  // 이미 구매한 사용자 — premium 페이지로.
  if (hasEntitlement) {
    return (
      <Link
        href={openHref ?? `/saju/${encodeURIComponent(slug)}/premium`}
        className="ml-auto inline-flex items-center justify-center rounded-[12px] bg-[var(--app-jade)] px-5 py-2.5 text-[15px] font-extrabold text-white"
      >
        ✓ 구매한 풀이 보기
      </Link>
    );
  }

  // 미구매 — 결제 CTA.
  return (
    <TrackedLink
      href={`/membership/checkout?plan=lifetime&slug=${encodeURIComponent(slug)}&from=saju-deep`}
      eventName="report_deep_report_click"
      eventParams={{
        slug,
        product: 'lifetime-report',
        from: 'saju_deep_premium_cta',
      }}
      className="ml-auto inline-flex items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 py-2.5 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
    >
      결제하기 →
    </TrackedLink>
  );
}
