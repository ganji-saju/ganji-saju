'use client';
// 할인쿠폰 관리 화면(PR6). 서버 액션을 이벤트 핸들러에서 부른다(useActionState 는 React 19.2 가 결과와 무관하게 폼을 리셋한다).
// 🔴 코드 평문을 state·DOM 에 두지 않는다(관리자 화면에도 GTM 이 로드된다) — CSV 는 받는 즉시 Blob 으로 내려받고 버린다.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { CouponBatchStat, CouponTierStat, HolderLookup } from '@/lib/coupons/coupon-admin';
import { STAGING_TEST_BATCH, type CouponEnv } from '@/lib/coupons/discount-coupon';
import {
  exportBatchAction,
  issueBatchAction,
  lookupHolderAction,
  releaseCouponAction,
  restoreBatchAction,
  revokeBatchAction,
  setBatchExpiryAction,
  toggleTierAction,
  updateTierAction,
  type CouponActionResult,
} from './actions';

interface Props {
  env: CouponEnv;
  view: { tiers: CouponTierStat[]; batches: CouponBatchStat[] } | null;
  limits: { issueMax: number; minCapWon: number; expiryMaxDays: number };
}

const th = 'px-2.5 py-2 text-left text-[11.5px] font-bold text-[var(--app-copy-soft)] whitespace-nowrap';
const td = 'px-2.5 py-2 text-[13px] tabular-nums whitespace-nowrap';
const inputCls = 'rounded-[8px] border border-[var(--app-line)] bg-white px-2 py-1 text-[13px]';
const btn = 'rounded-[8px] px-3 py-1.5 text-[13px] font-bold disabled:opacity-40';
const btnInk = `${btn} bg-[var(--app-ink)] text-white`;
const btnLine = `${btn} border border-[var(--app-line)] bg-white text-[var(--app-ink)]`;
const btnDanger = `${btn} border border-[var(--app-coral)] bg-white text-[var(--app-coral)]`;

const won = (n: number | null) => (n == null ? '없음' : `${n.toLocaleString('ko-KR')}원`);
const day = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10) : '-');

function formData(fields: Record<string, string | boolean>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === true) fd.set(key, 'on');
    else if (value !== false) fd.set(key, value);
  }
  return fd;
}

