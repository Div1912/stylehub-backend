const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate user using JWT token
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No authentication token, access denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid authentication token'
    });
  }
};

// Authorize roles
exports.authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this resource'
      });
    }
    next();
  };
};

// Verify email middleware
exports.verifyEmail = async (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      status: 'error',
      message: 'Please verify your email first'
    });
  }
  next();
};

// Rate limiting middleware
exports.rateLimiter = (limit, timeWindow) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (requests.has(ip)) {
      const userData = requests.get(ip);
      const windowStart = now - timeWindow;
      
      // Remove old requests
      userData.timestamps = userData.timestamps.filter(time => time > windowStart);
      
      if (userData.timestamps.length >= limit) {
        return res.status(429).json({
          status: 'error',
          message: 'Too many requests, please try again later'
        });
      }
      
      userData.timestamps.push(now);
      requests.set(ip, userData);
    } else {
      requests.set(ip, {
        timestamps: [now]
      });
    }
    
    next();
  };
};

// Seller verification middleware
exports.verifySeller = async (req, res, next) => {
  if (req.user.role !== 'seller') {
    return res.status(403).json({
      status: 'error',
      message: 'Seller account required'
    });
  }

  // Additional seller verification logic can be added here
  // For example, checking if seller has completed their profile, provided necessary documents, etc.

  next();
};

// Admin verification middleware
exports.verifyAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Admin access required'
    });
  }
  next();
};
