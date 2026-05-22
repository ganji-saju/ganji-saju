# 점수 시스템 Phase 1 — 계산 엔진 작업 지시서

> `saju-score-spec.md` §11의 Phase 1(점수 계산 엔진 구축)을 Claude Code에 위임하기 위한 **즉시 실행 가능한 작업 지시서**.
>
> 이 문서는 *코드를 직접 작성*하기 위한 명세입니다. UI 작업은 Phase 3에서 별도로 진행 — 이 단계에서는 *계산 로직만* 작성합니다.
>
> 참조: `saju-score-spec.md` (전체 스펙), `naming-policy.md` (어휘 정책).

> **⚠️ 구현 현황 정정 (2026-05-22 검수 반영)**
> 체크리스트의 'Tailwind 토큰 등록(`tailwind.config.ts`)'은 실제로 **Tailwind v4 `@theme`**(`src/app/styles/tokens.css`)로 구현 — `tailwind.config.ts` 없음. (Phase 1 엔진 로직 자체는 토큰과 무관.)

---

## 0. Phase 1의 목표와 비목표

### 목표 (DO)

- F1~F5 5개 계산 함수 작성 (TypeScript)
- 필요한 명리 헬퍼 함수 작성 (12운성·오행 카운트·합충 분석)
- `computeSajuScore()` 메인 함수 작성
- 5단계 라벨 + 오행 차트 데이터 생성 함수
- 50개 테스트 케이스 데이터셋 생성
- 분포 검증 함수 작성
- 단위 테스트 + 분포 검증 테스트 실행
- 분포가 어긋나면 가중치 재조정

### 비목표 (DON'T)

- ❌ React 컴포넌트 작성 (Phase 3)
- ❌ Tailwind 토큰 추가 (Phase 2)
- ❌ LLM 본문 연계 (Phase 5)
- ❌ UI 와이어프레임 구현 (Phase 3)
- ❌ 무료/유료 결제 모달 (Phase 6)

**Phase 1은 *순수 계산 엔진*만 완성합니다.** 다른 작업은 후속 Phase.

---

## 1. 산출물 — 9개 파일

작업 완료 시 다음 파일 구조가 생겨야 합니다:

```
/lib/saju-score/
├── types.ts                       # 타입 정의 (SajuData, SajuScore 등)
├── formulas.ts                    # F1~F5 5개 계산 함수
├── helpers.ts                     # 명리 헬퍼 (12운성, 오행 카운트 등)
├── labels.ts                      # 5단계 라벨 + 색상 토큰 매핑
├── ohaeng.ts                      # 오행 차트 데이터 생성
├── index.ts                       # computeSajuScore() 메인 함수
├── test-cases.ts                  # 50개 테스트 케이스 데이터
├── distribution.ts                # 분포 검증 함수
└── __tests__/
    ├── formulas.test.ts           # F1~F5 단위 테스트
    └── distribution.test.ts       # 50개 케이스 분포 검증
```

폴더 경로는 프로젝트 구조에 맞게 조정 가능 (`src/lib/saju-score/` 등).

---

## 2. 타입 정의 (types.ts)

`saju-score-spec.md` §6-1 그대로 사용:

```typescript
// 점수 시스템 입력
export interface SajuData {
  // 8글자
  yeonju: { gan: string; ji: string };   // 연주
  wolju: { gan: string; ji: string };    // 월주
  ilju: { gan: string; ji: string };     // 일주
  siju: { gan: string; ji: string };     // 시주
  
  // 파생 정보 (위에서 자동 추출)
  cheongan: string[];        // 4개 천간
  jiji: string[];            // 4개 지지
  allEightChars: string[];   // 8글자 모두
  
  // 명리 분석 결과
  ilgan: string;             // 일간 (천간 1자)
  kyeokguk: string;          // 격국 (예: '식신격')
  yongsin: string;           // 용신 (오행 1자: '목'/'화'/'토'/'금'/'수')
  yongsin_secondary?: string; // 보조 용신
  ganguk: '신강' | '신약' | '중화';
  
  // 신살
  gilsinList: string[];      // 작동하는 길신 목록
  hyungsalList: string[];    // 작동하는 흉살 목록
  hasGongmang: boolean;
}

// 점수 시스템 출력
export interface SajuScore {
  total: number;             // 0~100
  breakdown: {
    F1: number;              // 일주 본질 (0~20)
    F2: number;              // 격국 작동도 (0~20)
    F3: number;              // 용신·기신 (0~20)
    F4: number;              // 오행 균형 (0~20)
    F5: number;              // 합충·신살 (5~20)
  };
  label: ScoreLabel;
  ohaengChart: OhaengChartData;
  computedAt: string;        // ISO date
  formulaVersion: string;    // 공식 버전 (변경 시 재계산 필요)
}

export interface ScoreLabel {
  level: 'excellent' | 'good' | 'neutral' | 'mindful' | 'potential';
  title: string;             // "강점이 명확한 사주"
  subtitle: string;          // "본인 자리를 알면 빠르게 자리잡는 사주"
  description: string;       // 한 줄 설명
  disclaimer: string;        // "사주는 좋고 나쁨이 없습니다..."
  color: {
    bg: string;
    bgSoft: string;
    text: string;
    textOnDark: string;
    ring: string;
    gradient: string;
  };
}

export interface OhaengChartData {
  counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  total: 8;
  labels: Record<'목' | '화' | '토' | '금' | '수', string>;     // "목 기운" 등
  meanings: Record<'목' | '화' | '토' | '금' | '수', string>;   // "자라남과 추진" 등
  colors: Record<'목' | '화' | '토' | '금' | '수', string>;
  lack: Array<'목' | '화' | '토' | '금' | '수'>;
  excess: Array<'목' | '화' | '토' | '금' | '수'>;
  balanceScore: number;      // F4 값
  guidanceText?: string;     // Phase 5에서 LLM이 채움
}

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
};
```

