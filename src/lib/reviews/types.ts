// 2026-05-18 Phase 7b — 후기(reviews) 도메인 타입.
// supabase/migrations/033_reviews.sql 와 정합.

export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  userId: string;
  productId: string;
  scopeKey: string;
  rating: number;
  content: string;
  displayName: string | null;
  isVerifiedPurchase: boolean;
  moderationStatus: ReviewModerationStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  moderatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// 공개 노출용 — userId 는 hash 로 가공.
export interface PublicReview {
  id: string;
  userIdHash: string;
  productId: string;
  scopeKey: string;
  rating: number;
  content: string;
  displayName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface ReviewDbRow {
  id: string;
  user_id: string;
  product_id: string;
  scope_key: string;
  rating: number;
  content: string;
  display_name: string | null;
  is_verified_purchase: boolean;
  moderation_status: ReviewModerationStatus;
  moderation_note: string | null;
  moderated_at: string | null;
  moderated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapReviewRow(row: ReviewDbRow): Review {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    scopeKey: row.scope_key,
    rating: row.rating,
    content: row.content,
    displayName: row.display_name,
    isVerifiedPurchase: row.is_verified_purchase,
    moderationStatus: row.moderation_status,
    moderationNote: row.moderation_note,
    moderatedAt: row.moderated_at,
    moderatedBy: row.moderated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 본문/별점/표시명 유효성 — DB CHECK 와 정합. API 에서 미리 검증.
export const REVIEW_CONTENT_MIN = 10;
export const REVIEW_CONTENT_MAX = 2000;
export const REVIEW_DISPLAY_NAME_MIN = 1;
export const REVIEW_DISPLAY_NAME_MAX = 24;

export interface ReviewValidationError {
  field: 'rating' | 'content' | 'displayName' | 'productId';
  message: string;
}

export function validateReviewInput(input: {
  productId?: unknown;
  rating?: unknown;
  content?: unknown;
  displayName?: unknown;
}): ReviewValidationError[] {
  const errors: ReviewValidationError[] = [];

  if (typeof input.productId !== 'string' || input.productId.trim().length === 0) {
    errors.push({ field: 'productId', message: '상품 ID 가 필요합니다.' });
  }

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push({ field: 'rating', message: '별점은 1~5 사이 정수여야 합니다.' });
  }

  if (typeof input.content !== 'string') {
    errors.push({ field: 'content', message: '본문이 필요합니다.' });
  } else {
    const trimmed = input.content.trim();
    if (trimmed.length < REVIEW_CONTENT_MIN) {
      errors.push({ field: 'content', message: `본문은 최소 ${REVIEW_CONTENT_MIN}자 이상이어야 합니다.` });
    } else if (trimmed.length > REVIEW_CONTENT_MAX) {
      errors.push({ field: 'content', message: `본문은 최대 ${REVIEW_CONTENT_MAX}자까지 가능합니다.` });
    }
  }

  if (input.displayName !== undefined && input.displayName !== null && input.displayName !== '') {
    if (typeof input.displayName !== 'string') {
      errors.push({ field: 'displayName', message: '표시명이 올바르지 않습니다.' });
    } else {
      const trimmed = input.displayName.trim();
      if (trimmed.length > REVIEW_DISPLAY_NAME_MAX) {
        errors.push({ field: 'displayName', message: `표시명은 최대 ${REVIEW_DISPLAY_NAME_MAX}자까지 가능합니다.` });
      }
    }
  }

  return errors;
}
