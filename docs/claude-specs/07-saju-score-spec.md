# 사주 총평 점수 시스템 설계 스펙

> ganjisaju.kr 사주 결과 페이지의 **종합 점수 시스템 + 오행 시각화 + UI 와이어프레임**을 위한 완전한 설계 문서.
>
> **이 문서는 `naming-policy.md`의 어휘 정책을 따릅니다.** 충돌이 있으면 `naming-policy.md`가 우선.
>
> 짝이 되는 자료: `saju-total-review-llm-spec.md` (사주 총평 본문 LLM 스펙), `daewoon-llm-spec.md` (대운 풀이), `saju-terms-dictionary.json` (용어 사전).

> **⚠️ 구현 현황 정정 (2026-05-22 검수 반영)**
> 아래 코드 샘플의 PascalCase 파일명(`SajuScoreCard.tsx` 등)·`tailwind.config.ts`는 개념 설명용. 실제: 컴포넌트 파일 = **kebab-case**(export 명은 PascalCase로 사양 일치), 토큰 = **Tailwind v4 `@theme`**(`src/app/styles/tokens.css`, `tailwind.config.ts` 없음).

---

## 0. 이 스펙의 위치

`saju-total-review-llm-spec.md`가 *총평 본문 콘텐츠*를 다뤘다면, 이 스펙은 그 위에 얹히는 **숫자·차트·시각 요소**를 다룹니다.

```
사주 총평 페이지 = [점수 시스템 (이 문서)] + [본문 narrative (LLM 스펙)] + [UI 자산 (기존)]
```

LLM 본문과 점수 시스템은 *독립적으로* 동작합니다. 점수는 결정론적 계산, 본문은 LLM 생성. 둘이 합쳐져 한 페이지를 이룹니다.

---

## 1. 가장 중요한 설계 원칙

### 원칙 ① 사주에 *좋고 나쁨*은 없다

명리학의 본질은 *길흉*이 아니라 *성향*을 읽는 것입니다. "낮은 점수 = 나쁜 사주"라는 인상을 주면 그 사용자는 즉시 사이트를 떠나고 다시는 안 옵니다.

**해결 방식**: 점수는 *"활용 난이도"* 또는 *"균형 정도"*의 표시일 뿐, 사주의 가치 판단이 아닙니다. 5단계 라벨 모두 *중립 또는 긍정* 어휘만 사용합니다.

- ❌ 절대 금지: "나쁜 사주", "흉한 사주", "약한 사주", "문제 있는 사주"
- ❌ 절대 금지: "주의 필요", "위험", "경고"
- ⭕ 사용: "보강의 여지가 큰 사주", "자기 관리가 빛나는 사주", "활용도가 본인 손에 달린 사주"

낮은 점수를 받은 사람이 *오히려 흥미를 느끼고* 더 깊게 보고 싶어 하도록 말해야 합니다.

### 원칙 ② 점수는 *분해 가능*해야 한다

"83점입니다"만 보여주면 사용자는 "그래서 뭐?"라고 생각합니다. *왜 83점인지* 5요소 분해표가 같이 와야 점수가 신뢰감을 줍니다.

오늘의 운세가 이미 이 패턴을 보여주고 있어요(점수 + 5요소 산출 내역). 사주 총평도 같은 패턴.

### 원칙 ③ 점수와 본문은 *모순되면 안 된다*

점수가 85점인데 본문이 "보완할 부분이 많은 사주예요"라고 하면 안 됩니다. LLM 입력 JSON에 점수 정보를 같이 넣어서 본문 톤이 점수와 일치하도록 합니다.

### 원칙 ④ 점수는 *재현 가능*해야 한다

같은 사주를 두 번 조회했을 때 같은 점수가 나와야 합니다. 결정론적 계산만 사용 (난수 X, LLM X).

### 원칙 ⑤ 어휘는 `naming-policy.md`를 따른다

오행은 "목/화/토/금/수 기운"으로, 십성·격국·강약은 원어 + 짧은 설명으로. 자연 비유("쇠의 결", "햇살의 결") 절대 금지. "결" 단어 라벨·제목 사용 금지.

---

## 2. 5요소 점수 공식

100점 만점, 5요소 각 0~20점.

### 2-1. 5요소 개요

| # | 요소 | 만점 | 측정 대상 | 사용자 노출 라벨 |
|---|------|-----|---------|------------|
| F1 | 일주 본질 강도 | 20 | 일주 60갑자 안정성 + 일간의 12운성 | 타고난 성향의 안정도 |
| F2 | 격국 작동도 | 20 | 격국의 명확성 + 격국용신 투출 | 사회적 역할의 명확성 |
| F3 | 용신·기신 균형 | 20 | 용신 글자 수 + 위치 + 손상 여부 | 보강 흐름의 작동 |
| F4 | 오행 균형도 | 20 | 5기운 분포의 균형 | 다섯 기운의 균형 |
| F5 | 합충·신살 우호도 | 20 | 길신 - 흉살 + 합/충 가중치 | 관계와 작용의 부드러움 |

**합계 = F1 + F2 + F3 + F4 + F5, 최대 100점.**

### 2-2. F1: 일주 본질 강도 (max 20)

일간이 일지에서 갖는 12운성을 베이스로 계산.

```typescript
function calculateF1(ilju: { gan: string; ji: string }): number {
  // 일간 기준 일지의 12운성 매핑
  const unseong = get12Unseong(ilju.gan, ilju.ji);
  
  // 베이스 점수 (12운성에 따라)
  const baseScores: Record<string, number> = {
    '제왕': 20, '건록': 19,      // 정점 단계
    '관대': 17, '장생': 16,      // 성장 단계
    '양': 15, '태': 14,          // 잉태/양육
    '목욕': 13,                  // 노출
    '쇠': 12, '병': 10,          // 약화
    '묘': 8, '사': 7,            // 마무리
    '절': 5                      // 단절
  };
  
  let score = baseScores[unseong] ?? 10;
  
  // 특수 일주 가산/감산
  const specialIljus = {
    yanginIlju: ['병오', '임자', '무오', '갑인'],     // 양인일주: +2
    baekhoIlju: ['갑진', '을미', '병술', '정축', '무진', '임술', '계축'],  // 백호일주: -2
    goekgangIlju: ['경진', '경술', '임진', '임술', '무진', '무술']         // 괴강일주: +1
  };
  
  const iljuKey = ilju.gan + ilju.ji;
  if (specialIljus.yanginIlju.includes(iljuKey)) score += 2;
  if (specialIljus.baekhoIlju.includes(iljuKey)) score -= 2;
  if (specialIljus.goekgangIlju.includes(iljuKey)) score += 1;
  
  return Math.min(20, Math.max(0, score));
}
```

**해석 가이드**:
- 18~20점: 일주가 매우 안정. 본인 페이스를 유지하기 쉬운 사주
- 14~17점: 일주가 견실. 보통 환경에서 자기 능력 발휘 가능
- 10~13점: 일주가 중간. 환경에 따라 변동성 있음
- 6~9점: 일주가 약함. 보강 흐름이 들어와야 안정
- 0~5점: 일주가 매우 약함. 의식적 관리가 가장 큰 자산

### 2-3. F2: 격국 작동도 (max 20)

