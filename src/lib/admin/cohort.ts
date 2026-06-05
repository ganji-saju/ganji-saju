// 가입 코호트별 D7/D30 잔존율(순수). admin_user_summary 만으로 계산.
// DN 잔존율 = (last_active_at − signup_at ≥ N일) 비율. 성숙 코호트만 측정.
export interface CohortRow {
  signup_at: string;
  last_active_at: string;
  ltv_won: number;
}
export interface CohortMetric {
  cohort: string;
  size: number;
  avgLtvWon: number;
  d7: number | null;
  d30: number | null;
  d7Measurable: boolean;
  d30Measurable: boolean;
}

const DAY = 86_400_000;

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthEndMs(key: string): number {
  const [y, m] = key.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return Date.UTC(ny, nm - 1, 1);
}

export function buildCohortRetention(rows: CohortRow[], nowIso: string): CohortMetric[] {
  const now = new Date(nowIso).getTime();
  const groups = new Map<string, CohortRow[]>();
  for (const row of rows) {
    const k = monthKey(row.signup_at);
    const arr = groups.get(k);
    if (arr) arr.push(row);
    else groups.set(k, [row]);
  }
  const out: CohortMetric[] = [];
  for (const [cohort, list] of groups) {
    const size = list.length;
    const avgLtvWon = Math.round(list.reduce((s, r) => s + r.ltv_won, 0) / size);
    const end = monthEndMs(cohort);
    const d7Measurable = now >= end + 7 * DAY;
    const d30Measurable = now >= end + 30 * DAY;
    const lasted = (r: CohortRow, n: number) =>
      new Date(r.last_active_at).getTime() - new Date(r.signup_at).getTime() >= n * DAY;
    const d7 = d7Measurable ? list.filter((r) => lasted(r, 7)).length / size : null;
    const d30 = d30Measurable ? list.filter((r) => lasted(r, 30)).length / size : null;
    out.push({ cohort, size, avgLtvWon, d7, d30, d7Measurable, d30Measurable });
  }
  return out.sort((a, b) => b.cohort.localeCompare(a.cohort));
}
