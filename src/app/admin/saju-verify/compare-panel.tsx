// 2026-05-14: 검증 도구의 비교 패널 — 사용자가 사이트에서 본 풀이 원문을
// 붙여 넣으면, 예상 값(년주·일간·용신 등)이 본문에 정확히 등장하는지 자동 검사.
// 텍스트 매칭으로 "이 풀이가 같은 사주의 결과가 맞나" 를 1초 안에 확인.
'use client';

import { useMemo, useState } from 'react';

export interface ExpectedValues {
  yearGanzi: string;
  monthGanzi: string;
  dayGanzi: string;
  hourGanzi: string | null;
  dayMaster: string;
  dayMasterElement: string;
  dominantElement: string;
  weakestElement: string;
  strengthLevel: string | null;
  yongsinPrimary: string | null;
  yongsinPrimaryValue: string | null;
  saewoonGanzi: string | null;
  wolwoonGanzi: string | null;
  currentMajorGanzi: string | null;
}

interface CheckResult {
  label: string;
  expected: string;
  found: boolean;
  matchedTokens: string[];
  optional?: boolean;
}

function checkPresence(text: string, ...tokens: Array<string | null | undefined>): CheckResult['matchedTokens'] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    if (lower.includes(token.toLowerCase())) {
      matched.push(token);
    }
  }
  return matched;
}

const STRENGTH_ALIASES: Record<string, string[]> = {
  신강: ['신강', '에너지가 강', '강한 편'],
  중화: ['중화', '균형이 잡힌'],
  신약: ['신약', '에너지가 차분', '차분한 편'],
};

const ELEMENT_ALIASES: Record<string, string[]> = {
  목: ['목', '나무 기운', '木'],
  화: ['화', '불 기운', '火'],
  토: ['토', '땅 기운', '土'],
  금: ['금', '쇠 기운', '金'],
  수: ['수', '물 기운', '水'],
};

