// 2026-05-16 PR #151 (B2) — situation 수정 폼 (client).
// PR #147 의 SituationChipGroup 톤과 동일.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { UserSituation } from '@/lib/saju/types';

type Relationship = NonNullable<UserSituation['relationshipStatus']>;
type Occupation = NonNullable<UserSituation['occupation']>;
type Concern = NonNullable<UserSituation['currentConcern']>;

const REL_OPTIONS: Array<{ value: Relationship; label: string; emoji: string }> = [
  { value: 'single', label: '솔로', emoji: '💛' },
  { value: 'dating', label: '연애 중', emoji: '💑' },
  { value: 'married', label: '기혼', emoji: '💍' },
  { value: 'separated', label: '이별·정리 중', emoji: '🍂' },
];

const OCC_OPTIONS: Array<{ value: Occupation; label: string; emoji: string }> = [
  { value: 'employee', label: '직장인', emoji: '💼' },
  { value: 'self-employed', label: '자영업·프리랜서', emoji: '🛠' },
  { value: 'student', label: '학생', emoji: '📚' },
  { value: 'homemaker', label: '주부', emoji: '🏠' },
  { value: 'job-seeking', label: '구직 중', emoji: '🔎' },
  { value: 'other', label: '기타', emoji: '✨' },
];

const CON_OPTIONS: Array<{ value: Concern; label: string; emoji: string }> = [
  { value: 'business', label: '사업·이직', emoji: '🚀' },
  { value: 'romance', label: '결혼·연애', emoji: '💞' },
  { value: 'family', label: '자녀·가족', emoji: '👨‍👩‍👧' },
  { value: 'health', label: '건강·멘탈', emoji: '🩺' },
  { value: 'wealth', label: '재물·투자', emoji: '💰' },
  { value: 'other', label: '직접 입력', emoji: '✍️' },
];

function ChipGroup<T extends string>({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon?: string;
  value: T | null;
  onChange: (next: T | null) => void;
  options: Array<{ value: T; label: string; emoji: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[14.4px] font-bold text-[var(--app-copy-muted)]">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(selected ? null : option.value)}
              className="rounded-full border px-3.5 py-1.5 text-[14.4px] font-bold transition-all active:scale-95"
              style={
                selected
                  ? {
                      background: 'var(--app-pink-strong)',
                      color: 'white',
                      borderColor: 'var(--app-pink-strong)',
                      boxShadow: '0 4px 12px rgba(236,72,153,0.25)',
                    }
                  : {
                      background: 'white',
                      color: 'var(--app-copy)',
                      borderColor: 'var(--app-line)',
                    }
              }
            >
              <span aria-hidden="true" className="mr-1">
                {option.emoji}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MySituationForm({
  initialSituation,
}: {
  initialSituation: UserSituation | null;
}) {
  const [relationshipStatus, setRelationshipStatus] = useState<Relationship | null>(
    (initialSituation?.relationshipStatus as Relationship | undefined) ?? null
  );
  const [occupation, setOccupation] = useState<Occupation | null>(
    (initialSituation?.occupation as Occupation | undefined) ?? null
  );
  const [currentConcern, setCurrentConcern] = useState<Concern | null>(
    (initialSituation?.currentConcern as Concern | undefined) ?? null
  );
  const [concernNote, setConcernNote] = useState(initialSituation?.concernNote ?? '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const payload: Record<string, unknown> = {};
      if (relationshipStatus) payload.relationshipStatus = relationshipStatus;
      if (occupation) payload.occupation = occupation;
      if (currentConcern) payload.currentConcern = currentConcern;
      if (currentConcern === 'other' && concernNote.trim()) {
        payload.concernNote = concernNote.trim();
      }
      const res = await fetch('/api/profile/situation', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSavedMsg('저장됐어요. 다음 풀이부터 자동 반영됩니다.');
      } else {
        const data = await res.json().catch(() => null);
        setSavedMsg(data?.error ?? '저장 실패');
      }
    } catch {
      setSavedMsg('네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('저장된 상황 정보를 모두 지우시겠어요?')) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/profile/situation', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setRelationshipStatus(null);
        setOccupation(null);
        setCurrentConcern(null);
        setConcernNote('');
        setSavedMsg('지워졌어요.');
      }
    } catch {
      setSavedMsg('네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  const hasAny = Boolean(relationshipStatus || occupation || currentConcern || concernNote.trim());

  return (
    <section className="space-y-5 px-1">
      {/* §Hero */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          🎯 내 default 상황
        </div>
        <h1 className="mt-1.5 text-[23px] font-extrabold leading-snug text-[var(--app-ink)]">
          매번 입력하지 않아도 자동 반영
        </h1>
        <p
          className="mt-2 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          여기서 저장한 정보는 새 사주 풀이 / 오늘의 운세 / 궁합 결과에 자동으로 반영됩니다.
          기존 풀이(이미 저장된 reading)에는 영향이 없어요.
        </p>
      </article>

      {/* §form */}
      <section
        className="rounded-[16px] border bg-white p-4 space-y-4"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <ChipGroup
          label="현재 관계"
          icon="💑"
          value={relationshipStatus}
          onChange={setRelationshipStatus}
          options={REL_OPTIONS}
        />
        <ChipGroup
          label="현재 하시는 일"
          icon="💼"
          value={occupation}
          onChange={setOccupation}
          options={OCC_OPTIONS}
        />
        <ChipGroup
          label="요즘 가장 큰 고민"
          icon="💭"
          value={currentConcern}
          onChange={setCurrentConcern}
          options={CON_OPTIONS}
        />
        {currentConcern === 'other' ? (
          <input
            type="text"
            value={concernNote}
            onChange={(e) => setConcernNote(e.target.value.slice(0, 80))}
            placeholder="고민을 짧게 적어주세요 (최대 80자)"
            className="h-11 w-full rounded-[12px] border bg-white px-3 text-[15.5px] text-[var(--app-ink)] outline-none focus:border-[var(--app-pink)]"
            style={{ borderColor: 'var(--app-line)' }}
          />
        ) : null}
      </section>

      {/* §Save buttons */}
      <div className="grid gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full border px-4 py-3 text-[16.1px] font-extrabold text-white transition-transform active:scale-95 disabled:opacity-60"
          style={{
            background: 'var(--app-pink-strong)',
            borderColor: 'var(--app-pink-strong)',
          }}
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
        {hasAny ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={saving}
            className="rounded-full border bg-white px-4 py-2.5 text-[14.4px] font-bold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            저장된 정보 모두 지우기
          </button>
        ) : null}
      </div>
      {savedMsg ? (
        <p className="text-center text-[13.8px] text-[var(--app-jade)]">{savedMsg}</p>
      ) : null}

      {/* §Where it shows up */}
      <article
        className="rounded-[14px] border bg-white p-4"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
          ✓ 어디에 반영되나요?
        </div>
        <ul
          className="mt-1.5 grid gap-1 text-[13.2px] leading-[1.65] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          <li>• 사주 풀이 본문 호명 ("직장인이신 ○○님, ...")</li>
          <li>• 사주 결과 hero 아래 chip 카드</li>
          <li>• 오늘 운세 영역 점수 순서 자동 재정렬</li>
          <li>• 궁합 페이지 perspective 한 줄</li>
        </ul>
        <Link
          href="/saju/new"
          className="mt-3 inline-block text-[13.2px] font-bold text-[var(--app-pink-strong)] underline-offset-2 hover:underline"
        >
          새 사주 풀이 받기 →
        </Link>
      </article>
    </section>
  );
}
