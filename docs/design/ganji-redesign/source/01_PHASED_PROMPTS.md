# Claude Code 순차 작업 프롬프트

아래 프롬프트를 한 번에 모두 넣지 말고, Phase별로 실행한다. 각 Phase가 끝나면 Claude Code가 변경 파일과 테스트 결과를 보고하게 한다.

---

## Phase 0 — 디자인 소스 읽기 + 보드 매니페스트 생성

```md
첨부 handoff bundle의 README.md를 먼저 읽고, `project/간지사주 리디자인.html`을 top-to-bottom으로 읽어라. 그 다음 HTML이 import하는 `tokens.css`, `ui.jsx`, `screens-a.jsx`~`screens-n.jsx`, `desktop.jsx`, `animations.jsx`, `적용 가이드.md`를 모두 읽어라.

작업은 아직 코드 변경하지 말고, 먼저 다음 문서를 생성해라.

- docs/design/ganji-redesign/README.md
- docs/design/ganji-redesign/BOARD_MANIFEST.md
- docs/design/ganji-redesign/MOTION_SPEC.md
- docs/design/ganji-redesign/FUTURE_PAGE_IMPLEMENTATION_GUIDE.md
- docs/design/ganji-redesign/IMPLEMENTATION_STATUS.md

BOARD_MANIFEST.md에는 모든 DCArtboard를 빠짐없이 표로 넣어라. 각 row는 section, id, label, source component, source file, target route/component, status, notes를 포함해야 한다.

MOTION_SPEC.md에는 51~63 모션 보드 13개를 모두 넣어라. 각 row는 duration, trigger, production usage, reduced-motion fallback, implementation status를 포함해야 한다.

완료 후 전체 보드 개수와 모션 보드 개수를 보고해라. HTML에 있는 보드를 누락하지 말 것.
```

---

## Phase 1 — 토큰/폰트/공통 UI 프리미티브

```md
Phase 0 문서를 기준으로 디자인 토큰과 공통 컴포넌트를 먼저 구현해라.

적용 대상:
- src/app/styles/tokens.css 또는 현재 global css
- src/app/layout.tsx
- src/components/gangi/zodiac-chip.tsx
- src/components/gangi/gj-card.tsx
- src/components/gangi/gj-button.tsx
- src/components/gangi/gj-badge.tsx
- src/components/gangi/gj-banner.tsx
- site-header
- site-footer
- bottom dock component

반드시 적용할 디자인 요소:
- Noto Sans KR + Noto Serif KR
- --app/--gj pink, ink, line, zodiac accent colors
- 한자 인장 로고 `干`
- 12지 ZodiacChip: 子丑寅卯辰巳午未申酉戌亥
- glass sticky header
- dark full footer
- pink CTA
- rounded card/badge/chip system

서버 로직, auth, pay, href, tracking callback은 건드리지 말고 시각 레이어만 교체해라.

완료 후 lint/typecheck/build를 실행하고 결과를 보고해라.
```

---

## Phase 2 — 모션 시스템 먼저 구현

```md
모션 보드가 매우 중요하다. `animations.jsx`, `screens-l.jsx`, `screens-m.jsx`, `screens-n.jsx`를 읽고 51~63 모션 보드 13개를 production용 motion primitive로 구현해라.

생성 후보:
- src/components/gangi/motion/motion-primitives.tsx
- src/components/gangi/motion/saju-loading-motion.tsx
- src/components/gangi/motion/result-reveal-motion.tsx
- src/components/gangi/motion/tarot-flip-motion.tsx
- src/components/gangi/motion/coin-success-motion.tsx
- src/components/gangi/motion/page-transition-motion.tsx
- src/components/gangi/motion/modal-motion.tsx
- src/components/gangi/motion/toast-motion.tsx
- src/components/gangi/motion/push-arrive-motion.tsx
- src/components/gangi/motion/hanja-morph-motion.tsx
- src/components/gangi/motion/spinners.tsx
- src/components/gangi/motion/input-focus-motion.tsx
- src/components/gangi/motion/chart-draw-motion.tsx
- src/components/gangi/motion/palshja-shuffle-motion.tsx
- src/app/design/motion/page.tsx 또는 admin-only gallery route

요구사항:
- 13개 모션 전부 구현
- prefers-reduced-motion 지원
- SSR 안전성 보장
- production 화면에서는 Stage playback UI 제거
- QA gallery에서는 13개를 모두 한 번에 확인 가능
- MOTION_SPEC.md status 업데이트

완료 후 lint/typecheck/build를 실행하고 결과를 보고해라.
```

