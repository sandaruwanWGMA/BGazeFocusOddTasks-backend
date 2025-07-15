/**
 * app.js
 * ------
 * Constructs the Express application, connects to MongoDB, and wires up
 * global middleware + feature routers. Exported for both local dev & Vercel.
 */
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const mongoose     = require('mongoose');

// Feature routers
const userProfileRoutes = require('./routes/userProfile');
const authRoutes        = require('./routes/auth');
const s3Routes          = require('./routes/s3');

const app = express();

/* -------- Global middleware -------- */
app.use(cors());
app.use(express.json());
app.use(cookieParser());

/* -------- MongoDB -------- */
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser   : true,
        useUnifiedTopology: true,
      });
      console.log('✅ MongoDB connected');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err);
    }
  }
}
// Attempt connection immediately 
connectDB();

/* -------- Routes -------- */
app.use('/userprofile', userProfileRoutes); // survey / profile CRUD
app.use('/', authRoutes);                   // OTP + JWT endpoints
app.use('/s3', s3Routes);                  // AWS S3 file operations

module.exports = app; 