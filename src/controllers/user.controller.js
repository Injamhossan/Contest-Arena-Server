const User = require('../models/User.model');

/**
 * GET /users
 * Get all users (Admin only)
 * Supports pagination
 */
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

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

    const user = await User.findById(id).select('-__v');

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

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
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

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update allowed fields
    if (name !== undefined) user.name = name;
    if (photoURL !== undefined) user.photoURL = photoURL;
    if (bio !== undefined) user.bio = bio;
    if (address !== undefined) user.address = address;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
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

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent deleting self (optional but good practice)
    // if (user._id.toString() === req.user.userId) {
    //   return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    // }

    await User.findByIdAndDelete(id);

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

module.exports = {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserProfile,
  deleteUser,
};


