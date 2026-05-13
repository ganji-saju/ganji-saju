# 10. Fix Backlog (P2 + P3) — 앞으로 수정·반영할 것 & 버려도 될 것

> 2026-05-13 · 2주 내 개선 P2 9건 + 백로그/discardable P3 4건

---

## 🟡 P2 — 2주 내 개선 (9건)

### Auth · UX

#### P2-1. `/dialogue/[expert]` 페이지 레벨 게이트 부재
- **위치**: [`src/app/dialogue/[expert]/page.tsx`](../src/app/dialogue/[expert]/page.tsx)
- 페이지가 비로그인 사용자에게도 렌더링됨. API(`/api/ai`)에서만 게이트.
- 보안 위험은 없지만 UX 일관성 ↓ (잠긴 채팅 패널을 잠시 보여줌)
- **수정안**: `requireAccount('/dialogue/' + expertId)` 페이지 상단에 추가
- **owner**: frontend · **작업량**: 30분

#### P2-2. `/my/settings` 무인증 노출
- **위치**: [`src/app/my/settings/page.tsx`](../src/app/my/settings/page.tsx)
- 정적 콘텐츠만 노출되어 데이터 누설은 없지만 `/my` 네임스페이스 일관성 위반
- **수정안**: `/my/settings`도 requireAccount 적용 OR `/settings`로 이동
- **owner**: frontend · **작업량**: 30분

#### P2-3. `/api/dialogue/safety` 익명 무제한 POST
- **위치**: [`src/app/api/dialogue/safety/route.ts`](../src/app/api/dialogue/safety/route.ts)
- 익명 POST → `detectSafeRedirect()` 무한 호출 가능 (abuse 벡터)
- **수정안**: Upstash rate-limit OR `requireAccount` 추가
- **owner**: backend · **작업량**: 1h

### 인프라 · 도메인

#### P2-4. 도메인 3-hop 리다이렉트
- `ganjisaju.kr → www → punycode → www-punycode`
- **수정안**: Vercel 도메인 설정에서 모든 apex/한글 도메인을 `www.xn--…`로 1단계 308로 통합
- **owner**: devops · **작업량**: 1h

#### P2-5. canonical 호스트 www 불일치
- **위치**: [`src/lib/site.ts:5`](../src/lib/site.ts)
- `CANONICAL_SITE_URL = 'https://xn--s39at50bo6fmwa.kr'` (apex) vs 실제 `www.xn--…`
- robots.txt `Host:`도 apex
- **수정안**: 둘 다 `www`로 통일 OR Vercel에서 www → apex로 통합
- **owner**: frontend + devops · **작업량**: 1h

### SEO

#### P2-6. JSON-LD 구조화 데이터 0건
- **위치**: 모든 페이지
- **수정안**:
  - `app/layout.tsx`에 `WebSite` + `Organization` schema
  - 페이지별 `BreadcrumbList`
  - `/pricing` + `/membership`에 `Product` schema
- **owner**: SEO + frontend · **작업량**: 4-8h

#### P2-7. 홈 title "달빛인생" 4글자 (키워드 부족)
- **수정안**: `metadata.title = '달빛인생 — 무료 사주·타로·오늘운세·궁합·띠운세'` 등
- **owner**: SEO · **작업량**: 30분

### Performance / UX

#### P2-8. 가격 표기 9가지 불일치
- **수정안**: `formatPriceLabel(pkg, style: 'simple'|'from'|'tilde')` 헬퍼 (P1-2와 묶음)
- **owner**: frontend · **작업량**: P1-2에 포함

#### P2-9. `saju-new` 모바일 TBT 90ms / `home` `target-size` 위반
- birth-input-stepper hydration → Suspense + lazy mount
- 모바일 터치 타겟 ≥ 44×44pt
- **owner**: frontend · **작업량**: 2-4h

---

## 🟢 P3 — 백로그 / 버려도 됨 (4건)

### P3-1. `src/proxy.ts:77-78`의 `/dashboard` 미들웨어 가드 dead code
- **위치**: [`src/proxy.ts:77-78`](../src/proxy.ts)
- ```ts
  if (!pathname.startsWith('/dashboard')) {
    return response;
  }
  ```
- 코드베이스에 `/dashboard` 라우트 부재 → 라인 77-110 전체 unreachable
- **수정안**: 해당 코드 삭제 (`return response`만 남기거나, 향후 `/dashboard` 추가 시 다시 작성)
- **owner**: backend · **작업량**: 15분

### P3-2. 응답 헤더 `X-Powered-By: Next.js` 정보 노출
- **수정안**: `next.config.ts`에 `poweredByHeader: false` 추가 (P1-1과 묶을 수 있음)
- **owner**: devops · **작업량**: 5분

