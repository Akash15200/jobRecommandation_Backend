// backend/routes/jobs.js

const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { protect,adminOnly } = require('../middleware/authMiddleware'); // add if using auth



// GET /api/jobs - Get all jobs
router.get('/', async (req, res) => {
    try {
        const jobs = await Job.find({ isActive: true }).sort({ postedDate: -1 });
        res.json(jobs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

const axios = require('axios');
router.post('/', protect, async (req, res) => {
    try {
        const {
            title,
            description,
            requiredSkills,
            location,
            salary,
            type,
            experience,
            remote,
            companyName,
            recruiterName
        } = req.body;

        // Validation
        if (!title || !description || !requiredSkills || !Array.isArray(requiredSkills)) {
            return res.status(400).json({ msg: 'Title, description, and requiredSkills array are required.' });
        }

        if (!companyName || !recruiterName) {
            return res.status(400).json({ msg: 'Company name and recruiter name are required.' });
        }


        if (req.user.role !== 'recruiter') {
            return res.status(403).json({ msg: 'Only recruiters can post jobs.' });
        }

        if (req.body.status === 'accepted') {
            application.interviewDetails = req.body.interviewDetails;
            application.interviewLink = req.body.interviewLink;
        }

        // Add notes for rejected applications
        if (req.body.status === 'rejected') {
            application.notes = req.body.notes;
        }

        // Create job with all fields
        const newJob = new Job({
            title,
            description,
            requiredSkills: requiredSkills.map(skill => skill.toLowerCase().trim()),
            recruiter: req.user._id,
            location,
            salary,
            type,
            experience,
            remote,
            companyName,
            recruiterName,
            
            // isActive and postedDate have defaults in schema
        });

        const savedJob = await newJob.save();
        res.status(201).json(savedJob);
    } catch (err) {
        console.error('Post job error:', err);
        res.status(500).json({ msg: 'Server error while posting job.' });
    }
});

router.get('/myjobs', protect, async (req, res) => {
    try {
        console.log('Request user:', req.user); // 🔍 check user id and role
        if (req.user.role !== 'recruiter') {
            return res.status(403).json({ msg: 'Only recruiters can view their jobs.' });
        }
        const jobs = await Job.find({ recruiter: req.user._id });
        console.log('Jobs found:', jobs); // 🔍 check retrieved jobs
        res.json(jobs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
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

router.get('/user/:id', async (req, res) => {
    try {
        const applications = await Application.find({ user: req.params.id })
            .populate('job')
            .where('job').ne(null); // Exclude deleted jobs

        // Normalize status to lowercase
        const normalized = applications.map(app => ({
            ...app._doc,
            status: app.status.toLowerCase()
        }));

        res.json(normalized);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .select('-__v') // Exclude version key
      .lean(); // Convert to plain JavaScript object

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Ensure all fields are included
    const responseData = {
      _id: job._id,
      title: job.title,
      description: job.description,
      company: job.company || job.companyName,
      location: job.location || job.jobLocation,
      salary: job.salary || job.jobSalary,
      type: job.type || job.jobType,
      experience: job.experience || job.jobExperience,
      remote: job.remote,
      requiredSkills: job.requiredSkills,
      postedDate: job.postedDate || job.createdAt,
      recruiterName: job.recruiter?.name || job.recruiterName || 'Recruiter',
      // Include any other fields you need
    };

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.get('/recruiter/myjobs', protect, async (req, res) => {
    try {
        if (req.user.role !== 'recruiter') {
            return res.status(403).json({ 
                success: false,
                msg: 'Only recruiters can view their jobs.' 
            });
        }
        
        const jobs = await Job.find({ recruiter: req.user._id }).sort({ postedDate: -1 });
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            success: false,
            msg: 'Server error while fetching your jobs' 
        });
    }
});


router.get('/search', async (req, res) => {
    try {
        const { q, location, remote, type, experience, skills } = req.query;
        const query = { isActive: true };

        if (q) {
            query.$or = [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { companyName: { $regex: q, $options: 'i' } }
            ];
        }

        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }

        if (remote) {
            query.remote = remote === 'true';
        }

        if (type) {
            query.type = type;
        }

        if (experience) {
            query.experience = experience;
        }

        if (skills) {
            query.requiredSkills = {
                $in: skills.split(',').map(skill => new RegExp(skill.trim(), 'i'))
            };
        }

        const jobs = await Job.find(query).sort({ postedDate: -1 });
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            success: false,
            msg: 'Server error while searching jobs' 
        });
    }
});

module.exports = router;
