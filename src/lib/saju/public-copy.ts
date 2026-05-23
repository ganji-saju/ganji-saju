// 2026-05-14: 친근 용어 매핑은 src/lib/saju/terminology.ts 의 단일 소스를
// import 해 사용한다. 아래 TERM_REPLACEMENTS 는 호환을 위해 추가 패턴만 보존.
import { FRIENDLY_TERM_MAP } from '@/lib/saju/terminology';

// ──────────────────────────────────────────────────────────────────────────
// 2026-05-23: 받침 기반 조사 자동정정 — 치환 후 조사 어긋남(class a) 근본 정정.
//   FRIENDLY_TERM_MAP / TERM_REPLACEMENTS 가 한자 술어를 일상어로 바꿀 때 조사는
//   그대로 두므로, 원어(받침O '명식/합충/공망/신살')의 은/을/이/으로 가 모음·ㄹ 종결
//   일상어('내 사주표/만남과 변화 신호/비어있는 자리/작은 신호/관계 역할')로 바뀐 뒤
//   '신호은·자리은·사주표이·역할으로·힌트으로' 처럼 어긋난다. 아래 정규화가 치환 결과
//   단어 뒤 조사를 실제 마지막 글자 받침에 맞춰 교정한다.
// ──────────────────────────────────────────────────────────────────────────

