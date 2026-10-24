import { graphql } from "@keystone-6/core";
import { registerSalonCustomer } from "./registerSalonCustomer";
import redirectToInit from "./redirectToInit";
import { paymentMutations } from "./processPayment";
import { giftCardMutations } from "./purchaseGiftCard";
import { bookAppointment } from "./bookAppointment";
import { checkAvailability } from "../extendGraphqlSchema/checkAvailability";
import { calculateCommission } from "../extendGraphqlSchema/calculateCommission";
import { storefrontStylists, storefrontStylist } from "../extendGraphqlSchema/storefrontStylists";
import { salonOperationsWorkspace } from "../extendGraphqlSchema/salonOperationsWorkspace";
import { runSalonOnboarding } from "./runSalonOnboarding";
import { completeAppointmentCheckout } from "./completeAppointmentCheckout";
import { processAppointmentDeposit, transitionAppointment } from "./appointmentWorkflows";
import { redeemClientPackage } from "./packageWorkflows";
import { joinWaitlist, joinWaitlistAsClient, transitionWaitlistEntry } from "./waitlistWorkflows";
import { setStylistScheduleAvailability, upsertStylistSchedule } from "./scheduleWorkflows";
import { payoutCommissions, payoutGratuities } from "./commissionWorkflows";
import { submitAppointmentReview, updateClientCareProfile } from "./clientCareWorkflows";
import { sellClientBenefit, setClientBenefitStatus } from "./benefitWorkflows";
import { adjustClientPoints, completeReferral } from "./loyaltyWorkflows";
import { adjustSalonInventory } from "./inventoryWorkflows";
import { setSalonResourceAvailability } from "./resourceWorkflows";
import { scheduleAppointmentSegments, transitionAppointmentSegment } from "./segmentSchedulingWorkflows";
import { adjustSaleCompensation, reverseSalonTransaction } from "./reversalWorkflows";
import { publishConsultationTemplateVersion, reviewConsultation, submitConsultation } from "./consultationWorkflows";
import { clientPortal } from "../extendGraphqlSchema/clientPortal";
import { publicStorefrontSettings } from "../extendGraphqlSchema/publicStorefrontSettings";
import { upsertSalonStoreSettings } from "./storeSettings";
import { salonManagementWorkspace, saveSalonRecord } from "./managementWorkflows";
import { salonLocationStock } from "../extendGraphqlSchema/salonLocationStock";
import { giftCardBalance, storefrontBenefits } from "../extendGraphqlSchema/storefrontBenefits";

export const extendGraphqlSchema = graphql.extend((base) => ({
  query: {
    redirectToInit: graphql.field({
      type: graphql.Boolean,
      resolve: redirectToInit,
    }),
    checkAvailability,
    calculateCommission,
    storefrontStylists,
    storefrontStylist,
    salonOperationsWorkspace,
    clientPortal,
    publicStorefrontSettings,
    salonManagementWorkspace,
    salonLocationStock,
    storefrontBenefits,
    giftCardBalance,
  },
  mutation: {
    registerSalonCustomer,
    bookAppointment,
    processPayment: paymentMutations.processPayment,
    confirmPayment: paymentMutations.confirmPayment,
    refundPayment: paymentMutations.refundPayment,
    distributeTip: paymentMutations.distributeTip,
    purchaseGiftCard: giftCardMutations.purchaseGiftCard,
    confirmGiftCardPurchase: giftCardMutations.confirmGiftCardPurchase,
    applyGiftCardBalance: giftCardMutations.applyGiftCardBalance,
    transitionAppointment,
    processAppointmentDeposit,
    redeemClientPackage,
    joinWaitlist,
    joinWaitlistAsClient,
    transitionWaitlistEntry,
    upsertStylistSchedule,
    setStylistScheduleAvailability,
    payoutCommissions,
    payoutGratuities,
    updateClientCareProfile,
    submitAppointmentReview,
    sellClientBenefit,
    setClientBenefitStatus,
    adjustClientPoints,
    completeReferral,
    adjustSalonInventory,
    setSalonResourceAvailability,
    scheduleAppointmentSegments,
    transitionAppointmentSegment,
    reverseSalonTransaction,
    adjustSaleCompensation,
    publishConsultationTemplateVersion,
    submitConsultation,
    reviewConsultation,
    runSalonOnboarding,
    completeAppointmentCheckout,
    upsertSalonStoreSettings,
    saveSalonRecord,
  },
}));
