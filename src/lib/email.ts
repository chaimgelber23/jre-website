import { Resend } from "resend";

const FROM_EMAIL = "The JRE <onboarding@resend.dev>"; // TODO: Change back to noreply@thejre.org once domain is verified in Resend

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
  adults: number;
  kids: number;
  total: number;
  sponsorship?: string;
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
                      <img src="https://jre-website.vercel.app/images/logo.png" alt="The JRE" width="140" style="display: block; margin: 0 auto; max-width: 140px; height: auto;" />
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
                      <img src="https://jre-website.vercel.app/images/logo.png" alt="The JRE" width="140" style="display: block; margin: 0 auto; max-width: 140px; height: auto;" />
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

                            <!-- Event Title -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 32px;">
                              <tr>
                                <td style="padding: 24px; background: #fafafa; border-left: 4px solid #EF8046; border-radius: 8px;">
                                  <h2 style="color: #1a1a1a; font-size: 22px; font-weight: 600; margin: 0; line-height: 1.3;">${data.eventTitle}</h2>
                                </td>
                              </tr>
                            </table>

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

                            <p style="color: #6b7280; font-size: 14px; margin: 0 0 32px; line-height: 1.6;">If you have any questions, feel free to reach out. We look forward to seeing you!</p>

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
