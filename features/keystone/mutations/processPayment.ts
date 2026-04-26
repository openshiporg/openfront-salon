import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";

// Stripe configuration (from environment variables)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Initialize Stripe if key is available
let stripe: any = null;
if (STRIPE_SECRET_KEY) {
  // Dynamic import to avoid errors if stripe isn't installed
  import("stripe").then((Stripe) => {
    stripe = new Stripe.default(STRIPE_SECRET_KEY);
  }).catch(() => {
    console.warn("Stripe module not installed. Payment processing disabled.");
  });
}

// Tax rate (configurable)
const TAX_RATE = parseFloat(process.env.TAX_RATE || "0.08"); // 8% default

export const processPayment = graphql.field({
  type: graphql.object<{
    success: boolean;
    paymentId: string | null;
    error: string | null;
    clientSecret: string | null;
  }>()({
    name: "ProcessPaymentResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      paymentId: graphql.field({ type: graphql.String }),
      error: graphql.field({ type: graphql.String }),
      clientSecret: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    tipAmount: graphql.arg({ type: graphql.Float }),
    discountAmount: graphql.arg({ type: graphql.Float }),
  },
  async resolve(source, { appointmentId, paymentMethod, tipAmount, discountAmount }, context: Context) {
    // Check authentication
    if (!context.session) {
      return {
        success: false,
        paymentId: null,
        error: "You must be logged in to process payments",
        clientSecret: null,
      };
    }

    try {
      // Fetch appointment with services
      const appointment = await context.db.Appointment.findOne({
        where: { id: appointmentId },
      });

      if (!appointment) {
        return {
          success: false,
          paymentId: null,
          error: "Appointment not found",
          clientSecret: null,
        };
      }

      // Get services for this appointment to calculate subtotal
      const appointmentWithServices = await context.query.Appointment.findOne({
        where: { id: appointmentId },
        query: `
          services {
            id
            basePrice
          }
          stylist {
            id
            tier
          }
          client {
            user {
              email
            }
          }
        `,
      });

      if (!appointmentWithServices?.services?.length) {
        return {
          success: false,
          paymentId: null,
          error: "No services found for this appointment",
          clientSecret: null,
        };
      }

      // Calculate subtotal from services
      const subtotal = appointmentWithServices.services.reduce(
        (sum: number, service: any) => sum + (service.basePrice || 0),
        0
      );

      // Calculate tax
      const tax = subtotal * TAX_RATE;

      // Apply tip and discount
      const tip = tipAmount || 0;
      const discount = discountAmount || 0;

      // Calculate total
      const totalAmount = subtotal + tax + tip - discount;

      // Get client email for receipt
      const clientEmail = appointmentWithServices.client?.user?.email;

      // Create payment record
      const payment = await context.db.Payment.createOne({
        data: {
          subtotal,
          tax,
          tip,
          discount,
          totalAmount,
          paymentMethod,
          status: paymentMethod === "cash" ? "completed" : "pending",
          appointment: { connect: { id: appointmentId } },
          processedBy: { connect: { id: context.session.itemId } },
          processedAt: paymentMethod === "cash" ? new Date() : null,
          receiptEmail: clientEmail || "",
        },
      });

      // For card payments, create Stripe Payment Intent
      if (paymentMethod !== "cash" && stripe) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Stripe uses cents
            currency: "usd",
            metadata: {
              appointmentId,
              paymentId: payment.id,
            },
          });

          // Update payment with Stripe info
          await context.db.Payment.updateOne({
            where: { id: payment.id },
            data: {
              stripePaymentIntentId: paymentIntent.id,
              status: "processing",
            },
          });

          return {
            success: true,
            paymentId: payment.id,
            error: null,
            clientSecret: paymentIntent.client_secret,
          };
        } catch (stripeError: any) {
          // Update payment status to failed
          await context.db.Payment.updateOne({
            where: { id: payment.id },
            data: { status: "failed" },
          });

          return {
            success: false,
            paymentId: payment.id,
            error: `Stripe error: ${stripeError.message}`,
            clientSecret: null,
          };
        }
      }

      // For cash payments, mark appointment as completed
      await context.db.Appointment.updateOne({
        where: { id: appointmentId },
        data: { status: "completed" },
      });

      return {
        success: true,
        paymentId: payment.id,
        error: null,
        clientSecret: null,
      };
    } catch (error: any) {
      return {
        success: false,
        paymentId: null,
        error: error.message,
        clientSecret: null,
      };
    }
  },
});

