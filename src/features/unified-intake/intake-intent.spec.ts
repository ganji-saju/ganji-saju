import { describe, it, expect } from 'vitest';
import { parseIntakeIntent } from './intake-intent';

describe('parseIntakeIntent', () => {
  it('accepts whitelisted values', () => {
    expect(parseIntakeIntent('today')).toBe('today');
    expect(parseIntakeIntent('saju')).toBe('saju');
  });
  it('rejects everything else', () => {
    expect(parseIntakeIntent('compat')).toBeNull();
    expect(parseIntakeIntent('')).toBeNull();
    expect(parseIntakeIntent(null)).toBeNull();
    expect(parseIntakeIntent(undefined)).toBeNull();
  });
});
