const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

// Ensure uploads folder exists - fixed path
const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`✅ Created resumes directory at ${uploadDir}`);
}

// Multer setup with corrected storage path
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Sanitize filename
        const sanitizedFilename = file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
        cb(null, Date.now() + '-' + sanitizedFilename);
    }
});
const upload = multer({ storage });

// -------------------------------
// POST /api/resumes
// Upload and parse resume via ML API
// -------------------------------
router.post('/', protect, upload.single('resume'), async (req, res) => {
    console.log("✅ Upload route triggered");

    try {
        if (!req.file) {
            return res.status(400).json({ msg: "No resume file uploaded" });
        }

        const filePath = req.file.path;
        console.log("✅ File saved at:", filePath);

        const formData = new FormData();
        formData.append('resume', fs.createReadStream(filePath));

        console.log("✅ Sending file to ML API:", process.env.ML_API_URL);

        const mlResponse = await axios.post(
            `${process.env.ML_API_URL}/parse_resume`,
            formData,
            {
                headers: formData.getHeaders(),
                timeout: 60000
            }
        );
        console.log("✅ ML API response:", mlResponse.data);
        console.log("✅ User :", req.user);
        // Update user skills and resumePath if logged in
        if (req.user && mlResponse.data.skills) {
            const user = await User.findById(req.user.id);

            // Delete old resume if exists
            if (user.resumePath) {
                const oldPath = path.join(uploadDir, user.resumePath);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            // Store only the filename (not full path)
            user.resumePath = req.file.filename;
            user.skills = mlResponse.data.skills;
            await user.save();
        }
        res.json(mlResponse.data);
    } catch (err) {
        if (err.response) {
            console.error("❌ ML API error:", err.response.status, err.response.data);
            res.status(500).json({
                msg: "Resume parsing failed (ML API error)",
                error: err.response.data
            });
        } else if (err.request) {
            console.error("❌ No response from ML API:", err.request);
            res.status(500).json({ msg: "No response from ML API" });
        } else {
            console.error("❌ Resume parsing error:", err.message);
            res.status(500).json({ msg: "Resume parsing failed", error: err.message });
        }
    }
});

// -------------------------------
// POST /api/resume/recommend-jobs
// Recommend jobs based on user skills
// -------------------------------
router.post('/recommend-jobs', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId).select('skills');

        if (!user || !user.skills || user.skills.length === 0) {
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
        console.error("❌ Job recommendation error:", err.message);
        res.status(500).json({ msg: "Job recommendation failed", error: err.message });
    }
});



module.exports = router;