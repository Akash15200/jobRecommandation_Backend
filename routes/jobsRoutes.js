const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobsController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/jobs - Get all jobs
router.get('/', jobsController.getAllJobs);

// POST /api/jobs - Create new job
router.post('/', protect, jobsController.createJob);

// GET /api/jobs/myjobs - Get recruiter's jobs
router.get('/myjobs', protect, jobsController.getMyJobs);

// DELETE /api/jobs/:id - Delete job
router.delete('/:id', protect, jobsController.deleteJob);

// GET /api/jobs/user/:id - Get user applications
router.get('/user/:id', jobsController.getUserApplications);

// GET /api/jobs/:id - Get single job by ID
router.get('/:id', jobsController.getJobById);

// GET /api/jobs/recruiter/myjobs - Alternative endpoint for recruiter's jobs
router.get('/recruiter/myjobs', protect, jobsController.getRecruiterJobs);

// GET /api/jobs/search - Search jobs
router.get('/search', jobsController.searchJobs);

module.exports = router;