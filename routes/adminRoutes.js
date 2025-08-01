const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getAllUsers,
  deleteUser,
  changeUserRole,
  getAllJobs,
  deleteJob,
  getPlatformMetrics,
  getAnalyticsCard,
  getUserAnalytics,
  sendAdminInvite,
  acceptAdminInvite,
  getJobDetails,
  getAdminLogs
} = require('../controllers/adminController');

// User management routes
router.get('/users', protect, adminOnly, getAllUsers);
router.delete('/users/:id', protect, adminOnly, deleteUser);
router.patch('/users/:id/role', protect, adminOnly, changeUserRole);
router.get('/users/:userId/analytics', protect, adminOnly, getUserAnalytics);

// Job management routes
router.get('/jobs', protect, adminOnly, getAllJobs);
router.delete('/jobs/:id', protect, adminOnly, deleteJob);
router.get('/jobs/:jobId/details', protect, adminOnly, getJobDetails);

// Analytics routes
router.get('/metrics', protect, adminOnly, getPlatformMetrics);
router.get('/analyticsCard', protect, getAnalyticsCard);

// Admin management routes
router.post('/admin/invite', protect, adminOnly, sendAdminInvite);
router.post('/admin/accept-invite', protect, acceptAdminInvite);
router.get('/admin/logs', protect, adminOnly, getAdminLogs);

module.exports = router;