// utils/adminLogger.js
const AdminLog = require('../models/AdminLog');

const logAdminAction = async (adminId, action, target = null, metadata = {}) => {
  try {
    await AdminLog.create({
      admin: adminId,
      action,
      target,
      metadata
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
};



module.exports = logAdminAction;