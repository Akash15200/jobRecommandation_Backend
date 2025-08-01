const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Course = require('../models/Course');
const AdminInvite = require('../models/AdminInvite');
const AdminLog = require('../models/AdminLog');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { logAdminAction } = require('../utils/adminLogger');

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error while fetching users' });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(403).json({ msg: 'Cannot delete your own account' });
    }

    // If user is recruiter, delete their jobs
    if (user.role === 'recruiter') {
      await Job.deleteMany({ recruiter: user._id });
    }

    await logAdminAction(req.user.id, 'DELETE_USER', user._id, {
      deletedUser: user.email,
      role: user.role
    });

    await user.deleteOne();
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      msg: 'Server error while deleting user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// PATCH /api/admin/users/:id/role
const changeUserRole = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // If changing from recruiter to non-recruiter, unassign their jobs
    if (user.role === 'recruiter' && req.body.role !== 'recruiter') {
      await Job.updateMany({ recruiter: user._id }, { $set: { recruiter: null } });
    }

    user.role = req.body.role;
    await user.save();

    // await logAdminAction(req.user.id, 'CHANGE_ROLE', user._id, {
    //   oldRole: user.role,
    //   newRole: req.body.role
    // });

    res.json({ msg: 'Role updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/admin/jobs
const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find().populate('recruiter', 'name email');
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error while fetching jobs' });
  }
};

