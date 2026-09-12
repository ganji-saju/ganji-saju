'use server';
// 할인쿠폰 관리 서버 액션(PR6 — /admin/coupons, super_admin).
//
// 🔴 이 파일의 export 는 전부 공개 POST 엔드포인트다 — 첫 줄에서 super_admin 을 다시 확인한다(가드 테스트가 강제).
//   레이아웃·페이지 가드는 액션에 이어지지 않는다. 서버 액션은 Next 가 Origin=Host 를 검사한다(라우트 핸들러엔 CSRF 검사가
//   없어 staging 하위 도메인의 same-site POST 가 프로덕션 관리자 API 를 부를 수 있다 — 그래서 이쪽을 쓴다).
// 인자는 FormData 만 — dev 서버함수 로거가 객체 인자를 터미널에 찍는다(해제 조회 입력 = 코드일 수 있다).
// 오류는 반환값으로(throw 금지 — 프로덕션에서 메시지가 지워지고 소비자 error.tsx 로 간다).
// 코드 평문이 서버 밖으로 나가는 곳은 exportBatchAction 하나 — 감사 기록이 **먼저** 성공해야 한다(사용자 결정: 언제든 재다운로드
//   + 다운로드마다 감사).
import type { SupabaseClient } from '@supabase/supabase-js';
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import type { AdminAction } from '@/lib/admin/access-log';
import {
  adminCouponEnv,
  CouponAdminError,
  exportCouponBatch,
  issueCouponBatch,
  lookupCouponHolder,
  normalizeBatchName,
  recordCouponAudit,
  releaseHeldCoupon,
  restoreCouponBatch,
  revokeCouponBatch,
  scrubCouponCodes,
  setCouponBatchExpiry,
  setCouponTierDisabled,
  updateCouponTier,
  validateExpiresOn,
  validateIssueInput,
  validateTierInput,
  type HolderLookup,
} from '@/lib/coupons/coupon-admin';
import { couponEnvForHost } from '@/lib/coupons/coupon-charge';
import { COUPON_TIERS, type CouponEnv } from '@/lib/coupons/discount-coupon';
import { sendOpsAlertEmail } from '@/lib/email/ops-alert-email';
import { hashIp } from '@/lib/policies';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export interface CouponActionResult {
  ok: boolean;
  message: string;
}
export interface IssueActionResult extends CouponActionResult {
  /** 방금 발급한 배치(인쇄용 CSV 를 바로 받게). 코드는 없다 — 코드는 exportBatchAction 으로만 나간다. */
  batch?: string;
}
export interface LookupActionResult extends CouponActionResult {
  lookup?: HolderLookup;
}
export interface ExportActionResult extends CouponActionResult {
  csv?: string;
  fileName?: string;
}

type Admin =
  | { ok: true; userId: string; service: SupabaseClient; env: CouponEnv; ipHash: string | null }
  | { ok: false; message: string };

async function requireSuperAdmin(): Promise<Admin> {
  const guard = await getCurrentAdminRole(await createClient());
  if (!guard.ok || guard.role !== 'super_admin' || !guard.userId) return { ok: false, message: 'super_admin 권한이 필요합니다.' };
  if (!hasSupabaseServiceEnv) return { ok: false, message: '서버 설정(service key)이 없어 처리할 수 없습니다.' };
  const h = await headers();
  return {
    ok: true,
    userId: guard.userId,
    service: await createServiceClient(),
    // 로컬 dev 가 Host 를 운영으로 바꿔도 운영 배포(VERCEL_ENV)가 아니면 null — 같은 DB 의 실물 쿠폰을 못 건드린다.
    env: adminCouponEnv(couponEnvForHost(h.get('host')), process.env.VERCEL_ENV),
    ipHash: hashIp(h.get('x-forwarded-for')?.split(',')[0] ?? null),
  };
}

type OkAdmin = Extract<Admin, { ok: true }>;

function str(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === 'string' ? value : '';
}

/** 이 모듈의 고정 문구만 보여 준다 — 그 밖의 오류(message 에 행·코드 원문이 있을 수 있다)는 일반 문구로. */
function failure(op: string, err: unknown): CouponActionResult {
  if (err instanceof CouponAdminError) return { ok: false, message: err.message };
  console.error(`[coupon-admin] ${op} 예외`, err instanceof Error ? err.name : 'unknown');
  return { ok: false, message: `${op}을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.` };
}

