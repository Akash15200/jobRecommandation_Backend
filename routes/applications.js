const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const applicationController = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');
const { sendInterviewEmail } = require('../utils/email');
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/uploadMiddleware');
const mongoose = require('mongoose');

// ------------------------
// POST /api/applications/calculate-fit
// ------------------------
router.post('/calculate-fit', async (req, res) => {
    const { resumeSkills, jobId } = req.body;
    try {
        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ msg: 'Job not found' });

        const requiredSkills = job.requiredSkills || [];
        const matchedSkills = resumeSkills.filter(skill => requiredSkills.includes(skill));
        const score = Math.round((matchedSkills.length / requiredSkills.length) * 100);

        res.json({ score });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while calculating fit score' });
    }
});

// ------------------------
// POST /api/applications
// ------------------------
router.post('/', protect, async (req, res) => {
    try {
        const { jobId, fitScore } = req.body;
        const userId = req.user._id; // Get from auth middleware

        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: 'jobId is required'
            });
        }

        // Check for existing application
        const existingApp = await Application.findOne({
            user: userId,
            job: jobId
        });

        if (existingApp) {
            return res.status(400).json({
                success: false,
                error: 'You have already applied to this job'
            });
        }

        const user = await User.findById(userId);
        if (!user.resumePath) {
            return res.status(400).json({
                success: false,
                error: 'Please upload your resume before applying'
            });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        const application = new Application({
            user: userId,
            job: jobId,
            fitScore,
            resumePath: user.resumePath,
            status: 'pending'
        });

        await application.save();

        res.status(201).json({
            success: true,
            application
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: 'Server error while creating application'
        });
    }
});

// ------------------------
// GET /api/applications/recruiter/:recruiterId
// ------------------------
router.get('/recruiter/:recruiterId', async (req, res) => {
    try {
        const jobs = await Job.find({ recruiter: req.params.recruiterId });
        const jobIds = jobs.map(job => job._id);

        const applications = await Application.find({ job: { $in: jobIds } })
            .populate('user', 'name email skills resumePath')
            .populate('job', 'title');

        res.json(applications);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error while fetching recruiter applications');
    }
});

// ------------------------
// PUT /api/applications/:id/status
// ------------------------
router.put('/:id/status', protect, async (req, res) => {
    try {
        let { status, notes } = req.body;

        if (status === 'approved') {
            status = 'interview_scheduled';
        }

        if (!['pending', 'interview_scheduled', 'hired', 'rejected'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status' });
        }

        const app = await Application.findById(req.params.id).populate('user job');
        if (!app) return res.status(404).json({ msg: 'Application not found' });

        app.status = status;
        if (notes !== undefined) app.notes = notes;

        await app.save();

        res.json({ msg: 'Status updated successfully', application: app });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error while updating status', error: err.message });
    }
});

// ------------------------
// GET /api/applications/user/:id
// ------------------------
router.get('/user/:id', async (req, res) => {
    try {
        const applications = await Application.find({ user: req.params.id })
            .populate('job')
            .where('job').ne(null);

        const normalized = applications.map(app => ({
            ...app._doc,
            status: app.status === 'interview_scheduled' ? 'approved' : app.status.toLowerCase()
        }));

        res.json(normalized);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ------------------------
// GET /api/applications/:id
// ------------------------
router.get('/:id', applicationController.getApplicationById);
// In your jobs router (backend)
// router.get('/:id', async (req, res) => {
//   try {
//     const job = await Job.findById(req.params.id)
//       .select('-__v') // Exclude version key
//       .lean(); // Convert to plain JavaScript object

//     if (!job) {
//       return res.status(404).json({ success: false, error: 'Job not found' });
//     }

//     // Ensure all fields are included
//     const responseData = {
//       _id: job._id,
//       title: job.title,
//       description: job.description,
//       company: job.company || job.companyName,
//       location: job.location || job.jobLocation,
//       salary: job.salary || job.jobSalary,
//       type: job.type || job.jobType,
//       experience: job.experience || job.jobExperience,
//       remote: job.remote,
//       requiredSkills: job.requiredSkills,
//       postedDate: job.postedDate || job.createdAt,
//       // Include any other fields you need
//     };

//     res.json({ success: true, data: responseData });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: 'Server error' });
//   }
// });

// ------------------------
// PUT /api/applications/:appId/schedule-interview
// ------------------------
// PUT /api/applications/:appId/schedule-interview
router.put('/:appId/schedule-interview', protect, async (req, res) => {
    try {
        const { interviewDate } = req.body;
        if (!interviewDate) return res.status(400).json({ msg: 'Interview date required' });

        const app = await Application.findById(req.params.appId)
            .populate('user', 'email name')
            .populate('job', 'title');
        
        if (!app) return res.status(404).json({ msg: 'Application not found' });

        // Generate a simple interview link
        const interviewLink = `https://meet.google.com/${Math.random().toString(36).substring(2, 10)}`;

        app.interviewDate = new Date(interviewDate);
        app.interviewLink = interviewLink;
        app.status = 'interview_scheduled';
        await app.save();

        try {
            await sendInterviewEmail(
                app.user.email,
                app.user.name,
                app.job.title,
                app.interviewDate,
                app.interviewLink
            );
            
            res.json({ 
                msg: 'Interview scheduled and email sent', 
                application: app 
            });
        } catch (emailError) {
            console.error('Email failed but interview was scheduled:', emailError);
            res.status(200).json({ 
                msg: 'Interview scheduled but email failed to send',
                application: app,
                warning: 'Email service issue'
            });
        }

    } catch (err) {
        console.error('Interview scheduling error:', err);
        res.status(500).json({ 
            msg: 'Server error while scheduling interview', 
            error: err.message 
        });
    }
});

// ------------------------
// GET /api/applications/:applicationId/download-resume
// ------------------------
router.get('/:applicationId/download-resume', protect, async (req, res) => {
    try {
        const application = await Application.findById(req.params.applicationId).populate('user');
        if (!application) return res.status(404).json({ msg: 'Application not found' });

        const resumeFilename = application.resumePath;
        const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
        const resumePath = path.join(uploadDir, resumeFilename);

        if (!fs.existsSync(resumePath)) {
            return res.status(404).json({ msg: 'Resume file not found on server' });
        }

        const ext = path.extname(resumeFilename);
        const cleanedName = `${application.user.name.replace(/\s+/g, '_')}_Resume${ext}`;

        res.download(resumePath, cleanedName);
    } catch (err) {
        console.error('❌ Resume download error:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});


router.get('/check', protect, async (req, res) => {
    try {
        const { jobId } = req.query;
        const userId = req.user._id; // Get from auth middleware

        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: 'jobId is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid jobId'
            });
        }

        const application = await Application.findOne({
            user: userId,
            job: jobId
        }).populate('job', 'title companyName');

        res.json({
            success: true,
            data: application || null
        });
    } catch (err) {
        console.error('Check application error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error while checking application',
            details: err.message
        });
    }
});


router.delete('/:id', protect, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }

        if (req.user.role !== 'recruiter' || job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized to delete this job.' });
        }

        // FIX: Replace deprecated remove() with deleteOne()
        await Job.deleteOne({ _id: req.params.id });

        res.json({ msg: 'Job removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error while deleting job.' });
    }
});
module.exports = router;
