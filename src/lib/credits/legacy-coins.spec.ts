import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userHasLegacyCoins } from './legacy-coins';
import * as deductModule from './deduct';

vi.mock('@/lib/credits/deduct');

describe('userHasLegacyCoins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when userId is empty', async () => {
    const result = await userHasLegacyCoins('');
    expect(result).toBe(false);
    // getCredits should not be called
    expect(deductModule.getCredits).not.toHaveBeenCalled();
  });

  it('returns true when balance > 0', async () => {
    vi.mocked(deductModule.getCredits).mockResolvedValueOnce({
      balance: 10,
      subscription_balance: 0,
    });

    const result = await userHasLegacyCoins('user123');
    expect(result).toBe(true);
    expect(deductModule.getCredits).toHaveBeenCalledWith('user123');
  });

  it('returns false when balance === 0', async () => {
    vi.mocked(deductModule.getCredits).mockResolvedValueOnce({
      balance: 0,
      subscription_balance: 0,
    });

    const result = await userHasLegacyCoins('user123');
    expect(result).toBe(false);
  });

  it('returns false when getCredits returns null', async () => {
    vi.mocked(deductModule.getCredits).mockResolvedValueOnce(null);

    const result = await userHasLegacyCoins('user123');
    expect(result).toBe(false);
  });

  it('returns false when balance === 0 AND subscription_balance > 0 (members only)', async () => {
    vi.mocked(deductModule.getCredits).mockResolvedValueOnce({
      balance: 0,
      subscription_balance: 50,
    });

    const result = await userHasLegacyCoins('user123');
    expect(result).toBe(false);
  });
});