---

## 3. 헬퍼 함수 명세 (helpers.ts)

5개 F 함수가 의존하는 명리 헬퍼 함수들. 각 함수가 무엇을 받고 무엇을 돌려주는지 명확히.

### 3-1. 12운성 매핑

```typescript
/**
 * 일간 기준 특정 지지의 12운성을 반환.
 * 예: 일간 '계'(癸), 지지 '미'(未) → '묘'
 */
export function get12Unseong(ilgan: string, ji: string): string;
```

**12운성 매핑 테이블** (양간/음간 순행/역행 구분 필요):

```typescript
const UNSEONG_TABLE: Record<string, Record<string, string>> = {
  '갑': { '해': '장생', '자': '목욕', '축': '관대', '인': '건록', '묘': '제왕', '진': '쇠', '사': '병', '오': '사', '미': '묘', '신': '절', '유': '태', '술': '양' },
  '을': { '오': '장생', '사': '목욕', '진': '관대', '묘': '건록', '인': '제왕', '축': '쇠', '자': '병', '해': '사', '술': '묘', '유': '절', '신': '태', '미': '양' },
  '병': { '인': '장생', '묘': '목욕', '진': '관대', '사': '건록', '오': '제왕', '미': '쇠', '신': '병', '유': '사', '술': '묘', '해': '절', '자': '태', '축': '양' },
  '정': { '유': '장생', '신': '목욕', '미': '관대', '오': '건록', '사': '제왕', '진': '쇠', '묘': '병', '인': '사', '축': '묘', '자': '절', '해': '태', '술': '양' },
  '무': { '인': '장생', '묘': '목욕', '진': '관대', '사': '건록', '오': '제왕', '미': '쇠', '신': '병', '유': '사', '술': '묘', '해': '절', '자': '태', '축': '양' },
  '기': { '유': '장생', '신': '목욕', '미': '관대', '오': '건록', '사': '제왕', '진': '쇠', '묘': '병', '인': '사', '축': '묘', '자': '절', '해': '태', '술': '양' },
  '경': { '사': '장생', '오': '목욕', '미': '관대', '신': '건록', '유': '제왕', '술': '쇠', '해': '병', '자': '사', '축': '묘', '인': '절', '묘': '태', '진': '양' },
  '신': { '자': '장생', '해': '목욕', '술': '관대', '유': '건록', '신': '제왕', '미': '쇠', '오': '병', '사': '사', '진': '묘', '묘': '절', '인': '태', '축': '양' },
  '임': { '신': '장생', '유': '목욕', '술': '관대', '해': '건록', '자': '제왕', '축': '쇠', '인': '병', '묘': '사', '진': '묘', '사': '절', '오': '태', '미': '양' },
  '계': { '묘': '장생', '인': '목욕', '축': '관대', '자': '건록', '해': '제왕', '술': '쇠', '유': '병', '신': '사', '미': '묘', '오': '절', '사': '태', '진': '양' }
};

export function get12Unseong(ilgan: string, ji: string): string {
  return UNSEONG_TABLE[ilgan]?.[ji] ?? '미정';
}
```

### 3-2. 오행 카운트

```typescript
/**
 * 8글자에서 각 오행 개수를 카운트.
 * 천간/지지는 각각 *본기*를 따른다 (지장간 무시, MVP).
 */
export function countOhaeng(eightChars: string[]): Record<'목'|'화'|'토'|'금'|'수', number>;
```

천간·지지의 오행 매핑:

```typescript
const CHEONGAN_OHAENG: Record<string, '목'|'화'|'토'|'금'|'수'> = {
  '갑': '목', '을': '목',
  '병': '화', '정': '화',
  '무': '토', '기': '토',
  '경': '금', '신': '금',
  '임': '수', '계': '수'
};

const JIJI_OHAENG: Record<string, '목'|'화'|'토'|'금'|'수'> = {
  '인': '목', '묘': '목',
  '사': '화', '오': '화',
  '진': '토', '술': '토', '축': '토', '미': '토',
  '신': '금', '유': '금',
  '자': '수', '해': '수'
};

export function countOhaeng(eightChars: string[]): Record<'목'|'화'|'토'|'금'|'수', number> {
  const counts = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
  for (const char of eightChars) {
    const oh = CHEONGAN_OHAENG[char] ?? JIJI_OHAENG[char];
    if (oh) counts[oh]++;
  }
  return counts;
}
```

### 3-3. 격국용신 + 격국 분석

```typescript
/**
 * 격국에 해당하는 천간 글자를 반환.
 * 예: '식신격' → 일간이 '계'면 '을' (계의 식신)
 */
export function getKyeokguYongsin(kyeokguk: string, ilgan: string): string;

/**
 * 격국용신이 합/충으로 손상되었는지.
 */
export function checkKyeokguDamage(saju: SajuData): boolean;

/**
 * 격국 보호 글자(인성·관성 등)가 옆에 있는지.
 */
export function checkKyeokguProtection(saju: SajuData): boolean;

/**
 * 종격(從格)·화격(化格) 같은 특수격 판정.
 */
export function isSpecialKyeokguk(saju: SajuData): boolean;
```

**십성 → 천간 매핑** (격국용신 추출용):

```typescript
const SIPSEONG_GAN: Record<string, Record<string, string>> = {
  '갑': { '식신': '병', '상관': '정', '편재': '무', '정재': '기', '편관': '경', '정관': '신', '편인': '임', '정인': '계', '비견': '갑', '겁재': '을' },
  // ... 다른 일간들도 동일하게
};

export function getKyeokguYongsin(kyeokguk: string, ilgan: string): string {
  const sipseong = kyeokguk.replace('격', '');  // '식신격' → '식신'
  return SIPSEONG_GAN[ilgan]?.[sipseong] ?? '';
}
```

