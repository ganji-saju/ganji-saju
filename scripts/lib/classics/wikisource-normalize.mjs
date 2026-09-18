import crypto from 'node:crypto';

export const WIKISOURCE_API_URL = 'https://zh.wikisource.org/w/api.php';
export const WIKISOURCE_USER_AGENT =
  'saju-app-classics-ingest/0.1 (local corpus validation; https://github.com/kionya/saju-app)';

const DEFAULT_MAX_PASSAGE_CHARS = 900;
const CONCEPT_KEYWORDS = [
  { slug: 'yongsin', patterns: [/用神/u] },
  { slug: 'johhu', patterns: [/調候/u, /调候/u, /寒暖/u] },
  { slug: 'gyeokguk', patterns: [/格局/u, /月令/u] },
  { slug: 'gangyak', patterns: [/強弱/u, /强弱/u, /旺衰/u, /衰旺/u] },
  { slug: 'hapchung', patterns: [/合沖/u, /合冲/u, /刑沖/u, /刑冲/u, /沖合/u, /冲合/u] },
  { slug: 'gongmang', patterns: [/空亡/u] },
  { slug: 'sinsal', patterns: [/神煞/u, /驛馬/u, /驿马/u, /貴人/u, /贵人/u, /桃花/u] },
];

export const WIKISOURCE_WORKS = [
  {
    key: 'ditian-sui',
    // New normalization version preserves formatted verses and their commentary.
    // Keep the first import intact; never overwrite its passage/derived records.
    sourceWorkRef: 'title=滴天髓&normalizer=2',
    title: '滴天髓',
    rootTitle: '滴天髓',
    scriptType: 'trad',
    fetchMode: 'transclusions',
  },
  {
    key: 'qiongtong-baojian',
    sourceWorkRef: 'title=穷通宝鉴',
    title: '穷通宝鉴',
    rootTitle: '穷通宝鉴',
    scriptType: 'simp',
    fetchMode: 'single',
  },
  {
    key: 'sanming-tonghui-siku',
    sourceWorkRef: 'title=三命通會_(四庫全書本)',
    title: '三命通會 (四庫全書本)',
    rootTitle: '三命通會_(四庫全書本)',
    scriptType: 'trad',
    fetchMode: 'pages',
    pages: [
      '三命通會_(四庫全書本)',
      '三命通會_(四庫全書本)/卷01',
      '三命通會_(四庫全書本)/卷02',
      '三命通會_(四庫全書本)/卷03',
      '三命通會_(四庫全書本)/卷04',
      '三命通會_(四庫全書本)/卷05',
      '三命通會_(四庫全書本)/卷06',
      '三命通會_(四庫全書本)/卷07',
      '三命通會_(四庫全書本)/卷08',
      '三命通會_(四庫全書本)/卷09',
      '三命通會_(四庫全書本)/卷10',
      '三命通會_(四庫全書本)/卷11',
      '三命通會_(四庫全書本)/卷12',
    ],
  },
];

export function selectWikisourceWorks(selection) {
  if (!selection || selection === 'all') return WIKISOURCE_WORKS;

  const selectedKeys = new Set(selection.split(',').map((value) => value.trim()).filter(Boolean));
  const selectedWorks = WIKISOURCE_WORKS.filter((work) => selectedKeys.has(work.key));
  const unknownKeys = [...selectedKeys].filter(
    (key) => !WIKISOURCE_WORKS.some((work) => work.key === key)
  );

  if (unknownKeys.length > 0) {
    throw new Error(`Unknown classics work key: ${unknownKeys.join(', ')}`);
  }

  return selectedWorks;
}

export async function collectWikisourceWork(work, options = {}) {
  const maxPassageChars = options.maxPassageChars ?? DEFAULT_MAX_PASSAGE_CHARS;
  const rootPage = await fetchWikisourcePage(work.rootTitle);
  const pageRefs =
    work.fetchMode === 'single'
      ? [work.rootTitle]
      : work.fetchMode === 'pages'
        ? work.pages
        : extractTranscludedPageTitles(rootPage.wikitext);

  if (pageRefs.length === 0) {
    throw new Error(`No Wikisource pages discovered for ${work.title}`);
  }

  const fetchedPages = [];
  for (const pageTitle of pageRefs) {
    fetchedPages.push(await fetchWikisourcePage(pageTitle));
    if (options.requestDelayMs) {
      await delay(options.requestDelayMs);
    }
  }

  const records = normalizeWikisourcePages({
    work,
    pages: fetchedPages,
    maxPassageChars,
  });

  return {
    work,
    rootPage,
    pages: fetchedPages,
    sections: records.sections,
    passages: records.passages,
    warnings: records.warnings,
  };
}

