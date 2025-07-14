/**********************************************************************************************
 *  BGazeFocus-OddTasks ⇢ ONE-FILE BACK-END
 *  -------------------------------------------------
 *  Express ⬩ MongoDB / Mongoose ⬩ AWS-S3 ⬩ Nodemailer ⬩ JSON-Web-Token
 *
 *    • Non-unique e-mail index  → ultra-fast look-ups
 *    • JWT “remember-me” token (7-day life) so user doesn’t re-enter OTP every day
 *    • Cookie + Bearer-token support      (works for browsers & native apps)
 *    • /auto-login  endpoint              (silent login at app start-up)
 *
 **********************************************************************************************/

require("dotenv").config();

/* ─────────── CORE IMPORTS ─────────── */
const express      = require("express");
const mongoose     = require("mongoose");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const nodemailer   = require("nodemailer");
const path         = require("path");
const jwt          = require("jsonwebtoken");

/* ─────────── AWS-S3 IMPORTS ─────────── */
const AWS          = require("aws-sdk");
const multer       = require("multer");
const multerS3     = require("multer-s3");

/* ─────────── EXPRESS APP & CONFIG ─────────── */
const app  = express();
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = "bgaze_token";          // auth cookie

/* ─────────── GLOBAL MIDDLEWARE ─────────── */
app.use(cors());                  // enable CORS for all routes
app.use(express.json());          // parse incoming JSON
app.use(cookieParser());          // parse cookies for token auth