### 3-4. 용신 관련 함수

```typescript
/**
 * 사주 8자 중 용신 글자 개수.
 */
export function countYongsinInSaju(yongsin: string, eightChars: string[]): number {
  // yongsin은 오행 1자 ('목'/'화'/'토'/'금'/'수')
  let count = 0;
  for (const char of eightChars) {
    const oh = CHEONGAN_OHAENG[char] ?? JIJI_OHAENG[char];
    if (oh === yongsin) count++;
  }
  return count;
}

export function isYongsin(gan: string, yongsin: string): boolean {
  return CHEONGAN_OHAENG[gan] === yongsin;
}

/**
 * 용신이 합/충으로 손상되었는지.
 */
export function checkYongsinDamage(saju: SajuData): boolean {
  // 용신 글자가 충/극을 받는지 체크
  // MVP: 간단히 충 관계만 체크
  // ... 구현
}

/**
 * 기신이 사주 내에서 우세한지.
 */
export function checkGisinDominance(saju: SajuData): boolean {
  // 기신(용신을 극하는 오행)이 4개 이상이면 우세
  const gisinOhaeng = getGisinOhaeng(saju.yongsin);
  const counts = countOhaeng(saju.allEightChars);
  return counts[gisinOhaeng] >= 4;
}

function getGisinOhaeng(yongsin: string): '목'|'화'|'토'|'금'|'수' {
  // 용신을 극하는 오행 (목→금, 화→수, 토→목, 금→화, 수→토)
  const gisinMap: Record<string, '목'|'화'|'토'|'금'|'수'> = {
    '목': '금', '화': '수', '토': '목', '금': '화', '수': '토'
  };
  return gisinMap[yongsin];
}
```

### 3-5. 합/충/형/원진 분석

```typescript
interface JijiInteractions {
  samhap: number;    // 삼합 개수 (인오술, 신자진, 사유축, 해묘미)
  yukap: number;     // 육합 개수
  chung: number;     // 충 개수
  hyeong: number;    // 형 개수
  wonjin: number;    // 원진 개수
}

export function analyzeJijiInteractions(jiji: string[]): JijiInteractions;
```

**합/충 테이블**:

```typescript
const SAMHAP_GROUPS: string[][] = [
  ['인', '오', '술'],  // 화국
  ['신', '자', '진'],  // 수국
  ['사', '유', '축'],  // 금국
  ['해', '묘', '미']   // 목국
];

const YUKAP_PAIRS: [string, string][] = [
  ['자', '축'], ['인', '해'], ['묘', '술'],
  ['진', '유'], ['사', '신'], ['오', '미']
];

const CHUNG_PAIRS: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'],
  ['묘', '유'], ['진', '술'], ['사', '해']
];

const HYEONG_GROUPS: string[][] = [
  ['인', '사', '신'],  // 삼형
  ['축', '술', '미'],  // 삼형
  ['자', '묘'],        // 상형
  ['진', '진'], ['오', '오'], ['유', '유'], ['해', '해']  // 자형
];

const WONJIN_PAIRS: [string, string][] = [
  ['자', '미'], ['축', '오'], ['인', '유'],
  ['묘', '신'], ['진', '해'], ['사', '술']
];

export function analyzeJijiInteractions(jiji: string[]): JijiInteractions {
  // 각 패턴을 jiji 배열에서 카운트
  const samhap = SAMHAP_GROUPS.filter(grp => 
    grp.every(g => jiji.includes(g))
  ).length;
  
  const yukap = YUKAP_PAIRS.filter(([a, b]) =>
    jiji.includes(a) && jiji.includes(b)
  ).length;
  
  const chung = CHUNG_PAIRS.filter(([a, b]) =>
    jiji.includes(a) && jiji.includes(b)
  ).length;
  
  // ... 형·원진도 유사
  
  return { samhap, yukap, chung, hyeong, wonjin };
}
```

### 3-6. 신살 카운트

```typescript
export function countGilsin(saju: SajuData, gilsinList: string[]): number {
  return saju.gilsinList.filter(g => gilsinList.includes(g)).length;
}

export function countHyungsal(saju: SajuData, hyungsalList: string[]): number {
  return saju.hyungsalList.filter(h => hyungsalList.includes(h)).length;
}
```

---

## 4. 5개 F 계산 함수 (formulas.ts)

`saju-score-spec.md` §2-2 ~ §2-6의 TypeScript 코드 *그대로* 옮겨 적되, 헬퍼 함수 import 추가.

