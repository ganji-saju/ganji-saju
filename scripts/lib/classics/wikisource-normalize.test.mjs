import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanWikisourceWikitext, normalizeWikisourcePages, splitPassages, WIKISOURCE_WORKS } from './wikisource-normalize.mjs';

// Source excerpt: 滴天髓/06, Wikisource revision 844363. Formatting is part of
// the regression: the old normalizer discarded every color-wrapped verse.
const wikitext = `{{Novel|滴天髓|格局論|05|07|論}}__TOC__<onlyinclude>
{{color|red|{{+|財官印綬分偏正，兼論食傷格局定。}}}}

:　　自形象方局之外而格為最，格之真者，月支之神，透於天干也。

{{color|red|{{+|官煞相混來問我，有可有不可。}}}}

:　　煞，即官也。同流同止，可混也。官非煞也，各立門庭，不可混也。

{{color|red|{{+|傷官見官果難辨，可見不可見。}}}}

:　　身弱而傷官旺者，見印而可見官，官以生印，印以扶身也。
:　　身旺而傷官旺者，見財而可見官，以財生官，且以財洩傷也。
</onlyinclude>
{{Novel-f|05|07|論}}{{明朝作品}}`;

test('nested color and + preserve classical verses without metadata or magic words', () => {
  const cleaned = cleanWikisourceWikitext(wikitext);
  assert.match(cleaned, /財官印綬分偏正，兼論食傷格局定。/);
  assert.match(cleaned, /官煞相混來問我，有可有不可。/);
  assert.match(cleaned, /傷官見官果難辨，可見不可見。/);
  assert.doesNotMatch(cleaned, /red|Novel|__TOC__|明朝作品|\{\{/);
  assert.equal(cleanWikisourceWikitext('{{color|red|文字}} __NOTOC__'), '文字');
});

test('retrieved verses retain their indented interpretive conditions, separate from the next verse', () => {
  const work = WIKISOURCE_WORKS.find((item) => item.key === 'ditian-sui');
  assert.equal(work.sourceWorkRef, 'title=滴天髓&normalizer=2');
  const page = { title: '滴天髓/06', requestedTitle: '滴天髓/06', revisionId: 844363, wikitext };
  const normalized = normalizeWikisourcePages({ work, pages: [page], maxPassageChars: 900 });
  assert.equal(normalized.passages.length, 3);
  const texts = normalized.passages.map((passage) => passage.originalTextZh);
  assert.match(texts[0], /^財官印綬.*月支之神，透於天干/);
  assert.match(texts[1], /^官煞相混.*各立門庭，不可混/);
  assert.match(texts[2], /^傷官見官.*身弱.*見印.*身旺.*見財/);
  assert.doesNotMatch(texts[0], /官煞相混|傷官見官/);
  assert.ok(normalized.passages.every((passage) => passage.sourceLineRef.includes('@oldid=844363') && passage.provenanceHash));
  assert.deepEqual(normalized, normalizeWikisourcePages({ work, pages: [page], maxPassageChars: 900 }));
  const previous = normalizeWikisourcePages({
    work: { ...work, sourceWorkRef: 'title=滴天髓' }, pages: [page], maxPassageChars: 900,
  });
  assert.notEqual(normalized.passages[0].provenanceHash, previous.passages[0].provenanceHash);
});

test('joining indented context preserves text order and the existing passage size limit', () => {
  const text = '原文。\n\n:第一段解釋。\n\n:第二段解釋。\n\n下一則原文。\n\n:另一段解釋。';
  const passages = splitPassages(text, 12);
  assert.ok(passages.every((passage) => passage.length <= 12));
  assert.equal(passages.join('').replace(/\s/g, ''), text.replace(/[\s:]/g, ''));
});
