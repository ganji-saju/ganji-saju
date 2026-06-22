# 설계 — 표면별 텍스트 크기 상향 + 스크린샷 회귀 워크플로

> 2026-06-22 · 후속(#450 가독성 기반 PR 이후). 대상: ≤12px 텍스트 **1,305곳**의 체계적 상향.
> 이 문서는 **설계**다. 실행은 단계별 승인 후.

---

## 0. 핵심 통찰 (설계를 가르는 전제)

1. **순수 픽셀 diff는 못 쓴다.** 폰트를 키우면 픽셀이 *의도적으로* 바뀐다 → `toHaveScreenshot` 픽셀 회귀는 모든 표면에서 "변경됨"으로 떠 신호가 0. **진짜 회귀 신호 = 레이아웃 깨짐**(가로 오버플로·텍스트 클리핑·뷰포트 초과·줄바꿈 붕괴).
   - **자동 게이트** = 레이아웃 헬스 단언(overflow/clip 검출).
   - **스크린샷** = before/after 갤러리로 **사람이 눈으로** "더 좋아졌나 + 안 깨졌나" 판정(픽셀 단언 아님).
2. **dev 서버는 공유 자원(포트 3000).** 여러 에이전트가 각자 서버+Playwright 병렬 기동 불가 → **스크린샷/헬스는 순차 1회**. 병렬화 대상은 **코드모드(파일 편집)** 뿐.
3. **고밀도 표면 다수가 인증·데이터 표면**(saju 결과·today 결과). unauth 입력/정적 표면은 즉시 캡처 가능하나, 결과 화면은 **E2E_TEST_USER creds + seed 리딩** 필요(playwright.config 의 auth-setup/chromium-auth 패턴 재사용).

---

## 1. 범위 / 표면 맵 (밀집도 기준)

| 우선 | 표면 | ≤12px | 라우트 | 캡처 난이도 |
|---|---|---|---|---|
| P1 | today-fortune | 95 | `/today-fortune`(입력)·결과(데이터)·`/saju/[slug]/today-detail` | 입력=쉬움 / 결과=seed 필요 |
| P1 | saju 결과 | 79 | `/saju/[slug]`(+overview/elements/nature/deep) | 인증+seed |
| P2 | compatibility | 36 | `/compatibility`·`/input`·`/result` | 입력=쉬움 / 결과=seed |
| P3 | gangi(홈 배너 등) | 8 | `/` | 쉬움(unauth) |

> home·dream·membership·saju-narrative 는 arbitrary `text-[Npx]` 0(이미 Tailwind `text-xs/sm` 사용) → 기반 PR(#450 토큰)로 충분, 코드모드 대상 아님.

---

## 2. 코드모드 규칙 (기계적이되 판단 필요)

신규 토큰(#450, tokens.css) 기준 치환:

| 현재 | →  | 비고 |
|---|---|---|
| `text-[10.5px]`·`text-[11px]` (보조) | `text-[13px]`(=`--app-text-sm`) | 본문급이면 15px |
| `text-[12px]` (본문성) | `text-[15px]`(=`--app-text-body`) | 캡션이면 유지 |
| `text-[≤10px]` (마이크로) | `text-[11~12px]` | #450에서 일부 선반영 |

**스킵(상향 금지) 컨텍스트** — 깨짐 위험:
- 고정폭/고정높이 컨테이너, `truncate`·`line-clamp`·`tabular-nums` 정렬 의존, 칩/배지의 조밀 그리드, 차트 축/범례(공간 0).
- → 에이전트가 컴포넌트를 읽고 **케이스별 판단**(맹목 일괄치환 금지). 스킵 시 사유 기록.

---

## 3. Playwright 레이아웃-헬스 + 캡처 하니스 (신규)

신규 `e2e/readability-visual.spec.ts` (별도 project `readability`, webServer 재사용):

```ts
// 표면 × 뷰포트(모바일 390 + 데스크톱 1280)
const SURFACES = [
  { name: 'home', path: '/', auth: false },
  { name: 'today-input', path: '/today-fortune', auth: false },
  { name: 'compat-input', path: '/compatibility/input', auth: false },
  { name: 'saju-result', path: `/saju/${process.env.E2E_SEED_SLUG}`, auth: true },
  // … today 결과·compat 결과는 seed 후 추가
];
const VIEWPORTS = [{ w: 390, h: 844, t: 'mobile' }, { w: 1280, h: 900, t: 'desktop' }];

for (const s of SURFACES) for (const v of VIEWPORTS) {
  test(`${s.name}-${v.t}`, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h });
    await page.goto(s.path, { waitUntil: 'networkidle' });
    // (1) 자동 게이트 — 레이아웃 헬스
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const horiz = de.scrollWidth - de.clientWidth;       // 가로 오버플로(px)
      const clipped = [...document.querySelectorAll('*')].filter(el => {
        const cs = getComputedStyle(el);
        return cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1
          && !el.closest('[data-allow-scroll]');           // 의도적 스크롤 제외
      }).length;
      return { horiz, clipped };
    });
    expect(overflow.horiz, '가로 오버플로').toBeLessThanOrEqual(1);
    // clipped 는 경고 수준(텍스트 줄임 의존 컴포넌트 존재) → 리포트만, 임계 초과 시 fail
    // (2) 캡처 — before/after 갤러리(사람 검토용, 픽셀 단언 아님)
    await page.screenshot({ path: `e2e/readability-shots/${process.env.SHOT_PHASE}/${s.name}-${v.t}.png`, fullPage: true });
  });
}
```

- **게이트**: 가로 오버플로 ≤1px(모바일에서 글자 커지며 가로 스크롤 생기면 fail = 핵심 신호).
- **캡처**: `SHOT_PHASE=before|after` 폴더로 fullPage 저장 → 나란히 비교(사람).
- 인증 표면은 기존 auth-setup storageState 재사용 + `E2E_SEED_SLUG`(seed된 리딩 slug). creds 없으면 unauth 표면만.

---

## 4. 워크플로 오케스트레이션 (단계)

> 스크린샷 순차 제약 때문에 **병렬은 코드모드 한 단계뿐**. 나머지는 순차 게이트.

```
[Stage 0 · 베이스라인]  (메인 main, 변경 전)
  - dev 서버 기동 → readability-visual.spec(SHOT_PHASE=before) 실행
  - 산출: before/ 스크린샷 + 현재 오버플로 0 확인(기존 깨짐 없음 기준선)

[Stage 1 · 코드모드]  (브랜치, 병렬 또는 순차 — 표면 4~6개라 순차 권장/worktree)
  - 표면별 에이전트: 컴포넌트 읽고 §2 규칙으로 크기 상향, 스킵 사유 기록
  - 각 에이전트 반환: {표면, 변경 라인 수, 스킵 목록, 위험 메모}
  - build + typecheck 통과 확인

[Stage 2 · 재캡처 + 헬스]  (순차, 1 서버)
  - dev 서버 재기동 → readability-visual.spec(SHOT_PHASE=after) 실행
  - 자동 게이트: 오버플로 fail 표면 = 회귀 후보

[Stage 3 · 트리아주]
  - 게이트 통과 + 갤러리 양호 표면 → 채택
  - 오버플로/클리핑 표면 → 해당 표면만 되돌림 또는 부분 수정(스킵 추가)
  - before/after 갤러리(모바일·데스크톱) → 사용자 시각 승인

[Stage 4 · 머지]  CI(빌드·기존 E2E) 그린 → squash 머지
```

**Workflow 도구 역할**: Stage 1(표면별 코드모드 병렬/순차 + 구조화 반환)에 사용. Stage 0/2(Playwright 순차)는 메인 루프가 Bash 로 구동. → 하이브리드(워크플로 + 인라인 순차)가 정답, 순수 단일 워크플로 아님.

---

## 5. 실현 가능성 / 리스크

- ⚠️ **인증·데이터 표면(saju/today 결과 = 최고 밀집)** 스크린샷엔 `E2E_TEST_USER_*` creds + seed 리딩 필요. 미보유 시 **unauth 표면(입력·홈·정적)만 자동 캡처**, 결과 표면은 **로컬 수동 또는 별도 seed**.
- ⚠️ 코드모드는 맹목 치환 금지(고정폭/truncate/차트). 에이전트 판단 품질이 관건.
- ⚠️ dev 서버 1개 → 캡처 순차(표면 × 2뷰포트 = 시간). 표면 제한으로 관리 가능.
- 위험 낮춤: 표면별 독립 커밋 → 깨진 표면만 revert 가능.

## 6. 비용/단계 추정

- Stage 1 코드모드: 표면 4~6 × (읽기+편집) ≈ 에이전트 4~6, 중간 토큰.
- Stage 0/2 Playwright: 로컬 구동 ~수 분(표면 수 비례).
- **권장 1차 실행**: unauth 표면(today 입력·compat 입력·홈) + gangi 만으로 파일럿 → 하니스·게이트 검증 후 인증 표면 확대.

## 7. 선결 질문 (실행 전 확인)

1. **E2E_TEST_USER creds + seed 슬러그** 보유? (결과 표면 자동 캡처 가능 여부 결정)
2. 1차 범위: **unauth 파일럿 먼저** vs **인증 표면까지 한 번에**?
3. 갤러리 검토 방식: before/after PNG 폴더 + 로컬 `open` vs HTML 갤러리 생성?
