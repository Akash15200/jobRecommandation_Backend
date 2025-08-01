const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// User registration
router.post('/register', authController.register);

// Get current user
router.get('/user', protect, authController.getCurrentUser);

// User login
router.post('/login', authController.login);

// Verify OTP
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;