export const confirmPayment = graphql.field({
  type: graphql.object<{
    success: boolean;
    error: string | null;
  }>()({
    name: "ConfirmPaymentResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      error: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    paymentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    stripePaymentIntentId: graphql.arg({ type: graphql.String }),
  },
  async resolve(source, { paymentId, stripePaymentIntentId }, context: Context) {
    if (!context.session) {
      return {
        success: false,
        error: "You must be logged in",
      };
    }

    try {
      const payment = await context.db.Payment.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        return {
          success: false,
          error: "Payment not found",
        };
      }

      // Verify with Stripe if provided
      if (stripePaymentIntentId && stripe) {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

        if (paymentIntent.status !== "succeeded") {
          return {
            success: false,
            error: `Payment not completed. Status: ${paymentIntent.status}`,
          };
        }

        // Get charge details
        const charge = paymentIntent.latest_charge
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : null;

        // Update payment with card details
        await context.db.Payment.updateOne({
          where: { id: paymentId },
          data: {
            status: "completed",
            stripeChargeId: charge?.id || "",
            cardBrand: charge?.payment_method_details?.card?.brand || "",
            cardLast4: charge?.payment_method_details?.card?.last4 || "",
            processedAt: new Date(),
          },
        });
      } else {
        // For non-Stripe confirmations
        await context.db.Payment.updateOne({
          where: { id: paymentId },
          data: {
            status: "completed",
            processedAt: new Date(),
          },
        });
      }

      // Get appointment and mark as completed
      const updatedPayment = await context.query.Payment.findOne({
        where: { id: paymentId },
        query: `appointment { id }`,
      });

      if (updatedPayment?.appointment?.id) {
        await context.db.Appointment.updateOne({
          where: { id: updatedPayment.appointment.id },
          data: { status: "completed" },
        });
      }

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

export const refundPayment = graphql.field({
  type: graphql.object<{
    success: boolean;
    refundId: string | null;
    error: string | null;
  }>()({
    name: "RefundPaymentResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      refundId: graphql.field({ type: graphql.String }),
      error: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    paymentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    amount: graphql.arg({ type: graphql.Float }),
    reason: graphql.arg({ type: graphql.String }),
  },
  async resolve(source, { paymentId, amount, reason }, context: Context) {
    if (!context.session) {
      return {
        success: false,
        refundId: null,
        error: "You must be logged in",
      };
    }

    try {
      const payment = await context.db.Payment.findOne({
        where: { id: paymentId },
      });

      if (!payment) {
        return {
          success: false,
          refundId: null,
          error: "Payment not found",
        };
      }

      if (payment.status !== "completed") {
        return {
          success: false,
          refundId: null,
          error: "Can only refund completed payments",
        };
      }

      const refundAmount = amount || payment.totalAmount;

      // Process Stripe refund if applicable
      if (payment.stripeChargeId && stripe) {
        const refund = await stripe.refunds.create({
          charge: payment.stripeChargeId,
          amount: Math.round(refundAmount * 100),
          reason: reason ? "requested_by_customer" : undefined,
        });

        await context.db.Payment.updateOne({
          where: { id: paymentId },
          data: {
            status: refundAmount >= payment.totalAmount ? "refunded" : "partially_refunded",
            stripeRefundId: refund.id,
            refundedAmount: refundAmount,
            refundReason: reason || "",
            refundedAt: new Date(),
          },
        });

        return {
          success: true,
          refundId: refund.id,
          error: null,
        };
      }

      // For cash refunds
      await context.db.Payment.updateOne({
        where: { id: paymentId },
        data: {
          status: refundAmount >= payment.totalAmount ? "refunded" : "partially_refunded",
          refundedAmount: refundAmount,
          refundReason: reason || "",
          refundedAt: new Date(),
        },
      });

      return {
        success: true,
        refundId: null,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        refundId: null,
        error: error.message,
      };
    }
  },
});

export const distributeTip = graphql.field({
  type: graphql.object<{
    success: boolean;
    error: string | null;
  }>()({
    name: "DistributeTipResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
      error: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    paymentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
  },
  async resolve(source, { paymentId }, context: Context) {
    if (!context.session) {
      return {
        success: false,
        error: "You must be logged in",
      };
    }

    try {
      const payment = await context.query.Payment.findOne({
        where: { id: paymentId },
        query: `
          id
          tip
          tipDistributed
          appointment {
            stylist {
              id
              commissionRate
            }
          }
        `,
      });

      if (!payment) {
        return {
          success: false,
          error: "Payment not found",
        };
      }

      if (payment.tipDistributed) {
        return {
          success: false,
          error: "Tip already distributed",
        };
      }

      if (!payment.tip || payment.tip <= 0) {
        return {
          success: false,
          error: "No tip to distribute",
        };
      }

      // Mark tip as distributed
      // In a real system, you would also:
      // 1. Create a payout record
      // 2. Add to stylist's earnings
      // 3. Generate commission reports
      await context.db.Payment.updateOne({
        where: { id: paymentId },
        data: {
          tipDistributed: true,
          notes: `Tip of $${payment.tip.toFixed(2)} distributed to stylist`,
        },
      });

      return {
        success: true,
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

export const paymentMutations = {
  processPayment,
  confirmPayment,
  refundPayment,
  distributeTip,
};