/** 쓰기 뒤 감사 기록. 실패해도 변경은 이미 됐다 — 되돌리지 않고 결과 문구에 알린다(내보내기는 이 함수 대신 strict 로). */
async function auditAfterWrite(
  admin: OkAdmin,
  action: AdminAction,
  meta: Record<string, unknown>,
  extra: { targetUser?: string | null; reason?: string | null } = {}
): Promise<string> {
  try {
    await recordCouponAudit(admin.service, {
      actorId: admin.userId,
      actorRole: 'super_admin',
      action,
      meta,
      targetUser: extra.targetUser ?? null,
      reason: extra.reason ?? null,
      ipHash: admin.ipHash,
    });
    return '';
  } catch {
    return ' ⚠️ 감사 기록에 실패했어요(변경은 반영됨) — 서버 로그를 확인해 주세요.';
  }
}

/**
 * 운영 배포에서 쿠폰 가치가 늘어나는 조작(발급·되살리기·만료 변경·요율·내보내기)을 운영 메일로 알린다 — 관리자 세션이
 * 탈취됐을 때 가장 싼 탐지 수단이다(관리자 화면에도 제3자 스크립트가 로드된다). 코드 평문은 넣지 않는다.
 */
function alertOps(admin: OkAdmin, subject: string, lines: string[]): void {
  if (process.env.VERCEL_ENV !== 'production') return;
  after(() =>
    sendOpsAlertEmail({ subject: `[할인쿠폰] ${subject}`, lines: [...lines, `행위자: ${admin.userId}`], url: '/admin/coupons' }).catch(
      () => undefined
    )
  );
}

/** 파괴적 배치 조작의 확인 입력 — 같은 정규화(NFC·공백)로 비교해야 맥에서 붙여 넣은 이름도 맞는다. */
function confirmedBatch(fd: FormData): string | null {
  const batch = normalizeBatchName(str(fd, 'batch'));
  return batch && batch === normalizeBatchName(str(fd, 'confirm')) ? batch : null;
}

const won = (n: number | null) => (n == null ? '없음' : `${n.toLocaleString('ko-KR')}원`);

export async function updateTierAction(fd: FormData): Promise<CouponActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  if (admin.env !== 'production') return { ok: false, message: '요율은 운영 배포에서만 바꿀 수 있습니다(staging 과 운영이 같은 등급 값을 씁니다).' };
  const input = validateTierInput({
    tier: str(fd, 'tier'),
    percent: str(fd, 'percent'),
    maxDiscountWon: str(fd, 'maxDiscountWon'),
    noCap: str(fd, 'noCap'),
  });
  if (!input.ok) return { ok: false, message: input.error };
  const { tier, percent, maxDiscountWon } = input.value;
  const applyToBound = str(fd, 'applyToBound') === 'on';
  try {
    const out = await updateCouponTier(admin.service, { ...input.value, applyToBound, seenUpdatedAt: str(fd, 'seenUpdatedAt') }, admin.userId);
    const note = await auditAfterWrite(admin, 'coupon_tier_update', {
      tier,
      percent,
      maxDiscountWon,
      applyToBound,
      retroCount: out.retroCount,
      retroFailed: out.retroFailed,
    });
    alertOps(admin, `${tier}등급 요율 변경`, [`${percent}% · 상한 ${won(maxDiscountWon)} · 소급 ${applyToBound ? `${out.retroCount}건` : '안 함'}`]);
    refresh();
    const parts = [`${tier}등급을 ${percent}% · 상한 ${won(maxDiscountWon)}으로 바꿨어요.`];
    if (applyToBound) {
      parts.push(out.retroFailed ? '⚠️ 소급은 실패했어요 — 같은 값으로 다시 저장하면 소급만 다시 됩니다.' : `이미 귀속된 ${out.retroCount}건에도 적용했어요.`);
    }
    if (out.auditFailed) parts.push('⚠️ 요율 변경 이력 기록에 실패했어요 — 서버 로그를 확인해 주세요.');
    return { ok: true, message: parts.join(' ') + note };
  } catch (err) {
    return failure('요율 변경', err);
  }
}

