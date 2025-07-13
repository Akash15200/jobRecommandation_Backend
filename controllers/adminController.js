const User = require('../models/User');
const Job = require('../models/Job');

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password'); // omit passwords
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

    await user.deleteOne();
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error while deleting user' });
  }
};

// DELETE /api/admin/jobs/:id
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ msg: 'Job not found' });

    await job.deleteOne();
    res.json({ msg: 'Job deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error while deleting job' });
  }
};

module.exports = {
  getAllUsers,
  deleteUser,
  deleteJob,
};
