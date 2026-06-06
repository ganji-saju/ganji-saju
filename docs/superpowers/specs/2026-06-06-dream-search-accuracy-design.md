# 꿈해몽 검색 정확도 — 초성/자모 정규화 설계

- 날짜: 2026-06-06
- 상태: 설계 확정 (구현계획 작성 대기)
- 상위 로드맵: `docs/superpowers/specs/2026-05-24-content-enhancement-roadmap.md` 영역3 #4(검색 정확도)
- 기준 main: #409 머지 이후

## 1. 배경 / 문제

로드맵 작성(2026-05-24) 이후 꿈해몽은 1·2단계가 이미 처리됨:
- `DREAM_DICTIONARY` **306 키워드**(로드맵 33 → 이미 200+ 달성).
- 검색→상세 링크 **존재**(`detailSlug` 필드, "이 꿈 자세히 풀어보기").

남은 갭은 **검색 정확도**. 현재 `searchDream`(`src/lib/dream-dictionary.ts:3800`)은
정확매치 → 키워드 substring(양방향) → related 태그 → fallback 4단계뿐이라:
- **초성 검색 불가**: "ㅂ"/"ㄸ" 등 초성만 입력하면 fallback.
- **오타·부분입력 흡수 불가**: 받침 누락/자모 단위 부분입력이 substring에 안 걸리면 fallback.

306개를 애써 작성해 두고도 입력이 조금만 어긋나면 "사전에 없어요"로 빠지는 게 핵심 손실.

## 2. 목표 / 비목표

**목표**: 초성 검색 + 자모 부분매치를 추가해 기존 306 엔트리의 검색 적중률을 높인다.
순수 알고리즘 — 콘텐츠 추가 없음, DB 없음, 의료광고법 비대상.

**비목표(YAGNI)**: 동의어 매핑 테이블(콘텐츠성, 별도 후속), LLM, 레벤슈타인 등
무거운 퍼지매칭, 상세페이지 확대(별도 콘텐츠 스프린트).

## 3. 설계

### 3.1 신규 유틸 — `src/lib/dream/hangul-search.ts`
재사용 가능한 한글 분해 헬퍼(기존 repo엔 josa용 받침 체크만 있고 초성/자모 추출 유틸 없음).

```ts
// 한글 음절(0xAC00~0xD7A3) → 초성 1자. 비한글은 원문 유지.
export function toChosung(text: string): string;

// 한글 음절 → 초성+중성+종성 자모 나열. 비한글은 원문 유지.
export function toJamo(text: string): string;

// 문자열이 초성 자모(ㄱ~ㅎ)로만 구성됐는지.
export function isChosungOnly(text: string): boolean;
```

구현 근거(유니코드 한글 음절 분해):
- `code = ch.charCodeAt(0) - 0xAC00` (0 ≤ code ≤ 11171)
- 초성 index = `Math.floor(code / 588)`, 중성 = `Math.floor((code % 588) / 28)`, 종성 = `code % 28`
- 초성표 `CHOSUNG[19]`, 중성표 `JUNGSEONG[21]`, 종성표 `JONGSEONG[28]`(0번=없음).
- `isChosungOnly`: 전부 `CHOSUNG` 자모 집합에 속하면 true(공백 제외 후 비어있지 않을 것).

### 3.2 `searchDream` 단계 보강
기존 단계 사이에 2개 삽입. 최종 순서:
1. 정확 매치 (그대로)
2. 키워드 substring 부분 매치 (그대로)
3. **(신규) 초성 매치** — `isChosungOnly(trimmed)`일 때만: `toChosung(key)`가
   `trimmed`를 **포함**하는 키 수집. 첫 매치 = match, 다음 3개 = suggestions, `exact:false`.
4. **(신규) 자모 부분 매치** — `qJamo = toJamo(trimmed)`(길이 ≥ 2일 때만, 과매칭 방지):
   `toJamo(key)`가 `qJamo`를 **포함**하는 키 수집. 동일 형식 반환.
5. related 태그 매치 (그대로)
6. fallback (그대로)

초성 단계를 자모 단계보다 먼저: 초성 입력은 자모로도 substring될 수 있어 의도(초성검색)를
우선 보존. 자모 단계 `길이 ≥ 2` 가드: 단일 자모는 초성 단계가 이미 처리하고, 1자 자모
substring은 과매칭이 심함.

### 3.3 결정성/정렬
매칭 키 수집은 `Object.keys(DREAM_DICTIONARY)` 순회 순서를 따른다(사전 정의 순 = 결정적).
별도 점수정렬 미도입(YAGNI) — 첫 매치 우선.

## 4. 영향 파일

| 파일 | 변경 |
|---|---|
| `src/lib/dream/hangul-search.ts` | 신규 — toChosung/toJamo/isChosungOnly |
| `src/lib/dream-dictionary.ts` | `searchDream`에 초성·자모 단계 2개 삽입(상단 import 추가) |
| `src/lib/dream/hangul-search.test.ts` | 신규 — 유틸 단위 테스트 |
| `src/lib/dream-dictionary.test.ts` | 검색 통합 회귀(초성/자모/기존 정확·부분) 추가 |

## 5. 테스트 전략

- **유틸 단위**: `toChosung('뱀')==='ㅂ'`, `toChosung('돈가방')==='ㄷㄱㅂ'`,
  `toJamo('뱀')==='ㅂㅐㅁ'`, `toJamo('가')==='ㄱㅏ'`,
  `isChosungOnly('ㅂ')===true`, `isChosungOnly('뱀')===false`, `isChosungOnly('')===false`.
- **검색 통합**: 초성 'ㅂ' 검색 시 초성이 ㅂ인 키워드(예: 뱀)가 match(exact=false);
  자모 부분입력이 올바른 엔트리로 수렴; **기존 정확매치('뱀')·부분매치 회귀 불변**;
  빈 쿼리는 기존대로 이빨 반환.
- **결정성**: 같은 쿼리 반복 호출 동일 결과.

## 6. 의료광고법
검색 알고리즘 — 콘텐츠 생성 없음. 비대상. (사전 본문은 기존 검증기 적용분 불변.)

## 7. 리스크 / 가정 붕괴 조건
- **리스크**: 자모 substring 과매칭(엉뚱한 키 우선). → 길이≥2 가드 + 초성 우선 + 첫 매치 한정.
- **가정**: 모든 키워드가 한글. 비한글 키 있으면 `toJamo`가 원문 유지하므로 substring 안전.
- **리스크**: 성능 — 306개 × 매 키 분해. 입력당 O(N·len), N=306이라 무시 가능(메모이즈 불요, YAGNI).
