-- Additive domain-scoped staff permissions. Dashboard access alone grants no domain authority.
ALTER TABLE "Role"
  ADD COLUMN IF NOT EXISTS "canManageSalon" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageAppointments" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageClients" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageCatalog" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageSchedules" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageOwnSchedule" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageResources" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canIssueRefunds" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageCommissions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canViewReports" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false;

-- Preserve authority only for existing explicit administrators. Ordinary dashboard
-- roles remain least-privileged and must be assigned domain permissions deliberately.
UPDATE "Role"
SET
  "canManageSalon" = true,
  "canManageAppointments" = true,
  "canManageClients" = true,
  "canManageCatalog" = true,
  "canManageSchedules" = true,
  "canManageOwnSchedule" = true,
  "canManageResources" = true,
  "canManageInventory" = true,
  "canManagePayments" = true,
  "canIssueRefunds" = true,
  "canManageCommissions" = true,
  "canViewReports" = true,
  "canManageIntegrations" = true
WHERE "canManageRoles" = true
  AND "canManagePeople" = true
  AND "canManageOnboarding" = true;
