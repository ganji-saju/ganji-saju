# Ganji Design System v1 Cleanup

이 문서는 `globals.css` 다이어트를 위한 안전 기준입니다. 한 번에 삭제하지 않고, 실제 사용 여부를 확인한 뒤 단계적으로 제거합니다.

## 확정된 production 기준

- 흰 배경, 블랙 텍스트, 핑크 포인트
- 기본 폰트는 Noto Sans KR 계열
- 홈과 핵심 플로우는 Gangi 컴포넌트 우선
- 설명보다 버튼, 상품, 질문 선택, 결과 요약 우선
- 전문 기준은 접힘 영역 또는 후순위 화면으로 분리

## 우선 유지할 공통 컴포넌트

- `GangiPageHeader`
- `GangiIntro`
- `GangiSection`
- `GangiActionRow`
- `GangiListLink`
- `GangiMiniCard`
- `GangiCharacter`

## Legacy class audit

2026-05-05 추가 정리 후 핵심 레거시 클래스 사용량입니다. `src/app/globals.css` 자체와 문서 내 언급은 제외하고 실제 production 소스 사용처를 기준으로 봅니다.

| class | src usage | 처리 결과 |
| --- | ---: | --- |
| `app-starfield` | 0 | 사용처 제거. CSS 장식 블록 삭제 |
| `moon-lunar-panel` | 0 | `gangi-report-panel`로 치환 |
| `moon-action-primary/secondary` | 0 | CSS 버튼 블록 삭제. 신규 CTA는 `gangi-primary-button`/`gangi-secondary-button` 사용 |
| `moon-cta-primary/secondary` | 0 | CSS CTA 블록 삭제 |
| `moon-topic-score-card` | 0 | CSS 블록 삭제 |
| `moon-orbit-card` | 0 | `gangi-evidence-card`로 치환 |
| `moon-form-control` | 0 | `gangi-form-control`로 치환 |
| `moon-payment-row` | 0 | `gangi-payment-row`로 치환 |
| `moon-plan-card` | 0 | `gangi-plan-card`로 치환 |
| `moon-hero-*` | 잔여 | 구형 랜딩/안내 화면 호환용. 핵심 상품 플로우에는 신규 추가 금지 |
| `app-gold*` | 잔여 | alias 유지. 핵심 입력/결과/결제 공통 컴포넌트는 `app-pink*`로 이동 |

## 이번 패스에서 건드리지 않는 것

- `layout/` 시안 원본: 로컬 참고자료로 유지
- `package-lock.json` 기존 로컬 변경: 디자인 시스템 커밋에 섞지 않음
- 프리미엄/검증/전문 설명 페이지의 긴 구조: 핵심 전환 플로우 안정화 뒤 별도 정리

## 다음 삭제 조건

아래 조건을 모두 만족하면 `globals.css`에서 해당 블록을 삭제합니다.

1. `rg "class-name" src --glob "!app/globals.css"` 결과가 0개
2. production build 통과
3. 모바일 핵심 경로 QA 통과
