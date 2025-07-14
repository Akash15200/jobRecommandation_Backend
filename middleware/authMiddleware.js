const jwt = require('jsonwebtoken');
const User = require('../models/User');


const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded); // Add this temporarily for debugging

      // Adapt based on your payload shape:
      const userId = decoded.id;

      req.user = await User.findById(userId).select('-password');
      if (!req.user) {
        return res.status(401).json({ msg: 'User not found, authorization denied' });
      }

      // Add this check
      if (!req.user.isVerified) {
        return res.status(403).json({ msg: 'Please verify your email first' });
      }

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ msg: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ msg: 'No token, authorization denied' });
  }
};


const adminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ msg: 'Not authenticated' });

  // Allow both admin and super_admin
  if (['admin', 'super_admin'].includes(req.user.role)) {
    return next();
  }

  res.status(403).json({ msg: 'Admin access required' });
};

const superAdminOnly = (req, res, next) => {
  if (req.user?.role === 'super_admin') return next();
  res.status(403).json({ msg: 'Super admin access required' });
};

module.exports = { protect, adminOnly, superAdminOnly };
