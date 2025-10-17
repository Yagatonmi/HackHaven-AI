const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-key';

function verifySocketAuth(socket, next) {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: No token provided.'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token.'));
        }
        // Attach user data to the socket object for use in other parts of the app
        socket.user = decoded;
        next();
    });
}

module.exports = verifySocketAuth;
