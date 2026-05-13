import { Solar } from 'lunar-typescript';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { BirthInput } from '@/lib/saju/types';

export const KASI_LUN_CAL_INFO_ENDPOINT =
  'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getLunCalInfo';

export interface KasiComparisonSample {
  id: string;
  label: string;
  reason: string;
  input: BirthInput;
  compare: {
    lunarDate: boolean;
    dayPillar: boolean;
  };
}

export interface KasiLunCalInfo {
  solYear: number;
  solMonth: number;
  solDay: number;
  lunYear: number;
  lunMonth: number;
  lunDay: number;
  lunLeapmonth: '평' | '윤' | string;
  lunSecha: string | null;
  lunWolgeon: string | null;
  lunIljin: string | null;
  solWeek: string | null;
  solJd: number | null;
}

export interface LocalCalendarComparable {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  lunarLeapMonth: boolean;
  dayPillar: string;
}

export interface KasiComparisonIssue {
  sampleId: string;
  field: 'lunarYear' | 'lunarMonth' | 'lunarDay' | 'lunarLeapMonth' | 'dayPillar';
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
  severity: 'error' | 'warning';
}

export interface KasiSingleInputComparison {
  kasi: KasiLunCalInfo;
  local: LocalCalendarComparable;
  issues: KasiComparisonIssue[];
}

export const KASI_COMPARISON_SAMPLES: KasiComparisonSample[] = [
  {
    id: 'regular-docs-era',
    label: '일반 양력일',
    reason: '기본 양력 → 음력 변환과 일진 대조가 흔들리지 않는지 보는 기준 샘플입니다.',
    input: { year: 2015, month: 9, day: 22, hour: 12, minute: 0 },
    compare: { lunarDate: true, dayPillar: true },
  },
  {
    id: 'solar-leap-day',
    label: '양력 윤일',
    reason: '2월 29일이 포함된 해에서 양력 날짜 처리와 일진 계산을 함께 확인합니다.',
    input: { year: 2024, month: 2, day: 29, hour: 12, minute: 0 },
    compare: { lunarDate: true, dayPillar: true },
  },
  {
    id: 'lunar-new-year-boundary',
    label: '설날 경계',
    reason: '음력 해가 바뀌는 대표 경계일에서 음력 날짜와 일진을 대조합니다.',
    input: { year: 2024, month: 2, day: 10, hour: 12, minute: 0 },
    compare: { lunarDate: true, dayPillar: true },
  },
  {
    id: 'lunar-leap-month-start',
    label: '윤달 시작권',
    reason: '2023년 윤2월 시작권 샘플로 평달/윤달 판정 차이를 잡습니다.',
    input: { year: 2023, month: 3, day: 22, hour: 12, minute: 0 },
    compare: { lunarDate: true, dayPillar: true },
  },
  {
    id: 'ipchun-adjacent-before',
    label: '입춘 인접 전날',
    reason: '월주/년주 절입 경계와 별개로, 민간력 일진과 음력일이 안정적인지 확인합니다.',
    input: { year: 2024, month: 2, day: 3, hour: 12, minute: 0 },
    compare: { lunarDate: true, dayPillar: true },
  },
  {
    id: 'jasi-boundary-reference',
    label: '자시 경계 참고',
    reason: 'KASI 음양력 API는 날짜 단위라 자시 시각 보정 검증에는 쓰지 않고 음력일만 확인합니다.',
    input: { year: 1982, month: 1, day: 29, hour: 23, minute: 30, jasiMethod: 'split' },
    compare: { lunarDate: true, dayPillar: false },
  },
];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = Number(readString(record, key));
  return Number.isFinite(value) ? value : null;
}

function decodeXmlText(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function readXmlTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
  return match?.[1] ? decodeXmlText(match[1].trim()) : '';
}

