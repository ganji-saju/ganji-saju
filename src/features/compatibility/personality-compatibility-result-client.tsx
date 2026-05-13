'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Copy,
  LockKeyhole,
  MessageCircleQuestion,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  GangiActionRow,
  GangiIntro,
  GangiMiniCard,
  GangiPageHeader,
  GangiPill,
  GangiSection,
} from '@/components/gangi/gangi-ui';
import { AxisMeter } from '@/components/moonlight/AxisMeter';
import { FusionStrip } from '@/components/moonlight/FusionStrip';
import { ResultShell } from '@/components/moonlight/ResultShell';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import type { CompatibilityRelationshipType } from '@/domain/compatibility-personality';
import { isPersonalityTypeCode, type PersonalityAxisScores } from '@/domain/personality';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  isPersonalityCompatibilityQuestionKey,
  PERSONALITY_COMPATIBILITY_INPUT_SESSION_KEY,
  type PersonalityCompatibilityInputPayload,
  type PersonalityCompatibilityInputPerson,
} from '@/features/compatibility/personality-compatibility-input-storage';
import {
  buildPersonalityCompatibilityShareCardData,
  buildPersonalityCompatibilityReportScopeKey,
  buildPersonalityCompatibilityFreeResult,
  type PersonalityCompatibilityFreeResult,
  type PersonalityCompatibilityReportSnapshot,
  type PersonalityCompatibilityShareCardData,
} from '@/features/compatibility/personality-compatibility-result-builder';
import {
  PERSONALITY_COMPATIBILITY_MINI_PRICE,
  PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/personality-compatibility';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { BirthInput } from '@/lib/saju/types';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

type ResultLoadState = 'loading' | 'ready' | 'missing';
type AccessState = 'idle' | 'checking' | 'granted' | 'locked' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'guest' | 'error';
type ReportFeedbackValue = 'helpful' | 'needs_adjustment';

interface EntitlementResponse {
  authenticated?: boolean;
  hasAccess?: boolean;
  reason?: string | null;
  membershipPolicy?: string;
  error?: string;
}

interface SavedReportResponse {
  id: string;
  scopeKey: string | null;
  relationshipType: CompatibilityRelationshipType;
  questionKey: PersonalityCompatibilityInputPayload['questionKey'];
  reportJson: PersonalityCompatibilityReportSnapshot;
  productCode: 'free' | typeof PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE;
  paidAmount: number | null;
  createdAt: string;
}

const COMPATIBILITY_RELATIONSHIP_TYPES: readonly CompatibilityRelationshipType[] = [
  'dating',
  'marriage',
  'friendship',
  'family',
  'business',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompatibilityRelationshipType(value: unknown): value is CompatibilityRelationshipType {
  return (
    typeof value === 'string' &&
    COMPATIBILITY_RELATIONSHIP_TYPES.includes(value as CompatibilityRelationshipType)
  );
}

function isPersonalityProfileSource(value: unknown): value is 'self_reported' | 'moonlight_check' {
  return value === 'self_reported' || value === 'moonlight_check';
}

function parseAxisScores(value: unknown): PersonalityAxisScores | undefined {
  if (!isRecord(value)) return undefined;

  const ie = value.IE;
  const sn = value.SN;
  const tf = value.TF;
  const jp = value.JP;
  if (
    typeof ie !== 'number' ||
    typeof sn !== 'number' ||
    typeof tf !== 'number' ||
    typeof jp !== 'number'
  ) {
    return undefined;
  }

  return {
    IE: ie,
    SN: sn,
    TF: tf,
    JP: jp,
  };
}

function parsePerson(value: unknown): PersonalityCompatibilityInputPerson | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== 'string') return null;
  if (!isRecord(value.birthInput)) return null;
  if (typeof value.birthSummary !== 'string') return null;
  if (!isRecord(value.personality)) return null;
  if (!isPersonalityTypeCode(value.personality.typeCode)) return null;
  if (!isPersonalityProfileSource(value.personality.source)) return null;

  const confidence =
    typeof value.personality.confidence === 'number' ? value.personality.confidence : 0.65;

  return {
    name: value.name,
    birthInput: value.birthInput as unknown as BirthInput,
    birthSummary: value.birthSummary,
    personality: {
      typeCode: value.personality.typeCode,
      source: value.personality.source,
      confidence,
      axisScores: parseAxisScores(value.personality.axisScores),
    },
  };
}

