// 한 장짜리 랜딩 비회원 주문(설계: docs/superpowers/specs/2026-10-21-one-page-landing-design.md).
// 이 파일은 브라우저(주문서)에서도 쓴다 — 서버 모듈을 불러오지 않는다. 입력 검증은 parse-report-order.ts(서버).

export type ReportProduct = 'lifetime' | 'new-year';
export type ReportPayMethod = 'card' | 'bank';
export type ReportOrderStatus =
  | 'pending_payment'
  | 'awaiting_deposit'
  | 'paid'
  | 'generated'
  | 'sent'
  | 'cancelled'
  | 'refunded';

export const REPORT_PACKAGE_BY_PRODUCT = {
  lifetime: 'report_lifetime',
  'new-year': 'report_new_year',
} as const satisfies Record<ReportProduct, string>;

export const REPORT_STATUS_LABEL: Record<ReportOrderStatus, string> = {
  pending_payment: '결제 전',
  awaiting_deposit: '입금 대기',
  paid: '결제 완료',
  generated: '풀이 생성됨',
  sent: '발송 완료',
  cancelled: '취소',
  refunded: '환불',
};

export const REPORT_PRODUCT_LABEL: Record<ReportProduct, string> = {
  lifetime: '종합사주',
  'new-year': '2027 신년운세',
};

// 두 시간 단위 시간대. 자시는 자정 전후로 날짜가 갈리므로 두 칸으로 나눈다. 각 칸은 대표 시각으로 생성기에 넘긴다(표준시).
export const HOUR_SLOTS = [
  { id: 'ja-night', label: '자시 (밤 11:30 ~ 자정)', hour: '23', minute: '45' },
  { id: 'ja-early', label: '자시 (자정 ~ 새벽 1:29)', hour: '0', minute: '45' },
  { id: 'chuk', label: '축시 (새벽 1:30 ~ 3:29)', hour: '2', minute: '30' },
  { id: 'in', label: '인시 (새벽 3:30 ~ 5:29)', hour: '4', minute: '30' },
  { id: 'myo', label: '묘시 (아침 5:30 ~ 7:29)', hour: '6', minute: '30' },
  { id: 'jin', label: '진시 (아침 7:30 ~ 9:29)', hour: '8', minute: '30' },
  { id: 'sa', label: '사시 (오전 9:30 ~ 11:29)', hour: '10', minute: '30' },
  { id: 'o', label: '오시 (낮 11:30 ~ 1:29)', hour: '12', minute: '30' },
  { id: 'mi', label: '미시 (오후 1:30 ~ 3:29)', hour: '14', minute: '30' },
  { id: 'sin', label: '신시 (오후 3:30 ~ 5:29)', hour: '16', minute: '30' },
  { id: 'yu', label: '유시 (저녁 5:30 ~ 7:29)', hour: '18', minute: '30' },
  { id: 'sul', label: '술시 (저녁 7:30 ~ 9:29)', hour: '20', minute: '30' },
  { id: 'hae', label: '해시 (밤 9:30 ~ 11:29)', hour: '22', minute: '30' },
  { id: 'unknown', label: '태어난 시간을 몰라요', hour: '', minute: '' },
] as const;

const TRANSITIONS: Record<ReportOrderStatus, readonly ReportOrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  awaiting_deposit: ['paid', 'cancelled'],
  paid: ['generated', 'refunded'],
  generated: ['generated', 'sent', 'refunded'],
  sent: ['refunded'], // 다시 보내기는 상태를 바꾸지 않는다(첫 발송 시각 = 보관 기간 기준)
  cancelled: [],
  refunded: [],
};

export function canTransition(from: ReportOrderStatus, to: ReportOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function maskName(name: string): string {
  const chars = [...name];
  if (chars.length <= 1) return name;
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/** 나이스페이 승인 뒤 이동할 화면. 랜딩 비회원 주문이 아니면 null(기존 상품별 분기를 탄다). */
export function reportOrderResultHref(pkg: { kind: string }, paymentOrderId: string): string | null {
  return pkg.kind === 'report_order' ? `/saju-report/complete?order=${encodeURIComponent(paymentOrderId)}` : null;
}

/** 결과 링크 보관 기간 — 첫 발송부터 1년(삭제 크론이 못 돌아도 화면이 직접 막는다). */
export const RESULT_LINK_DAYS = 365;
export function isResultLinkExpired(sentAt: string | null, now = Date.now()): boolean {
  return !sentAt || now - Date.parse(sentAt) > RESULT_LINK_DAYS * 86400_000;
}
