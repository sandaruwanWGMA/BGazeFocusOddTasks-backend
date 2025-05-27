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

const UserData = mongoose.model('UserData', userSchema);

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

const otpStore = {}; 

app.post("/send-email-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS, 
    },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Your OTP Code for BGazeFocus-OddTasks',
    text: `Hi! I am Molindu from Braingaze team. Your verification code is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "✅ OTP sent to email" });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// =============================
// ✅ POST: Verify OTP
// =============================

app.post("/verify-email-otp", (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // Optional: clear OTP after verification
    return res.json({ verified: true, message: "✅ OTP verified" });
  }

  return res.status(400).json({ verified: false, message: "❌ Invalid or expired OTP" });
});

// =============================
// 🚀 Start the Express Server
// =============================

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});


// mongodb+srv://Molindu:Diyaparaduwa123@@bgazefocus-oddtasks.bmvxopg.mongodb.net/?retryWrites=true&w=majority&appName=BGazeFocus-OddTasks