export function SajuVerifyComparePanel({ expected }: { expected: ExpectedValues }) {
  const [siteText, setSiteText] = useState('');

  const results = useMemo<CheckResult[]>(() => {
    const text = siteText.trim();
    if (!text) return [];

    const out: CheckResult[] = [];

    // 4 기둥
    out.push({
      label: '년주',
      expected: expected.yearGanzi,
      matchedTokens: checkPresence(text, expected.yearGanzi),
      found: checkPresence(text, expected.yearGanzi).length > 0,
    });
    out.push({
      label: '월주',
      expected: expected.monthGanzi,
      matchedTokens: checkPresence(text, expected.monthGanzi),
      found: checkPresence(text, expected.monthGanzi).length > 0,
    });
    out.push({
      label: '일주',
      expected: expected.dayGanzi,
      matchedTokens: checkPresence(text, expected.dayGanzi),
      found: checkPresence(text, expected.dayGanzi).length > 0,
    });
    if (expected.hourGanzi) {
      out.push({
        label: '시주',
        expected: expected.hourGanzi,
        matchedTokens: checkPresence(text, expected.hourGanzi),
        found: checkPresence(text, expected.hourGanzi).length > 0,
        optional: true,
      });
    }

    // 일간 (한자 또는 일간 명시)
    out.push({
      label: '일간',
      expected: `${expected.dayMaster} (${expected.dayMasterElement})`,
      matchedTokens: checkPresence(text, expected.dayMaster, ...(ELEMENT_ALIASES[expected.dayMasterElement] ?? [])),
      found: checkPresence(text, expected.dayMaster, ...(ELEMENT_ALIASES[expected.dayMasterElement] ?? [])).length > 0,
    });

    // 우세/약세 오행
    out.push({
      label: '우세 오행',
      expected: expected.dominantElement,
      matchedTokens: checkPresence(text, ...(ELEMENT_ALIASES[expected.dominantElement] ?? [])),
      found: checkPresence(text, ...(ELEMENT_ALIASES[expected.dominantElement] ?? [])).length > 0,
    });
    out.push({
      label: '약세 오행',
      expected: expected.weakestElement,
      matchedTokens: checkPresence(text, ...(ELEMENT_ALIASES[expected.weakestElement] ?? [])),
      found: checkPresence(text, ...(ELEMENT_ALIASES[expected.weakestElement] ?? [])).length > 0,
    });

    // 신강/신약
    if (expected.strengthLevel) {
      const aliases = STRENGTH_ALIASES[expected.strengthLevel] ?? [expected.strengthLevel];
      out.push({
        label: '신강/신약',
        expected: expected.strengthLevel,
        matchedTokens: checkPresence(text, ...aliases),
        found: checkPresence(text, ...aliases).length > 0,
      });
    }

    // 용신
    if (expected.yongsinPrimary || expected.yongsinPrimaryValue) {
      const tokens = [
        expected.yongsinPrimary,
        expected.yongsinPrimaryValue,
        ...(expected.yongsinPrimaryValue ? ELEMENT_ALIASES[expected.yongsinPrimaryValue] ?? [] : []),
        '용신',
        '도움이 되는 핵심 기운',
        '도움이 되는 기운',
      ].filter(Boolean) as string[];
      out.push({
        label: '용신',
        expected: expected.yongsinPrimary ?? expected.yongsinPrimaryValue ?? '',
        matchedTokens: checkPresence(text, ...tokens),
        found: checkPresence(text, expected.yongsinPrimary, expected.yongsinPrimaryValue).length > 0,
      });
    }

    // 대운/세운/월운
    if (expected.currentMajorGanzi) {
      out.push({
        label: '대운 (긴 흐름)',
        expected: expected.currentMajorGanzi,
        matchedTokens: checkPresence(text, expected.currentMajorGanzi, '대운', '긴 흐름'),
        found: checkPresence(text, expected.currentMajorGanzi).length > 0,
        optional: true,
      });
    }
    if (expected.saewoonGanzi) {
      out.push({
        label: '세운 (올해 흐름)',
        expected: expected.saewoonGanzi,
        matchedTokens: checkPresence(text, expected.saewoonGanzi, '세운', '올해 흐름'),
        found: checkPresence(text, expected.saewoonGanzi).length > 0,
        optional: true,
      });
    }
    if (expected.wolwoonGanzi) {
      out.push({
        label: '월운 (이번 달 흐름)',
        expected: expected.wolwoonGanzi,
        matchedTokens: checkPresence(text, expected.wolwoonGanzi, '월운', '이번 달 흐름'),
        found: checkPresence(text, expected.wolwoonGanzi).length > 0,
        optional: true,
      });
    }

    return out;
  }, [siteText, expected]);

  const required = results.filter((result) => !result.optional);
  const requiredPassed = required.filter((result) => result.found).length;
  const optionalPassed = results.filter((result) => result.optional && result.found).length;
  const optionalTotal = results.filter((result) => result.optional).length;

  return (
    <section className="rounded-[18px] border bg-white p-5" style={{ borderColor: 'var(--app-pink-line)' }}>
      <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
        STEP 3 · 사이트 풀이 원문 붙여넣기
      </div>
      <h2 className="mt-1 text-[18.4px] font-extrabold text-[var(--app-ink)]">
        사이트에서 본 풀이 텍스트를 그대로 붙여넣으세요
      </h2>
      <p className="mt-1.5 text-[13.8px] leading-[1.65] text-[var(--app-copy-muted)]">
        붙이는 즉시, 위 입력으로 계산된 핵심 값(년주·일간·우세 오행·신강/신약·용신·세운 등)이
        본문에 정확히 등장하는지 자동 비교합니다.
      </p>

      <textarea
        value={siteText}
        onChange={(event) => setSiteText(event.target.value)}
        placeholder="예: '갑자 일주, 木 일간으로 신강한 편이며 용신은 火입니다 …'"
        className="mt-3 min-h-[200px] w-full rounded-[12px] border bg-white p-3 text-[15px] leading-[1.7] text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)]"
        style={{ borderColor: 'var(--app-line)' }}
      />

      {results.length > 0 ? (
        <>
          {/* §요약 */}
          <article
            className="mt-4 rounded-[14px] border p-4"
            style={{
              background:
                requiredPassed === required.length ? '#e8f5ee' : '#fdf6e7',
              borderColor:
                requiredPassed === required.length
                  ? 'rgba(45,135,88,0.22)'
                  : 'rgba(184,122,20,0.22)',
            }}
          >
            <div
              className="text-[12.6px] font-extrabold uppercase tracking-[0.06em]"
              style={{
                color: requiredPassed === required.length ? 'var(--app-jade)' : '#b87a14',
              }}
            >
              검증 결과
            </div>
            <h3 className="mt-1 text-[20.7px] font-extrabold leading-[1.4] text-[var(--app-ink)]">
              필수 {requiredPassed}/{required.length} 매칭{' '}
              {optionalTotal > 0 ? `· 선택 ${optionalPassed}/${optionalTotal}` : ''}
              {requiredPassed === required.length ? ' ✓' : ' ⚠'}
            </h3>
            <p className="mt-1 text-[14.4px] leading-[1.65] text-[var(--app-copy)]">
              {requiredPassed === required.length
                ? '핵심 계산값이 풀이 본문에 모두 등장합니다 — 같은 사주의 풀이로 보입니다.'
                : '일부 핵심 값이 본문에서 발견되지 않았어요. 다른 사주 입력의 풀이거나, 본문이 한자/한글 변환되어 매칭이 빠진 것일 수 있어요.'}
            </p>
          </article>

          {/* §항목별 결과 */}
          <ul className="mt-3 grid gap-2">
            {results.map((result) => (
              <li
                key={result.label}
                className="rounded-[12px] border bg-white p-3"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14.4px] font-extrabold text-[var(--app-ink)]">
                        {result.label}
                      </span>
                      {result.optional ? (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10.9px] font-extrabold text-[var(--app-copy-muted)]"
                          style={{ background: 'rgba(0,0,0,0.04)' }}
                        >
                          선택
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[13.2px] text-[var(--app-copy-muted)]">
                      예상값: <strong className="text-[var(--app-ink)]">{result.expected}</strong>
                    </div>
                  </div>
                  <span
                    className="shrink-0 inline-flex h-7 items-center rounded-full border px-2.5 text-[12.6px] font-extrabold"
                    style={
                      result.found
                        ? {
                            background: '#e8f5ee',
                            color: 'var(--app-jade)',
                            borderColor: 'rgba(45,135,88,0.28)',
                          }
                        : {
                            background: '#fdecec',
                            color: 'var(--app-coral)',
                            borderColor: 'rgba(198,69,69,0.28)',
                          }
                    }
                  >
                    {result.found ? '✓ 발견' : '× 미발견'}
                  </span>
                </div>
                {result.matchedTokens.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {result.matchedTokens.map((token) => (
                      <span
                        key={token}
                        className="rounded-full bg-[var(--app-pink-soft)] px-2 py-0.5 text-[12.1px] font-extrabold text-[var(--app-pink-strong)]"
                      >
                        {token}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
