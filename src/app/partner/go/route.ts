// 랜딩(별도 도메인)의 구매 버튼이 오는 곳. 파트너 쿠키를 심고 올해운 노트 입력 화면(/partner/start)으로 보낸다.
//   교차 사이트 진입이라 체크아웃의 ?coupon= 가드에 걸리지 않게 쿠키는 여기(우리 도메인)서 심는다.
import { NextRequest, NextResponse } from 'next/server';
import { PARTNER_COOKIE, PARTNER_COOKIE_MAX_AGE, normalizePartnerCode } from '@/lib/partners/partner';

export function GET(req: NextRequest) {
  const code = normalizePartnerCode(req.nextUrl.searchParams.get('code'));
  const res = NextResponse.redirect(new URL('/partner/start', req.nextUrl.origin), 303);
  if (code) {
    res.cookies.set(PARTNER_COOKIE, code, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: PARTNER_COOKIE_MAX_AGE,
    });
  }
  return res;
}
