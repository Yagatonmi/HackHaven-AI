const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  jsonTransport: true, // swap with SMTP config for production
});

async function sendEmail(options) {
  // Wrap in Promise to ensure non-blocking, log errors separately
  transporter.sendMail(options)
    .then(result => {
      console.log('--- Email sent (async) ---');
      console.log(result.message);
    })
    .catch(err => {
      console.error('Email sending failed:', err);
      // Optionally store failed emails in a DB for retry
    });
}

module.exports = sendEmail;
