export function assertNoUnreconciledPackageUsage(usageCount: number) {
  if (!Number.isSafeInteger(usageCount) || usageCount < 0) {
    throw new Error("Package usage evidence is invalid");
  }
  if (usageCount > 0) {
    throw new Error("Existing standalone package usage requires reconciliation before checkout; no second debit was made");
  }
}
