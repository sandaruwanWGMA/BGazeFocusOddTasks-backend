/**
 * auth routes
 * -----------
 * OTP email verification and JWT issuance / validation.
 * Mounted at root path (/).
 */
const express = require('express');
const nodemailer = require('nodemailer');
const { signToken, authenticateToken, COOKIE_NAME } = require('../utils/auth');
const UserData = require('../models/UserProfile');

const router = express.Router();

// Simple in-memory email → OTP map. Lives only for the lifetime of the container.
const otpStore = {};

// (1) SEND OTP
router.post('/send-email-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  const mailOptions = {
    from   : process.env.GMAIL_USER,
    to     : email,
    subject: 'Your OTP Code for BGazeFocus-OddTasks',
    html   : `<h1>BGaze OTP</h1><p>Your code is <b>${otp}</b></p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: '✅ OTP sent to e-mail' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// (2) VERIFY OTP + ISSUE JWT
router.post('/verify-email-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ verified: false, message: 'Email and OTP required' });
  if (otpStore[email] !== otp)
    return res.json({ verified: false, message: '❌ Invalid or expired OTP' });

  delete otpStore[email];

  const token = signToken({ email });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure  : true,
    sameSite: 'strict',
    maxAge  : 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });

  return res.json({ verified: true, message: '✅ OTP verified', token, expiresIn: 7 * 24 * 60 * 60 });
});

// (3) AUTO-LOGIN
router.get('/auto-login', authenticateToken, async (req, res) => {
  try {
    const profiles = await UserData.find({ email: req.user.email }).lean();
    res.json({ ok: true, email: req.user.email, profiles });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to fetch profiles' });
  }
});

// (4) Example extra protected endpoint
router.get('/auth/me', authenticateToken, (_req, res) =>
  res.json({ ok: true, user: _req.user })
);

module.exports = router; 