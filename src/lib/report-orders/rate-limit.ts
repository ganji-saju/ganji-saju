const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 5;
// ponytail: 인스턴스별 메모리 카운터 — 서버리스 인스턴스가 여럿이면 합산되지 않는다. 스팸이 실제로 오면 DB/엣지 제한으로.
const recent = new Map<string, number[]>();

/** 같은 IP 10분에 5건까지. 넘으면 false. */
export function takeReportOrderSlot(ip: string, now = Date.now()): boolean {
  // 창이 지난 다른 IP 기록은 지운다 — 오래 사는 인스턴스에서 Map 이 계속 커지지 않게.
  for (const [key, times] of recent) {
    if (key !== ip && times.every((t) => now - t >= RATE_WINDOW_MS)) recent.delete(key);
  }
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    recent.set(ip, hits);
    return false;
  }
  hits.push(now);
  recent.set(ip, hits);
  return true;
}

export function rateLimitSizeForTest() {
  return recent.size;
}

export function resetReportOrderRateLimitForTest() {
  recent.clear();
}