```typescript
function calculateF2(saju: SajuData): number {
  let score = 0;
  
  // 격국 종류별 베이스
  const isJeonggyeok = ['정인격', '정관격', '정재격', '식신격'].includes(saju.kyeokguk);
  score += isJeonggyeok ? 12 : 10;  // 정격이 편격보다 안정적
  
  // 격국용신이 천간에 투출되어 있는가
  const kyeokguYongsin = getKyeokguYongsin(saju.kyeokguk);  // 격국에 해당하는 천간
  const isTransmitted = saju.cheongan.includes(kyeokguYongsin);
  if (isTransmitted) score += 5;
  
  // 격국용신이 손상(합/충)되었는가
  const isDamaged = checkKyeokguDamage(saju);
  if (!isDamaged) score += 3;
  
  // 격국을 보호하는 글자 (인성·관성 등)가 옆에 있는가
  const hasProtection = checkKyeokguProtection(saju);
  if (hasProtection) score += 2;
  
  // 종격(從格)·화격(化格) 같은 특수격 처리
  if (isSpecialKyeokguk(saju)) {
    // 특수격은 별도 계산 (MVP에서는 베이스 점수만)
    score = Math.max(score, 15);
  }
  
  return Math.min(20, Math.max(0, score));
}
```

**해석 가이드**:
- 18~20점: 격국이 매우 명확. 사회적 역할이 자연스럽게 드러남
- 14~17점: 격국이 분명. 본인 강점을 알면 쉽게 활용
- 10~13점: 격국이 중간. 노출되는 자리에서 본격 발휘
- 6~9점: 격국이 잡히기 어려움. 본인 정체성 찾는 데 시간 필요
- 0~5점: 격국이 거의 안 잡힘. 다양한 시도가 강점

### 2-4. F3: 용신·기신 균형 (max 20)

```typescript
function calculateF3(saju: SajuData): number {
  let score = 0;
  
  // 용신 글자가 사주 8자 안에 있는가
  const yongsinCount = countYongsinInSaju(saju.yongsin, saju.allEightChars);
  score += Math.min(yongsinCount * 5, 10);  // 최대 2글자까지 10점
  
  // 용신이 천간에 있는가 (지지보다 활용도 ↑)
  const yongsinInCheongan = saju.cheongan.some(g => isYongsin(g, saju.yongsin));
  if (yongsinInCheongan) score += 3;
  
  // 용신이 일주 옆(월간 또는 시간)에 있는가
  const yongsinNearIlju = (saju.wolju.gan === saju.yongsin) || (saju.siju.gan === saju.yongsin);
  if (yongsinNearIlju) score += 2;
  
  // 용신이 합/충으로 손상되지 않았는가
  const isYongsinDamaged = checkYongsinDamage(saju);
  if (!isYongsinDamaged) score += 3;
  
  // 기신이 용신을 강하게 극하지 않는가
  const isGisinDominant = checkGisinDominance(saju);
  if (!isGisinDominant) score += 2;
  
  return Math.min(20, Math.max(0, score));
}
```

**해석 가이드**:
- 18~20점: 용신이 잘 자리잡힘. 자연스러운 보강 흐름
- 14~17점: 용신 작동 양호. 본인 의식으로 잘 활용 가능
- 10~13점: 용신 일부 작동. 외부 환경으로 보강
- 6~9점: 용신이 약함. 의식적 보강 루틴 중요
- 0~5점: 용신이 거의 없음. 환경 선택이 평생 핵심

### 2-5. F4: 오행 균형도 (max 20)

```typescript
function calculateF4(saju: SajuData): number {
  // 8글자에서 각 오행 카운트
  const counts = countOhaeng(saju.allEightChars);  // { 목: N, 화: N, 토: N, 금: N, 수: N }
  const total = 8;
  
  // 존재하는 오행 수
  const presentOhaengCount = Object.values(counts).filter(c => c > 0).length;
  
  // 베이스 점수
  let score = 0;
  switch (presentOhaengCount) {
    case 5: score = 12; break;  // 5개 모두 있음 — 가장 좋음
    case 4: score = 9; break;   // 1개 부족
    case 3: score = 6; break;   // 2개 부족
    case 2: score = 3; break;   // 3개 부족
    case 1: score = 1; break;   // 극단 (종격 가능성)
  }
  
  // 과다 페널티
  const maxCount = Math.max(...Object.values(counts));
  if (maxCount >= 5) score -= 5;
  else if (maxCount === 4) score -= 3;
  else if (maxCount === 3) score -= 1;
  
  // 균형도 보너스 (표준편차 작을수록)
  const mean = total / 5;  // 1.6
  const variance = Object.values(counts).reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / 5;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev < 1.0) score += 3;
  else if (stdDev < 1.5) score += 2;
  else if (stdDev < 2.0) score += 1;
  
  return Math.min(20, Math.max(0, score));
}
```

**해석 가이드**:
- 18~20점: 오행이 매우 균형. 어떤 환경에도 적응 가능
- 14~17점: 오행이 잘 분포. 자연스러운 흐름
- 10~13점: 오행이 무난. 부족한 1~2개 의식적 보강
- 6~9점: 한 기운 과다 또는 2~3개 부족. 보강 흐름 활용
- 0~5점: 극단적 분포. 특수격이 아니라면 보강이 가장 큰 자산

### 2-6. F5: 합충·신살 우호도 (max 20)

```typescript
function calculateF5(saju: SajuData): number {
  let score = 12;  // 중립 베이스
  
  // 길신 카운트
  const gilsinList = ['천을귀인', '천덕귀인', '월덕귀인', '문창귀인', '학당귀인'];
  const gilsinCount = countGilsin(saju, gilsinList);
  score += gilsinCount * 2;
  
  // 흉살 카운트
  const hyungsalList = ['양인살', '백호살', '괴강살', '겁살', '망신살'];
  const hyungsalCount = countHyungsal(saju, hyungsalList);
  score -= hyungsalCount * 1.5;
  
  // 합/충/형/해/원진 패턴
  const interactions = analyzeJijiInteractions(saju.jiji);
  
  // 삼합 (인오술, 신자진, 사유축, 해묘미)
  score += interactions.samhap * 3;
  
  // 육합
  score += interactions.yukap * 2;
  
  // 충
  score -= interactions.chung * 2;
  
  // 형
  score -= interactions.hyeong * 1.5;
  
  // 원진
  score -= interactions.wonjin * 1;
  
  // 공망 (있으면 가벼운 페널티)
  if (saju.hasGongmang) score -= 1;
  
  return Math.min(20, Math.max(5, score));  // 최저 5점 (완전 0이 되지 않도록)
}
```

**해석 가이드**:
- 18~20점: 합·길신이 강함. 사람·기회의 흐름이 부드러움
- 14~17점: 합충이 균형. 안정적인 관계와 작용
- 10~13점: 합과 충이 같이 있음. 변동성 안에 기회
- 6~9점: 충·형이 좀 있음. 강한 변화의 사주
- 5점: 충·형·살이 많음. 다이내믹한 인생, 의식적 조절 핵심

### 2-7. 합산 공식

