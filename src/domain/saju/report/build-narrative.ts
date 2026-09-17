import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { buildSajuPersonalizationContext, type SajuPersonalizationContext, type TenGodGroup } from './personalization-context';
import { buildHonorificPrefix } from './situation-honor';
import { ganziForBody, ganziToKorean } from '@/lib/saju/terminology';

export interface SajuNarrativeChip { label: string; value: string }
export interface SajuNarrativeQuestion {
  question: string;
  answer: string;
  evidence: string;
  example: string;
  choice: string;
}
export interface SajuNarrative {
  headline: string;
  /** 기존 총평 서비스 fallback에도 같은 내용을 전달한다. */
  body: string;
  chips: SajuNarrativeChip[];
  questions: SajuNarrativeQuestion[];
}
export interface SajuNarrativeOptions { userName?: string | null }

// 일간 오행만으로 성격을 정하지 않고 실제 원국의 십성 분포에서 역할을 읽는다.
const ROLE_READING: Record<TenGodGroup, { meaning: string; answer: string; example: string; choice: string }> = {
  비겁: {
    meaning: '자기 기준과 동료 사이의 역할',
    answer: '스스로 방법을 정할 여지가 있을 때 참여하기 편한 쪽으로 읽습니다.',
    example: '함께하는 일에서도 각자 맡을 부분이 분명하면 집중하기 쉽고, 매 단계 허락을 기다리는 방식에서는 답답함이 생길 수 있어요.',
    choice: '혼자 할지 함께할지보다 결정할 수 있는 범위가 있는지 보세요. 공동 과제라면 시작 전에 각자의 몫과 도움을 청할 지점을 나누세요.',
  },
  식상: {
    meaning: '표현하고 결과물을 만드는 역할',
    answer: '생각을 직접 보여주고 반응을 받아 고치는 환경에서 강점을 살피기 좋습니다.',
    example: '설명을 오래 준비하는 일보다 초안이나 작은 결과물을 먼저 보여주는 상황에서 무엇을 바꿔야 할지 찾기 쉬울 수 있어요.',
    choice: '새 아이디어가 필요한 일에는 짧은 실험을, 정해진 기준을 지켜야 하는 일에는 먼저 확인받은 범위 안의 개선을 선택하세요.',
  },
  재성: {
    meaning: '자원을 배분하고 결과를 확인하는 역할',
    answer: '시간과 노력이 어디에 쓰이고 무엇이 남는지 확인할 수 있는 환경을 먼저 살펴보세요.',
    example: '막연히 오래 하라는 요청보다 필요한 준비물과 마감, 완성 기준을 함께 받은 과제에서 우선순위를 잡기 쉬울 수 있어요.',
    choice: '결과가 보이는 과제라도 들어갈 시간과 유지 부담을 같이 비교하세요. 선택지가 많을수록 지금 가진 자원으로 끝낼 수 있는 하나를 고르세요.',
  },
  관성: {
    meaning: '기준을 지키고 책임을 맡는 역할',
    answer: '맡은 역할과 평가 기준이 분명할 때 힘을 쓰는 방향으로 읽습니다.',
    example: '같은 부탁이어도 완료 기준이 명확하면 안정적으로 진행하기 쉽고, 책임만 주고 결정 권한은 주지 않는 상황에서는 부담이 커질 수 있어요.',
    choice: '중요한 역할을 맡기 전에 책임에 맞는 시간과 권한이 있는지 보세요. 기준이 바뀌면 혼자 맞추기보다 어디까지 할지 다시 합의하세요.',
  },
  인성: {
    meaning: '배우고 이해한 뒤 적용하는 역할',
    answer: '이유를 이해하고 충분히 익힐 시간을 주는 환경에서 강점을 살펴볼 수 있습니다.',
    example: '처음부터 즉답을 요구받기보다 자료를 읽고 한 번 연습한 뒤 설명하는 상황에서 자신의 생각을 정리하기 쉬울 수 있어요.',
    choice: '낯선 과제에는 먼저 배울 시간을 확보하되 준비를 끝낼 기준도 두세요. 이미 익숙한 일이라면 자료를 더 찾기 전에 작은 적용부터 해보세요.',
  },
};

