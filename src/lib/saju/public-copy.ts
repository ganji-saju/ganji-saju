// 2026-05-14: 친근 용어 매핑은 src/lib/saju/terminology.ts 의 단일 소스를
// import 해 사용한다. 아래 TERM_REPLACEMENTS 는 호환을 위해 추가 패턴만 보존.
import { FRIENDLY_TERM_MAP } from '@/lib/saju/terminology';

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
  [/정관격|편관격|정재격|편재격|식신격|상관격|정인격|편인격|비견격|겁재격/gu, '역할 흐름'],
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

  return text
    // 2026-05-23: '명식' → '내 사주표' 치환 후 받침 기준 조사가 어긋나는 문제 정정.
    //   '명식'(ㄱ받침)은 을/은/이/과, '사주표'(모음 종결)는 를/는/가/와 가 맞다.
    //   FRIENDLY_TERM_MAP 치환이 조사는 그대로 두어 '내 사주표을' 등이 남던 버그 차단.
    //   '이다/이라' 같은 서술격 조사는 건드리지 않도록 조사 뒤 경계(공백/문장부호/끝)를 요구.
    .replace(/사주표을(?=[\s.,!?。)\]]|$)/gu, '사주표를')
    .replace(/사주표은(?=[\s.,!?。)\]]|$)/gu, '사주표는')
    .replace(/사주표이(?=[\s.,!?。)\]]|$)/gu, '사주표가')
    .replace(/사주표과(?=[\s.,!?。)\]]|$)/gu, '사주표와')
    .replace(/정리을/gu, '정리를')
    .replace(/정리이/gu, '정리가')
    .replace(/표현를/gu, '표현을')
    .replace(/표현가/gu, '표현이')
    .replace(/시작를/gu, '시작을')
    .replace(/시작가/gu, '시작이')
    .replace(/기준를/gu, '기준을')
    .replace(/기준가/gu, '기준이')
    .replace(/생각를/gu, '생각을')
    .replace(/생각가/gu, '생각이')
    .replace(/채워속에 깔린 기질\s*않는/gu, '채워지지 않는')
    .replace(/관계와 변화 신호[은는]\s*[^.!?。]+[.!?。]?\s*/gu, '')
    .replace(/비어 있는 흐름[은는]\s*[^.!?。]+[.!?。]?\s*/gu, '')
    .replace(/보조 신호[은는]\s*[^.!?。]+[.!?。]?\s*/gu, '')
    .replace(/조절할 기운[은는]\s*[^.!?。]+[.!?。]?\s*/gu, '')
    .replace(/(판단 힌트|선택 힌트|풀이 안내|계산 정보)을/gu, '$1를')
    .replace(/(올해 분위기|이번 달 분위기|긴 흐름)이/gu, '$1가')
    .replace(/정보로는/gu, '정보로 보면')
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