export async function fetchWikisourcePage(pageTitle) {
  const url = new URL(WIKISOURCE_API_URL);
  url.search = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'wikitext|sections|revid',
    format: 'json',
    formatversion: '2',
    origin: '*',
  });

  const response = await fetch(url, {
    headers: {
      'User-Agent': WIKISOURCE_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Wikisource API request failed for ${pageTitle}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(
      `Wikisource API error for ${pageTitle}: ${payload.error.code} ${payload.error.info}`
    );
  }

  const parsed = payload.parse;
  const rawWikitext =
    typeof parsed?.wikitext === 'string' ? parsed.wikitext : parsed?.wikitext?.['*'];

  if (!parsed?.title || typeof rawWikitext !== 'string') {
    throw new Error(`Wikisource API response for ${pageTitle} did not include wikitext.`);
  }

  return {
    requestedTitle: pageTitle,
    title: parsed.title,
    pageId: parsed.pageid,
    revisionId: parsed.revid,
    sections: parsed.sections ?? [],
    wikitext: rawWikitext,
  };
}

export function normalizeWikisourcePages({ work, pages, maxPassageChars }) {
  const sections = [];
  const passages = [];
  const warnings = [];
  let sectionSortOrder = 0;

  for (const page of pages) {
    const pageSortKey = String(sectionSortOrder + 1).padStart(3, '0');
    const pageTitle = normalizePageTitle(page.title);
    const childPathOccurrences = new Map();
    const pageSection = {
      sectionKey: stableKey(`${work.key}:${page.requestedTitle}:page`),
      parentSectionKey: null,
      depth: 1,
      sortOrder: ++sectionSortOrder,
      sectionNo: pageSortKey,
      sectionTitleZh: pageTitle,
      sectionPath: pageTitle,
      sourceSectionRef: `${page.requestedTitle}#oldid=${page.revisionId}`,
    };
    sections.push(pageSection);

    const parsedSections = parseCleanedWikitextSections(page.wikitext, {
      fallbackTitle: pageTitle,
      maxPassageChars,
    });

    if (parsedSections.length === 0) {
      warnings.push(`No passage sections found for ${page.requestedTitle}`);
      continue;
    }

    for (const parsedSection of parsedSections) {
      const childTitle = parsedSection.title === pageTitle ? '본문' : parsedSection.title;
      const childPathBase = `${pageTitle} / ${childTitle}`;
      const occurrence = (childPathOccurrences.get(childPathBase) ?? 0) + 1;
      childPathOccurrences.set(childPathBase, occurrence);
      const childTitleWithOccurrence =
        occurrence > 1 ? `${childTitle} (${occurrence})` : childTitle;
      const childPath = `${pageTitle} / ${childTitleWithOccurrence}`;
      const childSection = {
        sectionKey: stableKey(`${work.key}:${page.requestedTitle}:${childPath}`),
        parentSectionKey: pageSection.sectionKey,
        depth: Math.max(2, parsedSection.depth + 1),
        sortOrder: ++sectionSortOrder,
        sectionNo: `${pageSortKey}.${String(parsedSection.sortOrder).padStart(3, '0')}`,
        sectionTitleZh: childTitleWithOccurrence,
        sectionPath: childPath,
        sourceSectionRef: `${page.requestedTitle}#${slugSourceRef(childTitle)}@oldid=${page.revisionId}`,
      };
      sections.push(childSection);

      let passageNo = 0;
      for (const passageText of parsedSection.passages) {
        passageNo += 1;
        passages.push({
          sectionKey: childSection.sectionKey,
          passageNo,
          originalTextZh: passageText,
          normalizedTextZh: normalizeChineseText(passageText),
          scriptType: work.scriptType,
          conceptSlugs: detectConceptSlugs(`${childTitleWithOccurrence} ${passageText}`),
          provenanceHash: hashProvenance({
            sourceWorkRef: work.sourceWorkRef,
            pageTitle: page.requestedTitle,
            revisionId: page.revisionId,
            sectionPath: childSection.sectionPath,
            passageNo,
            text: passageText,
          }),
          sourceLineRef: `${page.requestedTitle}:${childSection.sectionNo}:${passageNo}@oldid=${page.revisionId}`,
        });
      }
    }
  }

  assertUniqueRecords({ work, sections, passages });

  return { sections, passages, warnings };
}

function detectConceptSlugs(value) {
  return CONCEPT_KEYWORDS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(value))
  ).map(({ slug }) => slug);
}

export function extractTranscludedPageTitles(wikitext) {
  const titles = [];
  const seen = new Set();
  const pattern = /\{\{:\s*([^{}|]+?)\s*\}\}/g;

  for (const match of wikitext.matchAll(pattern)) {
    const title = match[1].trim();
    if (title && !seen.has(title)) {
      titles.push(title);
      seen.add(title);
    }
  }

  return titles;
}

