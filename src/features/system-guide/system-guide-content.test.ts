import assert from 'node:assert/strict';
import test from 'node:test';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';

test('system guide exposes the approved six steps in order', () => {
  assert.deepEqual(
    SYSTEM_GUIDE_STEPS.map(({ id, primaryHref }) => ({ id, primaryHref })),
    [
      { id: 'profile', primaryHref: '/my/profile' },
      { id: 'fortune', primaryHref: '/today-fortune' },
      { id: 'saju', primaryHref: '/saju/new' },
      { id: 'results', primaryHref: '/my/results' },
      { id: 'dialogue', primaryHref: '/dialogue' },
      { id: 'notifications', primaryHref: '/notifications' },
    ],
  );
  assert.equal(SYSTEM_GUIDE_STEPS[5]?.secondaryHref, '/membership');
});

test('system guide step IDs are unique and content is serializable', () => {
  assert.equal(new Set(SYSTEM_GUIDE_STEPS.map(({ id }) => id)).size, 6);
  assert.doesNotThrow(() => JSON.stringify(SYSTEM_GUIDE_STEPS));
});
