codex
**현 상태로는 배포를 보류하는 것이 좋겠습니다.** 정적 검토에서 치명 2건과 중요 결함을 확인했습니다. 파일 수정·네트워크·DB 접근·테스트 실행은 하지 않았습니다.

1. **[치명] 나이스페이 승인 후 실패를 정산 크론이 복구하지 못합니다.**  
   위치: [reconcile/route.ts:26](/Users/kionya/ganji-saju/src/app/api/payments/reconcile/route.ts:26), [toss.ts:48](/Users/kionya/ganji-saju/src/lib/payments/toss.ts:48)  
   정산은 주문의 PG와 무관하게 **토스 API만 조회**합니다. 나이스페이 승인 직후 DB 저장·fulfillment가 실패하면 손님은 돈을 냈는데 주문은 결제 대기에 남습니다. 조회 실패 시 만료된 결제 원장을 `expired`로 닫기도 합니다. 기존 결함이지만 이번 기능이 복구 경로로 의존하고 있습니다.  
   **수정:** 주문의 `metadata.provider`에 따라 나이스페이를 조회·정규화하고, 실제 결제 상태를 확인하지 못한 주문을 단순 만료 처리하지 않아야 합니다.

2. **[치명] 결과 열람 토큰이 분석 시스템으로 전송됩니다.**  
   위치: [ga-sanitize.ts:24](/Users/kionya/ganji-saju/src/components/analytics/ga-sanitize.ts:24), [visit-ping.tsx:66](/Users/kionya/ganji-saju/src/components/analytics/visit-ping.tsx:66), [ga-page-view.tsx:45](/Users/kionya/ganji-saju/src/components/analytics/ga-page-view.tsx:45)  
   정제 함수는 생년월일·`key...`만 가립니다. 따라서 `/r/<43자 토큰>`이 GA의 `page_location`과 자체 방문 기록에 그대로 들어갑니다. **토큰 자체가 열람 권한**이므로 이를 얻으면 로그인 없이 이름·출생 정보가 담긴 풀이를 볼 수 있습니다.  
   **수정:** `/r/*`를 분석 대상에서 제외하거나 토큰을 완전히 제거하십시오. 공통 레이아웃의 Vercel Analytics·SpeedInsights, referrer에도 동일한 처리가 필요합니다.

3. **[중요] 관리자가 결제 대기 주문을 취소해도 카드 승인은 진행됩니다.**  
   위치: [관리 API:86](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:86), [report-order-store.ts:134](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:134)  
   `cancel`은 `report_orders`만 바꿉니다. 이후 카드 승인에서 `pending_payment` 조건의 갱신은 0행이지만 성공으로 취급되고, 결제 원장은 `fulfilled`가 됩니다. 손님은 결제됐지만 관리자 주문은 취소 상태이고, 화면에는 환불 버튼도 없습니다.  
   **수정:** 승인·취소를 결제 원장과 함께 조정하고, `paid` 갱신 0행은 현재 상태를 확인해야 합니다. 이미 승인됐다면 환불·복구 대상으로 남겨야 합니다.

4. **[중요] 발송 전에 상태를 확보하지 않아 중복 문자와 열리지 않는 링크가 나갑니다.**  
   위치: [관리 API:78](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:78)  
   문자·이메일을 먼저 보낸 뒤 `sent`로 바꿉니다. 손님이 바로 열거나 발송 후 DB 갱신이 실패하면 404입니다. 두 요청이 동시에 실행되면 모두 발송하고, `sent → sent`도 허용되어 중복 발송이 성공합니다. 환불과 겹쳐도 환불된 주문의 안내가 나갈 수 있습니다.  
   **수정:** DB에서 발송 작업을 먼저 선점하고, 채널별 발송 기록·재시도 키를 관리하십시오. 재발송은 별도 작업으로 구분해야 합니다.

5. **[중요] 생성 잠금이 서버 인스턴스 안에서만 유효하고, 확인한 풀이 버전을 보장하지 않습니다.**  
   위치: [관리 API:59](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:59), [관리 API:67](/Users/kionya/ganji-saju/src/app/api/admin/report-orders/[id]/route.ts:67)  
   서로 다른 인스턴스에서는 같은 주문을 동시에 생성할 수 있습니다. 늦게 끝난 생성이 결과 ID를 덮어쓰며 AI 비용이 중복됩니다. 다른 탭에서 재생성한 뒤 기존 미리보기 탭에서 발송하면 **상담사가 확인하지 않은 새 풀이**가 발송됩니다.  
   **수정:** DB 생성 잠금과 결과 버전을 두고, 발송 요청에 확인한 `external_report_id`를 보내 현재 버전과 일치할 때만 허용하십시오.

6. **[중요] 개인정보 삭제가 중간에 실패하면 영구적으로 재시도되지 않습니다.**  
   위치: [report-order-store.ts:205](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:205)  
   먼저 `external_report_id`를 지우고 `purged_at`을 찍은 뒤 원본을 삭제합니다. 원본 삭제가 실패하면 다음 크론에서는 대상에서 제외되고 연결도 사라집니다. 또한 재생성 시 이전 원본이 남으므로 정상 삭제에서도 마지막 원본만 지워집니다.  
   **수정:** 삭제와 완료 표기를 트랜잭션으로 처리하거나 삭제 작업 목록을 유지하십시오. 주문에 속한 모든 생성 버전을 추적해야 합니다.

