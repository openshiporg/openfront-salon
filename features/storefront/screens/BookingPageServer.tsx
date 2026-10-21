import { BookingPage } from './BookingPage';
import { getAllServices } from '../lib/data/services';

/** Request-owned URL selections do not suspend the client booking form. */
export async function BookingPageServer({ searchParams }: { searchParams: Promise<{ service?: string; stylist?: string }> }) {
  const [catalog, selection] = await Promise.all([getAllServices(), searchParams]);
  return <BookingPage initialServiceCatalog={catalog} preselectedService={selection.service || null} preselectedStylist={selection.stylist || null} />;
}
