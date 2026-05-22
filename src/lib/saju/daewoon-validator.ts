// 2026-05-22 Step3 Phase D — 대운 본문 한자·명리용어 검증(회귀 가드).
//   build-lifetime-report.ts 의 대운 사이클 본문(hook/chapterBody/mental/…)이
//   naming-policy 를 지키는지(한자 0, 명리 전문용어 0) 검사하는 순수 함수.
//   런타임 강제(throw)는 하지 않고, 테스트·측정에서 호출해 회귀를 막는다.
//   허용: '대운'(naming-policy §7) · 12운성 한글(장생/제왕 등).

export interface DaewoonValidationResult {
  ok: boolean;
  reasons: string[];
}

/** 명리 전문용어 — 일상어로 풀어써야 하는 어휘. '대운'·12운성 한글은 제외(허용). */
export const DAEWOON_BANNED_TERMS: readonly string[] = [
  '천간', '일간', '일주', '월주', '시주', '연주',
  '시지', '월지', '연지',
  '격국', '용신', '신강', '신약', '순행', '역행', '교운기',
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  '원진', '공망', '신살', '양인', '도화', '역마', '화개',
];

// '지지'는 동사어미('강해지지만', '흩어지지 않다')에서 substring 으로 잡혀 false positive 가 난다.
// 명리 명사 용법('지지의', '지지가', '지지 4개')만 매칭한다.
const JIJI_TERM = /지지(?=[의가은는을를에과와]|\s*\d)/;

const HANJA = /[一-鿿]/g;

export function validateDaewoonText(text: string): DaewoonValidationResult {
  const reasons: string[] = [];

  const hanja = text.match(HANJA);
  if (hanja && hanja.length > 0) {
    reasons.push(`한자 ${hanja.length}건: ${[...new Set(hanja)].join('')}`);
  }

  for (const term of DAEWOON_BANNED_TERMS) {
    if (text.includes(term)) reasons.push(`금지 용어: ${term}`);
  }
  if (JIJI_TERM.test(text)) reasons.push('금지 용어: 지지');

  return { ok: reasons.length === 0, reasons };
}
