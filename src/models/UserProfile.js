const mongoose = require('mongoose');

// Schema representing a single Unity survey / profile document.
const userSchema = new mongoose.Schema({
  idName : { type: String, required: true, unique: true }, // unique username / ID in Unity
  email  : String,
  // ---- survey / profile attributes ----
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

// Index to allow fast email look-ups.
userSchema.index({ email: 1 });

// Reuse model if already compiled (important for serverless hot-reloads)
module.exports = mongoose.models.UserProfile || mongoose.model('UserProfile', userSchema); 