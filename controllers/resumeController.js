// controllers/resumeController.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const User = require('../models/User');
const Job = require('../models/Job');

// Configure upload directory
const uploadsDir = path.join(process.cwd(), 'uploads', 'resumes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created resumes directory at ${uploadsDir}`);
}

// Multer configuration
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const sanitizedFilename = file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
    cb(null, Date.now() + '-' + sanitizedFilename);
  }
});
exports.upload = multer({ storage });

// Upload and parse resume
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No resume file uploaded" });
    }

    const filePath = req.file.path;
    const formData = new FormData();
    formData.append('resume', fs.createReadStream(filePath));

    const mlResponse = await axios.post(
      `${process.env.ML_API_URL}/parse_resume`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000
      }
    );

    // Update user skills and resumePath if logged in
    if (req.user && mlResponse.data.skills) {
      const user = await User.findById(req.user.id);
      if (user.resumePath) {
        const oldPath = path.join(uploadsDir, user.resumePath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.resumePath = req.file.filename;
      user.skills = mlResponse.data.skills;
      await user.save();
    }
    
    res.json(mlResponse.data);
  } catch (err) {
    handleError(res, err, "resume upload");
  }
};

// Download resume file
exports.downloadResume = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.download(filePath, filename, (err) => {
      if (err) console.error('Download error:', err);
    });
  } catch (error) {
    handleError(res, error, "resume download");
  }
};

// Recommend jobs based on skills
exports.recommendJobs = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId).select('skills');
    
    if (!user?.skills?.length) {
      return res.status(400).json({ msg: 'User skills not found' });
    }

    const jobs = await Job.find({});
    const payload = {
      skills: user.skills,
      jobs: jobs.map(job => ({
        _id: job._id.toString(),
        title: job.title,
        requiredSkills: job.requiredSkills
      }))
    };

    const mlResponse = await axios.post(
      `${process.env.ML_API_URL}/match_jobs`,
      payload,
      { timeout: 10000 }
    );

    res.json(mlResponse.data);
  } catch (err) {
    handleError(res, err, "job recommendation");
  }
};

// Error handling helper
function handleError(res, err, context) {
  console.error(`❌ ${context} error:`, err.message);
  
  if (err.response) {
    res.status(500).json({
      msg: `Request failed (API error)`,
      error: err.response.data
    });
  } else if (err.request) {
    res.status(500).json({ msg: 'No response from service' });
  } else {
    res.status(500).json({ 
      msg: `${context} failed`, 
      error: err.message 
    });
  }
}