import {
  getTasteProductPackage,
  isBundlePackage,
  type PaymentPackage,
  type TasteProductId,
} from './catalog';

export interface BundleGrantInput {
  tasteProductId: TasteProductId;
  /** 고정 scope(예: score-factor 'F1'). 없으면 결제 scope 를 상속(today-detail 등). */
  scope: string | null;
  /** resolvePaymentProductScope 에 넘길 단품 패키지(scopeKey 파생용). */
  pkg: PaymentPackage;
}

// 묶음 패키지를 구성품별 grant 입력으로 분해한다. confirm 이 이 목록을 순회하며
// resolvePaymentProductScope + grantTasteProductEntitlement 를 호출해 1결제로 N권한을
// 부여한다. 묶음이 아니면 빈 배열.
export function resolveBundleGrantInputs(bundle: PaymentPackage): BundleGrantInput[] {
  if (!isBundlePackage(bundle)) return [];

  const inputs: BundleGrantInput[] = [];
  for (const component of bundle.components) {
    const pkg = getTasteProductPackage(component.tasteProductId);
    if (!pkg) continue;
    inputs.push({
      tasteProductId: component.tasteProductId,
      scope: component.scope ?? null,
      pkg,
    });
  }
  return inputs;
}

export interface BundleGrantContext {
  userId: string;
  slug: string | null;
  orderId: string | null;
  paymentKey: string | null;
  packageId: string;
}

export interface BundleGrantTasteOptions {
  scopeKey: string | null;
  orderId: string | null;
  paymentKey: string | null;
  amount: number | null;
  packageId: string;
}

export interface BundleGrantDeps {
  resolveScope: (input: {
    pkg: PaymentPackage;
    slug: string | null;
    scope: string | null;
  }) => Promise<{ scopeKey: string | null } | null>;
  grant: (
    userId: string,
    productId: TasteProductId,
    options: BundleGrantTasteOptions
  ) => Promise<unknown>;
}

export interface BundleGrantResult {
  tasteProductId: TasteProductId;
  scopeKey: string | null;
}

// 묶음 결제 승인 후 구성품을 개별 grant 한다. confirm 이 resolvePaymentProductScope 와
// grantTasteProductEntitlement 를 주입(라우트 DB 의존 분리). scope 파생 실패 구성품은
// 건너뛴다(부분 실패가 전체 결제를 막지 않음). 모든 grant 는 같은 paymentKey/packageId 를
// 가져 환불 시 paymentKey 로 일괄 회수할 수 있다. 묶음가가 총액이라 구성품별 amount=null.
export async function grantBundleComponents(
  bundle: PaymentPackage,
  ctx: BundleGrantContext,
  deps: BundleGrantDeps
): Promise<BundleGrantResult[]> {
  const results: BundleGrantResult[] = [];
  for (const input of resolveBundleGrantInputs(bundle)) {
    const scope = await deps.resolveScope({ pkg: input.pkg, slug: ctx.slug, scope: input.scope });
    if (!scope) continue;
    await deps.grant(ctx.userId, input.tasteProductId, {
      scopeKey: scope.scopeKey,
      orderId: ctx.orderId,
      paymentKey: ctx.paymentKey,
      amount: null,
      packageId: ctx.packageId,
    });
    results.push({ tasteProductId: input.tasteProductId, scopeKey: scope.scopeKey });
  }
  return results;
}

export interface BundleOwnershipDeps {
  resolveScope: (input: {
    pkg: PaymentPackage;
    slug: string | null;
    scope: string | null;
  }) => Promise<{ scopeKey: string | null } | null>;
  hasEntitlement: (productId: TasteProductId, scopeKey: string | null) => Promise<boolean>;
}

// prepare 의 묶음 중복 결제 차단(b1 정합). 구성품을 전부 보유한 경우에만 true →
// alreadyPurchased. 하나라도 미보유면 false(재결제 허용 — 보유분은 grant 가 멱등 skip).
// 묶음이 아니면 false.
export async function areAllBundleComponentsOwned(
  bundle: PaymentPackage,
  slug: string | null,
  deps: BundleOwnershipDeps
): Promise<boolean> {
  const inputs = resolveBundleGrantInputs(bundle);
  if (inputs.length === 0) return false;

  for (const input of inputs) {
    const scope = await deps.resolveScope({ pkg: input.pkg, slug, scope: input.scope });
    const owned = scope ? await deps.hasEntitlement(input.tasteProductId, scope.scopeKey) : false;
    if (!owned) return false;
  }
  return true;
}
