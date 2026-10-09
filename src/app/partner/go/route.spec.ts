import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/partner/go', () => {
  it('코드를 정규화해 쿠키(경로 /·7일)를 심고 /partner/start 로 303', () => {
    const res = GET(new NextRequest('https://ganjisaju.kr/partner/go?code=Abc12'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://ganjisaju.kr/partner/start');
    const cookie = res.cookies.get('ganji_partner');
    expect(cookie?.value).toBe('abc12');
    expect(cookie?.path).toBe('/');
    expect(cookie?.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it('잘못된 코드면 쿠키 없이 같은 곳으로(입력 화면이 이용 불가 안내)', () => {
    const res = GET(new NextRequest('https://ganjisaju.kr/partner/go?code=a'));
    expect(res.headers.get('location')).toBe('https://ganjisaju.kr/partner/start');
    expect(res.cookies.get('ganji_partner')).toBeUndefined();
  });
});
