codex
검토 대상은 `d0f1b653..899776df`입니다. 파일과 diff만 읽었으며 파일 수정·DB 접근·네트워크·테스트 실행은 하지 않았습니다. 아래에서 **기존 지적의 잔존 문제**와 **반영으로 새로 생긴 결함**을 구분합니다.

1. **나이스페이 승인 후 복구 — 부분 해결**
   
   운영 경보와 관리자 `confirm_card`가 추가됐습니다. 그러나 승인 후 `attachPaymentKeyToOrder`가 실패하면 결제 키가 없어 수동 확인도 거절됩니다. `markPaymentOrderConfirmed`까지의 실패는 새 경보가 있는 fulfillment 내부에 도달하지 않습니다. 반대로 주문을 `paid`로 바꾼 뒤 결제 원장 확정이 실패하면 수동 확인은 `pending_payment`만 허용하므로 사용할 수 없습니다.  
   근거: [return/route.ts:309](/Users/kionya/ganji-saju/src/app/api/payments/nicepay/return/route.ts:309), [fulfillment.ts:191](/Users/kionya/ganji-saju/src/lib/payments/fulfillment.ts:191), [관리 API:113](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:113).
   
   **신규 결함 [중요]:** 수동 확인은 fulfillment 반환 후 실제 주문 상태를 확인하지 않고 `paid` 성공을 반환합니다. 결제 원장이 `fulfilling`이면 fulfillment는 작업 없이 성공 반환하므로, 중단된 지급 작업을 복구하지 못한 채 관리자에게 완료로 표시할 수 있습니다.  
   근거: [fulfillment.ts:161](/Users/kionya/ganji-saju/src/lib/payments/fulfillment.ts:161), [관리 API:122](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:122).
   
   **범위 밖 판정에 반대합니다.** 전 상품 정산 개선을 별도 PR로 분리할 수는 있지만, 이번 주문의 수동 복구가 위 실패들을 포괄하지 않아 출시 조건을 충족하지 못합니다. 토스 조회 실패로 나이스 주문을 만료 처리하는 경로도 그대로입니다([reconcile/route.ts:26](/Users/kionya/ganji-saju/src/app/api/payments/reconcile/route.ts:26)).

2. **결과 토큰 분석 시스템 유출 — 부분 해결**
   
   GA 명시적 페이지뷰와 자체 방문 경로는 `/r/redacted`로 정제되고 결과 페이지에 `no-referrer`가 추가됐습니다. 하지만 공통 레이아웃의 Vercel Analytics·SpeedInsights에는 제외·정제 처리가 없습니다.  
   근거: [ga-sanitize.ts:25](/Users/kionya/ganji-saju/src/components/analytics/ga-sanitize.ts:25), [결과 페이지:17](/Users/kionya/ganji-saju/src/app/r/[token]/page.tsx:17), [layout.tsx:300](/Users/kionya/ganji-saju/src/app/layout.tsx:300).
   
   **신규 결함:** 확인하지 못했습니다.
   
   **Vercel 수집 유지 판정에 반대합니다.** 대시보드를 소유자만 본다는 점은 외부 분석 시스템에 열람 자격증명이 전달되는 문제를 해소하지 않습니다. 기존 사주 URL과 같다는 설명도 이 토큰의 수집을 정당화하지 못합니다.

3. **카드 결제 대기 주문 취소 — 해결됨**
   
   카드 주문의 `cancel`을 서버에서 거절하고 버튼도 제거했습니다. 결제 후 갱신이 0행이면 현재 주문 상태를 확인하고 비정상 상태를 경보로 알립니다. 최초 지적의 관리자 취소 경로는 차단됐습니다.  
   근거: [관리 API:130](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:130), [report-order-actions.tsx:24](/Users/kionya/ganji-saju/src/app/admin/report-orders/report-order-actions.tsx:24), [report-order-store.ts:134](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:134).
   
   **신규 결함:** 확인하지 못했습니다. 다만 기존에 취소·누락된 주문의 자동 복구까지 해결된 것은 아닙니다.

