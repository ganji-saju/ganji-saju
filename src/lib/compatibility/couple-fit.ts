// 2026-08-27 — "이 두 사람이 **무엇에** 맞는 조합인가".
//
//   🔴 사용자 제보: "같이 뭘 해도(결혼, 사업, 동업, 관계유지) 되는지가 실질적으로 궁금한
//   내용인데 그런 설명은 하나도 없다." 기존 궁합은 총점 하나와 4축 조언뿐이라,
//   **"결혼엔 좋은데 동업은 아닌"** 같은 구분을 아예 못 했다.
//
//   총점을 새로 계산하지 않는다. 총점을 만드는 **같은 네 신호**(일간·오행·일지·균형)를
//   용도마다 다르게 가중할 뿐이다. 그래서 총점과 어긋나지 않는다.
//
//   ⚠️ 가중치는 **제품 판단**이지 명리 정설이 아니다. 근거는 아래 각 용도 주석에 남긴다.
//      바꿀 때는 근거도 같이 바꿀 것.
//   ⚠️ 정직성: "좋다/나쁘다" 로 끝내지 않고 **무엇을 지키면 되는지(condition)** 를 항상 같이 준다.
//      판단만 던지면 점집이고, 조건을 주면 풀이다.
import type { CompatibilityInterpretation } from '@/lib/compatibility';
// 합충형파해 라벨은 받침이 제각각이다('형이' vs '해가'). 하드코딩하면 비문이 나간다
//   — 실제로 첫 렌더에서 "해이 걸려 있어" 가 잡혔다.
import { josa } from '@/lib/saju/pdf-report-maps';

export type CoupleFitKey = 'marriage' | 'business' | 'money' | 'longterm';

export type CoupleFitGrade = 'strong' | 'workable' | 'careful';

export interface CoupleFitItem {
  key: CoupleFitKey;
  /** 사용자가 실제로 쓰는 말. '연애/결혼' 처럼 슬래시로 뭉치지 않는다. */
  label: string;
  score: number;
  grade: CoupleFitGrade;
  gradeLabel: string;
  /** 왜 이 판단이 나왔는지 — 명식 근거 한 줄. */
  reason: string;
  /** 이 조합에서 무엇을 지키면 되는지. 판단보다 이쪽이 더 쓸모 있다. */
  condition: string;
}

