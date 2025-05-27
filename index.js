require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ====================
// 📦 Mongoose Schema
// ====================

const userSchema = new mongoose.Schema({
  idName: { type: String, required: true, unique: true },  
  age: String,
  genderIdentity: String,
  adhdDiagnosisConfidence: String,
  adhdSymptomProfile: String,
  adhdMedicationStatus: String,
  autismDiagnosisConfidence: String,
  facialExpressionRecognition: String,
  eyeContactComfort: String,
  readingComprehensionChallenges: String,
  readingProficiency: String,
  dailyFunctionalChallenges: String,
  dyslexiaDiagnosis: String,
  dyslexiaManagement: String,
  visualFocusPatterns: String,
  geographicRegion: String
});

const UserData = mongoose.model('UserProfile', userSchema);

// =============================
// 🚀 POST: Save Unity User Data
// =============================

app.post('/userprofile', async (req, res) => {
  try {
    const data = req.body;
    const newUser = new UserData(data);
    await newUser.save();
    res.status(201).json({ message: '✅ Data saved successfully' });
  } catch (error) {
    console.error('❌ Error saving data:', error);

    if (error.code === 11000 && error.keyPattern && error.keyPattern.idName) {
      return res.status(409).json({ error: 'Duplicate key: idName already exists' });
    }

    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// =========================
// 🔍 GET: Fetch All Entries
// =========================

app.get("/userprofile", async (req, res) => {
  try {
    const surveys = await UserData.find({});
    res.json(surveys);  
  } catch (err) {
    console.error("❌ Error fetching surveys:", err);
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

// =============================
// ✉️ POST: Send OTP to Email
// =============================

// app.post("/send-email-otp", async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required" });
//   }

//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   otpStore[email] = otp;

//   const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//       user: process.env.GMAIL_USER,
//       pass: process.env.GMAIL_PASS, 
//     },
//   });

//   const mailOptions = {
//     from: process.env.GMAIL_USER,
//     to: email,
//     subject: 'Your OTP Code for BGazeFocus-OddTasks',
//     text: `Hi! I am Molindu from Braingaze team. Your verification code is: ${otp}`,
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     res.json({ message: "✅ OTP sent to email" });
//   } catch (err) {
//     console.error("❌ Error sending OTP:", err);
//     res.status(500).json({ error: "Failed to send OTP" });
//   }
// });

// =============================
// ✅ POST: Verify OTP
// =============================

// app.post("/verify-email-otp", (req, res) => {
//   const { email, otp } = req.body;

//   if (!email || !otp) {
//     return res.status(400).json({ verified: false, message: "Email and OTP are required" });
//   }

//   if (otpStore[email] === otp) {
//     delete otpStore[email]; 
//     return res.json({ verified: true, message: "✅ OTP verified successfully" });
//   } else {
//     return res.json({ verified: false, message: "❌ Invalid or expired OTP" });
//   }
// });


const otpStore = {};

app.post("/send-email-otp", async (req, res) => {
  console.log("📩 Received POST request to /send-email-otp");

  const { email } = req.body;
  console.log("Request body:", req.body);

  if (!email) {
    console.warn("⚠️ Email not provided in request");
    return res.status(400).json({ error: "Email is required" });
  }

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;
  console.log(`🔐 Generated OTP for ${email}: ${otp}`);

  // Configure nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  console.log("📨 Nodemailer transporter configured");

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Your OTP Code for BGazeFocus-OddTasks',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #f9f9f9;">
        <h2 style="text-align: center; color: #333;">🧠 BGazeFocus-OddTasks Verification</h2>
        <p>Hi,</p>
        <p>I'm <strong>Molindu</strong> from the Braingaze team. To verify your email address, please use the following one-time password (OTP):</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #ffffff; background-color: #007bff; padding: 12px 24px; border-radius: 8px; letter-spacing: 2px;">
            ${otp}
          </span>
        </div>
        <p>If you find any questions regarding the OTP, please reply in this same thread. Thank you!!!</p>
        <p style="margin-top: 30px;">Thanks,<br><strong>The Braingaze Team</strong></p>
        <hr style="margin-top: 30px;">
        <p style="font-size: 12px; color: #888; text-align: center;">Please do not reply to this automated email.</p>
      </div>
    `
  };

  console.log("✉️ Mail options prepared");

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent successfully to ${email}`);
    res.json({ message: "✅ OTP sent to email" });
  } catch (err) {
    console.error("❌ Error sending OTP email:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// =============================
// ✅ POST: Verify OTP
// =============================

app.post("/verify-email-otp", (req, res) => {
  console.log("Received POST request to /verify-email-otp");

  const { email, otp } = req.body;
  console.log("Request body:", req.body);

  if (!email || !otp) {
    console.warn("Missing email or OTP in request");
    return res.status(400).json({ verified: false, message: "Email and OTP are required" });
  }

  console.log(`Checking OTP for email: ${email}`);
  console.log(`Expected OTP: ${otpStore[email]}, Provided OTP: ${otp}`);

  if (otpStore[email] === otp) {
    console.log("OTP matched. Deleting OTP from store.");
    delete otpStore[email];
    console.log("OTP deleted from store.");
    return res.json({ verified: true, message: "✅ OTP verified successfully" });
  } else {
    console.warn("OTP mismatch or expired OTP");
    return res.json({ verified: false, message: "❌ Invalid or expired OTP" });
  }
});



// =============================
// 🚀 Start the Express Server
// =============================

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});


// mongodb+srv://Molindu:Diyaparaduwa123@@bgazefocus-oddtasks.bmvxopg.mongodb.net/?retryWrites=true&w=majority&appName=BGazeFocus-OddTasks