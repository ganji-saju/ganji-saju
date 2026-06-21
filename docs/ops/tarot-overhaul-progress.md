# 진행 기록 — 타로 시스템 전면 개편 (UX·풀이 품질·깊이·풍부화)

- **기간**: 2026-06-21 (KST)
- **프로젝트**: ganji-saju · prod Supabase `bgtzkjxihlbmxehmhtwg` · Vercel `ganji-sajus-projects/ganji-saju` · `ganjisaju.kr`
- **발단**: 사용자 피드백 "타로 카드 뽑는 게 불편하다" → 카드 뽑기 UX 개선에서 시작해 풀이 정확성·깊이·풍부함까지 전면 개편
- **관련 PR(전부 MERGED·라이브)**: #432 · #433 · #435 · #436 · #437 · #438 (#434는 베이스 충돌로 #435 재생성)
- **상위 설계/조사 문서**: `docs/ops/tarot-system-improvement.md`(진단·연구·로드맵·반영기록) · `docs/ops/tarot-picker-redesign.md`(피커 리디자인)

---

## 1. 한 줄 요약

타로 데일리 플로우를 **한 화면 인터랙티브 피커 → 3장 직접 뽑기 → 공감형 풍부한 스프레드 풀이**로 전면 재구성하고, 앞면 에셋을 −97% 최적화했다. 모든 변경은 **무료·결정론 재현성·정직성(예측 적중 비주장)** 제약을 지키며 단계적으로 라이브 반영됐고, 끊겼던 Vercel 자동배포 연동도 복구했다.

---

## 2. 작업 순서 (PR별)

