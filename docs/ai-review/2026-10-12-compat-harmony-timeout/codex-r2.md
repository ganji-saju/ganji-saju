- **P1 조정: 미흡.** `src/server/ai/compatibility/generate-compatibility-interpretation.ts:76,131`의 계측·첫 시도 검사는 개선됐지만, 인증·저장·계측을 20초 안에 끝낸다는 보장이 없어 180초 종료는 여전히 미보장입니다.
- **P2: 수용.** `src/server/ai/compatibility/compatibility-interpretation-cache.ts:8`의 v6 변경으로 이전 캐시가 분리됩니다.
- **관계표 판정: 수용.** `src/lib/compatibility.ts:45,62,64,69`의 키 정정은 적절합니다.
- **SDK 무조치: 미흡.** `node_modules/openai/src/client.ts:1031`에서 헤더 수신 후 타이머가 해제됩니다. 비스트리밍도 본문 수신 완료를 보장하지 않습니다.

새로 생긴 문제는 정적 검토에서 발견하지 못했습니다.
수정·DB·네트워크·테스트 실행은 생략했으며, 시간 초과 위험은 남습니다.