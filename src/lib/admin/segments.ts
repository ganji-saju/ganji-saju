// 가입자 세그먼트 단일 정의(SSOT). query 는 /admin/users?<query> 프리셋이자
// parseListParams 로 카운트 필터를 만드는 소스. (M2)
export interface SegmentDef {
  key: string;
  label: string;
  description: string;
  query: string;
}

export const SEGMENTS: SegmentDef[] = [
  { key: 'new7',        label: '신규 7일',     description: '최근 7일 내 가입',           query: 'signupWithinDays=7&sort=signup' },
  { key: 'new30',       label: '신규 30일',    description: '최근 30일 내 가입',          query: 'signupWithinDays=30&sort=signup' },
  { key: 'high_value',  label: '고지출',       description: '누적 결제 5만원 이상',       query: 'minLtv=50000&sort=ltv' },
  { key: 'refundable',  label: '환불대상',     description: '환불 가능액 보유',           query: 'refundable=yes&sort=ltv' },
  { key: 'subscribed',  label: '구독중',       description: '구독 활성',                  query: 'subscription=active&sort=last_active' },
  { key: 'at_risk',     label: '이탈위험',     description: '30일+ 비활동 & 결제 이력',   query: 'status=dormant&paid=yes&sort=last_active' },
  { key: 'no_purchase', label: '첫결제 미완',  description: '활성인데 결제 0건',          query: 'status=active&paid=no&sort=signup' },
  { key: 'no_reading',  label: '첫사주 미완',  description: '활성인데 사주 조회 0',       query: 'status=active&firstReading=none&sort=signup' },
];
