const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    target: { type: mongoose.Schema.Types.ObjectId }, // Could be User, Job, etc.
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);