const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // Built-in Node.js module for cryptography
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');
const router = express.Router();

// --- CONFIGURATION ---

const upload = multer({
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// In-memory stores for demo purposes
let pendingStudents = [];
let verificationTokens = new Map(); // Store tokens with expiration

const transporter = {
  sendMail: (options) => {
    console.log('--- Email Simulation ---');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Text: ${options.text}`);
    console.log('------------------------');
    return Promise.resolve();
  }
};

// --- ROUTES ---

// 1.3) New Endpoint: Student requests a verification link
router.post('/verify-email', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    // Find the student record to ensure the email is valid
    const student = pendingStudents.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!student) {
        return res.status(404).json({ error: 'No student record found for this email.' });
    }

    // Generate a secure, single-use token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000; // Token expires in 15 minutes
    verificationTokens.set(token, { email, expires });

    // Send the verification email
    try {
        const verificationLink = `http://localhost:3000/student_status.html?token=${token}`;
        await transporter.sendMail({
            from: 'no-reply@hackhaven.com',
            to: email,
            subject: 'Your HackHaven Status Link',
            text: `Please use the following link to securely view your verification status. This link is valid for 15 minutes.\n\n${verificationLink}`
        });
        res.status(200).json({ message: 'A verification link has been sent to your email.' });
    } catch (error) {
        console.error('Email sending failed:', error);
        res.status(500).json({ error: 'Failed to send verification email.' });
    }
});

// 1.2) Updated Endpoint: Student status lookup using a token
router.get('/status', (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Verification token is required.' });
    }

    const tokenData = verificationTokens.get(token);

    // Validate the token: check if it exists and has not expired
    if (!tokenData || Date.now() > tokenData.expires) {
        verificationTokens.delete(token); // Clean up expired/invalid token
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // Find the student record using the email from the valid token
    const student = pendingStudents.find(s => s.email.toLowerCase() === tokenData.email.toLowerCase());

    if (!student) {
        return res.status(404).json({ error: 'No verification status found.' });
    }

    // Invalidate the token after its first use to make it single-use
    verificationTokens.delete(token);

    res.json({
        email: student.email,
        status: student.status,
        submittedAt: student.submittedAt,
        approvedAt: student.approvedAt || null,
        stripeUrl: student.stripeUrl || null
    });
});

// Original routes for submission and admin actions remain the same...
router.post('/submit-student-verification', upload.single('studentFile'), (req, res) => {
  const email = req.body.email;
  const eduEmail = req.body.eduEmail || null;

  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!req.file && !eduEmail) {
    return res.status(400).json({ error: 'Provide a student ID upload or edu email' });
  }

  const student = {
    id: Date.now(),
    email,
    filePath: req.file ? req.file.path : null,
    eduEmail: eduEmail,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };
  pendingStudents.push(student);

  res.json({ message: 'Verification submitted. Await admin approval.', studentId: student.id });
});

router.get('/admin/pending-students', (req, res) => {
  res.json(pendingStudents.filter(s => s.status === 'pending'));
});

router.post('/admin/verify-student', async (req, res) => {
  const { studentId, action } = req.body;
  const student = pendingStudents.find(s => s.id == studentId);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  if (action === 'approve') {
    student.status = 'approved';
    student.approvedAt = new Date().toISOString();

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: process.env.STRIPE_STUDENT_PRICE_ID || 'price_student_placeholder', quantity: 1 }],
        mode: 'subscription',
        customer_email: student.email,
        success_url: 'https://example.com/success?student_approved=true',
        cancel_url: 'https://example.com/cancel',
      });

      student.stripeUrl = session.url;

      await transporter.sendMail({
        from: 'no-reply@hackhaven.com',
        to: student.email,
        subject: 'HackHaven Student Plan Approved',
        text: `Congratulations! Your student verification is approved. Please use the following link to complete your subscription for $1/month: ${session.url}`
      });

      res.json({ message: 'Student approved. Checkout link sent.', checkoutUrl: session.url });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Stripe session creation failed.' });
    }
  } else if (action === 'reject') {
    student.status = 'rejected';

    await transporter.sendMail({
      from: 'no-reply@hackhaven.com',
      to: student.email,
      subject: 'HackHaven Student Plan Rejected',
      text: 'Your student verification was rejected. You can still subscribe to the standard $3/month plan.'
    });

    if (student.filePath && fs.existsSync(student.filePath)) fs.unlinkSync(student.filePath);

    res.json({ message: 'Student rejected and notified.' });
  }
});

module.exports = router;