/** 마지막 글자가 한글이고 종성(받침)이 있으면 true. 한글 아니면 null. */
function hasBatchim(ch: string): boolean | null {
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/** 마지막 글자 받침이 ㄹ(종성 index 8)이면 true — '으로/로' 분기에 필요. */
function isRieulFinal(ch: string): boolean {
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}

/**
 * 조사 정규화 대상 단어 — FRIENDLY_TERM_MAP + TERM_REPLACEMENTS 가 출력하는,
 * 조사가 따라붙을 수 있는 명사형 결과만 enumerate (bounded). 일반 한국어 동사
 * 어미(돕는/맡는/쓰이는)·합성어(통로/타이밍)를 건드리지 않도록 화이트리스트로 제한.
 * 긴 단어를 먼저 매칭하기 위해 길이 내림차순 정렬.
 */
const JOSA_NORMALIZE_WORDS: readonly string[] = [
  '내 사주표', '타고난 사주', '내 사주', '사주표', '사주',
  '선택 힌트', '판단 힌트', '풀이 안내', '계산 정보', '사주 정보', '저장된 정보',
  '도움이 되는 핵심 기운', '도움이 되는 보조 기운', '도움이 되는 기운 후보',
  '겉으로 드러나는 기운', '숨은 기운', '조절할 기운', '작은 신호', '만남과 변화 신호',
  '관계 역할', '책임·도전 역할', '돈·기회 역할', '표현·재능 역할', '배움·휴식 역할',
  '동료·경쟁 역할', '책임·도전 자리', '돈·기회 자리', '표현·재능 자리', '배움·휴식 자리',
  '주체·자립 자리', '비어있는 자리', '안쪽 자리', '내 핵심 기질', '컨디션 흐름',
  '긴 흐름', '올해 흐름', '이번 달 흐름', '오늘 하루 흐름', '오늘 할 일', '태어난 계절 기운',
].slice().sort((a, b) => b.length - a.length);

const JOSA_WORD_ALT = JOSA_NORMALIZE_WORDS.map((w) =>
  w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|');

// 조사 뒤 경계: 공백/문장부호/끝. '이다·입니다' 등 서술격(이+다/ㅂ니다)을 건드리지
// 않도록 조사 직후가 한글이면 정규화하지 않는다(아래 lookahead).
const JOSA_SUBJECT_RE = new RegExp(
  `(${JOSA_WORD_ALT})(을|를|은|는|이|가|과|와)(?=[\\s.,!?。、)\\]}"'’”·…]|$)`,
  'gu'
);
const JOSA_DIRECTION_RE = new RegExp(
  `(${JOSA_WORD_ALT})(으로|로)(?=[\\s.,!?。、)\\]}"'’”·…]|$)`,
  'gu'
);

const SUBJECT_CONSONANT = new Set(['을', '은', '이', '과']);
const SUBJECT_VOWEL_FOR: Record<string, string> = { 을: '를', 은: '는', 이: '가', 과: '와' };
const SUBJECT_CONSONANT_FOR: Record<string, string> = { 를: '을', 는: '은', 가: '이', 와: '과' };

/** 치환 결과 단어 뒤 조사를 실제 받침에 맞춰 정정. */
function normalizeParticles(text: string): string {
  let out = text.replace(JOSA_SUBJECT_RE, (_m, word: string, josa: string) => {
    const last = word[word.length - 1];
    const batchim = hasBatchim(last);
    if (batchim === null) return `${word}${josa}`;
    if (batchim && !SUBJECT_CONSONANT.has(josa)) {
      // 받침O 인데 모음형 조사 → 자음형으로
      return `${word}${SUBJECT_CONSONANT_FOR[josa] ?? josa}`;
    }
    if (!batchim && SUBJECT_CONSONANT.has(josa)) {
      // 받침X 인데 자음형 조사 → 모음형으로
      return `${word}${SUBJECT_VOWEL_FOR[josa] ?? josa}`;
    }
    return `${word}${josa}`;
  });

  out = out.replace(JOSA_DIRECTION_RE, (_m, word: string, form: string) => {
    const last = word[word.length - 1];
    const batchim = hasBatchim(last);
    if (batchim === null) return `${word}${form}`;
    const rieul = isRieulFinal(last);
    // 모음 종결 OR ㄹ 종결 → '로'; 그 외 받침 → '으로'.
    const wantsRo = !batchim || rieul;
    return `${word}${wantsRo ? '로' : '으로'}`;
  });

  return out;
}

/**
 * 인접 단어 중복 제거 — 치환이 만들어내는 '긴 흐름 흐름'(대운 흐름→긴 흐름+흐름),
 * '오늘 오늘 하루 흐름'(오늘 일진→오늘+오늘 하루 흐름) 같은 doubling 정정.
 *   대상 단어를 한정해(흐름/오늘/기운/자리/역할/사주/기질/신호) 일반 강조 반복
 *   ('점점 점점' 등)을 보존한다.
 */
const DEDUPE_WORDS = ['흐름', '오늘', '기운', '자리', '역할', '사주', '기질', '신호', '기준'];
// (^|비단어경계) 단어 + 공백 + 동일단어 + (조사 또는 경계).
//   - 앞 글자가 한글이면 단어 중간이므로 매치 안 함 → 합성어 보존.
//   - 둘째 단어 뒤는 경계뿐 아니라 조사(이/가/은/는/을/를/의/도/만/로…)도 허용해
//     '흐름 흐름이'(임자 일주 title + ' 흐름이' 템플릿) 같은 raw 중복도 정정.
const DEDUPE_JOSA = '이|가|은|는|을|를|과|와|의|에|도|만|로|으로|이라|이다|입니다|라|이며|이고';
const DEDUPE_RE = new RegExp(
  `(^|[^가-힣])(${DEDUPE_WORDS.join('|')})\\s+\\2(?=(?:${DEDUPE_JOSA})?(?:[\\s.,!?。、)\\]]|$))`,
  'gu'
);
function collapseAdjacentDuplicateWords(text: string): string {
  return text.replace(DEDUPE_RE, '$1$2');
}

const TECHNICAL_SENTENCE_PATTERNS = [
  /(?:강약|격국|용신|합충|공망|신살|십신|천간|지지|지장간)\s*메모:\s*[^.!?。]+[.!?。]?\s*/gu,
  /전문적으로는\s*[^.!?。]+[.!?。]\s*/gu,
  /factJson[^.!?。]*[.!?。]?\s*/giu,
  /fact_json[^.!?。]*[.!?。]?\s*/giu,
  /evidenceJson[^.!?。]*[.!?。]?\s*/giu,
  /evidence_json[^.!?。]*[.!?。]?\s*/giu,
  /engine[_ -]?version[^.!?。]*[.!?。]?\s*/giu,
  /rule[_ -]?set[_ -]?version[^.!?。]*[.!?。]?\s*/giu,
  /(?:정관격|편관격|정재격|편재격|식신격|상관격|정인격|편인격|비견격|겁재격)은\s*[^.!?。]+[.!?。]?\s*/gu,
  /(?:중화|신강|신약)은\s*[^.!?。]+[.!?。]?\s*/gu,
  /이\s*(?:명식|원국|사주 구조)은\s*가장 먼저\s*[^.!?。]+[.!?。]?\s*/gu,
  /(?:파|반합|육합|충|형|해)(?:\s*·\s*(?:파|반합|육합|충|형|해))*\s*흐름은\s*[^.!?。]+[.!?。]?\s*/gu,
];

const SCORE_PATTERNS = [
  /(?:총운|연애운|재물운|직장운|직업운|관계운|전체 흐름)(?:은|는)?\s*\d+점\s*(?:기준입니다|입니다|으로)?[.,]?\s*/gu,
  /[가-힣·/\s]+흐름(?:은|는)?\s*\d+점\s*(?:기준입니다|입니다|으로)?[.,]?\s*/gu,
  /\d+점\s*기준입니다[.,]?\s*/gu,
];

const TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/판단 기준/gu, '판단 힌트'],
  [/선택 기준/gu, '선택 힌트'],
  [/행동 기준/gu, '오늘 할 일'],
  [/풀이 기준/gu, '풀이 안내'],
  [/계산 기준/gu, '계산 정보'],
  [/명식 기준/gu, '사주 정보'],
  [/저장본 기준/gu, '저장된 정보'],
  [/기준으로는/gu, '정보로는'],
  [/기준으로/gu, '바탕으로'],
  [/용신·보완축/gu, '균형을 잡는 힌트'],
  [/용신/gu, '보완할 점'],
  [/희신/gu, '도움이 되는 기운'],
  [/기신/gu, '조절할 기운'],
  [/격국/gu, '반복되는 역할'],
  [/강약/gu, '컨디션 균형'],
  [/합충/gu, '관계와 변화 신호'],
  [/공망/gu, '비어 있는 흐름'],
  [/신살/gu, '보조 신호'],
  [/십신/gu, '관계 역할'],
  [/천간/gu, '겉으로 드러나는 기질'],
  [/지장간/gu, '숨은 기질'],
  [/원국/gu, '타고난 사주'],
  [/명식/gu, '내 사주'],
  [/일간/gu, '타고난 기질'],
  [/일주(?!일)/gu, '태어난 날'],
  [/시주/gu, '태어난 시간'],
  [/월령/gu, '태어난 계절'],
  [/대운/gu, '긴 흐름'],
  [/세운/gu, '올해 흐름'],
  [/월운/gu, '이번 달 흐름'],
  [/연운/gu, '올해 흐름'],
  [/일진/gu, '하루 흐름'],
  // 2026-05-23: 격국 전체 명칭은 FRIENDLY_TERM_MAP(먼저 실행)에서 "…자리" 로
  //   치환되므로 여기 도달하지 않는다. 잔여 단독 '…격' 안전망만 남긴다.
  [/정돈형/gu, '차분히 정리하는 흐름'],
  [/밀어붙이는/gu, '무리하게 진행하는'],
  [/밀어붙이기/gu, '무리하게 진행하기'],
  [/밀어붙이면/gu, '무리하면'],
  [/밀어도 되는/gu, '진행하기 좋은'],
  [/밀어도/gu, '진행해도'],
  [/밀기보다/gu, '무리하기보다'],
  [/밀고/gu, '진행하고'],
];