### P3-3. i18n 미적용
- 현재 한국 한정 운영 시 우선순위 낮음
- 다국어 확장 계획이 생기면 `next-intl` 도입 + 페이지별 metadata, content collection, accessibility label 작업
- **상태**: 백로그 유지 (확장 계획 없으면 영구 P3)

### P3-4. 한글 도메인 `간지사주.kr` macOS curl IDN 핸드셰이크 이슈
- **상태**: **버려도 됨** (curl 도구 한계, 실 브라우저 정상)
- 추적 종료. 단, 운영 모니터링에 한글 도메인 접속 성공률 dashboard 추가 권장

---

## 🗑 버려도 될 산출물 (audit-reports 자체)

본 캐노니컬 시리즈(00–10 + 2 JSON)가 모든 내용을 흡수했으므로 다음 `2026-05-13-*.md` 파일들은 정리 가능:

### 제거 권장 (캐노니컬에 흡수)
- `2026-05-13-MASTER-REPORT.md` → `00-executive-summary.md`
- `2026-05-13-catalog-consistency.md` → `02-paid-funnel-audit.md`
- `2026-05-13-entitlement-matrix.md` → `02-paid-funnel-audit.md`
- `2026-05-13-payment-flow-trace.md` → `02-paid-funnel-audit.md` + `03`
- `2026-05-13-security-surface.md` → `03-auth-payment-credit-integration-audit.md` + `08`
- `2026-05-13-design-tokens-audit.md` → `04` + `05`
- `2026-05-13-a11y.md` → `06-accessibility-audit.md`
- `2026-05-13-perf-budget.md` → `07-performance-seo-audit.md`
- `2026-05-13-seo-meta.md` → `07-performance-seo-audit.md`
- `2026-05-13-redirect-and-security-headers.md` → `07` + `08`

### 보존 권장 (원본 데이터 + 로그)
- `2026-05-13-route-inventory.json` (구조화된 raw, 01.csv와 보완 관계)
- `2026-05-13-entitlement-matrix.json` (raw matrix data — route-status-map.json과 동일 정보지만 다른 포맷)
- `2026-05-13-a11y.json` (axe-core raw)
- `2026-05-13-redirect-chain.txt` (curl raw)
- `2026-05-13-seo-metadata-raw.txt` (curl raw)
- `2026-05-13-payment-flow-trace.log` (P0-1 실증 raw)
- `2026-05-13-typecheck.log`, `2026-05-13-build.log` (CI 산출물 raw)
- `2026-05-13-persona-matrix.log`, `2026-05-13-playwright-output.log`, `2026-05-13-lighthouse-summary.log`

### 정리 명령 (사용자 확인 후 실행)
```bash
cd /Users/kionya/ganji-saju/audit-reports
# 1) 정리 디렉토리 생성
mkdir -p _legacy
# 2) 흡수된 md 파일들 격리
mv 2026-05-13-MASTER-REPORT.md \
   2026-05-13-catalog-consistency.md \
   2026-05-13-entitlement-matrix.md \
   2026-05-13-payment-flow-trace.md \
   2026-05-13-security-surface.md \
   2026-05-13-design-tokens-audit.md \
   2026-05-13-a11y.md \
   2026-05-13-perf-budget.md \
   2026-05-13-seo-meta.md \
   2026-05-13-redirect-and-security-headers.md \
   _legacy/
# 3) 검토 후 _legacy/ 디렉토리 삭제 (선택)
# rm -rf _legacy
```

또는 모두 한 번에 제거:
```bash
rm 2026-05-13-*.md
# raw 데이터 (json/log/txt)는 보존
```

---

## 📋 권장 진행 순서

1. **오늘 (P0)**: P0-1 + P0-2 fix를 단일 PR로 (예상 6-12h)
2. **48시간 내 (P1)**: P1-1 보안 헤더, P1-3 robots, P1-5 canonical, P1-6 핑크 토큰 (P0 PR과 묶음 가능)
3. **이번 주 내 (P1 잔여)**: P1-2 가격 SSOT, P1-4 OG 메타, P1-7 모바일 LCP
4. **2주 내 (P2)**: 9개 항목 순차 진행
5. **백로그 (P3)**: P3-1 dead code 삭제, P3-2 powered-by — 가벼우니 P0 PR에 묶기 가능
6. **버려도 됨**: P3-3 i18n, P3-4 IDN curl 이슈, legacy `audit-reports/2026-05-13-*.md`

---

## 🔁 재감사 트리거

다음 변경 시 재감사 권장:
- `add_credits` SQL 또는 `addCredits()` 함수 수정
- `/api/payments/confirm` 흐름 변경
- `src/lib/payments/catalog.ts` 가격 변경
- `src/app/styles/tokens.css` 컬러 토큰 변경
- 도메인/redirect 정책 변경