```typescript
import type { SajuData } from './types';
import {
  get12Unseong, countOhaeng, getKyeokguYongsin,
  checkKyeokguDamage, checkKyeokguProtection, isSpecialKyeokguk,
  countYongsinInSaju, isYongsin, checkYongsinDamage, checkGisinDominance,
  analyzeJijiInteractions, countGilsin, countHyungsal
} from './helpers';

// === F1: 일주 본질 강도 (max 20) ===
export function calculateF1(ilju: { gan: string; ji: string }): number {
  const unseong = get12Unseong(ilju.gan, ilju.ji);
  
  const baseScores: Record<string, number> = {
    '제왕': 20, '건록': 19, '관대': 17, '장생': 16,
    '양': 15, '태': 14, '목욕': 13,
    '쇠': 12, '병': 10, '묘': 8, '사': 7, '절': 5
  };
  
  let score = baseScores[unseong] ?? 10;
  
  const specialIljus = {
    yanginIlju: ['병오', '임자', '무오', '갑인'],
    baekhoIlju: ['갑진', '을미', '병술', '정축', '무진', '임술', '계축'],
    goekgangIlju: ['경진', '경술', '임진', '임술', '무진', '무술']
  };
  
  const iljuKey = ilju.gan + ilju.ji;
  if (specialIljus.yanginIlju.includes(iljuKey)) score += 2;
  if (specialIljus.baekhoIlju.includes(iljuKey)) score -= 2;
  if (specialIljus.goekgangIlju.includes(iljuKey)) score += 1;
  
  return Math.min(20, Math.max(0, score));
}

// === F2: 격국 작동도 (max 20) ===
export function calculateF2(saju: SajuData): number {
  let score = 0;
  
  const isJeonggyeok = ['정인격', '정관격', '정재격', '식신격'].includes(saju.kyeokguk);
  score += isJeonggyeok ? 12 : 10;
  
  const kyeokguYongsin = getKyeokguYongsin(saju.kyeokguk, saju.ilgan);
  if (kyeokguYongsin && saju.cheongan.includes(kyeokguYongsin)) {
    score += 5;
  }
  
  if (!checkKyeokguDamage(saju)) score += 3;
  if (checkKyeokguProtection(saju)) score += 2;
  
  if (isSpecialKyeokguk(saju)) {
    score = Math.max(score, 15);
  }
  
  return Math.min(20, Math.max(0, score));
}

// === F3: 용신·기신 균형 (max 20) ===
export function calculateF3(saju: SajuData): number {
  let score = 0;
  
  const yongsinCount = countYongsinInSaju(saju.yongsin, saju.allEightChars);
  score += Math.min(yongsinCount * 5, 10);
  
  const yongsinInCheongan = saju.cheongan.some(g => isYongsin(g, saju.yongsin));
  if (yongsinInCheongan) score += 3;
  
  const yongsinNearIlju = isYongsin(saju.wolju.gan, saju.yongsin) ||
                          isYongsin(saju.siju.gan, saju.yongsin);
  if (yongsinNearIlju) score += 2;
  
  if (!checkYongsinDamage(saju)) score += 3;
  if (!checkGisinDominance(saju)) score += 2;
  
  return Math.min(20, Math.max(0, score));
}

// === F4: 오행 균형도 (max 20) ===
export function calculateF4(saju: SajuData): number {
  const counts = countOhaeng(saju.allEightChars);
  const total = 8;
  
  const presentOhaengCount = Object.values(counts).filter(c => c > 0).length;
  
  let score = 0;
  switch (presentOhaengCount) {
    case 5: score = 12; break;
    case 4: score = 9; break;
    case 3: score = 6; break;
    case 2: score = 3; break;
    case 1: score = 1; break;
  }
  
  const maxCount = Math.max(...Object.values(counts));
  if (maxCount >= 5) score -= 5;
  else if (maxCount === 4) score -= 3;
  else if (maxCount === 3) score -= 1;
  
  const mean = total / 5;
  const variance = Object.values(counts).reduce(
    (sum, c) => sum + Math.pow(c - mean, 2), 0
  ) / 5;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev < 1.0) score += 3;
  else if (stdDev < 1.5) score += 2;
  else if (stdDev < 2.0) score += 1;
  
  return Math.min(20, Math.max(0, score));
}

// === F5: 합충·신살 우호도 (5~20) ===
export function calculateF5(saju: SajuData): number {
  let score = 12;
  
  const gilsinList = ['천을귀인', '천덕귀인', '월덕귀인', '문창귀인', '학당귀인'];
  const gilsinCount = countGilsin(saju, gilsinList);
  score += gilsinCount * 2;
  
  const hyungsalList = ['양인살', '백호살', '괴강살', '겁살', '망신살'];
  const hyungsalCount = countHyungsal(saju, hyungsalList);
  score -= hyungsalCount * 1.5;
  
  const interactions = analyzeJijiInteractions(saju.jiji);
  score += interactions.samhap * 3;
  score += interactions.yukap * 2;
  score -= interactions.chung * 2;
  score -= interactions.hyeong * 1.5;
  score -= interactions.wonjin * 1;
  
  if (saju.hasGongmang) score -= 1;
  
  return Math.min(20, Math.max(5, score));
}
```

---

## 5. 라벨 시스템 (labels.ts)

`naming-policy.md` §11-1 + `saju-score-spec.md` §3 그대로:

