# 타로 카드 피커 개선 설계 (Design-A: 한 화면 인터랙티브 78장 피커)

> 대상: `/tarot/daily/pick` · 작성 근거: 코드 정독 + 워크플로 Probe(런타임 성능·에셋 정량) 검증
> 상태: Design-A 확정 초안. Design-B(덱/로딩 전략)·통합안은 워크플로 완료 후 같은 문서에 append.

---

## 0. 검증된 전제 (Probe 결과)

| 항목 | 사실 | 근거 |
|---|---|---|
| picker가 브라우저로 보내는 이미지 | **공유 1회 fetch**, 작은 WebP(수 KB). 3MB 원본 아님 | Next 16 기본 옵티마이저, 78장이 모두 `00_back.png` 동일 URL → HTTP 캐시 dedup |
| "느림"의 진짜 원인 | ① 옵티마이저 **콜드 인코딩**(3MB PNG, 앞면 79개 각각) ② 과대 원본(1024×1536 → 실제 표시 ≤224px) ③ 216MB git 비대(.git 530MB) | Probe-1/3 |
| 뒷면 이미지화 필요성 | **불필요.** CSS/SVG로 0바이트 렌더 가능 → 인터랙티브 모션의 전제 | Probe-1 |

**핵심 통찰**: 피커의 뒷면은 이미지일 이유가 없다. CSS 카드로 바꾸면 (1) 네트워크 0바이트, (2) `transform/filter/그라데이션`을 자유롭게 애니메이션 → 인터랙티브 hover가 가능해진다. 두 요구사항(한 화면·인터랙티브)이 하나의 해법으로 수렴한다.

---

## 1. 현재 구조와 불편함의 원인

```
tarot-card-picker.tsx (282줄)
  drawDeck(78) → chunkDeck(18) → spreads[5]
  가로 scroll-snap carousel · chevron ◀▶ 로 5묶음 페이징
  카드 = <Image 00_back.png fill>  (전부 동일 뒷면)
  hover = brightness(1.12) + translateY(-1.05rem)  ← 빈약
  클릭 → buildResultHref(question, cardId, orientation) → /result
```

불편함 = **78장이 한 화면에 없다.** 18장씩 5번 넘겨야 전체를 본다. "마음이 가는 한 장"을 고르려면 페이징을 강요당함.

**반드시 보존해야 하는 계약**
- `buildResultHref(question, card)` → `/tarot/daily/result?question=&cardId=&orientation=` (result/snapshot/flip-reveal이 의존)
- `createRandomTarotDrawDeck` 의 per-card 랜덤성(`backTone`/`backGlow`/`tilt`/`lift`/`orientation`)
- `다시 섞기`(reshuffle), 선택 상태, 키보드 접근성, `prefers-reduced-motion`

---

## 2. 한 화면 레이아웃 3안

### 변형 1 — "그랜드 아치 부채" (Grand Arc Fan)
78장을 화면 폭 전체에 하나의 휘어진 부채로. 강한 겹침(노출 ~5px). 손가락/커서가 지나가면 **돋보기 렌즈**처럼 주변 카드가 들리며 펼쳐짐(애플 독 확대), 가운데 들린 카드를 탭해 선택.
```
   ╭───────────────  78장 한 줄 부채  ───────────────╮
   ▏▏▏▏▏▏▏▏▏▏▏▏▏╱▔╲▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏
            손가락 위치에서 ↑ 3~5장 확대·펼침
```
- 장점: 타로 드라마 최대, 78장 진짜로 한 화면, 촉각적.
- 단점: 구현 난이도 최고(근접 계산·78노드 transform 성능), **모바일 탭 정확도** 문제(슬라이버 5px) → 렌즈+확인 인터랙션 필수. 키보드 대체 목록 별도 필요.

