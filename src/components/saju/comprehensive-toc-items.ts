// 2026-08-24 Phase 1 — 종합사주 리포트 17항목 목차 데이터.
//   컴포넌트(.tsx)와 node 단위테스트(.ts, tsx 임포트 불가)가 공유하므로 .ts 로 분리.
//   ⚠️ 정직성 계약: 전 항목이 실존 화면·콘텐츠에 1:1 매핑(comprehensive-toc.tsx 머리 주석 참조).

/** 무료 항목(이미 본 것) — 결과 챕터와 1:1. */
export const COMPREHENSIVE_FREE_ITEMS: ReadonlyArray<{ title: string; desc: string }> = [
  { title: '사주 명식 — 네 기둥', desc: '타고난 여덟 글자' },
  { title: '타고난 성향의 뿌리', desc: '일주가 말하는 나' },
  { title: '오행 기운 분포', desc: '다섯 기운의 배치' },
  { title: '대운 흐름 개요', desc: '10년 단위 큰 지도' },
] as const;

/** 잠긴 항목 — 종합 리포트 구성 상품의 실제 전달물과 1:1. */
export const COMPREHENSIVE_LOCKED_ITEMS: ReadonlyArray<{ title: string; desc: string }> = [
  // score-total (종합점수 + F1~F5 — score-breakdown-card.tsx 의 실명)
  { title: '사주 종합점수', desc: '100점 만점, 내 사주의 자리' },
  { title: '일주 본질', desc: '타고난 성향의 안정도' },
  { title: '격국 작동도', desc: '사회적 역할의 명확성' },
  { title: '용신·기신 균형', desc: '보강 흐름의 작동' },
  { title: '오행 균형 풀이', desc: '다섯 기운의 균형 점수' },
  { title: '합충·신살', desc: '관계와 작용의 부드러움' },
  // today-detail (today-fortune-detail-client.tsx 의 실섹션)
  { title: '오늘의 종합 점수', desc: '오늘 하루의 기운 수치' },
  { title: '오늘의 일진 상세', desc: '내 사주와 오늘이 만나는 지점' },
  { title: '영역별 오늘 풀이', desc: '재물·연애·일·관계' },
  { title: '오늘의 행운 패키지', desc: '색·방향·시간' },
  // 단품 3종
  { title: '돈이 새는 패턴', desc: '돈이 빠져나가는 구멍' },
  { title: '일·직장 흐름', desc: '커리어의 방향' },
  { title: '올해 핵심 흐름', desc: '올해 놓치면 안 될 3가지' },
] as const;