export function parseCleanedWikitextSections(wikitext, options = {}) {
  const cleaned = cleanWikisourceWikitext(wikitext);
  const lines = cleaned.split(/\r?\n/);
  const sections = [];
  let current = {
    title: options.fallbackTitle ?? '본문',
    depth: 1,
    sortOrder: 1,
    lines: [],
  };

  function pushCurrent() {
    const passages = splitPassages(current.lines.join('\n'), options.maxPassageChars);
    if (passages.length === 0) return;

    sections.push({
      title: current.title,
      depth: current.depth,
      sortOrder: sections.length + 1,
      passages,
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^(={1,6})\s*(.*?)\s*\1$/);

    if (heading) {
      pushCurrent();
      current = {
        title: normalizeHeading(heading[2]),
        depth: heading[1].length,
        sortOrder: sections.length + 1,
        lines: [],
      };
      continue;
    }

    current.lines.push(rawLine);
  }

  pushCurrent();
  return sections;
}

export function cleanWikisourceWikitext(wikitext) {
  let text = wikitext.replace(/__(?:TOC|NOTOC|FORCETOC|NOEDITSECTION)__/g, '');

  text = text.replace(/<!--[\s\S]*?-->/g, '\n');
  text = text.replace(/<\s*\/?\s*(onlyinclude|poem|br|div|span|center|small)[^>]*>/gi, '\n');
  text = text.replace(/\{\{SK anchor\|([^{}|]+?)(?:\|[^{}]*)?\}\}/g, '\n==$1==\n');
  text = text.replace(/\{\{SK notes\|([^{}]+?)\}\}/g, '$1');
  text = text.replace(/\{\{YL\|([^{}|]+?)(?:\|[^{}]*)?\}\}/g, '$1');
  text = text.replace(/\{\{:\s*[^{}]+?\}\}/g, '\n');
  text = text.replace(/\{\{(?:header|Header|SKQS header|PD|DEFAULTSORT|authority control)[\s\S]*?\}\}/g, '\n');

  for (let i = 0; i < 6; i += 1) {
    text = text.replace(/\{\{([^{}]+?)\}\}/g, (_match, body) => {
      const [name, ...parts] = body.split('|').map((part) => part.trim());
      if (!name || name.startsWith('#')) return '';
      // Formatting templates contain source text, not metadata. Resolve the
      // innermost + first, then retain color's text argument (not its color).
      if (name === '+') return parts[0] ?? '';
      if (name.toLowerCase() === 'color') return parts[1] ?? '';
      if (['lang', 'lang-zh', 'zh', 'ruby'].includes(name)) return parts.at(-1) ?? '';
      return parts.length === 1 ? parts[0] : '';
    });
  }

  text = text.replace(/\[\[([^|\]]+?)\|([^\]]+?)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]+?)\]\]/g, '$1');
  text = text.replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, '$1');
  text = text.replace(/'''?/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

export function splitPassages(text, maxChars = DEFAULT_MAX_PASSAGE_CHARS) {
  const paragraphs = [];
  for (const block of text.split(/\n{2,}/)) {
    const paragraph = block.trim();
    if (!paragraph) continue;
    // Wikisource uses ':' for the commentary following a short verse. Keep
    // its conditions with that verse; the next unindented verse starts anew.
    if (paragraph.startsWith(':') && paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1] += `\n${paragraph}`;
    } else {
      paragraphs.push(paragraph);
    }
  }
  return paragraphs
    .flatMap((block) => splitLongPassage(block, maxChars))
    .map((passage) => passage.replace(/\s+/g, ' ').trim())
    .filter((passage) => passage.length >= 2)
    .filter((passage) => !/^(目錄|目录|上一卷|下一卷|返回|本頁|本页)$/.test(passage));
}

function splitLongPassage(block, maxChars) {
  const normalized = block
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[:;*#]+\s*/, ''))
    .filter(Boolean)
    .join(' ');

  if (normalized.length <= maxChars) return [normalized];

  const sentences = normalized
    .split(/(?<=[。！？；])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return chunkByLength(normalized, maxChars);

  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => (chunk.length > maxChars ? chunkByLength(chunk, maxChars) : [chunk]));
}

function chunkByLength(text, maxChars) {
  const chunks = [];
  for (let index = 0; index < text.length; index += maxChars) {
    chunks.push(text.slice(index, index + maxChars));
  }
  return chunks;
}

function normalizePageTitle(title) {
  return title.replace(/_/g, ' ').trim();
}

function normalizeHeading(value) {
  return value
    .replace(/\[\[([^|\]]+?)\|([^\]]+?)\]\]/g, '$2')
    .replace(/\[\[([^\]]+?)\]\]/g, '$1')
    .replace(/[{}]/g, '')
    .trim();
}

function normalizeChineseText(value) {
  return value.replace(/\s+/g, '').trim();
}

function hashProvenance(input) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function stableKey(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 24);
}

function slugSourceRef(value) {
  return encodeURIComponent(value.replace(/\s+/g, '_'));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertUniqueRecords({ work, sections, passages }) {
  assertUnique(
    sections.map((section) => section.sectionKey),
    `${work.key} section_key`
  );
  assertUnique(
    sections.map((section) => section.sectionPath),
    `${work.key} section_path`
  );
  assertUnique(
    passages.map((passage) => `${passage.sectionKey}:${passage.passageNo}`),
    `${work.key} section passage_no`
  );
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}
