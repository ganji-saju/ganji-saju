export type ProfileLinkageStatus = 'ready' | 'partial' | 'independent';

export interface ProfileLinkageServiceAudit {
  key:
    | 'my-profile'
    | 'home'
    | 'today-fortune'
    | 'saju-new'
    | 'saju-result'
    | 'compatibility'
    | 'dialogue'
    | 'tarot'
    | 'star-sign'
    | 'zodiac'
    | 'myeongri';
  label: string;
  status: ProfileLinkageStatus;
  usesSelfProfile: boolean;
  usesFamilyProfiles: boolean;
  usesSharedBirthSchema: boolean;
  usesSajuEngine: boolean;
  detail: string;
  continuity: string;
  sourceRefs: string[];
}

export interface ProfileLinkageAudit {
  status: 'ready';
  overview: {
    linkedServiceCount: number;
    partialServiceCount: number;
    independentServiceCount: number;
  };
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  services: ProfileLinkageServiceAudit[];
  warnings: string[];
}

const SERVICES: ProfileLinkageServiceAudit[] = [
  {
    key: 'my-profile',
    label: 'MY 프로필 / 가족정보',
    status: 'ready',
    usesSelfProfile: true,
    usesFamilyProfiles: true,
    usesSharedBirthSchema: true,
    usesSajuEngine: false,
    detail:
      '양력·음력, 시간 모름, 출생지, timeRule을 저장하는 입력 저장소입니다. 오늘운세, 사주 시작하기, 궁합에서 같은 입력값을 다시 불러옵니다.',
    continuity: '공통 입력 저장소',
    sourceRefs: [
      '/src/components/my/profile-manager.tsx',
      '/src/app/api/profile/route.ts',
      '/src/app/api/family-profiles/route.ts',
    ],
  },
  {
    key: 'home',
    label: '홈 개인화',
    status: 'partial',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: false,
    usesSajuEngine: false,
    detail:
      '홈은 프로필 생년월일과 선생 선택을 읽어 개인화 카피와 오늘 흐름 미리보기를 만듭니다. 다만 실제 사주 계산 흐름이 아니라 홈 전용 간단 개인화 계산을 씁니다.',
    continuity: '프로필 기반 미리보기만 연결됨',
    sourceRefs: ['/src/app/page.tsx', '/src/features/home/personalized-today.ts'],
  },
  {
    key: 'today-fortune',
    label: '오늘의 운세',
    status: 'ready',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: true,
    usesSajuEngine: true,
    detail:
      '로그인 사용자는 MY 프로필이 입력 폼에 자동으로 채워지고, 공통 birth schema를 거쳐 실제 사주 계산 흐름으로 무료/유료 결과를 만듭니다.',
    continuity: '공통 입력 → 공통 계산 → 오늘운세 결과',
    sourceRefs: [
      '/src/features/unified-intake/unified-intake.tsx',
      '/src/features/unified-intake/submit-today.ts',
      '/src/features/today-fortune/today-fortune-experience.tsx',
      '/src/app/api/today-fortune/route.ts',
    ],
  },
  {
    key: 'saju-new',
    label: '사주 시작하기',
    status: 'ready',
    usesSelfProfile: true,
    usesFamilyProfiles: true,
    usesSharedBirthSchema: true,
    usesSajuEngine: true,
    detail:
      '내 정보와 가족 프로필을 불러와 같은 입력 블록으로 읽고, unified birth schema를 거쳐 기본 사주 결과를 생성합니다.',
    continuity: '공통 입력 → 읽기 생성 → 사주 결과',
    sourceRefs: [
      '/src/app/saju/new/saju-new-client.tsx',
      '/src/features/unified-intake/submit-saju.ts',
      '/src/app/api/readings/route.ts',
    ],
  },
  {
    key: 'saju-result',
    label: '사주 결과 / 심층 / 평생 / 연간',
    status: 'partial',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: false,
    usesSajuEngine: true,
    detail:
      '결과 자체는 생성된 reading slug를 바탕으로 움직이고, 선생 선택과 일부 AI 레이어는 저장된 프로필 선호값을 다시 읽습니다. 즉 결과는 reading 중심, 페르소나는 profile 중심입니다.',
    continuity: 'reading 기반 결과 + profile 기반 선생 설정',
    sourceRefs: [
      '/src/app/saju/[slug]/page.tsx',
      '/src/app/api/interpret/route.ts',
      '/src/server/ai/saju-yearly-service.ts',
      '/src/server/ai/saju-lifetime-service.ts',
    ],
  },
  {
    key: 'compatibility',
    label: '궁합',
    status: 'ready',
    usesSelfProfile: true,
    usesFamilyProfiles: true,
    usesSharedBirthSchema: false,
    usesSajuEngine: true,
    detail:
      '내 프로필과 저장된 가족/연인/친구 프로필을 함께 읽어 실제 두 사람 명식을 비교합니다. 가족정보 저장 품질이 궁합 정확도에 직접 연결됩니다.',
    continuity: '내 프로필 + 가족 프로필 → 두 명식 비교',
    sourceRefs: [
      '/src/app/compatibility/input/page.tsx',
      '/src/app/compatibility/result/page.tsx',
      '/src/lib/compatibility.ts',
    ],
  },
  {
    key: 'dialogue',
    label: 'AI 대화',
    status: 'partial',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: false,
    usesSajuEngine: false,
    detail:
      'AI 대화는 저장된 MY 프로필을 grounding으로 읽고, 오늘운세 sourceSessionId가 있으면 그 결과 맥락도 이어받습니다. 하지만 가족 프로필을 자동 전환해 읽는 구조는 아닙니다.',
    continuity: '프로필 grounding + today result session 연결',
    sourceRefs: ['/src/app/api/ai/route.ts', '/src/components/dialogue/dialogue-chat-panel.tsx'],
  },
  {
    key: 'tarot',
    label: '타로',
    status: 'partial',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: false,
    usesSajuEngine: false,
    detail:
      '타로는 여전히 질문과 카드 뽑기 중심이지만, MY 프로필이 있으면 내 사주 결과로 이어보거나 대화에서 함께 묻는 브리지 CTA를 보여줍니다.',
    continuity: '질문 기반 리딩 + 사주 브리지 CTA',
    sourceRefs: ['/src/app/tarot/daily/page.tsx', '/src/lib/tarot-api.ts'],
  },
  {
    key: 'star-sign',
    label: '별자리',
    status: 'partial',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: false,
    usesSajuEngine: false,
    detail:
      '별자리는 MY 프로필 생일이 있으면 해당 별자리를 먼저 강조하고, 저장된 사주 결과가 있으면 내 사주로 이어보는 약한 개인화를 제공합니다.',
    continuity: '콘텐츠형 흐름 + MY 프로필 약한 개인화',
    sourceRefs: ['/src/app/star-sign/page.tsx', '/src/app/star-sign/[slug]/page.tsx'],
  },
  {
    key: 'zodiac',
    label: '띠운세',
    status: 'ready',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: true,
    usesSajuEngine: true,
    detail:
      '띠운세는 MY 프로필 생년월일을 공통 BirthInput으로 바꾼 뒤 실제 사주 엔진의 연주 지지를 읽어 내 띠를 맞춥니다. 입춘 전후 생일도 사주 결과와 같은 바탕으로 맞습니다.',
    continuity: 'MY 프로필 → 공통 입력 → 사주 엔진 연주 → 내 띠 운세',
    sourceRefs: [
      '/src/lib/profile-personalization.ts',
      '/src/app/zodiac/page.tsx',
      '/src/app/zodiac/[slug]/page.tsx',
    ],
  },
  {
    key: 'myeongri',
    label: '명리 탐구',
    status: 'partial',
    usesSelfProfile: true,
    usesFamilyProfiles: false,
    usesSharedBirthSchema: false,
    usesSajuEngine: false,
    detail:
      '명리 탐구는 여전히 개념을 배우는 공간이지만, 저장된 MY 프로필이 있으면 내 통합 결과와 오행 화면으로 바로 이어지는 브리지 섹션을 제공합니다.',
    continuity: '개념 학습형 + 내 사주로 이어보기',
    sourceRefs: ['/src/app/myeongri/page.tsx', '/src/app/myeongri/ten-gods/page.tsx'],
  },
];

