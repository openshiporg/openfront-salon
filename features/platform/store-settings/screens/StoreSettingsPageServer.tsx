import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs';
import { getPlatformStoreSettings } from '../actions/store-settings';
import { StoreSettingsPageClient } from './StoreSettingsPageClient';

export async function StoreSettingsPageServer() {
  const { settings, locations } = await getPlatformStoreSettings();
  return (
    <section className="flex min-w-0 flex-col overflow-hidden">
      <PageBreadcrumbs
        items={[
          { type: 'link', label: 'Dashboard', href: '/' },
          { type: 'page', label: 'Platform' },
          { type: 'page', label: 'Storefront settings' },
        ]}
      />
      <StoreSettingsPageClient initialSettings={settings} locations={locations} />
    </section>
  );
}

export default StoreSettingsPageServer;
