import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  select,
  float,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const Payment = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["appointment", "totalAmount", "paymentMethod", "status", "processedAt"],
    },
  },
  fields: {
    // Core amount fields
    subtotal: float({
      validation: { isRequired: true },
      ui: {
        description: "Service charges before tax and tip",
      },
    }),

    tax: float({
      defaultValue: 0,
      ui: {
        description: "Tax amount",
      },
    }),

    tip: float({
      defaultValue: 0,
      ui: {
        description: "Tip amount",
      },
    }),

    discount: float({
      defaultValue: 0,
      ui: {
        description: "Any discount applied",
      },
    }),

    totalAmount: float({
      validation: { isRequired: true },
      ui: {
        description: "Total amount charged (subtotal + tax + tip - discount)",
      },
    }),

    // Payment method and processing
    paymentMethod: select({
      type: "string",
      options: [
        { label: "Credit Card", value: "credit_card" },
        { label: "Debit Card", value: "debit_card" },
        { label: "Cash", value: "cash" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Apple Pay", value: "apple_pay" },
        { label: "Google Pay", value: "google_pay" },
      ],
      defaultValue: "credit_card",
      validation: { isRequired: true },
    }),

    status: select({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
        { label: "Partially Refunded", value: "partially_refunded" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),

    // Stripe integration fields
    stripePaymentIntentId: text({
      ui: {
        description: "Stripe Payment Intent ID for card payments",
      },
    }),

    stripeChargeId: text({
      ui: {
        description: "Stripe Charge ID for completed payments",
      },
    }),

    stripeRefundId: text({
      ui: {
        description: "Stripe Refund ID if payment was refunded",
      },
    }),

    // Card details (last 4 digits, brand)
    cardBrand: text({
      ui: {
        description: "Card brand (Visa, Mastercard, etc.)",
      },
    }),

    cardLast4: text({
      ui: {
        description: "Last 4 digits of card",
      },
    }),

    // Refund tracking
    refundedAmount: float({
      defaultValue: 0,
      ui: {
        description: "Amount refunded",
      },
    }),

    refundReason: text({
      ui: {
        displayMode: "textarea",
        description: "Reason for refund if applicable",
      },
    }),

    // Tip distribution
    tipDistributed: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether tip has been distributed to stylist",
      },
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the payment record was created",
      },
    }),

    processedAt: timestamp({
      ui: {
        description: "When the payment was successfully processed",
      },
    }),

    refundedAt: timestamp({
      ui: {
        description: "When the refund was processed",
      },
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Internal notes about the payment",
      },
    }),

    // Relationships
    appointment: relationship({
      ref: "Appointment.payment",
      ui: {
        displayMode: "select",
      },
    }),

    // Processed by (staff member who processed the payment)
    processedBy: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who processed this payment",
      },
    }),

    // Receipt tracking
    receiptSent: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether receipt email was sent to client",
      },
    }),

    receiptEmail: text({
      ui: {
        description: "Email address receipt was sent to",
      },
    }),
  },
});
