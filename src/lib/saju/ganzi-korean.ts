const STEM_HANJA_TO_KOREAN: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};

const BRANCH_HANJA_TO_KOREAN: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

export function toKoreanGanziStem(ganzi: string): string {
  if (!ganzi) return '';
  const first = ganzi.charAt(0);
  return STEM_HANJA_TO_KOREAN[first] ?? first;
}

/** 단일 천간 글자 → 한글 (예: '戊' → '무'). */
export function stemCharToKorean(stem: string): string {
  return STEM_HANJA_TO_KOREAN[stem] ?? stem;
}

/** 단일 지지 글자 → 한글 (예: '酉' → '유'). */
export function branchCharToKorean(branch: string): string {
  return BRANCH_HANJA_TO_KOREAN[branch] ?? branch;
}

export function toKoreanGanziBranch(ganzi: string): string {
  if (!ganzi) return '';
  const second = ganzi.charAt(1);
  return BRANCH_HANJA_TO_KOREAN[second] ?? second;
}

export function toKoreanGanzi(ganzi: string): string {
  if (!ganzi) return '';
  return `${toKoreanGanziStem(ganzi)}${toKoreanGanziBranch(ganzi)}`;
}
