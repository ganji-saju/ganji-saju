import { afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ create: vi.fn(async () => ({ output_text: 'fixture response' })) }));
vi.mock('openai', () => ({ default: class { responses = { create: sdk.create }; } }));
import { generateAiText } from './openai-text';

describe('AI request cancellation', () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

  it('passes the cancellation signal to the SDK request without a real API call', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'offline-fixture');
    const controller = new AbortController();
    const result = await generateAiText({ instructions: 'fixture', input: 'fixture', fallbackText: '', signal: controller.signal });
    expect(result.text).toBe('fixture response');
    expect(sdk.create).toHaveBeenCalledWith(expect.anything(), { signal: controller.signal });
  });

  it('an already cancelled request never calls the SDK', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(generateAiText({ instructions: 'fixture', input: 'fixture', fallbackText: '', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(sdk.create).not.toHaveBeenCalled();
  });
});
