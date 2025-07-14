/**********************************************************
 * 🌐  BGazeFocus-OddTasks – Express + Mongo + AWS-S3 API  *
 **********************************************************/

/* ─────────────────────────────────────────────────────────
 * 1. 🔧  Imports & Global Config
 * ───────────────────────────────────────────────────────── */
require("dotenv").config();
const express     = require("express");
const mongoose    = require("mongoose");
const cors        = require("cors");
const nodemailer  = require("nodemailer");
const path        = require("path");

/* AWS S3 */
const AWS         = require("aws-sdk");
const multer      = require("multer");
const multerS3    = require("multer-s3");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─────────────────────────────────────────────────────────
 * 2. 🌎  Middleware
 * ───────────────────────────────────────────────────────── */
app.use(cors());
app.use(express.json());

/* ─────────────────────────────────────────────────────────
 * 3. 🔗  MongoDB Connection
 * ───────────────────────────────────────────────────────── */
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser   : true,
    useUnifiedTopology: true,
  })
  .then(()  => console.log("✅ MongoDB connected"))
  .catch((e)=> console.error("❌ MongoDB connection error:", e));

/* ─────────────────────────────────────────────────────────
 * 4. 📦  Mongoose Schema & Model
 * ───────────────────────────────────────────────────────── */
const userSchema = new mongoose.Schema({
  idName                     : { type: String, required: true, unique: true },
  email                      : String, 
  age                        : String,
  genderIdentity             : String,
  adhdDiagnosisConfidence    : String,
  adhdSymptomProfile         : String,
  adhdMedicationStatus       : String,
  autismDiagnosisConfidence  : String,
  facialExpressionRecognition: String,
  eyeContactComfort          : String,
  readingComprehensionChallenges: String,
  readingProficiency         : String,
  dailyFunctionalChallenges  : String,
  dyslexiaDiagnosis          : String,
  dyslexiaManagement         : String,
  visualFocusPatterns        : String,
  geographicRegion           : String,
});

/* 📥  Index on `email` (non-unique) to make look-ups O(log n) & index-only  */
userSchema.index({ email: 1 });

const UserData = mongoose.model("UserProfile", userSchema);

/* ─────────────────────────────────────────────────────────
 * 5. 🔐  In-Memory OTP Store
 * ───────────────────────────────────────────────────────── */
const otpStore = {};

/* ─────────────────────────────────────────────────────────
 * 6. ☁️  AWS-S3 Configuration
 * ───────────────────────────────────────────────────────── */
AWS.config.update({
  accessKeyId    : process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region         : process.env.AWS_REGION,
});
const s3 = new AWS.S3();

/* Multer-S3 helper for uploads */
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl   : "public-read",
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key     : (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
});

/* ─────────────────────────────────────────────────────────
 * 7. 🚀  USER PROFILE ROUTES (CRUD + Search)
 * ───────────────────────────────────────────────────────── */

