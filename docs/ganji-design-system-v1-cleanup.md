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

2026-05-05 기준 `src/app/globals.css`에 남아 있고, `src`에서 확인된 주요 레거시 클래스 사용량입니다.

| class | src usage | 처리 방향 |
| --- | ---: | --- |
| `app-starfield` | 38 | 핵심 플로우에서 제거. 문서/프리미엄 잔여 화면은 후속 정리 |
| `moon-lunar-panel` | 27 | GangiSection 또는 app-panel로 치환 후 삭제 후보 |
| `moon-action-compact` | 0 | 이번 패스에서 사용처 제거. CSS 블록도 제거 완료 |
| `moon-action-primary/secondary` | 20 | Gangi 버튼으로 치환 후 삭제 후보 |
| `moon-cta-primary/secondary` | 16 | Gangi 버튼으로 치환 후 삭제 후보 |
| `moon-hero-*` | 40+ | 홈 신형에서는 미사용. 안내/레거시 컴포넌트 정리 후 삭제 후보 |
| `moon-topic-score-card` | 7 | 결과 화면에서 Gangi 카드로 치환 후 삭제 후보 |
| `moon-orbit-card` | 10 | 사주 세부/근거 카드에 남음. 접힘 영역 정리 때 치환 |
| `moon-form-control` | 14 | 입력 폼 공통 컴포넌트 교체 후 삭제 후보 |
| `moon-payment-row` | 11 | 결제 화면 Gangi 상품 행으로 정리 후 삭제 후보 |

## 이번 패스에서 건드리지 않는 것

- `layout/` 시안 원본: 로컬 참고자료로 유지
- `package-lock.json` 기존 로컬 변경: 디자인 시스템 커밋에 섞지 않음
- 프리미엄/검증/전문 설명 페이지의 긴 구조: 핵심 전환 플로우 안정화 뒤 별도 정리

## 다음 삭제 조건

아래 조건을 모두 만족하면 `globals.css`에서 해당 블록을 삭제합니다.

1. `rg "class-name" src --glob "!app/globals.css"` 결과가 0개
2. production build 통과
3. 모바일 핵심 경로 QA 통과
