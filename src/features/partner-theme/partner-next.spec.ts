import { describe, expect, it } from 'vitest';
import { safePartnerNext } from './partner-next';

describe('safePartnerNext', () => {
  it('결제 페이지 주소는 그대로', () => {
    expect(safePartnerNext('/partner/checkout?slug=1990-6-7-14-female-key07y0dyy')).toBe('/partner/checkout?slug=1990-6-7-14-female-key07y0dyy');
  });
  it.each([undefined, '', '/admin', '//evil.com/partner/', 'https://evil.com/partner/x', '/partner/../admin', '/partner/%2e%2e/admin', '/partnerx'])(
    '%s → /partner/start',
    (raw) => expect(safePartnerNext(raw)).toBe('/partner/start'),
  );
});