```typescript
function calculateTotalScore(saju: SajuData): SajuScore {
  const F1 = calculateF1(saju.ilju);
  const F2 = calculateF2(saju);
  const F3 = calculateF3(saju);
  const F4 = calculateF4(saju);
  const F5 = calculateF5(saju);
  
  const total = Math.round(F1 + F2 + F3 + F4 + F5);
  
  return {
    total,
    breakdown: { F1, F2, F3, F4, F5 },
    label: getLabel(total),
    color: getLabelColor(total),
    description: getLabelDescription(total)
  };
}
```

### 2-8. 예상 점수 분포

100명의 다양한 사주에 적용했을 때 *정규분포 비슷한* 모양이 나와야 합니다. 만약 80% 이상이 한쪽으로 쏠리면 가중치 재조정 필요.

**목표 분포**:
- 평균: 65~70점
- 표준편차: 약 12점
- 90점 이상: 5~10%
- 75~89점: 20~30%
- 60~74점: 35~45%
- 45~59점: 15~25%
- 44점 이하: 5~10%

배포 전 *최소 50개 다양한 사주*로 분포 검증 필수.

---

## 3. 5단계 라벨 시스템

### 3-1. 라벨 정의

| 점수 범위 | 라벨 (제목) | 부제 | 색상 | 한 줄 설명 |
|---------|-----------|------|------|---------|
| **90~100** | 균형이 잘 잡힌 사주 | 자연스럽게 흐르는 사주 | 핑크 | 다섯 기운과 흐름이 조화롭게 자리잡힌 사주예요. 큰 의식적 노력 없이도 본인 페이스를 유지하기 좋습니다. |
| **75~89** | 강점이 명확한 사주 | 본인 자리를 알면 빠르게 자리잡는 사주 | 그린 | 본인의 강점이 분명하게 드러나는 사주예요. 자기 자리를 알면 빠르게 안정됩니다. |
| **60~74** | 흐름이 무난한 사주 | 꾸준히 다지면 길게 가는 사주 | 블루 | 큰 굴곡 없이 무난하게 흐르는 사주예요. 꾸준한 루틴이 평생 큰 자산이 됩니다. |
| **45~59** | 자기 관리가 빛나는 사주 | 활용도가 본인 손에 달린 사주 | 머스타드 | 본인의 의식적 관리가 사주의 가치를 결정하는 사주예요. 작은 습관 하나가 큰 변화를 만듭니다. |
| **0~44** | 보강의 여지가 큰 사주 | 의식적 관리로 가능성이 열리는 사주 | 퍼플 | 다양한 시도와 의식적 보강이 잘 어울리는 사주예요. 변화의 폭이 크고, 본인의 선택이 평생을 좌우합니다. |

### 3-2. 라벨 어휘의 절대 규칙

`naming-policy.md` §9·§11-1 적용:

- ❌ **금지 어휘**: "나쁜", "흉한", "약한 (단독)", "위험한", "조심해야 할", "주의", "경고", "문제"
- ❌ **금지 어휘**: "X의 결" 패턴 (잘 다듬어진 결, 보강의 여지가 큰 결 등 — 모두 폐기)
- ❌ **금지 어휘**: "쇠의 결", "햇살의 결" 등 자연 비유
- ⭕ **권장 어휘**: "사주", "성향", "흐름", "기운", "가능성", "보강", "활용도", "다듬어진", "무난한", "관리가 빛나는"

낮은 점수일수록 *"본인이 만들어가는 사주"*의 가치를 강조합니다. *"이 사주는 본인의 선택이 평생을 만든다"*는 framing.

### 3-3. 색상 토큰 (Tailwind 토큰)

```typescript
const LABEL_COLORS = {
  excellent: {  // 90~100
    bg: 'bg-pink-500',
    bgSoft: 'bg-pink-50',
    text: 'text-pink-600',
    textOnDark: 'text-pink-100',
    ring: 'ring-pink-300',
    gradient: 'from-pink-400 to-pink-600'
  },
  good: {  // 75~89
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-50',
    text: 'text-emerald-700',
    textOnDark: 'text-emerald-100',
    ring: 'ring-emerald-300',
    gradient: 'from-emerald-400 to-emerald-600'
  },
  neutral: {  // 60~74
    bg: 'bg-blue-500',
    bgSoft: 'bg-blue-50',
    text: 'text-blue-700',
    textOnDark: 'text-blue-100',
    ring: 'ring-blue-300',
    gradient: 'from-blue-400 to-blue-600'
  },
  mindful: {  // 45~59
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-700',
    textOnDark: 'text-amber-100',
    ring: 'ring-amber-300',
    gradient: 'from-amber-400 to-amber-600'
  },
  potential: {  // 0~44
    bg: 'bg-purple-500',
    bgSoft: 'bg-purple-50',
    text: 'text-purple-700',
    textOnDark: 'text-purple-100',
    ring: 'ring-purple-300',
    gradient: 'from-purple-400 to-purple-600'
  }
};
```

⚠️ **빨간색·주황색 절대 금지**. 경고/위험 신호로 읽힙니다. 머스타드(amber-500)는 따뜻한 노란색이라 OK.

### 3-4. 점수 옆에 항상 표시할 부제 문구

점수만 보여주지 말고, 점수 아래에 *반드시* 다음 문구를 작은 글씨로 표시:

> *"사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요."*

이 한 줄이 점수 시스템의 *심리적 안전망* 역할을 합니다.

---

## 4. 오행 시각화 차트

> **어휘 정책**: 오행 라벨은 `naming-policy.md` §2에 따라 **"목 기운 / 화 기운 / 토 기운 / 금 기운 / 수 기운"**으로 일관. 자연 비유("새싹/햇살/흙/쇠/물") 절대 금지.

### 4-1. 차트 데이터 구조

```typescript
interface OhaengChartData {
  counts: {
    목: number;  // 0~8
    화: number;
    토: number;
    금: number;
    수: number;
  };
  total: number;  // 항상 8
  
  // 라벨 (naming-policy 적용)
  labels: {
    목: '목 기운';
    화: '화 기운';
    토: '토 기운';
    금: '금 기운';
    수: '수 기운';
  };
  
  // 짧은 의미 설명 (첫 등장 시 옆에 붙임)
  meanings: {
    목: '자라남과 추진';
    화: '드러냄과 열정';
    토: '담아냄과 안정';
    금: '단단함과 결단';
    수: '흐름과 깊이';
  };
  
  // 색상
  colors: {
    목: '#10b981';  // emerald-500
    화: '#f43f5e';  // rose-500
    토: '#f59e0b';  // amber-500
    금: '#6b7280';  // gray-500
    수: '#3b82f6';  // blue-500
  };
  
  // 강조
  lack: ('목' | '화' | '토' | '금' | '수')[];     // 0개인 오행
  excess: ('목' | '화' | '토' | '금' | '수')[];   // 4개 이상인 오행
  
  // 균형 점수 (F4)
  balanceScore: number;  // 0~20
}
```

### 4-2. 메인 차트: 가로 막대 (모바일 최적화)

