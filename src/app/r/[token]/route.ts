// 랜딩 주문 결과 링크 진입. 토큰은 열람 열쇠라 페이지 주소에 남기지 않는다:
//   httpOnly 쿠키로 옮기고 토큰 없는 /r/view 로 보낸다 → GTM·픽셀·분석 스크립트가 주소에서 토큰을 읽을 수 없다.
//   형식이 틀린 토큰도 같은 화면(404)으로 보낸다 — 존재 여부를 드러내지 않는다.
import { NextRequest, NextResponse } from 'next/server';
import { REPORT_VIEW_COOKIE } from '@/lib/report-orders/report-order';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = NextResponse.redirect(new URL('/r/view', req.url), 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  if (TOKEN_PATTERN.test(token)) {
    res.cookies.set(REPORT_VIEW_COOKIE, token, {
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/r',
      maxAge: 7 * 24 * 3600,
    });
  }
  return res;
}