export function simplifySajuCopy(value: string | null | undefined) {
  if (!value) return '';

  let text = value.replace(/\s+/g, ' ').trim();

  for (const pattern of TECHNICAL_SENTENCE_PATTERNS) {
    text = text.replace(pattern, '');
  }

  for (const pattern of SCORE_PATTERNS) {
    text = text.replace(pattern, '');
  }

  // 2026-05-14: 중앙 글로서리(FRIENDLY_TERM_MAP) 를 먼저 적용해 한자 술어를
  // 일상어로 치환한 뒤, 기존 TERM_REPLACEMENTS 로 잔여 매핑을 덮어쓴다.
  for (const [pattern, replacement] of FRIENDLY_TERM_MAP) {
    text = text.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // 2026-05-23: 치환 잔여 정리.
  //   1) 일부 한자 술어 치환이 만든 비문(특정 합성 깨짐) 보정.
  //   2) 치환 결과 단어 뒤 조사를 실제 받침에 맞춰 자동정정 (normalizeParticles).
  //      — 기존 사주표/정리/표현/시작/기준/생각/힌트·안내·정보/흐름 개별 정정을 포괄.
  //   3) 치환이 만든 인접 단어 중복(긴 흐름 흐름 / 오늘 오늘…) 제거.
  //   서술격 조사('이다/입니다' 등)는 normalizeParticles 의 경계 lookahead 로 보존.
  let cleaned = text
    .replace(/채워속에 깔린 기질\s*않는/gu, '채워지지 않는')
    .replace(/정보로는/gu, '정보로 보면');

  cleaned = normalizeParticles(cleaned);
  cleaned = collapseAdjacentDuplicateWords(cleaned);

  return cleaned
    .replace(/\s+([.,!?。])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function simplifySajuCopyList(items: Array<string | null | undefined>, max?: number) {
  const cleaned = items
    .map((item) => simplifySajuCopy(item))
    .filter(Boolean);

  return typeof max === 'number' ? cleaned.slice(0, max) : cleaned;
}

export function limitSajuSentences(value: string | null | undefined, maxSentences = 2) {
  const cleaned = simplifySajuCopy(value);
  if (!cleaned) return '';

  const sentences = cleaned
    .split(/(?<=[.!?。])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) return cleaned;
  return sentences.slice(0, maxSentences).join(' ');
}
