const express = require('express');
const router = express.Router();
const { getAdminStats } = require('../controllers/admin.controller');
const verifyJWT = require('../middleware/verifyJWT');
const verifyRole = require('../middleware/roleChecker');

// (Admin only)
router.get('/stats', verifyJWT, verifyRole('admin'), getAdminStats);

module.exports = router;