function extractGanzi(value: string | null) {
  if (!value) return null;
  const paren = value.match(/\(([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\)/);
  if (paren?.[1]) return paren[1];
  const direct = value.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/);
  return direct?.[0] ?? null;
}

function normalizeKasiItem(item: Record<string, unknown>): KasiLunCalInfo {
  const solYear = readNumber(item, 'solYear');
  const solMonth = readNumber(item, 'solMonth');
  const solDay = readNumber(item, 'solDay');
  const lunYear = readNumber(item, 'lunYear');
  const lunMonth = readNumber(item, 'lunMonth');
  const lunDay = readNumber(item, 'lunDay');

  if (!solYear || !solMonth || !solDay || !lunYear || !lunMonth || !lunDay) {
    throw new Error('KASI 음양력 응답에서 필수 날짜 필드를 찾지 못했습니다.');
  }

  return {
    solYear,
    solMonth,
    solDay,
    lunYear,
    lunMonth,
    lunDay,
    lunLeapmonth: readString(item, 'lunLeapmonth') || '평',
    lunSecha: readString(item, 'lunSecha') || null,
    lunWolgeon: readString(item, 'lunWolgeon') || null,
    lunIljin: readString(item, 'lunIljin') || null,
    solWeek: readString(item, 'solWeek') || null,
    solJd: readNumber(item, 'solJd'),
  };
}

function parseKasiJson(payload: unknown): KasiLunCalInfo {
  const root = asRecord(payload);
  const response = asRecord(root?.response);
  const header = asRecord(response?.header);
  const resultCode = header ? readString(header, 'resultCode') : '';

  if (resultCode && resultCode !== '00') {
    throw new Error(`KASI 음양력 API 오류: ${resultCode} ${readString(header ?? {}, 'resultMsg')}`);
  }

  const body = asRecord(response?.body);
  const items = asRecord(body?.items);
  const itemValue = items?.item;
  const item = Array.isArray(itemValue) ? asRecord(itemValue[0]) : asRecord(itemValue);

  if (!item) {
    throw new Error('KASI 음양력 응답에서 item을 찾지 못했습니다.');
  }

  return normalizeKasiItem(item);
}

function parseKasiXml(xml: string): KasiLunCalInfo {
  const resultCode = readXmlTag(xml, 'resultCode');
  if (resultCode && resultCode !== '00') {
    throw new Error(`KASI 음양력 API 오류: ${resultCode} ${readXmlTag(xml, 'resultMsg')}`);
  }

  return normalizeKasiItem({
    solYear: readXmlTag(xml, 'solYear'),
    solMonth: readXmlTag(xml, 'solMonth'),
    solDay: readXmlTag(xml, 'solDay'),
    lunYear: readXmlTag(xml, 'lunYear'),
    lunMonth: readXmlTag(xml, 'lunMonth'),
    lunDay: readXmlTag(xml, 'lunDay'),
    lunLeapmonth: readXmlTag(xml, 'lunLeapmonth'),
    lunSecha: readXmlTag(xml, 'lunSecha'),
    lunWolgeon: readXmlTag(xml, 'lunWolgeon'),
    lunIljin: readXmlTag(xml, 'lunIljin'),
    solWeek: readXmlTag(xml, 'solWeek'),
    solJd: readXmlTag(xml, 'solJd'),
  });
}

export function parseKasiLunCalInfoResponse(text: string): KasiLunCalInfo {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('KASI 음양력 API 응답이 비어 있습니다.');

  if (trimmed.startsWith('{')) {
    return parseKasiJson(JSON.parse(trimmed));
  }

  return parseKasiXml(trimmed);
}

export function buildKasiLunCalInfoUrl(
  input: Pick<BirthInput, 'year' | 'month' | 'day'>,
  serviceKey: string,
  endpoint = KASI_LUN_CAL_INFO_ENDPOINT
) {
  const url = new URL(endpoint);
  url.searchParams.set('ServiceKey', serviceKey);
  url.searchParams.set('solYear', String(input.year));
  url.searchParams.set('solMonth', pad2(input.month));
  url.searchParams.set('solDay', pad2(input.day));
  url.searchParams.set('_type', 'json');
  return url;
}

export async function fetchKasiLunCalInfo(
  input: Pick<BirthInput, 'year' | 'month' | 'day'>,
  serviceKey: string,
  fetcher: typeof fetch = fetch
) {
  const response = await fetcher(buildKasiLunCalInfoUrl(input, serviceKey), {
    headers: { accept: 'application/json, application/xml;q=0.9, text/xml;q=0.8' },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`KASI 음양력 API HTTP 오류: ${response.status} ${text.slice(0, 160)}`);
  }

  return parseKasiLunCalInfoResponse(text);
}

export function buildLocalCalendarComparable(input: BirthInput): LocalCalendarComparable {
  const hour = input.unknownTime || input.hour === undefined ? 12 : input.hour;
  const minute = input.unknownTime || input.minute === undefined ? 0 : input.minute;
  const lunar = Solar.fromYmdHms(input.year, input.month, input.day, hour, minute, 0).getLunar();
  const lunarMonth = lunar.getMonth();
  const data = normalizeToSajuDataV1(input, null);

  return {
    lunarYear: lunar.getYear(),
    lunarMonth: Math.abs(lunarMonth),
    lunarDay: lunar.getDay(),
    lunarLeapMonth: lunarMonth < 0,
    dayPillar: data.pillars.day.ganzi,
  };
}

export function compareKasiWithLocalSample(
  sample: KasiComparisonSample,
  kasi: KasiLunCalInfo
): KasiComparisonIssue[] {
  const local = buildLocalCalendarComparable(sample.input);
  const issues: KasiComparisonIssue[] = [];

  const pushIssue = (
    field: KasiComparisonIssue['field'],
    expected: KasiComparisonIssue['expected'],
    actual: KasiComparisonIssue['actual'],
    severity: KasiComparisonIssue['severity'] = 'error'
  ) => {
    if (expected === actual) return;
    issues.push({ sampleId: sample.id, field, expected, actual, severity });
  };

  if (sample.compare.lunarDate) {
    pushIssue('lunarYear', kasi.lunYear, local.lunarYear);
    pushIssue('lunarMonth', kasi.lunMonth, local.lunarMonth);
    pushIssue('lunarDay', kasi.lunDay, local.lunarDay);
    pushIssue('lunarLeapMonth', kasi.lunLeapmonth === '윤', local.lunarLeapMonth);
  }

  if (sample.compare.dayPillar) {
    pushIssue('dayPillar', extractGanzi(kasi.lunIljin), local.dayPillar);
  }

  return issues;
}

export async function runKasiCalendarValidation(
  serviceKey: string,
  samples: KasiComparisonSample[] = KASI_COMPARISON_SAMPLES
) {
  const results = [];

  for (const sample of samples) {
    const kasi = await fetchKasiLunCalInfo(sample.input, serviceKey);
    results.push({
      sample,
      kasi,
      local: buildLocalCalendarComparable(sample.input),
      issues: compareKasiWithLocalSample(sample, kasi),
    });
  }

  return results;
}

export async function compareBirthInputWithKasi(
  input: BirthInput,
  serviceKey: string,
  fetcher: typeof fetch = fetch
): Promise<KasiSingleInputComparison> {
  const kasi = await fetchKasiLunCalInfo(input, serviceKey, fetcher);
  const local = buildLocalCalendarComparable(input);
  const pseudoSample: KasiComparisonSample = {
    id: 'live-reading',
    label: '실시간 사주 입력',
    reason: '사용자가 실제로 본 명식의 음양력/일진 대조용입니다.',
    input,
    compare: {
      lunarDate: true,
      dayPillar: true,
    },
  };

  return {
    kasi,
    local,
    issues: compareKasiWithLocalSample(pseudoSample, kasi),
  };
}
