# Future: 고객센터 (Help Center) · 보드 `help-center`

> source: `untitled/project/screens-k.jsx:840` (ScreenHelpCenter)
> 현재 상태: SHELL — `/help` 라우트가 design shell 만 노출.

## 1. 목표
- FAQ + 1:1 문의 통합 진입점.
- 결제·계정·풀이 3 카테고리 + 검색.
- 1:1 문의는 카카오/이메일 외부 채널로 위임 (실 서버 mutation X).

## 2. 진입점
- 햄버거 메뉴 안내 섹션 → "이용 가이드 / 고객센터"
- footer 의 "☎ 010-8123-9184" 다음 옵션
- `/my/settings` 의 도움말 카드 (TODO)

## 3. API contract (실 구현 시)

```
GET /api/help/faq?category={billing|account|reading}
→ { items: Array<{ q: string; a: string; tags: string[] }> }

POST /api/help/ticket
body: { category, subject, body, contactEmail }
→ { ticketId, status: 'received', estimatedReplyHours: 48 }
```

## 4. 데이터 모델
- `help_tickets` 테이블 (id, user_id, category, subject, body, status, created_at)
- `help_faq` 테이블 (id, category, q, a, sort_order, published)
- 초기에는 정적 `src/content/help-faq.ts` 로 시작 가능.

## 5. 권한/인증
- 비로그인: FAQ 만 조회 가능, 1:1 문의는 로그인 유도.
- 로그인: 본인 ticket history 조회 (RLS auth.uid()).

## 6. 분석 이벤트
- `help_faq_search` { query, results }
- `help_faq_clicked` { faq_id }
- `help_ticket_submitted` { category }

## 7. 에러 처리
- API 실패 시 토스트 + 카카오 외부 채널 안내.

## 8. 접근성
- FAQ accordion `<details>` 사용 (키보드 토글 자연 지원).
- 검색 input aria-label.

## 9. 디자인 참조
- `screens-k.jsx:840` ScreenHelpCenter (FAQ accordion + 카테고리 chips + CTA).

## 10. 추정 작업량
**M** (FAQ 정적 + 1:1 외부 위임 시 2-3일 / 실 ticket 시스템 포함 시 1주).
