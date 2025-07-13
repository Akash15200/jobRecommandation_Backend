const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, enum: ['applied', 'shortlisted', 'rejected'], default: 'applied' },
    skills: [{ type: String }],
    messages: [{
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        date: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Applicant', applicantSchema);