### 변형 2 — "부채 그리드" (Fanned Grid) ★ 추천
78장을 반응형 그리드로 **전부 동시에**. 각 행이 살짝 아치(가장자리 카드가 바깥으로 기울어 다중 부채 느낌). 각 칸이 **독립 탭 타깃**.
```
모바일(≤480px, 9열×9행)        데스크톱(13열×6행, 스크롤 0)
 ◇◇◇◇◇◇◇◇◇                  ◇◇◇◇◇◇◇◇◇◇◇◇◇
 ◇◇◇◇◇◇◇◇◇      …            ◇◇◇◇◇◇◇◇◇◇◇◇◇  ×6
 ◇◇◇◇◇◇◇◇◇                  ◇◇◇◇◇◇◇◇◇◇◇◇◇
   hover/탭 → 들리고 빛나고 좌우 카드가 비켜남
```
- 장점: **모든 칸이 ≥40px 독립 탭 타깃**(엄지 오탭 문제 해소), 가장 직관적, "다 보이고 다 닿는다", 접근성(그리드+화살표) 자연스러움.
- 단점: 부채의 낭만은 변형 1보다 덜함 → 행 아치 + 랜덤 tilt + 글로우로 보완.

### 변형 3 — "물결 스택" (Stacked Wave)
3행 × 26장, 각 행 내부는 부드러운 겹침(노출 ~13px), 물결 곡선. hover 시 카드+이웃이 갈라짐.
- 장점: 낭만(변형1) ↔ 탭성(변형2) 중간.
- 단점: 26장 겹침이라 여전히 탭 정밀도 보조 모션 필요, 구현 중간.

---

## 3. 추천: 변형 2 "부채 그리드" + 풍부한 인터랙션

**왜**: 사용자의 #1 불만이 "고르기 불편"이다. 모바일에서 78장 중 1장을 엄지로 **오탭 없이** 고르려면 각 카드가 독립 탭 타깃이어야 한다(겹친 부채의 5px 슬라이버는 탭 불가 → 렌즈+확인 2스텝이 필요해 오히려 마찰 증가). 그리드는 "한 화면에 다 보이고 페이징 없음"이라는 요구를 가장 정직하게 충족하면서, 행 아치·랜덤 기울기·글로우로 타로의 분위기를 유지한다. 변형 1은 P1 "와우" 스트레치로 남긴다.

### 3-1. 인터랙티브 모션 스펙 (데스크톱 hover / 키보드 focus / 터치 active)

| 상태 | 대상 카드 | 이웃 카드 | 비고 |
|---|---|---|---|
| hover/focus | `translateY(-0.9rem) scale(1.12) rotate(0)`(기울기 펴짐) + 금색 링 + 글로우 헤일로 + 시머 sweep | 양옆 2장 `translateX(±0.35rem)` + dim, "갈라짐" | `z-index` 상승 |
| 터치(touchstart) | 같은 lift+glow를 press 프리뷰로 | — | 탭 = 즉시 선택(Link 이동) |
| 선택됨(is-selected) | 더 강한 brightness/ring 유지 | — | 기존 동작 유지 |
| reduced-motion | lift/시머/parting 제거, 단순 하이라이트만 | — | 필수 |

- easing `cubic-bezier(0.22, 1, 0.36, 1)`, ~200–220ms.
- **시머**: 카드 위로 얇은 금빛 sheen이 대각선으로 1회 sweep(가짜 "앞면 살짝 비침" 느낌). `::after` + keyframes, opacity/transform만.
- 이웃 parting은 순수 CSS로: `li:has(+ a:hover)` / `a:hover + li` 인접 선택자. 터치/JS 보조가 필요하면 `hoverIndex` state.

### 3-2. 성능 (78노드 60fps — 풋건 회피)
- **`will-change`를 78장 전부에 걸지 말 것**(GPU 레이어 폭발). hover된 1장에만 JS로 동적 부여하거나 아예 생략하고 `transform`/`opacity`만 애니메이션(컴포지터 친화).
- layout/paint 유발 속성(width/top/box-shadow의 spread 등) 애니메이션 금지 → `transform`+`opacity`+`filter` 한정. 글로우는 미리 깔린 `::before` opacity 토글로.
- 카드 뒷면 = CSS 그라데이션(`CARD_BACK_TONES` 재사용) + SVG 달(月) 모티프 1개(인라인, 색만 currentColor) → 0 네트워크.

