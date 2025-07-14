const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user ID - check both possible payload structures
      const userId = decoded.user?.id || decoded.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid token payload' 
        });
      }

      // Find user
      const user = await User.findById(userId).select('-password');
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'User not found' 
        });
      }

      // Check verification status
      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          error: 'Please verify your email first'
        });
      }

      // Attach user to request
      req.user = user;
      next();

    } catch (error) {
      console.error('Token verification failed:', error.message);
      res.status(401).json({ 
        success: false,
        error: 'Not authorized, token failed' 
      });
    }
  } else {
    res.status(401).json({ 
      success: false,
      error: 'No token provided' 
    });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ msg: 'Not authenticated' });

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
