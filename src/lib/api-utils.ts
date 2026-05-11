export function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function readStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getCurrentKoreaYear(): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
  const parsed = Number.parseInt(formatted, 10);
  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

export function parseTargetYear(value: unknown): number {
  const year =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : getCurrentKoreaYear();
  return Number.isInteger(year) && year >= 1900 && year <= 2100
    ? year
    : getCurrentKoreaYear();
}
