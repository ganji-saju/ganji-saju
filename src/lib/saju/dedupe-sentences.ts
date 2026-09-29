// 2026-09-27 — 한 풀이 안 반복 문장 제거(사용자 피드백: "같은 말을 되풀이하고 문맥이 안 맞는다").
//   측정(docs/reading-repetition-2026-09-27.md): 한 풀이 안 반복 문장 평균 23~34개 — 같은 근거 문장을 여러 섹션이 각자 붙인 결과.
//   풀이 객체를 필드 순서대로 훑으며 **앞에서 이미 나온 문장(15자 이상)** 을 뒤에서 뺀다. 필드가 통째로 비면 원문을 둔다(빈 칸 금지).
//   짧은 문구(제목·라벨·칩)는 건드리지 않는다.
const MIN_SENTENCE = 15;
const SPLIT = /(?<=[.!?。])\s+/;

export function dedupeSentencesDeep<T>(value: T, seen: Set<string> = new Set()): T {
  if (typeof value === 'string') {
    const parts = value.split(SPLIT);
    if (parts.length === 0) return value;
    const kept = parts.filter((part) => {
      const key = part.trim();
      if (key.length < MIN_SENTENCE) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const joined = kept.join(' ').trim();
    return (joined || value) as T;
  }
  if (Array.isArray(value)) {
    // 목록의 문자열 항목이 통째로 앞과 같으면 항목을 뺀다(한 줄이 빠져도 빈 칸이 생기지 않는다).
    const out: unknown[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        const parts = item.split(SPLIT).filter((part) => part.trim().length >= MIN_SENTENCE);
        const allSeen = parts.length > 0 && parts.every((part) => seen.has(part.trim()));
        if (allSeen) continue;
        out.push(dedupeSentencesDeep(item, seen));
      } else {
        out.push(dedupeSentencesDeep(item, seen));
      }
    }
    return out as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, dedupeSentencesDeep(v, seen)])) as T;
  }
  return value;
}

// 2026-09-29 — 오늘운세 한 풀이에 '오늘'이 평균 21번 나와 어색했다(사용자 피드백: "오늘은 오늘은 하면서").
//   한 문단 안에서 첫 '오늘'만 두고 뒤에 다시 나오는 '오늘은 '·'오늘 ' 을 뺀다('오늘의'·'오늘도' 등은 둔다).
//   문자열 목록(추천·피할 행동 등)은 한 문단처럼 이어 읽히므로 목록 전체에서 첫 '오늘'만 둔다.
export function thinRepeatedTodayDeep<T>(value: T, state = { seen: false }): T {
  if (typeof value === 'string') {
    const first = state.seen ? -2 : value.indexOf('오늘');
    if (first === -1) return value;
    state.seen = true;
    const head = value.slice(0, first + 2);
    return (head + value.slice(first + 2).replace(/오늘은? /g, '')) as T;
  }
  if (Array.isArray(value)) {
    const shared = { seen: false };
    return value.map((v) => thinRepeatedTodayDeep(v, typeof v === 'string' ? shared : { seen: false })) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, thinRepeatedTodayDeep(v)])) as T;
  }
  return value;
}
