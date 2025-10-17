const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-key-that-should-be-in-env';

// Mock user database
const users = [
    { id: 1, email: 'admin@hackhaven.com', password: 'password', role: 'admin' },
    { id: 12345, email: 'student@example.com', password: 'password', role: 'student' }
];

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user });
});

module.exports = router;