export function getProfileLinkageVerificationAudit(): ProfileLinkageAudit {
  const linkedServiceCount = SERVICES.filter((service) => service.status === 'ready').length;
  const partialServiceCount = SERVICES.filter((service) => service.status === 'partial').length;
  const independentServiceCount = SERVICES.filter(
    (service) => service.status === 'independent'
  ).length;

  return {
    status: 'ready',
    overview: {
      linkedServiceCount,
      partialServiceCount,
      independentServiceCount,
    },
    checks: [
      {
        key: 'profile-api-unified-schema',
        label: '프로필 저장 API가 새 공통 입력 스키마를 받는가',
        ok: true,
        detail:
          'MY 프로필과 가족정보 저장 API가 birthYear뿐 아니라 year/month/day/hour/minute 키도 함께 받아 today-fortune와 /saju/new의 공통 입력을 그대로 저장합니다.',
      },
      {
        key: 'today-fortune-prefill',
        label: '오늘운세가 로그인 프로필을 기본값으로 이어받는가',
        ok: true,
        detail:
          '오늘운세는 로그인 사용자의 MY 프로필을 자동 기본값으로 불러오고, 수동 불러오기 버튼도 유지합니다.',
      },
      {
        key: 'shared-birth-engine',
        label: '공통 입력이 기존 사주 계산 흐름으로 그대로 들어가는가',
        ok: true,
        detail:
          'today-fortune와 /saju/new는 unified birth schema를 resolve한 뒤 기존 BirthInput과 calculateSajuDataV1 경로를 계속 사용합니다.',
      },
      {
        key: 'content-services-standalone',
        label: '타로/별자리/명리 탐구와 엔진 연결 서비스를 정확히 구분했는가',
        ok: true,
        detail:
          '타로/별자리/명리 탐구는 약한 개인화나 사주 브리지 CTA 수준이고, 띠운세는 실제 사주 엔진 연주 정보로 내 띠를 계산합니다.',
      },
    ],
    services: SERVICES,
    warnings: [
      '타로, 별자리, 명리 탐구는 사주 전체를 자동 재해석하지는 않으며, 현재는 약한 개인화 또는 브리지 CTA 수준으로만 연결됩니다.',
      '사주 결과/AI 대화는 일부 profile 기반 설정을 읽지만, 본문 해석 자체는 생성된 reading이나 질문 컨텍스트 중심으로 이어집니다.',
    ],
  };
}
