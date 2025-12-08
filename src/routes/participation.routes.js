const express = require('express');
const router = express.Router();
const {
  createParticipation,
  getMyParticipations,
  getContestSubmissions,
  updateSubmission,
  getMyContestSubmissions,
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

router.patch('/:id', verifyJWT, updateSubmission);

// GET /participations/my-received - Get all submissions for my contests (Creator only)
router.get('/my-received', verifyJWT, verifyRole('creator'), getMyContestSubmissions);

module.exports = router;


