수정 필요 2건입니다.

- **[P1] 180초 내 종료를 보장하지 못합니다.** `src/server/ai/compatibility/generate-compatibility-interpretation.ts:128`에서 캐시 조회 이후 시간을 재며, 130행은 첫 시도를 검사하지 않습니다. 인증·권한·캐시 조회에 20초, 호출에 55초씩 3회가 걸리면 185초입니다. 마지막 캐시 저장(157행)과 호출별 계측(`src/server/ai/openai-text.ts:123`)도 기다립니다. 더 단순한 대안은 route 진입 시 마감시각 하나를 만들고, 첫 시도부터 남은 시간을 검사하며 조회·저장에도 제한을 적용하는 것입니다.
- **[P2] 정정 전 AI 풀이가 최대 30일 재사용됩니다.** `src/server/ai/compatibility/compatibility-interpretation-cache.ts:8,35`의 버전은 그대로이고 키에는 변경된 점수·관계 문장이 없습니다. 해당 커플의 화면 점수는 바뀌어도 깊은 풀이는 과거 근거로 남습니다. 이번 수정에서는 프롬프트 버전을 올리는 것이 가장 작고 충분한 해결입니다.

나머지 확인 결과:

- `src/lib/compatibility.ts:45,61`의 申子·亥卯·酉丑 반합, 丑辰 파 수정은 맞습니다. 총점은 상하한 때문에 항상 ±8은 아닙니다. 용도별 적합도(`src/lib/compatibility/couple-fit.ts:64`)와 연도 전망(`src/lib/compatibility/couple-timing.ts:176`)도 달라집니다. 공유 페이지는 재계산하므로 기존 링크도 새 결과가 됩니다(`src/app/compatibility/share/[slug]/page.tsx:60`). 이용권 키는 생년정보 기반이라 유지됩니다(`src/lib/compatibility.ts:1025`).
- SDK는 타이머에서 실제 요청을 abort하고 자동 재시도는 꺼져 있습니다. 다만 설치된 SDK는 응답 헤더 수신 후 타이머를 해제하므로 본문 수신까지의 엄격한 제한은 아닙니다(`node_modules/openai/src/client.ts:1009,1031`).
- 화면은 기본 풀이와 로딩 안내를 유지합니다. 자체 제한·요청 취소는 없습니다(`src/features/compatibility/compatibility-deep-sections.tsx:38,64,71`).
- 프롬프트의 대체 표현은 일일 톤 패턴과 충돌하지 않습니다(`src/lib/saju/total-review-validator.ts:41`).

파일 수정·DB·네트워크·테스트는 실행하지 않았습니다. 실제 배포 제한과 지연 빈도는 미확인입니다.