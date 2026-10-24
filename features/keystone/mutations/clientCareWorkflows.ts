import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";

type Result = { success: boolean; error: string | null };

const HAIR_TYPES = ["straight", "wavy", "curly", "coily"];
const HAIR_TEXTURES = ["fine", "medium", "coarse"];

function text(value: unknown, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max) throw new Error("A care field is too long");
  return result;
}

/** Care profile fields (allergies, sensitivities, hair) need care-record authority; the preferred stylist needs client authority. */
export async function updateClientCareProfileTransaction(context: Context, args: {
  clientId: string; allergies?: string | null; skinSensitivities?: string | null; hairType?: string | null; hairTexture?: string | null; notes?: string | null; preferredStylistId?: string | null;
}): Promise<Result> {
  const session = context.session as any;
  const canCare = permissions.canManageCareRecords({ session });
  const canClients = permissions.canManageClients({ session });
  if (!canCare && !canClients) return { success: false, error: "You do not have permission to edit this client" };
  try {
    const sudo = context.sudo();
    const client = await sudo.query.Client.findOne({ where: { id: args.clientId }, query: "id" });
    if (!client) throw new Error("Client not found");
    const data: Record<string, unknown> = {};
    if (canCare) {
      data.allergies = text(args.allergies, 2000);
      data.skinSensitivities = text(args.skinSensitivities, 2000);
      data.notes = text(args.notes, 5000);
      const hairType = text(args.hairType, 20);
      if (hairType && !HAIR_TYPES.includes(hairType)) throw new Error("Hair type is invalid");
      data.hairType = hairType || null;
      const hairTexture = text(args.hairTexture, 20);
      if (hairTexture && !HAIR_TEXTURES.includes(hairTexture)) throw new Error("Hair texture is invalid");
      data.hairTexture = hairTexture || null;
    }
    if (canClients && args.preferredStylistId !== undefined) {
      const stylistId = text(args.preferredStylistId, 200);
      if (stylistId) {
        const stylist = await sudo.query.Stylist.findOne({ where: { id: stylistId }, query: "id" });
        if (!stylist) throw new Error("Stylist not found");
        data.preferredStylist = { connect: { id: stylist.id } };
      } else {
        data.preferredStylist = { disconnect: true };
      }
    }
    await sudo.query.Client.updateOne({ where: { id: client.id }, data, query: "id" });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Client profile could not be saved" };
  }
}

/** A signed-in client reviews their own completed visit once; the salon approves it before it shows publicly. */
export async function submitAppointmentReviewTransaction(context: Context, args: { appointmentId: string; rating: number; comment?: string | null }): Promise<Result> {
  const userId = context.session?.itemId;
  if (!userId) return { success: false, error: "Sign in to leave a review" };
  if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) return { success: false, error: "Choose a rating from 1 to 5" };
  const comment = typeof args.comment === "string" ? args.comment.trim() : "";
  if (comment.length > 2000) return { success: false, error: "Reviews are limited to 2,000 characters" };
  try {
    const sudo = context.sudo();
    const appointment = await sudo.query.Appointment.findOne({
      where: { id: args.appointmentId },
      query: "id status client { id user { id } } stylist { id } services { id } review { id }",
    });
    if (!appointment || appointment.client?.user?.id !== userId) throw new Error("Appointment not found");
    if (appointment.status !== "completed") throw new Error("You can review a visit after it is completed");
    if (appointment.review?.id) throw new Error("You already reviewed this visit");
    await sudo.query.Review.createOne({
      data: {
        rating: args.rating,
        comment,
        isApproved: false,
        client: { connect: { id: appointment.client.id } },
        appointment: { connect: { id: appointment.id } },
        ...(appointment.stylist?.id ? { stylist: { connect: { id: appointment.stylist.id } } } : {}),
        ...(appointment.services?.[0]?.id ? { service: { connect: { id: appointment.services[0].id } } } : {}),
      },
      query: "id",
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Review could not be saved" };
  }
}

const resultType = graphql.object<Result>()({
  name: "ClientCareWorkflowResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const updateClientCareProfile = graphql.field({
  type: resultType,
  args: {
    clientId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    allergies: graphql.arg({ type: graphql.String }), skinSensitivities: graphql.arg({ type: graphql.String }),
    hairType: graphql.arg({ type: graphql.String }), hairTexture: graphql.arg({ type: graphql.String }),
    notes: graphql.arg({ type: graphql.String }), preferredStylistId: graphql.arg({ type: graphql.ID }),
  },
  resolve(_source, args, context: Context) { return updateClientCareProfileTransaction(context, args); },
});

export const submitAppointmentReview = graphql.field({
  type: resultType,
  args: {
    appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    rating: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    comment: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) { return submitAppointmentReviewTransaction(context, args); },
});
