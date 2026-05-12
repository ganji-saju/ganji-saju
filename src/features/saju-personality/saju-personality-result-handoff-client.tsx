'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Copy,
  LockKeyhole,
  MessageCircle,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  GangiIntro,
  GangiPageHeader,
  GangiPill,
  GangiSection,
} from '@/components/gangi/gangi-ui';
import { AxisMeter } from '@/components/moonlight/AxisMeter';
import { FusionStrip } from '@/components/moonlight/FusionStrip';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { ResultShell } from '@/components/moonlight/ResultShell';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { buttonVariants } from '@/components/ui/button';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  SAJU_PERSONALITY_MINI_PRICE,
  SAJU_PERSONALITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/saju-personality';
import { trackMoonlightEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import {
  buildSajuPersonalityFreeResult,
  buildSajuPersonalityReportScopeKey,
  buildSajuPersonalityReportSnapshot,
  buildSajuPersonalityShareCardData,
  buildSajuPersonalityShareText,
  type SajuPersonalityReportSnapshot,
  type SajuPersonalityShareCardData,
} from './saju-personality-result-builder';
import {
  loadSajuPersonalityInputPayload,
  type SajuPersonalityInputPayload,
} from './saju-personality-input-storage';

type ResultLoadState = 'loading' | 'ready' | 'missing';
type AccessState = 'checking' | 'granted' | 'locked' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'guest' | 'error';
type FeedbackRating = 'helpful' | 'neutral' | 'needs_adjustment';

interface EntitlementResponse {
  authenticated?: boolean;
  hasAccess?: boolean;
  reason?: string | null;
  error?: string;
}

interface SavedReportResponse {
  id: string;
  scopeKey: string;
  reportType: 'free' | 'paid';
  lifeArea: SajuPersonalityInputPayload['lifeArea'];
  reportJson: SajuPersonalityReportSnapshot;
  productCode: 'free' | typeof SAJU_PERSONALITY_MINI_PRODUCT_CODE;
  paidAmount: number | null;
  createdAt: string;
}

const AI_CONSULTATION_CTAS = [
  {
    label: '이 성향을 더 물어보기',
    question: '방금 본 성향사주 결과를 바탕으로, 내 성향에서 가장 선명한 부분을 더 쉽게 풀어줘.',
  },
  {
    label: '내 연애 패턴 더 보기',
    question: '이 성향사주 결과를 바탕으로, 내 연애 패턴에서 반복되는 반응을 더 자세히 봐줘.',
  },
  {
    label: '일과 돈의 흐름 더 묻기',
    question: '이 성향사주 결과를 바탕으로, 일과 돈의 흐름에서 내가 잘 쓰면 좋은 방식을 알려줘.',
  },
  {
    label: '오늘 선택을 상담하기',
    question: '이 성향사주 결과를 바탕으로, 오늘 내가 선택할 때 무엇을 먼저 보면 좋을지 상담해줘.',
  },
] as const;

const FEEDBACK_OPTIONS: Array<{ rating: FeedbackRating; label: string }> = [
  { rating: 'helpful', label: '도움이 됐어요' },
  { rating: 'neutral', label: '보통이에요' },
  { rating: 'needs_adjustment', label: '조금 아쉬워요' },
];

function LoadingState() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="성향사주 결과" backHref="/saju/personality" />
        <GangiIntro
          eyebrow="결과 준비"
          title={
            <>
              사주와 성향을
              <br />
              정리하고 있어요
            </>
          }
          description="입력값이나 저장된 결과를 확인하는 중입니다."
        />
      </AppPage>
    </AppShell>
  );
}

