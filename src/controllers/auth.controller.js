const { client } = require('../config/db');
const { ObjectId } = require('mongodb');
const generateJWT = require('../utils/generateJWT');

/**
 * POST /auth/jwt
 * Create or find user and return JWT token
 */
const createJWT = async (req, res) => {
  try {
    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    console.log('Received JWT request:', { body: req.body, headers: req.headers });
    const { email, name, photoURL, role } = req.body;

    if (!email) {
      console.error('Email is missing in request');
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find or create user
    let user = await usersCollection.findOne({ email: email.toLowerCase() });
    console.log('User lookup result:', user ? 'Found' : 'Not found');

    if (!user) {
      const validRoles = ['user', 'creator', 'admin'];
      const userRole = (role && validRoles.includes(role)) ? role : 'user';

      // Create new user
      console.log('Creating new user:', { email: email.toLowerCase(), name: name || 'User', role: userRole });
      const newUser = {
        email: email.toLowerCase(),
        name: name || 'User',
        photoURL: photoURL || '',
        role: userRole,
        winsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const result = await usersCollection.insertOne(newUser);
      user = { _id: result.insertedId, ...newUser };
      
      console.log('User created successfully:', user._id);
    } else {
      // Update name and photoURL if provided
      const updateData = {};
      if (name) updateData.name = name;
      if (photoURL) updateData.photoURL = photoURL;
      
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();
        const result = await usersCollection.findOneAndUpdate(
          { _id: user._id },
          { $set: updateData },
          { returnDocument: 'after' }
        );
        user = result || { ...user, ...updateData };
      }
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
    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    delete user.password; 

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

