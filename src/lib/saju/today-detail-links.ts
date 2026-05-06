export function buildSajuTodayDetailHref(slug: string) {
  return `/saju/${encodeURIComponent(slug)}/today-detail`;
}

export function buildSajuTodayDetailCheckoutHref(slug: string) {
  const encodedSlug = encodeURIComponent(slug);
  return `/membership/checkout?product=today-detail&slug=${encodedSlug}&scope=general&from=saju-result`;
}
