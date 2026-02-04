import { Resend } from "resend";

const FROM_EMAIL = "The JRE <noreply@thejre.org>"; // Will use Resend's domain until you verify thejre.org

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
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Thank You for Your Generosity!</h1>
                          </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                          <td style="padding: 40px 30px;">
                            <p style="color: #2d3748; font-size: 18px; margin: 0 0 20px; line-height: 1.6;">Dear <strong>${data.name}</strong>,</p>
                            <p style="color: #4a5568; font-size: 16px; margin: 0 0 30px; line-height: 1.8;">Thank you for your ${data.isRecurring ? "monthly " : ""}donation to The JRE. Your generous support helps us continue providing meaningful Jewish experiences for the Westchester community.</p>

                            <!-- Amount Display -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                              <tr>
                                <td align="center">
                                  <table role="presentation" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 16px; padding: 30px 50px; border: 2px solid #EF8046;">
                                    <tr>
                                      <td align="center">
                                        <div style="color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Your ${data.isRecurring ? "Monthly " : ""}Donation</div>
                                        <div style="color: #EF8046; font-size: 48px; font-weight: 800;">$${data.amount.toFixed(2)}</div>
                                        ${data.isRecurring ? '<div style="color: #92400e; font-size: 14px; margin-top: 5px;">per month</div>' : ""}
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <!-- Details Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f7fafc; border-radius: 12px; margin: 30px 0;">
                              <tr>
                                <td style="padding: 25px;">
                                  <h3 style="color: #2d3748; font-size: 16px; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Donation Details</h3>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Amount</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">$${data.amount.toFixed(2)}</td>
                                    </tr>
                                    ${data.isRecurring ? `
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Frequency</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Monthly</td>
                                    </tr>
                                    ` : ""}
                                    ${data.sponsorship ? `
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Sponsorship</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${data.sponsorship}</td>
                                    </tr>
                                    ` : ""}
                                    ${data.transactionId ? `
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Transaction ID</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${data.transactionId}</td>
                                    </tr>
                                    ` : ""}
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0;">Date</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <!-- Tax Notice -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #ebf8ff, #e0f2fe); border-radius: 12px; border-left: 4px solid #3182ce; margin: 30px 0;">
                              <tr>
                                <td style="padding: 20px;">
                                  <p style="color: #2c5282; font-size: 14px; margin: 0; line-height: 1.6;">
                                    <strong>Tax-Deductible:</strong> Your donation is tax-deductible. The JRE is a registered 501(c)(3) nonprofit organization. Please save this email for your records.
                                  </p>
                                </td>
                              </tr>
                            </table>

                            <p style="color: #4a5568; font-size: 16px; margin: 30px 0 0; line-height: 1.6;">With heartfelt gratitude,<br><strong style="color: #EF8046;">The JRE Team</strong></p>
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
                          <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 50px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">You're Registered!</h1>
                          </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                          <td style="padding: 40px 30px;">
                            <p style="color: #2d3748; font-size: 18px; margin: 0 0 20px; line-height: 1.6;">Dear <strong>${data.name}</strong>,</p>
                            <p style="color: #4a5568; font-size: 16px; margin: 0 0 30px; line-height: 1.8;">Great news! You're registered for our upcoming event. We can't wait to see you there!</p>

                            <!-- Event Title -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                              <tr>
                                <td align="center">
                                  <table role="presentation" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #2d3748, #1a202c); border-radius: 16px; padding: 25px 40px; width: 100%;">
                                    <tr>
                                      <td align="center">
                                        <div style="color: #EF8046; font-size: 24px; font-weight: 700;">${data.eventTitle}</div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <!-- Event Details -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #fef3c7, #fff7ed); border-radius: 16px; margin: 30px 0;">
                              <tr>
                                <td style="padding: 25px;">
                                  <h3 style="color: #92400e; font-size: 14px; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 2px;">Event Details</h3>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #fcd9b6;">Date</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 10px 0; border-bottom: 1px solid #fcd9b6;">${data.eventDate}</td>
                                    </tr>
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #fcd9b6;">Time</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 10px 0; border-bottom: 1px solid #fcd9b6;">${data.eventTime}</td>
                                    </tr>
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 10px 0;">Location</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 10px 0;">${data.eventLocation}</td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <!-- Registration Details -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f7fafc; border-radius: 12px; margin: 30px 0;">
                              <tr>
                                <td style="padding: 25px;">
                                  <h3 style="color: #2d3748; font-size: 14px; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Your Registration</h3>
                                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Adults</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${data.adults}</td>
                                    </tr>
                                    ${data.kids > 0 ? `
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Children</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${data.kids}</td>
                                    </tr>
                                    ` : ""}
                                    ${data.sponsorship ? `
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Sponsorship</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${data.sponsorship}</td>
                                    </tr>
                                    ` : ""}
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">Total</td>
                                      <td align="right" style="color: #EF8046; font-size: 18px; font-weight: 700; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">$${data.total.toFixed(2)}</td>
                                    </tr>
                                    ${data.transactionId ? `
                                    <tr>
                                      <td style="color: #718096; font-size: 14px; padding: 8px 0;">Confirmation #</td>
                                      <td align="right" style="color: #2d3748; font-size: 14px; font-weight: 600; padding: 8px 0;">${data.transactionId}</td>
                                    </tr>
                                    ` : ""}
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <p style="color: #4a5568; font-size: 16px; margin: 30px 0 0; line-height: 1.6;">If you have any questions, please don't hesitate to reach out.</p>
                            <p style="color: #4a5568; font-size: 16px; margin: 20px 0 0; line-height: 1.6;">See you soon!<br><strong style="color: #EF8046;">The JRE Team</strong></p>
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
