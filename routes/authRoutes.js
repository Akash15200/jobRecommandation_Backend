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

// Forgot Password
router.post('/forgot-password', authController.forgotPassword);

// Reset Password
router.put('/reset-password/:token', authController.resetPassword);

module.exports = router;