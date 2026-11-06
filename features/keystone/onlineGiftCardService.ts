import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Context } from ".keystone/types";
import { sendGiftCardEmail } from "./lib/mail";
import { sendLogged } from "./lib/messageLog";
import { getStorefrontMessageBrand } from "./lib/storefrontBranding";
import { onlineDepositProvider } from "./depositCheckout";
import { trustedOrigin } from "./lib/trustedOrigin";
import { serializableWorkflow } from "./mutations/serializableWorkflow";
import { createProviderCheckout, paymentProviderFromRecord, retrieveProviderCheckout } from "./utils/paymentProviderAdapter";

/**
 * Online gift cards (Mindbody / Boulevard style): the buyer picks an amount, pays on Stripe's hosted page,
 * and the card activates only after the payment is read back from Stripe. The code is emailed to the
 * recipient and shown to the buyer. Reuses the salon GiftCard + GiftCardTransaction ledger.
 */

const AMOUNTS = [2500, 5000, 7500, 10000, 15000, 20000];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Data = Record<string, any>;
const dataOf = (value: unknown): Data => (value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {});

function codeFor(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase().match(/.{1,4}/g)!.join("-");
}
export function giftOrderToken(sessionId: string, secret = process.env.SESSION_SECRET || "") {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return createHmac("sha256", secret).update(`salon-gift:${sessionId}`).digest("hex");
}
export function tokenOk(sessionId: string, token?: string | null) {
  if (!token || token.length !== 64) return false;
  const a = Buffer.from(giftOrderToken(sessionId)); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type StartResult = { success: boolean; error: string | null; url: string | null };
export type StatusResult = { success: boolean; error: string | null; status: string | null; code: string | null; amount: number | null; recipientEmail: string | null };

export async function startGiftCardCheckoutTransaction(context: Context, args: {
  amount: number; purchaserName: string; purchaserEmail: string; recipientName?: string | null; recipientEmail?: string | null; message?: string | null;
}): Promise<StartResult> {
  const fail = (error: string): StartResult => ({ success: false, error, url: null });
  if (!AMOUNTS.includes(args.amount)) return fail("Choose one of the gift card amounts.");
  const purchaserName = args.purchaserName.trim(); const purchaserEmail = args.purchaserEmail.trim().toLowerCase();
  const recipientEmail = (args.recipientEmail || "").trim().toLowerCase() || purchaserEmail;
  const recipientName = (args.recipientName || "").trim() || purchaserName;
  if (!purchaserName || purchaserName.length > 120 || recipientName.length > 120) return fail("Enter your name.");
  if (!EMAIL.test(purchaserEmail) || !EMAIL.test(recipientEmail)) return fail("Enter a valid email address.");
  if ((args.message || "").length > 500) return fail("Keep the message under 500 characters.");
  const sudo = context.sudo();
  const provider = await onlineDepositProvider(sudo);
  if (!provider) return fail("Online gift cards are unavailable right now. Buy one at the salon.");
  const key = `gift-online-${randomUUID()}`;
  const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  const prepared = await serializableWorkflow(context, "salon-gift-card", [`purchase:${key}`], async (tx) => {
    const txSudo = tx.sudo();
    const buyer = (await txSudo.query.User.findMany({ where: { email: { equals: purchaserEmail } }, take: 1, query: "id" }))[0];
    const giftCard = await txSudo.query.GiftCard.createOne({
      data: {
        code: codeFor(key), initialValue: args.amount, currentBalance: args.amount, recipientEmail, recipientName,
        message: (args.message || "").trim(), expiresAt: expiresAt.toISOString(), isActive: false,
        ...(buyer ? { purchasedBy: { connect: { id: buyer.id } } } : {}),
      },
      query: "id",
    });
    const session = await txSudo.query.PaymentSession.createOne({
      data: {
        provider: { connect: { id: provider.id } }, idempotencyKey: key, amount: args.amount, currency: "usd", status: "pending",
        data: { purpose: "gift_card", online: true, giftCardId: giftCard.id, purchaserName, purchaserEmail },
      },
      query: "id",
    });
    const payment = await txSudo.query.Payment.createOne({
      data: { subtotal: args.amount, tax: 0, tip: 0, discount: 0, totalAmount: args.amount, paymentMethod: "credit_card", status: "pending", session: { connect: { id: session.id } }, receiptEmail: purchaserEmail, notes: `Online gift card ${giftCard.id}` },
      query: "id",
    });
    await txSudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });
    return { sessionId: session.id };
  });
  const back = `${trustedOrigin()}/gift-cards/order?id=${encodeURIComponent(prepared.sessionId)}&token=${giftOrderToken(prepared.sessionId)}`;
  try {
    const checkout = await createProviderCheckout({
      provider: paymentProviderFromRecord(provider as any), amount: args.amount, currency: "usd", idempotencyKey: key,
      description: `Gift card · $${args.amount / 100}`, successUrl: back, cancelUrl: `${back}&result=cancelled`, customerEmail: purchaserEmail,
      metadata: { purpose: "gift_card", giftSession: prepared.sessionId },
    });
    const row = await sudo.query.PaymentSession.findOne({ where: { id: prepared.sessionId }, query: "id data" });
    await sudo.query.PaymentSession.updateOne({ where: { id: prepared.sessionId }, data: { providerReference: checkout.providerReference, data: { ...dataOf(row?.data), checkout: true, checkoutUrl: checkout.url, expiresAt: checkout.expiresAt } }, query: "id" });
    return { success: true, error: null, url: checkout.url };
  } catch (error) {
    console.error("Gift card checkout could not be opened:", error);
    await sudo.query.PaymentSession.updateOne({ where: { id: prepared.sessionId }, data: { status: "failed", failedAt: new Date().toISOString() }, query: "id" });
    return fail("Online gift cards are unavailable right now. Buy one at the salon.");
  }
}

