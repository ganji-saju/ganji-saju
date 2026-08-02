import type { Stem, Branch, SipSung } from '@/lib/today-fortune/iljin-rules';
import {
  SAMHAP_GROUPS, BANGHAP_GROUPS,
  isSamhap, isBanghap, isYukhap,
  isBranchChung, isBranchHyung, isBranchHae, isBranchPa, isBranchWonjin,
} from '@/lib/today-fortune/iljin-rules';

export type Element = '목' | '화' | '토' | '금' | '수';

// ── 결정론 유틸 ──────────────────────────────────────────
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickVariant<T>(items: T[], seed: number, offset = 0): T {
  if (items.length === 0) throw new Error('pickVariant: empty items');
  return items[(seed + offset) % items.length];
}

// ── 설명 사전 (naming-policy §2/§3/§5/§8) ────────────────
export const SIPSUNG_DESC: Record<SipSung, string> = {
  비견: '같이 가는 별', 겁재: '경쟁하며 끌어가는 별',
  식신: '나누고 베푸는 별', 상관: '재능을 드러내는 별',
  편재: '움직이는 돈의 별', 정재: '꾸준한 살림의 별',
  편관: '밀어붙이는 별', 정관: '책임과 규범의 별',
  편인: '혼자 깊이 파고드는 별', 정인: '돌봄과 배움의 별',
};

export const ELEMENT_DESC: Record<Element, string> = {
  목: '자라남·시작', 화: '말·밝게 퍼짐', 토: '담아냄·안정', 금: '단단함·결단', 수: '흐름·깊이',
};

export const STEM_ELEMENT: Record<Stem, Element> = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};

// 지지 → 한글(지지+오행). 본문 한자 금지이므로 한글로만 노출.
export const BRANCH_KOR: Record<Branch, string> = {
  子: '자수', 丑: '축토', 寅: '인목', 卯: '묘목', 辰: '진토', 巳: '사화',
  午: '오화', 未: '미토', 申: '신금', 酉: '유금', 戌: '술토', 亥: '해수',
};

const SINSAL_DESC: Record<string, string> = {
  천을귀인: '도움이 오는 별', 문창귀인: '학업·문서의 별', 천덕귀인: '덕을 받는 별',
  월덕귀인: '덕을 받는 별', 금여록: '잔잔한 복의 별', 암록: '숨은 복의 별',
  양인살: '강한 의지의 별', 백호살: '큰 변동의 별', 괴강살: '강단의 별',
  귀문관살: '예민함의 별', 원진살: '어긋남의 별', 겁살: '휘둘리기 쉬운 별',
  공망살: '비어 채워야 할 자리', 망신살: '체면을 조심할 별',
  도화살: '매력과 인기의 별', 역마살: '이동과 변화의 별', 화개살: '학문·예술의 별',
};

const STRENGTH_DESC: Record<string, string> = {
  신강: '본인 기운이 강한 편', 신약: '본인 기운이 다소 약한 편', 중화: '균형 잡힌 상태',
};

// ── 첫 등장 설명 트래커 ──────────────────────────────────
export class TermInk {
  private seen = new Set<string>();
  terms: string[] = [];
  sipsung(name: SipSung): string { return this.mark(name, SIPSUNG_DESC[name]); }
  sinsal(name: string): string { return this.mark(name, SINSAL_DESC[name] ?? '특별한 별'); }
  element(el: Element): string { return this.mark(`${el} 기운`, ELEMENT_DESC[el]); }
  strength(level: string): string {
    const d = STRENGTH_DESC[level];
    return d ? this.mark(level, d) : level;
  }
  private mark(name: string, desc: string): string {
    if (this.seen.has(name)) return name;
    this.seen.add(name);
    this.terms.push(name);
    return `${name}(${desc})`;
  }
}

// 받침(batchim) 인식 조사 헬퍼 — 마지막 한글 음절 기준(괄호 설명 등 뒤 문장부호 무시).
function hasBatchim(word: string): boolean {
  for (let i = word.length - 1; i >= 0; i--) {
    const ch = word.charCodeAt(i);
    if (ch >= 0xac00 && ch <= 0xd7a3) return (ch - 0xac00) % 28 !== 0;
  }
  return false;
}
function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return `${word}${hasBatchim(word) ? withBatchim : withoutBatchim}`;
}