```
┌────────────────────────────────────────────┐
│ 🍃 다섯 기운 분포                            │
│ ─────────────────────────                  │
│                                            │
│ 목 기운  ▓▓░░░░░░░░░░░  2개                 │
│ 화 기운  ▓▓▓▓░░░░░░░░░  4개                 │
│ 토 기운  ▓▓░░░░░░░░░░░  2개                 │
│ 금 기운  ░░░░░░░░░░░░░  0개  ⚠ 보강 필요    │
│ 수 기운  ▓▓▓▓▓░░░░░░░░  5개  ⚠ 과다         │
│                                            │
│ ─────────────────────────                  │
│ 균형 점수  ●●●●○  16/20                    │
│                                            │
│ ✨ 보강할 기운 — 금 기운 (단단함과 결단)        │
│   체크리스트, 정기 회고 같은 '단단한 구조'가   │
│   평생 큰 보강이 됩니다.                     │
└────────────────────────────────────────────┘
```

**구현 세부**:
- 막대 길이: `count / 5 * 100%` (5개를 100%로 보고)
- 0개 오행: 점선 outline + 회색 배경 + "보강 필요" 라벨
- 4개 이상 오행: 진한 색 + "과다" 라벨 + 약간 톤 다운된 색 (균형 맞추기 위해)
- 1~3개 오행: 일반 색
- 막대 끝 숫자: `{N}개`
- 막대 옆 라벨: "목 기운 / 화 기운 / 토 기운 / 금 기운 / 수 기운"

### 4-3. 보조 차트: 도넛 차트 (데스크탑 또는 전체 보기)

```
       ╱──────╲
      ╱ ●●●●●  ╲    수 기운
     │ ●●●●     │   화 기운
     │  ●●     │   토 기운 + 목 기운
      ╲       ╱    (금 기운 비어 있음)
       ╲──────╱
        균형 16/20
```

- SVG로 도넛 차트 렌더
- 각 섹션의 각도: `(count / 8) * 360도`
- 중앙: 균형 점수
- 호버/탭: 해당 오행 상세 (예: "수 기운 5개 — 흐름과 깊이가 강함")

### 4-4. 부족/과다 가이드 카드

차트 아래에 *이 사주에 맞는* 구체 보강 가이드:

```
✨ 이 사주에 권하는 보강

부족한 기운 — 금 기운 (단단함과 결단)
   ─ 일상 도구: 체크리스트·예산표·정기 회고
   ─ 환경: 명확한 규칙이 있는 자리
   ─ 색상: 흰색·은색·금속 톤
   ─ 방향: 서쪽

과한 기운 — 수 기운 (흐름과 깊이)
   ─ 의식 줄이기: 과도한 사색·우유부단
   ─ 행동으로 옮기는 루틴이 균형
```

이 카드의 텍스트도 LLM이 생성하거나, 사전(`saju-terms-dictionary.json`)에서 매핑.

---

## 5. UI 와이어프레임

### 5-1. 모바일 전체 흐름 (스크롤 순서)

```
┌─────────────────────────────────┐
│ [← back]    총평 탭     [...]    │  ← Header (유지)
├─────────────────────────────────┤
│                                 │
│      [큰 원형 점수 카드]          │  ← NEW (핑크/그린/블루/머스타드/퍼플)
│      ┌───────────┐              │
│      │           │              │
│      │    83     │              │
│      │           │              │
│      │ 강점이 명확한│              │
│      │   사주      │              │
│      └───────────┘              │
│  본인 자리를 알면                  │
│  빠르게 자리잡는 사주              │
│  "사주는 좋고 나쁨이 없습니다.      │
│   활용도가 다를 뿐이에요."         │
│                                 │
├─────────────────────────────────┤
│  辰  한 줄 요약                  │  ← 유지 (LLM 출력)
│  "조용히 살피고 흐르는 사주,       │
│   작은 원칙 하나가 평생을 받쳐줍니다" │
│                                 │
├─────────────────────────────────┤
│ ✓ 이 풀이는 당신의 상황을 반영했어요│  ← 유지 (컨텍스트 카드)
│ [기혼] [직장인] [재물·투자]       │
├─────────────────────────────────┤
│ 한 단락으로 정리                  │  ← LLM 출력 (4단락)
│                                 │
│ [단락 1 — 당신은 어떤 사람인가]   │
│ 테스트 님의 타고난 성향은 물처럼…  │
│                                 │
│ [단락 2 — 잘 살아나는 환경]      │
│ 이 사주는 '관찰하고 조정하는'…     │
│                                 │
│ [단락 3 — 조심할 자리]           │
│ 본인의 약점은 '단호함의 부족'…     │
│                                 │
│ [단락 4 — 지금 시기 핵심]        │
│ 지금 진행 중인 27세 무렵의 10년은…│
│                                 │
├─────────────────────────────────┤
│ 🎯 평생 활용 핵심 3가지           │  ← NEW (LLM 출력)
│                                 │
│ ╭─[강한 환경]────────────╮       │
│ │  관찰하고 조정하는 자리   │       │
│ │  ─ 전체 흐름을 살피는 역할 │       │
│ │  분석·기획·상담·교육···   │       │
│ ╰─────────────────────╯        │
│                                 │
│ ╭─[약한 자리]────────────╮       │
│ │  단호함과 마무리         │       │
│ │  ─ 거절선이 평생 자산│       │
│ │  '아니오'를 못하면 ···   │       │
│ ╰─────────────────────╯        │
│                                 │
│ ╭─[핵심 활용법]──────────╮       │
│ │  금 기운 들이기          │       │
│ │  ─ 단단한 구조가 보강    │       │
│ │  체크리스트·예산표···    │       │
│ ╰─────────────────────╯        │
│                                 │
├─────────────────────────────────┤
│ 📊 점수 산출 내역                │  ← NEW (이번 스펙)
│ "왜 83점이 나왔는지"              │
│                                 │
│ ① 일주 본질        +17점  →     │  ← 클릭 → 성향 탭 이동
│    타고난 성향의 안정도          │
│                                 │
│ ② 격국 작동도      +15점  →     │  ← 클릭 → 명식 탭 이동
│    사회적 역할의 명확성          │
│                                 │
│ ③ 용신·기신 균형  +13점  →     │
│    보강 흐름의 작동              │
│                                 │
│ ④ 오행 균형       +18점  →     │  ← 클릭 → 오행 탭 이동
│    다섯 기운의 균형              │
│                                 │
│ ⑤ 합충·신살      +20점  →     │
│    관계와 작용의 부드러움        │
│                                 │
│ ─────────────────────           │
│ 합계              83점          │
│                                 │
├─────────────────────────────────┤
│ 🍃 다섯 기운 분포                 │  ← NEW (이번 스펙)
│                                 │
│ 목 기운  ▓▓░░░░░░░  2개            │
│ 화 기운  ▓▓▓▓░░░░░  4개            │
│ 토 기운  ▓▓░░░░░░░  2개            │
│ 금 기운  ░░░░░░░░░  0개  보강 필요  │
│ 수 기운  ▓▓▓▓▓░░░░  5개  과다       │
│                                 │
│ 균형 점수 ●●●●○ 16/20            │
│                                 │
│ ✨ 보강할 기운 — 금 기운           │
│ 체크리스트, 정기 회고 같은…       │
│                                 │
├─────────────────────────────────┤
│ [일주] [격국] [용신] [강약] 칩    │  ← 유지
│ [대운] [세운] 칩                 │
├─────────────────────────────────┤
│ 더 깊게 보기                     │
│  → 성향 탭 / 오행 탭 / 명식 탭  │
│  → 대운 탭                      │
├─────────────────────────────────┤
│ [홈] [사주추가] [무료운세] [대화방] [보관함] │  ← 유지
└─────────────────────────────────┘
```

