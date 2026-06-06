# 궁합 LLM 경로 점검 + fallback 관측성 설계

- 날짜: 2026-06-06
- 상태: 점검 결과 + 조치 설계 확정
- 상위: 로드맵 영역1 #3(검증 실패→fallback 계측), D1(프로덕션 LLM ON)

## 1. 점검 결과 (현 상태)

궁합 §8 깊은 풀이 LLM 경로(`generate-compatibility-interpretation.ts`):
플래그 확인 → 캐시 read-through → OpenAI 생성(재시도) → 파싱·검증 → 통과시 캐시·`llm`, 아니면 결정론 `fallback`.

관측 현황:
- **OpenAI 호출 자체**: `generateAiText` 중앙 계측(`ai_llm_runs`, feature `compatibility`, source `openai`/`fallback`).
- **캐시 히트**: `recordLlmRun(source:'cache')` 계측됨.
- **사각지대**: OpenAI 호출은 성공했으나 **출력이 파싱/검증 실패**(한자·명리어·길이·'결' 과다)해 결정론 fallback으로 떨어지는 **최종 fallback 경로는 무계측**.

## 2. 문제 (왜 위험한가)

프롬프트/스키마 드리프트로 검증이 지속 실패하면:
- 텔레메트리엔 `openai` 호출이 정상으로 찍혀 **LLM이 서빙되는 듯 보임**.
- 실제 결제자는 **조용히 결정론 fallback**을 받음(무료 §4~6 대비 차별은 #409로 개선됐으나, 약속한 "두 분 맞춤 LLM 풀이"는 아님).
- OpenAI 비용(재시도 최대 3회)만 소모, LLM 가치 0.

⚠️ 검증필요: 프로덕션 Vercel env `OPENAI_INTERPRET_COMPATIBILITY=1` 실제값은 Sensitive(코드 확인 불가) — 콘솔 확인 별도 필요.

## 3. 조치 (관측성 추가)

`generateCompatibilityInterpretation`:
- args에 `userId?: string | null`, `recordRun?: typeof recordLlmRun`(기본 `recordLlmRun`) 추가(기존 DI 패턴: env/client/cacheStore).
- **최종 검증-실패 fallback 직전** 계측:
  `recordRun({ feature:'compatibility', source:'fallback', model:null, userId, fallbackReason })`
  - `fallbackReason = lastReasons.join(' | ').slice(0, 500) || 'unknown'`
- 캐시-히트 계측도 `recordRun`·`userId` 사용(귀속 일관).
- `route.ts`: `generateCompatibilityInterpretation`에 `userId: user.id` 전달.

비목표: 'llm' 성공 outcome 별도 기록(이미 `generateAiText`가 openai 호출을 기록 → 이중계측 회피). 'llm_disabled' 조기 반환 기록(설정값이지 실패 아님).

## 4. 영향 파일
| 파일 | 변경 |
|---|---|
| `src/server/ai/compatibility/generate-compatibility-interpretation.ts` | args userId/recordRun, 최종 fallback 계측, 캐시 계측 recordRun화 |
| `src/app/api/interpret/compatibility/route.ts` | userId 전달 |
| `src/server/ai/compatibility/compatibility-interpretation.test.ts` | recordRun 스파이로 fallback 계측 단언 |

## 5. 테스트
- 깨진 응답→fallback 시 `recordRun`이 `source:'fallback'` + 비어있지 않은 `fallbackReason`으로 1회 호출됨.
- 플래그 OFF fallback은 계측 호출 없음(설정값) — 기존 동작 불변 확인.
- 기존 5개 테스트 전부 통과(behavior 불변, 추가 인자 옵셔널).

## 6. 의료광고법
관측 코드만. 콘텐츠 변경 없음. 비대상.
