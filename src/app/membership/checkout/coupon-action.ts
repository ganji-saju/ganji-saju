'use server';
// 체크아웃 쿠폰 입력칸(할인쿠폰 PR5) — 입력한 코드를 체크아웃 전용 짧은 쿠키에 둔다.
//
// GET 폼(`?coupon=`)을 쓰지 않는 이유: 코드가 URL 에 실리면 방문기록·GA·리퍼러로 새고, 다른 사이트가 연 링크가
//   이 사용자의 조회 예산을 대신 태운다. 서버 액션은 POST 이고 Next 가 Origin 을 검사한다(CSRF).
// 쿠키를 바꾸면 Next 가 같은 화면을 다시 그린다 — 리다이렉트가 필요 없다. 코드 검사·조회 예산은 렌더가
//   부르는 resolveChargeForUser 가 한다(여기서 판정하면 그 한도를 우회하는 두 번째 입구가 된다).
import { cookies } from 'next/headers';
import { COUPON_INPUT_COOKIE } from '@/lib/coupons/discount-coupon';

export async function submitCouponInput(formData: FormData): Promise<void> {
  // 인쇄 코드는 13자(ganji-10-0000). 1MB 까지 오는 본문을 그대로 Set-Cookie 에 싣지 않게 자른다.
  const code = String(formData.get('coupon') ?? '').trim().slice(0, 40);
  const store = await cookies();
  if (!code) {
    store.delete({ name: COUPON_INPUT_COOKIE, path: '/membership/checkout' });
    return;
  }
  // 30분 — 비로그인이면 결제 버튼이 로그인으로 보냈다 돌아오는 동안 살아 있어야 한다. lax 여야 소셜 로그인의
  //   교차 사이트 복귀(카카오·구글 → 콜백 → 체크아웃)에도 실린다. 교차 사이트 링크로 실려도 코드는 사용자 본인이 넣은 것이다.
  store.set(COUPON_INPUT_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/membership/checkout',
    maxAge: 30 * 60,
  });
}
