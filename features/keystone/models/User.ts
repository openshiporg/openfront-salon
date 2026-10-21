import { list } from '@keystone-6/core'
import { allOperations, denyAll } from '@keystone-6/core/access'
import { checkbox, password, relationship, select, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules } from '../access'
import type { Session } from '../access'

import { trackingFields } from "./trackingFields";
import { workflowOwned } from "../privacy";

// createAuth merges initFirstItem.itemData (the first admin's role) before list hooks run.
const PUBLIC_USER_CREATE_FIELDS = new Set(['name', 'email', 'password', 'phone', 'role'])

export const User = list({
  access: {
    operation: {
      create: () => true,
      query: isSignedIn,
      update: isSignedIn,
      delete: () => false,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  hooks: {
    // Public sign-up (gated by PUBLIC_SIGNUPS_ALLOWED in the dashboard) may only set identity fields.
    resolveInput: ({ operation, inputData, resolvedData, context }) => {
      if (operation !== 'create' || permissions.canManagePeople({ session: context.session })) return resolvedData
      const restricted: Record<string, unknown> = { ...resolvedData }
      for (const key of Object.keys(inputData ?? {})) {
        if (!PUBLIC_USER_CREATE_FIELDS.has(key)) delete restricted[key]
      }
      return restricted as typeof resolvedData
    },
  },
  ui: {
    hideCreate: args => !permissions.canManagePeople(args),
    hideDelete: args => !permissions.canManagePeople(args),
    listView: {
      initialColumns: ['name', 'email', 'role'],
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        // canEditOtherPeople can edit other people
        if (session?.data.role?.canEditOtherPeople) return 'edit'

        // edit themselves
        if (session?.itemId === item?.id) return 'edit'

        // else, default all fields to read mode
        return 'read'
      },
    },
  },
  fields: {
    name: text({
      validation: {
        isRequired: true,
      },
    }),
    email: text({
      isIndexed: 'unique',
      validation: {
        isRequired: true,
      },
      // Clients cannot change their own email; people managers can correct it.
      access: { update: permissions.canManagePeople },
    }),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) =>
          permissions.canManagePeople({ session }) || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: {
        create: permissions.canManageRoles,
        update: permissions.canManageRoles,
      },
      ui: {
        itemView: {
          fieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read'),
        },
      },
    }),
    phone: text({
      ui: {
        description: 'Primary phone number for staff and clients',
      },
    }),
    clientProfile: relationship({
      ref: 'Client.user',
      access: workflowOwned,
      ui: {
        itemView: { fieldMode: 'read' },
        description: 'Salon client profile linked to this authenticated user',
      },
    }),
    formSubmissions: relationship({ ref: 'FormSubmission.client', many: true, access: workflowOwned }),
    consultationSubmissions: relationship({ ref: 'ConsultationSubmission.client', many: true, access: workflowOwned }),
    clientPackages: relationship({ ref: 'ClientPackage.client', many: true, access: workflowOwned }),
    clientMemberships: relationship({ ref: 'ClientMembership.client', many: true, access: workflowOwned }),
    purchasedGiftCards: relationship({ ref: 'GiftCard.purchasedBy', many: true, access: workflowOwned }),
    clientPointsRecords: relationship({ ref: 'ClientPoints.client', many: true, access: workflowOwned }),
    referralsMade: relationship({ ref: 'Referral.referrer', many: true, access: workflowOwned }),
    referralsReceived: relationship({ ref: 'Referral.referred', many: true, access: workflowOwned }),
    messageLogs: relationship({ ref: 'MessageLog.recipient', many: true, access: workflowOwned }),
    onboardingStatus: select({
      access: { create: permissions.canManageOnboarding, update: permissions.canManageOnboarding },
      type: 'string',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
      ui: {
        description: 'Salon onboarding progress for the dashboard seed flow',
      },
    }),
    ...trackingFields,
  },
});
