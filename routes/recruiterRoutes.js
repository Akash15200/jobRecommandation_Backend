// routes/recruiterRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getAnalytics,
    skillGapAnalysis,
    getRecruiterAnalytics,
    downloadResume,
    getJobApplicants,
    updateJob,
    toggleJobActive,
    getRecruiterDashboard
} = require('../controllers/recruiterController');

// Analytics routes
router.get('/analytics', protect, getAnalytics);
router.get('/recruiter/analytics', protect, getRecruiterAnalytics);

// Job-specific routes
router.get('/jobs/:jobId/skill-gap', protect, skillGapAnalysis);
router.get('/jobs/:jobId/applicants', protect, getJobApplicants);
router.put('/jobs/:jobId', protect, updateJob);
router.patch('/jobs/:jobId/toggle', protect, toggleJobActive);

// Resume download
router.get('/applications/:appId/download-resume', protect, downloadResume);

// Dashboard route
router.get('/recruiter/:recruiterId', protect, getRecruiterDashboard);

module.exports = router;