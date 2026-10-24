'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { fail, ok, type FormState } from '@/features/platform/lib/formState';

export interface PlatformReview {
  id: string;
  rating: number;
  comment?: string | null;
  isApproved?: boolean | null;
  createdAt?: string | null;
  reviewerName?: string | null;
  client?: { id: string; displayName?: string | null } | null;
  service?: { name?: string | null } | null;
  stylist?: { user?: { name?: string | null } | null } | null;
  appointment?: { id: string; startTime?: string | null; location?: { timezone?: string | null } | null } | null;
}

export interface ReviewQueue {
  reviews: PlatformReview[];
  counts: { pending: number; approved: number; total: number };
  averageRating: number | null;
}

function where(status: string) {
  if (status === 'approved') return { isApproved: { equals: true } };
  if (status === 'all') return {};
  return { isApproved: { equals: false } };
}

export async function getReviewQueue(status: string): Promise<ReviewQueue | null> {
  const response = await keystoneClient<{ reviews: PlatformReview[]; pending: number; approved: number; total: number; ratings: { rating: number }[] }>(`
    query ReviewQueue($where: ReviewWhereInput!) {
      reviews(where: $where, orderBy: { createdAt: desc }, take: 100) {
        id rating comment isApproved createdAt reviewerName
        client { id displayName } service { name } stylist { user { name } }
        appointment { id startTime location { timezone } }
      }
      pending: reviewsCount(where: { isApproved: { equals: false } })
      approved: reviewsCount(where: { isApproved: { equals: true } })
      total: reviewsCount
      ratings: reviews(where: { isApproved: { equals: true } }, take: 5000) { rating }
    }
  `, { where: where(status) });
  if (!response.success) return null;
  const ratings = response.data.ratings || [];
  return {
    reviews: response.data.reviews || [],
    counts: { pending: response.data.pending || 0, approved: response.data.approved || 0, total: response.data.total || 0 },
    averageRating: ratings.length ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length : null,
  };
}

async function setApproval(id: string, isApproved: boolean): Promise<FormState> {
  if (!id) return fail('Review not found.');
  const response = await keystoneClient<{ updateReview: { id: string } | null }>(`
    mutation ModerateReview($id: ID!, $isApproved: Boolean!) { updateReview(where: { id: $id }, data: { isApproved: $isApproved }) { id } }
  `, { id, isApproved });
  if (!response.success || !response.data.updateReview) return fail('The review could not be updated. Check your client access.');
  revalidatePath('/dashboard/platform/reviews');
  revalidatePath('/reviews');
  return ok(isApproved ? 'Published.' : 'Hidden from the storefront.');
}

export async function approveReview(_previous: FormState, formData: FormData): Promise<FormState> {
  return setApproval(String(formData.get('id') || ''), true);
}

export async function hideReview(_previous: FormState, formData: FormData): Promise<FormState> {
  return setApproval(String(formData.get('id') || ''), false);
}

export async function deleteReview(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  const response = await keystoneClient<{ deleteReview: { id: string } | null }>(`
    mutation DeleteReview($id: ID!) { deleteReview(where: { id: $id }) { id } }
  `, { id });
  if (!response.success || !response.data.deleteReview) return fail('The review could not be deleted.');
  revalidatePath('/dashboard/platform/reviews');
  revalidatePath('/reviews');
  return ok('Deleted.');
}
