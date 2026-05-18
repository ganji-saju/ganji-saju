// 2026-05-18 Phase 7b — 후기 DB 헬퍼.
// API route 와 admin page 가 공유. RLS 가 anon SELECT 를 막지 않으므로 대부분 anon client OK.
// admin moderation 만 service_role 사용.
import {
  createClient,
  createPublicServerClient,
  createServiceClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import {
  mapReviewRow,
  type PublicReview,
  type Review,
  type ReviewDbRow,
  type ReviewModerationStatus,
} from './types';
import { hashUserIdForReview } from './hash';

const REVIEW_COLUMNS =
  'id, user_id, product_id, scope_key, rating, content, display_name, is_verified_purchase, moderation_status, moderation_note, moderated_at, moderated_by, created_at, updated_at';

function toPublic(row: ReviewDbRow): PublicReview {
  return {
    id: row.id,
    userIdHash: hashUserIdForReview(row.user_id),
    productId: row.product_id,
    scopeKey: row.scope_key,
    rating: row.rating,
    content: row.content,
    displayName: row.display_name?.trim() || '익명',
    isVerifiedPurchase: row.is_verified_purchase,
    createdAt: row.created_at,
  };
}

export async function listApprovedReviews(input: {
  productId?: string | null;
  scopeKey?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ reviews: PublicReview[]; total: number }> {
  if (!hasSupabaseServerEnv) return { reviews: [], total: 0 };
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const client = createPublicServerClient();
  let query = client
    .from('reviews')
    .select(REVIEW_COLUMNS, { count: 'exact' })
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.productId) query = query.eq('product_id', input.productId);
  if (input.scopeKey) query = query.eq('scope_key', input.scopeKey);

  const { data, error, count } = await query;
  if (error) {
    return { reviews: [], total: 0 };
  }

  const rows = (data as ReviewDbRow[] | null) ?? [];
  return {
    reviews: rows.map(toPublic),
    total: count ?? rows.length,
  };
}

export async function listOwnReviews(userId: string): Promise<Review[]> {
  if (!hasSupabaseServerEnv) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return ((data as ReviewDbRow[] | null) ?? []).map(mapReviewRow);
}

export async function getReviewById(reviewId: string): Promise<Review | null> {
  if (!hasSupabaseServerEnv) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('id', reviewId)
    .maybeSingle();
  if (error || !data) return null;
  return mapReviewRow(data as ReviewDbRow);
}

export async function findOwnReviewByProduct(input: {
  userId: string;
  productId: string;
  scopeKey: string;
}): Promise<Review | null> {
  if (!hasSupabaseServerEnv) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('user_id', input.userId)
    .eq('product_id', input.productId)
    .eq('scope_key', input.scopeKey)
    .maybeSingle();
  if (error || !data) return null;
  return mapReviewRow(data as ReviewDbRow);
}

export async function insertReview(input: {
  userId: string;
  productId: string;
  scopeKey: string;
  rating: number;
  content: string;
  displayName: string | null;
  isVerifiedPurchase: boolean;
}): Promise<Review | { error: string }> {
  if (!hasSupabaseServerEnv) return { error: 'supabase server env missing' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      user_id: input.userId,
      product_id: input.productId,
      scope_key: input.scopeKey,
      rating: input.rating,
      content: input.content.trim(),
      display_name: input.displayName?.trim() || null,
      is_verified_purchase: input.isVerifiedPurchase,
      moderation_status: 'pending',
    })
    .select(REVIEW_COLUMNS)
    .single();

  if (error || !data) {
    const message = error?.message ?? '후기 저장에 실패했습니다.';
    if (message.includes('duplicate key') || message.includes('unique')) {
      return { error: '이미 동일 상품에 후기를 작성하셨습니다.' };
    }
    return { error: message };
  }
  return mapReviewRow(data as ReviewDbRow);
}

export async function updateOwnReview(input: {
  userId: string;
  reviewId: string;
  rating?: number;
  content?: string;
  displayName?: string | null;
}): Promise<Review | { error: string }> {
  if (!hasSupabaseServerEnv) return { error: 'supabase server env missing' };
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    moderation_status: 'pending',
    moderation_note: null,
    moderated_at: null,
    moderated_by: null,
  };
  if (typeof input.rating === 'number') patch.rating = input.rating;
  if (typeof input.content === 'string') patch.content = input.content.trim();
  if (input.displayName !== undefined) patch.display_name = input.displayName?.trim() || null;

  const { data, error } = await supabase
    .from('reviews')
    .update(patch)
    .eq('id', input.reviewId)
    .eq('user_id', input.userId)
    .select(REVIEW_COLUMNS)
    .single();

  if (error || !data) {
    return { error: error?.message ?? '후기 수정에 실패했습니다.' };
  }
  return mapReviewRow(data as ReviewDbRow);
}

export async function deleteOwnReview(input: {
  userId: string;
  reviewId: string;
}): Promise<{ ok: true } | { error: string }> {
  if (!hasSupabaseServerEnv) return { error: 'supabase server env missing' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', input.reviewId)
    .eq('user_id', input.userId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function moderateReview(input: {
  reviewId: string;
  moderatorId: string;
  action: 'approve' | 'reject';
  note?: string | null;
}): Promise<Review | { error: string }> {
  if (!hasSupabaseServiceEnv) return { error: 'supabase service env missing' };
  const service = await createServiceClient();
  const status: ReviewModerationStatus = input.action === 'approve' ? 'approved' : 'rejected';
  const { data, error } = await service
    .from('reviews')
    .update({
      moderation_status: status,
      moderation_note: input.note ?? null,
      moderated_at: new Date().toISOString(),
      moderated_by: input.moderatorId,
    })
    .eq('id', input.reviewId)
    .select(REVIEW_COLUMNS)
    .single();
  if (error || !data) {
    return { error: error?.message ?? '검수 처리에 실패했습니다.' };
  }
  return mapReviewRow(data as ReviewDbRow);
}

export async function listPendingReviewsForAdmin(input: {
  status?: ReviewModerationStatus | 'all';
  limit?: number;
  offset?: number;
}): Promise<{ reviews: Review[]; total: number }> {
  if (!hasSupabaseServiceEnv) return { reviews: [], total: 0 };
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const service = await createServiceClient();

  let query = service
    .from('reviews')
    .select(REVIEW_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.status && input.status !== 'all') {
    query = query.eq('moderation_status', input.status);
  }

  const { data, error, count } = await query;
  if (error) return { reviews: [], total: 0 };
  return {
    reviews: ((data as ReviewDbRow[] | null) ?? []).map(mapReviewRow),
    total: count ?? 0,
  };
}
