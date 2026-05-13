export type MoonlightCounselorId = 'female' | 'male';

export interface MoonlightCounselorMeta {
  id: MoonlightCounselorId;
  label: string;
  shortLabel: string;
  title: string;
  imagePath: string;
  imageAlt: string;
  focus: string;
  description: string;
  signature: string;
  accentClassName: string;
  borderClassName: string;
  surfaceClassName: string;
}

export const DEFAULT_MOONLIGHT_COUNSELOR: MoonlightCounselorId = 'female';
export const MOONLIGHT_COUNSELOR_STORAGE_KEY = 'moonlight:preferred-counselor-v1';
export const MOONLIGHT_COUNSELOR_CHANGE_EVENT = 'moonlight:counselor-changed';

export const MOONLIGHT_COUNSELORS: Record<MoonlightCounselorId, MoonlightCounselorMeta> = {
  female: {
    id: 'female',
    label: '달빛 여선생',
    shortLabel: '여선생',
    title: '맥락과 감정의 결을 섬세하게 읽는 선생',
    imagePath: '/intro/moonlight_w.png',
    imageAlt: '달빛 여선생 초상',
    focus: '관계의 온도와 말의 결을 세심하게 짚습니다.',
    description:
      '감정선을 놓치지 않되 판단은 흐리지 않는 말투입니다. 관계, 속마음, 타이밍 해석에서 특히 자연스럽게 읽힙니다.',
    signature: '부드럽지만 단정하게, 흐름의 속뜻을 먼저 읽어드립니다.',
    accentClassName: 'text-[var(--app-plum)]',
    borderClassName: 'border-[var(--app-plum)]/35',
    surfaceClassName: 'bg-[rgba(166,124,181,0.12)]',
  },
  male: {
    id: 'male',
    label: '달빛 남선생',
    shortLabel: '남선생',
    title: '결론과 기준을 또렷하게 짚는 선생',
    imagePath: '/intro/moonlight_m.png',
    imageAlt: '달빛 남선생 초상',
    focus: '강약과 흐름의 기준을 분명하게 정리합니다.',
    description:
      '첫 문장에서 판단을 또렷하게 말하고, 이어서 근거와 순서를 붙입니다. 재물, 직업, 선택 해석에서 특히 힘이 좋습니다.',
    signature: '핵심부터 잘라 말씀드리고, 그 이유와 기준을 뒤에 붙입니다.',
    accentClassName: 'text-[var(--app-gold-text)]',
    borderClassName: 'border-[var(--app-gold)]/38',
    surfaceClassName: 'bg-[rgba(210,176,114,0.12)]',
  },
};

export function normalizeMoonlightCounselor(
  value: unknown
): MoonlightCounselorId | null {
  return value === 'female' || value === 'male' ? value : null;
}

export function resolveMoonlightCounselor(
  ...values: Array<unknown>
): MoonlightCounselorId {
  for (const value of values) {
    const normalized = normalizeMoonlightCounselor(value);
    if (normalized) return normalized;
  }

  return DEFAULT_MOONLIGHT_COUNSELOR;
}

export function getMoonlightCounselorMeta(
  counselorId: MoonlightCounselorId | null | undefined
) {
  return MOONLIGHT_COUNSELORS[resolveMoonlightCounselor(counselorId)];
}

export function buildDialogueCounselorInstructions(
  counselorId: MoonlightCounselorId
) {
  if (counselorId === 'male') {
    return [
      '이번 답변의 말결은 달빛 남선생입니다.',
      '첫 문장에서 결론과 판단을 또렷하게 잘라 말합니다.',
      '기준, 순서, 강약, 조절 포인트를 분명히 그어주듯 답합니다.',
      '과한 위로나 장식보다 묵직한 상담실 어조를 유지합니다.',
    ];
  }

  return [
    '이번 답변의 말결은 달빛 여선생입니다.',
    '결론은 분명히 말하되, 감정의 결이나 관계의 온도를 함께 짚습니다.',
    '맥락과 속뜻을 먼저 읽어주고, 말의 속도와 거리감을 섬세하게 정리합니다.',
    '다정하지만 흐리지 않는 상담실 어조를 유지합니다.',
  ];
}

export function buildReportCounselorInstructions(
  counselorId: MoonlightCounselorId
) {
  if (counselorId === 'male') {
    return [
      '이번 리포트의 문체는 달빛 남선생입니다.',
      '핵심 판단을 먼저 두고, 근거와 기준을 뒤에 붙입니다.',
      '문장을 군더더기 없이 단정하게 쓰고, 역할과 흐름의 선을 분명히 긋습니다.',
    ];
  }

  return [
    '이번 리포트의 문체는 달빛 여선생입니다.',
    '맥락과 정서의 움직임을 먼저 읽어주되, 결론은 분명하게 정리합니다.',
    '사용자가 스스로 감각을 따라갈 수 있도록 관계의 온도와 말의 결을 섬세하게 풀어냅니다.',
  ];
}