export function CouponAdminClient({ env, view, limits }: Props) {
  const [message, setMessage] = useState<CouponActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  /** 액션 실행 — 결과 문구만 남긴다(코드 평문은 결과에 없다. 내보내기만 예외라 download 가 따로 처리한다). */
  function run(action: (fd: FormData) => Promise<CouponActionResult>, fd: FormData, after?: (r: CouponActionResult) => void) {
    startTransition(async () => {
      const result = await action(fd);
      setMessage(result);
      after?.(result);
    });
  }

  function download(batch: string) {
    startTransition(async () => {
      const result = await exportBatchAction(formData({ batch }));
      setMessage({ ok: result.ok, message: result.message });
      if (!result.ok || !result.csv) return;
      const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); // 문서에 붙이지 않는다 — DOM 에 남기지 않는다
      link.href = url;
      link.download = result.fileName ?? 'ganji-coupons.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <EnvBanner env={env} />
      {message?.message ? (
        <div
          role="status"
          className={`rounded-[10px] border p-3 text-[13px] leading-relaxed text-[var(--app-ink)] ${
            message.ok ? 'border-[var(--app-jade)] bg-[var(--app-jade)]/5' : 'border-[var(--app-coral)] bg-[var(--app-coral)]/5'
          }`}
        >
          {message.message}
        </div>
      ) : null}
      {view ? null : (
        <div className="rounded-[10px] border border-[var(--app-coral)] bg-[var(--app-coral)]/5 p-3 text-[13px] text-[var(--app-ink)]">
          현황을 불러오지 못했어요 — 서버 로그를 확인해 주세요. 숫자가 0 으로 보이는 게 아니라 아예 못 읽은 상태입니다.
        </div>
      )}
      {view ? <TierSection tiers={view.tiers} env={env} minCapWon={limits.minCapWon} pending={pending} run={run} /> : null}
      <IssueSection tiers={view?.tiers ?? []} env={env} limits={limits} pending={pending} run={run} download={download} />
      {view ? <BatchSection batches={view.batches} env={env} pending={pending} run={run} download={download} /> : null}
      <ReleaseSection env={env} pending={pending} setMessage={setMessage} startTransition={startTransition} />
      <ul className="grid gap-1 text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
        <li>· 결제 = 운영 결제 완료(confirmed·fulfilling·fulfilled). 탈퇴한 계정의 주문은 삭제되어 집계에서 빠집니다.</li>
        <li>· 7일 귀속은 &lsquo;최근 귀속 시각&rsquo; 기준입니다(24시간 미결제 회수·재귀속이 시각을 덮어씁니다). 24시간 귀속은 정확합니다.</li>
        <li>· 태우기 의심 = 24시간 귀속이 20건(또는 발급의 5%) 이상인데 그 코드들의 결제가 10% 미만. 기준은 운영하며 조정합니다.</li>
      </ul>
    </div>
  );
}

function EnvBanner({ env }: { env: CouponEnv }) {
  const text =
    env === 'production'
      ? '운영 배포 — 실물 전단 쿠폰을 다룹니다. 모든 변경이 즉시 실제 결제에 반영됩니다.'
      : env === 'test'
        ? `staging·로컬 — '${STAGING_TEST_BATCH}' 배치만 발급·회수할 수 있습니다(같은 DB). 요율·등급은 운영에서만 바꿉니다.`
        : '이 배포(preview 등)에서는 쿠폰을 바꿀 수 없습니다. 현황만 봅니다.';
  return (
    <div className="rounded-[12px] border border-[var(--app-gold,#D59B2E)] bg-[var(--app-gold,#D59B2E)]/10 p-3 text-[13px] leading-relaxed text-[var(--app-ink)]">
      {text}
    </div>
  );
}

type Run = (action: (fd: FormData) => Promise<CouponActionResult>, fd: FormData, after?: (r: CouponActionResult) => void) => void;

function TierSection({ tiers, env, minCapWon, pending, run }: { tiers: CouponTierStat[]; env: CouponEnv; minCapWon: number; pending: boolean; run: Run }) {
  const editable = env === 'production';
  return (
    <section className="grid gap-2">
      <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">등급 요율</h2>
      <p className="text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
        코드의 숫자(ganji-10-…)는 등급 이름일 뿐, 실제 할인율은 여기 값입니다. 바꾸면 새로 쓰는 고객부터 적용되고, 이미 쓰는 고객은 &lsquo;소급&rsquo;을 켜야 바뀝니다.
      </p>
      <div className="overflow-x-auto rounded-[12px] border border-[var(--app-line)] bg-white">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--app-line)] bg-[var(--app-pink-soft)]">
            <tr>
              <th className={th}>등급</th>
              <th className={th}>할인율</th>
              <th className={th}>주문당 상한</th>
              <th className={th}>발급 / 남은 번호</th>
              <th className={th}>쓰는 계정(옛 조건)</th>
              <th className={th}>변경</th>
              <th className={th}>켜기/끄기</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <TierRow key={`${tier.tier}-${tier.updatedAt}`} tier={tier} editable={editable} minCapWon={minCapWon} pending={pending} run={run} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TierRow({ tier, editable, minCapWon, pending, run }: { tier: CouponTierStat; editable: boolean; minCapWon: number; pending: boolean; run: Run }) {
  const [percent, setPercent] = useState(String(tier.percent));
  const [cap, setCap] = useState(tier.maxDiscountWon == null ? '' : String(tier.maxDiscountWon));
  const [noCap, setNoCap] = useState(tier.maxDiscountWon == null);
  const [retro, setRetro] = useState(false);
  const disabled = Boolean(tier.disabledAt);

  function save() {
    const nextCap = noCap ? '없음' : `${Number(cap).toLocaleString('ko-KR')}원`;
    const lines = [
      `${tier.tier}등급: 할인율 ${tier.percent}% → ${percent}%, 상한 ${won(tier.maxDiscountWon)} → ${nextCap}`,
      retro
        ? `이미 쓰는 계정 ${tier.boundHeld}건(그중 테스트 ${tier.boundHeldTest}건)에도 소급합니다. 진행 중인 옛 할인가 주문은 승인이 거부됩니다.`
        : '소급하지 않으면 이미 쓰는 계정은 지금 조건 그대로입니다.',
    ];
    if (!window.confirm(`${lines.join('\n')}\n\n저장할까요?`)) return;
    run(updateTierAction, formData({ tier: tier.tier, percent, maxDiscountWon: cap, noCap, applyToBound: retro, seenUpdatedAt: tier.updatedAt }));
  }

  function toggle() {
    const question = disabled
      ? `${tier.tier}등급을 다시 켤까요? 이 등급 쿠폰이 다시 적용됩니다.`
      : `${tier.tier}등급을 끌까요? 이 등급 쿠폰 전부(이미 쓰는 계정 포함)가 즉시 적용되지 않습니다.`;
    if (!window.confirm(question)) return;
    run(toggleTierAction, formData({ tier: tier.tier, disabled: disabled ? '0' : '1', seenUpdatedAt: tier.updatedAt }));
  }

  return (
    <tr className="border-t border-[var(--app-line)] align-top">
      <td className={`${td} font-bold text-[var(--app-ink)]`}>
        {tier.tier}
        {disabled ? <span className="ml-1 text-[11px] text-[var(--app-coral)]">꺼짐</span> : null}
      </td>
      <td className={td}>
        <input className={`${inputCls} w-16 text-right`} inputMode="numeric" value={percent} disabled={!editable} onChange={(e) => setPercent(e.target.value)} />%
      </td>
      <td className={td}>
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} w-24 text-right`}
            inputMode="numeric"
            placeholder={`${minCapWon.toLocaleString('ko-KR')} 이상`}
            value={cap}
            disabled={!editable || noCap}
            onChange={(e) => setCap(e.target.value)}
          />
          <label className="flex items-center gap-1 text-[11.5px] text-[var(--app-copy)]">
            <input type="checkbox" checked={noCap} disabled={!editable} onChange={(e) => setNoCap(e.target.checked)} />
            상한 없음
          </label>
        </div>
      </td>
      <td className={td}>
        {tier.issued.toLocaleString('ko-KR')} / {tier.remaining.toLocaleString('ko-KR')}
        <span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">추측 {(tier.guessRate * 100).toFixed(1)}%</span>
      </td>
      <td className={td}>
        {tier.boundHeld.toLocaleString('ko-KR')}
        <span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">({tier.snapshotStale.toLocaleString('ko-KR')})</span>
      </td>
      <td className={td}>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11.5px] text-[var(--app-copy)]">
            <input type="checkbox" checked={retro} disabled={!editable} onChange={(e) => setRetro(e.target.checked)} />
            소급
          </label>
          <button type="button" className={btnInk} disabled={!editable || pending} onClick={save}>
            저장
          </button>
        </div>
      </td>
      <td className={td}>
        <button type="button" className={disabled ? btnLine : btnDanger} disabled={!editable || pending} onClick={toggle}>
          {disabled ? '켜기' : '끄기'}
        </button>
      </td>
    </tr>
  );
}

function IssueSection({
  tiers,
  env,
  limits,
  pending,
  run,
  download,
}: {
  tiers: CouponTierStat[];
  env: CouponEnv;
  limits: Props['limits'];
  pending: boolean;
  run: Run;
  download: (batch: string) => void;
}) {
  const [tier, setTier] = useState('10');
  const [count, setCount] = useState('');
  const [batch, setBatch] = useState(env === 'test' ? STAGING_TEST_BATCH : '');
  const [expiresOn, setExpiresOn] = useState('2027-12-31'); // 설계 §11 D 결정값
  const [append, setAppend] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const stat = tiers.find((t) => t.tier === tier);
  const n = Number(count) || 0;

  function submit() {
    const after = stat ? ` 발급 후 이 등급 추측 성공률 ${(((stat.issued + n) / 10_000) * 100).toFixed(1)}%.` : '';
    const question = `${tier}등급 ${n.toLocaleString('ko-KR')}장을 '${batch.trim()}' 배치로 발급합니다(만료 ${expiresOn}, ${append ? '기존 배치에 추가' : '새 배치'}).\n발급량이 곧 추측 성공률입니다 — 인쇄할 수량만 발급하세요.${after}\n\n진행할까요?`;
    if (!window.confirm(question)) return;
    run(issueBatchAction, formData({ tier, count, batch, expiresOn, append }), (result) => {
      const issuedBatch = (result as { batch?: string }).batch;
      if (result.ok && issuedBatch) {
        setIssued(issuedBatch);
        setCount('');
      }
    });
  }

  return (
    <section className="grid gap-2 rounded-[12px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">발급</h2>
      <p className="text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
        번호는 무작위 4자리로 뽑습니다(등급당 10,000개). 한 번에 {limits.issueMax.toLocaleString('ko-KR')}장까지. 배치 이름은 ROI·회수의 단위라 개인정보(고객 이름·이메일)를 넣지 마세요.
        피해 고객에게 1장 재발급할 때는 &lsquo;기존 배치에 추가&rsquo;를 켜고 운영용 배치(예: CS 재발급)에 더하세요.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[11.5px] text-[var(--app-copy)]">
          등급
          <select className={inputCls} value={tier} onChange={(e) => setTier(e.target.value)} disabled={!env}>
            {['10', '20', '30', '40', '50'].map((t) => (
              <option key={t} value={t}>
                {t} ({tiers.find((x) => x.tier === t)?.percent ?? '-'}%)
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11.5px] text-[var(--app-copy)]">
          수량
          <input className={`${inputCls} w-24 text-right`} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} disabled={!env} />
        </label>
        <label className="grid gap-1 text-[11.5px] text-[var(--app-copy)]">
          배치 이름
          <input
            className={`${inputCls} w-56`}
            maxLength={40}
            placeholder="2026-09 강남 전단"
            value={batch}
            readOnly={env === 'test'}
            onChange={(e) => setBatch(e.target.value)}
            disabled={!env}
          />
        </label>
        <label className="grid gap-1 text-[11.5px] text-[var(--app-copy)]">
          만료일(KST)
          <input className={inputCls} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} disabled={!env} />
        </label>
        <label className="flex items-center gap-1 pb-1.5 text-[11.5px] text-[var(--app-copy)]">
          <input type="checkbox" checked={append} onChange={(e) => setAppend(e.target.checked)} disabled={!env} />
          기존 배치에 추가
        </label>
        <button type="button" className={btnInk} disabled={!env || pending || !n || !batch.trim()} onClick={submit}>
          발급
        </button>
      </div>
      {stat ? (
        <p className="text-[11.5px] text-[var(--app-copy-soft)]">
          {tier}등급 남은 번호 {stat.remaining.toLocaleString('ko-KR')}개 · 만료는 최대 {limits.expiryMaxDays}일 뒤까지
        </p>
      ) : null}
      {issued ? (
        <div className="flex items-center gap-2 text-[13px] text-[var(--app-ink)]">
          &lsquo;{issued}&rsquo; 배치를 발급했어요.
          <button type="button" className={btnLine} disabled={pending} onClick={() => download(issued)}>
            인쇄용 CSV 받기
          </button>
        </div>
      ) : null}
    </section>
  );
}

function BatchSection({
  batches,
  env,
  pending,
  run,
  download,
}: {
  batches: CouponBatchStat[];
  env: CouponEnv;
  pending: boolean;
  run: Run;
  download: (batch: string) => void;
}) {
  /** 파괴적 배치 조작의 확인 — 배치 이름을 다시 입력받는다(서버가 같은 정규화로 한 번 더 비교한다). */
  function confirmName(batch: string, warning: string): string | null {
    const typed = window.prompt(`${warning}\n\n확인을 위해 배치 이름을 그대로 입력하세요: ${batch}`);
    return typed == null ? null : typed;
  }
  const writable = (batch: CouponBatchStat) => env === 'production' || (env === 'test' && batch.isTest);

  function revoke(b: CouponBatchStat) {
    const confirm = confirmName(b.batch, `'${b.batch}' 배치를 회수합니다. 미사용·사용 중 쿠폰이 즉시 적용되지 않고, 결제 전 할인 주문도 승인이 거부됩니다.`);
    if (confirm != null) run(revokeBatchAction, formData({ batch: b.batch, confirm }));
  }
  function restore(b: CouponBatchStat, stamp: string) {
    const confirm = confirmName(b.batch, `'${b.batch}' 배치의 ${day(stamp)} 회수를 되돌립니다. 그사이 새 쿠폰으로 옮긴 계정의 옛 쿠폰은 돌아오지 않습니다.`);
    if (confirm != null) run(restoreBatchAction, formData({ batch: b.batch, confirm, stamp }));
  }
  function expiry(b: CouponBatchStat) {
    const expiresOn = window.prompt(`'${b.batch}' 배치의 새 만료일(KST, YYYY-MM-DD). 지금 ${day(b.expiresMin)} ~ ${day(b.expiresMax)}`);
    if (!expiresOn) return;
    const confirm = confirmName(b.batch, `'${b.batch}' 배치 ${b.issued}장의 만료일을 ${expiresOn} 로 바꿉니다. 늘리면 만료된 쿠폰도 다시 살아납니다(해제된 쿠폰은 제외).`);
    if (confirm != null) run(setBatchExpiryAction, formData({ batch: b.batch, confirm, expiresOn }));
  }

  return (
    <section className="grid gap-2">
      <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">배치 현황</h2>
      {batches.length === 0 ? (
        <p className="text-[13px] text-[var(--app-copy-soft)]">아직 발급한 쿠폰이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-[var(--app-line)] bg-white">
          <table className="w-full border-collapse">
            <thead className="border-b border-[var(--app-line)] bg-[var(--app-pink-soft)]">
              <tr>
                <th className={th}>배치</th>
                <th className={th}>등급</th>
                <th className={th}>발급</th>
                <th className={th}>미사용</th>
                <th className={th}>사용 중</th>
                <th className={th}>해제</th>
                <th className={th}>회수</th>
                <th className={th}>만료</th>
                <th className={th}>귀속 24h / 7d</th>
                <th className={th}>결제 · 매출</th>
                <th className={th}>할인액</th>
                <th className={th}>환불</th>
                <th className={th}>만료일</th>
                <th className={th}>작업</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch} className={`border-t border-[var(--app-line)] align-top ${b.burnSignal ? 'bg-[var(--app-coral)]/5' : ''}`}>
                  <td className={`${td} font-semibold text-[var(--app-ink)]`}>
                    {b.batch}
                    {b.isTest ? <span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">테스트</span> : null}
                    {b.burnSignal ? <span className="ml-1 text-[11px] font-bold text-[var(--app-coral)]">⚠️ 태우기 의심</span> : null}
                  </td>
                  <td className={td}>{b.tiers.join('·')}</td>
                  <td className={td}>{b.issued.toLocaleString('ko-KR')}</td>
                  <td className={td}>{b.unbound.toLocaleString('ko-KR')}</td>
                  <td className={td}>{b.live.toLocaleString('ko-KR')}</td>
                  <td className={td}>{b.released.toLocaleString('ko-KR')}</td>
                  <td className={td}>{b.disabled.toLocaleString('ko-KR')}</td>
                  <td className={td}>{b.expired.toLocaleString('ko-KR')}</td>
                  <td className={td}>
                    {b.bound24h} / {b.boundRecent7d}
                    <span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">결제 {b.paidCodes24h}</span>
                  </td>
                  <td className={td}>
                    {b.paidOrders}건 · {won(b.paidAmount)}
                  </td>
                  <td className={td}>{won(b.discountWon)}</td>
                  <td className={td}>{b.refundedOrders}</td>
                  <td className={td}>
                    {day(b.expiresMin)}
                    {b.expiresMax !== b.expiresMin ? ` ~ ${day(b.expiresMax)}` : ''}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={btnLine} disabled={!writable(b) || pending} onClick={() => download(b.batch)}>
                        CSV
                      </button>
                      <button type="button" className={btnLine} disabled={!writable(b) || pending} onClick={() => expiry(b)}>
                        만료 변경
                      </button>
                      <button type="button" className={btnDanger} disabled={!writable(b) || pending || b.unbound + b.live === 0} onClick={() => revoke(b)}>
                        회수
                      </button>
                      {b.disabledStamps.map((stamp) => (
                        <button key={stamp} type="button" className={btnLine} disabled={!writable(b) || pending} onClick={() => restore(b, stamp)}>
                          {day(stamp)} 회수 되살리기
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const STATE_LABEL: Record<string, string> = {
  unbound: '미사용',
  live: '사용 중',
  released: '해제됨',
  disabled: '회수됨',
  expired: '만료',
};

function ReleaseSection({
  env,
  pending,
  setMessage,
  startTransition,
}: {
  env: CouponEnv;
  pending: boolean;
  setMessage: (m: CouponActionResult | null) => void;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<HolderLookup | null>(null);

  function search() {
    startTransition(async () => {
      const result = await lookupHolderAction(formData({ query }));
      setMessage(result.ok && !result.message ? null : { ok: result.ok, message: result.message });
      setLookup(result.lookup ?? null);
      if (result.ok) setQuery(''); // 입력한 코드를 화면에 오래 두지 않는다
    });
  }

  function release(found: Extract<HolderLookup, { found: true }>) {
    const reason = window.prompt('해제 사유(2자 이상). 예: 새 전단 코드로 바꾸기 원함 — 고객 문의');
    if (reason == null) return;
    const warning = found.pendingOrders > 0 ? `\n⚠️ 결제 진행 중 ${found.pendingOrders}건 — 해제하면 카드 인증 뒤 승인이 거부됩니다.` : '';
    if (!window.confirm(`${found.maskedCode} 쿠폰을 해제합니다. 이 코드는 다시 쓸 수 없고, 계정은 새 쿠폰을 쓸 수 있게 됩니다.${warning}\n\n진행할까요?`)) return;
    startTransition(async () => {
      const result = await releaseCouponAction(formData({ holder: found.holder ?? '', boundAt: found.boundAt ?? '', reason }));
      setMessage(result);
      if (result.ok) setLookup(null);
    });
  }

  return (
    <section className="grid gap-2 rounded-[12px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">귀속 해제</h2>
      <p className="text-[11.5px] leading-relaxed text-[var(--app-copy-soft)]">
        계정은 쿠폰을 동시에 1개만 가집니다. &lsquo;이 계정에는 이미 사용 중인 쿠폰&rsquo; 문의에서 새 코드로 바꾸려면 지금 쿠폰을 해제하세요. 해제한 코드는 누구도 다시 쓸 수
        없습니다. 남이 먼저 쓴 코드의 피해 고객은 해제가 아니라 새 코드 1장 발급으로 돕습니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} w-72`}
          placeholder="쿠폰 코드 · 사용자 UUID · 이메일"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!env}
        />
        <button type="button" className={btnLine} disabled={!env || pending || !query.trim()} onClick={search}>
          조회
        </button>
      </div>
      {lookup?.found ? (
        <div className="grid gap-1 rounded-[10px] border border-[var(--app-line)] p-3 text-[13px] text-[var(--app-ink)]">
          <div>
            {lookup.maskedCode} · 배치 {lookup.batch ?? '-'} · <b>{STATE_LABEL[lookup.state] ?? lookup.state}</b>
          </div>
          {lookup.holder ? (
            <>
              <div>
                보유 계정: {lookup.holderEmail ?? '(이메일 없음)'} · {lookup.providers.join('·') || 'email'} · 가입 {day(lookup.holderCreatedAt)}{' '}
                <Link className="underline" href={`/admin/users/${lookup.holder}`}>
                  사용자 상세
                </Link>
              </div>
              <div className="text-[11.5px] text-[var(--app-copy-soft)]">
                귀속 {lookup.boundAt ? new Date(lookup.boundAt).toLocaleString('ko-KR') : '-'} · 결제 완료 {lookup.completedOrders}건(탈퇴 계정 주문은 안 보임)
              </div>
              {lookup.pendingOrders > 0 ? (
                <div className="text-[13px] font-bold text-[var(--app-coral)]">⚠️ 결제 진행 중 {lookup.pendingOrders}건 — 해제하면 카드 인증 뒤 승인이 거부됩니다.</div>
              ) : null}
              {lookup.state !== 'released' ? (
                <div>
                  <button type="button" className={btnDanger} disabled={pending} onClick={() => release(lookup)}>
                    이 계정의 쿠폰 해제
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-[11.5px] text-[var(--app-copy-soft)]">아직 아무 계정에도 귀속되지 않았습니다.</div>
          )}
        </div>
      ) : null}
    </section>
  );
}
