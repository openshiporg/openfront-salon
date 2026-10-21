import { list } from "@keystone-6/core";
import {
  text,
  relationship,
  select,
  float,
  checkbox,
  timestamp,
  json,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { createLifecycleHooks } from "../lifecycle";
import { trackingFields } from "./trackingFields";

export const Stylist = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  hooks: createLifecycleHooks("stylist", ["role", "tier", "baseCommissionRate", "status", "isActive", "userId"]),
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["user", "tier", "commissionRate", "isActive"],
    },
  },
  fields: {
    // Link to User for contact info
    user: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
      },
    }),

    // Role field as specified in Staff Management todo
    role: select({
      type: "enum",
      options: [
        { label: "Stylist", value: "stylist" },
        { label: "Colorist", value: "colorist" },
        { label: "Nail Tech", value: "nail_tech" },
        { label: "Esthetician", value: "esthetician" },
        { label: "Massage Therapist", value: "massage_therapist" },
        { label: "Manager", value: "manager" },
        { label: "Receptionist", value: "receptionist" },
      ],
      ui: {
        description: "Staff member's primary role",
      },
    }),

    // Legacy tier field
    tier: select({
      type: "enum",
      options: [
        { label: "Junior", value: "junior" },
        { label: "Senior", value: "senior" },
        { label: "Master", value: "master" },
        { label: "Celebrity", value: "celebrity" },
      ],
      defaultValue: "junior",
      ui: {
        description: "Stylist experience tier (affects pricing) - legacy",
      },
    }),

    bio: text({
      ui: {
        displayMode: "textarea",
        description: "Professional biography",
      },
    }),

    // Base commission rate (percentage as float)
    baseCommissionRate: float({
      access: { read: ({ session }) => permissions.canManageCommissions({ session }) || permissions.canManagePayments({ session }) || permissions.canViewReports({ session }) },
      defaultValue: 0.5,
      validation: { min: 0, max: 1 },
      ui: {
        description: "Base commission rate as percentage (e.g., 0.5 for 50%)",
      },
    }),

    // Legacy field
    commissionRate: float({
      access: { read: ({ session }) => permissions.canManageCommissions({ session }) || permissions.canManagePayments({ session }) || permissions.canViewReports({ session }) },
      defaultValue: 0.5,
      validation: { min: 0, max: 1 },
      ui: {
        description: "Commission rate as decimal (legacy - use baseCommissionRate)",
      },
    }),

    certifications: json({
      access: { read: permissions.canManagePeople },
      ui: {
        description: "Array of certifications: [{name, issuer, date, expiryDate}]",
      },
    }),

    hireDate: timestamp({
      access: { read: permissions.canManagePeople },
      ui: {
        description: "Date staff member was hired",
      },
    }),

    employmentType: select({
      access: { read: permissions.canManagePeople },
      type: "enum",
      options: [
        { label: "Full-time", value: "full_time" },
        { label: "Part-time", value: "part_time" },
        { label: "Contractor", value: "contractor" },
      ],
      ui: {
        description: "Employment type",
      },
    }),

    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "On Leave", value: "on_leave" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "active",
      ui: {
        description: "Current employment status",
      },
    }),

    // Legacy field
    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether stylist is currently active (legacy - use status)",
      },
    }),

    photoUrl: text({
      ui: {
        description: "Legacy staff photo path; prefer the SalonImage imagePath relationship below",
      },
    }),

    socialMedia: json({
      ui: {
        description: "Social media handles: {instagram, facebook, etc}",
      },
    }),

    // Photo relationship
    photo: relationship({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "imagePath", "altText"],
        inlineCreate: { fields: ["imagePath", "altText"] },
        inlineEdit: { fields: ["imagePath", "altText"] },
      },
    }),

    // Services this stylist specializes in
    specializations: relationship({
      ref: "Service.specialists",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice"],
      },
    }),

    locations: relationship({ ref: "Location.stylists", many: true }),

    segmentQualifications: relationship({ ref: "ServiceSegment.qualifiedPractitioners", many: true }),
    appointmentSegments: relationship({ ref: "AppointmentSegment.practitioner", many: true }),
    gratuityEntries: relationship({ ref: "GratuityLedgerEntry.practitioner", many: true }),

    // Schedules for this stylist
    schedules: relationship({
      ref: "StylistSchedule.stylist",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["dayOfWeek", "startTime", "endTime", "isAvailable"],
      },
    }),

    // Appointments assigned to this stylist
    appointments: relationship({
      ref: "Appointment.stylist",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    // Clients who prefer this stylist
    preferredByClients: relationship({
      ref: "Client.preferredStylist",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    // Color formulas created by this stylist
    colorFormulas: relationship({
      ref: "ColorFormula.stylist",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    // Waitlist entries where this stylist is preferred
    waitlistEntries: relationship({
      ref: "WaitlistEntry.preferredStylists",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    reviews: relationship({
      ref: "Review.stylist",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    ...trackingFields,
  },
});
