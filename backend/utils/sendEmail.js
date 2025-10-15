const nodemailer = require('nodemailer');

// --- Transporter Configuration ---
// Use a real SMTP transporter for production, but fall back to the verifiable
// jsonTransport for testing environments.
let transporter;
if (process.env.NODE_ENV === 'test') {
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });
} else {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: (process.env.SMTP_PORT == 465), // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends an email with retry logic.
 * @param {object} options - Nodemailer mail options (to, subject, html, etc.).
 * @param {number} retries - The number of times to retry on failure.
 */
async function sendEmailWithRetry(options, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      const result = await transporter.sendMail(options);
      console.log(`--- Email sent successfully (Attempt ${i}) ---`);
      // For jsonTransport, the 'message' is the JSON object. For SMTP, it's a messageId.
      console.log("Message data:", result.message || result.messageId);
      return; // Success, exit the loop
    } catch (error) {
      console.error(`Email sending attempt ${i} failed:`, error);
      if (i === retries) {
        // If this was the last attempt, log a permanent failure
        console.error('All email sending attempts failed. Giving up.');
        // In a real app, you might add this to a dead-letter queue.
        break;
      }
      // Wait for a short period before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * i)); // Wait 1s, then 2s, etc.
    }
  }
}

// The exported function remains simple. The retry logic is handled internally.
// This remains a "fire-and-forget" function from the perspective of the caller.
function sendEmail(options) {
    sendEmailWithRetry(options).catch(err => {
        // This catch is a safeguard, though errors are handled inside.
        console.error("An unexpected error occurred in the email sending process:", err);
    });
}

module.exports = sendEmail;
