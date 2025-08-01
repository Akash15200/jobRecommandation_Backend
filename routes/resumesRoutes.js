// routes/resumeRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  upload, 
  uploadResume, 
  downloadResume, 
  recommendJobs 
} = require('../controllers/resumeController');

// POST /api/resumes - Upload and parse resume
router.post('/', protect, upload.single('resume'), uploadResume);

// GET /api/resumes/download/:filename - Download resume
router.get('/download/:filename', protect, downloadResume);

// POST /api/resumes/recommend-jobs - Recommend jobs
router.post('/recommend-jobs', recommendJobs);

module.exports = router;