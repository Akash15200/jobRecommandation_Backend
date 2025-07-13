const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    requiredSkills: [{ type: String, required: true }],
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    location: { type: String },
    salary: { type: String },
    type: { type: String },
    experience: { type: String },
    remote: { type: Boolean, default: false },
    postedDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    companyName: { type: String, required: true },
    recruiterName: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);
