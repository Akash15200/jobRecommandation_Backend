const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Application = require('../models/Application'); // ensure this model exists
const { protect } = require('../middleware/authMiddleware');

router.get('/analytics', protect, async (req, res) => {
    try {
        const jobs = await Job.find({ recruiter: req.user._id });

        // For each job, count applications from Application collection
        const applicationsPerJob = await Promise.all(
            jobs.map(async (job) => {
                const applicationCount = await Application.countDocuments({ job: job._id });
                return {
                    jobId: job._id,
                    title: job.title,
                    applications: applicationCount,
                };
            })
        );

        res.json({ applicationsPerJob });
    } catch (err) {
        console.error('❌ Error fetching recruiter analytics:', err);
        res.status(500).json({ msg: 'Server error fetching analytics' });
    }
});


// ✅ Skill Gap Analysis
// GET /api/recruiter/jobs/:jobId/skill-gap
router.get('/jobs/:jobId/skill-gap', protect, async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }
        if (job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized to view this job\'s skill gap' });
        }

        const applications = await Application.find({ job: job._id }).populate('user', 'skills');

        // Normalization for consistent matching
        const requiredSkills = new Set(job.requiredSkills.map(s => s.trim().toLowerCase()));
        const applicantSkills = new Set(
            applications.flatMap(app => (app.user.skills || []).map(s => s.trim().toLowerCase()))
        );

        const missingSkills = Array.from(requiredSkills).filter(skill => !applicantSkills.has(skill));

        console.log(`🔍 Skill Gap for Job (${job.title}):`, missingSkills);

        res.json({ missingSkills });
    } catch (err) {
        console.error('❌ Skill gap analysis error:', err);
        res.status(500).json({ msg: 'Server error during skill gap analysis', error: err.message });
    }
});


// GET /api/admin/recruiter/analytics
// GET /api/admin/recruiter/analytics
router.get('/recruiter/analytics', protect, async (req, res) => {
    try {
        const jobs = await Job.find({ recruiter: req.user._id });

        const data = await Promise.all(jobs.map(async (job) => {
            const applicationCount = await Application.countDocuments({ job: job._id });
            return {
                jobId: job._id,
                title: job.title,
                applicationCount,
            };
        }));

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});


// backend/routes/recruiterRoutes.js
const path = require('path');
const fs = require('fs');

router.get('/applications/:appId/download-resume', protect, async (req, res) => {
    try {
        const application = await Application.findById(req.params.appId).populate('user');
        if (!application) return res.status(404).json({ msg: 'Application not found' });

        const user = application.user;

        // Assuming you have user.resumePath stored (e.g., "uploads/resumes/abc.pdf")
        if (!user.resumePath || !fs.existsSync(user.resumePath)) {
            return res.status(404).json({ msg: 'Resume not found for this user' });
        }

        const filePath = path.resolve(user.resumePath);
        res.download(filePath, `${user.name}_Resume${path.extname(filePath)}`);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