export async function toggleTierAction(fd: FormData): Promise<CouponActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  if (admin.env !== 'production') return { ok: false, message: '등급은 운영 배포에서만 켜고 끌 수 있습니다(staging 과 운영이 같은 등급 값을 씁니다).' };
  const tier = COUPON_TIERS.find((t) => t === str(fd, 'tier'));
  if (!tier) return { ok: false, message: '등급이 올바르지 않습니다.' };
  const disabled = str(fd, 'disabled') === '1';
  try {
    await setCouponTierDisabled(admin.service, tier, disabled, str(fd, 'seenUpdatedAt'), admin.userId);
    const note = await auditAfterWrite(admin, 'coupon_tier_toggle', { tier, disabled });
    alertOps(admin, `${tier}등급 ${disabled ? '끔' : '켬'}`, [disabled ? '이 등급 쿠폰 전부(귀속자 포함)가 즉시 적용되지 않습니다.' : '이 등급 쿠폰이 다시 적용됩니다.']);
    refresh();
    return { ok: true, message: `${tier}등급을 ${disabled ? '껐어요(귀속자 포함 즉시 적용 중지)' : '다시 켰어요'}.${note}` };
  } catch (err) {
    return failure('등급 켜기/끄기', err);
  }
}

export async function issueBatchAction(fd: FormData): Promise<IssueActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  const input = validateIssueInput(
    { tier: str(fd, 'tier'), count: str(fd, 'count'), batch: str(fd, 'batch'), expiresOn: str(fd, 'expiresOn') },
    admin.env,
    new Date()
  );
  if (!input.ok) return { ok: false, message: input.error };
  const append = str(fd, 'append') === 'on';
  try {
    const out = await issueCouponBatch(admin.service, { ...input.value, append }, admin.userId, admin.env);
    const note = await auditAfterWrite(admin, 'coupon_issue', {
      batch: out.batch,
      tier: out.tier,
      count: out.count,
      expiresAt: out.expiresAt,
      createdAt: out.createdAt,
      append,
    });
    alertOps(admin, `발급 ${out.count}장`, [`배치 ${out.batch} · ${out.tier}등급 · 만료 ${out.expiresAt}`]);
    refresh();
    return {
      ok: true,
      batch: out.batch,
      message: `'${out.batch}' 배치에 ${out.tier}등급 ${out.count}장을 발급했어요. 인쇄용 코드는 CSV 로 받으세요.${note}`,
    };
  } catch (err) {
    return failure('발급', err);
  }
}

export async function revokeBatchAction(fd: FormData): Promise<CouponActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  const batch = confirmedBatch(fd);
  if (!batch) return { ok: false, message: '확인용 배치 이름이 일치하지 않습니다.' };
  try {
    const out = await revokeCouponBatch(admin.service, batch, admin.env);
    const note = await auditAfterWrite(admin, 'coupon_batch_revoke', { batch, stamp: out.stamp, count: out.count });
    refresh();
    return { ok: true, message: `'${batch}' 배치 ${out.count}장을 회수했어요. 이 배치의 결제 전 할인 주문도 승인이 거부됩니다.${note}` };
  } catch (err) {
    return failure('배치 회수', err);
  }
}

export async function restoreBatchAction(fd: FormData): Promise<CouponActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  const batch = confirmedBatch(fd);
  if (!batch) return { ok: false, message: '확인용 배치 이름이 일치하지 않습니다.' };
  const stamp = str(fd, 'stamp');
  try {
    const out = await restoreCouponBatch(admin.service, batch, stamp, admin.env);
    const note = await auditAfterWrite(admin, 'coupon_batch_restore', { batch, stamp, count: out.count });
    alertOps(admin, `회수 되살리기 ${out.count}장`, [`배치 ${batch} · 회수 시각 ${stamp}`]);
    refresh();
    return {
      ok: true,
      message: `'${batch}' 배치 ${out.count}장을 되살렸어요. 회수 중 새 쿠폰으로 옮긴 계정의 옛 쿠폰(해제됨)은 돌아오지 않습니다.${note}`,
    };
  } catch (err) {
    return failure('회수 되살리기', err);
  }
}

