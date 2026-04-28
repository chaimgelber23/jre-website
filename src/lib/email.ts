import { Resend } from "resend";

const FROM_EMAIL = "The JRE <noreply@beta.thejre.org>";
const REPLY_TO = "office@thejre.org";

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface DonationEmailData {
  to: string;
  name: string;
  amount: number;
  isRecurring: boolean;
  sponsorship?: string;
  transactionId?: string;
}

interface RegistrationEmailData {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  eventImageUrl?: string | null;
  emailExtraHtml?: string | null;
  adults: number;
  kids: number;
  total: number;
  sponsorship?: string;
  fairMarketValue?: number;
  taxDeductible?: number;
  transactionId?: string;
}

interface HonoreeEmailData {
  to: string;
  honoreeName: string;
  donorName: string;
  message?: string;
}

export async function sendDonationConfirmation(data: DonationEmailData) {
  const resend = getResendClient();
  if (!resend) {
    console.log("Resend API key not configured, skipping email");
    return { success: false, error: "Email not configured" };
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: data.to,
      subject: `Thank you for your donation to The JRE!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You for Your Donation</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh; background: #f8f9fa;">
            <tr>
              <td align="center" style="padding: 60px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

                  <!-- Logo Header -->
                  <tr>
                    <td align="center" style="padding: 0 0 8px 0;">
                      <img src="https://thejre.org/images/logo.png" alt="The JRE" width="140" style="display: block; margin: 0 auto; max-width: 140px; height: auto;" />
                    </td>
                  </tr>

                  <!-- Main Card -->
                  <tr>
                    <td>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);">

                        <!-- Subtle Brand Accent -->
                        <tr>
                          <td style="height: 3px; background: linear-gradient(90deg, #EF8046, #f59e0b);"></td>
                        </tr>

                        <!-- Header -->
                        <tr>
                          <td style="padding: 56px 48px 48px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                            <div style="width: 40px; height: 2px; background: linear-gradient(90deg, transparent, #EF8046, transparent); margin: 0 auto 32px;"></div>
                            <h1 style="color: #1a1a1a; margin: 0 0 12px; font-size: 36px; font-weight: 600; letter-spacing: -0.8px;">Thank You</h1>
                            <p style="color: #6b7280; margin: 0; font-size: 15px; font-weight: 400; line-height: 1.6;">Your generosity makes a meaningful difference</p>
                          </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                          <td style="padding: 48px 48px 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; margin: 0 0 8px; line-height: 1.5;">Dear ${data.name},</p>
                            <p style="color: #6b7280; font-size: 15px; margin: 0 0 40px; line-height: 1.6;">Thank you for your ${data.isRecurring ? "monthly " : ""}donation to The JRE. Your generous support helps us continue providing meaningful Jewish experiences for the Westchester community.</p>

                            <!-- Amount Display -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                              <tr>
                                <td style="padding: 32px; background: #fafafa; border-left: 4px solid #EF8046; border-radius: 8px; text-align: center;">
                                  <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600;">Your ${data.isRecurring ? "Monthly " : ""}Donation</div>
                                  <div style="color: #EF8046; font-size: 40px; font-weight: 600; letter-spacing: -1px;">$${data.amount.toFixed(2)}</div>
                                  ${data.isRecurring ? '<div style="color: #6b7280; font-size: 13px; margin-top: 8px;">per month</div>' : ""}
                                </td>
                              </tr>
                            </table>

                            <!-- Details -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                              <tr>
                                <td>
                                  <h3 style="color: #9ca3af; font-size: 11px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Transaction Details</h3>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">Amount</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">$${data.amount.toFixed(2)}</td>
                                    </tr>
                                    ${data.isRecurring ? `
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">Frequency</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">Monthly</td>
                                    </tr>
                                    ` : ""}
                                    ${data.sponsorship ? `
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">Sponsorship</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">${data.sponsorship}</td>
                                    </tr>
                                    ` : ""}
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">Date</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</td>
                                    </tr>
                                    ${data.transactionId ? `
                                    <tr>
                                      <td colspan="2" style="color: #9ca3af; font-size: 12px; padding: 12px 0 0;">Transaction ID: ${data.transactionId}</td>
                                    </tr>
                                    ` : ""}
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <!-- Tax Notice -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981; margin: 0 0 40px;">
                              <tr>
                                <td style="padding: 20px;">
                                  <p style="color: #065f46; font-size: 13px; margin: 0; line-height: 1.6;">
                                    <strong style="font-weight: 600;">Tax-Deductible:</strong> The JRE is a registered 501(c)(3) nonprofit. Please save this email for your tax records.
                                  </p>
                                </td>
                              </tr>
                            </table>

                            <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">With gratitude,<br><span style="color: #1a1a1a; font-weight: 500;">The JRE Team</span></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 48px 20px; text-align: center;">
                      <div style="width: 32px; height: 1px; background: linear-gradient(90deg, transparent, #d1d5db, transparent); margin: 0 auto 24px;"></div>
                      <p style="color: #1a1a1a; font-size: 11px; margin: 0 0 4px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">The JRE</p>
                      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 12px; font-weight: 400;">Jewish Renaissance Experience</p>
                      <p style="color: #d1d5db; font-size: 11px; margin: 0 0 12px; line-height: 1.6;">1495 Weaver Street<br>Scarsdale, NY 10583</p>
                      <p style="color: #d1d5db; font-size: 11px; margin: 0;">
                        <a href="mailto:office@thejre.org" style="color: #9ca3af; text-decoration: none; transition: color 0.2s;">office@thejre.org</a>
                        <span style="color: #e5e7eb; margin: 0 8px;">·</span>
                        <a href="tel:914-713-4355" style="color: #9ca3af; text-decoration: none; transition: color 0.2s;">914-713-4355</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending donation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: result?.id };
  } catch (error) {
    console.error("Failed to send donation email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendRegistrationConfirmation(data: RegistrationEmailData) {
  const resend = getResendClient();
  if (!resend) {
    console.log("Resend API key not configured, skipping email");
    return { success: false, error: "Email not configured" };
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: data.to,
      subject: `You're registered for ${data.eventTitle}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Event Registration Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh; background: #f8f9fa;">
            <tr>
              <td align="center" style="padding: 60px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

                  <!-- Logo Header (on white) -->
                  <tr>
                    <td align="center" style="padding: 0 0 8px 0;">
                      <img src="https://thejre.org/images/logo.png" alt="The JRE" width="140" style="display: block; margin: 0 auto; max-width: 140px; height: auto;" />
                    </td>
                  </tr>

                  <!-- Main Card -->
                  <tr>
                    <td>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);">

                        <!-- Subtle Brand Accent -->
                        <tr>
                          <td style="height: 3px; background: linear-gradient(90deg, #EF8046, #f59e0b);"></td>
                        </tr>

                        <!-- Header -->
                        <tr>
                          <td style="padding: 56px 48px 48px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                            <div style="width: 40px; height: 2px; background: linear-gradient(90deg, transparent, #EF8046, transparent); margin: 0 auto 32px;"></div>
                            <h1 style="color: #1a1a1a; margin: 0 0 12px; font-size: 36px; font-weight: 600; letter-spacing: -0.8px;">You're Registered</h1>
                            <p style="color: #6b7280; margin: 0; font-size: 15px; font-weight: 400; line-height: 1.6;">We look forward to seeing you at the event</p>
                          </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                          <td style="padding: 48px 48px 40px;">
                            <p style="color: #1a1a1a; font-size: 16px; margin: 0 0 8px; line-height: 1.5;">Dear ${data.name},</p>
                            <p style="color: #6b7280; font-size: 15px; margin: 0 0 40px; line-height: 1.6;">Your registration has been confirmed. Here are your event details:</p>

                            <!-- Event Banner -->
                            ${data.eventImageUrl ? `
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                              <tr>
                                <td style="border-radius: 12px; overflow: hidden;">
                                  <img src="https://thejre.org${data.eventImageUrl}" alt="${data.eventTitle}" width="504" style="display: block; width: 100%; height: auto; border-radius: 12px;" />
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 16px 0 0;">
                                  <h2 style="color: #1a1a1a; font-size: 22px; font-weight: 600; margin: 0; line-height: 1.3;">${data.eventTitle}</h2>
                                </td>
                              </tr>
                            </table>
                            ` : `
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                              <tr>
                                <td style="background: linear-gradient(135deg, #1a202c 0%, #2d3748 40%, #1a202c 100%); border-radius: 12px; padding: 40px 32px; text-align: center;">
                                  <div style="color: rgba(239, 128, 70, 0.6); font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">The JRE Presents</div>
                                  <h2 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 12px; line-height: 1.3;">${data.eventTitle}</h2>
                                  <div style="width: 40px; height: 2px; background: linear-gradient(90deg, transparent, #EF8046, transparent); margin: 0 auto 12px;"></div>
                                  <div style="color: #9ca3af; font-size: 13px; font-weight: 500;">${data.eventDate}</div>
                                </td>
                              </tr>
                            </table>
                            `}

                            <!-- Event Details -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                              <tr>
                                <td>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #9ca3af; font-size: 13px; padding: 16px 0; border-bottom: 1px solid #f0f0f0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Date</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 15px; font-weight: 500; padding: 16px 0; border-bottom: 1px solid #f0f0f0;">${data.eventDate}</td>
                                    </tr>
                                    <tr>
                                      <td style="color: #9ca3af; font-size: 13px; padding: 16px 0; border-bottom: 1px solid #f0f0f0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Time</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 15px; font-weight: 500; padding: 16px 0; border-bottom: 1px solid #f0f0f0;">${data.eventTime}</td>
                                    </tr>
                                    <tr>
                                      <td style="color: #9ca3af; font-size: 13px; padding: 16px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Location</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 15px; font-weight: 500; padding: 16px 0;">${data.eventLocation}</td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            ${data.emailExtraHtml ? data.emailExtraHtml : ""}

                            <!-- Registration Summary -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fafafa; border-radius: 8px; padding: 24px; margin: 0 0 40px;">
                              <tr>
                                <td>
                                  <h3 style="color: #9ca3af; font-size: 11px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Registration Summary</h3>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">Adults</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${data.adults}</td>
                                    </tr>
                                    ${data.kids > 0 ? `
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">Children</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${data.kids}</td>
                                    </tr>
                                    ` : ""}
                                    ${data.sponsorship ? `
                                    <tr>
                                      <td style="color: #6b7280; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">Sponsorship</td>
                                      <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${data.sponsorship}</td>
                                    </tr>
                                    ` : ""}
                                    <tr>
                                      <td style="color: #1a1a1a; font-size: 15px; padding: 14px 0 0; font-weight: 600;">Total</td>
                                      <td align="right" style="color: #EF8046; font-size: 20px; font-weight: 600; padding: 14px 0 0;">$${data.total.toFixed(2)}</td>
                                    </tr>
                                    ${data.transactionId ? `
                                    <tr>
                                      <td colspan="2" style="color: #9ca3af; font-size: 12px; padding: 12px 0 0;">Confirmation: ${data.transactionId}</td>
                                    </tr>
                                    ` : ""}
                                  </table>
                                </td>
                              </tr>
                            </table>

                            ${data.sponsorship && data.taxDeductible !== undefined ? `
                            <!-- Tax Receipt Block -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981; margin: 0 0 40px;">
                              <tr>
                                <td style="padding: 20px 24px;">
                                  <p style="color: #065f46; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px;">Tax Receipt — 501(c)(3)</p>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #374151; font-size: 13px; padding: 5px 0;">Sponsorship Amount</td>
                                      <td align="right" style="color: #374151; font-size: 13px; padding: 5px 0;">$${data.total.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                      <td style="color: #374151; font-size: 13px; padding: 5px 0;">Fair Market Value of Benefits Received</td>
                                      <td align="right" style="color: #374151; font-size: 13px; padding: 5px 0;">$${(data.fairMarketValue ?? 0).toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                      <td style="color: #065f46; font-size: 14px; font-weight: 700; padding: 10px 0 4px; border-top: 1px solid #bbf7d0;">Tax-Deductible Portion</td>
                                      <td align="right" style="color: #065f46; font-size: 14px; font-weight: 700; padding: 10px 0 4px; border-top: 1px solid #bbf7d0;">$${data.taxDeductible.toFixed(2)}</td>
                                    </tr>
                                  </table>
                                  <p style="color: #6b7280; font-size: 11px; margin: 10px 0 0; line-height: 1.6;">The Jewish Renaissance Experience is a registered 501(c)(3) nonprofit organization. Please retain this email as your official tax receipt. No goods or services were provided beyond the fair market value noted above.</p>
                                </td>
                              </tr>
                            </table>
                            ` : ""}
                            <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px; line-height: 1.6;">If you have any questions, feel free to reach out to <a href="mailto:glevi@thejre.org" style="color: #EF8046; text-decoration: none; font-weight: 500;">glevi@thejre.org</a> or <a href="mailto:yoratz@thejre.org" style="color: #EF8046; text-decoration: none; font-weight: 500;">yoratz@thejre.org</a>.</p>
                            <p style="color: #6b7280; font-size: 14px; margin: 0 0 32px; line-height: 1.6;">Looking forward to seeing you!</p>

                            <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5;">Best regards,<br><span style="color: #1a1a1a; font-weight: 500;">The JRE Team</span></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 48px 20px; text-align: center;">
                      <div style="width: 32px; height: 1px; background: linear-gradient(90deg, transparent, #d1d5db, transparent); margin: 0 auto 24px;"></div>
                      <p style="color: #1a1a1a; font-size: 11px; margin: 0 0 4px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">The JRE</p>
                      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 12px; font-weight: 400;">Jewish Renaissance Experience</p>
                      <p style="color: #d1d5db; font-size: 11px; margin: 0 0 12px; line-height: 1.6;">1495 Weaver Street<br>Scarsdale, NY 10583</p>
                      <p style="color: #d1d5db; font-size: 11px; margin: 0;">
                        <a href="mailto:office@thejre.org" style="color: #9ca3af; text-decoration: none; transition: color 0.2s;">office@thejre.org</a>
                        <span style="color: #e5e7eb; margin: 0 8px;">·</span>
                        <a href="tel:914-713-4355" style="color: #9ca3af; text-decoration: none; transition: color 0.2s;">914-713-4355</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending registration email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: result?.id };
  } catch (error) {
    console.error("Failed to send registration email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendHonoreeNotification(data: HonoreeEmailData) {
  const resend = getResendClient();
  if (!resend) {
    console.log("Resend API key not configured, skipping email");
    return { success: false, error: "Email not configured" };
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: data.to,
      subject: `A donation was made in your honor`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You've Been Honored</title>
        </head>
        <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #1a202c 100%); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

                  <!-- Logo Section -->
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="background: linear-gradient(135deg, #EF8046, #f59e0b); padding: 15px 30px; border-radius: 50px;">
                            <span style="color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: 2px;">THE JRE</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Main Card -->
                  <tr>
                    <td>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">

                        <!-- Header Banner -->
                        <tr>
                          <td style="background: linear-gradient(135deg, #EF8046 0%, #f59e0b 100%); padding: 50px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">You've Been Honored!</h1>
                          </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                          <td style="padding: 40px 30px;">
                            <p style="color: #2d3748; font-size: 18px; margin: 0 0 25px; line-height: 1.6;">Dear <strong>${data.honoreeName}</strong>,</p>
                            <p style="color: #4a5568; font-size: 16px; margin: 0 0 30px; line-height: 1.8;">We're delighted to share some wonderful news with you!</p>

                            <!-- Donor Highlight -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                              <tr>
                                <td align="center">
                                  <table role="presentation" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 16px; padding: 30px 40px; border: 2px solid #EF8046; width: 100%;">
                                    <tr>
                                      <td align="center">
                                        <div style="color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">A Special Gift From</div>
                                        <div style="color: #EF8046; font-size: 28px; font-weight: 700;">${data.donorName}</div>
                                        <div style="color: #92400e; font-size: 14px; margin-top: 10px;">has made a donation in your honor</div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            ${data.message ? `
                            <!-- Personal Message -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                              <tr>
                                <td style="background: linear-gradient(135deg, #f7fafc, #edf2f7); border-radius: 16px; padding: 30px; border-left: 4px solid #EF8046;">
                                  <div style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">Personal Message</div>
                                  <p style="color: #2d3748; font-size: 18px; font-style: italic; margin: 0; line-height: 1.8;">"${data.message}"</p>
                                </td>
                              </tr>
                            </table>
                            ` : ""}

                            <p style="color: #4a5568; font-size: 16px; margin: 30px 0; line-height: 1.8;">This generous gift will help us continue providing meaningful Jewish experiences for the Westchester community. You are clearly cherished by those who know you!</p>

                            <p style="color: #4a5568; font-size: 16px; margin: 30px 0 0; line-height: 1.6;">With warm regards,<br><strong style="color: #EF8046;">The JRE Team</strong></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 40px 20px; text-align: center;">
                      <p style="color: #a0aec0; font-size: 16px; font-weight: 600; margin: 0 0 5px;">Jewish Renaissance Experience</p>
                      <p style="color: #718096; font-size: 14px; margin: 0 0 15px;">Igniting Jewish life in Westchester</p>
                      <p style="color: #718096; font-size: 13px; margin: 0;">1495 Weaver Street, Scarsdale, NY 10583</p>
                      <p style="color: #718096; font-size: 13px; margin: 5px 0 0;">
                        <a href="mailto:office@thejre.org" style="color: #EF8046; text-decoration: none;">office@thejre.org</a> &nbsp;|&nbsp;
                        <a href="tel:914-713-4355" style="color: #EF8046; text-decoration: none;">914-713-4355</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending honoree email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: result?.id };
  } catch (error) {
    console.error("Failed to send honoree email:", error);
    return { success: false, error: "Failed to send email" };
  }
}