interface Signals {
  stem: number;
  element: number;
  branch: number;
  balance: number;
  stemKind: 'same' | 'harmony' | 'clash' | 'complement';
  branchCaution: string | null;
  branchSupport: string | null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function grade(score: number): { grade: CoupleFitGrade; gradeLabel: string } {
  if (score >= 78) return { grade: 'strong', gradeLabel: '잘 맞는 편' };
  if (score >= 64) return { grade: 'workable', gradeLabel: '조건을 맞추면 가능' };
  return { grade: 'careful', gradeLabel: '신중할 것' };
}

/** 일지 형충파해는 '틀어질 때 크게 틀어진다' 는 신호라, 신뢰가 걸린 용도에서 더 무겁게 본다. */
function branchPenalty(s: Signals, weight: number): number {
  return s.branch < 0 ? s.branch * weight : s.branch;
}

function buildMarriage(s: Signals, self: string, partner: string): CoupleFitItem {
  // 일지(배우자궁)와 일간 관계를 중심으로 본다. 결혼은 매일의 생활이 겹치는 일이라
  //   오행 생극보다 일지 합충과 기본 결(일간)이 더 오래 작동한다.
  const score = clampScore(70 + s.branch * 1.2 + s.stem * 1.5 + s.balance * 0.8);
  const g = grade(score);
  const reason = s.branchSupport
    ? `두 분 일지에 ${s.branchSupport}${josa(s.branchSupport, '이', '가')} 있어 생활을 붙여 놓는 힘이 있는 편입니다.`
    : s.branchCaution
      ? `두 분 일지에 ${s.branchCaution}${josa(s.branchCaution, '이', '가')} 걸려 있어, 가까이 붙어 지낼수록 마찰이 드러나기 쉽습니다.`
      : '두 분 일지에 큰 합충은 없어, 생활 규칙을 어떻게 정하느냐가 관계의 온도를 좌우하는 편입니다.';
  const condition =
    s.stemKind === 'clash'
      ? `${self}님과 ${partner}님은 결정 속도가 달라, 큰 지출과 일정은 그 자리에서 정하지 말고 하루 두고 정하는 규칙 하나만 있어도 다툼이 크게 줄어드는 편입니다.`
      : s.stemKind === 'same'
        ? '두 분이 닮아 편한 만큼 같은 지점에서 함께 고집이 서기 쉬우니, 집안일과 돈 관리는 역할을 미리 나눠 두는 편이 좋습니다.'
        : '생활 리듬(잠·식사·연락)과 돈 쓰는 원칙 두 가지만 먼저 맞춰 두면, 나머지는 시간이 해결해 주는 편입니다.';
  return { key: 'marriage', label: '결혼·평생 동반', score, ...g, reason, condition };
}

function buildBusiness(s: Signals, self: string, partner: string): CoupleFitItem {
  // 동업은 '역할이 갈리는가' 가 핵심이라 오행 생극(누가 누구를 살리는지)을 가장 무겁게 본다.
  //   일간이 같으면(같은 방식) 오히려 역할이 안 갈려 감점 요인이다.
  const sameStemPenalty = s.stemKind === 'same' ? -6 : 0;
  const score = clampScore(70 + s.element * 1.6 + s.stem * 0.8 + s.balance * 1.0 + sameStemPenalty);
  const g = grade(score);
  const reason =
    s.stemKind === 'same'
      ? `${self}님과 ${partner}님은 일하는 방식이 닮아 손발은 잘 맞지만, 둘 다 같은 자리를 보고 있어 역할이 겹치기 쉬운 편입니다.`
      : s.element > 0
        ? '두 분 오행이 서로를 살려 주는 방향이라, 역할을 나누면 각자 강점이 드러나는 편입니다.'
        : s.element < 0
          ? '두 분 오행이 서로를 누르는 방향이 있어, 결정권이 겹치면 피로가 빨리 쌓이는 편입니다.'
          : '두 분 오행은 크게 밀지도 누르지도 않아, 역할 설계를 어떻게 하느냐가 성패를 가르는 편입니다.';
  const condition =
    '시작 전에 셋만 문장으로 남기세요 — 최종 결정권이 누구에게 있는지, 돈이 들어오고 나가는 경로, 그만둘 때 정리 방법. 사이가 좋을 때 적어야 의미가 있습니다.';
  return { key: 'business', label: '동업·함께 사업', score, ...g, reason, condition };
}

function buildMoney(s: Signals, self: string, partner: string): CoupleFitItem {
  // 금전 거래는 '틀어졌을 때' 를 보는 항목이라 일지 형충파해에 가장 크게 반응해야 한다.
  const score = clampScore(70 + branchPenalty(s, 1.8) + s.element * 0.8 + s.balance * 0.6);
  const g = grade(score);
  const reason = s.branchCaution
    ? `두 분 일지에 ${s.branchCaution}${josa(s.branchCaution, '이', '가')} 있어, 돈이 얽히면 감정까지 함께 틀어지기 쉬운 구조입니다.`
    : '두 분 사이에 돈 문제를 크게 터뜨릴 신호는 두드러지지 않는 편입니다.';
  const condition =
    g.grade === 'careful'
      ? `빌려주고 받는 형태는 피하는 편이 좋습니다. 꼭 필요하면 ${self}님과 ${partner}님 모두 잃어도 관계가 흔들리지 않을 금액까지만, 기한과 금액을 글로 남기고 하세요.`
      : '금액과 기한을 글로 남기는 것만 지키면 큰 문제로 번지지 않는 편입니다. 구두 약속은 사이가 좋을수록 더 위험합니다.';
  return { key: 'money', label: '돈 거래·투자', score, ...g, reason, condition };
}

function buildLongterm(s: Signals, _self: string, _partner: string): CoupleFitItem {
  // 오래 보는 사이는 '부담 없이 이어지는가' 라, 균형(용신 보완)과 기본 결을 본다.
  //   일지 충은 매일 붙어 살 때보다 영향이 작아 가중치를 낮춘다.
  const score = clampScore(70 + s.balance * 1.5 + s.stem * 1.0 + s.branch * 0.5);
  const g = grade(score);
  const reason =
    s.balance > 0
      ? '서로 부족한 기운을 채워 주는 쪽이라, 오래 볼수록 편해지는 편입니다.'
      : s.balance < 0
        ? '두 분이 같은 기운으로 치우쳐 있어, 자주 붙어 있으면 같은 약점이 함께 커지기 쉬운 편입니다.'
        : '크게 채워 주지도 깎아 내리지도 않아, 거리 조절이 관계 수명을 좌우하는 편입니다.';
  const condition =
    '자주 보는 것보다 리듬이 중요합니다. 연락 간격과 만나는 빈도를 한쪽에 맞추지 말고, 둘 다 부담 없는 선으로 정해 두는 편이 오래 갑니다.';
  return { key: 'longterm', label: '오래 보는 사이', score, ...g, reason, condition };
}

/**
 * 용도별 적합성 4종. **점수 높은 순**으로 돌려준다 —
 * 사용자가 알고 싶은 건 "이 조합은 무엇에 제일 맞나" 이므로 순서 자체가 답이다.
 */
export function buildCoupleFit(
  interpretation: CompatibilityInterpretation,
  selfName: string,
  partnerName: string
): CoupleFitItem[] {
  const s = interpretation.signals;
  return [
    buildMarriage(s, selfName, partnerName),
    buildBusiness(s, selfName, partnerName),
    buildMoney(s, selfName, partnerName),
    buildLongterm(s, selfName, partnerName),
  ].sort((a, b) => b.score - a.score);
}