function readStoredInputPayload(): PersonalityCompatibilityInputPayload | null {
  const raw = window.sessionStorage.getItem(PERSONALITY_COMPATIBILITY_INPUT_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== 1) return null;
    if (!isCompatibilityRelationshipType(parsed.relationshipType)) return null;
    if (!isPersonalityCompatibilityQuestionKey(parsed.questionKey)) return null;
    if (typeof parsed.questionLabel !== 'string') return null;
    if (typeof parsed.createdAt !== 'string') return null;

    const self = parsePerson(parsed.self);
    const partner = parsePerson(parsed.partner);
    if (!self || !partner) return null;

    return {
      version: 1,
      relationshipType: parsed.relationshipType,
      questionKey: parsed.questionKey,
      questionLabel: parsed.questionLabel,
      self,
      partner,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function buildPersonalityFactsForStorage(payload: PersonalityCompatibilityInputPayload) {
  return {
    source: 'personality_compatibility_input',
    selfType: payload.self.personality.typeCode,
    partnerType: payload.partner.personality.typeCode,
    selfSource: payload.self.personality.source,
    partnerSource: payload.partner.personality.source,
    selfConfidence: payload.self.personality.confidence,
    partnerConfidence: payload.partner.personality.confidence,
  };
}

function buildSajuFactsForStorage(scopeKey: string) {
  return {
    source: 'input_only_preview',
    scopeKey,
    rawBirthInputStored: false,
  };
}

function buildReportSnapshotForSave(input: {
  result: PersonalityCompatibilityFreeResult;
  resultType: 'free' | 'paid';
  scopeKey: string;
  revisitPath: string;
}): PersonalityCompatibilityReportSnapshot {
  const shareCard = buildPersonalityCompatibilityShareCardData(input.result, {
    revisitPath: input.revisitPath,
  });

  return {
    ...input.result,
    version: 1,
    resultType: input.resultType,
    scopeKey: input.scopeKey,
    paidSections: input.resultType === 'paid' ? input.result.paidSections : [],
    shareCard,
    savedAt: new Date().toISOString(),
  };
}

function buildShareText(data: PersonalityCompatibilityShareCardData, absoluteRevisitUrl: string) {
  return [
    `${data.brandText} 성향궁합`,
    `관계 키워드: ${data.relationshipKeywords.join(', ')}`,
    `오늘의 한마디: ${data.todayMessage}`,
    `다시 보기: ${absoluteRevisitUrl}`,
  ].join('\n');
}

function MissingInputState() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="성향궁합 결과" backHref="/compatibility/personality" />
        <GangiIntro
          eyebrow="무료 결과 준비"
          title={
            <>
              입력값을 먼저
              <br />
              채워주세요
            </>
          }
          description="성향궁합 결과는 현재 브라우저에 임시 저장된 입력값을 바탕으로 보여줍니다."
        />
        <section className="px-4 pb-8 sm:px-0">
          <div className="gangi-pink-panel p-4">
            <GangiMiniCard
              label="다시 입력"
              title="관계 유형과 두 사람 정보를 먼저 입력해 주세요"
              desc="저장된 결과 링크가 있다면 로그인 상태와 링크가 올바른지도 함께 확인해 주세요."
            />
            <div className="mt-4">
              <Link href="/compatibility/personality" className="gangi-primary-button">
                성향궁합 입력하기
              </Link>
            </div>
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}

function LoadingState() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="성향궁합 결과" backHref="/compatibility/personality" />
        <GangiIntro
          eyebrow="무료 결과 준비"
          title={
            <>
              두 사람의 흐름을
              <br />
              정리하고 있어요
            </>
          }
          description="입력값과 5축 점수를 맞춰보는 중입니다."
        />
      </AppPage>
    </AppShell>
  );
}

