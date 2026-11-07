'use server' 

import { createTransport, getTestMessageUrl } from "nodemailer";
import { emailButton, emailHeading, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals, escapeHtml } from "./email-layout";

// Utility function to get base URL for emails
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  
  // Fallback warning - this should be set in production
  console.warn('SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.');
  return '';
}

export async function mailConfigured() {
  return hasSmtpConfiguration();
}

function hasSmtpConfiguration() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

const transport = createTransport({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

function passwordResetEmail({ url }: { url: string }): string {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`,
  });
}

export async function sendPasswordResetEmail(resetToken: string, to: string, baseUrl?: string): Promise<void> {
  // Use provided baseUrl or fall back to utility function
  const frontendUrl = baseUrl || getBaseUrlForEmails();

  // email the user a token
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`,
    }),
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`📧 Message Sent!  Preview it at ${getTestMessageUrl(info as any)}`);
  }
}

function appointmentConfirmationEmail(params: {
  clientName: string;
  serviceName: string;
  stylistName: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  price: number;
  storefrontName: string | null;
  themeHue: number;
  reminder?: boolean;
  manageUrl?: string | null;
}): string {
  return emailLayout({
    storeName: params.storefrontName || undefined,
    preheader: params.reminder ? "A reminder of your appointment tomorrow." : "Your appointment is confirmed.",
    title: params.reminder ? "See you tomorrow" : "Appointment confirmed",
    body: `${emailParagraph(`Hi ${escapeHtml(params.clientName)},`)}
${emailParagraph(params.reminder ? "This is a reminder of your appointment tomorrow." : "We're excited to see you! Your appointment has been confirmed.")}
${emailHeading("Appointment details")}
${emailPanel(`<strong>Service:</strong> ${escapeHtml(params.serviceName)}<br><strong>Stylist:</strong> ${escapeHtml(params.stylistName)}<br><strong>Date:</strong> ${escapeHtml(params.appointmentDate)}<br><strong>Time:</strong> ${escapeHtml(params.appointmentTime)}<br><strong>Duration:</strong> ${escapeHtml(params.duration)} minutes`)}
${emailTotals([{ label: "Price", value: `$${params.price.toFixed(2)}` }])}
${emailParagraph("<strong>Please arrive 10 minutes early</strong> so we can start your appointment on time.")}
${params.manageUrl ? emailButton("Reschedule or cancel", params.manageUrl) : emailMuted("Need to reschedule? Please call us or visit our website.")}`,
  });
}

export async function sendAppointmentConfirmation(params: {
  to: string;
  clientName: string;
  serviceName: string;
  stylistName: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  price: number;
  storefrontName: string | null;
  themeHue: number;
  reminder?: boolean;
  manageUrl?: string | null;
}): Promise<void> {
  if (!hasSmtpConfiguration()) throw new Error("Email is not configured (SMTP_HOST / SMTP_FROM)");

  try {
    const info = await transport.sendMail({
      to: params.to,
      from: process.env.SMTP_FROM,
      subject: await appointmentEmailSubject(params),
      html: appointmentConfirmationEmail(params),
    });

    if (process.env.SMTP_USER?.includes("ethereal.email")) {
      console.log(`📧 Appointment confirmation sent! Preview: ${getTestMessageUrl(info as any)}`);
    }
  } catch (error) {
    console.error("Failed to send appointment confirmation email:", error);
    throw error;
  }
}

export async function appointmentEmailSubject(params: { appointmentDate: string; appointmentTime: string; reminder?: boolean; storefrontName?: string | null }) {
  return params.reminder
    ? `Reminder: ${params.appointmentDate} at ${params.appointmentTime}${params.storefrontName ? ` · ${params.storefrontName}` : ""}`
    : `Appointment Confirmed - ${params.appointmentDate} at ${params.appointmentTime}`;
}

function giftCardEmail(params: {
  recipientName: string;
  senderName: string;
  amount: number;
  code: string;
  message?: string;
  storefrontName: string | null;
  themeHue: number;
}): string {
  return emailLayout({
    storeName: params.storefrontName || undefined,
    preheader: `${params.senderName} sent you a gift card.`,
    title: "You've received a gift card",
    body: `${emailParagraph(`Hi ${escapeHtml(params.recipientName)}, ${escapeHtml(params.senderName)} sent you a gift card.`)}
${params.message ? emailPanel(`&ldquo;${escapeHtml(params.message)}&rdquo;`) : ""}
${emailPanel(`<span style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Gift card value</span><br><span style="font-size:36px;font-weight:700;line-height:48px;">$${params.amount.toFixed(2)}</span><br><span style="font-size:13px;text-transform:uppercase;letter-spacing:1px;">Code</span><br><span style="font-family:Menlo,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:2px;">${escapeHtml(params.code)}</span>`, "center")}
${emailHeading("How to use it")}
${emailParagraph("Book an appointment online or call us, then give the front desk this code when you pay.")}
${process.env.SMTP_STORE_LINK ? emailButton("Book your appointment", `${process.env.SMTP_STORE_LINK}/book`) : ""}
${emailMuted("This gift card is valid for one year and can be used for any service or product.")}`,
  });
}

export async function sendGiftCardEmail(params: {
  to: string;
  recipientName: string;
  senderName: string;
  amount: number;
  code: string;
  message?: string;
  storefrontName: string | null;
  themeHue: number;
}): Promise<void> {
  try {
    const info = await transport.sendMail({
      to: params.to,
      from: process.env.SMTP_FROM,
      subject: `You've Received a $${params.amount} Gift Card from ${params.senderName}!`,
      html: giftCardEmail(params),
    });

    if (process.env.SMTP_USER?.includes("ethereal.email")) {
      console.log(`📧 Gift card email sent! Preview: ${getTestMessageUrl(info as any)}`);
    }
  } catch (error) {
    console.error("Failed to send gift card email:", error);
    throw error;
  }
}

/** Short client notice (appointment cancelled or moved), in the confirmation email's style. */
export async function sendAppointmentNoticeEmail(params: {
  to: string;
  subject: string;
  heading: string;
  clientName: string;
  body: string;
  rows: Array<[string, string]>;
  storefrontName: string | null;
  themeHue: number;
  actionUrl?: string | null;
  actionLabel?: string | null;
}): Promise<void> {
  if (!hasSmtpConfiguration()) throw new Error("Email is not configured (SMTP_HOST / SMTP_FROM)");
  const html = emailLayout({
    storeName: params.storefrontName || undefined,
    preheader: params.body,
    title: params.heading,
    body: `${emailParagraph(`Hi ${escapeHtml(params.clientName)},`)}
${emailParagraph(escapeHtml(params.body))}
${emailPanel(params.rows.map(([label, value]) => `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`).join("<br>"))}
${params.actionUrl ? emailButton(params.actionLabel || "Book again", params.actionUrl) : ""}`,
  });
  await transport.sendMail({ to: params.to, from: process.env.SMTP_FROM, subject: params.subject, html });
}