---

## 4. 코드 변경 목록 (실제 파일 기준)

### `src/app/tarot/daily/pick/tarot-card-picker.tsx`
**제거**: `CARDS_PER_SPREAD`, `spreads`/`chunkDeck`, `activeSpreadIndex`, `scrollToSpread`/`moveSpread`/`updateActiveSpreadFromScroll`, `railRef`/`spreadRefs`, carousel head 카운터, chevron 버튼, `<Image 00_back>` import.
**유지**: `drawDeck`+`createRandomTarotDrawDeck`, `selectedCardId`, `reshuffleDeck`, `buildResultHref`, `CARD_BACK_TONES`. `getCardBackStyle`는 **그리드 tilt/glow 산출용으로 용도 변경**(부채 각도 = 열 위치 기반 + `card.tilt`).
**추가**: 단일 `<ul class="gangi-tarot-grid">` 에 78개 `<li><Link>`. 뒷면 = `<span class="gangi-tarot-card-back">`(CSS+인라인 SVG 달 모티프). `onPointerEnter/Leave`로 `hoverIndex`(will-change/parting 보조). 각 `<Link>` 는 focusable + `:focus-visible` = hover 동등.

### `src/app/styles/subpages.css` (≈1079–1228 교체)
- `.gangi-tarot-carousel*` / `.gangi-tarot-spread-*` 삭제 →
- `.gangi-tarot-grid`(반응형 열: 모바일 9 / 태블릿 11 / 데스크톱 13, `aspect-ratio:7/10`),
- `.gangi-tarot-card-back`(그라데이션+모티프), `.gangi-tarot-grid-card`(hover/focus/active transform + 이웃 parting), `@keyframes shimmer`, `@media (prefers-reduced-motion: reduce)` 블록.
- 모바일 최소폭에서 stage 높이 상한 + 내부 약간의 세로 스크롤 허용(여전히 "한 화면, 페이징 없음").

### `src/app/tarot/daily/pick/page.tsx`
- 카피만: `description` "18장씩 부채꼴로… 옆으로 넘기며" → "78장을 한눈에 펼쳤어요. 마음이 가는 한 장을 탭하세요." 타이틀 동일 톤. 구조 변경 없음.

### 영향 없음(보존 확인 필요 — Probe-2 blast-radius 진행 중)
- `/result`, `TarotCardArtwork`(앞면), `TarotCardFlipReveal`, `TarotSnapshotSaver` 는 href 계약만 유지하면 무수정.
- `00_back.png` 를 picker에서 떼어내도, flip-reveal이 뒷면 이미지를 쓰는지 Probe-2로 최종 확인.

---

## 5. 모바일 사용성 리스크 & 해소 (적대적 검증 선반영)
- **엄지 오탭**: 그리드 칸을 ≥40px 독립 타깃으로 확보(9열 기준 360px/9≈40px). 슬라이버 겹침 방식 회피가 이 결정의 핵심.
- **한 화면 정의**: 데스크톱 13×6=스크롤0. 모바일은 9×9가 1뷰포트에 안 들어가면 stage 내부 짧은 세로 스크롤 1회(페이징 아님). "한 화면에 다 펼침" 충족, "옆으로 5번 넘김" 제거가 목적.
- **터치 hover 부재**: 탭=즉시 선택 + press 프리뷰 모션. 확인 2스텝은 마찰이라 기본 비채택(요구가 "불편 제거").

---



---

# 통합 구현 플랜 (워크플로 적대적 검증 완료 · 8 에이전트)

> 아래가 **최종 권위 플랜**. 위 Design-A 초안의 수치는 아래 검증치로 정정됨(모바일 6→5열, 결과 렌더 224→92px, CARDS_PER_SPREAD=18).

# 타로 데일리 피커 리디자인 + 덱/로딩 개선 — 통합 구현 플랜

## 1. 한 줄 요약 (이번 주 출하분)

