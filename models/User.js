const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['student', 'recruiter', 'admin'],
    default: 'student'
  },

  lastLogin: {
    type: [Date],  
    default: []    
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  skills: [String],
  createdAt: { type: Date, default: Date.now },
  resumePath: {
    type: String, // e.g., 'upload/resumes/filename.pdf'
  }
});

// userSchema.pre('save', function(next) {
//   // Prevent direct admin creation via signup
//   if (this.isNew && this.role === 'admin') {
//     throw new Error('Admin accounts must be created through elevation process');
//   }
//   next();
// });

module.exports = mongoose.model('User', UserSchema);