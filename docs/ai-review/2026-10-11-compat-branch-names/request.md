# 요청 — 궁합 풀이 본문에 "해와 사의 충" 같은 지지 이름이 남는 문제

- 사용자 목표: 궁합 깊은 풀이 본문에서 지지 이름(자·축·…·해)으로 쓴 관계 표현을 없앤다. 자리의 뜻으로 설명.
- 원인(Claude 진단): pairSignals 는 자리 뜻으로만 쓰지만, natalEvidence(두 사람 원국 JSON)에 기둥 branch·ganzi 가 그대로 들어가 AI 가 "충" 근거를 보고 글자를 찾아 씀.
- 후보 A(Claude, 브랜치 `fix/compat-no-branch-names`, 기준 main `29c7311f`): ① 궁합 입력에서 branch·ganzi 제거(compatNatalEvidence) ② 검증기에 지지 이름 관계 패턴 ③ 재시도에 탈락 사유 주입 ④ 프롬프트 지시 보강 + 버전 v5(커플별 재생성 1회).
- 검증: tsc, npm test(새 테스트 2건), 실제 AI 2쌍(충 2개 쌍 포함) 지지 이름 0·첫 시도 통과.
