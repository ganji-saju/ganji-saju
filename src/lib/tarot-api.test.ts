import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  getTarotDeck,
  getTarotPickerDeck,
  getTarotReadingForQuestion,
  getTarotSpreadForQuestion,
  type TarotApiCard,
} from './tarot-api';
import {
  getTarotCardBackImagePath,
  getTarotCardImagePath,
  getTarotCardVisualTone,
} from './tarot-card-assets';
import { createRandomTarotDrawDeck, pickRandomTarotCard } from './tarot-picker-random';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const originalFetch = globalThis.fetch;

function buildApiCard(index: number): TarotApiCard {
  return {
    type: 'major',
    name_short: `m${index}`,
    name: index === 0 ? 'The Fool' : `Card ${index}`,
    value: String(index),
    value_int: index,
    meaning_up: `upright meaning ${index}`,
    meaning_rev: `reversed meaning ${index}`,
    desc: `description ${index}`,
  };
}

function mockFetch(handler: typeof fetch) {
  globalThis.fetch = handler;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

test('tarot deck uses the external API when it returns 78 normalized cards', async () => {
  const cards = Array.from({ length: 78 }, (_, index) => buildApiCard(index));

  mockFetch(
    (async () =>
      ({
        ok: true,
        json: async () => ({ cards }),
      }) as Response) as typeof fetch
  );

  try {
    const deck = await getTarotDeck();

    assert.equal(deck.source, 'api');
    assert.equal(deck.cards.length, 78);
    assert.equal(deck.cards[0]?.name, 'The Fool');
  } finally {
    restoreFetch();
  }
});

test('tarot deck falls back to the local 78-card deck when the external API fails', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const deck = await getTarotDeck();

    assert.equal(deck.source, 'local');
    assert.equal(deck.cards.length, 78);
  } finally {
    restoreFetch();
  }
});

test('tarot deck falls back when the external API returns the wrong card count', async () => {
  mockFetch(
    (async () =>
      ({
        ok: true,
        json: async () => ({ cards: [buildApiCard(0)] }),
      }) as Response) as typeof fetch
  );

  try {
    const deck = await getTarotDeck();

    assert.equal(deck.source, 'local');
    assert.equal(deck.cards.length, 78);
  } finally {
    restoreFetch();
  }
});

test('tarot API fetch uses a timeout signal when the runtime supports it', async () => {
  let receivedSignal: AbortSignal | null = null;
  const cards = Array.from({ length: 78 }, (_, index) => buildApiCard(index));

  mockFetch(
    (async (_input, init) => {
      receivedSignal = init?.signal instanceof AbortSignal ? init.signal : null;

      return {
        ok: true,
        json: async () => ({ cards }),
      } as Response;
    }) as typeof fetch
  );

  try {
    await getTarotDeck();

    assert.ok(receivedSignal);
  } finally {
    restoreFetch();
  }
});

test('tarot reading stays stable for the same question on the same day', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const first = await getTarotReadingForQuestion({
      question: '지금 결정해야 할 선택에 대하여',
    });
    const second = await getTarotReadingForQuestion({
      question: '지금 결정해야 할 선택에 대하여',
    });

    assert.equal(first.card.name_short, second.card.name_short);
    assert.equal(first.orientation, second.orientation);
  } finally {
    restoreFetch();
  }
});

test('tarot reading adapts the answer and psychology to the asked question', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const reading = await getTarotReadingForQuestion({
      question: '그 사람 마음이 아직 남아 있을까요?',
      cardId: 'cu02',
      orientation: 'upright',
    });

    assert.equal(reading.tone, 'relationship');
    assert.match(reading.answer, /마음|감정|상태/);
    assert.match(reading.questionInsight, /질문/);
    assert.match(reading.psychologyLabel, /심리/);
    assert.match(reading.psychology, /상대/);
  } finally {
    restoreFetch();
  }
});