/* ------------------------------------------------------------------------------------------------
   1️⃣  DATABASE  (MongoDB + Mongoose)
--------------------------------------------------------------------------------------------------*/
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser:true, useUnifiedTopology:true })
  .then(()=> console.log("✅ MongoDB connected"))
  .catch(err=> console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  idName : { type:String, required:true, unique:true },   // unique username / ID in Unity
  email  : String,                                       
  /* --- survey / profile attributes --- */
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

userSchema.index({ email:1 });

const UserData = mongoose.model("UserProfile", userSchema);

/* ------------------------------------------------------------------------------------------------
   2️⃣  OTP STORE  (simple in-memory map : email → otp)
       NOTE: survives only while server process is running
--------------------------------------------------------------------------------------------------*/
const otpStore = {};

/* ------------------------------------------------------------------------------------------------
   3️⃣  JWT HELPERS
--------------------------------------------------------------------------------------------------*/
/* Signs a new 7-day token containing the user’s e-mail. */
const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

/* Middleware that validates either:
   •   Authorization: Bearer xxx
   •   httpOnly cookie “bgaze_token”
   Places decoded payload on req.user  */
const authenticateToken = (req, res, next) => {
  const bearer = req.headers.authorization?.split(" ")[1];
  const cookie = req.cookies?.[COOKIE_NAME];
  const token  = bearer || cookie;

  if (!token) return res.status(401).json({ error:"Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error:"Token invalid or expired" });
    req.user = decoded;        // { email, iat, exp }
    next();
  });
};

/* ------------------------------------------------------------------------------------------------
   4️⃣  AWS-S3  (file uploads)
--------------------------------------------------------------------------------------------------*/
AWS.config.update({
  accessKeyId    : process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region         : process.env.AWS_REGION,
});
const s3 = new AWS.S3();

/* Multer-S3 storage engine → uploads arrive at /tmp, then streamed to S3 immediately. */
const upload = multer({
  storage: multerS3({
    s3,
    bucket  : process.env.AWS_S3_BUCKET,
    acl     : "public-read",
    key     : (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    metadata: (_req, file, cb) => cb(null, { fieldName:file.fieldname }),
  }),
});

/* ------------------------------------------------------------------------------------------------
   5️⃣  USER PROFILE  CRUD + SEARCH
--------------------------------------------------------------------------------------------------*/

/* (5.1) CREATE  ──────────────────────────────────────────────────────────────────────────────
   Path       : POST  /userprofile
   Purpose    : Save Unity survey/profile JSON for a new username
   Request    : Body = full profile object (must include unique idName)
   Response   : 201 + { message }
*/
app.post("/userprofile", async (req,res) => {
  try {
    const newUser = new UserData(req.body);
    await newUser.save();
    return res.status(201).json({ message:"✅ Data saved successfully" });
  } catch (err) {
    console.error("❌ Error saving data:", err);
    if (err.code === 11000 && err.keyPattern?.idName)
      return res.status(409).json({ error:"Duplicate key: idName already exists" });
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/* (5.2) READ-ALL  ─────────────────────────────────────────────────────────────────────────────
   Path       : GET /userprofile
   Purpose    : Fetch every stored profile document
*/
app.get("/userprofile", async (_req,res)=>{
  try { res.json(await UserData.find({})); }
  catch(e){ console.error(e); res.status(500).json({ error:"Failed to fetch surveys" }); }
});

/* (5.3) SEARCH  ───────────────────────────────────────────────────────────────────────────────
   Path       : GET /userprofile/search?q=substring
   Purpose    : Case-insensitive substring search on idName OR e-mail
*/
app.get("/userprofile/search", async (req,res)=>{
  try {
    const q = req.query.q;
    if(!q?.trim()) return res.status(400).json({ error:"Query parameter 'q' is required"});
    const regex = new RegExp(q,"i");
    res.json(await UserData.find({ $or:[ {idName:regex}, {email:regex} ] }));
  } catch(e){ console.error(e); res.status(500).json({error:"Failed to search surveys"}); }
});

/* (5.4) EXISTS (FAST)  ────────────────────────────────────────────────────────────────────────
   Path       : GET /userprofile/exists?email=foo@bar.com[&withCount=true]
   Purpose    : Check if any profile uses this e-mail.  Uses index-only `exists()`.
   Response   : 
        – Basic  : 204 (found)  OR 404 (not found)
        – With count : 200 / 404 + JSON { exists, count }
*/
app.get("/userprofile/exists", async (req,res)=>{
  const { email, withCount } = req.query;
  if(!email) return res.status(400).json({ error:"Email query parameter is required" });
  try{
    const exists = await UserData.exists({ email });
    if(!withCount){
      return exists ? res.status(204).end() : res.status(404).end();
    }
    const count = exists ? await UserData.countDocuments({ email }) : 0;
    return res.status(exists?200:404).json({ exists:!!exists, count });
  }catch(e){ console.error(e); res.status(500).json({error:"Internal server error"}); }
});

/* (5.5) READ-ONE  ─────────────────────────────────────────────────────────────────────────────
   Path       : GET /userprofile/:idName
   Purpose    : Fetch single profile by its unique idName
*/
app.get("/userprofile/:idName", async (req,res)=>{
  const { idName } = req.params;
  if(!idName) return res.status(400).json({error:"idName parameter is required"});
  try{
    const user = await UserData.findOne({ idName });
    return user ? res.json(user) : res.status(404).json({error:"User profile not found"});
  }catch(e){ console.error(e); res.status(500).json({error:"Failed to fetch user profile"}); }
});

/* (5.6) UPDATE  ───────────────────────────────────────────────────────────────────────────────
   Path       : PUT /userprofile/:idName
   Purpose    : Change idName and/or e-mail
*/
app.put("/userprofile/:idName", async (req,res)=>{
  const { idName } = req.params;
  const { newIdName, newEmail } = req.body;
  if(!idName) return res.status(400).json({error:"idName parameter is required"});
  try{
    const user = await UserData.findOne({ idName });
    if(!user) return res.status(404).json({ error:"User not found." });
    const upd = {};
    if(newIdName) upd.idName=newIdName;
    if(newEmail)  upd.email=newEmail;
    if(!Object.keys(upd).length) return res.status(400).json({error:"No update data provided"});
    if(newIdName && newIdName!==idName){
      if(await UserData.findOne({ idName:newIdName }))
        return res.status(409).json({error:"Username already taken"});
    }
    const updated = await UserData.findOneAndUpdate({ idName }, upd, { new:true });
    return res.json({ message:"✅ User profile updated successfully", user:updated });
  }catch(e){
    console.error(e);
    if(e.code===11000 && e.keyPattern?.idName) return res.status(409).json({error:"Username already taken"});
    res.status(500).json({error:"Failed to update user profile"});
  }
});

/* (5.7) DELETE  ───────────────────────────────────────────────────────────────────────────────
   Path       : DELETE /userprofile/:idName
   Purpose    : Remove a profile completely
*/
app.delete("/userprofile/:idName", async (req,res)=>{
  const { idName } = req.params;
  if(!idName) return res.status(400).json({error:"idName parameter is required"});
  try{
    const del = await UserData.findOneAndDelete({ idName });
    return del ? res.json({message:"✅ User profile deleted successfully"})
               : res.status(404).json({error:"User not found"});
  }catch(e){ console.error(e); res.status(500).json({error:"Failed to delete user profile"}); }
});

/* ------------------------------------------------------------------------------------------------
   6️⃣  OTP + JWT  AUTHENTICATION
--------------------------------------------------------------------------------------------------*/

/* (6.1) SEND OTP ───────────────────────────────────────────────────────────────────────────────
   Path       : POST /send-email-otp
   Body       : { email }
   Process    : • Generates random 6-digit OTP
                • Stores in memory
                • Sends HTML mail via Gmail SMTP
*/
app.post("/send-email-otp", async (req,res)=>{
  const { email } = req.body;
  if(!email) return res.status(400).json({error:"Email is required"});
  const otp = Math.floor(100000+Math.random()*900000).toString();
  otpStore[email] = otp;

  const transporter = nodemailer.createTransport({
    service:"gmail",
    auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_PASS },
  });

  const mailOptions = {
    from   : process.env.GMAIL_USER,
    to     : email,
    subject: "Your OTP Code for BGazeFocus-OddTasks",
    html   : /* HTML omitted for brevity */ `
      <h1>BGaze OTP</h1><p>Your code is <b>${otp}</b></p>
    `,
  };

  try{ await transporter.sendMail(mailOptions);
       res.json({ message:"✅ OTP sent to e-mail" });
  }catch(e){ console.error(e); res.status(500).json({error:"Failed to send OTP"}); }
});

/* (6.2) VERIFY OTP  +  ISSUE JWT ──────────────────────────────────────────────────────────────
   Path       : POST /verify-email-otp
   Body       : { email, otp }
   Success    : • Deletes OTP from store (one-time)
                • Signs 7-day JWT
                • Sets httpOnly cookie  + returns token in JSON
*/
app.post("/verify-email-otp", (req,res)=>{
  const { email, otp } = req.body;
  if(!email || !otp) return res.status(400).json({verified:false, message:"Email and OTP required"});
  if(otpStore[email] !== otp) return res.json({ verified:false, message:"❌ Invalid or expired OTP"});
  delete otpStore[email];

  const token = signToken({ email });
  res.cookie(COOKIE_NAME, token,{
    httpOnly:true, secure:true, sameSite:"strict",
    maxAge:7*24*60*60*1000,    // 7 days in ms
  });

  return res.json({
    verified : true,
    message  : "✅ OTP verified",
    token,
    expiresIn: 7*24*60*60      // seconds
  });
});

/* (6.3) AUTO-LOGIN  ────────────────────────────────────────────────────────────────────────────
   Path       : GET /auto-login
   Purpose    : Client hits this on app boot ‑ if cookie / bearer token valid
                it returns every profile linked to the e-mail and user is taken
                straight to Home without re-entering OTP.
*/
app.get("/auto-login", authenticateToken, async (req,res)=>{
  try{
    const profiles = await UserData.find({ email:req.user.email }).lean();
    res.json({ ok:true, email:req.user.email, profiles });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error:"Failed to fetch profiles"}); }
});

/* Example extra protected endpoint (optional) */
app.get("/auth/me", authenticateToken, (_req,res)=> res.json({ ok:true, user:_req.user }));

/* ------------------------------------------------------------------------------------------------
   7️⃣  AWS-S3  FILE ROUTES
   NOTE: All routes protected with authenticateToken (user must be logged-in)
--------------------------------------------------------------------------------------------------*/

/* (7.1) UPLOAD  (multipart/form-data with field “file”) */
app.post("/s3/upload", authenticateToken, upload.single("file"), (req,res)=>{
  res.json({ message:"✅ File uploaded", key:req.file.key, url:req.file.location });
});

/* (7.2) LIST OBJECTS  */
app.get("/s3/files", authenticateToken, async (_req,res)=>{
  try{
    const data = await s3.listObjectsV2({ Bucket:process.env.AWS_S3_BUCKET }).promise();
    res.json(data.Contents);
  }catch(e){ console.error(e); res.status(500).json({error:"Failed to list files"}); }
});

/* (7.3) SIGNED DOWNLOAD URL  */
app.get("/s3/file/:key", authenticateToken, (req,res)=>{
  const url = s3.getSignedUrl("getObject",{
    Bucket:process.env.AWS_S3_BUCKET, Key:req.params.key, Expires:60*60,
  });
  res.json({ url });
});

/* (7.4) DELETE OBJECT */
app.delete("/s3/file/:key", authenticateToken, async (req,res)=>{
  try{
    await s3.deleteObject({ Bucket:process.env.AWS_S3_BUCKET, Key:req.params.key }).promise();
    res.json({ message:"✅ File deleted" });
  }catch(e){ console.error(e); res.status(500).json({error:"Failed to delete file"}); }
});

/* ------------------------------------------------------------------------------------------------
   8️⃣  START SERVER
--------------------------------------------------------------------------------------------------*/
app.listen(PORT, ()=> console.log(`🚀 Server listening on port ${PORT}`));

/* ---------------------------------------------------------------------------------------------
   END OF FILE
----------------------------------------------------------------------------------------------*/