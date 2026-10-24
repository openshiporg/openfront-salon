import Link from 'next/link';
import { MessageSquareQuote, Star } from 'lucide-react';
import { approveReview, deleteReview, getReviewQueue, hideReview, type PlatformReview } from '../actions/reviews';
import { ActionForm } from '../../components/ActionForm';
import { EmptyState, ErrorState, MetricStrip, PageHeader, PlatformPage, SegmentTabs, TitleStatus } from '../../components/salon-ui';
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
        icon={MessageSquareQuote}
        title="Reviews"
        status={queue ? <TitleStatus tone={queue.counts.pending ? 'amber' : 'emerald'}>{queue.counts.pending ? `${queue.counts.pending} awaiting approval` : 'All moderated'}</TitleStatus> : null}
      />
      {!queue ? <ErrorState id="reviews-error" title="Reviews couldn't be loaded" message="Check your client access, then reload." action={null} /> : (
        <>
          <MetricStrip items={[
            { label: 'Awaiting approval', value: queue.counts.pending, tone: queue.counts.pending ? 'amber' : undefined },
            { label: 'Published', value: queue.counts.approved, tone: 'emerald' },
            { label: 'Average rating', value: queue.averageRating ? queue.averageRating.toFixed(1) : '—' },
          ]} />
          <SegmentTabs label="Review status" active={status} tabs={tabs.map((tab) => ({
            value: tab.value, label: tab.label,
            href: tab.value === 'pending' ? '/dashboard/platform/reviews' : `/dashboard/platform/reviews?status=${tab.value}`,
            count: tab.value === 'pending' ? queue.counts.pending : tab.value === 'approved' ? queue.counts.approved : queue.counts.total,
          }))} />
          {queue.reviews.length === 0 ? <EmptyState icon={MessageSquareQuote} title="No reviews in this view" /> : (
            <ul className="grid gap-3">{queue.reviews.map((review) => <ReviewCard key={review.id} review={review} timeZone={timeZone} />)}</ul>
          )}
        </>
      )}
    </PlatformPage>
  );
}

function ReviewCard({ review, timeZone }: { review: PlatformReview; timeZone?: string }) {
  const visit = review.appointment?.startTime
    ? new Date(review.appointment.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: review.appointment.location?.timezone || timeZone })
    : null;
  return (
    <li className="grid min-w-0 gap-3 rounded-2xl border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto] md:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {stars(review.rating)}
          <span className="font-semibold">{review.client?.displayName || review.reviewerName || 'Client'}</span>
          <TitleStatus tone={review.isApproved ? 'emerald' : 'amber'}>{review.isApproved ? 'Published' : 'Awaiting approval'}</TitleStatus>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {[review.service?.name, review.stylist?.user?.name, visit].filter(Boolean).join(' · ')}
          {review.appointment?.id ? <> · <Link href={`/dashboard/platform/appointments/${review.appointment.id}`} className="underline-offset-4 hover:underline">Visit</Link></> : null}
        </p>
        {review.comment ? <p className="mt-3 whitespace-pre-line text-sm">{review.comment}</p> : <p className="mt-3 text-sm text-muted-foreground">Rating only</p>}
      </div>
      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        {review.isApproved
          ? <ActionForm action={hideReview} submitLabel="Hide" variant="raised" className="contents"><input type="hidden" name="id" value={review.id} /></ActionForm>
          : <ActionForm action={approveReview} submitLabel="Publish" className="contents"><input type="hidden" name="id" value={review.id} /></ActionForm>}
        <ActionForm action={deleteReview} submitLabel="Delete" confirm="Delete review" variant="danger" className="contents"><input type="hidden" name="id" value={review.id} /></ActionForm>
      </div>
    </li>
  );
}

export default ReviewQueuePage;
