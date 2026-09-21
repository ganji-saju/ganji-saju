import type { LifetimePdfYear } from './lifetime-pdf-timeline';

export interface PdfNarrativeSection {
  label: string;
  text: string;
  chapter?: string;
}

/** Keep every character while bounding the amount of prose on one A4 page. */
export function paginatePdfNarrative(sections: PdfNarrativeSection[]): PdfNarrativeSection[][] {
  const pages: PdfNarrativeSection[][] = [];
  let page: PdfNarrativeSection[] = [];
  let weight = 0;
  for (const section of sections) {
    if (page.length && section.chapter !== page[0].chapter) {
      pages.push(page);
      page = [];
      weight = 0;
    }
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
      const item = { ...section, label: `${section.label}${continuation ? ' · 계속' : ''}`, text };
      const itemWeight = text.length + 160;
      if (page.length && (weight + itemWeight > 1600 || page.length >= (section.chapter ? 4 : 3))) {
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

type AnnualText = Pick<LifetimePdfYear, 'overview' | 'learningCareer' | 'relationships' | 'resources' | 'wellbeing' | 'action'>;

function annualHeight(year: AnnualText): number {
  const fields = [year.overview, year.learningCareer, year.relationships, year.resources, year.wellbeing, `이 해의 실천 ${year.action}`];
  // ponytail: calibrated for controlled Korean A4 copy; recalibrate in the PDF layout check when fonts or styles change.
  return 144 + fields.reduce((height, text, index) => {
    const wide = index === 0 || index === 5;
    const lines = text.split('\n').reduce((sum, paragraph) => {
      const width = Array.from(paragraph).reduce((units, char) => units + (/\s/.test(char) ? 0.29 : /[ -~]/.test(char) ? 0.55 : 1), 0);
      return sum + Math.max(1, Math.ceil(width / (wide ? 66 : 59)));
    }, 0);
    return height + lines * (index === 0 ? 21.6 : index === 5 ? 20.7 : 21);
  }, 0);
}

export function chunkPdfYears<T extends AnnualText>(years: T[]): T[][] {
  const pages: T[][] = [];
  for (const year of years) {
    const previous = pages.at(-1);
    if (previous?.length === 1 && annualHeight(previous[0]) + annualHeight(year) <= 900) previous.push(year);
    else pages.push([year]);
  }
  return pages;
}
