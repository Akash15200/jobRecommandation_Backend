// controllers/recruiterController.js
const Job = require('../models/Job');
const Application = require('../models/Application');
const fs = require('fs');
const path = require('path');

// Get recruiter analytics
exports.getAnalytics = async (req, res) => {
    try {
        const jobs = await Job.find({ recruiter: req.user._id });

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
};

// Skill gap analysis
exports.skillGapAnalysis = async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);
        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }
        if (job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized to view this job\'s skill gap' });
        }

        const applications = await Application.find({ job: job._id }).populate('user', 'skills');

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
};

// Get recruiter analytics for admin
exports.getRecruiterAnalytics = async (req, res) => {
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
};

// Download resume
exports.downloadResume = async (req, res) => {
    try {
        const application = await Application.findById(req.params.appId).populate('user');
        if (!application) return res.status(404).json({ msg: 'Application not found' });

        const user = application.user;

        if (!user.resumePath || !fs.existsSync(user.resumePath)) {
            return res.status(404).json({ msg: 'Resume not found for this user' });
        }

        const filePath = path.resolve(user.resumePath);
        res.download(filePath, `${user.name}_Resume${path.extname(filePath)}`);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
};

// View applicants for a job
exports.getJobApplicants = async (req, res) => {
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
};

// Edit job
exports.updateJob = async (req, res) => {
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
};

// Toggle job active status
exports.toggleJobActive = async (req, res) => {
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
};

// Get recruiter dashboard data
exports.getRecruiterDashboard = async (req, res) => {
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
};