// 결제 성공(/membership/success) 직후 사용자를 어디로 보낼지 결정하는 순수 헬퍼.
// 기존엔 success/page.tsx 안의 로컬 함수였으나, 결제 후 라우팅은 실손(돈을 냈는데
// 풀이를 못 받는) 직결 로직이라 회귀 테스트로 잠그기 위해 분리·export 한다.
//
// 2026-06-07 회귀 차단: per-couple 궁합 1회권 `compat-reading` 분기가 누락돼 있어
//   productHref=null → 폴백 buildPremiumResultHref('premium', coupleKey) 가 작동 →
//   /saju/{coupleKey}/premium 으로 오라우팅되어 404("여긴 비어 있는 자리예요")가 나던
//   버그(`COMPAT_PER_COUPLE_PRICING` 플래그 ON 시 노출)를 차단한다.
import { buildSajuTodayDetailHref } from '@/lib/saju/today-detail-links';

export function buildCompleteHref(plan: string, slug: string | null) {
  const params = new URLSearchParams({ plan, payment: 'confirmed' });
  if (slug) params.set('slug', slug);
  return `/membership/complete?${params.toString()}`;
}

export function buildPremiumResultHref(plan: string, slug: string | null) {
  if (!slug || (plan !== 'premium' && plan !== 'lifetime')) return null;
  const params = new URLSearchParams({ payment: 'confirmed', plan });
  return `/saju/${encodeURIComponent(slug)}/premium?${params.toString()}`;
}

export function buildTasteProductHref(
  product: string | null,
  slug: string | null,
  scope: string | null,
  entrySource: string | null
) {
  if (product === 'today-detail') {
    if (slug && entrySource?.startsWith('saju')) {
      return `${buildSajuTodayDetailHref(slug)}?paid=today-detail`;
    }
    const params = new URLSearchParams({ paid: product, concern: scope || 'general' });
    if (slug) params.set('sourceSessionId', slug);
    return `/today-fortune/detail?${params.toString()}`;
  }
  // 궁합 소액 풀이 — 글로벌 love-question 과 per-couple compat-reading 은 동일하게
  // 궁합 결과(깊은 풀이)로 복귀시킨다. compat-reading 분기 누락이 결제 후 사주
  // 프리미엄 오라우팅(404)의 근인이었다. result page 가 paid=love-question /
  // paid=compat-reading 둘 다 수용(compatibility/result/page.tsx).
  if (product === 'love-question' || product === 'compat-reading') {
    // 2026-05-14: 궁합 결과 페이지에서 결제로 진입한 경우 결과로 돌아가서 깊은 풀이를
    // 보여준다. 그 외엔 기존대로 입력 화면으로. ManualCompatibilityResultClient 가
    // sessionStorage 의 payload (selfName/partnerName/birthInput 등) 를 그대로
    // 다시 읽으므로 입력을 다시 받지 않아도 결과가 복원된다.
    if (entrySource?.startsWith('compatibility-result')) {
      return `/compatibility/result?source=manual&paid=${product}`;
    }
    return `/compatibility/input?relationship=lover&paid=${product}`;
  }
  if (slug && product === 'monthly-calendar') {
    return `/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&product=${product}#fortune-calendar`;
  }
  if (slug && product === 'year-core') {
    return `/saju/${encodeURIComponent(slug)}/premium?payment=confirmed&product=${product}#yearly-report`;
  }
  // 오늘 풀세트(묶음) — 점수 풀이 5항목은 사주 결과 화면에서 직접 열리고 오늘 자세히도
  // 여기서 이어진다. 구성품을 모두 볼 수 있는 허브(사주 결과)로 보낸다.
  if (slug && product === 'bundle_today_set') {
    return `/saju/${encodeURIComponent(slug)}?payment=confirmed&product=${product}`;
  }
  // 2026-06-27 — 종합점수(score-total)·요소(score-factor): 결제 후 사주 결과 화면에서 점수 블록이
  //   엔타이틀먼트로 열린다. 분기가 없어 buildCompleteHref(/membership/complete)로 새던 회귀 차단.
  if (slug && (product === 'score-total' || product === 'score-factor')) {
    return `/saju/${encodeURIComponent(slug)}?payment=confirmed&product=${product}`;
  }
  // 2026-07-19 — 주제 단품(재물·일). 여기서 null 을 돌려주는 바람에 결제 후 착지가 없어
  //   빈 생년월일 입력폼으로 떨어졌다(전달물 0). today-detail 화면을 해당 주제로 연다 —
  //   두 상품은 today-detail 이 이미 계산하는 5개 주제 중 재물/직장 슬라이스다.
  if (slug && (product === 'money-pattern' || product === 'work-flow')) {
    const topic = product === 'money-pattern' ? 'wealth' : 'career';
    return `/saju/${encodeURIComponent(slug)}/today-detail?topic=${topic}&payment=confirmed&product=${product}`;
  }
  return null;
}
