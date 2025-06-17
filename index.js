require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer'); 
const path = require('path');

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
  email: String,
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

// =========================
// 🔍 GET: Search Surveys by idName or email substring (case-insensitive)
// /userprofile/search?q=molindu
// =========================
app.get("/userprofile/search", async (req, res) => {
  try {
    const query = req.query.q;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const regex = new RegExp(query, "i");

    const matchedSurveys = await UserData.find({
      $or: [
        { idName: regex },
        { email: regex },
      ]
    });

    res.json(matchedSurveys);
  } catch (err) {
    console.error("❌ Error searching surveys:", err);
    res.status(500).json({ error: "Failed to search surveys" });
  }
});


// =========================
// 🔍 GET: Check if user profile exists by exact email 
// /userprofile/exists?email=user@example.com
// Returns 200 if found, 404 if not found
// =========================
app.get('/userprofile/exists', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Email query parameter is required' });
  }

  try {
    const user = await UserData.findOne({ email: email }); 
    if (user) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(404).json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking user profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
// ✉️ POST: Send OTP to Email
// =============================

const otpStore = {};

app.post("/send-email-otp", async (req, res) => {
  console.log("📩 Received POST request to /send-email-otp");

  const { email } = req.body;
  console.log("Request body:", req.body);

  if (!email) {
    console.warn("⚠️ Email not provided in request");
    return res.status(400).json({ error: "Email is required" });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;
  console.log(`🔐 Generated OTP for ${email}: ${otp}`);

  // Configure transporter
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
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:braingazeLogo" alt="Braingaze Logo" style="max-width: 120px;" />
        </div>
        <h2 style="text-align: center; color: #333; font-weight: bold;">BGazeFocus-OddTasks Verification</h2>
        <p>Hi,</p>
        <p>I'm <strong>Molindu</strong> from the Braingaze team. To verify your account, please use the following one-time password (OTP):</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #ffffff; background-color: #007bff; padding: 12px 24px; border-radius: 8px; letter-spacing: 2px;">
            ${otp}
          </span>
        </div>
        <p>If you have any questions about this OTP, feel free to reply directly to this email thread.</p>
        <p style="margin-top: 30px;">Thanks,<br><strong>The Braingaze Team</strong></p>
      </div>
    `,
    attachments: [
      {
        filename: 'braingaze.png',
        path: path.join(__dirname, 'braingaze.png'),
        cid: 'braingazeLogo' 
      }
    ]
  };

  console.log("✉️ Mail options prepared with embedded logo");

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
// 🗑️ DELETE: Remove User Profile
// =============================

app.delete("/userprofile/:idName", async (req, res) => {
  try {
    const { idName } = req.params;
    
    if (!idName) {
      return res.status(400).json({ error: "idName parameter is required" });
    }
    
    const deletedUser = await UserData.findOneAndDelete({ idName });
    
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log(`✅ User profile deleted: ${idName}`);
    return res.status(200).json({ message: "✅ User profile deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting user profile:", error);
    return res.status(500).json({ error: "Failed to delete user profile" });
  }
});


// =============================
// 🚀 Start the Express Server
// =============================

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});


// mongodb+srv://Molindu:Diyaparaduwa123@@bgazefocus-oddtasks.bmvxopg.mongodb.net/?retryWrites=true&w=majority&appName=BGazeFocus-OddTasks