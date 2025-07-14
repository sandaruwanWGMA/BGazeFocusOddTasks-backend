/**
 * auth.js
 * ----------
 * Reusable JWT helpers + middleware for Express.
 */
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'bgaze_token';

/**
 * Generates a 7-day signed JWT containing the supplied payload.
 */
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

/**
 * Express middleware that validates either:
 *  • Authorization: Bearer <token>
 *  • httpOnly cookie "bgaze_token"
 * and attaches the decoded payload to req.user
 */
const authenticateToken = (req, res, next) => {
  const bearer = req.headers.authorization?.split(' ')[1];
  const cookie = req.cookies?.[COOKIE_NAME];
  const token  = bearer || cookie;

  if (!token) return res.status(401).json({ error: 'Token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token invalid or expired' });
    req.user = decoded; // { email, iat, exp }
    next();
  });
};

module.exports = { COOKIE_NAME, signToken, authenticateToken }; 