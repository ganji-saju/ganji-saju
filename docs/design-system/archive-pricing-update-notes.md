# 보관함 / 가격 페이지 적용 노트

## Summary

보관함, 가격, 멤버십, 코인 충전, 결제 관리 화면을 달빛 결 디자인 시스템의 `PageIntro`, `LightSection`, row 중심 UI로 정리했다. 상품 코드, 가격 config, Toss 결제 요청, entitlement, 보관함 조회 로직은 변경하지 않았다.

## Updated Pages

- `/my`: 보관함 요약과 최근 리포트 목록을 `ReportList`로 정리했다.
- `/vault`: 기존 alias route를 `/my#recent-reports`로 연결했다.
- `/pricing`: 대표 멤버십 가격 표시를 결제 catalog에서 읽어오도록 정리했다.
- `/membership`: 무료 시작, 990원 깊이보기, 대화 멤버십 흐름이 드러나도록 intro copy를 정리했다.
- `/credits`: 코인 결제 UI를 카드 grid에서 row 중심으로 정리했다.
- `/my/billing`: 결제/코인 이용 이력을 LightSection과 compact list로 정리했다.

## Archive UI

- `src/components/moonlight/ReportList.tsx`를 추가했다.
- `ReportBadge`는 `사주`, `성향사주`, `궁합`, `성향궁합`, `오늘운세`, `대화`를 구분한다.
- 목록 설명에는 생년월일시, 성별, 이름을 직접 노출하지 않는다.
- 재열람 CTA는 `재열람`으로 통일했다.

## Pricing / Membership UI

- `/pricing`은 `무료 → 990원 깊이보기 → 멤버십` 흐름을 유지한다.
- 대표 멤버십 가격은 `getMembershipPackage('premium')`와 `formatPaymentPackagePrice`를 통해 기존 catalog 값을 사용한다.
- `/membership`은 기존 `PLAN_BLUEPRINT`, `TASTE_PRODUCTS`, `getMembershipPackage` 기반 표시 구조를 유지한다.

## Credits UI

- `/credits`는 기존 `PACKAGES`, `buildTossOrderId`, `loadTossPayments`, `requestPayment`, success/fail URL, analytics payload를 유지한다.
- 코인 상품 선택은 row 버튼으로 변경했다.
- 결제 오류와 취소 안내는 `CreditNotice`로 compact하게 표시한다.
- `TossPaymentMethodPicker`는 유지했다.

## Logic Boundaries

- Product code changed: no
- Price logic changed: no
- Payment function changed: no
- Entitlement logic changed: no
- Report query logic changed: no
- DB or migration changed: no

## Privacy Review

- `/my` 목록은 저장 개수, 배지, 리포트 제목/요약, 생성일 기반 설명만 표시한다.
- 저장된 사주 항목 설명은 생년월일시 대신 저장일과 개인정보 비노출 안내를 표시한다.
- `/my/billing`은 결제 상세 정보 대신 이용 항목과 코인 증감만 표시한다.

## Manual QA Checklist

- `/my` 진입 정상
- `/vault` 진입 시 보관함 섹션으로 이동
- 구매 리포트 재열람 CTA 정상
- `/pricing` 진입 정상
- `/membership` 진입 정상
- `/credits` 진입 정상
- 코인 결제 CTA가 기존 Toss flow를 호출
- `/my/billing` 진입 정상
- 모바일 360/390/430px에서 row가 가로 스크롤 없이 표시

## Remaining Risks

- 실제 로그인 계정의 구매 리포트와 코인 거래 데이터는 production/staging 계정으로 재확인이 필요하다.
- `/credits` 실제 결제창 호출은 Toss sandbox/live 환경에서 별도 QA가 필요하다.
- 실기기 모바일 360/390/430px 스크롤과 터치 QA는 작업 13 최종 QA에서 다시 확인한다.