/** Reads the hosted checkout back from Stripe and activates the card once paid. Safe to call repeatedly. */
export async function settleOnlineGiftCard(context: Context, sessionId: string): Promise<StatusResult> {
  const sudo = context.sudo();
  const session = await sudo.query.PaymentSession.findOne({ where: { id: sessionId }, query: "id status amount currency providerReference idempotencyKey data payment { id } provider { id code adapter config }" }) as any;
  const data = dataOf(session?.data);
  if (!session?.provider || data.purpose !== "gift_card" || !data.online || !session.providerReference) throw new Error("Gift card order not found");
  const giftCard = await sudo.query.GiftCard.findOne({ where: { id: data.giftCardId }, query: "id code initialValue recipientEmail recipientName message isActive" });
  if (!giftCard) throw new Error("Gift card order not found");
  const done = (status: string): StatusResult => ({ success: true, error: null, status, code: status === "completed" ? giftCard.code : null, amount: session.amount, recipientEmail: giftCard.recipientEmail });
  if (session.status === "completed") { await emailOnce(context, session.id, giftCard, data); return done("completed"); }
  if (!["pending", "requires_action", "authorized"].includes(session.status)) return done(session.status);
  const observation = await retrieveProviderCheckout({ provider: paymentProviderFromRecord(session.provider), providerReference: session.providerReference });
  if (observation.status === "pending") return done("pending");
  if (observation.status === "cancelled") {
    await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { status: "cancelled", failedAt: new Date().toISOString() }, query: "id" });
    if (session.payment?.id) await sudo.query.Payment.updateOne({ where: { id: session.payment.id }, data: { status: "failed" }, query: "id" });
    return done("cancelled");
  }
  if (observation.amount !== session.amount || (observation.currency || "").toLowerCase() !== "usd") throw new Error("The amount paid does not match the gift card. Contact the salon.");
  await serializableWorkflow(context, "salon-gift-card", [`session:${session.id}`], async (tx) => {
    const txSudo = tx.sudo();
    const fresh = await txSudo.query.PaymentSession.findOne({ where: { id: session.id }, query: "id status" });
    if (fresh?.status === "completed") return;
    const now = new Date().toISOString();
    await txSudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { status: "completed", completedAt: now, data: { ...data, paymentIntent: observation.paymentIntentId } }, query: "id" });
    if (session.payment?.id) await txSudo.query.Payment.updateOne({ where: { id: session.payment.id }, data: { status: "completed", processedAt: now }, query: "id" });
    await txSudo.query.GiftCard.updateOne({ where: { id: giftCard.id }, data: { isActive: true }, query: "id" });
    const purchaseKey = `${session.idempotencyKey}:purchase`;
    const existing = (await txSudo.query.GiftCardTransaction.findMany({ where: { idempotencyKey: { equals: purchaseKey } }, take: 1, query: "id" }))[0];
    if (!existing) await txSudo.query.GiftCardTransaction.createOne({ data: { giftCard: { connect: { id: giftCard.id } }, type: "purchase", amount: giftCard.initialValue, idempotencyKey: purchaseKey, notes: `online:${session.provider.code}` }, query: "id" });
  });
  await emailOnce(context, session.id, giftCard, data);
  return done("completed");
}

/** The code goes to the recipient exactly once, whether the return page or the Stripe webhook settled first. */
async function emailOnce(context: Context, sessionId: string, giftCard: any, data: Data) {
  if (!giftCard.recipientEmail || process.env.NODE_ENV === "test") return;
  const claimed = await context.prisma.$executeRawUnsafe(
    `UPDATE "PaymentSession" SET "data" = jsonb_set(COALESCE("data", '{}'::jsonb), '{emailedAt}', to_jsonb($2::text)) WHERE "id" = $1 AND NOT (COALESCE("data", '{}'::jsonb) ? 'emailedAt')`,
    sessionId, new Date().toISOString(),
  );
  if (!claimed) return;
  try {
    const brand = await getStorefrontMessageBrand(context);
    await sendLogged(context, { to: giftCard.recipientEmail, kind: "gift_card", subject: `$${giftCard.initialValue / 100} gift card`, send: () => sendGiftCardEmail({ to: giftCard.recipientEmail, recipientName: giftCard.recipientName || "there", senderName: data.purchaserName || "A friend", amount: giftCard.initialValue / 100, code: giftCard.code, message: giftCard.message || undefined, storefrontName: brand.name, themeHue: brand.themeHue }) });
  } catch (error) { console.error("Gift card email failed:", error); }
}

export async function giftCardOrderTransaction(context: Context, args: { sessionId: string; token: string }): Promise<StatusResult> {
  if (!tokenOk(args.sessionId, args.token)) return { success: false, error: "We could not find that gift card order.", status: null, code: null, amount: null, recipientEmail: null };
  try { return await settleOnlineGiftCard(context, args.sessionId); }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : "We could not check the payment yet.", status: null, code: null, amount: null, recipientEmail: null }; }
}

