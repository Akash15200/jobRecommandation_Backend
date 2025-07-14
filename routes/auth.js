const express = require('express');
const router = express.Router();
// const express = require('express');
// const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/email');
const crypto = require('crypto');

const otpStore = new Map();
// User registration
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  // Block any admin role assignment during registration
  if (role === 'admin' || role === 'super_admin') {
    return res.status(403).json({ msg: 'Cannot register as admin' });
  }

  if (password.length < 8) {
    return res.status(400).json({ msg: 'Password must be at least 8 characters long' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Store OTP temporarily
    otpStore.set(email, { otp, otpExpiry });

    // Send verification email
    await sendVerificationEmail(email, name, otp);

    // Respond without creating user yet
    res.json({ 
      msg: 'Verification OTP sent to your email', 
      email,
      nextStep: 'verify-otp'
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

const { protect } = require('../middleware/authMiddleware');

// GET /api/auth/user - Get current user
router.get('/user', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});


// User login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    // CORRECTED: Use consistent payload structure
    const payload = {
      id: user.id, // Top-level ID field
      role: user.role
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) throw err;

        res.json({
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            skills: user.skills,
            resumePath: user.resumePath,
            lastLogin: user.lastLogin
          }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Verify OTP and complete registration
router.post('/verify-otp', async (req, res) => {
  const { email, otp, name, password, role } = req.body;

  try {
    const storedOtpData = otpStore.get(email);
    
    if (!storedOtpData) {
      return res.status(400).json({ msg: 'OTP expired or invalid' });
    }

    const { otp: storedOtp, otpExpiry } = storedOtpData;

    if (new Date() > otpExpiry) {
      otpStore.delete(email);
      return res.status(400).json({ msg: 'OTP expired' });
    }

    if (otp !== storedOtp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    // OTP verified, create user
    const user = new User({ name, email, password, role, isVerified: true });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    otpStore.delete(email); // Clean up

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});



module.exports = router;