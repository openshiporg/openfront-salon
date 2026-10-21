import { User } from './User';
import { Role } from './Role';
import { SalonImage } from './SalonImage';
import { ServiceCategory } from './ServiceCategory';
import { Service } from './Service';
import { ServiceVariant } from './ServiceVariant';
import { Stylist } from './Stylist';
import { Client } from './Client';
import { ClientNote } from './ClientNote';
import { ColorFormula } from './ColorFormula';
import { StylistSchedule } from './StylistSchedule';
import { Appointment } from './Appointment';
import { AppointmentLineItem } from './AppointmentLineItem';
import { Payment } from './Payment';
import { PaymentProvider } from './PaymentProvider';
import { PaymentSession } from './PaymentSession';
import { PaymentWebhookEvent } from './PaymentWebhookEvent';
import { ClientPoints } from './ClientPoints';
import { Referral } from './Referral';
import { MessageTemplate } from './MessageTemplate';
import { MessageLog } from './MessageLog';
import { GiftCard } from './GiftCard';
import { GiftCardTransaction } from './GiftCardTransaction';
import { ClientMembership } from './ClientMembership';
import { IntakeForm } from './IntakeForm';
import { ServicePackage } from './ServicePackage';
import { Membership } from './Membership';
import { FormSubmission } from './FormSubmission';
import { FormTemplate } from './FormTemplate';
import { LoyaltyProgram } from './LoyaltyProgram';
import { WaitlistEntry } from './WaitlistEntry';
import { WidgetConfiguration } from './WidgetConfiguration';
import { Location } from './Location';
import { StoreSettings } from './StoreSettings';
import { SalonResource } from './SalonResource';
import { Product } from './Product';
import { ProductSale } from './ProductSale';
import { Commission } from './Commission';
import { Review } from './Review';
import { SalonTransaction } from './SalonTransaction';
import { SalonTransactionLineItem } from './SalonTransactionLineItem';
import { ClientPackage } from './ClientPackage';
import { ClientPackageUsage } from './ClientPackageUsage';
import { DomainEvent } from './DomainEvent';
import { InventoryMovement } from './InventoryMovement';
import { ServiceSegment } from './ServiceSegment';
import { AppointmentSegment } from './AppointmentSegment';
import { AppointmentScheduleRevision } from './AppointmentScheduleRevision';
import { SegmentTransition } from './SegmentTransition';
import { TransactionReversal } from './TransactionReversal';
import { TransactionReversalLine } from './TransactionReversalLine';
import { CommissionAdjustment } from './CommissionAdjustment';
import { GratuityLedgerEntry } from './GratuityLedgerEntry';
import { ConsultationTemplateVersion } from './ConsultationTemplateVersion';
import { ConsultationSubmission } from './ConsultationSubmission';
import { ConsultationReview } from './ConsultationReview';
import { ClientPackageAdjustment } from './ClientPackageAdjustment';
import { DepositAdjustment } from './DepositAdjustment';

export const models = {
  User,
  Role,
  SalonImage,
  ServiceCategory,
  Service,
  ServiceVariant,
  Stylist,
  Client,
  ClientNote,
  ColorFormula,
  StylistSchedule,
  Appointment,
  AppointmentLineItem,
  Payment,
  PaymentProvider,
  PaymentSession,
  PaymentWebhookEvent,
  ClientPoints,
  Referral,
  MessageTemplate,
  MessageLog,
  GiftCard,
  GiftCardTransaction,
  ClientMembership,
  IntakeForm,
  ServicePackage,
  Membership,
  WaitlistEntry,
  WidgetConfiguration,
  FormSubmission,
  FormTemplate,
  LoyaltyProgram,
  Location,
  StoreSettings,
  SalonResource,
  Product,
  ProductSale,
  Commission,
  Review,
  SalonTransaction,
  SalonTransactionLineItem,
  ClientPackage,
  ClientPackageUsage,
  DomainEvent,
  InventoryMovement,
  ServiceSegment,
  AppointmentSegment,
  AppointmentScheduleRevision,
  SegmentTransition,
  TransactionReversal,
  TransactionReversalLine,
  CommissionAdjustment,
  GratuityLedgerEntry,
  ConsultationTemplateVersion,
  ConsultationSubmission,
  ConsultationReview,
  ClientPackageAdjustment,
  DepositAdjustment,
};

export default models;
