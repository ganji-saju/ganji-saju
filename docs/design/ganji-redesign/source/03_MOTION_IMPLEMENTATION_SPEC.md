# 모션 보드 구현 스펙

13개 모션 보드는 production UI에 반드시 반영하거나, 실제 화면 트리거가 아직 없으면 QA gallery와 motion primitive로 구현한다.

| Board | Source | Duration | Production trigger | Required behavior | Reduced motion fallback | Status |
|---|---|---:|---|---|---|---|
| 51 · 사주 분석 로딩 (6s) (`m-loading`) | `screens-l.jsx:9` | 6s | 사주 분석 요청 후 결과 대기 | 팔자/한자/점성 요소가 순차적으로 나타나는 6초 루프형 로딩 | 정적 로딩 카드 + progress text | TODO |
| 52 · 결과 카드 등장 (6s) (`m-reveal`) | `screens-l.jsx:154` | 6s | 사주 결과 첫 진입 | 결과 카드가 stagger로 등장하고 핵심 점수가 강조됨 | 카드 즉시 표시 | TODO |
| 53 · 타로 카드 플립 (6s) (`m-tarot`) | `screens-l.jsx:295` | 6s | 타로 카드 선택/오픈 | 카드가 3D flip되고 의미 텍스트가 순차 노출 | 카드 전환 fade | TODO |
| 54 · 코인 충전 성공 (5s) (`m-coin`) | `screens-l.jsx:447` | 5s | 코인 충전/결제 성공 | 코인/빛 입자가 터지고 성공 카드가 확정됨 | 성공 카드만 표시 | TODO |
| 55 · 페이지 전환 (5s) (`m-page`) | `screens-m.jsx:6` | 5s | 페이지 이동 | 이전 화면이 밀리고 새 화면이 올라오는 전환 | instant navigation | TODO |
| 56 · 모달 등장 (5s) (`m-modal`) | `screens-m.jsx:121` | 5s | 모달 open | dim + sheet/modal scale/fade/slide | fade only 또는 즉시 표시 | TODO |
| 57 · 토스트 시퀀스 (6s) (`m-toast`) | `screens-m.jsx:225` | 6s | 토스트 큐 | 여러 토스트가 stack으로 순차 등장/퇴장 | 최신 토스트 1개 정적 표시 | TODO |
| 58 · 푸시 알림 도착 (5s) (`m-push`) | `screens-m.jsx:310` | 5s | 푸시 수신 preview | 잠금화면/알림 카드가 상단에서 등장 | 알림 카드 정적 표시 | TODO |
| 59 · 한자 변환 (6s) (`m-hanja`) | `screens-m.jsx:435` | 6s | 한자/띠/간지 변환 | 한자가 morph/slot transition으로 변환 | 최종 한자만 표시 | TODO |
| 60 · 로딩 스피너 6종 (3s) (`m-spinners`) | `screens-n.jsx:6` | 3s | 로딩 상태 전반 | 6종 로딩 스피너 제공 | CSS animation 제거한 spinner icon | TODO |
| 61 · 인풋 포커스/검증 (5s) (`m-input`) | `screens-n.jsx:151` | 5s | 입력 focus/검증 | focus ring, validation, strength bar animation | 상태 변화만 표시 | TODO |
| 62 · 차트 그리기 (6s) (`m-chart`) | `screens-n.jsx:329` | 6s | 오행/운세 차트 렌더 | bar/ring/path가 draw-in | 완성 차트 즉시 표시 | TODO |
| 63 · 사주팔자 셔플 (6s) (`m-palshja`) | `screens-n.jsx:485` | 6s | 팔자 계산/셔플 | 8글자 슬롯이 shuffle 후 확정 | 최종 팔자 즉시 표시 | TODO |

## 구현 원칙

- `Stage`와 playback bar는 prototype용이므로 production에 복사하지 않는다.
- 실제 사용 화면에서 필요한 trigger 기반 component로 변환한다.
- `useReducedMotion()` 또는 CSS `@media (prefers-reduced-motion: reduce)`를 사용한다.
- Next.js SSR에서 `window` 접근을 직접 하지 않는다.
- motion QA route를 만들어 13개를 한 화면에서 검수한다.