4. **발송 경합·열리지 않는 링크 — 부분 해결**
   
   최초 발송은 먼저 `sent`로 전환하므로 중복 최초 발송과 발송 직후의 상태 지연은 개선됐습니다. 그러나 재발송은 선점 없이 실행되고, 발송과 환불 사이의 조정도 없습니다. 발송 선점 후 환불이 완료되면 닫힌 링크의 문자가 나갈 수 있습니다.  
   근거: [관리 API:96](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:96), [관리 API:103](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:103).
   
   **신규 결함 [중요]:** 문자·이메일이 모두 실패해도 주문은 `sent`입니다. API는 “다시 보내기”를 안내하지만 화면은 오류 응답에서 새로고침하지 않아 그 버튼이 나타나지 않습니다. 기존 발송 버튼을 다시 누르면 409가 됩니다. 관리자가 직접 새로고침하기 전에는 안내된 복구 흐름을 사용할 수 없습니다.  
   근거: [관리 API:96](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:96), [report-order-actions.tsx:53](/Users/kionya/ganji-saju/src/app/admin/report-orders/report-order-actions.tsx:53).

5. **생성 잠금·검토한 풀이 버전 보장 — 부분 해결**
   
   요청에 `reportId`를 넣고 비교하는 것은 개선입니다. 하지만 비교 대상은 요청 초기에 읽은 주문이며, 실제 UPDATE 조건에는 결과 ID가 없습니다. 비교 직후 다른 생성이 결과를 교체하면 검토하지 않은 결과를 발송할 수 있습니다.  
   근거: [관리 API:44](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:44), [관리 API:92](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:92), [report-order-store.ts:118](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:118).
   
   **신규 결함:** 별도로 확정하지 못했습니다. 위 경합은 기존 결함이 남은 것입니다.
   
   **“다른 인스턴스는 저장 실패·409, AI 비용만 남음” 판정에 반대합니다.** `generated → generated`가 허용되고 갱신 조건은 상태뿐입니다. 두 생성이 모두 성공해 뒤 결과가 앞 결과를 덮어쓸 수 있습니다. 두 요청이 같은 이전 원본을 읽었다면 앞 요청의 새 원본도 고아로 남습니다.  
   근거: [report-order.ts:57](/Users/kionya/ganji-saju/src/lib/report-orders/report-order.ts:57), [관리 API:70](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:70).

6. **개인정보 삭제 실패 재시도·고아 원본 — 부분 해결**
   
   크론이 원본 삭제를 먼저 수행하므로 그 삭제가 실패했을 때 재시도할 수 있게 됐습니다. 그러나 재생성·저장 실패 정리에서는 삭제 오류를 삼키며 삭제 대상을 기록하지 않습니다. 이 경로의 개인정보 원본은 여전히 영구 잔존할 수 있습니다.  
   근거: [report-order-store.ts:213](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:213), [관리 API:73](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:73), [관리 API:78](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:78).
   
   **신규 결함 [중요]:** 삭제 대상을 활성 `generated` 주문까지 넓혔지만, 마지막 개인정보 삭제 UPDATE는 처음 조회한 ID만 조건으로 사용합니다. 크론 조회 후 관리자가 새 결과를 저장·발송하면 크론이 새 연결과 토큰을 지워 방금 발송한 링크를 깨뜨릴 수 있습니다. 새 원본은 최초 삭제 목록에 없으므로 고아로 남습니다.  
   근거: [report-order-store.ts:202](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:202), [report-order-store.ts:220](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:220).
   
   따라서 **고아 원본·삭제 견고성 완료 판정에는 반대합니다.**

7. **1년 보관·열람 제한 — 부분 해결**
   
   미입금·미발송 상태가 삭제 대상에 포함됐고, 결과 페이지는 최초 발송일로 만료를 검사합니다. 재발송도 발송일을 변경하지 않습니다. 정상적인 순차 처리에서는 핵심 요구가 반영됐습니다. 다만 6번의 삭제 경합 때문에 보관 처리가 완결됐다고 보기는 어렵습니다.  
   근거: [report-order-store.ts:205](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:205), [결과 페이지:26](/Users/kionya/ganji-saju/src/app/r/[token]/page.tsx:26), [report-order.ts:81](/Users/kionya/ganji-saju/src/lib/report-orders/report-order.ts:81).
   
   **신규 결함 [경미]:** 만료된 `sent` 주문도 크론 삭제 전에는 재발송할 수 있습니다. 손님에게 “링크는 1년간 열 수 있어요”라는 안내를 보내지만 링크는 즉시 404입니다. 재발송에도 동일한 만료 검사가 필요합니다.  
   근거: [관리 API:104](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:104), [notify.ts:42](/Users/kionya/ganji-saju/src/lib/report-orders/notify.ts:42).

