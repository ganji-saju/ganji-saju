import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

describe('/r/<토큰> 진입', () => {
  it('토큰을 httpOnly 쿠키로 옮기고 토큰 없는 /r/view 로 보낸다(분석 태그가 주소에서 토큰을 못 읽게)', async () => {
    const res = await GET(new NextRequest(`https://ganjisaju.kr/r/${token}`), { params: Promise.resolve({ token }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://ganjisaju.kr/r/view');
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`gs_report_view=${token}`);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie).toContain('Path=/r');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('형식이 틀린 토큰은 쿠키 없이 보낸다(결과는 같은 404 화면)', async () => {
    const res = await GET(new NextRequest('https://ganjisaju.kr/r/bad'), { params: Promise.resolve({ token: 'bad' }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
