const User = require('../models/User.model');
const generateJWT = require('../utils/generateJWT');

/**
 * POST /auth/jwt
 * Create or find user and return JWT token
 */
const createJWT = async (req, res) => {
  try {
    console.log('Received JWT request:', { body: req.body, headers: req.headers });
    const { email, name, photoURL } = req.body;

    if (!email) {
      console.error('Email is missing in request');
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    console.log('User lookup result:', user ? 'Found' : 'Not found');

    if (!user) {
      // Create new user with default role 'user'
      console.log('Creating new user:', { email: email.toLowerCase(), name: name || 'User' });
      user = await User.create({
        email: email.toLowerCase(),
        name: name || 'User',
        photoURL: photoURL || '',
        role: 'user',
      });
      console.log('User created successfully:', user._id);
    } else {
      // Update name and photoURL if provided
      if (name) user.name = name;
      if (photoURL) user.photoURL = photoURL;
      await user.save();
      console.log('User updated successfully:', user._id);
    }

    // Generate JWT token
    const token = generateJWT(user);
    console.log('JWT token generated for user:', user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        role: user.role,
        winsCount: user.winsCount,
      },
    });
  } catch (error) {
    console.error('Error in createJWT:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create JWT token',
      error: error.message,
    });
  }
};

/**
 * GET /auth/me
 * Get current user profile from JWT
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message,
    });
  }
};

module.exports = {
  createJWT,
  getCurrentUser,
};

