export interface PdfNarrativeSection {
  label: string;
  text: string;
}

/** Keep every character while bounding the amount of prose on one A4 page. */
export function paginatePdfNarrative(sections: PdfNarrativeSection[]): PdfNarrativeSection[][] {
  const pages: PdfNarrativeSection[][] = [];
  let page: PdfNarrativeSection[] = [];
  let weight = 0;
  for (const section of sections) {
    let remaining = section.text.trim();
    let continuation = false;
    while (remaining) {
      // Split even punctuation-free model output; never truncate paid content.
      let end = Math.min(remaining.length, 1100);
      if (end < remaining.length) {
        const boundary = remaining.slice(0, end).lastIndexOf(' ');
        if (boundary > 700) end = boundary;
      }
      const text = remaining.slice(0, end).trim();
      const item = { label: `${section.label}${continuation ? ' · 계속' : ''}`, text };
      const itemWeight = text.length + 160;
      if (page.length && (weight + itemWeight > 1600 || page.length >= 3)) {
        pages.push(page);
        page = [];
        weight = 0;
      }
      page.push(item);
      weight += itemWeight;
      remaining = remaining.slice(end).trimStart();
      continuation = true;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

export function chunkPdfYears<T>(years: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < years.length; i += 2) pages.push(years.slice(i, i + 2));
  return pages;
}