### 5-2. 큰 원형 점수 카드 (상세)

```
       ╭──────────────────╮
       │                  │
       │      ╱─────╲     │   ← 동심원 그라데이션
       │     │       │    │     라벨 색상으로
       │     │  83   │    │     (강점이 명확한 사주 = 그린)
       │     │       │    │
       │     │ 강점이      │    │
       │     │ 명확한      │    │
       │     │  사주       │    │
       │      ╲─────╱     │
       │                  │
       │   본인 자리를 알면   │
       │   빠르게 자리잡는    │
       │   사주              │
       │                  │
       │ "사주는 좋고 나쁨이   │   ← 작은 회색 글씨
       │ 없습니다. 활용도가   │
       │ 다를 뿐이에요."     │
       │                  │
       ╰──────────────────╯
```

- 큰 점수 (83): 폰트 크기 약 64px, bold
- 라벨 ("강점이 명확한 사주"): 폰트 크기 약 20px, semibold
- 부제 ("본인 자리를 알면 빠르게 자리잡는 사주"): 14px, regular
- 면책 문구: 12px, gray-500
- 카드 배경: 라벨 색상의 *50% 톤* (예: bg-emerald-50)
- 원의 외곽: 라벨 색상 진한 톤 (예: bg-emerald-500)
- 모션: 페이지 로드 시 점수가 0 → 83으로 카운트업 (1초간)

### 5-3. 점수 산출 내역 카드 (상세)

```
┌─────────────────────────────────┐
│ 📊 점수 산출 내역            83  │
│ 왜 이 점수가 나왔는지       강점이 │
│                            명확한 │
│                            사주    │
├─────────────────────────────────┤
│                                 │
│ ① 일주 본질               +17점 │
│    타고난 성향의 안정도          │
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░         │
│    [자세히 →]                   │  ← 성향 탭 deep link
│                                 │
│ ② 격국 작동도             +15점 │
│    사회적 역할의 명확성          │
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░         │
│    [자세히 →]                   │  ← 명식 탭 deep link
│                                 │
│ ③ 용신·기신 균형         +13점 │
│    보강 흐름의 작동              │
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░         │
│    [자세히 →]                   │
│                                 │
│ ④ 오행 균형              +18점 │
│    다섯 기운의 균형              │
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░         │
│    [자세히 →]                   │  ← 오행 탭 deep link
│                                 │
│ ⑤ 합충·신살             +20점 │
│    관계와 작용의 부드러움        │
│    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         │
│    [자세히 →]                   │
│                                 │
└─────────────────────────────────┘
```

- 각 요소: 번호 + 제목 + 점수 + 부제 + 미니 진행률 막대 + "자세히 →" 링크
- 점수 막대: 20점 만점 환산 길이
- 점수 색상: 점수가 높을수록 더 강한 색 (단, 5단계 라벨 색이 아닌 *각 요소 고유 색*)
- "자세히 →": 해당 탭/섹션으로 deep link
  - F1 → 성향 탭
  - F2 → 명식 탭 (격국 영역)
  - F3 → 명식 탭 (용신 영역) 또는 상세 3장
  - F4 → 오행 탭
  - F5 → 명식 탭 (합충·신살 영역)

### 5-4. 데스크탑 레이아웃 (선택)

데스크탑은 모바일 흐름의 *2단 분할*:

```
┌──────────────────────────────────────────────────┐
│ 좌측 (sticky)              │ 우측 (스크롤)         │
│                            │                     │
│ [큰 원형 점수 카드]         │ [한 줄 요약]         │
│                            │                     │
│ [컨텍스트 카드]            │ [본문 4단락]         │
│                            │                     │
│ [평생 활용 3가지]          │ [점수 산출 내역]      │
│                            │                     │
│ [오행 차트]                │ [칩 영역]            │
│                            │                     │
│                            │ [더 깊게 보기 CTA]    │
└────────────────────────────┴─────────────────────┘
```

좌측은 *요약·시각화*, 우측은 *본문·세부*. 데스크탑에서 sticky로 좌측이 따라옵니다.

---

## 6. 기술 구현

### 6-1. TypeScript 타입 정의

```typescript
// 점수 시스템 입력
interface SajuData {
  // 8글자
  yeonju: { gan: string; ji: string };
  wolju: { gan: string; ji: string };
  ilju: { gan: string; ji: string };
  siju: { gan: string; ji: string };
  
  // 파생 정보
  cheongan: string[];  // 4개 천간
  jiji: string[];      // 4개 지지
  allEightChars: string[];  // 8글자 모두
  
  // 명리 분석
  ilgan: string;       // 일간 (천간 1자)
  kyeokguk: string;    // 격국 (예: '식신격')
  yongsin: string;     // 용신 (오행 1자, 예: '금')
  yongsin_secondary?: string;  // 보조 용신
  ganguk: '신강' | '신약' | '중화';
  
  // 신살
  gilsinList: string[];    // 작동하는 길신 목록
  hyungsalList: string[];  // 작동하는 흉살 목록
  hasGongmang: boolean;
}

// 점수 시스템 출력
interface SajuScore {
  total: number;            // 0~100
  breakdown: {
    F1: number;             // 일주 본질
    F2: number;             // 격국 작동도
    F3: number;             // 용신·기신
    F4: number;             // 오행 균형
    F5: number;             // 합충·신살
  };
  label: ScoreLabel;
  
  // F4 상세 (오행 차트용)
  ohaengChart: OhaengChartData;
  
  // 메타
  computedAt: string;       // ISO date
  formulaVersion: string;   // 공식 버전 (변경 시 재계산 필요)
}

interface ScoreLabel {
  level: 'excellent' | 'good' | 'neutral' | 'mindful' | 'potential';
  title: string;            // "강점이 명확한 사주"
  subtitle: string;         // "본인 자리를 알면 빠르게 자리잡는 사주"
  description: string;      // 한 줄 설명
  disclaimer: string;       // "사주는 좋고 나쁨이 없습니다..."
  color: {
    bg: string;
    bgSoft: string;
    text: string;
    textOnDark: string;
    ring: string;
    gradient: string;
  };
}

interface OhaengChartData {
  counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  total: 8;
  labels: Record<'목' | '화' | '토' | '금' | '수', string>;     // "목 기운" 등
  meanings: Record<'목' | '화' | '토' | '금' | '수', string>;   // "자라남과 추진" 등
  colors: Record<'목' | '화' | '토' | '금' | '수', string>;
  lack: Array<'목' | '화' | '토' | '금' | '수'>;
  excess: Array<'목' | '화' | '토' | '금' | '수'>;
  balanceScore: number;     // F4
  guidanceText?: string;    // LLM이 생성한 보강 가이드
}
```

### 6-2. 메인 계산 함수