interface PaymentFailureAlertData {
  campaignTitle: string;
  campaignSlug: string;
  amount: number;
  paymentMethod: string;
  errorMessage: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string | null;
  dedicationType?: string | null;
  dedicationName?: string | null;
  tierId?: string | null;
  teamId?: string | null;
}

export async function sendPaymentFailureAlert(data: PaymentFailureAlertData) {
  const resend = getResendClient();
  if (!resend) {
    console.log("Resend API key not configured, skipping failure alert");
    return { success: false, error: "Email not configured" };
  }

  const primary =
    process.env.PAYMENT_FAILURE_ALERT_EMAIL ||
    process.env.ADMIN_ALERT_EMAIL ||
    "office@thejre.org";
  const to = Array.from(new Set([primary, "cgelber@thejre.org"]));

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const dedicationLine =
    data.dedicationType && data.dedicationName
      ? `${data.dedicationType}: ${data.dedicationName}`
      : null;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      replyTo: data.donorEmail,
      subject: `[JRE ALERT] Payment failed — $${data.amount.toFixed(2)} from ${data.donorName} (${data.campaignTitle})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Failure Alert</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding: 32px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

                  <tr>
                    <td style="background: #991b1b; padding: 24px 28px; border-radius: 12px 12px 0 0;">
                      <div style="color: #fecaca; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">JRE Payment Alert</div>
                      <h1 style="color: #ffffff; margin: 8px 0 0; font-size: 22px; font-weight: 700;">Payment failed — $${data.amount.toFixed(2)}</h1>
                      <p style="color: #fecaca; font-size: 14px; margin: 6px 0 0;">${data.campaignTitle}</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="background: #ffffff; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626; margin: 0 0 24px;">
                        <tr>
                          <td style="padding: 16px 20px;">
                            <div style="color: #991b1b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px;">Gateway error</div>
                            <div style="color: #7f1d1d; font-size: 14px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; word-break: break-word;">${data.errorMessage}</div>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Donor</td>
                          <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${data.donorName}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Email</td>
                          <td align="right" style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${data.donorEmail}" style="color: #EF8046; font-size: 14px; font-weight: 500; text-decoration: none;">${data.donorEmail}</a></td>
                        </tr>
                        ${data.donorPhone ? `
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Phone</td>
                          <td align="right" style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;"><a href="tel:${data.donorPhone}" style="color: #1a1a1a; font-size: 14px; font-weight: 500; text-decoration: none;">${data.donorPhone}</a></td>
                        </tr>
                        ` : ""}
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Amount</td>
                          <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">$${data.amount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Method</td>
                          <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${data.paymentMethod}</td>
                        </tr>
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Campaign</td>
                          <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${data.campaignSlug}</td>
                        </tr>
                        ${dedicationLine ? `
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Dedication</td>
                          <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${dedicationLine}</td>
                        </tr>
                        ` : ""}
                        ${data.tierId ? `
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Tier</td>
                          <td align="right" style="color: #1a1a1a; font-size: 12px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${data.tierId}</td>
                        </tr>
                        ` : ""}
                        ${data.teamId ? `
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Team</td>
                          <td align="right" style="color: #1a1a1a; font-size: 12px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${data.teamId}</td>
                        </tr>
                        ` : ""}
                        <tr>
                          <td style="color: #6b7280; font-size: 13px; padding: 8px 0;">Time</td>
                          <td align="right" style="color: #1a1a1a; font-size: 14px; font-weight: 500; padding: 8px 0;">${timestamp} ET</td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
                        <tr>
                          <td align="center">
                            <a href="mailto:${data.donorEmail}?subject=${encodeURIComponent("About your donation to The JRE")}" style="display: inline-block; background: #EF8046; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Reach out to ${data.donorName.split(" ")[0]}</a>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; line-height: 1.6; text-align: center;">A record with <code style="background: #f3f4f6; padding: 1px 6px; border-radius: 3px; font-size: 11px;">payment_status: "failed"</code> was saved to <code style="background: #f3f4f6; padding: 1px 6px; border-radius: 3px; font-size: 11px;">campaign_donations</code> for reconciliation.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending payment failure alert:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to send payment failure alert:", err);
    return { success: false, error: "Failed to send alert" };
  }
}

interface DonationSaveFailedAlertData {
  campaignTitle: string;
  campaignSlug: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string | null;
  cardRef: string | null;
  dbError: string;
  chargedSuccessfully: boolean;
  donorName: string;
  donorEmail: string;
  donorPhone?: string | null;
  dedicationType?: string | null;
  dedicationName?: string | null;
  tierId?: string | null;
  teamId?: string | null;
}

// Fires when payment processing succeeded but the DB insert failed afterward.
// The donor sees a generic error; the operator must reconcile manually using
// the gateway transaction reference. Distinct from sendPaymentFailureAlert,
// which fires when the gateway itself declines (no money moved).
export async function sendDonationSaveFailedAlert(data: DonationSaveFailedAlertData) {
  const resend = getResendClient();
  if (!resend) {
    console.log("Resend API key not configured, skipping save-failed alert");
    return { success: false, error: "Email not configured" };
  }

  const primary =
    process.env.PAYMENT_FAILURE_ALERT_EMAIL ||
    process.env.ADMIN_ALERT_EMAIL ||
    "office@thejre.org";
  const to = Array.from(new Set([primary, "cgelber@thejre.org"]));

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const dedicationLine =
    data.dedicationType && data.dedicationName
      ? `${data.dedicationType}: ${data.dedicationName}`
      : null;

  const subjectPrefix = data.chargedSuccessfully
    ? "[JRE URGENT] CHARGE SUCCEEDED but DB save FAILED"
    : "[JRE ALERT] Pledge save failed (no charge)";
  const headerColor = data.chargedSuccessfully ? "#7f1d1d" : "#9a3412";
  const accentColor = data.chargedSuccessfully ? "#dc2626" : "#ea580c";
  const bannerText = data.chargedSuccessfully
    ? "Money moved at the gateway. No row exists in campaign_donations. Manual reconciliation required."
    : "Pledge attempt failed to save. No money moved. Reach out to confirm intent.";

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      replyTo: data.donorEmail,
      subject: `${subjectPrefix} — $${data.amount.toFixed(2)} from ${data.donorName} (${data.campaignTitle})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Donation Save Failed</title></head>
        <body style="margin:0;padding:0;background:#f7fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center" style="padding:32px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
                <tr><td style="background:${headerColor};padding:24px 28px;border-radius:12px 12px 0 0;">
                  <div style="color:#fecaca;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Reconciliation Required</div>
                  <h1 style="color:#fff;margin:8px 0 0;font-size:22px;font-weight:700;">${data.chargedSuccessfully ? "Charge succeeded — DB save failed" : "Pledge save failed"}</h1>
                  <p style="color:#fecaca;font-size:14px;margin:6px 0 0;">$${data.amount.toFixed(2)} · ${data.campaignTitle}</p>
                </td></tr>
                <tr><td style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;">

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fef2f2;border-radius:8px;border-left:4px solid ${accentColor};margin:0 0 24px;">
                    <tr><td style="padding:16px 20px;">
                      <div style="color:${headerColor};font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">What happened</div>
                      <div style="color:#7f1d1d;font-size:13px;line-height:1.5;">${bannerText}</div>
                    </td></tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1f2937;border-radius:8px;margin:0 0 24px;">
                    <tr><td style="padding:16px 20px;">
                      <div style="color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Gateway reference (use this to reconcile)</div>
                      <div style="color:#f9fafb;font-size:14px;font-family:ui-monospace,'SF Mono',Menlo,monospace;word-break:break-all;">${data.paymentReference ?? "(none — gateway returned no reference)"}</div>
                      ${data.cardRef ? `<div style="color:#9ca3af;font-size:11px;margin-top:8px;">card_ref: <span style="color:#f9fafb;font-family:ui-monospace,monospace;">${data.cardRef}</span></div>` : ""}
                    </td></tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fef3c7;border-radius:8px;border-left:4px solid #d97706;margin:0 0 24px;">
                    <tr><td style="padding:16px 20px;">
                      <div style="color:#78350f;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px;">Postgres error</div>
                      <div style="color:#78350f;font-size:13px;font-family:ui-monospace,'SF Mono',Menlo,monospace;word-break:break-word;">${data.dbError}</div>
                    </td></tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Donor</td><td align="right" style="color:#1a1a1a;font-size:14px;font-weight:500;padding:8px 0;border-bottom:1px solid #f0f0f0;">${data.donorName}</td></tr>
                    <tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Email</td><td align="right" style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><a href="mailto:${data.donorEmail}" style="color:#EF8046;font-size:14px;font-weight:500;text-decoration:none;">${data.donorEmail}</a></td></tr>
                    ${data.donorPhone ? `<tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Phone</td><td align="right" style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><a href="tel:${data.donorPhone}" style="color:#1a1a1a;font-size:14px;font-weight:500;text-decoration:none;">${data.donorPhone}</a></td></tr>` : ""}
                    <tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Amount</td><td align="right" style="color:#1a1a1a;font-size:14px;font-weight:500;padding:8px 0;border-bottom:1px solid #f0f0f0;">$${data.amount.toFixed(2)}</td></tr>
                    <tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Method</td><td align="right" style="color:#1a1a1a;font-size:14px;font-weight:500;padding:8px 0;border-bottom:1px solid #f0f0f0;">${data.paymentMethod}</td></tr>
                    <tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Campaign</td><td align="right" style="color:#1a1a1a;font-size:14px;font-weight:500;padding:8px 0;border-bottom:1px solid #f0f0f0;">${data.campaignSlug}</td></tr>
                    ${dedicationLine ? `<tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Dedication</td><td align="right" style="color:#1a1a1a;font-size:14px;font-weight:500;padding:8px 0;border-bottom:1px solid #f0f0f0;">${dedicationLine}</td></tr>` : ""}
                    ${data.tierId ? `<tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Tier</td><td align="right" style="color:#1a1a1a;font-size:12px;font-family:ui-monospace,'SF Mono',Menlo,monospace;padding:8px 0;border-bottom:1px solid #f0f0f0;">${data.tierId}</td></tr>` : ""}
                    ${data.teamId ? `<tr><td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #f0f0f0;">Team</td><td align="right" style="color:#1a1a1a;font-size:12px;font-family:ui-monospace,'SF Mono',Menlo,monospace;padding:8px 0;border-bottom:1px solid #f0f0f0;">${data.teamId}</td></tr>` : ""}
                    <tr><td style="color:#6b7280;font-size:13px;padding:8px 0;">Time</td><td align="right" style="color:#1a1a1a;font-size:14px;font-weight:500;padding:8px 0;">${timestamp} ET</td></tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                    <tr><td align="center">
                      <a href="mailto:${data.donorEmail}?subject=${encodeURIComponent("Confirming your donation to The JRE")}" style="display:inline-block;background:#EF8046;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Reach out to ${data.donorName.split(" ")[0]}</a>
                    </td></tr>
                  </table>

                  ${data.chargedSuccessfully ? `
                  <p style="color:#374151;font-size:12px;margin:24px 0 0;line-height:1.6;">
                    <strong>Next steps:</strong> 1) Confirm the charge in the gateway dashboard using the reference above. 2) Insert a row into <code style="background:#f3f4f6;padding:1px 6px;border-radius:3px;">campaign_donations</code> with <code style="background:#f3f4f6;padding:1px 6px;border-radius:3px;">payment_status: 'completed'</code> and the gateway reference. 3) Send the donor a manual receipt.
                  </p>` : `
                  <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;line-height:1.6;">No money moved. The donor saw a generic error; reach out to confirm whether they want to retry.</p>`}
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
      `,
    });
    if (error) {
      console.error("Error sending donation-save-failed alert:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to send donation-save-failed alert:", err);
    return { success: false, error: "Failed to send alert" };
  }
}

export async function sendContactFormNotification(data: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    console.log("Resend API key not configured, skipping email");
    return { success: false, error: "Email not configured" };
  }

  try {
    // Send to office@thejre.org
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: "office@thejre.org",
      replyTo: data.email,
      subject: `Contact Form: ${data.subject || "New Message"} from ${data.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Form Submission</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f7fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #2d3748, #1a202c); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                        <tr>
                          <td style="background: linear-gradient(135deg, #EF8046, #f59e0b); padding: 10px 20px; border-radius: 30px; margin-bottom: 15px;">
                            <span style="color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 1px;">THE JRE</span>
                          </td>
                        </tr>
                      </table>
                      <h1 style="color: #ffffff; margin: 20px 0 0; font-size: 22px; font-weight: 600;">New Contact Form Submission</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">

                      <!-- Quick Info Bar -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 12px; margin-bottom: 25px;">
                        <tr>
                          <td style="padding: 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td>
                                  <div style="color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">From</div>
                                  <div style="color: #2d3748; font-size: 18px; font-weight: 700;">${data.name}</div>
                                </td>
                                <td align="right">
                                  <div style="color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</div>
                                  <div style="color: #2d3748; font-size: 14px; font-weight: 600;">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Contact Details -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                        <tr>
                          <td style="padding: 15px; background: #f7fafc; border-radius: 8px; margin-bottom: 10px;">
                            <div style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Email</div>
                            <a href="mailto:${data.email}" style="color: #EF8046; font-size: 16px; text-decoration: none; font-weight: 600;">${data.email}</a>
                          </td>
                        </tr>
                        ${data.phone ? `
                        <tr>
                          <td style="padding: 15px; background: #f7fafc; border-radius: 8px; margin-top: 10px;">
                            <div style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Phone</div>
                            <a href="tel:${data.phone}" style="color: #2d3748; font-size: 16px; text-decoration: none; font-weight: 600;">${data.phone}</a>
                          </td>
                        </tr>
                        ` : ""}
                        ${data.subject ? `
                        <tr>
                          <td style="padding: 15px; background: #f7fafc; border-radius: 8px; margin-top: 10px;">
                            <div style="color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Subject</div>
                            <div style="color: #2d3748; font-size: 16px; font-weight: 600;">${data.subject}</div>
                          </td>
                        </tr>
                        ` : ""}
                      </table>

                      <!-- Message -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding: 20px; background: #2d3748; border-radius: 12px;">
                            <div style="color: #a0aec0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">Message</div>
                            <p style="color: #ffffff; font-size: 16px; line-height: 1.8; margin: 0;">${data.message.replace(/\n/g, "<br>")}</p>
                          </td>
                        </tr>
                      </table>

                      <!-- Reply Button -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 25px;">
                        <tr>
                          <td align="center">
                            <a href="mailto:${data.email}" style="display: inline-block; background: linear-gradient(135deg, #EF8046, #f59e0b); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reply to ${data.name}</a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 20px; text-align: center;">
                      <p style="color: #718096; font-size: 13px; margin: 0;">This message was sent from the JRE website contact form.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Error sending contact notification:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send contact notification:", error);
    return { success: false, error: "Failed to send email" };
  }
}
