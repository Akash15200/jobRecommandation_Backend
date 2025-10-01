const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail,sendPasswordResetEmail } = require('../utils/email');

const otpStore = new Map();

// User registration
exports.register = async (req, res) => {
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
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// User login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 2. Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 3. Check if verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email first'
      });
    }

    // 4. Update last login
    user.lastLogin.push([new Date()]);
    await user.save();
    
    // 5. Create token payload
    const payload = {
      user: {
        id: user._id.toString(),  // Explicit conversion
        role: user.role
      }
    };

    // 6. Generate token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' }
    );

    // 7. Send response
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        // Include other necessary fields
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// Verify OTP and complete registration
exports.verifyOtp = async (req, res) => {
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
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ msg: 'User with that email does not exist' });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to user
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes

    await user.save({ validateBeforeSave: false });

    // Create reset url that points to the frontend application
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please click on the following link, or paste it into your browser to complete the process: \n\n ${resetUrl} \n\nIf you did not request this, please ignore this email and your password will remain unchanged.`;

    try {
      await sendPasswordResetEmail({
        email: user.email,
        subject: 'Password Reset Token',
        message,
      });

      res.status(200).json({ success: true, msg: 'Email sent successfully' });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ msg: 'Email could not be sent' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   PUT /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      msg: 'Password updated successfully',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};