// DELETE /api/admin/jobs/:id
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: 'Job not found' });

    await logAdminAction(req.user.id, 'DELETE_JOB', job._id, {
      jobTitle: job.title,
      company: job.company
    });

    await job.deleteOne();
    res.json({ msg: 'Job deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      msg: 'Server error while deleting job',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET /api/admin/metrics
const getPlatformMetrics = async (req, res) => {
  try {
    const [totalUsers, totalJobs, totalRecruiters, totalStudents] = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      User.countDocuments({ role: 'recruiter' }),
      User.countDocuments({ role: 'student' })
    ]);

    res.json({
      totalUsers,
      totalJobs,
      totalRecruiters,
      totalStudents,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error while fetching metrics' });
  }
};

// GET /api/admin/analyticsCard
const getAnalyticsCard = async (req, res) => {
  try {
    const r = req.query.range || "all";
    const now = new Date();
    let startDate;

    // Set date range based on query
    switch (r) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(0);
    }

    const metrics = await Promise.all([
      User.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      Course.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'recruiter' }),
      User.countDocuments({ role: 'admin' }),
      User.aggregate([
        { $unwind: "$lastLogin" },
        { $match: { lastLogin: { $gte: startDate, $lte: new Date() } } },
        { $group: { _id: { $dayOfWeek: "$lastLogin" }, count: { $sum: 1 } } }
      ])
    ]);

    // Format user activity data
    const dayMap = { 1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat" };
    const userActivity = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({
      name: day,
      active: metrics[7].find(d => dayMap[d._id] === day)?.count || 0
    }));

    res.json({
      totalUsers: metrics[0],
      activeJobs: metrics[1],
      totalApplications: metrics[2],
      totalCourses: metrics[3],
      studentCount: metrics[4],
      recruiterCount: metrics[5],
      adminCount: metrics[6],
      userActivity
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// GET /api/admin/users/:userId/analytics
const getUserAnalytics = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const baseAnalytics = {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastActive: user.lastLogin?.length > 0 ? user.lastLogin[user.lastLogin.length - 1] : user.updatedAt,
      createdAt: user.createdAt,
      skills: user.skills || [],
      profileCompleted: calculateProfileCompletion(user)
    };

    let analytics = { ...baseAnalytics };

    // Role-specific analytics
    if (user.role === 'student') {
      const [coursesEnrolled, jobsApplied, jobsRejected, jobsInterviewed] = await Promise.all([
        Course.countDocuments({ students: user._id }),
        Application.countDocuments({ user: user._id }),
        Application.countDocuments({ user: user._id, status: 'rejected' }),
        Application.countDocuments({ user: user._id, status: 'interview_scheduled' })
      ]);

      analytics = {
        ...analytics,
        coursesEnrolled,
        jobsApplied,
        jobsRejected,
        jobsInterviewed,
        rejectionRate: jobsApplied > 0 ? Math.round((jobsRejected / jobsApplied) * 100) : 0,
        interviewRate: jobsApplied > 0 ? Math.round((jobsInterviewed / jobsApplied) * 100) : 0
      };
    }
    else if (user.role === 'recruiter') {
      const jobs = await Job.find({ recruiter: user._id });
      const jobIds = jobs.map(job => job._id);

      const [jobsPosted, applicationsReceived, rejected, interviewsScheduled] = await Promise.all([
        jobs.length,
        Application.countDocuments({ job: { $in: jobIds } }),
        Application.countDocuments({ job: { $in: jobIds }, status: 'rejected' }),
        Application.countDocuments({ job: { $in: jobIds }, status: 'interview_scheduled' })
      ]);

      analytics = {
        ...analytics,
        jobsPosted,
        totalApplications: applicationsReceived,
        rejected,
        interviewsScheduled,
        rejectionRate: applicationsReceived > 0 ? Math.round((rejected / applicationsReceived) * 100) : 0,
        interviewRate: applicationsReceived > 0 ? Math.round((interviewsScheduled / applicationsReceived) * 100) : 0
      };
    }

    // Add recent activities for all roles
    const recentActivities = await AdminLog.find({
      $or: [
        { admin: user._id },
        { 'metadata.userId': user._id.toString() }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({ ...analytics, recentActivities });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({
      msg: 'Error fetching analytics',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(user) {
  const fields = [
    user.name,
    user.skills?.length > 0,
    user.resumePath,
    user.profilePicture,
    user.bio
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

// POST /api/admin/invite
const sendAdminInvite = async (req, res) => {
  try {
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await AdminInvite.create({
      email,
      token,
      expiresAt,
      createdBy: req.user.id
    });

    await logAdminAction(req.user.id, 'SEND_INVITE', null, { email });

    res.json({ msg: 'Admin invite sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/admin/accept-invite
const acceptAdminInvite = async (req, res) => {
  try {
    const invite = await AdminInvite.findOne({
      token: req.body.token,
      email: req.user.email,
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!invite) return res.status(400).json({ msg: 'Invalid or expired token' });

    const user = await User.findById(req.user.id);
    user.role = 'admin';
    await user.save();

    invite.used = true;
    await invite.save();

    res.json({ msg: 'Admin privileges granted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// GET /api/admin/jobs/:jobId/details
const getJobDetails = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId)
      .populate('recruiter', 'name email')
      .lean();

    if (!job) return res.status(404).json({ message: 'Job not found' });

    const applications = await Application.find({ job: job._id })
      .populate('user', 'name email skills')
      .lean();

    // Calculate match scores
    const applicationsWithScores = applications.map(app => {
      const jobSkills = job.requiredSkills || [];
      const userSkills = app.user?.skills || [];
      const matchScore = jobSkills.length > 0
        ? Math.round((jobSkills.filter(s => userSkills.includes(s)).length / jobSkills.length) * 100)
        : 0;

      return { ...app, matchScore };
    });

    // Get top 5 applicants
    const topApplicants = [...applicationsWithScores]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5)
      .map(app => ({
        name: app.user?.name || 'Anonymous',
        email: app.user?.email || '',
        matchScore: app.matchScore,
        status: app.status
      }));

    res.json({
      ...job,
      applications: applications.length,
      averageMatchScore: applicationsWithScores.length > 0
        ? Math.round(applicationsWithScores.reduce((sum, app) => sum + app.matchScore, 0) / applicationsWithScores.length)
        : 0,
      topApplicants
    });
  } catch (err) {
    console.error('Job details error:', err);
    res.status(500).json({
      msg: 'Error fetching job details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET /api/admin/logs
const getAdminLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const logs = await AdminLog.find()
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const count = await AdminLog.countDocuments();

    res.json({
      logs,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  getAllUsers,
  deleteUser,
  changeUserRole,
  getAllJobs,
  deleteJob,
  getPlatformMetrics,
  getAnalyticsCard,
  getUserAnalytics,
  sendAdminInvite,
  acceptAdminInvite,
  getJobDetails,
  getAdminLogs
};