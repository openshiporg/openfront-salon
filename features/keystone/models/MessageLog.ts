import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  select,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";

import { trackingFields } from "./trackingFields";

export const MessageLog = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients,
    },
    filter: {
      query: rules.canReadMessageLogs,
    },
  },
  ui: {
    listView: {
      initialColumns: ["recipientAddress", "kind", "sentAt", "channel", "status"],
    },
  },
  fields: {
    // Recipient of the message
    recipient: relationship({
      ref: "User.messageLogs",
      ui: {
        displayMode: "select",
        description: "User who received this message",
      },
    }),

    // Template used for this message
    template: relationship({
      ref: "MessageTemplate",
      ui: {
        displayMode: "select",
        description: "Message template used",
      },
    }),

    sentAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the message was sent",
      },
    }),

    channel: select({
      type: "string",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Push Notification", value: "push" },
      ],
      validation: { isRequired: true },
      ui: {
        description: "Communication channel used to send the message",
      },
    }),

    status: select({
      type: "string",
      options: [
        { label: "Sent", value: "sent" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" },
      ],
      defaultValue: "sent",
      ui: {
        description: "Delivery status of the message",
      },
    }),

    recipientAddress: text({
      ui: { description: "Email address or phone number the message went to (guests have no user account)" },
    }),
    subject: text({
      ui: { description: "Subject line or first line of the message" },
    }),
    kind: text({
      ui: { description: "What the message was for: appointment_confirmation, appointment_reminder, gift_card, password_reset" },
    }),
    errorMessage: text({
      ui: {
        displayMode: "textarea",
        description: "Error details if the message failed to deliver",
      },
    }),
    ...trackingFields,
  },
});
