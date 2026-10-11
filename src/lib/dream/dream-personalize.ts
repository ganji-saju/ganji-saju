// 2026-10-11 — 꿈해몽 상황 선택(점검 A #5, 사용자 결정 A안). 사전 일치형이라 "내 꿈"의 기분·결말·함께한 사람이
//   반영되지 않았다. 고른 상황과 그 상징의 분류·길흉 경향을 엮어 맞춤 문단을 만든다. 결정론 — AI 비용·검색 횟수 없음.
//   원칙: 길흉은 민속 경향일 뿐 단정하지 않고, 불안을 키우거나 사건을 예고하지 않는다.
import type { DreamMeaning } from '@/lib/dream-dictionary';

export type DreamFeeling = 'calm' | 'anxious' | 'scared' | 'excited';
export type DreamEnding = 'resolved' | 'chased' | 'blurry';
export type DreamCompanion = 'alone' | 'known' | 'stranger';

export const DREAM_FEELINGS: Array<{ id: DreamFeeling; label: string }> = [
  { id: 'calm', label: '편안했다' }, { id: 'anxious', label: '불안했다' }, { id: 'scared', label: '무서웠다' }, { id: 'excited', label: '설렜다' },
];
export const DREAM_ENDINGS: Array<{ id: DreamEnding; label: string }> = [
  { id: 'resolved', label: '잘 끝났다' }, { id: 'chased', label: '쫓기거나 끊겼다' }, { id: 'blurry', label: '기억이 흐리다' },
];
export const DREAM_COMPANIONS: Array<{ id: DreamCompanion; label: string }> = [
  { id: 'alone', label: '혼자였다' }, { id: 'known', label: '아는 사람과' }, { id: 'stranger', label: '모르는 사람과' },
];

const THEME: Record<DreamMeaning['category'], string> = {
  animal: '본능과 기운', person: '사람과의 관계', food: '채움과 보상', nature: '주변 환경의 변화', object: '가진 것과 지킬 것', action: '움직임과 선택',
};

const POSITIVE: DreamFeeling[] = ['calm', 'excited'];

// 받침에 맞는 조사(과/와, 을/를).
function josa(word: string, withBatchim: string, without: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return `${word}${code >= 0 && code <= 11171 && code % 28 !== 0 ? withBatchim : without}`;
}

export interface DreamSituation { feeling?: DreamFeeling; ending?: DreamEnding; companion?: DreamCompanion }

export function buildDreamPersonalReading(meaning: Pick<DreamMeaning, 'keyword' | 'category' | 'fortune'>, situation: DreamSituation): string[] {
  const k = meaning.keyword;
  const theme = THEME[meaning.category];
  const lines: string[] = [];
  const { feeling, ending, companion } = situation;
  if (feeling) {
    const base = {
      calm: `${k} 꿈을 편안하게 꾸었다면, 이 상징이 가리키는 ${theme}의 흐름을 마음이 자연스럽게 받아들이고 있다는 신호로 읽습니다.`,
      excited: `${k} 꿈에서 설렜다면, ${josa(theme, '과', '와')} 관련해 기대하거나 바라는 일이 마음속에서 커지고 있다는 뜻으로 볼 수 있습니다.`,
      anxious: `${k} 꿈에서 불안했다면, ${josa(theme, '을', '를')} 둘러싼 걱정이 꿈에 비친 것일 수 있습니다. 실제로 일이 틀어진다는 뜻이 아니라, 마음이 준비할 거리를 알려 주는 쪽에 가깝습니다.`,
      scared: `${k} 꿈이 무서웠다면, ${josa(theme, '과', '와')} 관련해 미뤄 둔 부담이 크게 느껴지고 있다는 신호로 봅니다. 꿈의 무서움이 현실의 사건을 예고하지는 않습니다.`,
    }[feeling];
    lines.push(base);
    if (meaning.fortune === '길몽' && !POSITIVE.includes(feeling)) {
      lines.push('전통적으로는 길몽으로 분류되는 상징이지만 기분이 좋지 않았다면, 기대보다 준비와 점검을 먼저 하라는 뜻으로 받아들이면 좋습니다.');
    } else if (meaning.fortune === '흉몽' && POSITIVE.includes(feeling)) {
      lines.push('전통적으로는 조심을 뜻하는 상징이지만 꿈속 기분이 좋았다면, 걱정보다 정리와 마무리의 의미가 더 크다고 봅니다.');
    }
  }
  if (ending) {
    lines.push({
      resolved: '꿈이 잘 마무리됐다면, 지금 마음에 걸린 일도 정리할 실마리가 이미 가까이 있다는 쪽으로 읽습니다.',
      chased: '쫓기거나 갑자기 끊겼다면, 미뤄 둔 일이나 피하고 싶은 감정이 남아 있다는 신호로 봅니다. 그 일 하나를 짧게라도 손대 보면 마음이 가벼워집니다.',
      blurry: '내용이 흐리게 남았다면, 상징 하나하나보다 깼을 때의 기분을 기준으로 해석하는 편이 맞습니다.',
    }[ending]);
  }
  if (companion) {
    lines.push({
      alone: '혼자였다면 이 꿈은 다른 사람보다 내 마음과 선택에 관한 이야기에 가깝습니다.',
      known: '아는 사람과 함께였다면, 그 사람과의 관계나 그 사람이 떠올리게 하는 상황을 함께 살펴보세요.',
      stranger: '모르는 사람과 함께였다면, 아직 드러나지 않은 기회나 낯선 환경을 향한 마음이 담겨 있을 수 있습니다.',
    }[companion]);
  }
  return lines;
}