function MissingInputState() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="성향사주 결과" backHref="/saju/personality" />
        <GangiIntro
          eyebrow="결과 준비"
          title={
            <>
              입력값이나 저장된 결과를
              <br />
              찾지 못했습니다
            </>
          }
          description="성향사주 입력 화면에서 생년월일시, 성향, 관심영역을 먼저 선택해 주세요."
        />
        <GangiSection title="다시 시작하기" description="저장된 결과 링크라면 로그인 상태도 함께 확인해 주세요.">
          <Link href="/saju/personality" className={buttonVariants()}>
            입력하러 가기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </GangiSection>
      </AppPage>
    </AppShell>
  );
}

function ScoreSummary({ result }: { result: SajuPersonalityReportSnapshot }) {
  return (
    <section className="rounded-[1.35rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] p-4 sm:p-5">
      <p className="app-caption text-[var(--app-pink-strong)]">6축 점수</p>
      <h2 className="mt-2 text-xl font-bold text-[var(--gyeol-text)]">
        전체 선명도 {result.scores.totalClarityScore}점
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--gyeol-muted)]">
        높을수록 좋은 운을 뜻하지 않고, 사주 facts와 성향 facts가 같은 방향을 얼마나 또렷하게
        가리키는지 보여줍니다.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {result.axisSummaries.map((axis) => (
          <AxisMeter
            key={axis.key}
            label={axis.label}
            value={axis.value}
            description={axis.caption}
          />
        ))}
      </div>
    </section>
  );
}