```typescript
import { 
  calculateF1, calculateF2, calculateF3, 
  calculateF4, calculateF5,
  getLabel, computeOhaengChart
} from './saju-score-formulas';

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
    formulaVersion: '1.0.0'
  };
}
```

### 6-3. 라벨 생성 함수

```typescript
const LABEL_TABLE = [
  {
    range: [90, 100],
    level: 'excellent',
    title: '균형이 잘 잡힌 사주',
    subtitle: '자연스럽게 흐르는 사주',
    description: '다섯 기운과 흐름이 조화롭게 자리잡힌 사주예요. 큰 의식적 노력 없이도 본인 페이스를 유지하기 좋습니다.'
  },
  {
    range: [75, 89],
    level: 'good',
    title: '강점이 명확한 사주',
    subtitle: '본인 자리를 알면 빠르게 자리잡는 사주',
    description: '본인의 강점이 분명하게 드러나는 사주예요. 자기 자리를 알면 빠르게 안정됩니다.'
  },
  {
    range: [60, 74],
    level: 'neutral',
    title: '흐름이 무난한 사주',
    subtitle: '꾸준히 다지면 길게 가는 사주',
    description: '큰 굴곡 없이 무난하게 흐르는 사주예요. 꾸준한 루틴이 평생 큰 자산이 됩니다.'
  },
  {
    range: [45, 59],
    level: 'mindful',
    title: '자기 관리가 빛나는 사주',
    subtitle: '활용도가 본인 손에 달린 사주',
    description: '본인의 의식적 관리가 사주의 가치를 결정하는 사주예요. 작은 습관 하나가 큰 변화를 만듭니다.'
  },
  {
    range: [0, 44],
    level: 'potential',
    title: '보강의 여지가 큰 사주',
    subtitle: '의식적 관리로 가능성이 열리는 사주',
    description: '다양한 시도와 의식적 보강이 잘 어울리는 사주예요. 변화의 폭이 크고, 본인의 선택이 평생을 좌우합니다.'
  }
];

const DISCLAIMER = '사주는 좋고 나쁨이 없습니다. 활용도가 다를 뿐이에요.';

function getLabel(total: number): ScoreLabel {
  const entry = LABEL_TABLE.find(({ range }) => total >= range[0] && total <= range[1])!;
  return {
    level: entry.level as ScoreLabel['level'],
    title: entry.title,
    subtitle: entry.subtitle,
    description: entry.description,
    disclaimer: DISCLAIMER,
    color: LABEL_COLORS[entry.level as keyof typeof LABEL_COLORS]
  };
}
```

### 6-4. 오행 차트 계산 함수

```typescript
const OHAENG_LABELS = {
  목: '목 기운',
  화: '화 기운',
  토: '토 기운',
  금: '금 기운',
  수: '수 기운'
};

const OHAENG_MEANINGS = {
  목: '자라남과 추진',
  화: '드러냄과 열정',
  토: '담아냄과 안정',
  금: '단단함과 결단',
  수: '흐름과 깊이'
};

const OHAENG_COLORS = {
  목: '#10b981',  // emerald-500
  화: '#f43f5e',  // rose-500
  토: '#f59e0b',  // amber-500
  금: '#6b7280',  // gray-500
  수: '#3b82f6'   // blue-500
};

function computeOhaengChart(saju: SajuData): OhaengChartData {
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

### 6-5. React 컴포넌트 구조

```typescript
// 컴포넌트 트리
<SajuTotalReviewPage>
  <SajuPillarsCard />                  // 사주팔자 8글자 (기존)
  
  <SajuScoreCard score={score} />      // NEW: 큰 원형 점수
  
  <OneLineSummaryCard text={...} />    // 기존: 한 줄 요약 (LLM)
  
  <ContextCard chips={...} />          // 기존: 컨텍스트 카드
  
  <NarrativeSection paragraphs={...} />// LLM 출력 본문 4단락
  
  <LifetimeKeysCarousel keys={...} />  // LLM 출력 평생 3가지
  
  <ScoreBreakdownCard 
    score={score}
    onClickFactor={(id) => navigateTo(...)} 
  />                                   // NEW: 5요소 산출
  
  <OhaengChart data={score.ohaengChart} />  // NEW: 오행 차트
  
  <SajuChips data={...} />             // 기존: 칩 영역
  
  <DeepDiveCTA />                      // 기존: 더 깊게 보기
</SajuTotalReviewPage>
```

### 6-6. 핵심 컴포넌트 인터페이스

```typescript
// SajuScoreCard.tsx
interface SajuScoreCardProps {
  score: SajuScore;
  animateOnMount?: boolean;  // default: true
}

// ScoreBreakdownCard.tsx
interface ScoreBreakdownCardProps {
  score: SajuScore;
  onClickFactor?: (factorId: 'F1' | 'F2' | 'F3' | 'F4' | 'F5') => void;
}

// OhaengChart.tsx
interface OhaengChartProps {
  data: OhaengChartData;
  variant?: 'bar' | 'donut' | 'both';  // default: 'bar'
  showGuidance?: boolean;              // default: true
  guidanceText?: string;               // LLM 생성 가이드 텍스트
}
```

### 6-7. Tailwind 토큰 추가

```typescript
// tailwind.config.ts에 추가
const config = {
  theme: {
    extend: {
      colors: {
        'score-excellent': '#ec4899',  // pink-500
        'score-good': '#10b981',       // emerald-500
        'score-neutral': '#3b82f6',    // blue-500
        'score-mindful': '#f59e0b',    // amber-500
        'score-potential': '#a855f7',  // purple-500
        
        'ohaeng-mok': '#10b981',       // 목 기운 (emerald)
        'ohaeng-hwa': '#f43f5e',       // 화 기운 (rose)
        'ohaeng-to': '#f59e0b',        // 토 기운 (amber)
        'ohaeng-geum': '#6b7280',      // 금 기운 (gray)
        'ohaeng-su': '#3b82f6'         // 수 기운 (blue)
      },
      animation: {
        'count-up': 'count-up 1s ease-out',
        'bar-fill': 'bar-fill 0.8s ease-out'
      }
    }
  }
};
```

---

## 7. LLM 본문과의 연계

### 7-1. 점수 정보를 LLM 입력에 추가

`saju-total-review-llm-spec.md`의 입력 JSON에 점수 정보를 추가해서, *본문 톤이 점수와 일치하도록* 합니다.

```json
{
  "user": {...},
  "context": {...},
  "wonkuk": {...},
  "current_timeline": {...},
  
  "score": {
    "total": 83,
    "label_easy": "강점이 명확한 사주 — 본인 자리를 알면 빠르게 자리잡는 사주",
    "tone_hint": "positive",   // positive | neutral | potential
    "strongest_factor": "F4",  // 가장 점수 높은 요소
    "weakest_factor": "F3",    // 가장 점수 낮은 요소
    "ohaeng_lack_label": "금 기운",
    "ohaeng_lack_meaning": "단단함과 결단",
    "ohaeng_excess_label": "수 기운",
    "ohaeng_excess_meaning": "흐름과 깊이"
  }
}
```

> **어휘 정책**: `ohaeng_lack_label`, `ohaeng_excess_label`은 `naming-policy.md` §2를 따라 "목 기운 / 화 기운 / 토 기운 / 금 기운 / 수 기운" 중 하나로 항상 표기. 자연 비유 절대 금지.

### 7-2. LLM 톤 조정 가이드

시스템 프롬프트에 추가:

```text
[점수 톤 매칭 규칙]

