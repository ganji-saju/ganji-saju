// 연도 → 연주 간지(한자). 서기 4년 = 甲子 기준.
//   stemIndex = (year - 4) mod 10, branchIndex = (year - 4) mod 12.
// pillars.ts 의 STEMS/BRANCHES 와 동일 순서(순수 함수, 엔진 비의존).
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function yearToGanji(year: number): string {
  const stem = STEMS[mod(year - 4, 10)];
  const branch = BRANCHES[mod(year - 4, 12)];
  return `${stem}${branch}`;
}
