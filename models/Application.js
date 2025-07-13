const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  fitScore: {
    type: Number,
    required: true,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    default: ''
  },
  interviewDate: { 
    type: Date 
  },
  interviewLink: { 
    type: String 
  },
  // CORRECTED: Single status field definition
  status: {
    type: String,
    enum: ['pending', 'accepted', 'interview_scheduled', 'hired', 'rejected'],
    default: 'pending'
  },
  // NEW: Add resumePath field to store filename
  resumePath: {
    type: String
  },
  
});

module.exports = mongoose.model('Application', ApplicationSchema);