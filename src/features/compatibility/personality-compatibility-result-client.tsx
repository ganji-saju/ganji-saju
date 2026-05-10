'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, MessageCircleQuestion, Sparkles } from 'lucide-react';
import {
  GangiActionRow,
  GangiIntro,
  GangiMetricBar,
  GangiMiniCard,
  GangiPageHeader,
  GangiPill,
  GangiSection,
} from '@/components/gangi/gangi-ui';
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
  buildPersonalityCompatibilityFreeResult,
  type PersonalityCompatibilityFreeResult,
} from '@/features/compatibility/personality-compatibility-result-builder';
import type { BirthInput } from '@/lib/saju/types';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

type ResultLoadState = 'loading' | 'ready' | 'missing';
type MockCtaKind = 'unlock' | 'ai';

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
              desc="결과, 결제, 저장은 아직 연결하지 않고 무료 미리보기 흐름만 확인합니다."
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
    <GangiSection
      eyebrow="5축 점수"
      title="한 점수보다 다섯 축을 함께 봅니다"
      description="갈등 지수는 높을수록 주의가 필요한 신호입니다."
      tone="pink"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {result.axisSummaries.map((axis) => (
          <article
            key={axis.key}
            className="rounded-[1.25rem] border border-[var(--app-line)] bg-white/80 p-4"
          >
            <GangiMetricBar label={axis.label} value={axis.value} color={axis.color} />
            <p className="mt-3 text-sm leading-6 text-[var(--app-copy-muted)]">{axis.caption}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 rounded-[1rem] border border-[var(--app-line)] bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-[var(--app-ink)]">
        종합 참고점수 {result.score.totalScore}점 · 관계를 단정하기보다 조율 포인트를 나누어 보는
        값입니다.
      </p>
    </GangiSection>
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

function LockedPreview({ result }: { result: PersonalityCompatibilityFreeResult }) {
  return (
    <GangiSection
      eyebrow="잠금 영역"
      title="깊이보기에서 열리는 내용"
      description="이번 단계에서는 결제 연결 없이, 열릴 섹션 구조만 보여줍니다."
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

export function PersonalityCompatibilityResultClient() {
  const [payload, setPayload] = useState<PersonalityCompatibilityInputPayload | null>(null);
  const [loadState, setLoadState] = useState<ResultLoadState>('loading');
  const [ctaMessage, setCtaMessage] = useState('');
  const result = useMemo(
    () => (payload ? buildPersonalityCompatibilityFreeResult(payload) : null),
    [payload]
  );

  useEffect(() => {
    const storedPayload = readStoredInputPayload();
    setPayload(storedPayload);
    setLoadState(storedPayload ? 'ready' : 'missing');
  }, []);

  function handleMockCta(kind: MockCtaKind) {
    console.info('personality compatibility result cta clicked', {
      action: kind,
      relationshipType: payload?.relationshipType,
      questionKey: payload?.questionKey,
    });
    setCtaMessage(
      kind === 'unlock'
        ? '다음 단계에서 990원 상세 풀이 결제 흐름에 연결할 수 있게 버튼 구조만 준비했습니다.'
        : '다음 단계에서 이 결과 맥락을 대화방에 전달할 수 있게 버튼 구조만 준비했습니다.'
    );
  }

  if (loadState === 'loading') return <LoadingState />;
  if (!payload || !result) return <MissingInputState />;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="성향궁합 결과" backHref="/compatibility/personality" />
        <GangiIntro
          eyebrow={`${result.relationshipLabel} · 무료 결과`}
          title={result.headline}
          description={`${payload.self.name}님과 ${payload.partner.name}님의 “${result.questionLabel}” 질문을 기준으로 정리했습니다.`}
        >
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
          </div>
        </GangiIntro>

        <ScoreSummary result={result} />

        <GangiSection eyebrow="관계 키워드" title="이 관계에서 먼저 보이는 단서">
          <div className="flex flex-wrap gap-2">
            {result.keywords.map((keyword) => (
              <GangiPill key={keyword}>{keyword}</GangiPill>
            ))}
          </div>
        </GangiSection>

        <FreeInterpretation result={result} />
        <LockedPreview result={result} />

        <section className="px-4 pb-8 sm:px-0">
          <div className="gangi-pink-panel p-4">
            <p className="gangi-sub-eyebrow mb-2">다음 액션</p>
            <h2 className="text-xl font-bold leading-7 text-[var(--app-ink)]">
              더 깊게 보거나, 이어서 물어볼 수 있게 준비했습니다
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--app-copy-muted)]">
              실제 결제와 대화방 연결은 다음 단계에서 붙일 수 있도록 mock CTA로만 동작합니다.
            </p>
            <GangiActionRow className="mt-4">
              <button
                type="button"
                onClick={() => handleMockCta('unlock')}
                className="gangi-primary-button"
              >
                <Sparkles className="h-4 w-4" />
                990원으로 깊이보기
              </button>
              <button
                type="button"
                onClick={() => handleMockCta('ai')}
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

        <section className="px-4 pb-8 sm:px-0">
          <p className="rounded-[1rem] border border-[var(--app-line)] bg-white/70 px-4 py-3 text-xs leading-6 text-[var(--app-copy-muted)]">
            {result.safetyNote}
          </p>
        </section>
      </AppPage>
    </AppShell>
  );
}