```typescript
import type { ScoreLabel } from './types';

const LABEL_COLORS = {
  excellent: {
    bg: 'bg-pink-500', bgSoft: 'bg-pink-50', text: 'text-pink-600',
    textOnDark: 'text-pink-100', ring: 'ring-pink-300',
    gradient: 'from-pink-400 to-pink-600'
  },
  good: {
    bg: 'bg-emerald-500', bgSoft: 'bg-emerald-50', text: 'text-emerald-700',
    textOnDark: 'text-emerald-100', ring: 'ring-emerald-300',
    gradient: 'from-emerald-400 to-emerald-600'
  },
  neutral: {
    bg: 'bg-blue-500', bgSoft: 'bg-blue-50', text: 'text-blue-700',
    textOnDark: 'text-blue-100', ring: 'ring-blue-300',
    gradient: 'from-blue-400 to-blue-600'
  },
  mindful: {
    bg: 'bg-amber-500', bgSoft: 'bg-amber-50', text: 'text-amber-700',
    textOnDark: 'text-amber-100', ring: 'ring-amber-300',
    gradient: 'from-amber-400 to-amber-600'
  },
  potential: {
    bg: 'bg-purple-500', bgSoft: 'bg-purple-50', text: 'text-purple-700',
    textOnDark: 'text-purple-100', ring: 'ring-purple-300',
    gradient: 'from-purple-400 to-purple-600'
  }
};

const LABEL_TABLE = [
  {
    range: [90, 100], level: 'excellent' as const,
    title: '균형이 잘 잡힌 사주',
    subtitle: '자연스럽게 흐르는 사주',
    description: '다섯 기운과 흐름이 조화롭게 자리잡힌 사주예요. 큰 의식적 노력 없이도 본인 페이스를 유지하기 좋습니다.'
  },
  {
    range: [75, 89], level: 'good' as const,
    title: '강점이 명확한 사주',
    subtitle: '본인 자리를 알면 빠르게 자리잡는 사주',
    description: '본인의 강점이 분명하게 드러나는 사주예요. 자기 자리를 알면 빠르게 안정됩니다.'
  },
  {
    range: [60, 74], level: 'neutral' as const,
    title: '흐름이 무난한 사주',
    subtitle: '꾸준히 다지면 길게 가는 사주',
    description: '큰 굴곡 없이 무난하게 흐르는 사주예요. 꾸준한 루틴이 평생 큰 자산이 됩니다.'
  },
  {
    range: [45, 59], level: 'mindful' as const,
    title: '자기 관리가 빛나는 사주',
    subtitle: '활용도가 본인 손에 달린 사주',
    description: '본인의 의식적 관리가 사주의 가치를 결정하는 사주예요. 작은 습관 하나가 큰 변화를 만듭니다.'
  },
  {
    range: [0, 44], level: 'potential' as const,
    title: '보강의 여지가 큰 사주',
    subtitle: '의식적 관리로 가능성이 열리는 사주',
    description: '다양한 시도와 의식적 보강이 잘 어울리는 사주예요. 변화의 폭이 크고, 본인의 선택이 평생을 좌우합니다.'
  }
];

const DISCLAIMER = '사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요.';

export function getLabel(total: number): ScoreLabel {
  const entry = LABEL_TABLE.find(
    ({ range }) => total >= range[0] && total <= range[1]
  )!;
  return {
    level: entry.level,
    title: entry.title,
    subtitle: entry.subtitle,
    description: entry.description,
    disclaimer: DISCLAIMER,
    color: LABEL_COLORS[entry.level]
  };
}
```

---

## 6. 오행 차트 데이터 (ohaeng.ts)

`naming-policy.md` §2 어휘 정책 적용:

```typescript
import type { SajuData, OhaengChartData } from './types';
import { countOhaeng } from './helpers';
import { calculateF4 } from './formulas';

const OHAENG_LABELS = {
  '목': '목 기운',
  '화': '화 기운',
  '토': '토 기운',
  '금': '금 기운',
  '수': '수 기운'
} as const;

const OHAENG_MEANINGS = {
  '목': '자라남과 추진',
  '화': '표현과 열정',
  '토': '담아냄과 안정',
  '금': '단단함과 결단',
  '수': '흐름과 깊이'
} as const;

const OHAENG_COLORS = {
  '목': '#10b981',  // emerald-500
  '화': '#f43f5e',  // rose-500
  '토': '#f59e0b',  // amber-500
  '금': '#6b7280',  // gray-500
  '수': '#3b82f6'   // blue-500
} as const;

export function computeOhaengChart(saju: SajuData): OhaengChartData {
  const counts = countOhaeng(saju.allEightChars);
  const balanceScore = calculateF4(saju);
  
  const lack = (Object.keys(counts) as Array<keyof typeof counts>)
    .filter(k => counts[k] === 0);
  const excess = (Object.keys(counts) as Array<keyof typeof counts>)
    .filter(k => counts[k] >= 4);
  
  return {
    counts,
    total: 8,
    labels: OHAENG_LABELS,
    meanings: OHAENG_MEANINGS,
    colors: OHAENG_COLORS,
    lack,
    excess,
    balanceScore
  };
}
```

---

## 7. 메인 함수 (index.ts)

```typescript
import type { SajuData, SajuScore } from './types';
import {
  calculateF1, calculateF2, calculateF3, calculateF4, calculateF5
} from './formulas';
import { getLabel } from './labels';
import { computeOhaengChart } from './ohaeng';

const FORMULA_VERSION = '1.0.0';

export function computeSajuScore(saju: SajuData): SajuScore {
  const F1 = calculateF1(saju.ilju);
  const F2 = calculateF2(saju);
  const F3 = calculateF3(saju);
  const F4 = calculateF4(saju);
  const F5 = calculateF5(saju);
  
  const total = Math.round(F1 + F2 + F3 + F4 + F5);
  const label = getLabel(total);
  const ohaengChart = computeOhaengChart(saju);
  
  return {
    total,
    breakdown: { F1, F2, F3, F4, F5 },
    label,
    ohaengChart,
    computedAt: new Date().toISOString(),
    formulaVersion: FORMULA_VERSION
  };
}

// Re-export
export type { SajuData, SajuScore, ScoreLabel, OhaengChartData } from './types';
```

---

## 8. 50개 테스트 케이스 (test-cases.ts)

분포 검증에 사용할 다양한 사주 50개. Claude Code가 직접 *명리적으로 정확한* 케이스를 생성해야 합니다.

### 8-1. 케이스 분포 요구사항

50개 = 다음 4그룹 합산:

| 그룹 | 개수 | 구성 |
|------|----|----|
| A. 기본 케이스 | 15개 | 10천간 일간 × 3강약 (대표 사주 추출) |
| B. 격국별 | 16개 | 8개 격국 × 2종 (정격·편격 다양화) |
| C. 특수 케이스 | 10개 | 종격, 화격, 양인일주, 백호일주, 극단 오행 분포 |
| D. 무작위 보강 | 9개 | 실제 사주 검증용 (랜덤 생년월일시) |

각 케이스마다 다음 정보 포함:

