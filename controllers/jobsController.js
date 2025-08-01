const Job = require('../models/Job');
const Application = require('../models/Application');

// Get all active jobs
exports.getAllJobs = async (req, res) => {
    try {
        const jobs = await Job.find({ isActive: true }).sort({ postedDate: -1 });
        res.json(jobs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
};

// Create new job
exports.createJob = async (req, res) => {
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
        });

        const savedJob = await newJob.save();
        res.status(201).json(savedJob);
    } catch (err) {
        console.error('Post job error:', err);
        res.status(500).json({ msg: 'Server error while posting job.' });
    }
};

// Get recruiter's jobs
exports.getMyJobs = async (req, res) => {
    try {
        if (req.user.role !== 'recruiter') {
            return res.status(403).json({ msg: 'Only recruiters can view their jobs.' });
        }
        const jobs = await Job.find({ recruiter: req.user._id });
        res.json(jobs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
};

// Delete job
exports.deleteJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }

        if (req.user.role !== 'recruiter' || job.recruiter.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: 'Not authorized to delete this job.' });
        }

        await Job.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Job removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error while deleting job.' });
    }
};

// Get user applications
exports.getUserApplications = async (req, res) => {
    try {
        const applications = await Application.find({ user: req.params.id })
            .populate('job')
            .where('job').ne(null);

        const normalized = applications.map(app => ({
            ...app._doc,
            status: app.status.toLowerCase()
        }));

        res.json(normalized);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get single job by ID
exports.getJobById = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id)
            .select('-__v')
            .lean();

        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' });
        }

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
        };

        res.json({ success: true, data: responseData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Get recruiter's jobs (alternative endpoint)
exports.getRecruiterJobs = async (req, res) => {
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
};

// Search jobs
exports.searchJobs = async (req, res) => {
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
};