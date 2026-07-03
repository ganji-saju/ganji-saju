# 자체 방문(유입) 카운트 설계 — site_visits

> 2026-07-04. admin 지표 전수검증(#593)에서 확인된 "실방문 지표 부재" 보완.
> (trackMoonlightEvent 는 window.dataLayer 전용 — DB 저장 없음. admin 의 '활동 사용자'는
> 풀이·피드백·대화 활동자만 집계.)

## 목표/비목표
- **목표**: admin 에서 일별 순방문자(유입) 추이를 자체 데이터로 확인.
- **비목표**: GA 급 정밀 분석(세션·이탈률·UTM 리포트), 봇 완전 필터. 정밀 분석은 Vercel Analytics 병행.

## 설계
1. **식별**: 클라 localStorage 익명 `vid`(crypto.randomUUID, PII 없음). 서버가 sha256 해시 후 저장 — 원시 vid 미보관.
2. **핑**: 루트 레이아웃의 `VisitPing` 이 **KST 일 1회**(localStorage 게이트) `POST /api/visit` (sendBeacon 우선, fetch keepalive 폴백). payload: vid·현재 path·referrer.
3. **저장**: `site_visits(date_key, visitor_hash)` PK — upsert ignoreDuplicates 로 일별 순방문 자연 dedupe. user_id(로그인 시)·first_path·referrer_host 부가 기록. RLS deny-all(service 전용).
4. **집계**: RPC `site_visit_daily_counts(from,to)` group-by — 행 전송 없음(1000행 캡 무관). operations 스냅샷에 `today.visitors`/`trends.visitors`.
5. **가용성**: migration 062 미적용/RPC 미존재 시 `visitors=null` → 대시보드 '—' + 안내(전면 graceful).

## 정확도 한계(대시보드에 명시)
- 광고차단기·JS 미실행·localStorage 차단 방문 미포함 → **하한치**.
- localStorage 초기화 시 신규 방문자로 재계수(중복 상방 오차 소폭).
- 봇 중 JS 실행형은 포함될 수 있음(초기엔 무시, 문제 시 UA 필터 후속).

## 운영
- **migration 062 수동 적용**(`supabase db push`) 후부터 수집. 적용 전에도 앱·API 무해(no-op).
- 행 증가율 ≈ 일 순방문자 수(방문자당 1행/일). 1만/일 기준 연 365만 행 — date_key 인덱스로 충분, 장기 시 파티셔닝/롤업 후속.

## 환불 provider 표기(같은 PR)
- 표기: 주문 미매칭 payment_key 는 'toss' 단정 → **'unknown'(PG 미상)**. 실행 분기는 기존대로
  refund route 의 `getOrderProviderByPaymentKey`(order metadata.provider — prepare 가 기록) 사용,
  나이스페이는 `cancelNicepayPayment` 로 이미 지원됨(#473~ 확인).