```typescript
interface TestCase {
  id: string;                      // "A-001"
  description: string;             // "갑목 일간 + 신강 + 식상격"
  saju: SajuData;
  expectedRange?: [number, number]; // 선택적: 점수 범위 예상 (예: [70, 85])
  notes?: string;                  // 명리적 특이점 메모
}
```

### 8-2. 케이스 생성 가이드

```typescript
// test-cases.ts 구조 예시

export const TEST_CASES_A_BASE: TestCase[] = [
  {
    id: 'A-001',
    description: '갑목 일간 + 신강 + 식상격 (전형적인 표현형)',
    saju: {
      yeonju: { gan: '경', ji: '오' },
      wolju: { gan: '병', ji: '인' },
      ilju: { gan: '갑', ji: '인' },
      siju: { gan: '갑', ji: '술' },
      cheongan: ['경', '병', '갑', '갑'],
      jiji: ['오', '인', '인', '술'],
      allEightChars: ['경', '오', '병', '인', '갑', '인', '갑', '술'],
      ilgan: '갑',
      kyeokguk: '식신격',
      yongsin: '금',
      ganguk: '신강',
      gilsinList: [],
      hyungsalList: [],
      hasGongmang: false
    },
    expectedRange: [70, 85]
  },
  // ... 다른 14개 케이스
];

export const TEST_CASES_B_KYEOKGUK: TestCase[] = [
  // 8격국 × 2종 = 16개
];

export const TEST_CASES_C_SPECIAL: TestCase[] = [
  // 종격, 화격, 양인일주, 백호일주, 극단 오행 분포 등 10개
];

export const TEST_CASES_D_RANDOM: TestCase[] = [
  // 실제 생년월일시 기반 9개
];

export const ALL_TEST_CASES: TestCase[] = [
  ...TEST_CASES_A_BASE,
  ...TEST_CASES_B_KYEOKGUK,
  ...TEST_CASES_C_SPECIAL,
  ...TEST_CASES_D_RANDOM
];
```

### 8-3. 다양성 체크리스트

50개 생성 후 다음 분포를 만족하는지 확인:

- [ ] 10천간 모두 일간으로 등장 (각 최소 3회)
- [ ] 신강 / 신약 / 중화 모두 등장 (각 최소 10개)
- [ ] 8개 정격·편격 모두 등장 (각 최소 4개)
- [ ] 종격 1개 이상 포함
- [ ] 양인일주 1개 이상 포함
- [ ] 백호일주 1개 이상 포함
- [ ] 오행 0개 케이스(완전 결핍) 5개 이상
- [ ] 오행 5개 이상 케이스(극단 과다) 3개 이상

---

## 9. 분포 검증 (distribution.ts)

```typescript
import type { ValidationResult } from './types';
import { ALL_TEST_CASES } from './test-cases';
import { computeSajuScore } from './index';

interface DistributionStats {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  histogram: {
    excellent: number;  // 90~100
    good: number;       // 75~89
    neutral: number;    // 60~74
    mindful: number;    // 45~59
    potential: number;  // 0~44
  };
  percentages: {
    excellent: number;
    good: number;
    neutral: number;
    mindful: number;
    potential: number;
  };
}

export function computeDistribution(scores: number[]): DistributionStats {
  const count = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / count;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);
  
  const histogram = {
    excellent: scores.filter(s => s >= 90).length,
    good: scores.filter(s => s >= 75 && s < 90).length,
    neutral: scores.filter(s => s >= 60 && s < 75).length,
    mindful: scores.filter(s => s >= 45 && s < 60).length,
    potential: scores.filter(s => s < 45).length
  };
  
  return {
    count, mean, stdDev,
    min: Math.min(...scores),
    max: Math.max(...scores),
    histogram,
    percentages: {
      excellent: (histogram.excellent / count) * 100,
      good: (histogram.good / count) * 100,
      neutral: (histogram.neutral / count) * 100,
      mindful: (histogram.mindful / count) * 100,
      potential: (histogram.potential / count) * 100
    }
  };
}

export function validateDistribution(): ValidationResult & { stats: DistributionStats } {
  const scores = ALL_TEST_CASES.map(tc => computeSajuScore(tc.saju).total);
  const stats = computeDistribution(scores);
  const reasons: string[] = [];
  
  // 평균
  if (stats.mean < 60 || stats.mean > 75) {
    reasons.push(`평균 ${stats.mean.toFixed(1)} (목표 65~70)`);
  }
  
  // 표준편차
  if (stats.stdDev < 8 || stats.stdDev > 15) {
    reasons.push(`표준편차 ${stats.stdDev.toFixed(1)} (목표 ~12)`);
  }
  
  // 5단계 분포
  if (stats.percentages.potential > 15) {
    reasons.push(`44점 이하 비율 너무 높음: ${stats.percentages.potential.toFixed(1)}% (목표 5~10%)`);
  }
  if (stats.percentages.excellent > 15) {
    reasons.push(`90점 이상 비율 너무 높음: ${stats.percentages.excellent.toFixed(1)}% (목표 5~10%)`);
  }
  
  // expectedRange 일치 검증 (있으면)
  ALL_TEST_CASES.forEach((tc, i) => {
    if (tc.expectedRange) {
      const actual = scores[i];
      const [min, max] = tc.expectedRange;
      if (actual < min || actual > max) {
        reasons.push(`${tc.id} 예상 범위 ${min}-${max} 벗어남: 실제 ${actual}점`);
      }
    }
  });
  
  return {
    ok: reasons.length === 0,
    reasons,
    stats
  };
}
```

---

## 10. 단위 테스트 (__tests__/formulas.test.ts)

각 F 함수의 정확성 검증. 알려진 사주로 직접 점수 비교.

