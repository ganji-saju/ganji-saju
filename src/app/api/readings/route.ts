import { NextRequest, NextResponse, after } from 'next/server';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import { toSlug } from '@/lib/saju/pillars';
import {
  createReading,
  deleteReadingForUser,
  getReadingCountForUser,
  resolveReading,
} from '@/lib/saju/readings';
// 2026-06-29 — 총평 LLM 캐시 프리워밍(생성 직후 백그라운드). 결과 재조회·동시조회 시 캐시 hit.
import { generateTotalReview } from '@/server/ai/saju-total-review-service';
import { isTotalReviewLLMEnabled } from '@/server/ai/total-review/total-review-cache';
import { rememberAnonymousReading } from '@/lib/saju/anonymous-reading-claim';
import {
  isUnifiedBirthEntryDraft,
  resolveUnifiedBirthInput,
} from '@/lib/saju/unified-birth-entry';
// 2026-05-15 PR 1: 사용자 현재 상황 입력 (연애/직업/고민).
import type {
  ConcernCategory,
  OccupationCategory,
  RelationshipStatus,
  UserSituation,
} from '@/lib/saju/types';

const VALID_RELATIONSHIP: ReadonlySet<RelationshipStatus> = new Set([
  'single',
  'dating',
  'married',
  'separated',
]);
const VALID_OCCUPATION: ReadonlySet<OccupationCategory> = new Set([
  'employee',
  'self-employed',
  'student',
  'homemaker',
  'job-seeking',
  'other',
]);
const VALID_CONCERN: ReadonlySet<ConcernCategory> = new Set([
  'business',
  'romance',
  'family',
  'health',
  'wealth',
  'other',
]);

function parseUserSituation(payload: unknown): UserSituation | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = (payload as Record<string, unknown>).userSituation;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const situation: UserSituation = {};
  if (typeof record.relationshipStatus === 'string' && VALID_RELATIONSHIP.has(record.relationshipStatus as RelationshipStatus)) {
    situation.relationshipStatus = record.relationshipStatus as RelationshipStatus;
  }
  if (typeof record.occupation === 'string' && VALID_OCCUPATION.has(record.occupation as OccupationCategory)) {
    situation.occupation = record.occupation as OccupationCategory;
  }
  if (typeof record.currentConcern === 'string' && VALID_CONCERN.has(record.currentConcern as ConcernCategory)) {
    situation.currentConcern = record.currentConcern as ConcernCategory;
  }
  if (typeof record.concernNote === 'string') {
    const note = record.concernNote.trim().slice(0, 80);
    if (note) situation.concernNote = note;
  }
  // 모든 필드가 비어 있으면 null 반환 (DB 에 빈 객체 저장 방지).
  return situation.relationshipStatus || situation.occupation || situation.currentConcern || situation.concernNote
    ? situation
    : null;
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const userSituation = parseUserSituation(payload);
  const parsed = isUnifiedBirthEntryDraft(payload)
    ? resolveUnifiedBirthInput(payload)
    : parseBirthInputDraft(payload);

  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  if (!hasSupabaseServerEnv) {
    return NextResponse.json(
      {
        id: toSlug(parsed.input),
        mode: 'preview',
      },
      { status: 200 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !hasSupabaseServiceEnv) {
    return NextResponse.json(
      {
        id: toSlug(parsed.input),
        mode: 'preview',
      },
      { status: 200 }
    );
  }

  // PR #151 (B2) — payload 에 situation 없으면 profiles.user_situation 을 fallback 으로.
  // 로그인 사용자가 /my/situation 에 저장해둔 default 가 새 reading 에 자동 반영.
  let effectiveSituation = userSituation;
  if (!effectiveSituation && user?.id) {
    try {
      const { getUserSituationForUser } = await import('@/lib/profile/user-situation');
      effectiveSituation = await getUserSituationForUser(supabase, user.id);
    } catch {
      // silent — situation 없이도 reading 정상 생성.
    }
  }

  try {
    const id = await createReading(parsed.input, user?.id ?? null, effectiveSituation);

    // 총평 LLM 캐시 프리워밍 — 응답 후 백그라운드(after)로 생성해 캐시를 데운다.
    //   같은 사주+컨텍스트는 1회만 생성되므로(read-through 캐시), 결과 재조회·동시 조회가 빨라진다.
    //   resolveReading 으로 페이지와 동일한 sajuData/grounding 을 재사용(인자 중복 없음).
    if (isTotalReviewLLMEnabled()) {
      after(async () => {
        try {
          const reading = await resolveReading(id);
          const personalizationContext = reading?.grounding?.personalizationContext;
          if (!reading || !personalizationContext) return;
          await generateTotalReview({
            sajuData: reading.sajuData,
            personalizationContext,
            userName: reading.input.name?.trim() || null,
            gender:
              reading.input.gender === 'female'
                ? 'F'
                : reading.input.gender === 'male'
                  ? 'M'
                  : null,
          });
        } catch {
          // 프리워밍 실패는 무시 — 결과 페이지가 어차피 on-demand 생성/표시한다.
        }
      });
    }

    const response = NextResponse.json({ id });

    // 2026-07-19 — 비로그인 사용자가 만든 사주는 user_id 가 NULL 이라 "누가 만들었는지"가
    //   DB 에 남지 않는다. 나중에 이 사람이 벽(유료 언락)에서 가입할 때 그 사주를 계정에
    //   붙여주려면 증거가 필요하다 → 이 브라우저에만 httpOnly 영수증을 남긴다.
    //   (로그인 사용자는 이미 user_id 가 박히므로 대상 아님)
    if (!user) rememberAnonymousReading(req, response, id);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      !hasSupabaseServiceEnv &&
      /row-level security|permission denied|violates row-level security|policy/i.test(message)
    ) {
      return NextResponse.json(
        {
          id: toSlug(parsed.input),
          mode: 'preview',
          warning: 'readings_owner_policy_required',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error:
          message
            ? message
            : '사주 결과를 생성하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const id =
    payload && typeof payload === 'object' && 'id' in payload
      ? String(payload.id ?? '').trim()
      : '';

  if (!id) {
    return NextResponse.json({ error: '삭제할 결과가 필요합니다.' }, { status: 400 });
  }

  try {
    const deleted = await deleteReadingForUser(id, user.id);

    if (!deleted) {
      return NextResponse.json({ error: '삭제할 결과를 찾지 못했습니다.' }, { status: 404 });
    }

    const readingCount = await getReadingCountForUser(user.id);

    return NextResponse.json({ success: true, readingCount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '결과를 삭제하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}
