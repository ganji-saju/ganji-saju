// 2026-05-14: 사주 검증 도구 — 입력값과 계산 결과를 한 페이지에서 보고,
// 사이트에 노출되는 풀이 원문을 붙여 비교할 수 있게 한다.
// 운영 노출 차단: robots noindex + 검색엔진 미수집.
import type { Metadata } from 'next';
import { calculateSajuDataV1, upgradeSajuDataV1ToV2 } from '@/domain/saju/engine';
import type { BirthInput, JasiMethod, SolarTimeMode } from '@/lib/saju/types';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { SajuVerifyComparePanel } from './compare-panel';

export const metadata: Metadata = {
  title: '사주 검증 도구',
  description: '계산값 vs 화면 풀이 비교 검증 도구 (운영 노출 안 함).',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
    day?: string;
    hour?: string;
    minute?: string;
    gender?: string;
    jasi?: string;
    solar?: string;
    location?: string;
    now?: string;
  }>;
}

function parseSearchParams(params: Awaited<PageProps['searchParams']>) {
  const year = Number(params.year);
  const month = Number(params.month);
  const day = Number(params.day);
  const hourRaw = params.hour?.trim();
  const minuteRaw = params.minute?.trim();
  const hour = hourRaw ? Number(hourRaw) : undefined;
  const minute = minuteRaw ? Number(minuteRaw) : undefined;
  const gender =
    params.gender === 'male' || params.gender === 'female' ? params.gender : undefined;
  const jasi: JasiMethod | undefined =
    params.jasi === 'split' || params.jasi === 'unified' ? params.jasi : undefined;
  const solar: SolarTimeMode | undefined =
    params.solar === 'standard' || params.solar === 'longitude' ? params.solar : undefined;
  const location = params.location?.trim() || undefined;
  const now = params.now?.trim() || undefined;

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const input: BirthInput = {
    year,
    month,
    day,
    hour: hour !== undefined && Number.isFinite(hour) ? hour : undefined,
    minute: minute !== undefined && Number.isFinite(minute) ? minute : undefined,
    gender,
    jasiMethod: jasi,
    solarTimeMode: solar,
    unknownTime: hour === undefined,
    birthLocation: location
      ? {
          code: 'manual',
          label: location,
          latitude: 37.5665,
          longitude: 126.978,
          timezone: 'Asia/Seoul',
        }
      : undefined,
  };

  return { input, now };
}

const STRENGTH_KO: Record<string, string> = {
  신강: '신강 (에너지가 강한 편)',
  중화: '중화 (균형이 잡힌 편)',
  신약: '신약 (에너지가 차분한 편)',
};