입력의 score.tone_hint에 따라 본문 톤을 조정합니다:

- tone_hint = 'positive' (75점 이상):
  "자연스럽게 흐르는", "강점이 명확한", "안정적인" 같은 어휘 사용
  본인의 강점에 비중 두기

- tone_hint = 'neutral' (60~74점):
  "무난한", "꾸준한", "차분히 다지는" 같은 어휘 사용
  강점과 보강할 자리 균등하게 짚기

- tone_hint = 'potential' (59점 이하):
  "본인의 선택이 만드는", "보강의 여지가 큰", "의식적 관리로 빛나는"
  어휘 사용
  *절대* "약한", "나쁜", "주의 필요" 같은 어휘 금지
  보강 가능성과 활용도에 비중 두기

[오행 표기 규칙 — naming-policy.md §2 적용]

본문에서 오행을 언급할 때는 반드시 "X 기운"으로 표기:
- ⭕ "금 기운을 보강하는 게 핵심"
- ❌ "쇠의 결을 들이는 게 핵심"
- ❌ "금의 기운을 보강"

첫 등장 시 짧은 의미를 옆에 붙일 수 있음:
- "금 기운(단단함과 결단)을 들이면…"
- 이후엔 그냥 "금 기운"
```

---

## 8. 무료/유료 경계 설계

### 8-1. 무료 영역

- 종합 점수 (총점만)
- 5단계 라벨 + 부제
- 한 줄 요약 (LLM)
- 본문 4단락 (LLM)
- 평생 활용 3가지 카드 (LLM)
- 점수 산출 내역 — *점수만, 풀이는 한 줄씩*
- 오행 차트 (기본)

### 8-2. 유료 영역 (550원~3,900원)

- 점수 산출 내역 *각 요소의 깊은 풀이* (수문장 잠금)
  - "일주 본질 자세히 보기" → 일주 60갑자 캐릭터 풀이
  - "격국 작동도 자세히 보기" → 격국 종류와 본인 격국의 강도
  - "용신·기신 자세히 보기" → 평생 보강 가이드
  - "오행 균형 자세히 보기" → 부족·과다 기운의 일상 적용
  - "합충·신살 자세히 보기" → 작동하는 신살 + 의미
- 오행 차트 *고급* (도넛 + 부족/과다 가이드 카드)
- 1:1 챗 (선생님과 대화하기)
- PDF 저장
- 평생 리포트 9장 풀버전

### 8-3. 유료 CTA 배치

점수 산출 내역 표에서, 각 요소 옆 "자세히 →" 링크가 유료 사용자만 클릭 가능. 무료 사용자는 클릭 시 *결제 모달* 등장.

```
② 격국 작동도              +15점
   사회적 역할의 명확성
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░
   🔒 자세히 →  [550원]
```

자물쇠 아이콘으로 *유료 콘텐츠임을 명시*하되, 잠금 자체를 *가치 시그널*로 활용. "유료 가치가 있을 만큼 깊은 분석"이라는 인상.

---

## 9. 분포 검증 (배포 전 필수)

### 9-1. 검증 데이터셋

배포 전 *최소 50개 다양한 사주*로 점수 분포 확인:

```typescript
const testSajuCases = [
  // 일간 5종 × 강약 3종 = 15개 기본
  ...generateBaseSajuCases(),
  
  // 격국 8종 × 일간 2종 = 16개
  ...generateKyeokgukCases(),
  
  // 특수 케이스 (종격, 화격, 양인일주, 백호일주) 10개
  ...generateSpecialCases(),
  
  // 실제 유명인/역사인물 사주 10개 (검증용)
  ...generateRealCases()
];
```

### 9-2. 분포 검증 함수

```typescript
function validateScoreDistribution(scores: number[]): ValidationResult {
  const reasons: string[] = [];
  
  // 평균
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (mean < 60 || mean > 75) {
    reasons.push(`평균 ${mean.toFixed(1)} (목표 65~70)`);
  }
  
  // 표준편차
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev < 8 || stdDev > 15) {
    reasons.push(`표준편차 ${stdDev.toFixed(1)} (목표 ~12)`);
  }
  
  // 5단계 분포
  const ranges = {
    excellent: scores.filter(s => s >= 90).length,
    good: scores.filter(s => s >= 75 && s < 90).length,
    neutral: scores.filter(s => s >= 60 && s < 75).length,
    mindful: scores.filter(s => s >= 45 && s < 60).length,
    potential: scores.filter(s => s < 45).length,
  };
  const total = scores.length;
  
  if (ranges.potential / total > 0.15) {
    reasons.push(`44점 이하 비율 너무 높음: ${(ranges.potential/total*100).toFixed(1)}% (목표 5~10%)`);
  }
  if (ranges.excellent / total > 0.15) {
    reasons.push(`90점 이상 비율 너무 높음: ${(ranges.excellent/total*100).toFixed(1)}% (목표 5~10%)`);
  }
  
  return { ok: reasons.length === 0, reasons };
}
```

분포가 어긋나면 가중치 재조정. 특히 *44점 이하*가 15%를 넘으면 위험 (사용자 이탈 가능성).

---

## 10. 예시 계산 (Few-shot)

**케이스**: 1999.04.01 14:30 여성, 대전. 계미 일주, 식신격, 신약, 용신 금.

**F1 계산** (일주 본질):
- 계미: 계수 일간, 미토 일지 → 12운성 '묘'(墓)
- 베이스: 8점
- 특수 일주 아님: ±0
- **F1 = 8점**

**F2 계산** (격국 작동도):
- 식신격 = 정격: 베이스 12점
- 식신(을목)이 천간에 투출? 사주 천간 중 을 없음: +0
- 격국용신이 손상 안 됨: +3점
- 격국 보호 글자 있음: +2점
- **F2 = 17점**

**F3 계산** (용신·기신):
- 용신 = 금 기운
- 사주에 금 기운 글자: 0개
- 보조 용신 토 기운: 4개 (보조니까 가중치 절반) → 약 4점
- 용신 천간 투출: 없음
- 용신 일주 옆: 없음
- 용신 손상: 없음 (애초에 없으니)
- **F3 = 약 5점**

**F4 계산** (오행 균형):
- 오행 카운트: 목 1, 화 0, 토 4, 금 0, 수 3
- 존재하는 오행 수: 3개 (목·토·수)
- 베이스: 6점
- 토 기운 4개 과다: -3점
- 표준편차 보너스: +1점
- **F4 = 4점**

**F5 계산** (합충·신살):
- 신살 가정: 흉살 1개 (화개살)
- 베이스 12점 - 1.5점 = **F5 = 약 10~11점**

**합계**: 8 + 17 + 5 + 4 + 11 = **45점**

**라벨**: "자기 관리가 빛나는 사주" / "활용도가 본인 손에 달린 사주"

**해석**:
- F1 일주 본질 8/20: 일주의 12운성이 '묘'라 다소 약함. 의식적 관리가 필요한 사주.
- F2 격국 작동도 17/20: 식신격이 잘 잡혀 있음. 본인의 표현·관찰 능력이 명확히 드러남.
- F3 용신·기신 5/20: 용신인 금 기운이 사주에 없음. 평생 *의식적으로* 단단함을 들이는 게 핵심.
- F4 오행 균형 4/20: 토 기운 4개 과다 + 화 기운·금 기운 부족. 한쪽으로 쏠린 분포.
- F5 합충·신살 11/20: 평이한 작용. 큰 길흉 신호 없음.

**시각화 화면 예시**:

```
큰 점수 카드:
   ╭───────────────╮
   │     45        │
   │ 자기 관리가     │
   │   빛나는       │
   │  사주          │
   │ 활용도가 본인   │
   │ 손에 달린 사주  │
   ╰───────────────╯

