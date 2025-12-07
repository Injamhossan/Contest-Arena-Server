const express = require('express');
const router = express.Router();
const {
  createParticipation,
  getMyParticipations,
  getContestSubmissions,
  updateSubmission,
} = require('../controllers/participation.controller');
const verifyJWT = require('../middleware/verifyJWT');
const verifyRole = require('../middleware/roleChecker');

// POST /participations - Join contest (User only)
router.post('/', verifyJWT, verifyRole('user'), createParticipation);

// GET /participations/me - Get my participations
router.get('/me', verifyJWT, getMyParticipations);

// GET /participations/contest/:contestId - Get contest submissions (Creator only)
router.get(
  '/contest/:contestId',
  verifyJWT,
  verifyRole('creator'),
  getContestSubmissions
);

// PATCH /participations/:id - Update submission
router.patch('/:id', verifyJWT, updateSubmission);

module.exports = router;


