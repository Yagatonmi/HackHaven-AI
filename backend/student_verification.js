const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');
const sendEmail = require('./utils/sendEmail');
const router = express.Router();

module.exports = function(io) {
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

    function sendStatusUpdate(email, data) {
        const res = activeConnections.get(email.toLowerCase());
        if (res) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }

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
            text: `...`
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
      const { email, eduEmail } = req.body;
      if (!email || (!req.file && !eduEmail)) {
        return res.status(400).json({ error: 'Email and either a file or edu-email are required.' });
      }
      const student = {
        id: Date.now(), email, filePath: req.file ? req.file.path : null,
        eduEmail: eduEmail, status: 'pending', submittedAt: new Date().toISOString()
      };
      pendingStudents.push(student);
      io.emit('studentSubmitted', student);
      res.json({ message: 'Verification submitted.', studentId: student.id });
    });

    router.get('/admin/students', (req, res) => {
        const { status, search, page = 1, limit = 20, sortBy, sortOrder = 'asc' } = req.query;
        let results = [...pendingStudents];
        if (status && status !== 'all') {
            results = results.filter(s => s.status === status);
        }
        if (search) {
            const searchTerm = search.toLowerCase();
            results = results.filter(s => s.email.toLowerCase().includes(searchTerm) || (s.eduEmail && s.eduEmail.toLowerCase().includes(searchTerm)));
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
        const paginatedStudents = results.slice((page - 1) * limit, page * limit);
        res.json({ students: paginatedStudents, totalCount, totalPages, currentPage: parseInt(page) });
    });

    router.post('/admin/verify-student', async (req, res) => {
        const { studentId, action } = req.body;
        const student = pendingStudents.find(s => s.id == studentId);
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        student.status = action === 'approve' ? 'approved' : 'rejected';
        if(action === 'approve') student.approvedAt = new Date().toISOString();

        if (action === 'approve') {
            try {
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [{ price: process.env.STRIPE_STUDENT_PRICE_ID || 'price_student_placeholder', quantity: 1 }],
                    mode: 'subscription',
                    customer_email: student.email,
                    success_url: 'https://example.com/success',
                    cancel_url: 'https://example.com/cancel',
                });
                student.stripeUrl = session.url;
            } catch (error) {
                return res.status(500).json({ error: 'Stripe session creation failed.' });
            }
        }

        sendStatusUpdate(student.email, { status: student.status, approvedAt: student.approvedAt, stripeUrl: student.stripeUrl });
        sendEmail({ to: student.email, subject: `Your verification is ${student.status}`, html: `...` });

        res.json({ message: `Student ${action}d.` });
    });

    return router;
};
