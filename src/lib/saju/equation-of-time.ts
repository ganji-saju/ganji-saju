// 2026-05-15 PR 8 — 01_만세력_일진계산_모듈.md §5-2 진태양시 보정 정밀화.
// 기존 birth-location.ts 는 경도 차이만 보정 (1도 = 4분). 진짜 진태양시는 균시차
// (Equation of Time, ±16분) 까지 더해야 정확. 균시차는 지구 공전 궤도의 이심률 +
// 자전축 기울기 때문에 연중 +14분 ~ -16분 변동.
//
// 정확도: ±30초 (실용 충분).
// 출처: Astronomical Algorithms (Jean Meeus, 1998) 25장 / NOAA Solar Calculator.

/**
 * 그레고리력 → 율리우스 적일 (JDN).
 * 1582-10-15 이후 그레고리력 원칙. 정수만 반환.
 */
export function gregorianToJDN(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
}

/**
 * 그레고리력 + 시각 → 율리우스일 (JD, 소수점 포함).
 * 표준시 (KST 등) 가 아니라 UT(UTC) 원칙 시각을 넣어야 정확.
 */
export function gregorianToJD(
  year: number,
  month: number,
  day: number,
  hourUTC = 0,
  minuteUTC = 0,
  secondUTC = 0
): number {
  const jdn = gregorianToJDN(year, month, day);
  const fraction = (hourUTC - 12) / 24 + minuteUTC / 1440 + secondUTC / 86400;
  return jdn + fraction;
}

/**
 * 균시차(Equation of Time) — 평균태양시와 진태양시의 차이 (분).
 * + 값: 진태양시가 평균태양시보다 앞섬 (해가 일찍 남중).
 * - 값: 진태양시가 평균태양시보다 뒤짐 (해가 늦게 남중).
 *
 * Meeus 25장 간이판 공식.
 *
 * @param jd 율리우스일 (UT 원칙)
 * @returns 분 단위 (-16 ~ +14 범위)
 */
export function equationOfTimeMinutes(jd: number): number {
  // 2000.0 원칙 율리우스 세기.
  const T = (jd - 2451545.0) / 36525.0;

  // 태양의 평균 황경 (도).
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = ((L0 % 360) + 360) % 360;

  // 태양의 평균 근점이각.
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mrad = (M * Math.PI) / 180;

  // 궤도 이심률.
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

  // 황도 경사각.
  const eps = 23.439291 - 0.0130042 * T;
  const epsHalfRad = (eps / 2) * (Math.PI / 180);
  const y = Math.tan(epsHalfRad) ** 2;

  const sin2L0 = Math.sin(2 * (L0 * Math.PI) / 180);
  const sinM = Math.sin(Mrad);
  const cos2L0 = Math.cos(2 * (L0 * Math.PI) / 180);
  const sin4L0 = Math.sin(4 * (L0 * Math.PI) / 180);
  const sin2M = Math.sin(2 * Mrad);

  // EoT in radians.
  const eotRad =
    y * sin2L0
    - 2 * e * sinM
    + 4 * e * y * sinM * cos2L0
    - 0.5 * y * y * sin4L0
    - 1.25 * e * e * sin2M;

  // 라디안 → 도 → 분 (1도 = 4분).
  const eotDeg = (eotRad * 180) / Math.PI;
  return eotDeg * 4;
}

/**
 * 진태양시 종합 보정 (분):
 *   = (출생지 경도 - 표준 자오선) × 4    [경도 보정]
 *     + 균시차(EoT, 그날 원칙)            [천체 보정]
 *
 * 한국 표준시 (KST, 동경 135°) 원칙, 서울 (126.978°) 출생자는:
 *   경도 보정 = (126.978 - 135) × 4 ≈ -32 분
 *   균시차    = -14 ~ +14 분 (날짜별)
 *   합계      = -46 ~ -18 분 (날짜별 변동)
 */
export function trueSolarTimeOffsetMinutes(params: {
  longitude: number;
  /** 보정 원칙 표준 자오선 (한국 = 135°). */
  standardMeridian?: number;
  /** 출생 날짜 (그레고리력). 균시차 계산용. */
  year: number;
  month: number;
  day: number;
  /** 출생 시각 (KST). 균시차 추정용 — 정확도 ±10초로 충분. */
  hour?: number;
  minute?: number;
}): number {
  const standardMeridian = params.standardMeridian ?? 135;
  const longitudeOffset = (params.longitude - standardMeridian) * 4;

  // KST 시각을 대략 UT 로 환산 (KST = UT + 9).
  const hour = params.hour ?? 12;
  const minute = params.minute ?? 0;
  const utHour = hour - 9;
  const jd = gregorianToJD(params.year, params.month, params.day, utHour, minute);
  const eot = equationOfTimeMinutes(jd);

  return Math.round(longitudeOffset + eot);
}
