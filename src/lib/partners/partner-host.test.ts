import assert from 'node:assert/strict';
import { isPartnerHost, partnerLandingRewritePath } from './partner-host';

declare const test: (name: string, fn: () => void) => void;

test('isPartnerHost: env 목록의 호스트만', () => {
  process.env.PARTNER_SITE_HOSTS = 'newyear.example, www.newyear.example';
  assert.equal(isPartnerHost('newyear.example'), true);
  assert.equal(isPartnerHost('www.newyear.example'), true);
  assert.equal(isPartnerHost('ganjisaju.kr'), false);
  delete process.env.PARTNER_SITE_HOSTS;
  assert.equal(isPartnerHost('newyear.example'), false);
});

test('partnerLandingRewritePath: 코드 경로만 랜딩, 간지사주 다른 화면은 열지 않음', () => {
  assert.equal(partnerLandingRewritePath('/mina'), '/partner-landing/mina');
  assert.equal(partnerLandingRewritePath('/'), '/partner-landing/_');
  assert.equal(partnerLandingRewritePath('/saju/new'), '/partner-landing/_');
  assert.equal(partnerLandingRewritePath('/terms'), null);
  assert.equal(partnerLandingRewritePath('/privacy'), null);
  assert.equal(partnerLandingRewritePath('/_next/static/x.js'), null);
  assert.equal(partnerLandingRewritePath('/images/a.png'), null);
  assert.equal(partnerLandingRewritePath('/favicon.ico'), null);
});