// ── 지지 관계 랭킹 ──────────────────────────────────────
const RELATION_RANK: Record<string, number> = {
  삼합: 6, 충: 6, 방합: 4, 육합: 4, 형: 3, 해: 2, 파: 2, 원진: 2,
};

export function rankJijiRelations(today: Branch, natal: Branch[]): JijiRelation | null {
  const found: JijiRelation[] = [];
  const collect = (
    kind: JijiRelation['kind'],
    matcher: (a: string, b: string) => boolean,
    element: Element | null,
  ) => {
    const matches = natal.filter((b) => b !== today && matcher(today, b));
    if (matches.length > 0) found.push({ kind, element, natalBranches: matches });
  };
  const samEl = (SAMHAP_GROUPS.find((g) => g.branches.includes(today))?.element ?? null) as Element | null;
  const bangEl = (BANGHAP_GROUPS.find((g) => g.branches.includes(today))?.element ?? null) as Element | null;
  collect('삼합', isSamhap, samEl);
  collect('방합', isBanghap, bangEl);
  collect('육합', isYukhap, null);
  collect('충', isBranchChung, null);
  collect('형', isBranchHyung, null);
  collect('해', isBranchHae, null);
  collect('파', isBranchPa, null);
  collect('원진', isBranchWonjin, null);
  if (found.length === 0) return null;
  found.sort((a, b) => RELATION_RANK[b.kind] - RELATION_RANK[a.kind]);
  return found[0];
}

// ── 타입 ────────────────────────────────────────────────
export interface JijiRelation {
  kind: '삼합' | '방합' | '육합' | '충' | '형' | '해' | '파' | '원진';
  element: Element | null; // 삼합/방합만 결과 오행
  natalBranches: Branch[]; // 오늘 지지와 만난 원국 지지들
}

export interface CausalSinsal {
  name: string;
  category: '길신' | '흉신' | '양날의검';
}

export interface CausalInput {
  dayMaster: Stem;
  todayStem: Stem;
  todayBranch: Branch;
  iljinTenGod: SipSung;
  saewoonTenGod: SipSung | null;
  wolwoonTenGod: SipSung | null;
  topRelation: JijiRelation | null;
  yongsin: Element;
  kishin: Element | null;
  dominantElement: Element;
  weakestElement: Element;
  topSinsal: CausalSinsal | null;
  strengthLevel: '신강' | '신약' | '중화' | null;
}

export interface CausalNarrative {
  full: string;
  brief: string;
  terms: string[];
}

// 슬롯 1 — 원인(일진 십성)
function slotCause(i: CausalInput, ink: TermInk, seed: number): string {
  const tg = ink.sipsung(i.iljinTenGod);
  const flavor: Record<SipSung, string> = {
    편관: '책임과 압박이 커지는', 정관: '규칙과 책임을 챙기게 되는',
    편재: '기회와 씀씀이가 커지는', 정재: '살림과 실속을 따지는',
    식신: '표현과 여유가 살아나는', 상관: '재능과 말이 튀는',
    편인: '혼자 파고들고 싶어지는', 정인: '배우고 기대고 싶어지는',
    비견: '내 페이스를 지키게 되는', 겁재: '경쟁심이 올라오는',
  };
  return pickVariant(
    [
      `오늘은 ${tg} 기운이 들어와 ${flavor[i.iljinTenGod]} 날이에요.`,
      `오늘 하루에는 ${tg} 기운이 겹쳐 ${flavor[i.iljinTenGod]} 흐름이 돌아요.`,
    ],
    seed, 0,
  );
}

