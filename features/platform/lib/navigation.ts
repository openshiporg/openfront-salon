import type { LucideIcon } from 'lucide-react'
import { Armchair, Award, Banknote, Boxes, Building2, CalendarClock, CalendarDays, ChartNoAxesCombined, ClipboardCheck, ContactRound, Gift, LayoutGrid, ListOrdered, Megaphone, MessageSquareQuote, PlugZap, ReceiptText, Scissors, Store, UsersRound } from 'lucide-react'

export type PlatformPermission = 'canManageSalon' | 'canIssueRefunds' | 'canManageCareRecords' | 'canManageAppointments' | 'canManageClients' | 'canManageCatalog' | 'canManageSchedules' | 'canManageOwnSchedule' | 'canManageResources' | 'canManageInventory' | 'canManagePayments' | 'canManageCommissions' | 'canViewReports' | 'canManageIntegrations' | 'canManageOnboarding'

export interface PlatformNavItem {
  title: string
  href: string
  /** Same permissions the page's withPlatformPermission guard accepts; canManageSalon always passes. */
  requires?: PlatformPermission[]
  color: string
  description: string
  icon: LucideIcon
  group: 'standalone' | 'relationships' | 'catalog' | 'operations' | 'insights'
}

export interface PlatformNavGroup {
  id: string
  title: string
  icon: LucideIcon
  items: PlatformNavItem[]
}

export const platformNavItems: PlatformNavItem[] = [
  { title: 'Appointments', href: '/platform/appointments', requires: ['canManageAppointments'], color: 'purple', description: 'Manage bookings, client arrivals, and appointment status.', icon: CalendarDays, group: 'standalone' },
  { title: 'Checkout', href: '/platform/checkout', requires: ['canManagePayments'], color: 'emerald', description: 'Complete salon tickets, service charges, and retail sales.', icon: ReceiptText, group: 'standalone' },
  { title: 'Sales & refunds', href: '/platform/sales', requires: ['canManagePayments', 'canIssueRefunds', 'canViewReports'], color: 'green', description: 'Find a sale, refund or void it, and correct commission or tips.', icon: ReceiptText, group: 'standalone' },
  { title: 'Storefront settings', href: '/platform/store-settings', requires: ['canManageSalon'], color: 'slate', description: 'Publish storefront identity, theme, and primary location.', icon: Store, group: 'standalone' },
  { title: 'Clients', href: '/platform/clients', requires: ['canManageClients'], color: 'rose', description: 'Prioritize client relationships, visit history, and follow-up.', icon: ContactRound, group: 'relationships' },
  { title: 'Waitlist & communications', href: '/platform/engagement', requires: ['canManageAppointments', 'canManageClients'], color: 'orange', description: 'Work demand, slot offers, and delivery exceptions.', icon: Megaphone, group: 'relationships' },
  { title: 'Consultations', href: '/platform/consultations', requires: ['canManageCareRecords'], color: 'indigo', description: 'Publish consent forms and review signed consultations before service.', icon: ClipboardCheck, group: 'relationships' },
  { title: 'Loyalty', href: '/platform/loyalty', requires: ['canManageClients'], color: 'violet', description: 'Run the points program, redeem points and reward referrals.', icon: Award, group: 'relationships' },
  { title: 'Reviews', href: '/platform/reviews', requires: ['canManageClients'], color: 'amber', description: 'Publish or hide client reviews of their visits.', icon: MessageSquareQuote, group: 'relationships' },
  { title: 'Walk-in waitlist', href: '/platform/waitlist', requires: ['canManageAppointments', 'canManageClients'], color: 'yellow', description: 'Add walk-ins and seat them as chairs open.', icon: ListOrdered, group: 'relationships' },
  { title: 'Services & catalog', href: '/platform/catalog', requires: ['canManageCatalog'], color: 'violet', description: 'Review bookability, pricing, duration, and resource coverage.', icon: Scissors, group: 'catalog' },
  { title: 'Memberships & packages', href: '/platform/benefits', requires: ['canManageCatalog', 'canManageClients'], color: 'pink', description: 'Sell packages, enrol members and manage plans.', icon: Gift, group: 'catalog' },
  { title: 'Gift cards', href: '/platform/gift-cards', requires: ['canManagePayments'], color: 'fuchsia', description: 'Sell gift cards at the desk, redeem value and see balances.', icon: Gift, group: 'catalog' },
  { title: 'Retail inventory', href: '/platform/inventory', requires: ['canManageInventory'], color: 'lime', description: 'Replenish low stock and record controlled inventory movement.', icon: Boxes, group: 'catalog' },
  { title: 'Staff schedules', href: '/platform/schedules', requires: ['canManageSchedules', 'canManageOwnSchedule'], color: 'blue', description: 'Coordinate stylist availability and shift coverage.', icon: CalendarClock, group: 'operations' },
  { title: 'Resources', href: '/platform/resources', requires: ['canManageResources', 'canManageAppointments'], color: 'teal', description: 'Manage chairs, rooms, equipment, and bookable resources.', icon: Armchair, group: 'operations' },
  { title: 'Staff & locations', href: '/platform/administration', requires: ['canManageSalon'], color: 'cyan', description: 'Review provider assignment and location readiness.', icon: Building2, group: 'operations' },
  { title: 'Commissions', href: '/platform/commissions', requires: ['canManageCommissions'], color: 'amber', description: 'Review staff commissions and controlled payouts.', icon: Banknote, group: 'operations' },
  { title: 'Reports', href: '/platform/reports', requires: ['canViewReports'], color: 'sky', description: 'Read settled revenue, refunds, appointments, and payout exposure.', icon: ChartNoAxesCombined, group: 'insights' },
  { title: 'Integrations & exceptions', href: '/platform/integrations', requires: ['canManageIntegrations'], color: 'zinc', description: 'Check providers, webhooks, and domain-event delivery.', icon: PlugZap, group: 'insights' },
]

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === 'standalone')

const groupDefinitions = [
  { id: 'relationships', title: 'Clients & demand', icon: UsersRound },
  { id: 'catalog', title: 'Catalog & retail', icon: LayoutGrid },
  { id: 'operations', title: 'Salon administration', icon: Building2 },
  { id: 'insights', title: 'Insights & systems', icon: ChartNoAxesCombined },
] as const

export const platformNavGroups: PlatformNavGroup[] = groupDefinitions.map((group) => ({
  ...group,
  items: platformNavItems.filter((item) => item.group === group.id),
}))

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}
