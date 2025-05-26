require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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

// Define Mongoose schema
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

// Create model
const UserData = mongoose.model('UserData', userSchema);

// POST endpoint to receive Unity data
app.post('/userdata', async (req, res) => {
  try {
    const data = req.body;
    const newUser = new UserData(data);
    await newUser.save();
    res.status(201).json({ message: '✅ Data saved successfully' });
  } catch (error) {
    console.error('❌ Error saving data:', error);

    // Handle duplicate key error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idName) {
      return res.status(409).json({ error: 'Duplicate key: idName already exists' });
    }

    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


// Simple GET test route
app.get('/', (req, res) => {
  res.json({ message: '✅ Node backend is running' });
});

app.get('/surveys', (req, res) => {
  res.json(surveys);
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});



// mongodb+srv://Molindu:Diyaparaduwa123@@bgazefocus-oddtasks.bmvxopg.mongodb.net/?retryWrites=true&w=majority&appName=BGazeFocus-OddTasks