function ScoreSummary({ result }: { result: PersonalityCompatibilityFreeResult }) {
  return (
    <section className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
      <p className="app-caption text-[var(--app-pink-strong)]">5축 점수</p>
      <h2 className="mt-2 text-xl font-bold text-[var(--gyeol-text)]">
        한 점수보다 다섯 축을 함께 봅니다
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--gyeol-muted)]">
        갈등 지수는 높을수록 주의가 필요한 신호입니다.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.axisSummaries.map((axis) => (
          <AxisMeter
            key={axis.key}
            label={axis.label}
            value={axis.value}
            description={axis.caption}
          />
        ))}
      </div>
      <p className="mt-4 rounded-[1rem] border border-[var(--app-line)] bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-[var(--app-ink)]">
        종합 참고점수 {result.score.totalScore}점 · 관계를 단정하기보다 조율 포인트를 나누어 보는
        값입니다.
      </p>
    </section>
  );
}

function FreeInterpretation({ result }: { result: PersonalityCompatibilityFreeResult }) {
  return (
    <GangiSection
      eyebrow="무료 해석"
      title="짧게 보면 이런 흐름입니다"
      description="무료 결과는 핵심만 3문단으로 정리합니다."
    >
      <div className="grid gap-3">
        {result.paragraphs.map((paragraph, index) => (
          <article
            key={paragraph}
            className="rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-4"
          >
            <span className="app-caption text-[var(--app-pink-strong)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="mt-2 text-sm font-medium leading-7 text-[var(--app-copy)]">{paragraph}</p>
          </article>
        ))}
      </div>
    </GangiSection>
  );
}

function LockedPreview({
  result,
  accessState,
}: {
  result: PersonalityCompatibilityFreeResult;
  accessState: AccessState;
}) {
  if (accessState === 'granted') {
    return (
      <GangiSection
        eyebrow="잠금 해제"
        title="깊이보기 내용이 열렸습니다"
        description="구매 권한이 확인된 결과 범위의 paidReport입니다."
        tone="pink"
      >
        <div className="grid gap-3">
          {result.paidSections.map((section) => (
            <article
              key={section.title}
              className="rounded-[1.2rem] border border-[var(--app-pink)]/20 bg-white/90 px-4 py-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-[var(--app-ink)]">{section.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{section.body}</p>
            </article>
          ))}
        </div>
      </GangiSection>
    );
  }

  const description =
    accessState === 'checking'
      ? '구매 이력을 확인하는 중입니다. 확인되면 이 영역이 자동으로 열립니다.'
      : '990원 결제 후 현재 결과 범위에 연결된 상세 섹션이 열립니다.';

  return (
    <GangiSection
      eyebrow="잠금 영역"
      title="깊이보기에서 열리는 내용"
      description={description}
      tone="pink"
    >
      <div className="grid gap-3">
        {result.lockedSections.map((section) => (
          <article
            key={section.title}
            className="flex items-start gap-3 rounded-[1.2rem] border border-[var(--app-line)] bg-white/80 px-4 py-4"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--app-ink)]">{section.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--app-copy-muted)]">{section.teaser}</p>
            </div>
          </article>
        ))}
      </div>
    </GangiSection>
  );
}

