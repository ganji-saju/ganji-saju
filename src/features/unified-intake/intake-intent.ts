export type IntakeIntent = 'today' | 'saju';

export function parseIntakeIntent(value: string | null | undefined): IntakeIntent | null {
  return value === 'today' || value === 'saju' ? value : null;
}
