export const SYSTEM_GUIDE_OPEN_EVENT = 'ganji-saju:open-system-guide';

export function openSystemGuide(stepIndex = 0) {
  window.dispatchEvent(
    new CustomEvent(SYSTEM_GUIDE_OPEN_EVENT, { detail: { stepIndex } }),
  );
}
