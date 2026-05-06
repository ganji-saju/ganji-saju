export const TAROT_CARD_IMAGE_DIRECTORY = '/images/tarot/cards';
export const TAROT_CARD_IMAGE_EXTENSION = 'png';
export const TAROT_CARD_BACK_IMAGE_FILE = '00_back.png';

export type TarotCardVisualFamily = 'major' | 'cups' | 'pentacles' | 'swords' | 'wands';

export interface TarotCardVisualTone {
  family: TarotCardVisualFamily;
  label: string;
  marker: string;
  accentClassName: string;
  backgroundClassName: string;
  borderClassName: string;
  motifClassName: string;
}

const VISUAL_TONES: Record<TarotCardVisualFamily, TarotCardVisualTone> = {
  major: {
    family: 'major',
    label: 'Major Arcana',
    marker: '✦',
    accentClassName: 'text-[var(--app-gold)]',
    backgroundClassName:
      'bg-[radial-gradient(circle_at_50%_18%,rgba(210,176,114,0.22),transparent_36%),linear-gradient(160deg,rgba(86,62,122,0.98),rgba(19,23,47,0.98))]',
    borderClassName: 'border-[var(--app-gold)]/60',
    motifClassName: 'border-[var(--app-gold)]/35 bg-[rgba(210,176,114,0.12)]',
  },
  cups: {
    family: 'cups',
    label: 'Cups',
    marker: '💧',
    accentClassName: 'text-[var(--app-sky)]',
    backgroundClassName:
      'bg-[radial-gradient(circle_at_50%_18%,rgba(108,173,205,0.24),transparent_36%),linear-gradient(160deg,rgba(42,79,116,0.98),rgba(12,24,45,0.98))]',
    borderClassName: 'border-[var(--app-sky)]/55',
    motifClassName: 'border-[var(--app-sky)]/35 bg-[rgba(108,173,205,0.12)]',
  },
  pentacles: {
    family: 'pentacles',
    label: 'Pentacles',
    marker: '🪙',
    accentClassName: 'text-[var(--app-jade)]',
    backgroundClassName:
      'bg-[radial-gradient(circle_at_50%_18%,rgba(121,178,139,0.22),transparent_36%),linear-gradient(160deg,rgba(45,86,72,0.98),rgba(16,31,37,0.98))]',
    borderClassName: 'border-[var(--app-jade)]/55',
    motifClassName: 'border-[var(--app-jade)]/35 bg-[rgba(121,178,139,0.12)]',
  },
  swords: {
    family: 'swords',
    label: 'Swords',
    marker: '🌬',
    accentClassName: 'text-[var(--app-ivory)]',
    backgroundClassName:
      'bg-[radial-gradient(circle_at_50%_18%,rgba(232,229,214,0.16),transparent_36%),linear-gradient(160deg,rgba(57,67,88,0.98),rgba(15,19,32,0.98))]',
    borderClassName: 'border-[var(--app-ivory)]/45',
    motifClassName: 'border-[var(--app-ivory)]/25 bg-[rgba(232,229,214,0.08)]',
  },
  wands: {
    family: 'wands',
    label: 'Wands',
    marker: '🔥',
    accentClassName: 'text-[var(--app-coral)]',
    backgroundClassName:
      'bg-[radial-gradient(circle_at_50%_18%,rgba(211,129,103,0.24),transparent_36%),linear-gradient(160deg,rgba(116,62,58,0.98),rgba(34,19,31,0.98))]',
    borderClassName: 'border-[var(--app-coral)]/55',
    motifClassName: 'border-[var(--app-coral)]/35 bg-[rgba(211,129,103,0.12)]',
  },
};