피커 카드 뒷면(`00_back.png` 3.22MB)을 **CSS/SVG로 교체**하고 78장 전체를 **한 화면 격자(5열 모바일)로 단일 탭 선택**하게 만들며, 78장 앞면을 **448px AVIF+WebP로 일괄 변환**해 served 페이로드를 **216MB → ~4MB(−98%)**로 줄인다. 덱 아트는 다시 그리지 않는다 — 느린 로딩은 아트 변경 없이 95% 해결된다.

---

## 2. 현재 상태 & 진짜 병목

| 항목 | 사실(probe 근거) | 체감 영향 |
|---|---|---|
| 브라우저로 가는 바이트 | 3MB 원본은 **전송 안 됨**. Next 16 기본 옵티마이저가 WebP로 변환·축소 (PROBE-1) | steady-state는 가벼움 |
| 피커 뒷면 | 78장 전부 동일 `00_back.png` → 옵티마이저 URL 1개로 dedup, srcset에서 ~96–384w WebP(단위 KB)만 받음 (PROBE-1) | 바이트는 작으나 **콜드 인코딩 1회** 비용 |
| **진짜 병목 #1** | 옵티마이저 **콜드스타트**: 첫 요청 시 1024×1536 ~3MB PNG를 서버리스에서 디코드+WebP 인코딩. 결과 페이지는 **79개 distinct 앞면 URL** → 카드마다 첫 뽑기 때 fresh 콜드 인코딩 (PROBE-1) | "처음 뜰 때 느림"의 정체 |
| **진짜 병목 #2** | **소스 과대치수**. 1024×1536 소스로 실제 ~92px 렌더 (PROBE-2 정정: result/page.tsx:80 `width:92`, 224px 아님). **~4.9× 과대** | 콜드 인코딩이 느리고 캐시도 큼 |
| 병목 #3 (체감무관) | 216MB PNG가 git에 직접 추적(LFS 아님), `.git`=530MB | clone/CI/deploy만 느림, 브라우저 무관 |

**핵심:** 느림 = 정상상태 다운로드가 아니라 **3MB 소스를 먹는 옵티마이저 콜드 인코딩**. 소스를 ~50KB로 줄이면 콜드 인코딩이 빨라지고 작아진다.

---

## 3. 개선안 (1) — 한 화면 78장 인터랙티브 피커

### 결정: **Dense Grid (촘촘한 격자)** — 5스프레드 캐러셀 폐기, 한 화면 격자

부채꼴(A)·단일호(C)는 모바일에서 카드당 4–7px 슬리버 → **추가 disambiguation 제스처** 필요 = 불편함의 재포장. 격자는 카드가 겹치지 않아(gap) 탭 모호성이 없고, 최저 공수·최저 리스크.

### ⚠️ 스키퍼가 강제한 모바일 수정 (BLOCKER): 6열 → **5열**

DESIGN-A의 "6열 = 52px 타일" 수치는 **틀림**. 실제 컨테이너 체인(360px 기준):

```
.app-page.gangi-subpage  min(100vw-2rem,30rem)=328px, pad ~14.4px/side → 296px
section px-4             16px/side                                     → 264px
.gangi-tarot-grid-stage  pad 12px/side                                → 240px 가용
```

- **6열**: (240−30)/6 = **35px** → Apple HIG 44px **미달** (스펙이 인용한 바로 그 기준). 탭 contact patch(~40–45px)가 이웃 타일에 걸쳐 **오탭 → 잘못된 카드로 즉시 페이지 이동** = 새로운 불편함.
- **5열 (채택)**: gap 5px → (240−20)/5 = **44.0px** × ~63px (HIG 충족), 16행.
- ≥390px에서는 6열로 올려도 무방(40px). 데스크톱은 `auto-fill, minmax(64px,1fr)` → ~13열, 78장 전부 above-the-fold.

### 인터랙티브 hover/touch 스펙

