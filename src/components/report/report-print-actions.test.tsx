// @vitest-environment node
import { expect, it } from 'vitest';
import { IN_APP_BROWSER_UA } from './report-print-actions';

it('인앱 브라우저(카카오·인스타·페북·라인)를 알아보고 일반 브라우저는 그대로 둔다', () => {
  for (const ua of [
    'Mozilla/5.0 (iPhone) AppleWebKit KAKAOTALK 10.8.0',
    'Mozilla/5.0 (Linux; Android 14) Instagram 312.0',
    'Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]',
    'Mozilla/5.0 (iPhone) Line/14.1.0',
  ]) expect(IN_APP_BROWSER_UA.test(ua)).toBe(true);
  expect(IN_APP_BROWSER_UA.test('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1')).toBe(false);
});
