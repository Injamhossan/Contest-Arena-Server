const express = require('express');
const router = express.Router();
const { createJWT, getCurrentUser } = require('../controllers/auth.controller');
const verifyJWT = require('../middleware/verifyJWT');

// POST /auth/jwt - Create or get JWT token
router.post('/jwt', createJWT);

// GET /auth/me - Get current user profile
router.get('/me', verifyJWT, getCurrentUser);

module.exports = router;