---

## Phase 3 — 핵심 구현 페이지 디자인 적용

```md
BOARD_MANIFEST.md 기준으로 이미 구현된 핵심 페이지에 디자인을 적용해라.

우선순위:
1. 01 홈
2. 02-1~02-3 사주입력
3. 03 사주 결과
4. 04 오늘운세
5. 05 타로
6. 06 궁합 입력/결과
7. 07 대화방 목록/대화방
8. 08 MY
9. 09 멤버십
10. 10 로그인
11. 15 깊은 사주 풀이
12. 16 결제 페이지/결제 결과/코인 충전

원칙:
- 기존 데이터 fetching과 action handler는 유지
- 디자인 shell만 교체
- href 변경 금지
- 결제/auth/logout/delete 같은 위험 액션 임의 변경 금지
- 각 보드 적용 후 IMPLEMENTATION_STATUS.md 업데이트

완료 후 lint/typecheck/test/build를 실행하고 결과를 보고해라.
```

---

## Phase 4 — 미구현 페이지 shell route 생성 + future docs

```md
아직 구현되지 않은 디자인 보드는 기능을 만들지 말고 design shell/stub route로 생성해라.

대상 예시:
- 오늘 자세히 550원
- 타로 풀스프레드
- 택일
- 프로필 편집
- 설정
- 고객센터
- 회원가입/비밀번호 찾기/회원탈퇴
- 공유용 결과 카드
- 코인 패키지
- 1:1 상담 예약
- PDF 1페이지/2페이지
- 락스크린 푸시 위젯
- 알림 센터
- 보관함 상세
- 띠운세 상세
- 별자리
- 검색 3상태
- 꿈해몽 검색
- 영문 화면
- 태블릿 화면
- 배너/에러/온보딩/푸시 권한/약관 모달
- 데스크탑 홈

구현 방식:
- src/features/design-stubs/pages/*.tsx
- src/features/design-stubs/mock-data/*.ts
- docs/design/ganji-redesign/future-pages/*.md

각 future doc에는 다음을 적어라.
- route
- source board id/label
- source component/file
- 현재 stub 상태
- 필요한 API/data contract
- 필요한 action handler
- 보안/결제/개인정보 주의사항
- 구현할 때 Claude Code에 줄 다음 지시문

stub 페이지는 실제 결제, 회원탈퇴, 저장, 상담예약을 실행하면 안 된다. 버튼은 disabled 또는 준비 중 상태로 둔다.

완료 후 build를 통과시키고 IMPLEMENTATION_STATUS.md를 업데이트해라.
```

---

## Phase 5 — 최종 QA / 누락 검수

```md
전체 handoff 구현을 최종 검수해라.

검수 기준:
- BOARD_MANIFEST.md의 모든 보드가 status를 가진다.
- 구현 대상 34개 정적 보드가 IMPLEMENTED 또는 STUBBED다.
- 모션 보드 13개가 모두 IMPLEMENTED고 gallery에서 확인 가능하다.
- 시스템/컴포넌트 보드는 공통 컴포넌트 또는 docs에 반영되어 있다.
- 미구현 페이지는 future-pages 문서가 있다.
- href, auth, pay, tracking callback이 의도치 않게 바뀌지 않았다.
- 360/390/768/1024/1280/1440 viewport에서 레이아웃이 깨지지 않는다.
- prefers-reduced-motion에서 모션이 축소된다.
- lint/typecheck/test/build가 통과한다.

최종 보고는 다음 형식으로 작성해라.

## 변경 요약
## 보드 적용률
## 모션 적용률
## 생성된 stub route
## future docs 목록
## QA 결과
## 남은 리스크
```