function LockedOrPaidSections({
  result,
  accessState,
}: {
  result: SajuPersonalityReportSnapshot;
  accessState: AccessState;
}) {
  if (accessState === 'granted') {
    return (
      <GangiSection
        eyebrow="잠금 해제"
        title="깊이보기 내용이 열렸습니다"
        description="구매 권한이 확인된 결과 범위의 유료 리포트 섹션입니다."
        tone="pink"
      >
        <div className="grid gap-3">
          {result.paidSections.map((section) => (
            <article
              key={section.title}
              className="rounded-[1.2rem] border border-[var(--app-pink)]/20 bg-white px-4 py-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
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

  return (
    <GangiSection
      eyebrow="잠금 영역"
      title="깊이보기에서 열리는 내용"
      description={
        accessState === 'checking'
          ? '구매 이력을 확인하는 중입니다. 확인되면 이 영역이 자동으로 열립니다.'
          : '아래 항목은 결제 전에는 제목과 예고만 보여줍니다. 상세 해석은 아직 노출하지 않습니다.'
      }
      tone="pink"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {result.lockedSections.map((section) => (
          <div
            key={section.title}
            className="flex items-center gap-3 rounded-[1rem] border border-[var(--app-line)] bg-white/82 px-4 py-3 text-sm font-semibold text-[var(--app-ink)]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <div>
              <span>{section.title}</span>
              <p className="mt-1 text-xs font-medium leading-5 text-[var(--app-copy-soft)]">
                {section.teaser}
              </p>
            </div>
          </div>
        ))}
      </div>
    </GangiSection>
  );
}

function ShareCard({
  data,
  reportId,
  saveStatus,
  copyMessage,
  onCopy,
}: {
  data: SajuPersonalityShareCardData;
  reportId: string | null;
  saveStatus: SaveStatus;
  copyMessage: string;
  onCopy: () => void;
}) {
  return (
    <GangiSection
      eyebrow="공유 카드"
      title="개인정보 없이 키워드 중심으로 공유합니다"
      description="공유 카드에는 이름, 생년월일시, 성별, 체크 답변, 사주 원국, 결제 정보를 넣지 않습니다."
      tone="pink"
    >
      <div className="rounded-[1.6rem] border border-[var(--app-pink)]/20 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-caption text-[var(--app-pink-strong)]">Moonlight saju personality</p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--app-ink)]">{data.brandText}</h3>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
            <Share2 className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {data.keywords.map((keyword) => (
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

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onCopy} className={buttonVariants({ variant: 'outline' })}>
          <Copy className="h-4 w-4" />
          공유 문구 복사
        </button>
        {reportId ? (
          <Link href={data.revisitPath} className={buttonVariants({ variant: 'secondary' })}>
            <BookmarkCheck className="h-4 w-4" />
            저장 결과 다시 보기
          </Link>
        ) : null}
      </div>

      {saveStatus === 'saving' ? (
        <p className="mt-3 text-xs font-semibold text-[var(--app-copy-muted)]">결과를 저장하는 중입니다.</p>
      ) : null}
      {saveStatus === 'saved' ? (
        <p className="mt-3 text-xs font-semibold text-[var(--app-jade)]">저장 완료. 이 링크로 다시 볼 수 있습니다.</p>
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

function FeedbackPanel({
  selectedRating,
  onSubmit,
}: {
  selectedRating: FeedbackRating | null;
  onSubmit: (rating: FeedbackRating) => void;
}) {
  return (
    <GangiSection
      eyebrow="피드백"
      title="이번 성향사주 결과가 도움이 되었나요?"
      description="자유 입력 없이 버튼 선택만 기록해 개인정보가 이벤트에 섞이지 않게 합니다."
    >
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_OPTIONS.map((option) => (
          <button
            key={option.rating}
            type="button"
            onClick={() => onSubmit(option.rating)}
            className={buttonVariants({
              variant: selectedRating === option.rating ? 'default' : 'outline',
            })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selectedRating ? (
        <p className="mt-3 rounded-[1rem] border border-[var(--app-jade)]/22 bg-[var(--app-jade)]/10 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
          피드백을 남겼습니다. 다음 결과 흐름을 다듬는 데 참고하겠습니다.
        </p>
      ) : null}
    </GangiSection>
  );
}

export function SajuPersonalityResultHandoffClient() {
  const [payload, setPayload] = useState<SajuPersonalityInputPayload | null>(null);
  const [savedReport, setSavedReport] = useState<SavedReportResponse | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<ResultLoadState>('loading');
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [ctaMessage, setCtaMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const saveAttemptKeyRef = useRef('');
  const resultViewedRef = useRef(false);
  const liveResult = useMemo(() => {
    if (!payload) return null;

    try {
      return buildSajuPersonalityFreeResult(payload);
    } catch {
      return null;
    }
  }, [payload]);
  const scopeKey = useMemo(
    () => savedReport?.scopeKey ?? (payload ? buildSajuPersonalityReportScopeKey(payload) : null),
    [payload, savedReport]
  );
  const revisitPath = reportId
    ? `/saju/personality/result?reportId=${encodeURIComponent(reportId)}`
    : '/saju/personality/result';
  const result = useMemo(() => {
    if (savedReport?.reportJson) return savedReport.reportJson;
    if (!liveResult || !scopeKey) return null;

    return buildSajuPersonalityReportSnapshot({
      result: liveResult,
      resultType: accessState === 'granted' ? 'paid' : 'free',
      scopeKey,
      revisitPath,
    });
  }, [accessState, liveResult, revisitPath, savedReport, scopeKey]);
  const shareCard = useMemo(
    () => (result ? buildSajuPersonalityShareCardData(result, { revisitPath }) : null),
    [result, revisitPath]
  );
  const checkoutHref = useMemo(() => {
    if (!scopeKey) return '/saju/personality';

    const params = new URLSearchParams({
      product: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
      scope: scopeKey,
      from: 'saju-personality-result',
    });

    return `/membership/checkout?${params.toString()}`;
  }, [scopeKey]);
  const analyticsResultType = accessState === 'granted' ? 'paid' : 'free';
  const analyticsProductCode =
    accessState === 'granted' ? SAJU_PERSONALITY_MINI_PRODUCT_CODE : 'free';

  function buildAnalyticsPayload(channel?: string) {
    return {
      source: savedReport ? 'saved_report' : 'saju_personality_report',
      lifeArea: result?.lifeArea ?? payload?.lifeArea ?? null,
      productCode: analyticsProductCode,
      reportType: analyticsResultType,
      ...(channel ? { channel } : {}),
    };
  }

  function buildAiConsultationHref(question: string) {
    const params = new URLSearchParams({
      question,
      from: 'saju-personality-report',
      autoStart: '1',
      expert: 'dragon',
      lifeArea: result?.lifeArea ?? payload?.lifeArea ?? 'basic',
    });

    if (scopeKey) params.set('sourceSessionId', scopeKey);
    if (reportId) params.set('sajuPersonalityReportId', reportId);

    return `/dialogue?${params.toString()}`;
  }

  useEffect(() => {
    let isActive = true;
    const storedPayload = loadSajuPersonalityInputPayload();
    const params = new URLSearchParams(window.location.search);
    const queryReportId = params.get('reportId')?.trim();
    const queryScope = params.get('scope')?.trim();

    if (params.get('payment') === 'failed') {
      setPaymentNotice('결제가 완료되지 않아 무료 결과로 돌아왔습니다.');
    } else if (params.get('paid') === SAJU_PERSONALITY_MINI_PRODUCT_CODE) {
      setPaymentNotice('결제 확인 후 깊이보기 권한을 확인하고 있습니다.');
    }

    if (queryReportId || (!storedPayload && queryScope)) {
      const query = queryReportId
        ? `id=${encodeURIComponent(queryReportId)}`
        : `scope=${encodeURIComponent(queryScope ?? '')}`;

      fetch(`/api/saju/personality/reports?${query}`)
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }: { response: Response; data: { report?: SavedReportResponse; error?: string } }) => {
          if (!isActive) return;

          if (!response.ok || !data.report) {
            setSaveStatus(response.status === 401 ? 'guest' : 'error');
            setLoadState('missing');
            return;
          }

          setSavedReport(data.report);
          setReportId(data.report.id);
          setPayload(null);
          setAccessState(data.report.productCode === SAJU_PERSONALITY_MINI_PRODUCT_CODE ? 'granted' : 'locked');
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

    fetch(`/api/saju/personality/entitlement?scope=${encodeURIComponent(scopeKey)}`, {
      cache: 'no-store',
    })
      .then((response) =>
        response.json().then((data) => ({ response, data: data as EntitlementResponse }))
      )
      .then(({ response, data }) => {
        if (!isActive) return;
        if (!response.ok || data.error) {
          setAccessState('locked');
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
  }, [savedReport, scopeKey]);

  useEffect(() => {
    if (!result || resultViewedRef.current || accessState === 'checking') return;

    resultViewedRef.current = true;
    trackMoonlightEvent('saju_personality_free_result_viewed', {
      source: savedReport ? 'saved_report' : 'saju_personality_result',
      lifeArea: result.lifeArea,
      productCode: analyticsProductCode,
      reportType: analyticsResultType,
    });
  }, [accessState, analyticsProductCode, analyticsResultType, result, savedReport]);

  useEffect(() => {
    if (!payload || !liveResult || !scopeKey || savedReport) return;
    if (accessState === 'checking') return;
    if (accessState === 'error') {
      setSaveStatus('error');
      return;
    }

    const resultType = accessState === 'granted' ? 'paid' : 'free';
    const saveKey = `${scopeKey}:${resultType}`;
    if (saveAttemptKeyRef.current === saveKey) return;
    saveAttemptKeyRef.current = saveKey;
    setSaveStatus('saving');

    const reportJson = buildSajuPersonalityReportSnapshot({
      result: liveResult,
      resultType,
      scopeKey,
      revisitPath,
    });

    fetch('/api/saju/personality/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scopeKey,
        lifeArea: payload.lifeArea,
        scoreJson: liveResult.scores,
        sajuFactsJson: liveResult.facts.sajuFacts,
        personalityFactsJson: liveResult.facts.personalityFacts,
        fusionFactsJson: liveResult.facts.fusionFacts,
        reportJson,
        productCode: resultType === 'paid' ? SAJU_PERSONALITY_MINI_PRODUCT_CODE : 'free',
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
        trackMoonlightEvent('saju_personality_report_saved', {
          source: 'saju_personality_result',
          lifeArea: payload.lifeArea,
          productCode: resultType === 'paid' ? SAJU_PERSONALITY_MINI_PRODUCT_CODE : 'free',
          reportType: resultType,
        });
      })
      .catch(() => {
        setSaveStatus('error');
      });
  }, [accessState, liveResult, payload, revisitPath, savedReport, scopeKey]);

  function handlePaidUnlockClick() {
    if (!scopeKey) {
      setCtaMessage('먼저 성향사주 무료 결과를 만든 뒤 깊이보기를 열 수 있습니다.');
      return;
    }

    trackMoonlightEvent('saju_personality_paid_unlock_clicked', {
      lifeArea: result?.lifeArea ?? payload?.lifeArea ?? null,
      productCode: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
      amount: SAJU_PERSONALITY_MINI_PRICE,
      reportType: analyticsResultType,
      source: 'saju_personality_report',
    });
    setCtaMessage('');
  }

  function handleCopyShareText() {
    if (!shareCard) return;

    const absoluteRevisitUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${shareCard.revisitPath}`
        : shareCard.revisitPath;
    const text = buildSajuPersonalityShareText(shareCard, absoluteRevisitUrl);

    if (!navigator.clipboard) {
      setCopyMessage('이 브라우저에서는 자동 복사가 지원되지 않습니다. 공유 카드 내용을 직접 선택해 주세요.');
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        trackMoonlightEvent('saju_personality_report_shared', buildAnalyticsPayload('copy_text'));
        setCopyMessage('개인정보 없이 공유 문구를 복사했습니다.');
      })
      .catch(() => {
        setCopyMessage('자동 복사를 완료하지 못했습니다. 공유 카드 내용을 직접 선택해 주세요.');
      });
  }

  function handleAiCta() {
    trackMoonlightEvent('saju_personality_ai_chat_started', buildAnalyticsPayload('dialogue'));
  }

  function handleFeedbackSubmit(rating: FeedbackRating) {
    setFeedbackRating(rating);
    trackMoonlightEvent('saju_personality_feedback_submitted', {
      ...buildAnalyticsPayload(),
      rating,
    });
  }

  if (loadState === 'loading') return <LoadingState />;
  if (!result) return <MissingInputState />;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage gangi-wide-flow space-y-6">
        <GangiPageHeader title="성향사주 결과" backHref="/saju/personality" />
        <PageIntro
          eyebrow="달빛 성향사주 결과"
          title="나의 결과 선택 습관을 함께 봅니다"
          description="무료 요약은 짧게, 깊이보기는 반복 패턴과 오늘의 실행 문장까지 이어지는 구조로 정리했습니다."
        />

        <ResultShell
          title={result.headline}
          summary={
            payload
              ? '무료 결과는 짧은 요약만 제공합니다. 더 깊은 원인과 실행 전략은 잠금 영역에 남겨두었습니다.'
              : '저장된 성향사주 결과를 다시 불러왔습니다. 공유 카드에는 개인정보를 표시하지 않습니다.'
          }
          keywords={[result.lifeAreaLabel, accessState === 'granted' ? '깊이보기' : '무료 결과', ...result.keywords]}
          scoreSummary={
            <AxisMeter
              label="전체 선명도"
              value={result.scores.totalClarityScore}
              description="사주와 성향 facts가 같은 방향을 얼마나 또렷하게 가리키는지 보는 참고 지표입니다."
            />
          }
        >
          <FusionStrip />

          {paymentNotice ? (
            <p className="rounded-[1rem] border border-[var(--app-jade)]/20 bg-[var(--app-jade)]/8 px-4 py-3 text-sm font-medium leading-6 text-[var(--app-copy)]">
              {paymentNotice}
            </p>
          ) : null}

          <GangiSection eyebrow={result.lifeAreaLabel} title="핵심 요약">
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((keyword) => (
                <GangiPill key={keyword}>{keyword}</GangiPill>
              ))}
            </div>
          </GangiSection>

          <ScoreSummary result={result} />

          <div className="grid gap-4 md:grid-cols-2">
            <GangiSection eyebrow="사주 기반 짧은 해석" title="타고난 결" description={result.sajuSummary} />
            <GangiSection
              eyebrow="성향 기반 짧은 해석"
              title="성향으로 드러나는 방식"
              description={result.personalitySummary}
            />
          </div>

          <LockedOrPaidSections result={result} accessState={accessState} />

          {shareCard ? (
            <ShareCard
              data={shareCard}
              reportId={reportId}
              saveStatus={saveStatus}
              copyMessage={copyMessage}
              onCopy={handleCopyShareText}
            />
          ) : null}

          <div className="rounded-[1.35rem] border border-[var(--app-line)] bg-white p-5 shadow-[0_18px_50px_-34px_rgba(17,17,20,0.28)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="app-caption text-[var(--app-pink-strong)]">다음 행동</p>
              <h2 className="mt-2 text-2xl text-[var(--app-ink)]">더 깊게 보거나 AI에게 이어서 물어볼 수 있어요</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--app-copy-soft)]">
                {accessState === 'granted'
                  ? '구매 권한이 확인되어 깊이보기 섹션이 열렸습니다.'
                  : `${SAJU_PERSONALITY_MINI_PRICE.toLocaleString('ko-KR')}원 결제 후 현재 결과 범위의 깊이보기를 열 수 있습니다.`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              {accessState === 'granted' ? (
                <span className={buttonVariants()}>
                  <Sparkles className="h-4 w-4" />
                  깊이보기 열림
                </span>
              ) : (
                <Link
                  href={checkoutHref}
                  onClick={handlePaidUnlockClick}
                  className={buttonVariants()}
                >
                  990원으로 깊이보기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {AI_CONSULTATION_CTAS.map((cta) =>
              reportId ? (
                <Link
                  key={cta.label}
                  href={buildAiConsultationHref(cta.question)}
                  onClick={handleAiCta}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <MessageCircle className="h-4 w-4" />
                  {cta.label}
                </Link>
              ) : (
                <button
                  key={cta.label}
                  type="button"
                  onClick={() => {
                    setCtaMessage('로그인 후 결과가 저장되면 리포트 요약 context를 붙여 AI 상담으로 이어갈 수 있습니다.');
                  }}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <MessageCircle className="h-4 w-4" />
                  {cta.label}
                </button>
              )
            )}
          </div>
          {ctaMessage ? (
            <p className="mt-4 rounded-[1rem] border border-[var(--app-jade)]/20 bg-[var(--app-jade)]/8 px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
              {ctaMessage}
            </p>
          ) : null}
          <p className="mt-3 text-xs leading-6 text-[var(--app-copy-soft)]">
            프리미엄 멤버십 포함 여부는 정책 확인 필요 항목입니다.
          </p>
          </div>

          <FeedbackPanel selectedRating={feedbackRating} onSubmit={handleFeedbackSubmit} />

          <SafetyNotice>{result.safetyNote}</SafetyNotice>

          <div className="flex flex-wrap gap-3">
            <Link href="/saju/personality" className={buttonVariants({ variant: 'secondary' })}>
              <ArrowLeft className="h-4 w-4" />
              다시 입력하기
            </Link>
            <Link href="/saju/new" className={cn(buttonVariants({ variant: 'outline' }))}>
              일반 사주 보기
            </Link>
          </div>
        </ResultShell>
      </AppPage>
    </AppShell>
  );
}