```typescript
import { describe, it, expect } from 'vitest';  // 또는 jest
import { calculateF1, calculateF2, calculateF3, calculateF4, calculateF5 } from '../formulas';

describe('F1: 일주 본질 강도', () => {
  it('갑인일주 = 제왕 → 20점 + 양인 가산 2점', () => {
    const score = calculateF1({ gan: '갑', ji: '인' });
    expect(score).toBe(20);  // 20 + 2 cap
  });
  
  it('병자일주 = 태 → 14점', () => {
    const score = calculateF1({ gan: '병', ji: '자' });
    expect(score).toBe(14);
  });
  
  it('계미일주 = 묘 → 8점', () => {
    const score = calculateF1({ gan: '계', ji: '미' });
    expect(score).toBe(8);
  });
  
  it('갑진일주 = 쇠 + 백호 감산 → 10점', () => {
    const score = calculateF1({ gan: '갑', ji: '진' });
    expect(score).toBe(10);  // 12 - 2
  });
  
  it('경진일주 = 양 + 괴강 가산 → 16점', () => {
    const score = calculateF1({ gan: '경', ji: '진' });
    expect(score).toBe(16);  // 15 + 1
  });
  
  it('어떤 입력이든 0~20 범위', () => {
    const score = calculateF1({ gan: '계', ji: '오' });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(20);
  });
});

describe('F4: 오행 균형도', () => {
  it('5오행 모두 1~2개 분포 → 13~16점', () => {
    const saju = makeSaju(['갑', '경', '병', '임', '무', '인', '신', '자']);
    const score = calculateF4(saju);
    expect(score).toBeGreaterThanOrEqual(13);
    expect(score).toBeLessThanOrEqual(16);
  });
  
  it('한 오행 5개 과다 → 1점 이하', () => {
    const saju = makeSaju(['갑', '갑', '을', '을', '인', '인', '묘', '묘']);  // 목 8개
    const score = calculateF4(saju);
    expect(score).toBeLessThanOrEqual(1);
  });
  
  it('3개 오행만 존재 → 6점 베이스', () => {
    const saju = makeSaju(['갑', '갑', '병', '병', '경', '경', '인', '인']);  // 목·화·금 만
    const score = calculateF4(saju);
    expect(score).toBeGreaterThanOrEqual(3);
    expect(score).toBeLessThanOrEqual(7);
  });
});

// F2, F3, F5도 유사하게
// ...
```

---

## 11. 분포 검증 테스트 (__tests__/distribution.test.ts)

```typescript
import { describe, it, expect } from 'vitest';
import { validateDistribution } from '../distribution';

describe('점수 분포 검증', () => {
  it('50개 테스트 케이스 분포가 목표 범위 안', () => {
    const result = validateDistribution();
    
    console.log('분포 통계:');
    console.log(`  평균: ${result.stats.mean.toFixed(1)}`);
    console.log(`  표준편차: ${result.stats.stdDev.toFixed(1)}`);
    console.log(`  최소: ${result.stats.min}, 최대: ${result.stats.max}`);
    console.log('  5단계 분포:');
    Object.entries(result.stats.percentages).forEach(([level, pct]) => {
      console.log(`    ${level}: ${pct.toFixed(1)}%`);
    });
    
    if (!result.ok) {
      console.warn('분포 문제:', result.reasons);
    }
    
    expect(result.ok).toBe(true);
  });
});
```

---

## 12. 수용 기준 (배포 전 통과해야 할 항목)

- [ ] 9개 파일 모두 생성됨 (`/lib/saju-score/` 하위)
- [ ] F1~F5 5개 함수 모두 0~20 (F5는 5~20) 범위 보장
- [ ] `computeSajuScore()` 메인 함수 동작
- [ ] 50개 테스트 케이스 모두 유효한 사주 (`gan`, `ji`, `ilgan` 등 일관성)
- [ ] 50개 케이스 점수 분포: 평균 65~70, 표준편차 8~15
- [ ] 44점 이하 비율 15% 이하
- [ ] 90점 이상 비율 15% 이하
- [ ] `expectedRange`가 있는 케이스 모두 범위 안 점수
- [ ] 단위 테스트 (formulas.test.ts) 모두 통과
- [ ] 분포 검증 테스트 (distribution.test.ts) 통과
- [ ] 동일 사주 두 번 계산 시 *완전히 같은 결과* (결정론 확인)
- [ ] `naming-policy.md` 어휘 정책 적용 — 라벨/오행 차트 데이터에 "X 기운" 사용 확인
- [ ] 한자 0개 (라벨·설명·meaning 모두에서)

---

## 13. Claude Code 즉시 복사 프롬프트

다음을 그대로 복사해서 Claude Code에 보내세요:

```
ganjisaju.kr 사주 총평 점수 시스템 Phase 1 (계산 엔진)을 구축해줘.

작업 지시서: phase-1-task.md (이 문서)
참조: saju-score-spec.md (전체 스펙), naming-policy.md (어휘 정책)

[작업 범위]
- 9개 파일 작성: types, formulas, helpers, labels, ohaeng, index,
  test-cases, distribution + 2개 테스트
- UI 작업 금지 (Phase 3에서 별도 진행)
- LLM 연계 금지 (Phase 5에서 별도 진행)

[순서]
1. types.ts → helpers.ts → formulas.ts → labels.ts → ohaeng.ts → index.ts
   순서로 작성 (의존성 순)
2. test-cases.ts에 50개 케이스 생성 (phase-1-task.md §8 분포 기준 따라)
3. distribution.ts 작성
4. 단위 테스트 (formulas.test.ts) 작성 + 실행
5. 분포 검증 (distribution.test.ts) 실행

[수용 기준]
phase-1-task.md §12 체크리스트 16개 항목 모두 통과해야 함.

[보고 양식]
완료 시:
- 생성된 9개 파일 목록 + 줄 수
- 단위 테스트 통과 비율 (N/M)
- 분포 통계: 평균, 표준편차, 5단계 분포 %
- 수용 기준 16개 통과 여부 (각각 ✅/❌)
- 분포가 어긋났다면 가중치 조정 제안

실패하거나 막히면:
- 어느 단계에서 막혔는지
- 무엇을 시도했는지
- 명리적 판단이 필요한 부분이라면 구체 질문

UI나 LLM 작업 절대 금지. 계산 엔진만.
```

