import { Building2, Package, CircleCheck } from 'lucide-react';

export interface StoreTemplate {
  name: string;
  description: string;
  icon: React.ReactNode;
  regions: string[];
  paymentProviders: string[];
  shipping: string[];
  categories: string[];
  collections: string[];
  products: string[];
  displayNames: {
    store: string[];
    regions: string[];
    paymentProviders: string[];
    shipping: string[];
    categories: string[];
    collections: string[];
    products: string[];
  };
}

export const STORE_TEMPLATES: Record<'full' | 'minimal' | 'custom', StoreTemplate> = {
  full: {
    name: 'Complete Setup',
    description:
      'Start with a fully configured salon including multiple regions, payment methods, and a comprehensive service catalog.',
    icon: <Building2 className="h-5 w-5" />,
    regions: ['na', 'eu', 'uk'],
    paymentProviders: [
      'pp_stripe_stripe',
      'pp_paypal_paypal',
      'pp_system_default',
    ],
    shipping: ['Standard Booking'],
    categories: ['hair-services', 'nail-services', 'spa-services', 'makeup-services'],
    collections: ['popular-services', 'new-services', 'premium-services'],
    products: [
      'womens-haircut-style',
      'mens-haircut',
      'full-color-treatment',
      'manicure',
      'relaxing-massage',
      'bridal-makeup',
    ],
    displayNames: {
      store: ['Glam & Glow Salon'],
      regions: ['North America (USD)', 'Europe (EUR)', 'United Kingdom (GBP)'],
      paymentProviders: ['Stripe', 'PayPal', 'Cash on Delivery'],
      shipping: ['Standard Booking'],
      categories: ['Hair Services', 'Nail Services', 'Spa Services', 'Makeup Services'],
      collections: ['Popular Services', 'New Services', 'Premium Services'],
      products: [
        "Women's Haircut & Style",
        "Men's Haircut",
        'Full Color Treatment',
        'Manicure',
        'Relaxing Massage',
        'Bridal Makeup',
      ],
    },
  },
  minimal: {
    name: 'Basic Setup',
    description:
      'Start with just the essentials - one region, one payment method, and basic services.',
    icon: <Package className="h-5 w-5" />,
    regions: ['na'],
    paymentProviders: ['pp_system_default'],
    shipping: ['Standard Booking'],
    categories: ['hair-services'],
    collections: ['popular-services'],
    products: ['womens-haircut-style'],
    displayNames: {
      store: ['Glam & Glow Salon'],
      regions: ['North America (USD)'],
      paymentProviders: ['Cash on Delivery'],
      shipping: ['Standard Booking'],
      categories: ['Hair Services'],
      collections: ['Popular Services'],
      products: ["Women's Haircut & Style"],
    },
  },
  custom: {
    name: 'Custom Setup',
    description:
      'Customize your setup with your own JSON templates for each section.',
    icon: <CircleCheck className="h-5 w-5" />,
    regions: ['na'],
    paymentProviders: ['pp_system_default'],
    shipping: ['Standard Booking'],
    categories: ['hair-services'],
    collections: ['popular-services'],
    products: ['womens-haircut-style'],
    displayNames: {
      store: ['Glam & Glow Salon'],
      regions: ['North America (USD)'],
      paymentProviders: ['Cash on Delivery'],
      shipping: ['Standard Booking'],
      categories: ['Hair Services'],
      collections: ['Popular Services'],
      products: ["Women's Haircut & Style"],
    },
  },
};

export interface SectionDefinition {
  id: number;
  type: string;
  label: string;
  getItemsFn: (template: 'full' | 'minimal' | 'custom') => string[];
  jsonKey: 'regions' | 'paymentProviders' | 'shipping_options' | 'categories' | 'collections' | 'products';
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 1,
    type: 'store',
    label: 'Salon Information',
    getItemsFn: () => ['Glam & Glow Salon'],
    jsonKey: 'store' as const,
  },
  {
    id: 2,
    type: 'regions',
    label: 'Regions & Countries',
    getItemsFn: (template) => STORE_TEMPLATES[template].displayNames.regions,
    jsonKey: 'regions' as const,
  },
  {
    id: 3,
    type: 'paymentProviders',
    label: 'Payment Providers',
    getItemsFn: (template) => STORE_TEMPLATES[template].displayNames.paymentProviders,
    jsonKey: 'paymentProviders' as const,
  },
  {
    id: 4,
    type: 'shipping',
    label: 'Booking Options',
    getItemsFn: (template) => STORE_TEMPLATES[template].displayNames.shipping,
    jsonKey: 'shipping_options' as const,
  },
  {
    id: 5,
    type: 'categories',
    label: 'Service Categories',
    getItemsFn: (template) => STORE_TEMPLATES[template].displayNames.categories,
    jsonKey: 'categories' as const,
  },
  {
    id: 6,
    type: 'collections',
    label: 'Service Collections',
    getItemsFn: (template) => STORE_TEMPLATES[template].displayNames.collections,
    jsonKey: 'collections' as const,
  },
  {
    id: 7,
    type: 'products',
    label: 'Services',
    getItemsFn: (template) => STORE_TEMPLATES[template].displayNames.products,
    jsonKey: 'products' as const,
  },
];
