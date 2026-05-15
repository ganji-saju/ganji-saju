# Web Push (VAPID) 설정 및 점검 가이드

> 2026-05-16 PR #142 — 별자리 / 운세 push 알림을 운영에 사용하기 위한 키 발급·배포·검증 절차.

## 1. VAPID 키 발급

```bash
npm run generate:web-push-keys
```

출력 예시:
```
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=BL...
WEB_PUSH_PRIVATE_KEY=abcd...
WEB_PUSH_SUBJECT=mailto:notifications@example.com
```

**중요**
- 같은 도메인에서 같은 키 쌍을 계속 유지해야 함. 키 교체 시 기존 사용자 subscription 무효화.
- 운영용·스테이징용 별도로 발급 권장.

## 2. Vercel env 등록

Vercel Dashboard → Project → Settings → Environment Variables 에 3개 추가:

| 변수 | Scope | Value |
|---|---|---|
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` | Production, Preview | (위 출력값) |
| `WEB_PUSH_PRIVATE_KEY` | Production, Preview | (위 출력값) — Sensitive |
| `WEB_PUSH_SUBJECT` | Production, Preview | `mailto:owner@your-domain.com` |

추가 후 재배포 (Redeploy) 해야 env 가 build artifact 에 반영.

## 3. 점검 절차

### 3-1. 환경변수 적용 확인
```bash
curl https://간지사주.kr/api/notifications/dispatch
# {"error":"웹 푸시 VAPID 환경변수가 아직 설정되지 않았습니다."} ← 미설정
# {"error":"허용되지 않은 요청입니다."} ← 설정 OK (CRON_SECRET 가드)
```

### 3-2. 테스트 사용자 구독
1. 로그인 후 `/notifications` 진입
2. "푸시 알림 켜기" 토글 → 브라우저 권한 허용
3. Supabase Studio 에서 `push_subscriptions` 테이블에 row 1건 확인

### 3-3. 수동 dry-run
```bash
curl -X POST https://간지사주.kr/api/notifications/dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"slotKey":"today-star-sign","dryRun":true}'
```
응답에 `results: [{userId, slotKey, sent, variant}]` 가 있으면 OK. variant 가 `'A'|'B'|'C'` 중 하나여야.

### 3-4. 실제 발송
```bash
curl -X POST https://간지사주.kr/api/notifications/dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"slotKey":"today-star-sign"}'
```
브라우저로 알림 도착 → 클릭 → `/star-sign/[slug]?notif=<id>` 진입 → URL `?notif=` 제거되면 OK.

### 3-5. 클릭 ack 확인
```sql
SELECT id, slot_key, variant, status, clicked_at
FROM notification_delivery_logs
WHERE slot_key = 'today-star-sign'
ORDER BY created_at DESC
LIMIT 5;
```
`clicked_at` 가 NULL → 클릭 안 됨 / 타임스탬프 → 클릭 됨.

### 3-6. CTR 분석
```bash
curl https://간지사주.kr/api/admin/push-ctr?days=7 \
  -H "Cookie: <admin-session-cookie>"
# {ok:true, totalSent, totalClicked, rows:[{slot, variant, sent, clicked, ctr}]}
```

## 4. cron 점검

`vercel.json` 의 cron 4개 (KST 08/09/12/20) 가 자동 실행되는지 Vercel Dashboard → Crons 탭 확인.

| KST | UTC | 슬롯 |
|---|---|---|
| 08:00 | 23:00 | today-fortune |
| 09:00 | 00:00 | today-star-sign |
| 12:00 | 03:00 | today-tarot |
| 20:00 | 11:00 | today-zodiac |

## 5. 장애 시 체크리스트

- [ ] `WEB_PUSH_PRIVATE_KEY` env 가 실수로 누락되지 않았는지 (Sensitive 라 Production-only 일 가능성)
- [ ] `WEB_PUSH_SUBJECT` 가 `mailto:` 로 시작하는지
- [ ] 키 교체 후 사용자 subscription 이 410 Gone 으로 실패하는지 (Service Worker 가 새 subscription 발급)
- [ ] `push_subscriptions.is_active = true` 인 row 가 있는지
- [ ] `notification_delivery_logs.status = 'failed'` 의 `response_status` 확인 (401/403/410 등)
- [ ] Service Worker (`/push-sw.js`) 가 모든 페이지에서 등록되는지 (DevTools → Application → Service Workers)

## 6. 키 교체가 필요한 경우

- 보안 사고 (private key 노출)
- 도메인 변경 (subject 변경)

**절차**
1. 새 키 발급
2. Vercel env 교체 + redeploy
3. 사용자에게 "알림 다시 켜주세요" 공지
4. `push_subscriptions` 의 기존 row 는 410 Gone 응답으로 자동 비활성화 (`markPushDeliveryResult` 가 `is_active=false` 처리)
