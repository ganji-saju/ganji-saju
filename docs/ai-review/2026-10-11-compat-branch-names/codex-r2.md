Claude 판정별 평가입니다. 경로는 `src/` 기준입니다.

- **결정론 문장: 미흡.** 지지 이름 유입 차단은 수용. 다만 `lib/compatibility.ts:427,485`의 “자리는 … 관계입니다”는 주어·서술어가 맞지 않습니다. 457·466행의 “파 관계·해 관계”도 뜻풀이 없이 남아, `features/compatibility/compatibility-result-view.tsx:308`에서 사용자에게 직접 노출됩니다.
- **역산·대운 유지: 수용.** 목표가 관계 표현 제거라면 원국 근거를 더 삭제할 필요는 없습니다. 다만 지지 정보의 완전 차단은 아닙니다.
- **정규식: 미흡.** `server/ai/compatibility/compatibility-interpretation-validator.ts:22–24`는 새로 “자유형 수영”을 지지 관계로 오탐합니다. 반대로 “자축 합”, “사해충” 뒤 닫는 따옴표, “사해충보다는”은 놓칩니다. 한 글자 조사 허용은 실제 단어 경계 검증이 아닙니다.
- **호출 오류 분리: 수용.** `server/ai/compatibility/generate-compatibility-interpretation.ts:123–135`에서 오류 원문의 프롬프트 유입을 막았습니다.
- **재생성 비용: 미흡.** 캐시 실측은 현재 대상 규모만 설명하며, 최대 3회·실패 후 재열람 재호출 문제를 해소하지 않습니다.

정적 검토만 했습니다. 수정·DB·네트워크·테스트는 수행하지 않았고, Claude의 실측 결과는 재확인하지 않았습니다.