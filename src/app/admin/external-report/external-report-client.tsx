'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ReportDocument, type PdfReportModel } from '@/components/report/report-document';
import { BIRTH_LOCATION_PRESETS } from '@/lib/saju/birth-location';
import {
  resolveUnifiedBirthInput,
  type UnifiedBirthEntryDraft,
} from '@/lib/saju/unified-birth-entry';
import styles from './external-report.module.css';

interface GeneratedReport {
  data: PdfReportModel;
  issuedAt: string;
  generationSource: 'openai' | 'fallback';
  generationWarning?: string;
}

const EMPTY_DRAFT: UnifiedBirthEntryDraft = {
  calendarType: 'solar',
  timeRule: 'standard',
  year: '',
  month: '',
  day: '',
  hour: '',
  minute: '0',
  unknownBirthTime: true,
  gender: '',
  birthLocationCode: '',
  birthLocationLabel: '',
  birthLatitude: '',
  birthLongitude: '',
};

export function ExternalReportClient() {
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<UnifiedBirthEntryDraft>({ ...EMPTY_DRAFT });
  const [result, setResult] = useState<GeneratedReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    revision.current += 1;
    request.current?.abort();
  }, []);

  function invalidateReport() {
    revision.current += 1;
    request.current?.abort();
    request.current = null;
    setResult(null);
    setBusy(false);
    setError(null);
  }

  function patchDraft(patch: Partial<UnifiedBirthEntryDraft>) {
    invalidateReport();
    setDraft((current) => ({ ...current, ...patch }));
  }

  function resetBuyer() {
    invalidateReport();
    setName('');
    setDraft({ ...EMPTY_DRAFT });
  }

  function selectLocation(code: string) {
    const preset = BIRTH_LOCATION_PRESETS.find((item) => item.code === code);
    patchDraft({
      birthLocationCode: code,
      birthLocationLabel: preset?.label ?? '',
      birthLatitude: preset ? String(preset.latitude) : '',
      birthLongitude: preset ? String(preset.longitude) : '',
    });
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    invalidateReport();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 40) {
      setError('보고서에 표시할 이름을 1~40자로 입력해 주세요.');
      return;
    }
    if (!draft.unknownBirthTime && draft.timeRule === 'trueSolarTime'
      && (!draft.birthLocationCode || !draft.birthLatitude.trim() || !draft.birthLongitude.trim())) {
      setError('진태양시를 적용하려면 출생지와 좌표를 입력해 주세요.');
      return;
    }
    try {
      const parsed = resolveUnifiedBirthInput(draft);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
    } catch {
      setError('생년월일을 확인해 주세요. 음력 윤달 생일은 양력으로 변환해 입력해 주세요.');
      return;
    }

    const currentRevision = revision.current;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/external-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ name: trimmedName, ...draft }),
      });
      const body = await response.json().catch(() => null) as
        | ({ ok: true } & GeneratedReport)
        | { ok: false; error?: string }
        | null;
      if (currentRevision !== revision.current) return;
      if (!response.ok || !body?.ok) {
        setError(body && !body.ok && body.error ? body.error : '보고서를 생성하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      setResult(body);
    } catch {
      if (currentRevision === revision.current && !controller.signal.aborted) {
        setError('연결이 끊겨 보고서를 받지 못했습니다. 연결 상태를 확인한 뒤 다시 생성해 주세요.');
      }
    } finally {
      if (currentRevision === revision.current) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  async function printReport() {
    if (!result || printing) return;
    const currentRevision = revision.current;
    const previousTitle = document.title;
    setPrinting(true);
    try {
      await document.fonts?.ready;
      if (currentRevision !== revision.current) return;
      const filenameName = result.data.subjectName.replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
      document.title = `간지사주_깊은사주풀이_${filenameName}`;
      window.print();
    } finally {
      document.title = previousTitle;
      setPrinting(false);
    }
  }

  return (
    <>
      <div className={`external-report-controls ${styles.controls}`}>
        <div className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>외부 주문 발송용</p>
            <h2>구매자 정보로 보고서 만들기</h2>
            <p>회원 가입이나 사이트 결제 없이 생성합니다. 저장한 PDF는 주문자에게 직접 발송해 주세요.</p>
          </div>
          <span className={styles.badge}>최고 관리자 전용</span>
        </div>

        <form onSubmit={generate} autoComplete="off" className={styles.form}>
          <fieldset disabled={busy || printing} className={styles.fields}>
            <legend>구매자 출생 정보</legend>
            <div className={styles.grid}>
              <label className={styles.field} htmlFor="external-report-name">
                보고서에 표시할 이름
                <input id="external-report-name" value={name} required maxLength={40}
                  placeholder="구매자 이름" onChange={(event) => {
                    invalidateReport();
                    setName(event.target.value);
                  }} />
              </label>
              <label className={styles.field} htmlFor="external-report-gender">
                성별
                <select id="external-report-gender" value={draft.gender} required
                  onChange={(event) => patchDraft({ gender: event.target.value })}>
                  <option value="">선택해 주세요</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </label>
            </div>

            <div className={styles.grid}>
              <label className={styles.field} htmlFor="external-report-calendar">
                생일 기준
                <select id="external-report-calendar" value={draft.calendarType}
                  onChange={(event) => patchDraft({ calendarType: event.target.value as UnifiedBirthEntryDraft['calendarType'] })}>
                  <option value="solar">양력</option>
                  <option value="lunar">음력 (평달)</option>
                </select>
              </label>
              <div className={styles.dateFields}>
                {([
                  ['year', '출생 연도', 1900, new Date().getFullYear(), '1990'],
                  ['month', '월', 1, 12, '1'],
                  ['day', '일', 1, draft.calendarType === 'lunar' ? 30 : 31, '1'],
                ] as const).map(([key, label, min, max, placeholder]) => (
                  <label className={styles.field} htmlFor={`external-report-${key}`} key={key}>
                    {label}
                    <input id={`external-report-${key}`} type="number" inputMode="numeric"
                      min={min} max={max} step={1} required value={draft[key]} placeholder={placeholder}
                      onChange={(event) => patchDraft({ [key]: event.target.value })} />
                  </label>
                ))}
              </div>
            </div>
            {draft.calendarType === 'lunar' ? (
              <p className={styles.hint}>음력은 평달만 지원합니다. 윤달 생일은 정확한 양력 날짜로 변환해 양력으로 입력해 주세요.</p>
            ) : null}

            <div className={styles.timeSection}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={draft.unknownBirthTime}
                  onChange={(event) => patchDraft({ unknownBirthTime: event.target.checked, hour: '', minute: '0', timeRule: 'standard' })} />
                출생 시간 모름
              </label>
              <div className={styles.grid}>
                <div className={styles.timeFields}>
                  <label className={styles.field} htmlFor="external-report-hour">
                    출생 시각 (24시간)
                    <input id="external-report-hour" type="number" inputMode="numeric" min={0} max={23} step={1}
                      disabled={draft.unknownBirthTime} required={!draft.unknownBirthTime} value={draft.hour}
                      placeholder="시" onChange={(event) => patchDraft({ hour: event.target.value })} />
                  </label>
                  <label className={styles.field} htmlFor="external-report-minute">
                    분
                    <input id="external-report-minute" type="number" inputMode="numeric" min={0} max={59} step={1}
                      disabled={draft.unknownBirthTime} required={!draft.unknownBirthTime} value={draft.minute}
                      onChange={(event) => patchDraft({ minute: event.target.value })} />
                  </label>
                </div>
                <label className={styles.field} htmlFor="external-report-time-rule">
                  시간 적용
                  <select id="external-report-time-rule" value={draft.timeRule} disabled={draft.unknownBirthTime}
                    onChange={(event) => patchDraft({ timeRule: event.target.value as UnifiedBirthEntryDraft['timeRule'] })}>
                    <option value="standard">표준시</option>
                    <option value="trueSolarTime">진태양시 (출생지 경도 보정)</option>
                    <option value="nightZi">야자시 (자시 통합)</option>
                    <option value="earlyZi">조자시 (자시 분리)</option>
                  </select>
                </label>
              </div>
              <p className={styles.hint}>한국 표준시 기준입니다. 시간 모름을 선택하면 시주를 제외하고 대운 시작 시기는 범위로 안내합니다.</p>
            </div>

            <label className={styles.field} htmlFor="external-report-location">
              출생지
              <select id="external-report-location" value={draft.birthLocationCode}
                onChange={(event) => selectLocation(event.target.value)}>
                <option value="">선택 안 함 (표준시)</option>
                {BIRTH_LOCATION_PRESETS.map((location) => (
                  <option key={location.code} value={location.code}>{location.label}</option>
                ))}
                <option value="custom">국내 출생지 직접 입력</option>
              </select>
            </label>
            {draft.birthLocationCode === 'custom' ? (
              <div className={styles.customLocation}>
                <label className={styles.field} htmlFor="external-report-location-label">
                  지역명
                  <input id="external-report-location-label" value={draft.birthLocationLabel} required maxLength={80}
                    placeholder="경기 성남" onChange={(event) => patchDraft({ birthLocationLabel: event.target.value })} />
                </label>
                <label className={styles.field} htmlFor="external-report-latitude">
                  위도
                  <input id="external-report-latitude" type="number" step="any" min={-90} max={90} required
                    value={draft.birthLatitude} onChange={(event) => patchDraft({ birthLatitude: event.target.value })} />
                </label>
                <label className={styles.field} htmlFor="external-report-longitude">
                  경도
                  <input id="external-report-longitude" type="number" step="any" min={-180} max={180} required
                    value={draft.birthLongitude} onChange={(event) => patchDraft({ birthLongitude: event.target.value })} />
                </label>
              </div>
            ) : null}
          </fieldset>

          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={busy || printing}>
              {busy ? '깊은 사주풀이 생성 중…' : result ? '보고서 다시 생성' : '보고서 생성'}
            </button>
            <button type="button" className={styles.secondary} onClick={resetBuyer} disabled={printing}>
              {busy ? '생성 취소 · 입력 초기화' : '다음 구매자 · 입력 초기화'}
            </button>
          </div>
          <p className={styles.hint}>입력 정보와 보고서는 이 화면에서만 유지됩니다. 새로고침하거나 초기화하면 사라집니다.</p>
          {busy ? <p role="status" className={styles.hint}>생애 연도별 풀이와 대운 전환기를 구성하고 있습니다. 완료될 때까지 화면을 유지해 주세요.</p> : null}
        </form>

        {result ? (
          <div className={styles.ready} role="status">
            <div>
              <h3>{result.data.subjectName}님의 보고서가 준비되었습니다</h3>
              <p>내용과 출생 정보를 확인한 뒤 저장하세요. 인쇄 창에서 ‘PDF로 저장’을 선택하면 파일로 보관할 수 있습니다.</p>
              {result.generationWarning ? <p className={styles.warning}>{result.generationWarning}</p> : null}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={printReport} disabled={printing}>
                {printing ? '인쇄 준비 중…' : 'PDF로 저장 · 인쇄'}
              </button>
              <button type="button" className={styles.secondary} onClick={() => preview.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                보고서 미리보기
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {result ? (
        <div className="external-report-preview" ref={preview}>
          <ReportDocument data={result.data} issuedAt={result.issuedAt} showRecommendations={false} />
        </div>
      ) : null}
    </>
  );
}
