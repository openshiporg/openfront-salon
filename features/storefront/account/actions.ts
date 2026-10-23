"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { keystoneClient, type KeystoneResponse } from "@/features/dashboard/lib/keystoneClient";
import { GraphQLClient } from "graphql-request";
import { getGraphQLEndpoint } from "@/features/dashboard/lib/getBaseUrl";
import { verifyPortalIdentity } from "./verifyPortalIdentity";
import { parseExplicitIsoInstant } from "./rescheduleTimeInput";
import { zonedLocalTimeToIso } from "@/features/lib/zonedLocalTime";
import { resolveClientPortalRead } from "./clientPortalRead";
import { isOwnedAppointmentCancelled, isVerifiedCancellationResponse } from "./cancellationOutcome";
import { isVerifiedRescheduleResponse } from "./rescheduleOutcome";
import { isVerifiedConsultationResponse, parseConsultationRetryAttempt } from "./consultationSubmitOutcome";

const SIGN_IN_EMAIL_COOKIE = "sf-signin-email";

export async function getSignInEmail() {
  return (await cookies()).get(SIGN_IN_EMAIL_COOKIE)?.value || "";
}

export async function portalSignIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const consultationUnresolved = String(formData.get("consultation") || "") === "unresolved";
  const consultationAttempt = parseConsultationRetryAttempt(
    consultationUnresolved ? "unresolved" : null,
    formData.get("consultationTemplate"),
    formData.get("consultationKey"),
  );
  const returnParams = new URLSearchParams();
  if (consultationUnresolved) returnParams.set("consultation", "unresolved");
  if (consultationAttempt) {
    returnParams.set("consultationTemplate", consultationAttempt.templateVersionId);
    returnParams.set("consultationKey", consultationAttempt.idempotencyKey);
  }
  const consultationReturnPath = consultationUnresolved
    ? `/account?${returnParams.toString()}`
    : "/account";
  const redirectToSignInError = async (code: "missing" | "credentials" | "profile") => {
    // Keep the typed email for the retry without putting it in the URL.
    if (email) (await cookies()).set(SIGN_IN_EMAIL_COOKIE, email, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/account/signin", maxAge: 300 });
    const params = new URLSearchParams(returnParams);
    params.set("error", code);
    redirect(`/account/signin?${params.toString()}`);
  };
  if (!email || !password) await redirectToSignInError("missing");
  const response = await keystoneClient<any>(`mutation PortalSignIn($email: String!, $password: String!) {
    authenticateUserWithPassword(email: $email, password: $password) {
      ... on UserAuthenticationWithPasswordSuccess { sessionToken item { id } }
      ... on UserAuthenticationWithPasswordFailure { message }
    }
  }`, { email, password });
  const auth = response.success ? response.data?.authenticateUserWithPassword : null;
  if (!auth?.sessionToken) await redirectToSignInError("credentials");
  const verified = await verifyPortalIdentity(auth, async (sessionToken) => {
    const endpoint = await getGraphQLEndpoint();
    const client = new GraphQLClient(endpoint, {
      headers: { Cookie: `keystonejs-session=${sessionToken}` },
    });
    const result = await client.request<{ authenticatedItem: { id: string; clientProfile: { id: string } | null } | null }>(
      `query VerifyPortalIdentity { authenticatedItem { ... on User { id clientProfile { id } } } }`,
    );
    return result.authenticatedItem;
  });
  if (!verified) await redirectToSignInError("profile");
  const store = await cookies();
  store.delete({ name: SIGN_IN_EMAIL_COOKIE, path: "/account/signin" });
  store.set("keystonejs-session", auth.sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(consultationReturnPath);
}

export async function portalSignUp(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const phone = String(formData.get("phone") || "").trim();
  const response = await keystoneClient<{ registerSalonCustomer: boolean }>(`mutation RegisterSalonCustomer($name: String!, $email: String!, $password: String!, $phone: String) {
    registerSalonCustomer(name: $name, email: $email, password: $password, phone: $phone)
  }`, { name, email, password, phone: phone || null });
  if (!response.success || response.data?.registerSalonCustomer !== true) redirect("/account/signup?error=failed");
  await portalSignIn(formData);
}

export async function portalSignOut() {
  await keystoneClient("mutation { endSession }");
  (await cookies()).delete("keystonejs-session");
  redirect("/");
}

export async function cancelOwnedAppointment(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") || ""); const reason = String(formData.get("reason") || "Cancelled by client online");
  const response = await keystoneClient<any>(`mutation PortalCancel($appointmentId: ID!, $reason: String!) {
    transitionAppointment(appointmentId: $appointmentId, status: "cancelled", reason: $reason) { success appointmentId status error }
  }`, { appointmentId, reason });
  if (isVerifiedCancellationResponse(response.success, response.success ? response.data?.transitionAppointment : undefined, appointmentId)) {
    revalidatePath("/account"); redirect("/account?updated=cancelled");
  }

  // A transport/GraphQL error or incomplete command result may follow a committed status transition.
  const currentPortal = await getClientPortalData();
  if (isOwnedAppointmentCancelled(currentPortal, appointmentId)) {
    revalidatePath("/account"); redirect("/account?updated=cancelled");
  }

  revalidatePath("/account"); redirect("/account?cancellation=unresolved");
}

export async function rescheduleOwnedAppointment(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") || "");
  const startTime = parseExplicitIsoInstant(formData.get("startTime")) ?? zonedLocalTimeToIso(formData.get("startTime"), String(formData.get("timeZone") || "UTC"));
  if (!startTime) redirect("/account?error=time");
  let response: KeystoneResponse<{ scheduleAppointmentSegments?: unknown }>;
  try {
    response = await keystoneClient<{ scheduleAppointmentSegments?: unknown }>(`mutation PortalReschedule($appointmentId: ID!, $startTime: String!, $reason: String!, $idempotencyKey: String!) {
      scheduleAppointmentSegments(appointmentId: $appointmentId, startTime: $startTime, reason: $reason, idempotencyKey: $idempotencyKey) { success appointmentId revision error }
    }`, { appointmentId, startTime, reason: "Rescheduled by client online", idempotencyKey: String(formData.get("idempotencyKey") || `portal-reschedule:${randomUUID()}`) });
  } catch {
    revalidatePath("/account");
    redirect("/account?reschedule=unresolved");
  }
  const result = response.success ? response.data?.scheduleAppointmentSegments : undefined;
  // A definite rejection is not an unknown outcome: say why instead of "unresolved".
  const rejection = result && typeof result === "object" && (result as { success?: unknown }).success === false
    ? String((result as { error?: unknown }).error || "")
    : null;
  if (rejection !== null) {
    revalidatePath("/account");
    redirect(`/account?reschedule=${/policy|deadline|notice|too late/i.test(rejection) ? "late" : /plan changed/i.test(rejection) ? "changed" : "unavailable"}`);
  }
  if (!isVerifiedRescheduleResponse(response.success, result, appointmentId)) {
    revalidatePath("/account");
    redirect("/account?reschedule=unresolved");
  }
  revalidatePath("/account"); redirect("/account?updated=rescheduled");
}

export async function submitOwnedConsultation(formData: FormData) {
  const questionIds = String(formData.get("questionIds") || "").split(",").filter(Boolean); const answers: Record<string, unknown> = {};
  for (const id of questionIds) answers[id] = String(formData.get(`answer:${id}`) || "");
  const signerRole = String(formData.get("signerRole") || "self");
  const templateVersionId = String(formData.get("templateVersionId") || "");
  const idempotencyKey = String(formData.get("idempotencyKey") || `portal-consultation:${templateVersionId}:${randomUUID()}`);
  const unresolvedUrl = `/account?consultation=unresolved&consultationTemplate=${encodeURIComponent(templateVersionId)}&consultationKey=${encodeURIComponent(idempotencyKey)}`;
  let response: KeystoneResponse<{ submitConsultation?: unknown }>;
  try {
    response = await keystoneClient<{ submitConsultation?: unknown }>(`mutation PortalConsultation($templateVersionId: ID!, $appointmentId: ID, $answers: JSON!, $signerName: String!, $signerRole: String!, $guardianAuthority: String, $signatureEvidence: String!, $idempotencyKey: String!) {
      submitConsultation(templateVersionId: $templateVersionId, appointmentId: $appointmentId, answers: $answers, signerName: $signerName, signerRole: $signerRole, guardianAuthority: $guardianAuthority, signatureEvidence: $signatureEvidence, idempotencyKey: $idempotencyKey) { success recordId evidenceHash error }
    }`, {
      templateVersionId, appointmentId: String(formData.get("appointmentId") || "") || null,
      answers, signerName: String(formData.get("signerName") || ""), signerRole,
      guardianAuthority: String(formData.get("guardianAuthority") || "") || null, signatureEvidence: String(formData.get("signatureEvidence") || ""),
      idempotencyKey,
    });
  } catch {
    revalidatePath("/account");
    redirect(unresolvedUrl);
  }
  const result = response.success ? response.data?.submitConsultation : undefined;
  if (!isVerifiedConsultationResponse(response.success, result)) {
    revalidatePath("/account");
    redirect(unresolvedUrl);
  }
  revalidatePath("/account"); redirect("/account?updated=consultation");
}

export async function getClientPortalData() {
  try {
    const response = await keystoneClient<{ clientPortal?: unknown }>("query ClientPortal { clientPortal }");
    return resolveClientPortalRead(response.success, response.success ? response.data?.clientPortal : undefined);
  } catch {
    return { status: "unavailable" } as const;
  }
}
