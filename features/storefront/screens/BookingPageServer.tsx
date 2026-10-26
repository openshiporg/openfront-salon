import { BookingPage } from './BookingPage';
import { getAllServices, getCategoryBands } from '../lib/data/services';
import { getStylistById } from '../lib/data/stylists';

/** Request-owned URL selections do not suspend the client booking form. */
export async function BookingPageServer({ searchParams }: { searchParams: Promise<{ service?: string; stylist?: string }> }) {
  const selection = await searchParams;
  const [catalog, stylist, categoryBands] = await Promise.all([getAllServices(), selection.stylist ? getStylistById(selection.stylist) : null, getCategoryBands()]);
  return (
    <BookingPage
      initialServiceCatalog={catalog}
      preselectedService={selection.service || null}
      preselectedStylist={selection.stylist || null}
      preselectedStylistName={stylist?.user?.name || null}
      preselectedStylistServiceIds={stylist ? stylist.specializations.map((service) => service.id) : null}
      categoryBands={categoryBands}
    />
  );
}