export async function setBatchExpiryAction(fd: FormData): Promise<CouponActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  const batch = confirmedBatch(fd);
  if (!batch) return { ok: false, message: '확인용 배치 이름이 일치하지 않습니다.' };
  const expires = validateExpiresOn(str(fd, 'expiresOn'), new Date());
  if (!expires.ok) return { ok: false, message: expires.error };
  try {
    const out = await setCouponBatchExpiry(admin.service, batch, expires.value, admin.env);
    const note = await auditAfterWrite(admin, 'coupon_batch_expiry', {
      batch,
      oldMin: out.oldMin,
      oldMax: out.oldMax,
      newExpiresAt: expires.value,
      count: out.count,
    });
    alertOps(admin, `만료일 변경 ${out.count}장`, [`배치 ${batch} · ${out.oldMin ?? '-'}~${out.oldMax ?? '-'} → ${expires.value}`]);
    refresh();
    return { ok: true, message: `'${batch}' 배치 ${out.count}장의 만료일을 바꿨어요.${note}` };
  } catch (err) {
    return failure('만료일 변경', err);
  }
}

export async function lookupHolderAction(fd: FormData): Promise<LookupActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  try {
    const lookup = await lookupCouponHolder(admin.service, str(fd, 'query'), admin.env);
    // 코드 → 보유자 연결은 개인정보 열람이다. 기록 실패는 조회를 막지 않는다(쓰기가 아니다).
    if (lookup.found && lookup.holder) {
      await auditAfterWrite(admin, 'coupon_lookup', { batch: lookup.batch, maskedCode: lookup.maskedCode }, { targetUser: lookup.holder });
    }
    return { ok: true, message: lookup.found ? '' : '해당하는 쿠폰을 찾지 못했어요.', lookup };
  } catch (err) {
    return failure('쿠폰 조회', err);
  }
}

export async function releaseCouponAction(fd: FormData): Promise<CouponActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  // 사유에 코드를 붙여 넣기 쉽다 — 감사 로그 reason 은 평문으로 12개월 남는다.
  const reason = scrubCouponCodes(str(fd, 'reason').trim());
  if (reason.length < 2) return { ok: false, message: '해제 사유를 2자 이상 적어 주세요.' };
  const holder = str(fd, 'holder');
  const boundAt = str(fd, 'boundAt');
  try {
    const out = await releaseHeldCoupon(admin.service, holder, boundAt, admin.env);
    const note = await auditAfterWrite(
      admin,
      'coupon_release',
      { batch: out.batch, maskedCode: out.maskedCode, boundAt, releasedAt: out.releasedAt },
      { targetUser: holder, reason }
    );
    refresh();
    return { ok: true, message: `${out.maskedCode} 쿠폰을 해제했어요. 이 계정은 이제 새 쿠폰을 쓸 수 있고, 이 코드는 다시 쓸 수 없습니다.${note}` };
  } catch (err) {
    return failure('귀속 해제', err);
  }
}

export async function exportBatchAction(fd: FormData): Promise<ExportActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin.ok) return admin;
  const batch = normalizeBatchName(str(fd, 'batch'));
  if (!batch) return { ok: false, message: '배치 이름이 올바르지 않습니다.' };
  try {
    const out = await exportCouponBatch(admin.service, batch, admin.env);
    // 🔴 감사가 먼저다(사용자 결정 — 다운로드마다 기록). 실패하면 코드를 내보내지 않는다(recordCouponAudit 가 던진다).
    await recordCouponAudit(admin.service, {
      actorId: admin.userId,
      actorRole: 'super_admin',
      action: 'coupon_export',
      meta: { batch, rowCount: out.rowCount, liveUnbound: out.liveUnbound, fileName: out.fileName },
      ipHash: admin.ipHash,
    });
    alertOps(admin, `코드 내보내기 ${out.rowCount}장`, [`배치 ${batch} · 미사용 ${out.liveUnbound}장`]);
    return { ok: true, message: `'${batch}' 배치 ${out.rowCount}장(미사용 ${out.liveUnbound}장)을 내려받습니다.`, csv: out.csv, fileName: out.fileName };
  } catch (err) {
    return failure('내보내기', err);
  }
}
