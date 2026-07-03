// 2026-07-03 — 오늘운세 공개 공유 티저의 날짜 고정(?d=YYYY-MM-DD) 파서.
// 엄격 검증(형식+실존 날짜)만 통과. KST 정오 Date 로 반환해 KST 경계(자정) 오차를 피한다.
// 실패 시 null → 호출측이 "오늘"로 폴백.

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseShareDateKey(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = DATE_KEY_RE.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) return null;
  // KST 정오로 고정 — getTodayPillarSnapshot 류의 KST 일자 판정이 경계에서 흔들리지 않게.
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  // JS Date 는 2월 30일 등을 자동 이월시키므로 역검증(실존 날짜만 통과).
  const kstCheck = new Date(date.getTime() + 9 * 3600 * 1000);
  if (
    kstCheck.getUTCFullYear() !== year ||
    kstCheck.getUTCMonth() + 1 !== month ||
    kstCheck.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}