오행 차트:
   목 기운  ▓░░░░░░░░░  1개
   화 기운  ░░░░░░░░░░  0개  ⚠ 보강 필요
   토 기운  ▓▓▓▓░░░░░░  4개  ⚠ 과다
   금 기운  ░░░░░░░░░░  0개  ⚠ 보강 필요
   수 기운  ▓▓▓░░░░░░░  3개

   균형 점수  ●○○○○  4/20

   ✨ 보강할 기운 — 금 기운·화 기운
   • 금 기운 (단단함과 결단): 체크리스트, 결단의 루틴
   • 화 기운 (드러냄과 열정): 말하고 드러내는 자리 (강의·발표·기록)
   같은 도구가 큰 보강이 됩니다.

점수 산출:
   ① 일주 본질        +8점
   ② 격국 작동도      +17점  ← 강점!
   ③ 용신·기신       +5점
   ④ 오행 균형       +4점
   ⑤ 합충·신살      +11점
   ─────────────────
   합계             45점
```

**LLM 본문 톤 조정**:
- tone_hint = 'mindful' (45~59점 구간)
- 본문은 "자기 관리가 빛나는 사주", "본인의 선택이 평생을 만든다"는 톤
- 강점(F2 = 17점)에 *충분히* 비중 두기 ("격국이 명확해서 본인의 강점이 잘 드러난다")
- 약점은 *보강 가능성*으로 말 ("금 기운과 화 기운을 의식적으로 들이면 큰 변화")
- 오행 표기: "금 기운", "화 기운" (절대 "쇠의 결", "햇살의 결" 금지)

---

## 11. 구현 우선순위

### Phase 1 (Week 1~2) — 점수 계산 엔진

1. F1~F5 계산 함수 5개 작성
2. `computeSajuScore()` 메인 함수
3. 50개 테스트 사주로 분포 검증
4. 분포가 어긋나면 가중치 재조정

### Phase 2 (Week 3) — 점수 라벨 + 색상 시스템

1. 5단계 라벨 함수 (`getLabel`)
2. Tailwind 토큰 추가
3. 면책 문구 표시 시스템
4. 라벨별 UI 컴포넌트 분기

### Phase 3 (Week 4~5) — 메인 UI 컴포넌트

1. `<SajuScoreCard />` — 큰 원형 점수
2. `<ScoreBreakdownCard />` — 5요소 산출
3. 점수 카운트업 애니메이션
4. 모바일 + 데스크탑 반응형

### Phase 4 (Week 6~7) — 오행 차트

1. `<OhaengChart />` 막대형 — "목/화/토/금/수 기운" 라벨 적용
2. 부족/과다 강조 + 보강 가이드 카드
3. (선택) 도넛 차트 추가
4. LLM 생성 보강 가이드 텍스트 연동

### Phase 5 (Week 8) — LLM 연계

1. `saju-total-review-llm-spec.md` 입력에 점수 정보 추가
2. tone_hint 기반 톤 조정 시스템 프롬프트 보강
3. `naming-policy.md` §13 시스템 프롬프트 블록 추가
4. 점수와 본문 톤 일치도 검증

### Phase 6 (Week 9~10) — 무료/유료 경계

1. "자세히 →" 링크 잠금 시스템
2. 결제 모달 디자인
3. 잠금 해제 후 UI 변화

### Phase 7 (Week 11~12) — 검증 + 모니터링

1. 분포 모니터링 대시보드
2. 사용자 점수 통계 (평균/표준편차/분포)
3. AB 테스트 셋업

---

## 12. 통합 체크리스트

배포 전:

- [ ] F1~F5 계산 함수 모두 단위 테스트 통과
- [ ] 50개 테스트 사주 점수 분포 검증 통과
- [ ] 평균 65~70, 표준편차 ~12 충족
- [ ] 44점 이하 비율 15% 이하
- [ ] 90점 이상 비율 15% 이하
- [ ] 5단계 라벨 어휘 모두 중립/긍정 (`naming-policy.md` §11-1 정확히 일치)
- [ ] 면책 문구 "사주는 좋고 나쁨이 없습니다" 모든 점수에서 표시
- [ ] 색상 토큰에 빨강/주황 없음 (warning 색상 금지)
- [ ] 오행 차트 라벨 "X 기운" 형태 일관 (`naming-policy.md` §2 정확히 일치)
- [ ] 오행 차트가 0개 오행을 *경고*가 아닌 *보강 기회*로 표시
- [ ] 자연 비유("새싹/햇살/흙/쇠/물의 결") 사이트 전체 0건 (`naming-policy.md` §12 정규식)
- [ ] "결" 단어가 라벨·제목·카드 헤더에 0건
- [ ] 한자 본문 노출 0건 (사주팔자 8글자 카드만 예외)
- [ ] 점수 산출 내역의 "자세히 →" deep link 모두 동작
- [ ] LLM 본문 톤이 점수 라벨과 일치 (분포 테스트)
- [ ] 동일 사주 재계산 시 *완전히 같은 점수* 보장 (결정론 검증)
- [ ] 모바일 가독성 (작은 폰트, 컬러 대비)
- [ ] 데스크탑 sticky 레이아웃 동작
- [ ] 카운트업 애니메이션 부드러움
- [ ] 무료/유료 경계 명확
- [ ] 5명 베타 테스터 (명리 모르는 사람) 리뷰 후 통과

---

## 13. 한 줄 요약

> **계산은 결정론적으로, 라벨은 중립적으로, 시각화는 직관적으로, 본문은 점수와 일관되게.**
> **오행은 "X 기운"으로, 명리어는 원어 + 짧은 설명으로 (`naming-policy.md` 적용).**
>
> 사주 총평 페이지의 *가치 신호*가 한 단계 명확해집니다.

---

## 14. 다음 단계

이 스펙 적용 후:

- **세운(年運) 점수 시스템** — 올해 1년에 대한 점수. 사주 총평 점수와 별도. `saewoon-score-spec.md`로 정리
- **대운 점수 시스템** — 10년 단위 점수 (이미 일부 시각화 있음. 명시적 점수화)
- **분야운 점수 정밀화** — 현재 6분야 게이지를 *왜 이 점수인지* 분해표 추가
- **사주 비교 기능** — 두 사람의 사주 종합 점수 비교 (궁합 기능과 연계)

이 작업들은 모두 *같은 5요소 공식 패턴* + `naming-policy.md` 어휘 정책을 응용해서 만들 수 있습니다.