| 상태 | 변환 (transform/filter/opacity만 — 컴포지터) |
|---|---|
| 휴식 | `rotate(var(--card-tilt))` (RNG ±tilt), `backTone` 그라데이션, 슬롯번호, 약한 glow |
| hover/focus-visible | `translateY(-10px) scale(1.08) rotate(0)` + `brightness(1.12) saturate(1.08) drop-shadow(...)`, z 20, **shimmer sweep**(0 raster bytes) |
| selected | `translateY(-12px) scale(1.10)` + `brightness(1.18)`, z 30 (Link 네비 지연 중 즉시 피드백) |
| touch 기본 | **단일 탭 = 선택**. `:active{scale(0.96)}` 90ms 누름 피드백 |
| reduced-motion | 모션 제거, brightness/glow만 |

- **face-peek는 v2로 연기** — v1은 shimmer(0 바이트). 앞면 64px WebP 최적화 완료 후 fast-follow.
- **will-change 풋건 (필수):** 현재 78노드 모두 정적 `will-change`(subpages.css:1173) = **기존 프로덕션 문제** (스키퍼 정정: 격자가 새로 만드는 게 아님). 정적 규칙 삭제, `:hover/:focus-visible/.is-selected`에만 적용 → 동시 promote ≤2층. **격자는 회귀 아니라 개선**.
- **horizontal-overflow 가드:** 틸트 ±4°가 모서리에서 ~3–4px bleed → `.gangi-tarot-grid{overflow-x:clip}` + 360px에서 `scrollWidth==clientWidth` 검증. 또는 틸트 ±2°.

### 코드 변경 리스트 (실제 파일 대상)

**`tarot-card-picker.tsx` — 삭제**
- [ ] `CARDS_PER_SPREAD`(=**18**, 24 아님 — 스키퍼 정정), `spreads`/`chunkDeck`/`activeSpreadIndex`/`currentSpread`/`visibleStart/End`
- [ ] `railRef`/`spreadRefs`, `scrollToSpread`/`moveSpread`/`updateActiveSpreadFromScroll`, 셰브론 헤더
- [ ] `00_back.png` `<Image>`(195–203) + `sizes/quality/priority` → −3.22MB, −78 옵티마이저 요청, deprecated `priority` 라인 동반 제거
- [ ] import: `getTarotCardBackImagePath`, `ChevronLeft/Right`, (검증 후) `useRef`, `Image`

**`tarot-card-picker.tsx` — 유지(계약, 절대 손대지 말 것)**
- [ ] `buildResultHref`(274–282) → `/result?question&cardId&orientation` (result/page.tsx:42 + vault deep-link 재사용)
- [ ] `createRandomTarotDrawDeck(cards)` 초기+reshuffle (unit-tested)
- [ ] `CARD_BACK_TONES`(26–70) → 이제 타일 배경 소스, `selectedCardId`/`is-selected`, 카드당 `<Link>`

**변경**
- [ ] 렌더: `spreads.map(spread.map())` → 단일 `drawDeck.map()` 격자 `<Link>` 타일
- [ ] `getCardBackStyle`: fan 수학 제거, `--card-tilt`/`--card-glow`/background/zIndex만
- [ ] `reshuffleDeck`: `setActiveSpreadIndex(0)`/`railRef.scrollTo` 삭제, `window.scrollTo({top:0})` 추가

**CSS (`subpages.css` ~1093–1228 교체)**
- [ ] `.gangi-tarot-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;overflow-x:clip}`, ≥768px `auto-fill minmax(64px,1fr)`
- [ ] `.gangi-tarot-grid-stage`는 옛 `.gangi-tarot-stage`의 `overflow:hidden` **상속 금지**(일반 페이지 스크롤 유지)
- [ ] will-change 정적 규칙 삭제 → focus/selected에만

**`pick/page.tsx`**
- [ ] copy(47): "18장씩 부채꼴로 넘기며" → "78장을 한 화면에 펼쳤어요. 마음이 가는 한 장을 톡 골라요." props 불변

**검증 매트릭스:** (1) 360px 78타일 세로스크롤 도달, 가로스크롤 0 (2) Tab 1→78 (3) 각 타일 클릭 → 정확한 `/result` URL (4) reshuffle 재배열+선택해제 (5) reduced-motion 모션 off (6) DevTools Layers ≤2 promoted. **테스트 안전**: 유닛은 덱생성+앞면 existsSync만 검증, 피커 DOM 미검증; E2E는 랜딩만 터치.