| # | PR | 무엇 | 상태 |
|---|---|---|---|
| 1 | [#432](https://github.com/ganji-saju/ganji-saju/pull/432) | **한 화면 78장 인터랙티브 피커 + 앞면 AVIF 최적화** | 🟢 라이브 |
| 2 | [#433](https://github.com/ganji-saju/ganji-saju/pull/433) | **풀이 품질 P0** — 은둔자 룩업 버그·역방향 카드별 분화·면책문구·안전 게이트 | 🟢 라이브 |
| 3 | [#435](https://github.com/ganji-saju/ganji-saju/pull/435) | **P1·A2** — 78장 한글 카드 의미 + "이 카드가 말하는 것" 렌더 | 🟢 라이브 |
| 4 | [#436](https://github.com/ganji-saju/ganji-saju/pull/436) | **P1·A4** — 3카드 스프레드 심화뷰 + 종합 서사 | 🟢 라이브 |
| 5 | [#437](https://github.com/ganji-saju/ganji-saju/pull/437) | **3장 직접 뽑기로 완전 교체** | 🟢 라이브 |
| 6 | [#438](https://github.com/ganji-saju/ganji-saju/pull/438) | **스프레드 풀이 풍부화**(공감형 대폭 확장) | 🟢 라이브 |

---

## 3. 핵심 입장 — "타로 풀이가 '맞다'"의 정직한 정의

조사(웹리서치 RWS/Waite·Greer·Pollack·Biddy + 회의론 Forer/Wiseman) 결과:

- 타로는 **예측 적중을 실증 검증할 수 없다.** 사용자가 느끼는 "정확함"은 Forer/바넘 효과(동일 일반론에 평균 84% "내 얘기")·확증편향으로 설명된다.
- 따라서 측정·개선 대상은 *적중*이 아니라 **풀이 품질 7차원**: 질문 관련성·내부 일관성·구체성(anti-바넘)·실제 RWS 의미 충실도·재현성·안전성·사용자 공명.
- 달빛선생의 약속 = "미래를 맞힌다"가 아니라 **"오늘의 흐름·가능성을 비추고 결정은 선생님께 돌려드린다."** result/spread 면책문구·코드·테스트에 이 입장을 박아두었다.

---

## 4. PR별 상세

### #432 — 한 화면 78장 인터랙티브 피커 + AVIF 최적화
- 18장×5묶음 가로 스와이프 캐러셀 폐기 → **단일 그리드**(모바일 5열 44px 탭타깃 / 데스크톱 13×6, 페이징 0).
- 뒷면을 **CSS+SVG 신비 기하 만다라**로 교체 → 3.3MB `00_back.png` 제거(이미지 0바이트), hover 리프트·시머·이웃 갈라짐.
- 앞면 78장: 아트 유지한 채 **512px AVIF/WebP 사전인코딩**(`cards-opt/`), `<picture>` 직접 서빙 → 런타임 옵티마이저 콜드인코딩 우회.
- **서빙 페이로드 216MB → ~4MB AVIF (−97%).** 원본 1024px는 마스터·폴백·테스트 픽스처로 `cards/` 유지.
- 적대적 검증이 모바일 9열(24px) 오탭 결함을 잡아 **5열(44px)로 교정**.

### #433 — 풀이 품질 P0 (버그수정 + 정직성)
- **A1**: The Hermit(은둔자) 메이저 룩업 누락 수정(22장 중 1장이 영문 `The Hermit`로 노출되던 버그).
- **A3**: 역방향이 모든 카드를 단일 `'blocked'`로 뭉개던 결함 제거 → `getUprightFlowState` 도출 후 카드별 역방향 변환(reversed Sun ≠ reversed Tower). 정방향 동작 100% 보존.
- **B6**: result 페이지 **entertainment+agency 면책문구** 추가.
- **B1**: 생성 풀이 출력(78×2×질문5)에 예측적중·의료·재정·doom 어휘 0 검증 안전 게이트 + 정직성 가드에 tarot 페이지 추가.

### #435 — P1·A2: 78장 한글 카드 의미
- 56장 마이너가 제너릭하던 근본 원인(실제 RWS 의미가 렌더 0회) 해결.
- `tarot-card-meanings-ko.ts` 신규 — 78×정역 한글 의미(영문 Waite 원전 충실, 달빛선생 보이스, anti-Barnum, 정역 분화). 11에이전트 워크플로 집필+적대 검증.
- result §3에 "이 카드가 말하는 것 [정/역방향]" 렌더.

### #436 — P1·A4: 3카드 스프레드 심화뷰
- 데드코드였던 `getTarotSpreadForQuestion`(UI import 0) 엔진 활성화.
- `buildSpreadSynthesis()` — 3 포지션(현재/원인/조언)을 잇는 종합 서사(포지션 흐름·예언/운명 어휘 0·주체성 마감).
- `/tarot/daily/spread` 라우트 신규. 렌더 검증으로 조사 버그 2건(`판단를→판단을`, `재물으로→재물로` ㄹ예외) 수정.

### #437 — 3장 직접 뽑기로 완전 교체
- 사용자 지적("처음에 1장이 아니라 3장을 뽑아야"): 1장 고르고 안 고른 3장 자동 표시 모순 해소.
- 피커: Link 단일선택 → **button 3장 누적 선택**(진행표시·번호배지·한 장 취소). 3장째 → `/spread?cards=a,b,c&orientations=u,r,u`.
- `getTarotSpreadReadingForCards(question, picks[])` — 고른 3장 배치, 중복 dedup·최대 3장 정규화, 미만 시 질문 시드 폴백.
- 보관함: **마이그레이션 없이** 기존 `tarot_result_snapshots` 재사용(card_id/orientation 쉼표 join, CHECK 없는 TEXT). vault href 쉼표 감지→/spread. 단일카드 `/result` 레거시 유지.
- 카피 ~15곳 "한 장"→"세 장" 정합.
- **적대적 코드리뷰(회귀·정직성·결정론·계약) 블로커 0**: 발견 4건(중복 URL·>3장·재현성 주석·카피) 즉시 반영.

### #438 — 스프레드 풀이 풍부화 ("가득가득 + 공감")
- 카드별 1~2문장 의미만 보이던 것을 여러 층으로 채움:
  - **카드의 메시지**: 156개 의미를 **3~4문장(105~174자, 중앙 130) 공감형으로 재집필**(2인칭 "지금 당신은…", 위로·다독임, 카드 이미지 묘사). 11에이전트 워크플로(집필 → 적대 검증 empathy/fullness/faithfulness/safety/barnum/한국어 → 1장 재집필).
  - **포지션 공감 인트로**(`buildSpreadPositionInsight`) — 카드를 그 자리×정역으로 읽는 사람 마음에 건넴.
  - **풍부한 종합** — opener 공감 + flow + texture(역방향 다수 분기) + 따뜻한 agency 마감.
  - **🌙 오늘 마음에 둘 한 가지**(`buildSpreadClosing`) — 조언 카드의 구체적 행동.
- 무거운 카드(Death/Tower/소드10) 역방향 모두 회복·주체성 마감(doom/예언/운명 0).

---

## 5. 인프라 사건 — Vercel 자동배포 복구

- #432 머지 시 CI는 통과했으나 **Vercel 자동배포가 13일째 미트리거**(GitHub App↔Vercel 연결 끊김). 신규 에셋 404·프로덕션 구버전.
- 진단: repo classic webhook 없음 → **GitHub App 방식**. 사용자 승인 후 `vercel --prod` 수동 배포로 라이브.
- 사용자가 GitHub App 권한 + Vercel Git 재연결 → **테스트 push로 자동배포 복구 검증**(~80초). 이후 #433~#438은 머지→자동배포 정상(60~100초).
- 메모리 `project_ganji_saju_deploy` 갱신(자동배포가 항상 fire하지 않으니 라이브 검증 필수).

---

## 6. 검증 방식 (전 PR 공통)

각 PR마다: `tsc --noEmit` 클린 → 유닛 테스트 **fail 0** → `next build` 성공 → **실제 렌더 출력 검증**(Playwright 스크린샷·DOM) → (대규모 변경) 적대적 코드리뷰 워크플로 → 머지 → **프로덕션 라이브 폴링 확인**.

- 회귀 테스트 신규: 메이저 한글명·역방향 분화·overclaim 차단·78장 한글 의미 고유성·스프레드 결정론/안전·user-pick 배치·dedup.
- 안전 게이트: 생성되는 모든 풀이 출력에 예측적중·의료·재정·doom 어휘가 없음을 카드×방향×질문 매트릭스로 검사.

---

## 7. 제약 준수 (모든 변경)

- **$0 런타임**: AI per-reading 비용 없음. 결정론 템플릿 엔진 + 사전 인코딩 에셋.
- **무료**: 타로는 페이월 없음.
- **결정론/재현성**: 데이터 룩업·시드. 단 3장 뽑기는 crypto 랜덤(질문 시드 아님) → 같은 날 재현 없음, URL 고정으로 replay/공유/보관함 재현만.
- **정직성**: 예측 적중 비주장. 면책문구·안전 게이트·종합의 예언/운명 어휘 금지 하드테스트.
- **DB 마이그레이션 없음**: 스프레드 보관함은 기존 테이블 재사용.

---

## 8. 남은 로드맵 (미반영)

- **P2 · C1** — "달빛선생에게 한 번 더 묻기" 옵트인 AI 1턴. 유일하게 결정론 이탈 → ⚠️ Supabase DB scope 수동 마이그레이션 + 비용 캡 + safety validator(블로킹) 필요. 사용자 결정으로 보류, 진행 전 별도 합의.
- A4 변형 — (필요 시) 더 긴 풀이·질문 맥락 더 반영·사주 연결 강화.

---

## 9. 산출물 위치

| 종류 | 경로 |
|---|---|
| 조사·로드맵·반영기록 | `docs/ops/tarot-system-improvement.md` |
| 피커 리디자인 | `docs/ops/tarot-picker-redesign.md` |
| 본 진행 기록 | `docs/ops/tarot-overhaul-progress.md` |
| 시각 리포트 | `docs/ops/tarot-overhaul.html` |
| 인터랙티브 프로토타입(참고) | `docs/ops/tarot-picker-preview.html` · `tarot-back-motifs.html` |