const TAROT_CARD_IMAGE_FILES: Record<string, string> = {
  ar00: '01_the_fool.png',
  ar01: '02_the_magician.png',
  ar02: '03_the_high_priestess.png',
  ar03: '04_the_empress.png',
  ar04: '05_the_emperor.png',
  ar05: '06_the_hierophant.png',
  ar06: '07_the_lovers.png',
  ar07: '08_the_chariot.png',
  ar08: '09_strength.png',
  ar09: '10_the_hermit.png',
  ar10: '11_wheel_of_fortune.png',
  ar11: '12_justice.png',
  ar12: '13_the_hanged_man.png',
  ar13: '14_death.png',
  ar14: '15_temperance.png',
  ar15: '16_the_devil.png',
  ar16: '17_the_tower.png',
  ar17: '18_the_star.png',
  ar18: '19_the_moon.png',
  ar19: '20_the_sun.png',
  ar20: '21_judgement.png',
  ar21: '22_the_world.png',
  waac: '23_ace_of_wands.png',
  wa02: '24_two_of_wands.png',
  wa03: '25_three_of_wands.png',
  wa04: '26_four_of_wands.png',
  wa05: '27_five_of_wands.png',
  wa06: '28_six_of_wands.png',
  wa07: '29_seven_of_wands.png',
  wa08: '30_eight_of_wands.png',
  wa09: '31_nine_of_wands.png',
  wa10: '32_ten_of_wands.png',
  wapa: '33_page_of_wands.png',
  wakn: '34_knight_of_wands.png',
  waqu: '35_queen_of_wands.png',
  waki: '36_king_of_wands.png',
  cuac: '37_ace_of_cups.png',
  cu02: '38_two_of_cups.png',
  cu03: '39_three_of_cups.png',
  cu04: '40_four_of_cups.png',
  cu05: '41_five_of_cups.png',
  cu06: '42_six_of_cups.png',
  cu07: '43_seven_of_cups.png',
  cu08: '44_eight_of_cups.png',
  cu09: '45_nine_of_cups.png',
  cu10: '46_ten_of_cups.png',
  cupa: '47_page_of_cups.png',
  cukn: '48_knight_of_cups.png',
  cuqu: '49_queen_of_cups.png',
  cuki: '50_king_of_cups.png',
  swac: '51_ace_of_swords.png',
  sw02: '52_two_of_swords.png',
  sw03: '53_three_of_swords.png',
  sw04: '54_four_of_swords.png',
  sw05: '55_five_of_swords.png',
  sw06: '56_six_of_swords.png',
  sw07: '57_seven_of_swords.png',
  sw08: '58_eight_of_swords.png',
  sw09: '59_nine_of_swords.png',
  sw10: '60_ten_of_swords.png',
  swpa: '61_page_of_swords.png',
  swkn: '62_knight_of_swords.png',
  swqu: '63_queen_of_swords.png',
  swki: '64_king_of_swords.png',
  peac: '65_ace_of_pentacles.png',
  pe02: '66_two_of_pentacles.png',
  pe03: '67_three_of_pentacles.png',
  pe04: '68_four_of_pentacles.png',
  pe05: '69_five_of_pentacles.png',
  pe06: '70_six_of_pentacles.png',
  pe07: '71_seven_of_pentacles.png',
  pe08: '72_eight_of_pentacles.png',
  pe09: '73_nine_of_pentacles.png',
  pe10: '74_ten_of_pentacles.png',
  pepa: '75_page_of_pentacles.png',
  pekn: '76_knight_of_pentacles.png',
  pequ: '77_queen_of_pentacles.png',
  peki: '78_king_of_pentacles.png',
};

export function getTarotCardImagePath(cardId: string) {
  const safeCardId = normalizeTarotCardId(cardId);
  const imageFile = TAROT_CARD_IMAGE_FILES[safeCardId];

  if (imageFile) {
    return `${TAROT_CARD_IMAGE_DIRECTORY}/${imageFile}`;
  }

  return `${TAROT_CARD_IMAGE_DIRECTORY}/${safeCardId}.${TAROT_CARD_IMAGE_EXTENSION}`;
}

export function getTarotCardBackImagePath() {
  return `${TAROT_CARD_IMAGE_DIRECTORY}/${TAROT_CARD_BACK_IMAGE_FILE}`;
}

export function getTarotCardVisualTone(cardId: string) {
  return VISUAL_TONES[getTarotCardVisualFamily(cardId)];
}

function getTarotCardVisualFamily(cardId: string): TarotCardVisualFamily {
  const normalized = normalizeTarotCardId(cardId);

  if (normalized.startsWith('cu')) return 'cups';
  if (normalized.startsWith('pe')) return 'pentacles';
  if (normalized.startsWith('sw')) return 'swords';
  if (normalized.startsWith('wa')) return 'wands';

  return 'major';
}

function normalizeTarotCardId(cardId: string) {
  return cardId.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'unknown';
}
