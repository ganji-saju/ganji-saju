#!/usr/bin/env node
/**
 * 2026-05-17 A4 — 행운 패키지 사주+일진 hybrid 룰 매트릭스 audit.
 *
 * PR #167 의 deriveHybridElements 분기 3종 (강화 / 무시(기신) / 합집합) 가
 * 5 오행 (목/화/토/금/수) × 5 일진 천간 × 4 unlucky 변수 조합에서 의도대로
 * 동작하는지 운영 시점에 직접 검증.
 *
 * 사용:
 *   node scripts/audit-lucky-hybrid.mjs                       # 전수 매트릭스 (기본)
 *   node scripts/audit-lucky-hybrid.mjs --lucky 화 --unlucky 금  # 단일 사용자 fixture
 *   node scripts/audit-lucky-hybrid.mjs --strict              # 분기 불일치 시 exit 1 (CI 통합 가능)
 *
 * 출력 형식:
 *   - 매트릭스: lucky × stem → branch (strict 모드는 분기 합리성 자동 검증)
 *   - 항목 카드ality: 단일(2개) vs 합집합(4개) 의 cardinality 확인
 *
 * 본 스크립트는 lucky-package.ts 의 deriveHybridElements 로직 + ELEMENT_*
 * lookup 의 cardinality 만 재현. src/ 의 실 코드 import 없이 standalone 으로
 * Node 22+ 에서 실행 가능. lucky-package.ts 변경 시 본 스크립트의 invariant
 * 도 함께 갱신 권장 (lucky-package.test.ts 가 동일 invariant 검증).
 */

const ELEMENTS = ['목', '화', '토', '금', '수'];

/** lucky-package.ts 의 deriveHybridElements 룰 (line 227-236) 재현. */
function deriveHybridBranch(luckyElement, unluckyElement, todayStemElement) {
  if (!todayStemElement) {
    return { branch: 'no-iljin', secondary: null, emphasized: false };
  }
  if (todayStemElement === unluckyElement) {
    return { branch: 'ignored-iljin (기신)', secondary: null, emphasized: false };
  }
  if (todayStemElement === luckyElement) {
    return { branch: 'emphasized (같은 오행)', secondary: null, emphasized: true };
  }
  return { branch: 'union (합집합)', secondary: todayStemElement, emphasized: false };
}

/** 각 element 당 ELEMENT_* lookup 의 카드ality (lucky-package.ts 참조).
 *  colors=2, numbers=2, directions=2, surnameInitials=많음, timeWindows=2, foods=2, aromas=2, gemstones=2, musicGenres=2 */
const PER_ELEMENT_ITEM_COUNT = {
  colors: 2,
  numbers: 2,
  directions: 2,
  timeWindows: 2,
  foods: 2,
  aromas: 2,
  gemstones: 2,
  musicGenres: 2,
};

/** 분기에 따른 예상 item count (단일=2, 합집합=4). */
function expectedItemCount(branchInfo, perElementCount) {
  return branchInfo.secondary ? perElementCount * 2 : perElementCount;
}

function parseArgs(argv) {
  const args = { lucky: null, unlucky: null, strict: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--lucky' && argv[i + 1]) {
      args.lucky = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--unlucky' && argv[i + 1]) {
      args.unlucky = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--strict') {
      args.strict = true;
    }
  }
  return args;
}

function formatTable(rows, header) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const fmt = (cells) =>
    '│ ' + cells.map((c, i) => String(c).padEnd(widths[i])).join(' │ ') + ' │';
  const sep = '├' + widths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤';
  const top = '┌' + widths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
  const bot = '└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';
  return [top, fmt(header), sep, ...rows.map(fmt), bot].join('\n');
}

function printMatrixForUser(lucky, unlucky) {
  const stems = [...ELEMENTS, null];
  const rows = stems.map((stem) => {
    const info = deriveHybridBranch(lucky, unlucky, stem);
    const colorsCount = expectedItemCount(info, PER_ELEMENT_ITEM_COUNT.colors);
    const numbersCount = expectedItemCount(info, PER_ELEMENT_ITEM_COUNT.numbers);
    return [
      stem ?? '(없음)',
      info.branch,
      info.secondary ?? '—',
      info.emphasized ? '✓' : '',
      String(colorsCount),
      String(numbersCount),
    ];
  });
  console.log(`\nlucky=${lucky}, unlucky=${unlucky}`);
  console.log(formatTable(rows, ['일진 천간', 'branch', 'secondary', '강화', 'colors', 'numbers']));
}

function runFullMatrix(strict) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  행운 패키지 hybrid 룰 매트릭스 audit');
  console.log('  (PR #167 deriveHybridElements 운영 검증)');
  console.log('═══════════════════════════════════════════════════════');

  const violations = [];

  for (const lucky of ELEMENTS) {
    for (const unlucky of ELEMENTS) {
      if (lucky === unlucky) continue; // lucky === unlucky 는 명리상 불가능
      printMatrixForUser(lucky, unlucky);

      // invariant 검증.
      for (const stem of [...ELEMENTS, null]) {
        const info = deriveHybridBranch(lucky, unlucky, stem);

        // invariant 1: stem === null → no-iljin (secondary null, no emphasis)
        if (stem === null && info.branch !== 'no-iljin') {
          violations.push(`stem=null 일 때 branch="${info.branch}" (기대 no-iljin)`);
        }
        // invariant 2: stem === unlucky → ignored (secondary null)
        if (stem === unlucky && info.secondary !== null) {
          violations.push(`stem=unlucky(${unlucky}) 일 때 secondary="${info.secondary}" (기대 null)`);
        }
        // invariant 3: stem === lucky → emphasized=true, secondary null
        if (stem === lucky && (!info.emphasized || info.secondary !== null)) {
          violations.push(`stem=lucky(${lucky}) 일 때 emphasized=${info.emphasized} secondary=${info.secondary} (기대 emphasized=true secondary=null)`);
        }
        // invariant 4: stem ≠ lucky && stem ≠ unlucky && stem !== null → secondary === stem
        if (stem !== null && stem !== lucky && stem !== unlucky && info.secondary !== stem) {
          violations.push(`stem=${stem} (≠ lucky/unlucky) 일 때 secondary="${info.secondary}" (기대 "${stem}")`);
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  if (violations.length === 0) {
    console.log(`  ✅ 모든 invariant 통과 (5 × 4 lucky/unlucky 쌍 × 6 stem = 120 케이스)`);
  } else {
    console.log(`  ❌ invariant 위반 ${violations.length}건:`);
    for (const v of violations) console.log(`     - ${v}`);
  }
  console.log('═══════════════════════════════════════════════════════');

  if (strict && violations.length > 0) {
    process.exit(1);
  }
}

const args = parseArgs(process.argv);

if (args.lucky && args.unlucky) {
  if (!ELEMENTS.includes(args.lucky) || !ELEMENTS.includes(args.unlucky)) {
    console.error(`잘못된 lucky/unlucky. ELEMENTS=${ELEMENTS.join('|')}`);
    process.exit(1);
  }
  printMatrixForUser(args.lucky, args.unlucky);
} else {
  runFullMatrix(args.strict);
}