7. **[중요] 1년 보관·열람 제한이 완결되지 않았습니다.**  
   위치: [report-order-store.ts:197](/Users/kionya/ganji-saju/src/lib/report-orders/report-order-store.ts:197), [결과 페이지:23](/Users/kionya/ganji-saju/src/app/r/[token]/page.tsx:23)  
   `awaiting_deposit`, `paid`, `generated`는 삭제 대상에서 제외되어 방치된 주문의 개인정보가 계속 남습니다. 결과 화면도 날짜를 검사하지 않아 크론 실패 시 1년 뒤에도 열립니다. 재발송은 `sent_at`을 다시 찍어 보관 기간을 연장합니다.  
   **수정:** 최초 발송 기준 만료일을 고정하고 조회에서도 검사하십시오. 미입금·미발송 주문의 별도 보관 만료 기준도 필요합니다.

8. **[중요] 음력 윤달 손님은 정확한 생일로 주문할 수 없습니다.**  
   위치: [order-form.tsx:187](/Users/kionya/ganji-saju/src/app/saju-report/order-form.tsx:187), [parse-report-order.ts:46](/Users/kionya/ganji-saju/src/lib/report-orders/parse-report-order.ts:46), [unified-birth-entry.ts:71](/Users/kionya/ganji-saju/src/lib/saju/unified-birth-entry.ts:71)  
   설계·계획에는 윤달 지원이 있지만 화면·저장 입력에 윤달 구분이 없습니다. 양수 월만 변환하므로 윤달 출생자가 음력을 선택하면 평달 생일로 계산한 유료 풀이를 받습니다.  
   **수정:** 윤달 선택·유효성 검증·저장·생성기 전달까지 연결해야 합니다.

9. **[중요] 새 카드 주문의 GA 구매·환불 전송이 누락됩니다.**  
   위치: [주문 API:58](/Users/kionya/ganji-saju/src/app/api/report-orders/route.ts:58), [order-ledger.ts:262](/Users/kionya/ganji-saju/src/lib/payments/order-ledger.ts:262), [ga-server.ts:88](/Users/kionya/ganji-saju/src/lib/analytics/ga-server.ts:88)  
   새 경로는 `gaClientId`, `gaSessionId`, `analyticsConsent`를 전달하지 않습니다. 기존 디스패처는 호출돼도 실제 전송을 건너뜁니다. 매출은 발생하지만 광고 구매 전환이 빠져 광고 성과 판단이 틀어집니다.  
   **수정:** 기존 prepare와 동일하게 식별자와 실제 분석 동의를 전달하십시오. 비회원이라는 이유로 동의를 임의 부여해서는 안 됩니다.

10. **[경미] 이메일이 없는 손님은 문자 수신이 가능해도 주문할 수 없습니다.**  
    위치: [order-form.tsx:82](/Users/kionya/ganji-saju/src/app/saju-report/order-form.tsx:82), [parse-report-order.ts:36](/Users/kionya/ganji-saju/src/lib/report-orders/parse-report-order.ts:36)  
    이메일 필수는 설계대로지만, 이메일을 모르거나 사용하지 않는 고령 손님에게 명확한 구매 차단점입니다. 실제 발송은 문자 하나만 성공해도 완료로 처리합니다.  
    **수정:** 제품 결정으로 이메일을 선택 입력으로 바꾸고 문자 단독 전달을 허용하는 편이 흐름과 일치합니다.

확인된 정상 부분도 있습니다. **청구 금액은 서버 가격을 사용하며 승인 금액 대조도 유지됩니다.** 토큰은 32바이트 난수이고, 결과 조회는 `sent` 상태만 허용하며 공유 메타데이터에 이름·생년월일을 넣지 않습니다.

저장소의 `payment_orders`·`order.userId` 사용처를 검색해 대시보드·회원 결제내역·환불 집계·GA·정산을 추적했습니다. **NULL 자체 때문에 추가로 확정할 수 있는 대시보드 합계 오류나 회원 결제내역 노출은 발견하지 못했습니다.** 다만 `PaymentOrder.userId`가 여전히 `string`이고 NULL을 `''`로 바꾸는 구조는 남아 있습니다. 운영 상태와 실제 화면 동작은 요청 범위에 따라 검증하지 않았습니다.
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Blocked
codex
이번 작업은 읽기 전용 검토였으며 제가 변경한 파일은 없습니다. 테스트·네트워크·DB 접근도 실행하지 않았습니다.

따라서 명시된 파일 수정 금지와 훅의 검토 전용 예외에 따라 `PROGRESS.md` 작성이나 커밋은 하지 않습니다. 기존 변경과 다른 작업자의 파일도 포함하지 않습니다.
hook: Stop
hook: Stop
hook: Stop Completed
hook: Stop Completed
tokens used
101,840
이번 작업은 읽기 전용 검토였으며 제가 변경한 파일은 없습니다. 테스트·네트워크·DB 접근도 실행하지 않았습니다.

따라서 명시된 파일 수정 금지와 훅의 검토 전용 예외에 따라 `PROGRESS.md` 작성이나 커밋은 하지 않습니다. 기존 변경과 다른 작업자의 파일도 포함하지 않습니다.
