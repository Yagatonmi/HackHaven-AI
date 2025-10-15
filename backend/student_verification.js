const express = require('express');
const multer = require('multer'); // for file uploads
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');
const nodemailer = require('nodemailer');
const router = express.Router();

// --- CONFIGURATION ---

// Correctly configure multer to save to the secure, git-ignored 'uploads' directory
const upload = multer({
  dest: path.join(__dirname, 'uploads/'), // Corrected: Save to backend/uploads/
  limits: { fileSize: 2 * 1024 * 1024 }, // max 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// Simple in-memory DB for demo (replace with real DB)
let pendingStudents = []; // {id, email, filePath, status}

// Configure email transporter (using a mock for this example)
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

// 1) Student submits verification
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
    status: 'pending'
  };
  pendingStudents.push(student);

  res.json({ message: 'Verification submitted. Await admin approval.', studentId: student.id });
});

// 2) Admin dashboard view pending students
router.get('/admin/pending-students', (req, res) => {
  res.json(pendingStudents.filter(s => s.status === 'pending'));
});

// 3) Admin approves/rejects
router.post('/admin/verify-student', async (req, res) => {
  const { studentId, action } = req.body; // action: 'approve' or 'reject'
  const student = pendingStudents.find(s => s.id == studentId);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  if (action === 'approve') {
    student.status = 'approved';

    // Corrected Logic: Generate a Stripe Checkout link instead of creating a subscription directly.
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: process.env.STRIPE_STUDENT_PRICE_ID || 'price_student_placeholder', quantity: 1 }],
        mode: 'subscription',
        customer_email: student.email,
        success_url: 'https://example.com/success?student_approved=true',
        cancel_url: 'https://example.com/cancel',
      });

      // Send approval email with the checkout link
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

    // Send rejection email
    await transporter.sendMail({
      from: 'no-reply@hackhaven.com',
      to: student.email,
      subject: 'HackHaven Student Plan Rejected',
      text: 'Your student verification was rejected. You can still subscribe to the standard $3/month plan.'
    });

    // Remove uploaded file if exists
    if (student.filePath && fs.existsSync(student.filePath)) fs.unlinkSync(student.filePath);

    res.json({ message: 'Student rejected and notified.' });
  }
});

module.exports = router;
