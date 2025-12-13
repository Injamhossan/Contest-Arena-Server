const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserProfile,
  deleteUser,
  getLeaderboard,
} = require('../controllers/user.controller');
const verifyJWT = require('../middleware/verifyJWT');
const verifyRole = require('../middleware/roleChecker');

// Get leaderboard (Public)
router.get('/leaderboard', getLeaderboard);

// Get all users (Admin only)
router.get('/', verifyJWT, verifyRole('admin'), getAllUsers);

// Get user by ID
router.get('/:id', verifyJWT, getUserById);

// Update user role (Admin only)
router.patch('/:id/role', verifyJWT, updateUserRole);

// Update user profile
router.patch('/:id', verifyJWT, updateUserProfile);

// Delete user (Admin only)
router.delete('/:id', verifyJWT, verifyRole('admin'), deleteUser);

module.exports = router;