export default async function SajuVerifyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = parseSearchParams(params);

  let v1: ReturnType<typeof calculateSajuDataV1> | null = null;
  let v2: ReturnType<typeof upgradeSajuDataV1ToV2> | null = null;
  let errorMessage: string | null = null;

  if (parsed) {
    try {
      v1 = calculateSajuDataV1(parsed.input, {
        calculatedAt: parsed.now,
        timezone: 'Asia/Seoul',
        location: parsed.input.birthLocation?.label ?? null,
      });
      v2 = upgradeSajuDataV1ToV2(v1, { now: parsed.now });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '계산 중 오류가 발생했습니다.';
    }
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="사주 검증 도구" backHref="/" />

        {/* §Intro */}
        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            검증 도구 · 운영 노출 X
          </div>
          <h1 className="mt-1.5 text-[23px] font-extrabold leading-[1.4] text-[var(--app-ink)]">
            입력값으로 계산된 결과와<br />사이트 풀이가 일치하는지 확인하세요
          </h1>
          <p className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
            아래 입력을 채우고 "계산" 버튼을 누르면 년주·월주·일주·시주·일간·오행·십신·신강신약·격국·용신·대운·세운·월운이 자동으로 표시됩니다.
            그 다음 "사이트 풀이 원문" 박스에 화면에서 본 텍스트를 붙여넣으면 주요 용어가 계산값과 일치하는지 자동 비교합니다.
          </p>
        </article>

        {/* §입력 폼 — GET 으로 URL params 에 저장 → 새로고침해도 유지 */}
        <form
          method="GET"
          className="rounded-[18px] border bg-white p-5"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            STEP 1 · 입력값
          </div>
          <h2 className="mt-1 text-[18.4px] font-extrabold text-[var(--app-ink)]">
            생년월일과 출생 정보를 넣어주세요
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">생년월일 (YYYY-MM-DD)</span>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                <input name="year" defaultValue={params.year} placeholder="1990" type="number" min="1900" max="2100"
                  className="h-11 rounded-[10px] border bg-white px-2 text-[15px]"
                  style={{ borderColor: 'var(--app-line)' }} required />
                <input name="month" defaultValue={params.month} placeholder="5" type="number" min="1" max="12"
                  className="h-11 rounded-[10px] border bg-white px-2 text-[15px]"
                  style={{ borderColor: 'var(--app-line)' }} required />
                <input name="day" defaultValue={params.day} placeholder="17" type="number" min="1" max="31"
                  className="h-11 rounded-[10px] border bg-white px-2 text-[15px]"
                  style={{ borderColor: 'var(--app-line)' }} required />
              </div>
            </label>

            <label className="block">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">출생시간 (HH MM, 모르면 비움)</span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <input name="hour" defaultValue={params.hour} placeholder="10" type="number" min="0" max="23"
                  className="h-11 rounded-[10px] border bg-white px-2 text-[15px]"
                  style={{ borderColor: 'var(--app-line)' }} />
                <input name="minute" defaultValue={params.minute} placeholder="30" type="number" min="0" max="59"
                  className="h-11 rounded-[10px] border bg-white px-2 text-[15px]"
                  style={{ borderColor: 'var(--app-line)' }} />
              </div>
            </label>

            <label className="block">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">성별</span>
              <select name="gender" defaultValue={params.gender ?? ''}
                className="mt-1 h-11 w-full rounded-[10px] border bg-white px-2 text-[15px]"
                style={{ borderColor: 'var(--app-line)' }}>
                <option value="">선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">자시 적용</span>
              <select name="jasi" defaultValue={params.jasi ?? 'unified'}
                className="mt-1 h-11 w-full rounded-[10px] border bg-white px-2 text-[15px]"
                style={{ borderColor: 'var(--app-line)' }}>
                <option value="unified">통합 자시 (unified)</option>
                <option value="split">분할 자시 (split)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">시간 보정 방식</span>
              <select name="solar" defaultValue={params.solar ?? 'standard'}
                className="mt-1 h-11 w-full rounded-[10px] border bg-white px-2 text-[15px]"
                style={{ borderColor: 'var(--app-line)' }}>
                <option value="standard">표준시 (standard)</option>
                <option value="longitude">진태양시 (longitude)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">출생지 (텍스트, 선택)</span>
              <input name="location" defaultValue={params.location} placeholder="서울"
                className="mt-1 h-11 w-full rounded-[10px] border bg-white px-2 text-[15px]"
                style={{ borderColor: 'var(--app-line)' }} />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-[13.2px] font-extrabold text-[var(--app-ink)]">조회일 (ISO, 비우면 현재 시각)</span>
              <input name="now" defaultValue={params.now} placeholder="2026-05-14T12:00:00+09:00"
                className="mt-1 h-11 w-full rounded-[10px] border bg-white px-2 text-[15px]"
                style={{ borderColor: 'var(--app-line)' }} />
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.7px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            계산하기 →
          </button>
        </form>

        {/* §에러 */}
        {errorMessage ? (
          <div className="rounded-[14px] border px-4 py-3 text-[15px] text-[var(--app-ink)]"
            style={{ background: '#fdecec', borderColor: 'rgba(198,69,69,0.22)' }}>
            ⚠ 계산 실패: {errorMessage}
          </div>
        ) : null}

        {/* §계산 결과 — 사용자 템플릿 그대로 */}
        {v1 && v2 ? (
          <>
            <section
              className="rounded-[18px] border bg-white p-5"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                STEP 2 · 계산 결과
              </div>
              <h2 className="mt-1 text-[18.4px] font-extrabold text-[var(--app-ink)]">
                자동 계산된 값
              </h2>

              {/* 입력값 echo */}
              <div className="mt-3 rounded-[12px] border bg-white p-3" style={{ borderColor: 'var(--app-line)' }}>
                <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">[입력값]</div>
                <dl className="mt-1.5 grid grid-cols-[8rem_1fr] gap-y-1 text-[14.4px] leading-[1.7]">
                  <Row label="생년월일" value={`${v1.input.birth.year}-${String(v1.input.birth.month).padStart(2,'0')}-${String(v1.input.birth.day).padStart(2,'0')}`} />
                  <Row label="양력/음력" value={v1.input.calendar === 'solar' ? '양력' : '음력'} />
                  <Row label="출생시간" value={v1.input.birth.hour !== null ? `${String(v1.input.birth.hour).padStart(2,'0')}:${String(v1.input.birth.minute ?? 0).padStart(2,'0')}` : '미입력'} />
                  <Row label="성별" value={v1.input.gender === 'male' ? '남성' : v1.input.gender === 'female' ? '여성' : '미선택'} />
                  <Row label="출생지" value={v1.input.location ?? '미입력'} />
                  <Row label="자시 적용" value={v1.input.jasiMethod ?? 'unified'} />
                  <Row label="조회일" value={v1.metadata.calculatedAt} />
                </dl>
              </div>

              {/* 계산 결과 */}
              <div className="mt-3 rounded-[12px] border p-3"
                style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}>
                <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">[계산 결과]</div>
                <dl className="mt-1.5 grid grid-cols-[8rem_1fr] gap-y-1 text-[14.4px] leading-[1.7]">
                  <Row label="년주" value={`${v1.pillars.year.ganzi} (${v1.pillars.year.stemElement}/${v1.pillars.year.branchElement})`} />
                  <Row label="월주" value={`${v1.pillars.month.ganzi} (${v1.pillars.month.stemElement}/${v1.pillars.month.branchElement})`} />
                  <Row label="일주" value={`${v1.pillars.day.ganzi} (${v1.pillars.day.stemElement}/${v1.pillars.day.branchElement})`} />
                  <Row label="시주" value={v1.pillars.hour ? `${v1.pillars.hour.ganzi} (${v1.pillars.hour.stemElement}/${v1.pillars.hour.branchElement})` : '미입력'} />
                  <Row label="일간" value={`${v1.dayMaster.stem} (${v1.dayMaster.element})`} />
                  <Row label="오행 점수" value={Object.entries(v1.fiveElements.byElement).map(([el, val]) => `${el}:${val.score.toFixed(1)}(${val.count})`).join(' · ')} />
                  <Row label="십신 분포" value={v1.tenGods ? Object.entries(v1.tenGods.byType).filter(([,c]) => c > 0).map(([k,c]) => `${k}:${c}`).join(' · ') : '미산출'} />
                  <Row label="신강/신약" value={v1.strength ? `${STRENGTH_KO[v1.strength.level] ?? v1.strength.level} · 점수 ${v1.strength.score}` : '미산출'} />
                  <Row label="격국" value={v1.pattern ? `${v1.pattern.name}${v1.pattern.category ? ` (${v1.pattern.category})` : ''}${v1.pattern.tenGod ? ` · 십신: ${v1.pattern.tenGod}` : ''}` : '미산출'} />
                  <Row label="용신/희신/기신" value={v1.yongsin ? `용신: ${v1.yongsin.primary.label} · 희신(보조): ${v1.yongsin.secondary?.map((s) => s.label).join(', ') || '없음'} · 기신: ${v1.yongsin.kiyshin?.map((s) => s.label).join(', ') || '없음'}` : '미산출'} />
                  <Row label="대운" value={
                    v1.currentLuck?.currentMajorLuck
                      ? `현재 ${v1.currentLuck.currentMajorLuck.ganzi} (${v1.currentLuck.currentMajorLuck.startAge}~${v1.currentLuck.currentMajorLuck.endAge}세)`
                      : v1.majorLuck?.length
                        ? `${v1.majorLuck.length}개 cycle 계산됨`
                        : '미산출'
                  } />
                  <Row label="세운" value={v1.currentLuck?.saewoon ? `${v1.currentLuck.saewoon.ganzi} (${v1.currentLuck.saewoon.year}년)` : '미산출'} />
                  <Row label="월운" value={v1.currentLuck?.wolwoon ? `${v1.currentLuck.wolwoon.ganzi} (${v1.currentLuck.wolwoon.year}-${v1.currentLuck.wolwoon.month})` : '미산출'} />
                </dl>
              </div>

              {/* v2 검증 score */}
              <div className="mt-3 rounded-[12px] border bg-white p-3" style={{ borderColor: 'var(--app-line)' }}>
                <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  v2 풀이 검증
                </div>
                <p className="mt-1 text-[14.4px] leading-[1.7] text-[var(--app-copy)]">
                  점수: <strong>{v2.verification.score}점</strong> · 상태: <strong>{v2.verification.status}</strong> ·
                  오류 {v2.verification.summary.errors}건 / 경고 {v2.verification.summary.warnings}건
                </p>
                {v2.verification.issues.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[13.2px] font-extrabold text-[var(--app-copy-muted)]">
                      검증 이슈 상세 ({v2.verification.issues.length}건)
                    </summary>
                    <ul className="mt-2 grid gap-1">
                      {v2.verification.issues.map((issue) => (
                        <li key={`${issue.code}-${issue.path}`} className="rounded-[8px] border px-2 py-1.5 text-[12.6px] leading-[1.55]"
                          style={{ borderColor: 'var(--app-line)' }}>
                          <strong className="text-[var(--app-coral)]">{issue.severity}</strong> · {issue.code} @ {issue.path}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </section>

            {/* §사이트 풀이 비교 — 클라이언트 컴포넌트 */}
            <SajuVerifyComparePanel
              expected={{
                yearGanzi: v1.pillars.year.ganzi,
                monthGanzi: v1.pillars.month.ganzi,
                dayGanzi: v1.pillars.day.ganzi,
                hourGanzi: v1.pillars.hour?.ganzi ?? null,
                dayMaster: v1.dayMaster.stem,
                dayMasterElement: v1.dayMaster.element,
                dominantElement: v1.fiveElements.dominant,
                weakestElement: v1.fiveElements.weakest,
                strengthLevel: v1.strength?.level ?? null,
                yongsinPrimary: v1.yongsin?.primary.label ?? null,
                yongsinPrimaryValue: v1.yongsin?.primary.value ?? null,
                saewoonGanzi: v1.currentLuck?.saewoon?.ganzi ?? null,
                wolwoonGanzi: v1.currentLuck?.wolwoon?.ganzi ?? null,
                currentMajorGanzi: v1.currentLuck?.currentMajorLuck?.ganzi ?? null,
              }}
            />
          </>
        ) : (
          <div className="rounded-[14px] border bg-white px-4 py-3 text-center text-[14.4px] text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}>
            입력값을 채우고 "계산하기" 를 누르면 결과가 여기에 표시됩니다.
          </div>
        )}
      </AppPage>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string | number | null }) {
  return (
    <>
      <dt className="font-extrabold text-[var(--app-copy-muted)]">{label}:</dt>
      <dd className="font-bold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
        {value === null || value === '' ? '미산출' : value}
      </dd>
    </>
  );
}
