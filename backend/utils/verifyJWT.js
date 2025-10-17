const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-key-that-should-be-in-env';

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication error: No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Authentication error: Invalid token.' });
        }
        req.user = decoded;
        next();
    });
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user && req.user.role === role) {
            next();
        } else {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
        }
    };
}

module.exports = { verifyJWT, requireRole };
