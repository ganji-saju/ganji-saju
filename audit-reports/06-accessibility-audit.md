# 06. Accessibility Audit (WCAG 2.0/2.1 A·AA)

> 2026-05-13 · `@axe-core/playwright` 4.11.3 (WCAG 2.0 A/AA + 2.1 A/AA)
> 라이브 도메인 `https://www.xn--s39at50bo6fmwa.kr` 10개 라우트 측정
> 원본 JSON: [`2026-05-13-a11y.json`](2026-05-13-a11y.json)

---

## 1. 결과 요약

| 라우트 | status | critical | serious | moderate | minor | passes | loadMs |
|---|---:|---:|---:|---:|---:|---:|---:|
| home          | 200 | 0 | 1 | 0 | 0 | 23 | 1207 |
| free          | 200 | 0 | 1 | 0 | 0 | 23 | 2892 |
| pricing       | 200 | 0 | 1 | 0 | 0 | 23 | 2857 |
| saju-new      | 200 | 0 | 1 | 0 | 0 | 23 | 2086 |
| credits       | 200 | 0 | 1 | 0 | 0 | 24 | 2051 |
| dialogue      | 200 | 0 | 1 | 0 | 0 | 23 | 3679 |
| tarot-daily   | 200 | 0 | 1 | 0 | 0 | 25 | 2507 |
| zodiac        | 200 | 0 | 1 | 0 | 0 | 23 | 4235 |
| today-fortune | 200 | 0 | 1 | 0 | 0 | 28 | 2907 |
| membership    | 200 | 0 | 1 | 0 | 0 | 23 | 3849 |

**총계: critical 0 · serious 10 · moderate 0 · minor 0**

---

## 2. 유일한 위반: `color-contrast` (serious, WCAG 1.4.3 AA)

- 모든 10개 페이지에서 동일 룰 위반
- 페이지별 위반 노드(axe-core nodeCount): home 9 / free 11 / pricing 13 / saju-new 9 / credits 14 / dialogue 12 / tarot-daily 10 / zodiac 10 / today-fortune 12 / membership 11
- **총 위반 노드 ~111개**
- 도움말: https://dequeuniversity.com/rules/axe/4.11/color-contrast

### 원인 토큰
| 토큰 | 값 | 흰 배경 대비 | AA 정상 | AA 큰 텍스트 |
|---|---|---:|---|---|
| `--app-pink` | `#ff4f9a` | **2.95:1** | ❌ | ❌ |
| `--app-coral` | `#ff6b6b` | 3.41:1 | ❌ | ✅ |
| `--app-plum` | `#c04de0` | 3.92:1 | ❌ | ✅ |
| `--app-sky` | `#368ee8` | 3.69:1 | ❌ | ✅ |

### Lighthouse cross-check
5개 데스크탑 라우트 Lighthouse a11y 91-96점 — 모두 동일한 `color-contrast` 항목 1건 미통과.

---

## 3. home 추가 위반: `target-size` (P2)
- 모바일 터치 타겟 일부 < 44×44pt
- 모바일 LCP 페이지에서 결제 CTA 클릭 영역이 충분치 않을 수 있음

권고:
```css
button, a[role="button"] {
  min-height: 44px;
  min-width: 44px;
}
```

---

## 4. 통과 항목 (전 페이지 공통)

axe-core 23-28개 패스:
- aria-allowed-attr, aria-required-attr, aria-roles, aria-valid-attr
- label, button-name, link-name, form-field-multiple-labels
- duplicate-id-active, frame-title, html-has-lang (`lang="ko"`), html-lang-valid
- image-alt (검사 가능한 이미지 모두 alt 통과)
- landmark-one-main, region, scope-attr-valid
- focus-order-semantics, link-in-text-block, listitem, list

---

## 5. 권고 fix

### P1 — color-contrast (전 페이지)
```css
/* Before (tokens.css 추정) */
--app-pink: #ff4f9a;          /* contrast 2.95 — fail */

/* After */
--app-pink-text: #d81b72;     /* contrast 4.62 — AA pass */
--app-pink-bg: #ff4f9a;       /* 배경용은 유지 */
```
또는 핑크 텍스트를 사용하는 컴포넌트에서 `text-[var(--app-pink-strong)]` 적용.

### P2 — target-size (home)
- 결제 CTA, dock 버튼, action-cluster 항목 검토 → 44×44 보장

### P2 — 키보드 포커스 윤곽선
- `focus-visible:ring-3 focus-visible:ring-[var(--app-pink)]/24` 패턴 이미 적용됨 ✓
- 다만 핑크 ring이 흰 배경에서 시인성 낮음 — strong pink 사용 검토

---

## 6. 미검증 (Phase 4 페르소나 매트릭스에서 추가)

- `/my/profile`, `/my/billing`, `/my/results` (로그인 상태)
- `/saju/[slug]/today-detail` Premium 권한 보유 시 풀 콘텐츠 페이지
- `/dialogue/[expert]` 활성 채팅 패널 (DialogueChatPanel)
- `/membership/checkout` Toss 위젯 iframe

→ 인증 페르소나 추가 a11y 검사 권고.

---

## 7. 우선순위 분류

- **P0**: 0
- **P1**: 1 (color-contrast — 전 10페이지, ~111 노드)
- **P2**: 1 (home target-size)