test('tarot selected cards produce card-specific visible messages', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const cups = await getTarotReadingForQuestion({
      question: '오늘 하루 어떤 메시지가 있을까',
      cardId: 'cu02',
      orientation: 'upright',
    });
    const swords = await getTarotReadingForQuestion({
      question: '오늘 하루 어떤 메시지가 있을까',
      cardId: 'sw03',
      orientation: 'upright',
    });

    assert.notEqual(cups.answer, swords.answer);
    assert.notEqual(cups.action, swords.action);
    assert.match(cups.answer, /컵|감정|관계/);
    assert.match(swords.answer, /소드|생각|판단|말/);
  } finally {
    restoreFetch();
  }
});

test('tarot spread positions change to match the relationship question intent', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const spread = await getTarotSpreadForQuestion('그 사람 마음이 아직 남아 있을까요?');

    assert.deepEqual(
      spread.map(({ position }) => position),
      ['겉으로 보이는 마음', '속으로 남은 감정', '관계를 움직일 한 수']
    );
  } finally {
    restoreFetch();
  }
});

test('tarot picker exposes a stable full deck for direct card selection', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const first = await getTarotPickerDeck('지금 결정해야 할 선택에 대하여');
    const second = await getTarotPickerDeck('지금 결정해야 할 선택에 대하여');

    assert.equal(first.cards.length, 78);
    assert.equal(new Set(first.cards.map(({ card }) => card.name_short)).size, 78);
    assert.deepEqual(
      first.cards.map(({ card, orientation }) => `${card.name_short}:${orientation}`),
      second.cards.map(({ card, orientation }) => `${card.name_short}:${orientation}`)
    );
    assert.ok(
      first.cards.every(
        ({ orientation }) => orientation === 'upright' || orientation === 'reversed'
      )
    );
  } finally {
    restoreFetch();
  }
});

test('tarot client picker can randomize card order and orientations', () => {
  const cards = ['ar00', 'ma01', 'cu02', 'sw03'].map((cardId) => ({ cardId }));
  const randomized = createRandomTarotDrawDeck(cards, () => 0);

  assert.deepEqual(
    randomized.map(({ slot }) => slot),
    [1, 2, 3, 4]
  );
  assert.equal(new Set(randomized.map(({ cardId }) => cardId)).size, 4);
  assert.ok(randomized.every(({ orientation }) => orientation === 'reversed'));
  assert.ok(randomized.every(({ backTone }) => backTone === 'plum'));
  assert.ok(randomized.every(({ tilt }) => tilt === -4));
  assert.ok(randomized.every(({ lift }) => lift === -3));
  assert.notDeepEqual(
    randomized.map(({ cardId }) => cardId),
    cards.map(({ cardId }) => cardId)
  );
});

test('tarot random draw picks one card from the visible deck', () => {
  const deck = createRandomTarotDrawDeck(
    ['ar00', 'ma01', 'cu02'].map((cardId) => ({ cardId })),
    () => 0
  );
  const picked = pickRandomTarotCard(deck, () => 1);

  assert.equal(picked?.cardId, deck[1]?.cardId);
});

test('tarot card asset helpers map card IDs to public image paths and tones', () => {
  assert.equal(getTarotCardBackImagePath(), '/images/tarot/cards/00_back.png');
  assert.equal(getTarotCardImagePath('ar00'), '/images/tarot/cards/01_the_fool.png');
  assert.equal(getTarotCardImagePath('SW07'), '/images/tarot/cards/57_seven_of_swords.png');
  assert.equal(getTarotCardVisualTone('ar00').family, 'major');
  assert.equal(getTarotCardVisualTone('cu09').family, 'cups');
  assert.equal(getTarotCardVisualTone('pe10').family, 'pentacles');
  assert.equal(getTarotCardVisualTone('sw07').family, 'swords');
  assert.equal(getTarotCardVisualTone('wa04').family, 'wands');
});

test('local tarot deck cards all resolve to an existing image file', async () => {
  mockFetch(
    (async () => {
      throw new Error('network unavailable');
    }) as typeof fetch
  );

  try {
    const deck = await getTarotDeck();

    assert.equal(deck.cards.length, 78);
    assert.ok(
      deck.cards.every((card) => {
        const publicPath = getTarotCardImagePath(card.name_short);
        return existsSync(`${process.cwd()}/public${publicPath}`);
      })
    );
  } finally {
    restoreFetch();
  }
});

