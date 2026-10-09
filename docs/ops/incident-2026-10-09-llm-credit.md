# 간지사주 운영 점검 — 2026-10-09 (OpenAI 크레딧 소진 장애 + 추가 결함)

점검 근거: Vercel 런타임 에러(7일)·로그(12시간, Pro 보관 1일), 프로덕션 배포 ad870b9, 저장소 코드.
Supabase(간지사주 DB)는 이 세션에서 접근 불가 → 영향 범위 SQL은 아래에서 직접 실행 필요.

## 1. LLM 장애 (해소됨)
- 원인: OpenAI `429 You have no credits remaining` = **선불 크레딧 잔액 소진** (월 지출한도 초과가 아님).
- 구간: 시작 10/9 06:20~07:20 KST 사이(경보 크론 기준) → 복구 16:28 KST (첫 성공 llm_run). 약 9~10시간.
- 경보: llm-quota-check 크론이 07:20 KST에 critical 메일 발송(수신자 2명) → 대응까지 약 9시간.
- 장애 중 동작: 총평·챕터·평생·연간 전부 결정론 폴백 문구 노출.
- 재발 이력: 8/1~8/10(호출 0), 8/10(chat-latest 404), 8/31(한도 소진), 10/9(크레딧 소진).

## 2. 추가 발견 결함
| 우선순위 | 문제 | 영향 | 조치 |
|---|---|---|---|
| P0 | `/api/notifications/dispatch` 가 'use client' 모듈의 getHonorificLabel 을 서버에서 호출 → 첫 수신자에서 크론 전체 중단 | 2026-07-12 이후 웹푸시·알림 이메일·구독 만료 안내·컴백 리마인더 **0건 발송** (하루 6회 크론 전부 실패) | 패치 `2026-10-09-notifications-honorific.patch`(PR 로 반영, 패치 파일은 미커밋) (lib/honorific.ts 분리 + 회귀 스펙). 테스트 1856+196+290 통과 |
| P1 | 신년운세(full)는 폴백도 캐시에 고정(keepFallback, 9/27 결정) | 장애 중 생성된 유료 신년운세는 복구 후에도 템플릿 글 그대로 | 아래 SQL로 대상 확인 → 해당 캐시 행 재생성. 정책 보완: quota_exceeded·ai_not_configured 는 고정 제외 |
| P1 | LLM 장애 중에도 결제 계속 접수 | 돈 받고 폴백 납품 → 환불·CS 리스크 | 경보 activeNow=critical 시 LLM 상품 결제 일시 보류/안내 배너(서킷 브레이커) |
| P2 | funnel-log insert `fetch failed` 3건/7일 | 퍼널 이벤트 소량 유실(일시적 네트워크) | 관찰만 |
| P2 | 나이스페이 승인 실패 1건(탈회카드) | 고객 측 사유, #922 로 안내 문구 개선됨 | 조치 불필요 |
| P3 | GitHub 저장소 **public** | 프롬프트·비즈니스 로직·관리자 라우트 구조 노출. HEAD 기준 키 패턴 미검출(히스토리 미검사) | private 전환 검토 |
| P3 | package-lock 불일치(typescript@4.9.5 누락) | `npm ci` 실패 → CI 재현성 위험. Vercel 빌드는 정상 | `npm install` 후 lock 커밋 |

## 3. 영향 범위 확인 SQL (Supabase SQL Editor)
```sql
-- (1) 정확한 장애 구간과 기능별 실패 건수
select feature, count(*) fails, min(created_at) first_fail, max(created_at) last_fail
from ai_llm_runs
where source='fallback' and fallback_reason='quota_exceeded'
  and created_at > now() - interval '3 days'
group by feature order by fails desc;

-- (2) 장애 구간 결제 확정 주문 (구간은 (1) 결과로 교체)
select order_id, user_id, package_id, product, amount, status, confirmed_at
from payment_orders
where confirmed_at between '2026-10-08 21:00+00' and '2026-10-09 07:30+00'
  and status in ('confirmed','fulfilling','fulfilled')
order by confirmed_at;

-- (3) 폴백으로 고정됐을 수 있는 신년운세/연간 캐시
--     newYear 부가 단계 폴백은 source='openai' 행에도 섞일 수 있어 시각 기준으로 본다
select id, reading_id, target_year, counselor_id, source, fallback_reason, updated_at
from ai_yearly_interpretations
where updated_at between '2026-10-08 21:00+00' and '2026-10-09 07:30+00'
order by updated_at;
```
(3)의 행은 삭제 또는 regenerate 호출로 재생성. PDF를 이미 받은 고객은 재발송 안내 필요.

## 4. 재발 방지
1. OpenAI 결제 설정에서 자동 충전(auto recharge) 켜기 + 충전 임계값 설정 [확인필요: 계정 플랜에서 지원 여부]
2. critical 경보를 이메일 외 카카오 알림톡/SMS(SOLAPI 기존 연동)로도 발송
3. 2차 LLM 벤더 폴백(구현 난이도 중, openai-text.ts 단일 진입점이라 교체 지점 1곳)
4. 결제 서킷 브레이커(위 P1)
