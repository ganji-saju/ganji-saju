# 궁합 결정론 fallback 재작성 — 설계 (하이브리드)

- 날짜: 2026-06-06
- 상태: 설계 확정 (구현계획 작성 대기)
- 상위 로드맵: `docs/superpowers/specs/2026-05-24-content-enhancement-roadmap.md` 영역1 #2
- 기준 main: `52fee3d` 이후 (#400·#401 머지 반영)

## 1. 문제

유료 §8 "깊은 풀이"의 결정론 fallback `buildDeterministicDeepSections`
(`src/lib/compatibility.ts:853`)가 무료 §4~6 카드의 `practice`에 고정 접두어
(`DEEP_SECTION_AXIS_LEAD`)만 붙인 **재포장**이다. 무료 §4~6은 같은 카드의
`summary`를 노출하므로, 990원 결제자가 보는 §8이 무료와 사실상 같은 재료 →
"추가는 됐는데 안 바뀐 느낌"의 직접 원인.

LLM 경로(`OPENAI_INTERPRET_COMPATIBILITY=1`)는 프로덕션 ON이지만, 검증 실패·
네트워크 오류·캐시 미스 시 이 결정론 fallback이 노출되므로 fallback 자체 품질이
결제자 체감을 좌우한다.

## 2. 목표

LLM 비용 0으로 §8 본문을 무료 §4~6과 **명확히 차별화**한다. 차별화 축:
**관계유형(4) × 점수대(5) × 커플 고유 데이터 × 축당 근거 한 줄**.

비목표(YAGNI): LLM 프롬프트/검증기 변경, 무료 §4~6 텍스트 변경, 100개 일간조합
literal 작성, 새 라우트.

## 3. 설계

### 3.1 데이터 흐름 — 시그니처 확장
호출부 `buildCompatibilityInterpretation`(`compatibility.ts:919`)에는 이미 필요한
모든 값이 scope에 있다. 함수에 컨텍스트를 주입한다.

```ts
function buildDeterministicDeepSections(
  practicalCards: CompatibilityPracticalCard[],
  ctx: {
    stemInteraction: ReturnType<typeof summarizeStemInteraction>;
    elementInteraction: ReturnType<typeof summarizeElementInteraction>;
    branchInteraction: ReturnType<typeof summarizeBranchInteraction>;
    balanceInteraction: ReturnType<typeof summarizeElementBalance>;
    score: number;
    selfName: string;
    partnerName: string;
  }
): CompatibilityDeepSection[]
```

### 3.2 분기 골격 — 20셀 매트릭스
하이브리드: 골격은 작게, 주입이 차별화를 담당.

- **관계유형 4종**: `summarizeStemInteraction` 반환에 `kind` 필드 추가.
  - `'same'` (일간 동일) / `'harmony'` (천간합) / `'clash'` (충) /
    `'complement'` (보완) — 기존 4분기 로직이 이미 존재, kind만 표면화.
- **점수대 5단계**: 기존 라벨 임계값 재사용 — `score>=84 / >=78 / >=70 / >=62 / 그 외`.
  공유 헬퍼 `resolveScoreBand(score): 0|1|2|3|4`로 추출(라벨 산출부와 동일 기준).
- **프레이밍 매트릭스**: `DEEP_SECTION_FRAME[kind][band]` = 4×5 = **20셀**.
  각 셀은 관계유형·점수대를 반영한 **톤 오프너 1문장**(축 공통).

### 3.3 본문 조립 (축 4개 각각)

```
body =
  DEEP_SECTION_FRAME[kind][band]              // 관계유형·점수대별 톤 (20셀)
  + ' ' + DEEP_SECTION_AXIS_LEAD[card.key] + ' ' + card.practice   // 기존 커플고유 실천
  + ' ' + 주입문(selfName, partnerName, 축별 구체 신호)             // 커플마다 다름
```

`주입문`은 두 사람 이름 + 해당 축의 구체 데이터 조각(예: distance 축은
`branchInteraction`의 일지 신호 요약)을 1문장으로 엮는다. 빈 값일 땐 생략(공백 정리).

### 3.4 축당 근거 한 줄
`CompatibilityDeepSection`에 **옵셔널 필드 추가**:

```ts
export interface CompatibilityDeepSection {
  key: string;
  title: string;
  body: string;
  evidence?: string; // 이 축 풀이의 사주 근거 한 줄 (결정론 경로에서만 채움)
}
```

축 → 근거 소스 매핑 (기존 `evidence[]` 4종과 대칭, 재사용):

| 축 (card.key) | 근거 소스 | 근거 문구 예 |
|---|---|---|
| `conflict` | stemInteraction | 일간 신호 기반 |
| `communication` | elementInteraction | 오행 흐름 기반 |
| `money` | balanceInteraction | 오행 보완·겹침 기반 |
| `distance` | branchInteraction | 일지 신호 기반 |

`evidence?`를 옵셔널로 두는 이유: LLM 경로 타입
(`src/server/ai/compatibility/compatibility-interpretation-types.ts`)과 "동형"
유지. LLM은 evidence를 생성하지 않아도 검증 통과하고, 렌더러는 값이 있을 때만 표시.

### 3.5 렌더러
`src/features/compatibility/compatibility-deep-sections.tsx` — `item.body` 아래에
`item.evidence`가 있을 때만 작은 캡션 줄로 렌더(예: `text-[11px] muted`,
"근거: …"). LLM 교체 시 evidence 없으면 자동 미표시.

## 4. 영향 파일

| 파일 | 변경 |
|---|---|
| `src/lib/compatibility.ts` | 타입 +`evidence?`, `summarizeStemInteraction` +`kind`, `resolveScoreBand`, `DEEP_SECTION_FRAME`(20셀), `buildDeterministicDeepSections` 재작성 + 호출부 ctx 주입 |
| `src/features/compatibility/compatibility-deep-sections.tsx` | `item.evidence` 근거 줄 렌더 |
| 테스트(신규/보강) | 무료 `summary` ≠ 유료 `body` 차별성 단언; kind·band 분기 커버; evidence 매핑 |

## 5. 테스트 전략

- **차별성 회귀**: 동일 커플 입력에서 각 축의 무료 `card.summary`와 유료
  `deepSection.body`가 서로 다른 문자열임을 단언(재포장 재발 차단).
- **분기 커버**: 4 kind × 대표 band 조합에서 프레이밍 문장이 실제 본문에 반영되는지.
- **근거 매핑**: 4축 각각 `evidence` 비어있지 않고 올바른 소스 기반인지.
- **렌더 출력 검증**(메모 교훈): 글로서리/정의가 아니라 **빌더가 조립한 실제 body
  문장**으로 비문·한자 잔존·단정표현 확인.

## 6. 의료광고법 (절대원칙 우선)

운세 콘텐츠 — 단정·과장·치료성·보장 표현 금지(naming-policy / 의료법 가드).
- 프레이밍 20셀 전부 "~경향이 있습니다 / ~편입니다 / ~수 있습니다" 톤.
- "반드시 / 100% / 완벽한 궁합 / 무조건" 등 단정어 배제.
- spec 구현 후 조립된 실제 출력 문장 전수를 `medical_compliance_checker`로 게이트.

## 7. 리스크 / 가정 붕괴 조건

- **가정**: `summarizeStemInteraction`의 4분기가 모든 일간쌍을 포괄(같음/합/충/그외).
  붕괴 시 `complement`가 기본값이라 안전(미분류 → 보완 톤).
- **리스크**: 20셀 + 주입으로 본문이 길어져 모바일 가독성 저하. → 셀 문장 1개로
  제한, 본문 총 3~4문장 상한.
- **리스크**: 주입 데이터 빈 값(시간 미상 등)으로 비문. → 빈 조각 생략 + 공백 정리 헬퍼.
