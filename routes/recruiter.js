// backend/routes/recruiterRoutes.js

const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Application = require('../models/Application');
const { protect } = require('../middleware/authMiddleware');

// ✅ View applicants for a job
router.get('/jobs/:jobId/applicants', protect, async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job || job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized' });
        }
        const applications = await Application.find({ job: job._id })
            .populate('user', 'name email skills')
            .populate('job', 'title');
        res.json(applications);
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ✅ Edit job
router.put('/jobs/:jobId', protect, async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job || job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized' });
        }
        const { title, description, requiredSkills } = req.body;
        job.title = title || job.title;
        job.description = description || job.description;
        job.requiredSkills = requiredSkills || job.requiredSkills;
        await job.save();
        res.json(job);
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ✅ Toggle Active/Inactive
router.patch('/jobs/:jobId/toggle', protect, async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job || job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized' });
        }
        job.isActive = !job.isActive;
        await job.save();
        res.json({ isActive: job.isActive });
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// ✅ Recruiter Analytics (for frontend RecruiterDashboard)
router.get('/recruiter/:recruiterId', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.recruiterId) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        const jobs = await Job.find({ recruiter: req.params.recruiterId });

        const jobsWithApplications = await Promise.all(
            jobs.map(async (job) => {
                const applications = await Application.find({ job: job._id })
                    .populate('user', 'name email');
                return {
                    _id: job._id,
                    title: job.title,
                    applications,
                };
            })
        );

        res.json(jobsWithApplications);
    } catch (err) {
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});






module.exports = router;