---

## 4. 개선안 (2) — 카드 디자인 & 로딩

### 결정: **아트 유지 + 최적화**. 다시 그리지 않는다.

**(a) 뒷면 → CSS/SVG (최대 ROI·최저 공수, 먼저)**
- `00_back.png`(3.22MB, 피커가 쓰는 유일 아트)를 **렌더에서 제거**. 단, `getTarotCardBackImagePath()`와 파일은 **레포에 유지**(tarot-api.test.ts:274가 경로 문자열 검증) — 계약 유지, 에셋만 우회.
- flip-reveal 뒷면은 PNG가 아니라 글리프 `月`(motion-primitives.tsx:178) → **잃는 것 없음**(스키퍼 확인).
- 모티프: 초승달+밤하늘+골드 프레임, 카드당 `backTone/backGlow/tilt/star-offset`로 **78장 동일 복사본 → 진짜 덱 느낌**. hover 인터랙션(ask #2)을 동시 잠금해제.

**(b) 앞면 → 448px AVIF q55 + WebP q78 (아트 100% 유지)**

| 경로 | 카드당 | 78장 총합 | vs 216MB |
|---|---|---|---|
| 현 소스 | ~3.0MB | 216MB | 기준 |
| 448px PNG (실측) | 250KB | ~19.3MB | −91% |
| 448px WebP q78 | ~80–100KB | ~6.3–7.9MB | −97% |
| **448px AVIF q55** | ~45–60KB | **~3.5–4.7MB** | **−98%** |

- **치수 근거 정정(스키퍼):** 실제 렌더는 **92px**(result/page.tsx:80, 224px 아님). 2×DPR=184px이므로 448px는 넉넉한 헤드룸. 추가 절감 원하면 256px도 가능(앞면 92px 박스에서 선명도 렌더 검증 후 확정).
- format: 평면 페인터리 8-bit RGB no-alpha → **AVIF q55 primary**(비율 0.15–0.25), **WebP q78 fallback**(0.30–0.40). Next 16 기본은 WebP-only; 런타임 옵티마이저로 AVIF 내보내려면 `formats:['image/avif','image/webp']` 추가(정적 사전인코딩 쓰면 불필요).
- **사전 정적 인코딩, 런타임 옵티마이저 의존 금지** — 소스가 작아야 콜드 인코딩이 빠르고 git/deploy도 안 부풂.
- LQIP: `placeholder="blur"` + 카드당 ~16px base64, 또는 기존 CSS-family fallback(tarot-card-artwork.tsx:75–100) 재사용(0 바이트).

**git/CDN 결정**
- **git LFS 금지** — Vercel 빌드가 기본 LFS 스킵 → 프로덕션 깨진 이미지. 최적화본 ~4–7MB는 `/public`에 그냥 들어감.
- 1024px 마스터는 git 밖(Vercel Blob/object storage)에 보관.
- `.git` 530MB 축소는 `git filter-repo`로 히스토리에서 216MB 퍼지 — **단, force-push + 팀 re-clone 조율 필요**, perf 크리티컬패스 아님(별도 일정).

**실행 명령 (sharp — Next-native, AGENTS.md 권고)**
```bash
npm i -D sharp
node -e '
const sharp=require("sharp"),fs=require("fs"),path=require("path");
const src="public/images/tarot/cards", out="public/images/tarot/cards-opt";
fs.mkdirSync(out,{recursive:true});
(async()=>{for(const f of fs.readdirSync(src).filter(f=>f.endsWith(".png"))){
  const base=f.replace(/\.png$/,""), input=path.join(src,f);
  const img=sharp(input).resize({width:448});
  await img.clone().avif({quality:55}).toFile(path.join(out,base+".avif"));
  await img.clone().webp({quality:78}).toFile(path.join(out,base+".webp"));
}})();'
```
> **렌더 출력으로 검증**(MEMORY): 변환 후 `/tarot/daily/result`에서 448px AVIF가 92px 박스에 선명히 그려지는지 확인 후 완료 선언.

---

## 5. 사용자가 결정해야 할 것 (DECISION POINTS)

| # | 결정 | 추천 | 트레이드오프 (한 줄) |
|---|---|---|---|
| D1 | **아트 유지+최적화 vs 새 덱** | **유지+최적화** | 새 덱은 *디자인* 결정이지 *속도* 결정 아님; P0가 이미 −98% 달성. 새 룩 원하면 P1 별도 콘텐츠 프로젝트(주~수 단위, 512×768+AVIF/WebP/blur 사양 강제) |
| D2 | **모바일 열 수: 5열 고정 vs 390px↑ 6열** | **5열 기본 + ≥390px 6열** | 5열=44px HIG충족·16행 스크롤 더 길음; 6열=40px·14행 더 짧지만 HIG 살짝 미달. 안전 우선이면 5열 고정 |
| D3 | **git 히스토리 퍼지(filter-repo) 지금 vs 나중** | **나중(별도 일정)** | served 페이로드 −98%는 `/public` 커밋만으로 달성; filter-repo는 히스토리 재작성=force-push+팀 re-clone 리스크, perf와 분리 |

(선택) D4: v1 hover = **shimmer**(추천, 0 바이트) vs face-peek(64px WebP 선행 필요).

---

## 6. 단계별 실행계획

### P0 — 이번 주 (아트 변경 없음) ✅

| 작업 | 파일 | 공수 | 사용자 체감 |
|---|---|---|---|
| 뒷면 `<Image>` → CSS/SVG 초승달 백 | tarot-card-picker.tsx, subpages.css | ~0.5d | 피커 **순수 CSS = 사실상 즉시 first paint** (최대 체감) |
| 한 화면 5열 격자 + hover/touch 스펙 + will-change 스코프 | tarot-card-picker.tsx, subpages.css | ~0.5–1d | 페이징·fat-finger 동시 제거, 78장 1탭 |
| 78 앞면 448px AVIF+WebP 변환 + 경로 스왑 + blur | sharp 스크립트, tarot-card-assets.ts, tarot-card-artwork.tsx | ~0.5d | 결과 카드 콜드 인코딩 빨라짐, blur로 즉시 표시 |
| copy 갱신 | pick/page.tsx | ~0.1d | — |

**P0 합계 ~1.5–2 dev-day.** served **216MB→~4MB(−98%)**, 피커 first paint 즉시, ask #1·#2·#3 모두 충족. **계약 불변**(buildResultHref/cardId/orientation).

### P1 — 선택: 아트 리프레시 (브랜드가 새 룩 원할 때만)
- 512×768 마스터 → AVIF q55 + WebP q78 + blurDataURL **처음부터**, 동일 파일맵 드롭 = 코드 0변경.
- 공수: days–weeks(콘텐츠+리뷰 사이클). 체감: **미관만**, 추가 로딩 이득 없음(P0가 이미 ~4MB).

### P2 — git 히스토리 위생
- `git filter-repo`로 216MB 퍼지(.git 530MB↓), 마스터 object storage 이전.
- 공수: ~0.5d 작업 + 조율 윈도우. 체감: **clone/CI/deploy만 빨라짐**(브라우저 무관).

---

## 7. 리스크 & 가정 붕괴 조건

| 리스크 / 가정 | 붕괴 조건 | 대응 |
|---|---|---|
| 5열 44px가 충분 | 실기기에서 여전히 오탭 다발 | 틸트 ±2°로↓, 또는 selected→재탭 2단계(폭<44px일 때만) |
| AVIF q55가 92px서 선명 | 렌더 검증 시 painterly 디테일 뭉개짐 | q60–65 상향 또는 WebP q82, 256→384px 상향 |
| `formats` 미설정으로 AVIF 안 나감 | 정적 사전인코딩 안 쓰고 런타임 의존 시 WebP만 출력 | 사전인코딩 채택(권장) 또는 `formats:['image/avif','image/webp']` |
| 가로스크롤 0 가정 | 틸트 bleed로 hairline 스크롤바 | `overflow-x:clip` + 360px `scrollWidth==clientWidth` 검증 |
| filter-repo 안전 | 협업자 미조율 force-push로 히스토리 충돌 | P2로 분리, force-push 윈도우 사전 공지, P0/P1과 독립 |
| 테스트 안전 가정 | 향후 피커 DOM 스냅샷 테스트 추가됨 | 현재 유닛은 덱생성+앞면 existsSync만 검증; 추가 시 스냅샷 갱신 |
| 뒷면 PNG 제거 안전 | flip-reverl이 PNG 참조로 회귀 | flip 뒷면은 글리프 `月`(검증됨), `getTarotCardBackImagePath`+파일 레포 유지 |

---

# ✅ P0 구현 완료 (2026-06-21)

확정 결정: **변형2 부채 그리드** · **아트 유지+최적화** · **뒷면 ② 신비 기하 만다라**.

## 변경된 파일
| 파일 | 변경 |
|---|---|
| `src/app/tarot/daily/pick/tarot-card-picker.tsx` | 5스프레드 캐러셀 전면 폐기 → 단일 `.gangi-tarot-grid` 78장. CSS+SVG 만다라 뒷면(`MandalaBack`, 이미지 0바이트). `00_back.png`/`<Image>`/chevron/캐러셀 로직 제거. `buildResultHref`·`createRandomTarotDrawDeck`·`reshuffleDeck`·`is-selected` 계약 유지 |
| `src/app/styles/subpages.css` | `.gangi-tarot-carousel*`/`.gangi-tarot-spread-*` 삭제 → `.gangi-tarot-grid`(5열/8열/13열) + 만다라 뒷면 + hover 리프트·시머·이웃 갈라짐(`:has`) + `:active` + reduced-motion. 다크 밤하늘 stage. will-change는 hover 1장에만 |
| `src/app/tarot/daily/pick/page.tsx` | 안내 카피: "78장을 한 화면에 펼쳤어요. 마음이 가는 한 장을 톡 골라요." |
| `src/lib/tarot-card-assets.ts` | `getTarotCardOptimizedSources()` 추가(avif/webp/png). 원본 png 매핑·`getTarotCardImagePath` 무변경(테스트·폴백) |
| `src/components/tarot/tarot-card-artwork.tsx` | `next/image` → `<picture>`(avif source + webp img 폴백). 런타임 옵티마이저 우회 |
| `public/images/tarot/cards-opt/*.{avif,webp}` | 신규: 78장 512px AVIF(5.9MB)+WebP(7.0MB). 원본 1024px는 `cards/`에 마스터·폴백·테스트 픽스처로 유지 |

## 검증 결과 (전부 green)
- `tsc --noEmit` 클린
- 유닛 테스트 **172 pass / 0 fail** (에셋 존재·경로 단언 포함)
- `next build` 성공(10.9s, 256 정적 페이지), 타로 3개 라우트 빌드, 경고 0
- dev 렌더: picker 5열(모바일)/13×6(데스크톱), hover 인터랙션 동작, 클릭 → `/result?question&cardId&orientation` 정확
- result 페이지: `cards-opt/20_the_sun.avif` **100KB** 로드, 3MB PNG·`/_next/image` 미요청. 앞면 선명, flip-reveal 정상

## 효과
- picker: 3.3MB `00_back.png` → **0바이트**(CSS/SVG)
- 앞면 서빙: 장당 ~3MB(콜드인코딩) → **~78KB AVIF (−97%)**, 콜드인코딩 제거
- 한 화면 78장(페이징 제거) + 인터랙티브 hover 달성

## 미적용(의도적 — 후속)
- **D3 git/배포 위생**: 원본 216MB(`cards/`)는 아직 레포·배포에 잔존(사용자 결정=나중). `git filter-repo` 퍼지 + 마스터 object storage 이전은 별도 일정. *현재 사용자 체감 로딩은 이미 해결됨.*
- P1 새 덱 아트(미관) — 사용자 결정=유지.
- 커밋/PR 미수행(사용자 요청 시 `ganji-saju` 계정으로 브랜치 후 진행).