const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const crypto = require('crypto');
const AdminInvite = require('../models/AdminInvite');
const Course = require('../models/Course');
const AdminLog = require('../models/AdminLog');
const mongoose = require('mongoose');
const logAdminAction = require('../utils/adminLogger');
// Get all users
router.get('/users', protect, adminOnly, async (req, res) => {
    const users = await User.find().select('-password');
    res.json(users);
});

// Get all jobs
router.get('/jobs', protect, adminOnly, async (req, res) => {
    const jobs = await Job.find().populate('recruiter', 'name email');
    res.json(jobs);
});

// Get platform metrics
router.get('/metrics', protect, adminOnly, async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalJobs = await Job.countDocuments();
    const totalRecruiters = await User.countDocuments({ role: 'recruiter' });
    const totalStudents = await User.countDocuments({ role: 'student' });

    res.json({
        totalUsers,
        totalJobs,
        totalRecruiters,
        totalStudents,
    });
});

router.delete('/users/:id', protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Additional check - prevent deleting yourself
        if (user._id.toString() === req.user.id) {
            return res.status(403).json({ msg: 'Cannot delete your own account' });
        }

        // If user is a recruiter, handle their jobs
        if (user.role === 'recruiter') {
            await Job.deleteMany({ recruiter: user._id });
        }

        await logAdminAction(req.user.id, 'DELETE_USER', user._id, {
            deletedUser: user.email,
            role: user.role
        });

        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User deleted successfully' });

    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({
            msg: 'Server error while deleting user',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Change user role
router.patch('/users/:id/role', protect, adminOnly, async (req, res) => {
    const { role } = req.body;
    const { id } = req.params;

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // If changing from recruiter to non-recruiter
        if (user.role === 'recruiter' && role !== 'recruiter') {
            await Job.updateMany({ recruiter: id }, { $set: { recruiter: null } });
        }

        user.role = role;
        await user.save();

        await logAdminAction(req.user.id, 'CHANGE_ROLE', user._id, {
            oldRole: user.role,
            newRole: req.body.role
        });

        res.json({ msg: 'Role updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});


// Delete job
router.delete('/jobs/:id', protect, adminOnly, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ msg: 'Job not found' });
        }

        await logAdminAction(req.user.id, 'DELETE_JOB', job._id, {
            jobTitle: job.title,
            company: job.company
        });

        await Job.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Job deleted successfully' });

    } catch (err) {
        console.error('Delete job error:', err);
        res.status(500).json({
            msg: 'Server error while deleting job',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


const Application = require('../models/Application');

router.get('/analyticsCard', protect, async (req, res) => {
    try {
        const r = req.query.range; // "week", "month", "year"
        console.log("Range filter:", r);

        const now = new Date();
        let startDate;

        if (r === "week") {
            startDate = new Date();
            startDate.setDate(now.getDate() - 7);
        } else if (r === "month") {
            startDate = new Date();
            startDate.setMonth(now.getMonth() - 1);
        } else if (r === "year") {
            startDate = new Date();
            startDate.setFullYear(now.getFullYear() - 1);
        } else {
            startDate = new Date(0); // all time
        }

        // Metrics
        const [totalUsers, activeJobs, totalApplications, totalCourses, studentCount, recruiterCount, adminCount] = await Promise.all([
            User.countDocuments(),
            Job.countDocuments(),
            Application.countDocuments(),
            Course.countDocuments(),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'recruiter' }),
            User.countDocuments({ role: 'admin' })
        ]);

        // User activity analytics: Count logins per day of week within the date range
        const userActivityRaw = await User.aggregate([
            { $unwind: "$lastLogin" },
            {
                $match: {
                    lastLogin: { $gte: startDate, $lte: now }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: "$lastLogin" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Map MongoDB's day numbers to readable days:
        const dayMap = {
            1: "Sun",
            2: "Mon",
            3: "Tue",
            4: "Wed",
            5: "Thu",
            6: "Fri",
            7: "Sat"
        };

        // Prepare frontend-friendly data:
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const userActivity = days.map(day => ({
            name: day,
            active: 0
        }));

        userActivityRaw.forEach(item => {
            const dayName = dayMap[item._id];
            const dayIndex = userActivity.findIndex(d => d.name === dayName);
            if (dayIndex !== -1) {
                userActivity[dayIndex].active = item.count;
            }
        });

        res.json({
            totalUsers,
            activeJobs,
            totalApplications,
            totalCourses,
            studentCount,
            recruiterCount,
            adminCount,
            userActivity // ✅ for your BarChart
        });
    } catch (err) {
        console.error("❌ Error fetching recruiter analytics:", err);
        res.status(500).json({ msg: "Server error" });
    }
});



// ✅ Analytics: total jobs, total applications, applications per job
router.get('/analytics', protect, async (req, res) => {
    try {

        const jobs = await Job.find({ recruiter: req.user._id });
        const applicationsPerJob = await Promise.all(jobs.map(async (job) => {
            const count = await Applicant.countDocuments({ job: job._id });
            return {
                jobId: job._id,
                title: job.title,
                applications: count
            };
        }));

        const totalApplications = applicationsPerJob.reduce((acc, curr) => acc + curr.applications, 0);

        res.json({
            totalJobs: jobs.length,
            totalApplications,
            applicationsPerJob
        });
    } catch (err) {
        console.error("❌ Error fetching recruiter analytics:", err);
        res.status(500).json({ msg: "Server error" });
    }
});

router.get('/users/:userId/analytics', protect, adminOnly, async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userRole = user.role.toLowerCase();
        const lastLogin=user.lastLogin;

        // Base analytics for all users
        const baseAnalytics = {
            userId: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            lastActive : lastLogin.length > 0
                ? lastLogin[lastLogin.length - 1]
                : user.updatedAt,
            createdAt: user.createdAt,
            skills: user.skills || [],
            profileCompleted: calculateProfileCompletion(user) 
        };

        // Role-specific analytics
        let roleAnalytics = {};

        if (userRole === 'student') {
            const [coursesEnrolled, jobsApplied, jobsRejected, jobsInterviewed] = await Promise.all([
                Course.countDocuments({ students: userId }),
                Application.countDocuments({ user: userId }),
                Application.countDocuments({ user: userId, status: 'rejected' }),
                Application.countDocuments({ user: userId, status: 'interview_scheduled' })
            ]);

            roleAnalytics = {
                ...baseAnalytics,
                coursesEnrolled,
                jobsApplied,
                jobsRejected,
                jobsInterviewed,
                rejectionRate: jobsApplied > 0 ? Math.round((jobsRejected / jobsApplied) * 100) : 0,
                interviewRate: jobsApplied > 0 ? Math.round((jobsInterviewed / jobsApplied) * 100) : 0
            };
        }
        else if (userRole === 'recruiter') {
            const recruiterId = new mongoose.Types.ObjectId(userId);
            const jobs = await Job.find({ recruiter: recruiterId }).select('_id');
            const jobIds = jobs.map(job => job._id);

            const [jobsPosted, applicationsReceived, rejectedApplications, interviewsScheduled] = await Promise.all([
                jobs.length,
                Application.countDocuments({ job: { $in: jobIds } }),
                Application.countDocuments({ job: { $in: jobIds }, status: 'rejected' }),
                Application.countDocuments({ job: { $in: jobIds }, status: 'interview_scheduled' })
            ]);

            roleAnalytics = {
                ...baseAnalytics,
                jobsPosted,
                totalApplications: applicationsReceived,
                rejected: rejectedApplications,
                interviewsScheduled,
                rejectionRate: applicationsReceived > 0 ? Math.round((rejectedApplications / applicationsReceived) * 100) : 0,
                interviewRate: applicationsReceived > 0 ? Math.round((interviewsScheduled / applicationsReceived) * 100) : 0
            };
        }
        else if (userRole === 'admin') {
            const adminId = new mongoose.Types.ObjectId(userId);

            // Admin-specific metrics
            const [actionsTaken, usersManaged, recentActions] = await Promise.all([
                AdminLog.countDocuments({ admin: adminId }),
                User.countDocuments({ $or: [{ createdBy: userId }, { roleChangedBy: userId }] }),
                AdminLog.find({ admin: adminId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('target', 'name email title')
                    .lean()
            ]);

            // Platform-wide metrics (only for admins)
            const platformMetrics = await getPlatformMetrics();

            roleAnalytics = {
                ...baseAnalytics,
                // Admin-specific
                actionsTaken,
                usersManaged,
                recentActions,

                // Platform-wide metrics
                platformMetrics
            };
        } else {
            return res.status(400).json({ message: 'Invalid user role' });
        }

        // Add last 5 activities for all roles
        const recentActivities = await AdminLog.find({
            $or: [
                { admin: userId },
                { 'metadata.userId': userId }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const response = {
            ...roleAnalytics,
            recentActivities
        };


        res.json(response);

    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching analytics',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Helper function to get platform metrics
async function getPlatformMetrics() {
    const [
        totalUsers,
        totalStudents,
        totalRecruiters,
        totalAdmins,
        totalJobs,
        activeJobs,
        totalApplications,
        coursesCount
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'recruiter' }),
        User.countDocuments({ role: 'admin' }),
        Job.countDocuments(),
        Job.countDocuments({ isActive: true }),
        Application.countDocuments(),
        Course.countDocuments()
    ]);

    return {
        totalUsers,
        totalStudents,
        totalRecruiters,
        totalAdmins,
        totalJobs,
        activeJobs,
        inactiveJobs: totalJobs - activeJobs,
        totalApplications,
        coursesCount,
        avgApplicationsPerJob: totalJobs > 0 ? (totalApplications / totalJobs).toFixed(2) : 0
    };
}

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(user) {
    let completedFields = 0;
    const totalFields = 5; // Adjust based on your important fields

    if (user.name) completedFields++;
    if (user.skills?.length > 0) completedFields++;
    if (user.resumePath) completedFields++;
    if (user.profilePicture) completedFields++;
    if (user.bio) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
}

router.post('/admin/invite', protect, adminOnly, async (req, res) => {
    try {
        const { email } = req.body;
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Save to database
        await logAdminAction(req.user.id, 'SEND_INVITE', null, {
            inviteEmail: email,
            token: token
        });
        await AdminInvite.create({ email, token, expiresAt, createdBy: req.user.id });

        // In production: Send email with token link
        res.json({ msg: 'Admin invite sent' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/admin/accept-invite', protect, async (req, res) => {
    try {
        const { token } = req.body;

        // Verify token
        const invite = await AdminInvite.findOne({
            token,
            email: req.user.email,
            expiresAt: { $gt: new Date() }
        });

        if (!invite) return res.status(400).json({ msg: 'Invalid or expired token' });

        // Elevate user
        const user = await User.findById(req.user.id);
        user.role = 'admin';
        await user.save();

        // Mark invite as used
        invite.used = true;
        await invite.save();

        res.json({ msg: 'Admin privileges granted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/jobs/:jobId/details', protect, adminOnly, async (req, res) => {
    try {
        const jobId = req.params.jobId;

        // Get job details
        const job = await Job.findById(jobId)
            .populate('recruiter', 'name email')
            .lean();

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Get applications for this job
        const applications = await Application.find({ job: jobId })
            .populate('user', 'name email skills')
            .lean();

        // Calculate match scores (example - you might have your own algorithm)
        const applicationsWithScores = applications.map(app => {
            // Simple example: count matching skills between job and applicant
            const jobSkills = job.requiredSkills || [];
            const userSkills = app.user?.skills || [];
            const matchingSkills = jobSkills.filter(skill =>
                userSkills.includes(skill)
            );
            const matchScore = jobSkills.length > 0
                ? Math.round((matchingSkills.length / jobSkills.length) * 100)
                : 0;

            return {
                ...app,
                matchScore
            };
        });

        // Sort by match score (highest first)
        const sortedApplications = [...applicationsWithScores].sort((a, b) =>
            b.matchScore - a.matchScore
        );

        // Get top 5 applicants
        const topApplicants = sortedApplications.slice(0, 5).map(app => ({
            name: app.user?.name || 'Anonymous',
            email: app.user?.email || '',
            matchScore: app.matchScore,
            status: app.status
        }));

        // Calculate average match score
        const averageMatchScore = applicationsWithScores.length > 0
            ? Math.round(applicationsWithScores.reduce((sum, app) => sum + app.matchScore, 0) / applicationsWithScores.length)
            : 0;

        res.json({
            ...job,
            applications: applications.length,
            averageMatchScore,
            topApplicants
        });

    } catch (err) {
        console.error('Job details error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching job details',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


router.get('/admin/logs', protect, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const logs = await AdminLog.find()
            .populate('admin', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await AdminLog.countDocuments();

        res.json({
            logs,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;


