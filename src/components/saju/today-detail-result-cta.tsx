// 2026-05-16 A7 — /saju/[slug] 메인 페이지의 today-detail CTA 클라이언트 wrapper.
//
// 서버 페이지가 todayDetailEntitlement / todayDetailHref 를 계산해서
// initialEntitlement 로 전달 → 첫 paint 깜빡임 0.
// 이후 client hook 이 focus 시 자동 재요청 → 다른 탭 결제 후 실시간 반영.
'use client';

import { TrackedLink } from '@/components/common/tracked-link';
import {
  useProductEntitlement,
  type InitialEntitlement,
} from '@/lib/payments/use-product-entitlement';

interface Props {
  slug: string;
  initialEntitlement: InitialEntitlement;
  /** 미구매 시 사용할 결제 페이지 href. entitlement openHref 보다 우선. */
  unpaidHref: string;
  /** "오늘 자세히 · 9,900원" 등 미구매 라벨 */
  unpaidLabel: string;
  /** "구매한 풀이 열기" 등 보유 라벨 */
  ownedLabel: string;
  className: string;
}

export function TodayDetailResultCta({
  slug,
  initialEntitlement,
  unpaidHref,
  unpaidLabel,
  ownedLabel,
  className,
}: Props) {
  const { hasEntitlement, openHref } = useProductEntitlement({
    productId: 'today-detail',
    slug,
    initialEntitlement,
  });

  const href = hasEntitlement ? openHref ?? unpaidHref : unpaidHref;
  const label = hasEntitlement ? ownedLabel : unpaidLabel;

  return (
    <TrackedLink
      href={href}
      eventName="report_deep_report_click"
      eventParams={{
        slug,
        product: 'today-detail',
        from: 'result_next_step',
        purchased: hasEntitlement,
      }}
      className={className}
    >
      {label}
    </TrackedLink>
  );
}
