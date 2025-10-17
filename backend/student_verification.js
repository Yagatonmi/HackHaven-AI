const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sendEmail = require('./utils/sendEmail');
const { verifyJWT, requireRole } = require('./utils/verifyJWT');
const router = express.Router();

module.exports = function({ io, pendingStudents, verificationTokens }) {

    const upload = multer({ dest: path.join(__dirname, 'uploads/') });

    router.get('/status/:id', verifyJWT, (req, res) => {
        const { id } = req.params;
        const student = pendingStudents.find(s => s.id == id);

        if (req.user.role !== 'admin' && req.user.id != id) {
            return res.status(403).json({ error: 'Forbidden: You can only view your own status.' });
        }

        if (!student) {
            return res.status(404).json({ error: 'No verification status found for this ID.' });
        }
        res.json({ email: student.email, status: student.status, submittedAt: student.submittedAt, approvedAt: student.approvedAt, stripeUrl: student.stripeUrl });
    });

    router.post('/submit-student-verification', upload.single('studentFile'), (req, res) => {
      const { email, eduEmail } = req.body;
      if (!email || (!req.file && !eduEmail)) {
        return res.status(400).json({ error: 'Required fields are missing.' });
      }
      const student = { id: Date.now(), email, filePath: req.file ? req.file.path : null, eduEmail, status: 'pending', submittedAt: new Date().toISOString() };
      pendingStudents.push(student);
      io.to('admins').emit('studentSubmitted', student);
      res.json({ message: 'Verification submitted.', studentId: student.id });
    });

    router.get('/admin/students', verifyJWT, requireRole('admin'), (req, res) => {
        const { status, search, page = 1, limit = 20, sortBy, sortOrder = 'asc' } = req.query;
        let results = [...pendingStudents];
        if (status && status !== 'all') {
            results = results.filter(s => s.status === status);
        }
        if (search) {
            results = results.filter(s => s.email.toLowerCase().includes(search.toLowerCase()));
        }
        if (sortBy) {
            results.sort((a, b) => {
                const valA = a[sortBy] || '';
                const valB = b[sortBy] || '';
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

    router.post('/admin/verify-student', verifyJWT, requireRole('admin'), async (req, res) => {
        const { studentId, action } = req.body;
        const student = pendingStudents.find(s => s.id == studentId);
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        student.status = action === 'approve' ? 'approved' : 'rejected';
        if(action === 'approve') student.approvedAt = new Date().toISOString();

        if (action === 'approve') {
            try {
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [{ price: process.env.STRIPE_STUDENT_PRICE_ID, quantity: 1 }],
                    mode: 'subscription',
                    customer_email: student.email,
                    success_url: 'https://example.com/success',
                    cancel_url: 'https://example.com/cancel',
                });
                student.stripeUrl = session.url;
            } catch (error) {
                console.error("Stripe Error:", error);
                return res.status(500).json({ error: 'Stripe session creation failed.' });
            }
        }

        io.to(`student:${student.id}`).emit('studentStatusUpdated', { status: student.status, approvedAt: student.approvedAt, stripeUrl: student.stripeUrl });
        sendEmail({ to: student.email, subject: `Your verification status has been updated to ${student.status}`, html: `Your status is now ${student.status}` });

        res.json({ message: `Student ${action}d.` });
    });

    return router;
};
