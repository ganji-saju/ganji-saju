/**
 * 주제(concern) → 그 주제를 여는 단품 상품 id.
 *
 * 2026-07-19 — money-pattern·work-flow 는 결제만 되고 **여는 게이트가 앱 전체에 0곳**이었다
 *   (getTasteProductEntitlement 호출 26곳 중 두 상품을 읽는 곳이 없었다). 결제 후 착지도
 *   빈 입력폼이었다. 두 상품은 today-detail 이 이미 계산하는 5개 주제 중 재물/직장 슬라이스이므로,
 *   같은 화면을 해당 주제로만 열어주는 방식으로 전달물을 붙인다.
 * 2026-09-14 — lib(멤버십 환불 잠금)도 읽어서 app/api/.../route-helpers 에서 여기로 옮겼다(route-helpers 는 재수출).
 */
export const TOPIC_PRODUCT_BY_CONCERN: Readonly<Record<string, string>> = {
  wealth: 'money-pattern',
  career: 'work-flow',
};

export function topicProductForConcern(concern: string | null | undefined): string | null {
  const key = String(concern ?? '').trim();
  return TOPIC_PRODUCT_BY_CONCERN[key] ?? null;
}
