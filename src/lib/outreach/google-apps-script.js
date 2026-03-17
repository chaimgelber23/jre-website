/**
 * JRE Outreach Log — Google Apps Script
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to script.google.com (signed in as cgelber@thejre.org)
 * 2. Create a new project named "JRE Outreach Email Forwarder"
 * 3. Paste this entire file as Code.gs
 * 4. Set the constants below (WEBHOOK_URL, SECRET)
 * 5. Run setupTrigger() once to create the recurring trigger
 * 6. Authorize when prompted
 *
 * HOW IT WORKS:
 * - Runs every 5 minutes
 * - Checks for unread emails sent TO log@thejre.org (or labeled "outreach-log")
 * - POSTs each email to your Next.js webhook
 * - Marks the email as read so it won't be processed again
 */

// ============ CONFIGURE THESE ============
const WEBHOOK_URL = "https://thejre.org/api/inbound-email";  // your production URL
const SECRET      = "REPLACE_WITH_YOUR_INBOUND_EMAIL_SECRET"; // match .env INBOUND_EMAIL_SECRET
const LABEL_NAME  = "outreach-log"; // Gmail label to watch (create this label in Gmail)
// =========================================

function checkForNewEmails() {
  const label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    Logger.log("Label not found: " + LABEL_NAME + ". Create it in Gmail first.");
    return;
  }

  const threads = label.getThreads(0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      if (message.isUnread()) {
        const from    = message.getFrom();
        const subject = message.getSubject();
        const body    = message.getPlainBody();
        const msgId   = message.getId();

        // POST to webhook
        const payload = JSON.stringify({ from, subject, body, messageId: msgId });
        const options = {
          method: "post",
          contentType: "application/json",
          payload,
          headers: { "x-inbound-secret": SECRET },
          muteHttpExceptions: true,
        };

        try {
          const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
          Logger.log("Processed email from " + from + " — status: " + response.getResponseCode());
        } catch (e) {
          Logger.log("Error posting to webhook: " + e);
        }

        // Mark as read so we don't process it again
        message.markRead();
      }
    }
  }
}

/**
 * Run this function ONCE manually to set up the recurring trigger.
 * After running, it will execute checkForNewEmails every 5 minutes automatically.
 */
function setupTrigger() {
  // Remove existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "checkForNewEmails") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new 5-minute trigger
  ScriptApp.newTrigger("checkForNewEmails")
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("Trigger set up successfully — checkForNewEmails will run every 5 minutes.");
}

/**
 * GMAIL SETUP REMINDER:
 *
 * 1. Create a label called "outreach-log" in Gmail
 * 2. Create a filter: To: log@thejre.org → Apply label "outreach-log"
 *    (OR if log@thejre.org forwards to cgelber@thejre.org, just filter by To address)
 * 3. Run setupTrigger() once from the Apps Script editor
 *
 * TESTING:
 * - Send a test email to log@thejre.org from your team email
 * - Run checkForNewEmails() manually from the editor
 * - Check the Logs to see if it processed correctly
 */