8. **음력 윤달 입력 — 해결됨**
   
   윤달 체크값을 서버로 전달하고 음수 월을 사용하는 음력 변환으로 양력 생일을 만든 뒤 기존 생성기 입력으로 저장합니다. 변환 실패도 주문 오류로 반환합니다.  
   근거: [order-form.tsx:106](/Users/kionya/ganji-saju/src/app/saju-report/order-form.tsx:106), [order-form.tsx:196](/Users/kionya/ganji-saju/src/app/saju-report/order-form.tsx:196), [parse-report-order.ts:48](/Users/kionya/ganji-saju/src/lib/report-orders/parse-report-order.ts:48).
   
   **신규 결함:** 확인하지 못했습니다. 실제 일주·시주 정확성은 실행 검증하지 않았습니다. 비교 테스트 유예는 이 입력 연결의 해결 여부와 별개로 볼 수 있습니다.

9. **GA 구매·환불 귀속 — 부분 해결**
   
   쿠키 식별자와 브라우저의 동의값이 결제 원장으로 전달되므로 기존 구매·환불 디스패처에 필요한 연결은 추가됐습니다.  
   근거: [주문 API:67](/Users/kionya/ganji-saju/src/app/api/report-orders/route.ts:67), [order-ledger.ts:262](/Users/kionya/ganji-saju/src/lib/payments/order-ledger.ts:262), [order-ledger.ts:581](/Users/kionya/ganji-saju/src/lib/payments/order-ledger.ts:581).
   
   **신규 결함 [중요]:** 동의가 없으면 `null`을 저장하지만 서버 전송기는 명시적 `denied`만 차단합니다. GA 쿠키는 남아 있고 동의 저장값이 없어진 경우, 미동의 상태에서도 식별자와 구매 정보가 전송될 수 있습니다. 이번 변경으로 랜딩 주문에도 이 경로가 연결됐습니다.  
   근거: [analytics-consent.ts:38](/Users/kionya/ganji-saju/src/components/analytics/analytics-consent.ts:38), [주문 API:69](/Users/kionya/ganji-saju/src/app/api/report-orders/route.ts:69), [ga-server.ts:85](/Users/kionya/ganji-saju/src/lib/analytics/ga-server.ts:85).
   
   **동의 처리까지 완료됐다는 판정에는 반대합니다.** 이 경로는 명시적 `granted`일 때만 식별자 기반 전송을 허용해야 합니다.

10. **이메일 없는 손님의 주문 — 미해결**
    
    서버의 이메일 필수 검증은 그대로입니다.  
    근거: [parse-report-order.ts:36](/Users/kionya/ganji-saju/src/lib/report-orders/parse-report-order.ts:36).
    
    **신규 결함:** 이메일 항목에서는 확인하지 못했습니다.
    
    **제품 결정으로 유예한다는 판정에는 동의합니다.** 원래 설계가 필수였으므로 이번 수정의 필수 차단 사유로 삼지는 않겠습니다. 다만 해결된 항목은 아닙니다.

추가 반영 중 **[경미] 이름 검증 강화로 정상 주문이 차단되는 회귀**가 있습니다. `O'Neil`, `Anne-Marie`, 한자 이름 등은 새 정규식에 걸립니다. 문자 악용 방지 취지는 타당하지만 정상 이름까지 금지할 필요는 없습니다. 근거: [parse-report-order.ts:33](/Users/kionya/ganji-saju/src/lib/report-orders/parse-report-order.ts:33).

라우트 테스트 대신 URL 헬퍼 테스트만으로 충분하다는 판정에는 동의하지 않습니다. 헬퍼는 1번의 실패 위치별 경보·복구·리다이렉트 동작을 검증하지 않습니다. 나이스 일부 취소 등 이번 diff가 바꾸지 않은 기존 문제는 신규 결함으로 재분류하지 않았습니다.

보류