// 슬롯 2 — 겹침(합충 + 용신/기신)
function slotOverlap(i: CausalInput, ink: TermInk): string {
  const parts: string[] = [];
  if (i.topRelation && i.topRelation.element) {
    const natal = i.topRelation.natalBranches.map((b) => BRANCH_KOR[b]).join('·');
    parts.push(
      `오늘 ${josa(BRANCH_KOR[i.todayBranch], '이', '가')} 사주의 ${josa(natal, '과', '와')} 만나 ${ink.element(i.topRelation.element)}으로 ${josa(i.topRelation.kind, '을', '를')} 이루는데,`,
    );
  }
  const focusEl = i.topRelation?.element ?? STEM_ELEMENT[i.todayStem];
  const dir =
    focusEl === i.yongsin
      ? `모자란 ${ink.element(i.yongsin)}을 채워 주는 반가운 흐름이에요.`
      : focusEl === i.dominantElement || (i.kishin != null && focusEl === i.kishin)
        ? `원래 강한 ${ink.element(i.dominantElement)}을 더 키워 흐름이 무거워질 수 있어요.`
        : `기운이 한쪽으로 쏠리기 쉬우니 균형을 챙기는 게 좋아요.`;
  parts.push(dir);
  return parts.join(' ');
}

// 슬롯 3 — 다층(세운/월운)
function slotLayers(i: CausalInput, ink: TermInk, seed: number): string | null {
  const layers: string[] = [];
  if (i.saewoonTenGod) layers.push(`올해 흐름은 ${ink.sipsung(i.saewoonTenGod)}`);
  if (i.wolwoonTenGod) layers.push(`이번 달은 ${ink.sipsung(i.wolwoonTenGod)}`);
  if (layers.length === 0) return null;
  return pickVariant(
    [
      `여기에 ${layers.join(', ')}이라, 여러 흐름이 겹쳐 마음이 복잡해지기 쉬워요.`,
      `${layers.join(', ')}까지 맞물려, 하루가 조금 더 묵직하게 느껴질 수 있어요.`,
    ],
    seed, 1,
  );
}

// 슬롯 4 — 신살 색채
function slotSinsal(i: CausalInput, ink: TermInk): string | null {
  if (!i.topSinsal) return null;
  const s = ink.sinsal(i.topSinsal.name);
  return i.topSinsal.category === '길신'
    ? `${josa(s, '이', '가')} 함께라 내미는 도움을 잘 잡으면 하루가 한결 수월해요.`
    : `${josa(s, '이', '가')} 함께라 예민해지거나 서두르기 쉬우니 한 박자 쉬어 가세요.`;
}

// 슬롯 5 — 조언(용신 + 십성 대응)
function slotAdvice(i: CausalInput, ink: TermInk, seed: number): string {
  const yong = ink.element(i.yongsin);
  const perTenGod: Record<SipSung, string> = {
    편관: '큰 결정보다 정리와 기록으로', 정관: '원칙을 먼저 정하고',
    편재: '벌이기보다 나갈 것부터 챙기고', 정재: '실속을 확인하며',
    식신: '가볍게 표현하고 나누며', 상관: '한 박자 눌러 담아 말하고',
    편인: '혼자 정리하는 시간을 두고', 정인: '기대고 배우는 쪽으로',
    비견: '내 페이스를 지키며', 겁재: '경쟁보다 협력으로',
  };
  return pickVariant(
    [
      `그래서 오늘은 ${yong}을 채우듯, ${perTenGod[i.iljinTenGod]} 천천히 가면 좋아요.`,
      `오늘은 ${perTenGod[i.iljinTenGod]}, ${yong}을 곁들이면 흐름이 한결 부드러워져요.`,
    ],
    seed, 2,
  );
}

export function buildCausalNarrative(
  input: CausalInput,
  opts: { seed?: string } = {},
): CausalNarrative {
  const seed = hashSeed(opts.seed ?? `${input.dayMaster}${input.todayStem}${input.todayBranch}`);

  const briefInk = new TermInk();
  const brief = [slotCause(input, briefInk, seed), slotAdvice(input, briefInk, seed)]
    .filter((s): s is string => Boolean(s))
    .join(' ');

  const fullInk = new TermInk();
  const full = [
    slotCause(input, fullInk, seed),
    slotOverlap(input, fullInk),
    slotLayers(input, fullInk, seed),
    slotSinsal(input, fullInk),
    slotAdvice(input, fullInk, seed),
  ]
    .filter((s): s is string => Boolean(s))
    .join(' ');

  return { full, brief, terms: fullInk.terms };
}
