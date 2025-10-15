const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');
const sendEmail = require('./utils/sendEmail');
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

let pendingStudents = [];
let verificationTokens = new Map();
const activeConnections = new Map();

// --- SSE Helper Function ---
function sendStatusUpdate(email, data) {
    const res = activeConnections.get(email.toLowerCase());
    if (res) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

// --- ROUTES ---

router.get('/status/updates', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    const tokenData = verificationTokens.get(token);
    if (!tokenData || Date.now() > tokenData.expires) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const email = tokenData.email.toLowerCase();
    activeConnections.set(email, res);

    const keepAliveInterval = setInterval(() => res.write(': keep-alive\n\n'), 15000);

    req.on('close', () => {
        activeConnections.delete(email);
        clearInterval(keepAliveInterval);
    });
});

router.post('/verify-email', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const student = pendingStudents.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!student) return res.status(404).json({ error: 'No student record found for this email.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000;
    verificationTokens.set(token, { email, expires });

    const verificationLink = `http://localhost:3000/student_status.html?token=${token}`;
    sendEmail({
        from: 'no-reply@hackhaven.com', to: email,
        subject: 'Your HackHaven Status Link',
        text: `Please use the following link to securely view your verification status. This link is valid for 15 minutes.\n\n${verificationLink}`
    });
    res.status(200).json({ message: 'A verification link has been sent to your email.' });
});

router.get('/status', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    const tokenData = verificationTokens.get(token);
    if (!tokenData || Date.now() > tokenData.expires) {
        verificationTokens.delete(token);
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    const student = pendingStudents.find(s => s.email.toLowerCase() === tokenData.email.toLowerCase());
    if (!student) return res.status(404).json({ error: 'No verification status found.' });

    res.json({
        email: student.email, status: student.status, submittedAt: student.submittedAt,
        approvedAt: student.approvedAt || null, stripeUrl: student.stripeUrl || null
    });
});

router.post('/submit-student-verification', upload.single('studentFile'), (req, res) => {
  const email = req.body.email;
  const eduEmail = req.body.eduEmail || null;

  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!req.file && !eduEmail) return res.status(400).json({ error: 'Provide a student ID upload or edu email' });

  const student = {
    id: Date.now(), email, filePath: req.file ? req.file.path : null,
    eduEmail: eduEmail, status: 'pending', submittedAt: new Date().toISOString()
  };
  pendingStudents.push(student);

  res.json({ message: 'Verification submitted. Await admin approval.', studentId: student.id });
});

router.get('/admin/students', (req, res) => {
  const { status, search, page = 1, limit = 20, sortBy, sortOrder = 'asc' } = req.query;

  let results = [...pendingStudents];

  if (status && status !== 'all') {
    results = results.filter(s => s.status === status);
  }

  if (search) {
    const searchTerm = search.toLowerCase();
    results = results.filter(s =>
      s.email.toLowerCase().includes(searchTerm) ||
      (s.eduEmail && s.eduEmail.toLowerCase().includes(searchTerm))
    );
  }

  if (sortBy) {
      results.sort((a, b) => {
          const valA = a[sortBy] ? a[sortBy].toLowerCase() : '';
          const valB = b[sortBy] ? b[sortBy].toLowerCase() : '';

          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      });
  }

  const totalCount = results.length;
  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = parseInt(page, 10);
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + parseInt(limit, 10);
  const paginatedStudents = results.slice(startIndex, endIndex);

  res.json({
    students: paginatedStudents,
    totalCount,
    totalPages,
    currentPage,
  });
});

router.post('/admin/verify-student', async (req, res) => {
  const { studentId, action } = req.body;
  const student = pendingStudents.find(s => s.id == studentId);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  const timestamp = new Date().toISOString();

  if (action === 'approve') {
    student.status = 'approved';
    student.approvedAt = timestamp;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: process.env.STRIPE_STUDENT_PRICE_ID || 'price_student_placeholder', quantity: 1 }],
        mode: 'subscription', customer_email: student.email,
        success_url: 'https://example.com/success?student_approved=true',
        cancel_url: 'https://example.com/cancel',
      });
      student.stripeUrl = session.url;

      sendStatusUpdate(student.email, { status: student.status, approvedAt: student.approvedAt, stripeUrl: student.stripeUrl });

      sendEmail({
        from: 'no-reply@hackhaven.com', to: student.email,
        subject: 'Your HackHaven Student Verification Has Been Approved',
        html: `...`
      });

      res.json({ message: 'Student approved. Checkout link sent.', checkoutUrl: session.url });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Stripe session creation failed.' });
    }
  } else if (action === 'reject') {
    student.status = 'rejected';

    sendStatusUpdate(student.email, { status: student.status });

    sendEmail({
      from: 'no-reply@hackhaven.com', to: student.email,
      subject: 'Your HackHaven Student Verification Has Been Rejected',
      html: `...`
    });

    if (student.filePath && fs.existsSync(student.filePath)) fs.unlinkSync(student.filePath);

    res.json({ message: 'Student rejected and notified.' });
  }
});

module.exports = router;
