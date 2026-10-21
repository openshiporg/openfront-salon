import { Building2, CircleCheck, Package } from 'lucide-react';
import seed from '../lib/seed.json';

export interface SalonTemplate {
  name: string;
  description: string;
  icon: React.ReactNode;
  displayNames: {
    salonInfo: string[];
    categories: string[];
    resources: string[];
    services: string[];
    staff: string[];
    clients: string[];
    intakeForms: string[];
    memberships: string[];
    retail: string[];
    appointments: string[];
  };
}

export const SALON_TEMPLATES: Record<'full' | 'minimal' | 'custom', SalonTemplate> = {
  full: {
    name: 'Complete Salon Setup',
    description:
      'Set up services, artist schedules, clients, memberships, images, and operational appointment records.',
    icon: <Building2 className="h-5 w-5" />,
    displayNames: {
      salonInfo: [seed.salonInfo.name],
      categories: ['Hair Services', 'Nails', 'Skin & Spa', 'Makeup'],
      resources: ['Cutting Station 1', 'Color Bar 1', 'Treatment Room A', 'Shampoo Bowl 1'],
      services: [
        'Signature Cut & Blowout',
        'Full Dimension Color',
        'Gloss + Toner Refresh',
        'Keratin Smoothing Treatment',
        'Structured Gel Manicure',
        'Custom Clinical Facial',
        'Therapeutic Massage',
        'Bridal Makeup Trial',
      ],
      staff: ['Maya Chen', 'Leo Rivera', 'Priya Shah', 'Nora Blake'],
      clients: ['Avery Stone', 'Jordan Lee', 'Camille Brooks'],
      intakeForms: ['New Client Beauty Profile', 'Color + Chemical Consent', 'Skin Treatment Consent'],
      memberships: ['Glow Club', 'Color Care Plan', 'Bridal Beauty Package'],
      retail: ['Hydrate Shampoo', 'Color Lock Mask', 'Thermal Shield Spray', 'Appointment Reminder', 'Win-back Offer'],
      appointments: ['Avery color follow-up', 'Jordan precision cut', 'Camille facial consultation'],
    },
  },
  minimal: {
    name: 'Essential Booking Setup',
    description: 'Create the core catalog, artists, images, and schedules needed for online booking.',
    icon: <Package className="h-5 w-5" />,
    displayNames: {
      salonInfo: [seed.salonInfo.name],
      categories: ['Hair Services'],
      resources: ['Cutting Station 1', 'Color Bar 1'],
      services: ['Signature Cut & Blowout', 'Gloss + Toner Refresh'],
      staff: ['Maya Chen', 'Leo Rivera'],
      clients: ['Avery Stone', 'Jordan Lee'],
      intakeForms: ['New Client Beauty Profile'],
      memberships: ['Glow Club'],
      retail: ['Hydrate Shampoo', 'Appointment Reminder'],
      appointments: ['Jordan precision cut'],
    },
  },
  custom: {
    name: 'Custom Setup',
    description: 'Copy the salon seed JSON, customize it, then paste it back into the setup dialog.',
    icon: <CircleCheck className="h-5 w-5" />,
    displayNames: {
      salonInfo: [seed.salonInfo.name],
      categories: ['Hair Services'],
      resources: ['Cutting Station 1', 'Color Bar 1'],
      services: ['Signature Cut & Blowout', 'Gloss + Toner Refresh'],
      staff: ['Maya Chen', 'Leo Rivera'],
      clients: ['Avery Stone', 'Jordan Lee'],
      intakeForms: ['New Client Beauty Profile'],
      memberships: ['Glow Club'],
      retail: ['Hydrate Shampoo', 'Appointment Reminder'],
      appointments: ['Jordan precision cut'],
    },
  },
};

export interface SectionDefinition {
  id: number;
  type: string;
  label: string;
  getItemsFn: (template: 'full' | 'minimal' | 'custom') => string[];
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 1,
    type: 'salonInfo',
    label: 'Salon Location',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.salonInfo,
  },
  {
    id: 2,
    type: 'categories',
    label: 'Service Categories',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.categories,
  },
  {
    id: 3,
    type: 'resources',
    label: 'Rooms & Equipment',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.resources,
  },
  {
    id: 4,
    type: 'services',
    label: 'Services & Variants',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.services,
  },
  {
    id: 5,
    type: 'staff',
    label: 'Staff & Schedules',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.staff,
  },
  {
    id: 6,
    type: 'clients',
    label: 'Clients & CRM',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.clients,
  },
  {
    id: 7,
    type: 'intakeForms',
    label: 'Intake & Consent',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.intakeForms,
  },
  {
    id: 8,
    type: 'memberships',
    label: 'Memberships & Packages',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.memberships,
  },
  {
    id: 9,
    type: 'retail',
    label: 'Retail & Messages',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.retail,
  },
  {
    id: 10,
    type: 'appointments',
    label: 'Appointment Records',
    getItemsFn: (template) => SALON_TEMPLATES[template].displayNames.appointments,
  },
];

// Backwards-compatible alias for older onboarding components.
export const STORE_TEMPLATES = SALON_TEMPLATES;
