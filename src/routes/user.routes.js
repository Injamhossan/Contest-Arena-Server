const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserProfile,
} = require('../controllers/user.controller');
const verifyJWT = require('../middleware/verifyJWT');
const verifyRole = require('../middleware/roleChecker');

// GET /users - Get all users (Admin only)
router.get('/', verifyJWT, verifyRole('admin'), getAllUsers);

// GET /users/:id - Get user by ID
router.get('/:id', verifyJWT, getUserById);

// PATCH /users/:id/role - Update user role (Admin only)
router.patch('/:id/role', verifyJWT, updateUserRole);

// PATCH /users/:id - Update user profile
router.patch('/:id', verifyJWT, updateUserProfile);

module.exports = router;


