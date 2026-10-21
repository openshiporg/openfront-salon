import { permissions, type AccessArgs } from "./access";

/** A UI read-mode does not prevent nested connect/set/disconnect writes. */
export const workflowOwned = { create: () => false, update: () => false };
export const compensationRead = ({ session }: AccessArgs) =>
  permissions.canManageCommissions({ session }) || permissions.canManagePayments({ session }) || permissions.canViewReports({ session });
export const operationalRead = ({ session }: AccessArgs) =>
  permissions.canManageAppointments({ session }) || permissions.canManagePayments({ session });
export const ownCareRead = ({ session, item }: AccessArgs & { item?: Record<string, unknown> }) =>
  permissions.canManageCareRecords({ session }) || Boolean(session?.itemId && item?.userId === session.itemId);

/** Private care attachments must never reuse an immutable public marketing asset. */
export async function validateCarePhotos({ inputData, context, addValidationError }: any) {
  for (const key of ["photos", "photo"]) {
    const value = inputData[key];
    if (!value || typeof value !== "object") continue;

    const nestedCreates = value.create ? (Array.isArray(value.create) ? value.create : [value.create]) : [];
    if (nestedCreates.some((image: any) => !image || typeof image !== "object" || image.visibility === "public")) {
      addValidationError("Care records can only create or attach private images");
    }

    const linked = [value.connect, value.set].flatMap((part) =>
      part ? (Array.isArray(part) ? part : [part]) : [],
    );
    for (const target of linked) {
      const id = target && typeof target === "object" ? (target as { id?: unknown }).id : null;
      if (typeof id !== "string" || !id) {
        addValidationError("Care image selection is invalid");
        continue;
      }
      const image = await context.sudo().query.SalonImage.findOne({ where: { id }, query: "id visibility" });
      if (!image || image.visibility !== "private") addValidationError("Care records can only attach private images");
    }
  }
}
