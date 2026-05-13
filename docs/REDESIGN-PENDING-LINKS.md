# 리디자인 — 매핑 보류 링크 목록

> [`docs/DESIGN-redesign-2026-05-13.md`](./DESIGN-redesign-2026-05-13.md) Q3 결정에 따라,
> Claude 디자인 mockup에는 있지만 현재 코드베이스에 대응 라우트가 명확하지 않은 버튼들은
> `disabled` 상태로 시각만 표시하고, 본 문서에 누적 기록합니다.
> 사용자분이 다음 작업 의뢰 주실 때 본 문서를 우선 검토하고 라우트를 결정·연결합니다.

## 기록 양식

```
### <페이지 / 컴포넌트>
- **버튼 라벨**: "..."
- **위치**: 파일 경로 + 줄번호
- **mockup 출처**: zip의 screens-X.jsx 의 어느 섹션 (스크린샷 묘사)
- **현재 처리**: `<button disabled>` + `data-redesign-pending="true"` 속성 부여
- **추정 라우트**: (있다면) `/some/path` 또는 "라우트 신설 필요"
- **상태**: 🟡 보류 / 🟢 결정됨 / 🔴 라우트 신설 필요
```

---

## PR1 (foundation) — 보류 0건

PR1은 토큰·헤더·푸터·zodiac-chip만 다루므로 disabled 버튼이 발생하지 않습니다.
모든 푸터 링크는 사이트 기존 라우트와 1:1 매칭됨.

---

## PR2 (홈 페이지) — 보류 0건

mockup `screens-a.jsx` 의 모든 인터랙티브 요소가 사이트 기존 라우트와 1:1 매칭됩니다.

### 매핑 검증
- Big banner CTA → `banner.href` (콘텐츠에서 가져옴, 기존 데이터)
- Free quick actions 2개 → `/today-fortune?concern=general`, `/tarot/daily`
- Category tabs 4개 → 상태 토글만 (라우트 없음)
- Service grid 8개 → 각 `card.href` (`GANGI_HOME_CARDS` 기존 데이터)
- Bottom CTA → `/saju/new`

PR3 이후 페이지별로 작업 진행 시, 매핑 안 되는 버튼이 발견되면 본 섹션 아래에 누적합니다.

---

## PR3 이후 (페이지별)

### PR3 — 로그인 페이지 (`/login`) — 보류 1건

#### Apple OAuth 버튼
- **버튼 라벨**: "Apple로 계속하기 (준비 중)"
- **위치**: [src/app/login/page.tsx](../src/app/login/page.tsx) — `GatewayView` 컴포넌트 내부 (mockup `screens-b.jsx` ScreenAuth 3번째 SNS 버튼)
- **mockup 출처**: `screens-b.jsx` 458행, gateway 진입 화면의 검은색 Apple 버튼
- **현재 처리**: `<button disabled>` + `data-redesign-pending="true"` + `title="준비 중"` + `aria-label="Apple로 계속하기 (준비 중)"` + opacity 60%. 클릭 핸들러 없음.
- **추정 라우트**: Supabase OAuth provider 추가 필요 (`signInWithOAuth({ provider: 'apple', ... })`). 별도 PR.
- **선행 작업**:
  1. Apple Developer Program 가입 (유료, $99/년) 및 Service ID 발급
  2. Apple Sign In Key (`.p8`) 생성 + Team ID / Key ID 수집
  3. Supabase Dashboard → Authentication → Providers → Apple 활성화 + 위 자격증명 입력
  4. `signInWithProvider` 함수에 `'apple'` 케이스 추가 (현재는 `'google' | 'kakao'` 만 허용)
- **상태**: 🟡 보류 (별도 PR — 인프라 작업 선행 필요)

<!-- PR4 — 오늘운세 (작성 예정) -->
<!-- … -->
