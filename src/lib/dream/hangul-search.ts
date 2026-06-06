// 한글 음절 분해 유틸 — 꿈 사전 검색의 초성/자모 매칭용.
// 유니코드 한글 음절: 0xAC00(가) ~ 0xD7A3(힣). code = 초성*588 + 중성*28 + 종성.

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const;

const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const CHOSUNG_SET = new Set<string>(CHOSUNG);

function isHangulSyllable(code: number): boolean {
  return code >= HANGUL_BASE && code <= HANGUL_LAST;
}

export function toChosung(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (isHangulSyllable(code)) {
      out += CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

export function toJamo(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (isHangulSyllable(code)) {
      const offset = code - HANGUL_BASE;
      out += CHOSUNG[Math.floor(offset / 588)];
      out += JUNGSEONG[Math.floor((offset % 588) / 28)];
      out += JONGSEONG[offset % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

export function isChosungOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  for (const ch of trimmed) {
    if (!CHOSUNG_SET.has(ch)) return false;
  }
  return true;
}