---

## 14. 자주 막히는 부분 가이드

Claude Code가 Phase 1 진행하다가 막힐 가능성이 큰 지점들:

### 14-1. 격국 손상·보호 판정의 명리적 복잡성

`checkKyeokguDamage()`, `checkKyeokguProtection()`은 명리 룰이 복잡합니다. MVP 단순화 방향:

**손상 판정**:
- 격국용신이 *충*을 당하는가 → 손상
- 격국용신이 *합*되어 다른 오행으로 변하는가 → 손상
- 기타 (합·형·해·원진)는 MVP에서 무시

**보호 판정**:
- 격국용신을 *생*하는 글자가 천간/지지에 있는가 → 보호
- 격국용신을 *극*하는 글자가 없는가 → 보호

복잡한 룰은 MVP 이후 정밀화. Phase 1에서는 *단순한 판정*으로 시작.

### 14-2. 종격·화격 같은 특수격

`isSpecialKyeokguk()`은 종격(從格)·화격(化格)·전왕격 등 특수격을 판정. MVP에서는:

**종격 판정**:
- 일간이 신약이고, 한 오행이 5개 이상이면 종격 가능
- 단, 일간을 생하는 오행이 1개 이하여야

**화격 판정**:
- 천간 합(갑기합 토, 을경합 금 등)이 일간과 월간 사이에 있고
- 합화한 오행의 글자가 사주에 많으면 화격

이것도 MVP에서는 *간단한 룰*로 시작.

### 14-3. 12운성 매핑 정확성

`UNSEONG_TABLE`은 양간 순행 / 음간 역행 원칙. 검증용 알려진 값 몇 개:

| 일간 | 지지 | 12운성 |
|------|----|------|
| 갑 | 해 | 장생 |
| 갑 | 인 | 건록 |
| 갑 | 묘 | 제왕 |
| 을 | 오 | 장생 |
| 을 | 묘 | 건록 |
| 병 | 인 | 장생 |
| 정 | 유 | 장생 |
| 무 | 인 | 장생 (병과 같음) |
| 기 | 유 | 장생 (정과 같음) |
| 경 | 사 | 장생 |
| 신 | 자 | 장생 |
| 임 | 신 | 장생 |
| 계 | 묘 | 장생 |
| 계 | 미 | 묘 |
| 계 | 자 | 건록 |

테스트로 이 매핑이 정확한지 먼저 확인. 단위 테스트(formulas.test.ts)에 일부 포함.

### 14-4. 분포가 어긋나는 경우

가장 가능성 높은 시나리오:

**평균이 80+로 너무 높음** → F4 또는 F5의 페널티가 약함.
- F4: 과다 페널티 더 크게 (-5점 → -7점)
- F5: 충/형 페널티 더 크게 (-2점 → -3점)

**평균이 50 미만으로 너무 낮음** → F2, F3의 베이스가 약함.
- F2: 정격 베이스 12 → 14, 편격 베이스 10 → 12
- F3: 용신 글자 가중치 5 → 6

**44점 이하 비율 20%+** → 신약 사주에 가혹.
- F3 베이스 보너스 추가 (신약 사주는 +2점 베이스)
- F5 최저 5점 → 8점으로 상향

**90점 이상 비율 20%+** → 신강 사주에 너무 후함.
- F1 양인일주 가산 +2 → +1
- F4 균형도 보너스 줄이기

가중치 조정 시 *작은 변화*부터 시도. 한 번에 2점 이상 조정하지 말 것.

### 14-5. 결정론 검증

동일 사주를 100번 계산해서 모두 같은 점수인지 확인하는 테스트 추가:

```typescript
it('동일 사주는 항상 같은 점수 (결정론)', () => {
  const saju = TEST_CASES_A_BASE[0].saju;
  const scores = Array.from({ length: 100 }, () => computeSajuScore(saju).total);
  const uniqueScores = new Set(scores);
  expect(uniqueScores.size).toBe(1);
});
```

---

## 15. Phase 1 완료 후 다음 단계

Phase 1이 수용 기준 통과하면:

**Phase 2 (Week 3) — 라벨 + 색상 시스템 확장**:
- Tailwind 토큰 등록 (`tailwind.config.ts`)
- 면책 문구 표시 시스템
- 라벨별 UI 컴포넌트 분기 준비

**Phase 3 (Week 4~5) — UI 컴포넌트**:
- `<SajuScoreCard />` 큰 원형 점수
- `<ScoreBreakdownCard />` 5요소 산출
- 카운트업 애니메이션

**Phase 4 (Week 6~7) — 오행 차트 UI**:
- `<OhaengChart />` 막대 차트
- 부족/과다 가이드 카드

Phase 2~7의 상세는 `saju-score-spec.md` §11 참조.

---

## 16. 한 줄 요약

> **Phase 1은 9개 파일에 *순수 계산 엔진*만 작성. UI·LLM·결제는 절대 손대지 말 것. 50개 테스트 분포가 평균 65~70 / 표준편차 ~12 / 양극단 15% 이하면 통과. `naming-policy.md`의 "X 기운" 어휘 정책 라벨/차트 데이터에 적용 필수.**
