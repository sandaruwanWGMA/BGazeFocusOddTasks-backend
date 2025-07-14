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

const otpStore = {};

// (1) SEND OTP
router.post('/send-email-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 min in ms
  otpStore[email] = { otp, expires };
  // auto-purge after 5 minutes to avoid memory leaks
  setTimeout(() => { delete otpStore[email]; }, 5 * 60 * 1000);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  const mailOptions = {
    from   : process.env.GMAIL_USER,
    to     : email,
    subject: 'Your One-Time Passcode | BGaze Monitoring',
    html   : `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#1e3a8a;padding:16px 24px;text-align:center;color:#ffffff;font-size:24px;font-weight:bold;">
          BGaze&nbsp;Monitoring – One-Time Passcode
        </td>
      </tr>
      <tr>
        <td style="padding:24px;color:#444;font-size:16px;line-height:1.5;">
          <p>Hi there,</p>
          <p>I’m <strong>Molindu</strong> from <a href="https://braingaze.com" style="color:#1e3a8a;text-decoration:none;">Braingaze</a>. You’re receiving this e-mail because you attempted to sign in to the <strong>BGaze Monitoring</strong> research-study app.</p>
          <div style="margin:32px 0;text-align:center;">
            <span style="display:inline-block;padding:12px 28px;background:#eef2ff;border-radius:10px;font-size:32px;font-weight:700;letter-spacing:4px;color:#1e3a8a;">${otp}</span>
          </div>
          <p>Please enter the above code to complete your login. This passcode will expire in 5&nbsp;minutes.</p>
          <p>If you did not request this code or run into any issues, simply reply to this e-mail and our team will assist you.</p>
          <p style="margin-top:32px;">Best regards,<br/>Molindu<br/>Braingaze</p>
        </td>
      </tr>
      <tr>
        <td style="background:#f0f2f5;padding:16px 24px;font-size:12px;color:#666;text-align:center;">
          © Braingaze · <a href="https://braingaze.com" style="color:#666;text-decoration:none;">braingaze.com</a>
        </td>
      </tr>
    </table>
  </body>
</html>`
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
  const record = otpStore[email];
  if (!record || record.otp !== otp)
    return res.json({ verified: false, message: '❌ Invalid or expired OTP' });
  if (Date.now() > record.expires) {
    delete otpStore[email];
    return res.json({ verified: false, message: '❌ OTP expired' });
  }

  delete otpStore[email];

  const token = signToken({ email });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure  : process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
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

// (4) extra protected endpoint
router.get('/auth/me', authenticateToken, (_req, res) =>
  res.json({ ok: true, user: _req.user })
);

module.exports = router; 