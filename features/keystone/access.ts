export type SalonRole = {
  id: string
  name: string
  canSeeOtherPeople?: boolean
  canEditOtherPeople?: boolean
  canManagePeople?: boolean
  canManageRoles?: boolean
  canAccessDashboard?: boolean
  canManageOnboarding?: boolean
  canManageSalon?: boolean
  canManageAppointments?: boolean
  canManageClients?: boolean
  canManageCareRecords?: boolean
  canManageCatalog?: boolean
  canManageSchedules?: boolean
  canManageOwnSchedule?: boolean
  canManageResources?: boolean
  canManageInventory?: boolean
  canManagePayments?: boolean
  canIssueRefunds?: boolean
  canManageCommissions?: boolean
  canViewReports?: boolean
  canManageIntegrations?: boolean
}

export type Session = {
  itemId: string
  listKey: string
  data: { name: string; role?: SalonRole | null }
}

export type AccessArgs = { session?: Session }

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

function rolePermission(session: Session | undefined, permission: keyof SalonRole) {
  return session?.data.role?.canManageSalon === true || session?.data.role?.[permission] === true
}

export const permissions = {
  canManagePeople: ({ session }: AccessArgs) => session?.data.role?.canManagePeople === true,
  canManageRoles: ({ session }: AccessArgs) => session?.data.role?.canManageRoles === true,
  canAccessDashboard: ({ session }: AccessArgs) => session?.data.role?.canAccessDashboard === true,
  // Onboarding remains explicit even for managers so production seed access can be revoked independently.
  canManageOnboarding: ({ session }: AccessArgs) => session?.data.role?.canManageOnboarding === true,
  canManageSalon: ({ session }: AccessArgs) => session?.data.role?.canManageSalon === true,
  canManageAppointments: ({ session }: AccessArgs) => rolePermission(session, "canManageAppointments"),
  canManageClients: ({ session }: AccessArgs) => rolePermission(session, "canManageClients"),
  // Consultation answers are purpose-restricted care data. Manager status alone
  // does not grant access; the role must carry this explicit authority.
  canManageCareRecords: ({ session }: AccessArgs) => session?.data.role?.canManageCareRecords === true,
  canManageCatalog: ({ session }: AccessArgs) => rolePermission(session, "canManageCatalog"),
  canManageSchedules: ({ session }: AccessArgs) => rolePermission(session, "canManageSchedules"),
  canManageOwnSchedule: ({ session }: AccessArgs) => rolePermission(session, "canManageOwnSchedule"),
  canManageResources: ({ session }: AccessArgs) => rolePermission(session, "canManageResources"),
  canManageInventory: ({ session }: AccessArgs) => rolePermission(session, "canManageInventory"),
  canManagePayments: ({ session }: AccessArgs) => rolePermission(session, "canManagePayments"),
  canIssueRefunds: ({ session }: AccessArgs) => rolePermission(session, "canIssueRefunds"),
  canManageCommissions: ({ session }: AccessArgs) => rolePermission(session, "canManageCommissions"),
  canViewReports: ({ session }: AccessArgs) => rolePermission(session, "canViewReports"),
  canManageIntegrations: ({ session }: AccessArgs) => rolePermission(session, "canManageIntegrations"),
}

function ownerId(session?: Session) { return session?.itemId }
function anyPermission(session: Session | undefined, checks: Array<(args: AccessArgs) => boolean>) {
  return checks.some((check) => check({ session }))
}

export const rules = {
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManagePeople({ session }) || session.data.role?.canSeeOtherPeople) return true
    return { id: { equals: session.itemId } }
  },
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManagePeople({ session }) || session.data.role?.canEditOtherPeople) return true
    return { id: { equals: session.itemId } }
  },
  canReadClients: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManageAppointments])) return true
    return { user: { id: { equals: ownerId(session) } } }
  },
  canReadAppointments: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageAppointments, permissions.canManagePayments, permissions.canIssueRefunds])) return true
    return { client: { user: { id: { equals: ownerId(session) } } } }
  },
  canReadAppointmentLineItems: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageAppointments, permissions.canManagePayments])) return true
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadPayments: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManagePayments, permissions.canIssueRefunds, permissions.canViewReports])) return true
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadSalonTransactions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManagePayments, permissions.canViewReports])) return true
    return { client: { user: { id: { equals: ownerId(session) } } } }
  },
  canReadSalonTransactionLineItems: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManagePayments, permissions.canViewReports])) return true
    return { transaction: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadFormSubmissions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageCareRecords({ session })) return true
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadClientPackages: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadClientPackageUsages: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true
    return { clientPackage: { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } } }
  },
  canReadClientMemberships: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadGiftCards: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true
    return { purchasedBy: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadGiftCardTransactions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true
    return { giftCard: { purchasedBy: { clientProfile: { user: { id: { equals: ownerId(session) } } } } } }
  },
  canReadClientPoints: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageClients({ session })) return true
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadReferrals: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageClients({ session })) return true
    return { OR: [{ referrer: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }, { referred: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }] }
  },
  canReadMessageLogs: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageClients({ session })) return true
    return { recipient: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadProductSales: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageInventory, permissions.canViewReports])) return true
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadCommissions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageCommissions({ session })) return true
    return { stylist: { user: { id: { equals: ownerId(session) } } } }
  },
  canReadAppointmentSegments: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageAppointments({ session })) return true
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadAppointmentScheduleRevisions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageAppointments({ session })) return true
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadSegmentTransitions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageAppointments({ session })) return true
    return { segment: { appointment: { client: { user: { id: { equals: ownerId(session) } } } } } }
  },
  canReadTransactionReversals: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canIssueRefunds, permissions.canManagePayments, permissions.canViewReports])) return true
    return { transaction: { client: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadTransactionReversalLines: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canIssueRefunds, permissions.canManagePayments, permissions.canViewReports])) return true
    return { reversal: { transaction: { client: { user: { id: { equals: ownerId(session) } } } } } }
  },
  canReadCommissionAdjustments: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageCommissions({ session }) || permissions.canViewReports({ session })) return true
    return { commission: { stylist: { user: { id: { equals: ownerId(session) } } } } }
  },
  canReadGratuityEntries: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManagePayments, permissions.canManageCommissions, permissions.canViewReports])) return true
    return { OR: [
      { practitioner: { user: { id: { equals: ownerId(session) } } } },
      { payment: { appointment: { client: { user: { id: { equals: ownerId(session) } } } } } },
    ] }
  },
  canReadConsultationSubmissions: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageCareRecords({ session })) return true
    return { client: { id: { equals: ownerId(session) } } }
  },
  canReadConsultationReviews: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canManageCareRecords({ session })) return true
    return { submission: { client: { id: { equals: ownerId(session) } } } }
  },
  canReadClientPackageAdjustments: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments, permissions.canIssueRefunds])) return true
    return { clientPackage: { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } } }
  },
  canReadDepositAdjustments: ({ session }: AccessArgs) => {
    if (!session) return false
    if (anyPermission(session, [permissions.canManagePayments, permissions.canIssueRefunds, permissions.canViewReports])) return true
    return { paymentSession: { appointment: { client: { user: { id: { equals: ownerId(session) } } } } } }
  },
}