// A1 회귀 — 22장 메이저 아르카나 전부 한글 표시명을 가져야 한다(은둔자 룩업 누락 방지).
// 누락 시 영문명("The Hermit")이 그대로 사용자에게 노출됐었다.
test('every major arcana card renders a Korean display name (no English leak)', async () => {
  mockFetch((async () => {
    throw new Error('network unavailable');
  }) as typeof fetch);

  try {
    const deck = await getTarotDeck();
    const majors = deck.cards.filter((card) => card.type === 'major');
    assert.equal(majors.length, 22);

    for (const card of majors) {
      const reading = await getTarotReadingForQuestion({
        question: '오늘 하루 어떤 메시지가 있을까',
        cardId: card.name_short,
        orientation: 'upright',
      });
      // displayName 은 "한글명 · English" 병기. 룩업 누락 시엔 한글 없이 bare 영문명만
      // 나오므로(예: 'The Hermit'), 반드시 한글 음절로 시작해야 한다.
      assert.match(
        reading.displayName,
        /^[가-힣]/,
        `major ${card.name_short} (${card.name}) has no Korean name (lookup missing): ${reading.displayName}`
      );
    }
  } finally {
    restoreFetch();
  }
});

// A3 회귀 — 역방향이 모든 카드를 하나의 흐름으로 뭉개지 않아야 한다.
// (이전: 역방향이면 무조건 'blocked' → reversed Sun == reversed Tower)
test('reversed readings differ by card (not collapsed to one flow)', async () => {
  mockFetch((async () => {
    throw new Error('network unavailable');
  }) as typeof fetch);

  try {
    const question = '지금 이 상황은 어떤 흐름일까';
    const sun = await getTarotReadingForQuestion({
      question,
      cardId: 'ar19',
      orientation: 'reversed',
    });
    const tower = await getTarotReadingForQuestion({
      question,
      cardId: 'ar16',
      orientation: 'reversed',
    });

    assert.notEqual(
      sun.answer,
      tower.answer,
      'reversed Sun and reversed Tower must not produce identical answers'
    );
  } finally {
    restoreFetch();
  }
});

// B1 안전 게이트 — 생성되는 풀이 출력 어디에도 예측 적중·의료·재정·단정·doom 어휘가
// 없어야 한다(entertainment 방패·의료광고법 정합·정직성). 카드명 상수의 오탐을 피하려
// 소스가 아니라 실제 사용자 노출 필드를 검사한다.
test('generated tarot readings never emit overclaim / medical / doom copy', async () => {
  mockFetch((async () => {
    throw new Error('network unavailable');
  }) as typeof fetch);

  const FORBIDDEN = [
    /반드시/, /무조건/, /틀림없이/, /100\s*%/, /적중/, /예언/,
    /완치/, /불치/, /시한부/, /진단받/,
    /주식/, /종목/, /코인\s*(사|투자)/,
    /죽음/, /파멸/, /망한다/, /끝장/,
  ];
  const QUESTIONS = [
    '오늘 하루 어떤 메시지가 있을까',
    '그 사람 마음은 어떤가요',
    '이직을 결정해도 될까요',
    '지금 고민 중인 관계에 대하여',
    '돈 문제가 잘 풀릴까요',
  ];

  try {
    const deck = await getTarotDeck();
    const findings: string[] = [];

    for (const question of QUESTIONS) {
      for (const card of deck.cards) {
        for (const orientation of ['upright', 'reversed'] as const) {
          const reading = await getTarotReadingForQuestion({
            question,
            cardId: card.name_short,
            orientation,
          });
          const surface = [
            reading.answer,
            reading.action,
            reading.guidance,
            reading.sajuBlend,
            reading.psychology,
            reading.questionInsight,
          ].join(' ');

          for (const pattern of FORBIDDEN) {
            if (pattern.test(surface)) {
              findings.push(
                `${card.name_short}/${orientation} "${question}": ${pattern}`
              );
            }
          }
        }
      }
    }

    assert.deepEqual(findings, [], `overclaim/unsafe copy found: ${findings.slice(0, 5).join(' | ')}`);
  } finally {
    restoreFetch();
  }
});
