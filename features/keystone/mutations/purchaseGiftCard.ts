import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { sendGiftCardEmail } from "../lib/mail";

// Stripe configuration (from environment variables)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Initialize Stripe if key is available
let stripe: any = null;
if (STRIPE_SECRET_KEY) {
  import("stripe").then((Stripe) => {
    stripe = new Stripe.default(STRIPE_SECRET_KEY);
  }).catch(() => {
    console.warn("Stripe module not installed. Gift card processing disabled.");
  });
}

// Generate a unique gift card code
function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing characters
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const purchaseGiftCard = graphql.field({
  type: graphql.object<{
    success: boolean;
    giftCardId: string | null;
    clientSecret: string | null;
    error: string | null;
  }>()({
    name: "PurchaseGiftCardResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      giftCardId: graphql.field({ type: graphql.String }),
      clientSecret: graphql.field({ type: graphql.String }),
      error: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    amount: graphql.arg({ type: graphql.nonNull(graphql.Float) }),
    recipientEmail: graphql.arg({ type: graphql.String }),
    recipientName: graphql.arg({ type: graphql.String }),
    message: graphql.arg({ type: graphql.String }),
    purchaserEmail: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    purchaserName: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  async resolve(
    source,
    { amount, recipientEmail, recipientName, message, purchaserEmail, purchaserName },
    context: Context
  ) {
    try {
      // Validate amount
      if (amount < 25 || amount > 500) {
        return {
          success: false,
          giftCardId: null,
          clientSecret: null,
          error: "Gift card amount must be between $25 and $500",
        };
      }

      // Generate unique code
      const code = generateGiftCardCode();

      // Calculate expiration date (1 year from now, or never expires)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Create Stripe Payment Intent
      if (!stripe) {
        return {
          success: false,
          giftCardId: null,
          clientSecret: null,
          error: "Payment processing is not available. Please contact support.",
        };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: "usd",
        metadata: {
          type: "gift_card",
          code,
          purchaserEmail,
          recipientEmail: recipientEmail || purchaserEmail,
        },
        receipt_email: purchaserEmail,
      });

      // Create the gift card (will be activated once payment is confirmed)
      const giftCard = await context.db.GiftCard.createOne({
        data: {
          code,
          initialValue: amount,
          currentBalance: amount,
          recipientEmail: recipientEmail || purchaserEmail,
          recipientName: recipientName || purchaserName,
          message: message || "",
          expiresAt,
          isActive: false, // Will be activated when payment is confirmed
        },
      });

      // Create initial transaction record
      await context.db.GiftCardTransaction.createOne({
        data: {
          giftCard: { connect: { id: giftCard.id } },
          type: "purchase",
          amount,
        },
      });

      return {
        success: true,
        giftCardId: giftCard.id,
        clientSecret: paymentIntent.client_secret,
        error: null,
      };
    } catch (error: any) {
      console.error("Gift card purchase error:", error);
      return {
        success: false,
        giftCardId: null,
        clientSecret: null,
        error: error.message || "Failed to process gift card purchase",
      };
    }
  },
});

export const confirmGiftCardPurchase = graphql.field({
  type: graphql.object<{
    success: boolean;
    error: string | null;
    code: string | null;
  }>()({
    name: "ConfirmGiftCardPurchaseResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      error: graphql.field({ type: graphql.String }),
      code: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    giftCardId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    stripePaymentIntentId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  async resolve(source, { giftCardId, stripePaymentIntentId }, context: Context) {
    try {
      // Verify payment with Stripe
      if (!stripe) {
        return {
          success: false,
          error: "Payment verification not available",
          code: null,
        };
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return {
          success: false,
          error: `Payment not completed. Status: ${paymentIntent.status}`,
          code: null,
        };
      }

      // Activate the gift card and get full details
      const giftCard = await context.query.GiftCard.findOne({
        where: { id: giftCardId },
        query: `
          id
          code
          initialValue
          recipientEmail
          recipientName
        `,
      });

      if (!giftCard) {
        return {
          success: false,
          error: "Gift card not found",
          code: null,
        };
      }

      // Activate the gift card
      await context.db.GiftCard.updateOne({
        where: { id: giftCardId },
        data: {
          isActive: true,
        },
      });

      // Send email with gift card details
      try {
        // Get purchaser name from payment metadata
        const purchaserName = paymentIntent.metadata.purchaserEmail || "A friend";

        await sendGiftCardEmail({
          to: giftCard.recipientEmail || "",
          recipientName: giftCard.recipientName || "There",
          senderName: purchaserName,
          amount: giftCard.initialValue,
          code: giftCard.code || "",
          message: undefined, // Could be added to metadata
        });
      } catch (emailError) {
        console.error("Failed to send gift card email:", emailError);
        // Don't fail the confirmation if email fails
      }

      return {
        success: true,
        error: null,
        code: giftCard.code,
      };
    } catch (error: any) {
      console.error("Gift card confirmation error:", error);
      return {
        success: false,
        error: error.message || "Failed to confirm gift card purchase",
        code: null,
      };
    }
  },
});

export const giftCardMutations = {
  purchaseGiftCard,
  confirmGiftCardPurchase,
};
