import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'
import { workflowOwned } from "../privacy";

import { trackingFields } from "./trackingFields";

export const Role = list({
  access: {
    operation: {
      ...allOperations(permissions.canManageRoles),
      query: isSignedIn,
    },
    filter: {
      query: ({ session }) => permissions.canManageRoles({ session })
        ? true
        : { assignedTo: { some: { id: { equals: session?.itemId } } } },
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ['name', 'assignedTo'],
    },
    itemView: {
      defaultFieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read'),
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    canCreateTodos: checkbox({ defaultValue: false }),
    canManageAllTodos: checkbox({ defaultValue: false }),
    canSeeOtherPeople: checkbox({ defaultValue: false }),
    canEditOtherPeople: checkbox({ defaultValue: false }),
    canManagePeople: checkbox({ defaultValue: false }),
    canManageRoles: checkbox({ defaultValue: false }),
    canAccessDashboard: checkbox({ defaultValue: false, label: 'Can sign in to the operations dashboard' }),
    canManageSalon: checkbox({ defaultValue: false, label: 'Salon manager: grants every operational domain permission' }),
    canManageAppointments: checkbox({ defaultValue: false, label: 'Reception: manage appointments, waitlist, and arrivals' }),
    canManageClients: checkbox({ defaultValue: false, label: 'Client CRM: manage identity, preferences, benefits, and ordinary history' }),
    canManageCareRecords: checkbox({ defaultValue: false, label: 'Restricted care data: consultation answers, signatures, and review evidence' }),
    canManageCatalog: checkbox({ defaultValue: false, label: 'Catalog: manage services, memberships, packages, and offers' }),
    canManageSchedules: checkbox({ defaultValue: false, label: 'Scheduling manager: manage all staff schedules' }),
    canManageOwnSchedule: checkbox({ defaultValue: false, label: 'Stylist: manage only the signed-in stylist schedule' }),
    canManageResources: checkbox({ defaultValue: false, label: 'Resources: manage rooms, chairs, and equipment' }),
    canManageInventory: checkbox({ defaultValue: false, label: 'Inventory: manage products and stock movements' }),
    canManagePayments: checkbox({ defaultValue: false, label: 'Finance: take and confirm payments, checkout, and tips' }),
    canIssueRefunds: checkbox({ defaultValue: false, label: 'Refund authority: issue payment and gift-card refunds' }),
    canManageCommissions: checkbox({ defaultValue: false, label: 'Commission authority: review and mark payouts' }),
    canViewReports: checkbox({ defaultValue: false, label: 'Reporting: view settled financial and operational reports' }),
    canManageIntegrations: checkbox({ defaultValue: false, label: 'Integrations: manage providers and inspect delivery exceptions' }),
    canManageOnboarding: checkbox({
      defaultValue: false,
      label: 'Can run salon onboarding and apply the deterministic starter dataset',
    }),
    assignedTo: relationship({
      ref: 'User.role',
      many: true,
      access: workflowOwned,
      ui: {
        itemView: { fieldMode: 'read' },
      },
    }),
    ...trackingFields,
  },
});