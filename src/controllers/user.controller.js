const { client } = require('../config/db');
const { ObjectId } = require('mongodb');

/**
 * GET /users
 * Get all users (Admin only)
 * Supports pagination
 */
const getAllUsers = async (req, res) => {
  try {
    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await usersCollection.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project({ password: 0, __v: 0 })
      .toArray();

    const total = await usersCollection.countDocuments();

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

/**
 * GET /users/:id
 * Get user by ID
 * User can fetch own data, admin can fetch any user
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // User can only fetch own data unless they are admin
    if (req.user.role !== 'admin' && id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.',
      });
    }

    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, __v: 0 } }
    );

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
    console.error('Error in getUserById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message,
    });
  }
};

/**
 * PATCH /users/:id/role
 * Change user role (Admin only)
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'creator', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (user, creator, or admin)',
      });
    }

    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { role: role, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { password: 0, __v: 0 } }
    );

    const updatedUser = result || await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message,
    });
  }
};

/**
 * PATCH /users/:id
 * Update user profile
 * User can update own profile
 */
const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, photoURL, bio, address } = req.body;

    // User can only update own profile unless they are admin
    if (req.user.role !== 'admin' && id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.',
      });
    }

    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prepare update object
    const updateFields = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (photoURL !== undefined) updateFields.photoURL = photoURL;
    if (bio !== undefined) updateFields.bio = bio;
    if (address !== undefined) updateFields.address = address;

    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};

/**
 * DELETE /users/:id
 * Delete user (Admin only)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
};

/**
 * GET /users/leaderboard
 * Get top users for leaderboard
 * Public route
 */
const getLeaderboard = async (req, res) => {
  try {
    const db = client.db(process.env.DB_NAME || 'contest_arena');
    const usersCollection = db.collection('users');

    const users = await usersCollection.find({ role: 'user' })
      .project({ name: 1, photoURL: 1, winsCount: 1, participationsCount: 1 })
      .sort({ winsCount: -1 })
      .limit(50)
      .toArray();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserProfile,
  deleteUser,
  getLeaderboard,
};


