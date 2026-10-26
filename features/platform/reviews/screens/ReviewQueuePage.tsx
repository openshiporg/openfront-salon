import Link from 'next/link';
import { MessageSquareQuote, Star } from 'lucide-react';
import { approveReview, deleteReview, getReviewQueue, hideReview, type PlatformReview } from '../actions/reviews';
import { ActionForm } from '../../components/ActionForm';
import { DataTable, EmptyState, ErrorState, PageHeader, PlatformPage, SegmentTabs, StatusCell, Td, TitleStatus } from '../../components/salon-ui';
import { getSalonTimezone } from '../../lib/salonTimezone';

const tabs = [
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'approved', label: 'Published' },
  { value: 'all', label: 'All' },
] as const;

function stars(rating: number) {
  return <span aria-label={`${rating} of 5`} className="inline-flex text-amber-500">{Array.from({ length: 5 }, (_, index) => <Star key={index} aria-hidden="true" className={`size-3.5 ${index < rating ? 'fill-current' : 'opacity-25'}`} />)}</span>;
}

export async function ReviewQueuePage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const status = tabs.some((tab) => tab.value === params.status) ? params.status! : 'pending';
  const [queue, timeZone] = await Promise.all([getReviewQueue(status), getSalonTimezone()]);

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Reviews' }]}>
      <PageHeader
        title="Reviews"
        status={queue?.counts.pending ? <TitleStatus tone="amber">{queue.counts.pending} awaiting approval</TitleStatus> : null}
        meta={queue?.averageRating ? <span>Average {queue.averageRating.toFixed(1)} from {queue.counts.approved} published</span> : null}
      />
      {!queue ? <ErrorState id="reviews-error" title="Reviews couldn't be loaded" message="Check your client access, then reload." action={null} /> : (
        <>
          <SegmentTabs label="Review status" active={status} tabs={tabs.map((tab) => ({
            value: tab.value, label: tab.label,
            href: tab.value === 'pending' ? '/dashboard/platform/reviews' : `/dashboard/platform/reviews?status=${tab.value}`,
            count: tab.value === 'pending' ? queue.counts.pending : tab.value === 'approved' ? queue.counts.approved : queue.counts.total,
          }))} />
          {queue.reviews.length === 0 ? <EmptyState icon={MessageSquareQuote} title={status === 'pending' ? 'No reviews awaiting approval' : 'No reviews in this view'} /> : (
            <DataTable label={status === 'pending' ? 'Reviews awaiting approval' : 'Reviews'} head={[{ label: 'Rating' }, { label: 'Client' }, { label: 'Review' }, { label: 'Visit', className: 'hidden lg:table-cell' }, { label: 'Status', className: 'hidden sm:table-cell' }, { label: 'Actions', className: 'text-right' }]}>
              {queue.reviews.map((review) => <ReviewRow key={review.id} review={review} timeZone={timeZone} />)}
            </DataTable>
          )}
        </>
      )}
    </PlatformPage>
  );
}

function ReviewRow({ review, timeZone }: { review: PlatformReview; timeZone?: string }) {
  const visit = review.appointment?.startTime
    ? new Date(review.appointment.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: review.appointment.location?.timezone || timeZone })
    : null;
  return (
    <tr className="hover:bg-muted/20">
      <Td className="whitespace-nowrap">{stars(review.rating)}</Td>
      <Td className="whitespace-nowrap font-medium">
        {review.client?.displayName || review.reviewerName || 'Client'}
        {/* Below sm the status column is hidden, so the status rides second, under the client. */}
        <span className="mt-1 block font-normal sm:hidden"><StatusCell tone={review.isApproved ? 'emerald' : 'amber'}>{review.isApproved ? 'Published' : 'Awaiting'}</StatusCell></span>
      </Td>
      <Td className="min-w-[14rem] max-w-xl">
        {review.comment ? <p className="line-clamp-3 whitespace-pre-line">{review.comment}</p> : <span className="text-muted-foreground">Rating only</span>}
        <span className="mt-0.5 block text-xs text-muted-foreground lg:hidden">{[review.service?.name, review.stylist?.user?.name, visit].filter(Boolean).join(' · ')}</span>
      </Td>
      <Td className="hidden text-muted-foreground lg:table-cell">
        <span className="block">{[review.service?.name, review.stylist?.user?.name].filter(Boolean).join(' · ') || '—'}</span>
        {visit ? (review.appointment?.id ? <Link href={`/dashboard/platform/appointments/${review.appointment.id}`} className="text-xs tabular-nums underline-offset-4 hover:text-foreground hover:underline">{visit}</Link> : <span className="text-xs tabular-nums">{visit}</span>) : null}
      </Td>
      <Td className="hidden sm:table-cell"><StatusCell tone={review.isApproved ? 'emerald' : 'amber'}>{review.isApproved ? 'Published' : 'Awaiting'}</StatusCell></Td>
      <Td>
        <div className="flex flex-wrap items-start justify-end gap-1.5">
          {review.isApproved
            ? <ActionForm action={hideReview} submitLabel="Hide" variant="raised" className="contents"><input type="hidden" name="id" value={review.id} /></ActionForm>
            : <ActionForm action={approveReview} submitLabel="Publish" className="contents"><input type="hidden" name="id" value={review.id} /></ActionForm>}
          <ActionForm action={deleteReview} submitLabel="Delete" confirm="Delete review" variant="danger" className="contents"><input type="hidden" name="id" value={review.id} /></ActionForm>
        </div>
      </Td>
    </tr>
  );
}

export default ReviewQueuePage;
