const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

// Calculate fit score
router.post('/calculate-fit', applicationController.calculateFitScore);

// Create application
router.post('/', protect, applicationController.createApplication);

// Get recruiter applications
router.get('/recruiter/:recruiterId', applicationController.getRecruiterApplications);

// Update application status
router.put('/:id/status', protect, applicationController.updateApplicationStatus);

// Get user applications
router.get('/user/:id', applicationController.getUserApplications);

// Get application by ID
router.get('/:id', applicationController.getApplication);

// Schedule interview
router.put('/:appId/schedule-interview', protect, applicationController.scheduleInterview);

// Download resume
router.get('/:applicationId/download-resume', protect, applicationController.downloadResume);

// Check application status
router.get('/check', protect, applicationController.checkApplication);

// Delete application
router.delete('/:id', protect, applicationController.deleteApplication);

module.exports = router;