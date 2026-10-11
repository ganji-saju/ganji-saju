수정 권고입니다. 원인 진단은 일부 맞지만, 더 직접적인 유입 경로가 남습니다. 아래 AI 파일명은 `src/server/ai/compatibility/` 기준입니다.

- **높음 — 기존 문장으로 재유입.** `src/lib/compatibility.ts:444,676,1189`에서 “해와 사는 충…”을 만들어 cautionSummary·axes·evidence로 전달합니다. `compatibility-interpretation-content.ts:59` 이후가 이를 그대로 보냅니다. branch·ganzi만 제거해서는 해결되지 않습니다. 반면 fallbackSections는 프롬프트에 들어가지 않고, 복사되는 body에는 별도 evidence도 포함되지 않습니다.

- **중간 — 간접 복원·대운 경로 잔존.** `compatibility-interpretation-content.ts:25`는 hiddenStems·twelveStage·dayMaster를 유지합니다. `src/domain/saju/engine/saju-data-v1.ts:846`의 계산상 일간과 12운성으로 지지를 역산할 수 있고, 지장간도 추론 단서입니다. `src/lib/compatibility/pair-signals.ts:106`은 대운 간지를 직접 전송합니다. 따라서 “pairSignals는 자리 뜻만 전달한다”는 전제도 부정확합니다.

- **중간 — 정규식 오탐·미탐.** `compatibility-interpretation-validator.ts:22`는 경계가 없어 일상어 “인사충원”의 “인사충”을 잡습니다. 반대로 실제 입력인 “해와 사는 충”, “사·해 충”, “자묘형”, “자축합”은 놓칩니다. 정상 본문 폐기와 금지 표현 통과가 모두 가능합니다.

- **낮음 — 호출 오류도 수정 지시로 전송.** `generate-compatibility-interpretation.ts:121,126`은 API 오류 원문까지 다음 프롬프트에 붙입니다. 출력이 없었던 실패를 “직전 출력 탈락”으로 설명하며 불필요한 내부 오류 문구를 모델에 전달합니다. 파싱·검증 실패 사유만 주입하는 편이 단순합니다.

- **중간 — 재생성은 ‘커플당 1호출’ 보장이 아님.** `compatibility-interpretation-cache.ts:8,30`의 버전·입력 변경으로 기존 캐시는 다음 조회부터 무효입니다. `generate-compatibility-interpretation.ts:113,139`상 요청당 최대 3회 생성하며 실패 결과는 캐시하지 않아 재열람 때 반복됩니다. TTL도 30일입니다.

더 단순한 대안은 공통 관계 문장 생성부에서 지지 이름을 자리 의미로 바꾸고, 출력 검증을 보조로 두는 것입니다. 필요한 원국 근거를 무작정 삭제할 필요는 없습니다.

정적 검토만 수행했습니다. 파일 수정·테스트·DB·네트워크 접근은 하지 않았으며, 실제 발생률과 비용은 미확인입니다.