export function buildSajuNarrative(
  data: SajuDataV1 | SajuDataV2,
  personalizationContext: SajuPersonalizationContext | null,
  options: SajuNarrativeOptions = {}
): SajuNarrative {
  const ctx = personalizationContext ?? buildSajuPersonalizationContext(data);
  const profile = ctx.sixtyGapja;
  const actionCue = (profile?.actionCue ?? '').replace(/오늘(?:은|의)?\s*/gu, '').replace('하루가 좋습니다', '방식이 좋습니다');
  const dayLabel = ctx.dayGanziCode || ganziToKorean(data.pillars.day.ganzi);
  const ranked = (Object.entries(ctx.tenGodDistribution) as [TenGodGroup, number][])
    .filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const first = ranked[0];
  const second = ranked[1];
  const role = first ? ROLE_READING[first[0]] : null;
  const strength = data.strength?.level;
  const major = data.currentLuck?.currentMajorLuck;
  const support = ctx.yongsinKiyshin.용신;
  const situation = ctx.userSituation;
  const referenceYear = new Date(data.metadata.calculatedAt).getUTCFullYear();
  const age = referenceYear - data.input.birth.year;
  const child = Number.isFinite(age) && age < 14;
  const setting = child ? '보호자가 놀이와 배움의 상황에서' : situation?.occupation === 'student'
    ? '학습이나 함께하는 과제에서' : situation?.occupation === 'employee'
      ? '입력하신 직장 생활에서' : situation?.occupation === 'self-employed'
        ? '입력하신 자영업·프리랜서 활동에서' : situation?.occupation === 'job-seeking'
          ? '지원할 곳의 일하는 방식을 비교할 때' : '새로운 활동을 선택할 때';
  const capacity = strength === '신약'
    ? { answer: '여러 요구를 한꺼번에 받아들이기보다 필요한 도움과 여유를 먼저 확보하는 방식이 맞는지 살펴보세요.', example: '잘 아는 일도 낯선 사람의 요청과 급한 일정이 겹치면 평소 속도를 유지하기 어려울 수 있어요.', choice: '과제를 더 맡기 전에 도움받을 사람과 비울 시간을 정하세요. 능력이 부족하다는 뜻이 아니라 부담을 나누는 조건을 확인하는 기준입니다.' }
    : strength === '신강'
      ? { answer: '자기 판단을 밀고 가는 힘이 다른 사람의 속도보다 앞서지 않는지 살펴보세요.', example: '좋은 방법을 찾았더라도 상대의 설명을 끝까지 듣기 전에 결론을 내리면, 내용보다 전달 방식에서 마찰이 생길 수 있어요.', choice: '혼자 결정할 수 있는 일은 진행하되 다른 사람이 함께 책임지는 일은 선택 이유와 변경 가능한 부분을 먼저 확인하세요.' }
      : { answer: '상황에 맞춰 조절하되, 조율하는 과정에서 자신의 기준이 사라지는지 살펴보세요.', example: '여러 의견을 받아들여 계획을 바꿀 때 무엇을 지키려 했는지 흐려진다면, 선택지를 늘리기보다 처음의 목적을 확인할 때예요.', choice: '계속할 이유와 바꿀 조건을 하나씩 적어두세요. 실제 생활에서 반복되지 않는 약점은 자신에게 맞는 설명으로 받아들일 필요가 없습니다.' };
  const roleEvidence = first
    ? `계산된 십성 분포에서 ${first[0]}이 ${second?.[1] === first[1] ? `${second[0]}과 함께 높은 비중을 차지합니다` : '가장 큰 비중을 차지합니다'}. 전통 해석에서 ${ROLE_READING[first[0]].meaning}을 살피는 근거입니다.`
    : '십성 분포가 충분하지 않아 특정 역할을 우세하다고 정하지 않았습니다.';
  const supportChoice = support === '목' ? '새로 시작할 필요가 있다면 큰 전환을 정하기 전에 작은 시도를 끝낼 날짜부터 잡으세요.'
    : support === '화' ? '마음속에서만 정리한 생각이 있다면 상대가 답할 수 있는 짧은 질문이나 제안으로 꺼내보세요.'
      : support === '토' ? '여러 일이 흩어져 있다면 반복할 일정 하나와 맡지 않을 일 하나를 먼저 정하세요.'
        : support === '금' ? '애매하게 계속되는 일이 있다면 끝났다고 볼 기준과 더 하지 않을 범위를 함께 정하세요.'
          : support === '수' ? '판단을 서두르고 있다면 확인한 사실과 아직 모르는 것을 나눈 뒤, 부족한 정보 한 가지를 더 확인하세요.'
            : '새로운 선택 전 실제 여건과 원하는 결과를 함께 확인하고, 짧게 시도한 뒤 유지 여부를 정하세요.';
  const concernExample = child ? '' : situation?.currentConcern === 'wealth'
    ? '재물 고민이라면 돈이 들어오는 방식과 실제로 남는 돈을 나눠 보세요. 새 선택을 검토할 때는 금액뿐 아니라 이후의 유지 비용도 확인할 수 있어요.'
    : situation?.currentConcern === 'business'
      ? '일의 변화를 고민한다면 명칭이나 기대만 비교하지 말고, 실제로 맡을 역할과 책임에 맞는 권한이 주어지는지 확인해보세요.'
      : situation?.currentConcern === 'romance'
        ? '관계가 고민이라면 상대의 마음을 추측하는 데서 멈추지 말고, 원하는 연락 방식과 함께할 수 있는 시간을 확인하는 대화에 적용해보세요.'
        : situation?.currentConcern === 'family'
          ? '가족 고민이라면 내가 맡고 싶은 몫과 주변이 기대하는 몫을 나눠 보세요. 도움이 필요한 일과 혼자 결정하고 싶은 일을 구분해 이야기할 수 있어요.'
          : situation?.currentConcern === 'health'
            ? '건강이 고민이라면 이 해석을 병의 원인이나 진단으로 쓰지 마세요. 실제 생활에서 부담이 늘어나는 일정과 회복에 필요한 조건을 돌아보는 데 활용하세요.'
            : '';
  const questions: SajuNarrativeQuestion[] = [
    {
      question: '어떤 성향이 반복해서 드러날까요?',
      answer: profile?.core ?? `${data.dayMaster.element} 기운을 중심으로 반응하는 성향을 살펴봅니다.`,
      evidence: `${dayLabel} 일주를 기본 성향의 출발점으로 봅니다. ${data.pattern ? `${data.pattern.name}은 반복되는 역할의 ${data.pattern.confidence === '낮음' ? '참고 후보' : '판단 근거'}로 함께 읽습니다.` : '격국은 정하지 않아 하나의 역할로 성향을 좁히지 않습니다.'}`,
      example: role?.example ?? '새로운 과제를 받았을 때 먼저 이해하려는지, 실행하며 확인하는지 실제 반응을 비교해보세요.',
      choice: child ? `보호자는 아이의 반응을 성격으로 굳히지 말고 상황을 바꿨을 때도 같은 모습인지 관찰해주세요.` : `편한 상황과 부담스러운 상황에서 반응을 각각 비교해보세요. ${actionCue}`,
    },
    {
      question: '어떤 환경에서 장점을 쓰기 쉬울까요?',
      answer: role?.answer ?? '직업명 하나보다 실제로 맡을 역할과 일하는 방식을 비교하는 것이 먼저입니다.',
      evidence: roleEvidence,
      example: `${setting} ${second ? `'${ROLE_READING[second[0]].meaning}'도 함께 필요합니다. ${ROLE_READING[second[0]].example}` : '혼자 할 부분과 도움받을 부분을 나누어 반응을 확인해보세요.'}`,
      choice: role?.choice ?? '편하게 반복할 수 있는 방식인지 작은 과제로 확인한 뒤 활동의 범위를 넓혀보세요.',
    },
    {
      question: '잘하던 일이 왜 부담으로 바뀔까요?',
      answer: capacity.answer,
      evidence: strength ? `강약 판단은 ${strength}입니다. 사주 안에서 본인을 돕는 힘과 소모시키는 힘을 비교한 것으로, 건강이나 실제 능력의 높낮이를 판정한 값은 아닙니다.` : '강약을 확정할 수 없어 생활 조건을 기준으로 부담을 확인합니다.',
      example: `${profile?.watchPoints[0] ?? ''} ${capacity.example}`.trim(),
      choice: child ? `보호자가 일정과 요구의 양을 조절하고 아이가 도움을 청할 수 있게 해주세요. ${capacity.choice}` : capacity.choice,
    },
    {
      question: '지금 바꿔볼 선택 기준은 무엇일까요?',
      answer: support ? `${support} 기운을 보완 방향으로 읽고, 생활에서 조정할 방법을 찾습니다.` : '보완 기운을 확정하기보다 이미 확인한 강점과 부담을 실제 선택에 연결해보세요.',
      evidence: `${support ? '보완 방향은 오행 개수 하나가 아니라 원국의 균형 판단에 따른 것입니다.' : '용신 정보가 충분하지 않아 특정 기운이 필요하다고 단정하지 않습니다.'} ${major ? `현재 계산된 ${ganziForBody(major.ganzi)} 대운과 함께 보되, 좋은 일이나 나쁜 일이 생기는 날짜로 해석하지 않습니다.` : '현재 대운은 미산정이어서 전환 시기를 제시하지 않습니다.'} ${data.input.hourKnown ? '' : '태어난 시간이 없어 시주에 따른 해석은 제외했습니다.'}`.trim(),
      example: concernExample || (situation?.relationshipStatus === 'married' && !child ? '입력하신 기혼 상황에서는 함께 결정하는 일과 각자 결정할 일을 나누어 이 기준을 적용해볼 수 있어요.' : situation?.relationshipStatus === 'dating' && !child ? '입력하신 연애 관계에서는 상대의 의도를 추측하기보다 서로 원하는 방식과 가능한 범위를 확인하는 대화에 적용해보세요.' : child ? '놀이와 배움에서 무엇을 좋아하고 어떤 요구에 부담을 느끼는지 보호자가 짧게 기록해보세요.' : '일과 가까운 관계에서 반복되는 고민 하나를 골라, 바꾸기 전후에 부담과 결과가 어떻게 달라지는지 확인해보세요.'),
      choice: child ? `보호자가 함께 시도하며 조절해주세요. ${supportChoice}` : supportChoice,
    },
  ];
  const chips: SajuNarrativeChip[] = [{ label: '일주', value: dayLabel }];
  if (data.pattern) chips.push({ label: '격국', value: data.pattern.name });
  if (support) chips.push({ label: '용신', value: `${support} 기운` });
  if (strength) chips.push({ label: '강약', value: strength });
  if (major) chips.push({ label: '대운', value: ganziForBody(major.ganzi) });
  const prefix = buildHonorificPrefix({ situation: child ? null : situation, userName: options.userName });
  return {
    headline: `${prefix}${dayLabel} 일주, 성향과 환경을 함께 읽습니다.`,
    body: questions.map(({ answer, evidence, example, choice }) => [answer, evidence, example, choice].join(' ')).join('\n\n'),
    chips,
    questions,
  };
}