function ShareCard({
  data,
  reportId,
  saveStatus,
  onCopy,
  copyMessage,
}: {
  data: PersonalityCompatibilityShareCardData;
  reportId: string | null;
  saveStatus: SaveStatus;
  onCopy: () => void;
  copyMessage: string;
}) {
  return (
    <GangiSection
      eyebrow="공유 카드"
      title="점수보다 관계 키워드 중심으로 공유합니다"
      description="공유 카드에는 생년월일시, 이름, 상대의 세부 개인정보를 넣지 않습니다."
      tone="pink"
    >
      <div className="rounded-[1.6rem] border border-[var(--app-pink)]/20 bg-white/90 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-caption text-[var(--app-pink-strong)]">Moonlight compatibility</p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--app-ink)]">{data.brandText}</h3>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
            <Share2 className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {data.relationshipKeywords.map((keyword) => (
            <GangiPill key={keyword}>{keyword}</GangiPill>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          {data.axisHighlights.map((axis) => (
            <div
              key={axis.label}
              className="rounded-[1.1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3"
            >
              <strong className="text-sm text-[var(--app-ink)]">{axis.label}</strong>
              <p className="mt-1 text-sm leading-6 text-[var(--app-copy-muted)]">{axis.summary}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-[1.2rem] bg-[var(--app-ink)] px-4 py-4 text-sm font-semibold leading-7 text-white">
          오늘의 한마디 · {data.todayMessage}
        </p>

        <div className="mt-4 rounded-[1rem] border border-dashed border-[var(--app-line)] px-4 py-3 text-xs leading-6 text-[var(--app-copy-muted)]">
          다시 보기 링크 · {reportId ? data.revisitPath : '저장 후 생성됩니다'}
        </div>
      </div>

      <GangiActionRow className="mt-4">
        <button type="button" onClick={onCopy} className="gangi-secondary-button">
          <Copy className="h-4 w-4" />
          공유 문구 복사
        </button>
        {reportId ? (
          <Link href={data.revisitPath} className="gangi-secondary-button">
            <BookmarkCheck className="h-4 w-4" />
            저장 결과 다시 보기
          </Link>
        ) : null}
      </GangiActionRow>

      <p className="mt-3 text-xs leading-6 text-[var(--app-copy-muted)]">
        카카오톡 공유와 이미지 저장은 기존 구현이 없어 외부 연동 확인이 필요합니다.
      </p>
      {saveStatus === 'saving' ? (
        <p className="mt-3 text-xs font-semibold text-[var(--app-copy-muted)]">
          결과를 저장하는 중입니다.
        </p>
      ) : null}
      {saveStatus === 'saved' ? (
        <p className="mt-3 text-xs font-semibold text-[var(--app-jade)]">
          저장 완료. 이 링크로 다시 볼 수 있습니다.
        </p>
      ) : null}
      {saveStatus === 'guest' ? (
        <p className="mt-3 text-xs font-semibold text-[var(--app-copy-muted)]">
          로그인하면 결과 저장과 다시 보기 링크를 만들 수 있습니다.
        </p>
      ) : null}
      {saveStatus === 'error' ? (
        <p className="mt-3 text-xs font-semibold text-[var(--app-coral)]">
          저장을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.
        </p>
      ) : null}
      {copyMessage ? (
        <p className="mt-3 rounded-[1rem] border border-[var(--app-jade)]/22 bg-[var(--app-jade)]/10 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
          {copyMessage}
        </p>
      ) : null}
    </GangiSection>
  );
}

function ReportFeedback({
  submittedValue,
  onSubmit,
}: {
  submittedValue: ReportFeedbackValue | null;
  onSubmit: (value: ReportFeedbackValue) => void;
}) {
  return (
    <GangiSection
      eyebrow="피드백"
      title="이번 결과가 도움이 되었나요?"
      description="자유 입력 없이 버튼 선택만 기록해 개인정보가 이벤트에 섞이지 않게 합니다."
    >
      <GangiActionRow>
        <button
          type="button"
          onClick={() => onSubmit('helpful')}
          className="gangi-secondary-button"
          data-active={submittedValue === 'helpful' ? 'true' : undefined}
        >
          도움이 됐어요
        </button>
        <button
          type="button"
          onClick={() => onSubmit('needs_adjustment')}
          className="gangi-secondary-button"
          data-active={submittedValue === 'needs_adjustment' ? 'true' : undefined}
        >
          조금 아쉬워요
        </button>
      </GangiActionRow>
      {submittedValue ? (
        <p className="mt-3 rounded-[1rem] border border-[var(--app-jade)]/22 bg-[var(--app-jade)]/10 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
          피드백을 남겼습니다. 다음 결과 흐름을 다듬는 데 참고하겠습니다.
        </p>
      ) : null}
    </GangiSection>
  );
}

export function PersonalityCompatibilityResultClient() {
  const [payload, setPayload] = useState<PersonalityCompatibilityInputPayload | null>(null);
  const [savedReport, setSavedReport] = useState<SavedReportResponse | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<ResultLoadState>('loading');
  const [accessState, setAccessState] = useState<AccessState>('idle');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [feedbackValue, setFeedbackValue] = useState<ReportFeedbackValue | null>(null);
  const [ctaMessage, setCtaMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const saveAttemptKeyRef = useRef('');
  const resultViewedRef = useRef(false);
  const result = useMemo(
    () => savedReport?.reportJson ?? (payload ? buildPersonalityCompatibilityFreeResult(payload) : null),
    [payload, savedReport]
  );
  const scopeKey = useMemo(
    () => savedReport?.scopeKey ?? (payload ? buildPersonalityCompatibilityReportScopeKey(payload) : null),
    [payload, savedReport]
  );
  const checkoutHref = useMemo(() => {
    if (!scopeKey) return '/compatibility/personality';

    const params = new URLSearchParams({
      product: PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
      scope: scopeKey,
      from: 'personality-compatibility-result',
    });
    return `/membership/checkout?${params.toString()}`;
  }, [scopeKey]);
  const revisitPath = reportId
    ? `/compatibility/personality/result?reportId=${encodeURIComponent(reportId)}`
    : '/compatibility/personality/result';
  const shareCard = useMemo(
    () =>
      result
        ? buildPersonalityCompatibilityShareCardData(result, { revisitPath })
        : null,
    [result, revisitPath]
  );
  const analyticsRelationshipType = payload?.relationshipType ?? savedReport?.relationshipType ?? null;
  const analyticsResultType = accessState === 'granted' ? 'paid' : 'free';
  const analyticsProductCode =
    accessState === 'granted' ? PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE : 'free';

  useEffect(() => {
    let isActive = true;
    const storedPayload = readStoredInputPayload();
    const params = new URLSearchParams(window.location.search);
    const queryReportId = params.get('reportId')?.trim();

    if (params.get('payment') === 'failed') {
      setPaymentNotice('결제가 완료되지 않아 무료 결과로 돌아왔습니다.');
    } else if (params.get('paid') === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE) {
      setPaymentNotice('결제 확인 후 깊이보기 권한을 확인하고 있습니다.');
    }

    if (queryReportId) {
      fetch(`/api/compatibility/personality/reports?id=${encodeURIComponent(queryReportId)}`)
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }: { response: Response; data: { report?: SavedReportResponse; error?: string } }) => {
          if (!isActive) return;

          if (!response.ok || !data.report) {
            setLoadState('missing');
            setSaveStatus(response.status === 401 ? 'guest' : 'error');
            return;
          }

          setSavedReport(data.report);
          setReportId(data.report.id);
          setPayload(null);
          setAccessState(data.report.productCode === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE ? 'granted' : 'locked');
          setSaveStatus('saved');
          setLoadState('ready');
        })
        .catch(() => {
          if (!isActive) return;
          setSaveStatus('error');
          setLoadState('missing');
        });

      return () => {
        isActive = false;
      };
    }

    setPayload(storedPayload);
    setLoadState(storedPayload ? 'ready' : 'missing');

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!scopeKey || savedReport) return;

    let isActive = true;
    setAccessState('checking');

    fetch(`/api/compatibility/personality/entitlement?scope=${encodeURIComponent(scopeKey)}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }: { response: Response; data: EntitlementResponse }) => {
        if (!isActive) return;

        if (!response.ok || data.error) {
          setAccessState('error');
          return;
        }

        setAccessState(data.hasAccess ? 'granted' : 'locked');
        if (data.hasAccess) {
          setPaymentNotice(
            data.reason === 'membership'
              ? '멤버십 정책으로 깊이보기가 열렸습니다.'
              : '구매 이력이 확인되어 깊이보기가 열렸습니다.'
          );
        }
      })
      .catch(() => {
        if (isActive) setAccessState('error');
      });

    return () => {
      isActive = false;
    };
  }, [scopeKey, savedReport]);

  useEffect(() => {
    if (!result || !analyticsRelationshipType || resultViewedRef.current) return;
    if (accessState === 'idle' || accessState === 'checking') return;

    resultViewedRef.current = true;
    trackMoonlightEvent('free_result_viewed', {
      relationshipType: analyticsRelationshipType,
      resultType: analyticsResultType,
      productCode: analyticsProductCode,
      source: savedReport ? 'saved_report' : 'personality_compatibility_result',
    });
  }, [
    accessState,
    analyticsProductCode,
    analyticsRelationshipType,
    analyticsResultType,
    result,
    savedReport,
  ]);

  useEffect(() => {
    if (!payload || !result || !scopeKey || savedReport) return;
    if (accessState === 'idle' || accessState === 'checking') return;
    if (accessState === 'error') {
      setSaveStatus('error');
      return;
    }

    const resultType = accessState === 'granted' ? 'paid' : 'free';
    const saveKey = `${scopeKey}:${resultType}`;
    if (saveAttemptKeyRef.current === saveKey) return;
    saveAttemptKeyRef.current = saveKey;
    setSaveStatus('saving');

    const reportJson = buildReportSnapshotForSave({
      result,
      resultType,
      scopeKey,
      revisitPath,
    });

    fetch('/api/compatibility/personality/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeKey,
        relationshipType: payload.relationshipType,
        questionKey: payload.questionKey,
        scoreJson: result.score,
        sajuFactsJson: buildSajuFactsForStorage(scopeKey),
        personalityFactsJson: buildPersonalityFactsForStorage(payload),
        reportJson,
        productCode:
          resultType === 'paid' ? PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE : 'free',
      }),
    })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }: { response: Response; data: { report?: SavedReportResponse; error?: string } }) => {
        if (response.status === 401) {
          setSaveStatus('guest');
          return;
        }

        if (!response.ok || !data.report) {
          setSaveStatus('error');
          return;
        }

        setReportId(data.report.id);
        setSaveStatus('saved');
      })
      .catch(() => {
        setSaveStatus('error');
      });
  }, [accessState, payload, result, revisitPath, savedReport, scopeKey]);

  function handleCopyShareText() {
    if (!shareCard) return;

    const absoluteRevisitUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${shareCard.revisitPath}`
        : shareCard.revisitPath;
    const text = buildShareText(shareCard, absoluteRevisitUrl);

    if (!navigator.clipboard) {
      setCopyMessage('이 브라우저에서는 자동 복사가 지원되지 않습니다. 공유 카드 내용을 직접 선택해 주세요.');
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        trackMoonlightEvent('report_shared', {
          relationshipType: analyticsRelationshipType,
          resultType: analyticsResultType,
          productCode: analyticsProductCode,
          shareMethod: 'copy_text',
          source: 'personality_compatibility_report',
        });
        setCopyMessage('개인 생년월일시와 상대 정보 없이 공유 문구를 복사했습니다.');
      })
      .catch(() => {
        setCopyMessage('자동 복사를 완료하지 못했습니다. 공유 카드 내용을 직접 선택해 주세요.');
      });
  }

  function handleAiCta() {
    trackMoonlightEvent('ai_chat_started_from_report', {
      relationshipType: analyticsRelationshipType,
      resultType: analyticsResultType,
      productCode: analyticsProductCode,
      source: 'personality_compatibility_report',
    });
    console.info('personality compatibility result cta clicked', {
      action: 'ai',
      relationshipType: payload?.relationshipType,
      questionKey: payload?.questionKey,
      hasPaidAccess: accessState === 'granted',
    });
    setCtaMessage('다음 단계에서 이 결과 맥락을 대화방에 전달할 수 있게 버튼 구조만 준비했습니다.');
  }

  function handlePaidUnlockClick() {
    trackMoonlightEvent('paid_unlock_clicked', {
      relationshipType: analyticsRelationshipType,
      productCode: PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
      amount: PERSONALITY_COMPATIBILITY_MINI_PRICE,
      source: 'personality_compatibility_report',
    });
  }

  function handleFeedbackSubmit(value: ReportFeedbackValue) {
    setFeedbackValue(value);
    trackMoonlightEvent('report_feedback_submitted', {
      relationshipType: analyticsRelationshipType,
      resultType: analyticsResultType,
      productCode: analyticsProductCode,
      feedbackValue: value,
      source: 'personality_compatibility_report',
    });
  }

  if (loadState === 'loading') return <LoadingState />;
  if (!result || (!payload && !savedReport)) return <MissingInputState />;

  const isSavedResult = Boolean(savedReport);
  const introDescription =
    payload
      ? `${payload.self.name}님과 ${payload.partner.name}님의 “${result.questionLabel}” 질문을 기준으로 정리했습니다.`
      : `저장된 “${result.questionLabel}” 성향궁합 결과를 다시 불러왔습니다.`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="성향궁합 결과" backHref="/compatibility/personality" />
        <ResultShell
          title={result.headline}
          summary={introDescription}
          keywords={[result.relationshipLabel, accessState === 'granted' ? '깊이보기' : '무료 결과', ...result.keywords]}
          scoreSummary={
            <AxisMeter
              label="종합 참고점수"
              value={result.score.totalScore}
              description="관계의 결을 단정하지 않고, 끌림·안정·소통·갈등·회복을 함께 보는 참고 지표입니다."
            />
          }
        >
          <FusionStrip prefixLabel="사주 궁합" suffixLabel="성향 궁합" />

          <div className="grid gap-3 sm:grid-cols-2">
            {payload ? (
              <>
                <GangiMiniCard
                  label={payload.self.name}
                  title={`${payload.self.personality.typeCode} · ${payload.self.birthSummary}`}
                  desc="내 입력값"
                />
                <GangiMiniCard
                  label={payload.partner.name}
                  title={`${payload.partner.personality.typeCode} · ${payload.partner.birthSummary}`}
                  desc="상대 입력값"
                />
              </>
            ) : (
              <>
                <GangiMiniCard
                  label="저장된 결과"
                  title={`${result.relationshipLabel} · ${result.questionLabel}`}
                  desc="개인 생년월일시는 공유 카드에 표시하지 않습니다"
                />
                <GangiMiniCard
                  label="재조회"
                  title={isSavedResult ? '저장된 리포트에서 불러옴' : '현재 입력값에서 생성'}
                  desc="소유자 로그인 기준으로 다시 열람합니다"
                />
              </>
            )}
          </div>

          <ScoreSummary result={result} />

          <GangiSection eyebrow="관계 키워드" title="이 관계에서 먼저 보이는 단서">
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((keyword) => (
                <GangiPill key={keyword}>{keyword}</GangiPill>
              ))}
            </div>
          </GangiSection>

          <FreeInterpretation result={result} />
          <LockedPreview result={result} accessState={accessState} />
          {shareCard ? (
            <ShareCard
              data={shareCard}
              reportId={reportId}
              saveStatus={saveStatus}
              onCopy={handleCopyShareText}
              copyMessage={copyMessage}
            />
          ) : null}

          <section className="px-4 pb-8 sm:px-0">
            <div className="gangi-pink-panel p-4">
              <p className="gangi-sub-eyebrow mb-2">다음 액션</p>
              <h2 className="text-xl font-bold leading-7 text-[var(--app-ink)]">
                더 깊게 보거나, 이어서 물어볼 수 있게 준비했습니다
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--app-copy-muted)]">
                깊이보기는 990원 결제 후 현재 결과 범위에 연결되며, 이미 구매한 결과는 다시 결제하지 않습니다.
              </p>
              {paymentNotice ? (
                <p className="mt-4 rounded-[1rem] border border-[var(--app-jade)]/22 bg-[var(--app-jade)]/10 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
                  {paymentNotice}
                </p>
              ) : null}
              <GangiActionRow className="mt-4">
                {accessState === 'granted' ? (
                  <span className="gangi-primary-button" aria-live="polite">
                    <Sparkles className="h-4 w-4" />
                    깊이보기 열림
                  </span>
                ) : (
                  <Link href={checkoutHref} onClick={handlePaidUnlockClick} className="gangi-primary-button">
                    <Sparkles className="h-4 w-4" />
                    {PERSONALITY_COMPATIBILITY_MINI_PRICE.toLocaleString('ko-KR')}원으로 깊이보기
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleAiCta}
                  className="gangi-secondary-button"
                >
                  <MessageCircleQuestion className="h-4 w-4" />
                  AI에게 이어서 물어보기
                </button>
              </GangiActionRow>
              {ctaMessage ? (
                <p className="mt-4 rounded-[1rem] border border-[var(--app-jade)]/22 bg-[var(--app-jade)]/10 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
                  {ctaMessage}
                </p>
              ) : null}
            </div>
          </section>

          <ReportFeedback submittedValue={feedbackValue} onSubmit={handleFeedbackSubmit} />

          <SafetyNotice>{result.safetyNote}</SafetyNotice>
        </ResultShell>
      </AppPage>
    </AppShell>
  );
}
