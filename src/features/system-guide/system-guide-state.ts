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

export function readSystemGuideState(storage: Pick<Storage, 'getItem'>): SystemGuideState {
  return readSystemGuideStateResult(storage).state;
}

export interface SystemGuideStateReadResult {
  available: boolean;
  state: SystemGuideState;
}

export function readSystemGuideStateResult(
  storage: Pick<Storage, 'getItem'>,
): SystemGuideStateReadResult {
  let storedValue: string | null;
  try {
    storedValue = storage.getItem(SYSTEM_GUIDE_STORAGE_KEY);
  } catch {
    return { available: false, state: createDefaultSystemGuideState() };
  }

  if (storedValue === null) {
    return { available: true, state: createDefaultSystemGuideState() };
  }

  try {
    return { available: true, state: normalizeSystemGuideState(JSON.parse(storedValue)) };
  } catch {
    return { available: true, state: createDefaultSystemGuideState() };
  }
}

export function writeSystemGuideState(
  storage: Pick<Storage, 'setItem'>,
  state: SystemGuideState,
): void {
  void tryWriteSystemGuideState(storage, state);
}

export function tryWriteSystemGuideState(
  storage: Pick<Storage, 'setItem'>,
  state: SystemGuideState,
): boolean {
  try {
    storage.setItem(SYSTEM_GUIDE_STORAGE_KEY, JSON.stringify(normalizeSystemGuideState(state)));
    return true;
  } catch {
    return false;
  }
}
