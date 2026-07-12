export const SYSTEM_GUIDE_STORAGE_KEY = 'ganji-saju:system-guide:v1';

export type SystemGuideStatus = 'new' | 'in_progress' | 'dismissed' | 'completed';

export interface SystemGuideState {
  version: 1;
  status: SystemGuideStatus;
  stepIndex: number;
}

const LAST_STEP_INDEX = 5;
const VALID_STATUSES: readonly SystemGuideStatus[] = [
  'new',
  'in_progress',
  'dismissed',
  'completed',
];

export function createDefaultSystemGuideState(): SystemGuideState {
  return { version: 1, status: 'new', stepIndex: 0 };
}

export function normalizeSystemGuideState(value: unknown): SystemGuideState {
  if (typeof value !== 'object' || value === null) {
    return createDefaultSystemGuideState();
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    typeof candidate.status !== 'string' ||
    !VALID_STATUSES.includes(candidate.status as SystemGuideStatus)
  ) {
    return createDefaultSystemGuideState();
  }

  const rawStepIndex = candidate.stepIndex;
  const stepIndex =
    typeof rawStepIndex === 'number' && Number.isFinite(rawStepIndex)
      ? Math.min(LAST_STEP_INDEX, Math.max(0, Math.trunc(rawStepIndex)))
      : 0;

  return {
    version: 1,
    status: candidate.status as SystemGuideStatus,
    stepIndex,
  };
}

export function shouldAutoOpenSystemGuide(
  authenticated: boolean,
  state: SystemGuideState,
): boolean {
  return authenticated && (state.status === 'new' || state.status === 'in_progress');
}

export function readSystemGuideState(storage: Pick<Storage, 'getItem'>): SystemGuideState {
  try {
    const storedValue = storage.getItem(SYSTEM_GUIDE_STORAGE_KEY);
    return storedValue === null
      ? createDefaultSystemGuideState()
      : normalizeSystemGuideState(JSON.parse(storedValue));
  } catch {
    return createDefaultSystemGuideState();
  }
}

export function writeSystemGuideState(
  storage: Pick<Storage, 'setItem'>,
  state: SystemGuideState,
): void {
  try {
    storage.setItem(SYSTEM_GUIDE_STORAGE_KEY, JSON.stringify(normalizeSystemGuideState(state)));
  } catch {
    // Storage may be unavailable in privacy mode. The in-memory caller state remains valid.
  }
}