/* 7.1  Create profile */
app.post("/userprofile", async (req, res) => {
  try {
    const newUser = new UserData(req.body);
    await newUser.save();
    res.status(201).json({ message: "✅ Data saved successfully" });
  } catch (error) {
    console.error("❌ Error saving data:", error);
    if (error.code === 11000 && error.keyPattern?.idName) {
      return res.status(409).json({ error: "Duplicate key: idName already exists" });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/* 7.2  Read – all profiles */
app.get("/userprofile", async (_req, res) => {
  try {
    const surveys = await UserData.find({});
    res.json(surveys);
  } catch (err) {
    console.error("❌ Error fetching surveys:", err);
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

/* 7.3  Read – search by idName / e-mail substring */
app.get("/userprofile/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q?.trim()) return res.status(400).json({ error: "Query parameter 'q' is required" });
    const regex = new RegExp(q, "i");
    const matched = await UserData.find({ $or: [{ idName: regex }, { email: regex }] });
    res.json(matched);
  } catch (err) {
    console.error("❌ Error searching surveys:", err);
    res.status(500).json({ error: "Failed to search surveys" });
  }
});

/* 7.4  FAST Read – existence (and also count) by e-mail
        -----------------------------------------------------------------
        • ?email=foo@bar.com            → 204 if exist, 404 if not
        • ?email=foo@bar.com&withCount  → 200/404 + JSON {exists,count}
        Uses the non-unique index for an index-only O(log n) lookup      */
app.get("/userprofile/exists", async (req, res) => {
  const { email, withCount } = req.query;
  if (!email) return res.status(400).json({ error: "Email query parameter is required" });

  try {
    /* Cheapest boolean check */
    const emailExists = await UserData.exists({ email });

    /* If caller only needs yes/no, reply with minimal payload */
    if (!withCount) {
      return emailExists ? res.status(204).end() // found → 204 No Content
                         : res.status(404).end(); // not found
    }

    /* Need exact count? perform second index-only count */
    const count = emailExists ? await UserData.countDocuments({ email }) : 0;
    return res.status(emailExists ? 200 : 404).json({ exists: !!emailExists, count });
  } catch (err) {
    console.error("❌ Error checking email existence:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* 7.5  Read – by idName */
app.get("/userprofile/:idName", async (req, res) => {
  try {
    const { idName } = req.params;
    if (!idName) return res.status(400).json({ error: "idName parameter is required" });
    const user = await UserData.findOne({ idName });
    if (!user) return res.status(404).json({ error: "User profile not found" });
    console.log(`✅ User profile fetched: ${idName}`);
    res.status(200).json(user);
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

/* 7.6  Update profile (change idName/email) */
app.put("/userprofile/:idName", async (req, res) => {
  try {
    const { idName }       = req.params;
    const { newIdName, newEmail } = req.body;
    if (!idName) return res.status(400).json({ error: "idName parameter is required" });

    const existingUser = await UserData.findOne({ idName });
    if (!existingUser)
      return res.status(404).json({ error: "User not found. Please check the username and try again." });

    const updateData = {};
    if (newIdName) updateData.idName = newIdName;
    if (newEmail)  updateData.email  = newEmail;
    if (!Object.keys(updateData).length)
      return res.status(400).json({ error: "No update data provided. Please provide newIdName or newEmail." });

    if (newIdName && newIdName !== idName) {
      const duplicate = await UserData.findOne({ idName: newIdName });
      if (duplicate) return res.status(409).json({ error: "Username already taken. Please choose a different username." });
    }
    const updatedUser = await UserData.findOneAndUpdate({ idName }, updateData, { new: true });
    console.log(`✅ User profile updated: ${idName} -> ${updatedUser.idName}`);
    res.status(200).json({ message: "✅ User profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    if (error.code === 11000 && error.keyPattern?.idName)
      return res.status(409).json({ error: "Username already taken. Please choose a different username." });
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

/* 7.7  Delete profile */
app.delete("/userprofile/:idName", async (req, res) => {
  try {
    const { idName } = req.params;
    if (!idName) return res.status(400).json({ error: "idName parameter is required" });
    const deleted = await UserData.findOneAndDelete({ idName });
    if (!deleted) return res.status(404).json({ error: "User not found" });
    console.log(`✅ User profile deleted: ${idName}`);
    res.status(200).json({ message: "✅ User profile deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting user profile:", error);
    res.status(500).json({ error: "Failed to delete user profile" });
  }
});

/* ─────────────────────────────────────────────────────────
 * 8. 🔐  EMAIL OTP ROUTES
 * ───────────────────────────────────────────────────────── */

/* 8.1  Send OTP */
app.post("/send-email-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  /* Generate & store 6-digit OTP */
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  /* Nodemailer setup */
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Your OTP Code for BGazeFocus-OddTasks",
    html: `
      <div style="font-family: Arial; max-width:500px; margin:auto; padding:20px; border:1px solid #eaeaea; border-radius:10px; background:#f9f9f9;">
        <div style="text-align:center; margin-bottom:20px;">
          <img src="cid:braingazeLogo" alt="Braingaze Logo" style="max-width:120px;" />
        </div>
        <h2 style="text-align:center; color:#333;">BGazeFocus-OddTasks Verification</h2>
        <p>Hi,</p>
        <p>I'm <strong>Molindu</strong> from the Braingaze team. Use this one-time password (OTP):</p>
        <div style="text-align:center; margin:20px 0;">
          <span style="font-size:32px; font-weight:bold; color:#fff; background:#007bff; padding:12px 24px; border-radius:8px; letter-spacing:2px;">
            ${otp}
          </span>
        </div>
        <p>If you have any questions about this OTP, reply to this e-mail.</p>
        <p style="margin-top:30px;">Thanks,<br><strong>The Braingaze Team</strong></p>
      </div>
    `,
    attachments: [{
      filename: "braingaze.png",
      path    : path.join(__dirname, "braingaze.png"),
      cid     : "braingazeLogo",
    }],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP e-mail sent → ${email}`);
    res.json({ message: "✅ OTP sent to e-mail" });
  } catch (err) {
    console.error("❌ Error sending OTP e-mail:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

/* 8.2  Verify OTP */
app.post("/verify-email-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ verified: false, message: "Email and OTP are required" });

  if (otpStore[email] === otp) {
    delete otpStore[email]; // one-time usage
    return res.json({ verified: true, message: "✅ OTP verified successfully" });
  }
  return res.json({ verified: false, message: "❌ Invalid or expired OTP" });
});

/* ─────────────────────────────────────────────────────────
 * 9. ☁️  AWS-S3 FILE ROUTES
 * ───────────────────────────────────────────────────────── */

/* 9.1  Upload file to S3 */
app.post("/s3/upload", upload.single("file"), (req, res) => {
  res.json({ message: "✅ File uploaded to S3", key: req.file.key, url: req.file.location });
});

/* 9.2  List files in bucket */
app.get("/s3/files", async (_req, res) => {
  try {
    const data = await s3.listObjectsV2({ Bucket: process.env.AWS_S3_BUCKET }).promise();
    res.json(data.Contents);
  } catch (err) {
    console.error("❌ S3 list error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

/* 9.3  Generate signed download URL */
app.get("/s3/file/:key", (req, res) => {
  const url = s3.getSignedUrl("getObject", {
    Bucket : process.env.AWS_S3_BUCKET,
    Key    : req.params.key,
    Expires: 60 * 60, // 1 h
  });
  res.json({ url });
});

/* 9.4  Delete file from bucket */
app.delete("/s3/file/:key", async (req, res) => {
  try {
    await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: req.params.key }).promise();
    res.json({ message: "✅ File deleted from S3" });
  } catch (err) {
    console.error("❌ S3 delete error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

/* ─────────────────────────────────────────────────────────
 * 10. 🚀  Start Express Server
 * ───────────────────────────────────────────────────────── */
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

/* Mongo URI (reference) 
mongodb+srv://Molindu:Diyaparaduwa123@@bgazefocus-oddtasks.bmvxopg.mongodb.net/?retryWrites=true&w=majority&appName=BGazeFocus-OddTasks
*/