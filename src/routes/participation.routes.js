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

// Join contest (User only)
router.post('/', verifyJWT, verifyRole('user'), createParticipation);

// Get my participations
router.get('/me', verifyJWT, getMyParticipations);

// Get contest submissions (Creator only)
router.get(
  '/contest/:contestId',
  verifyJWT,
  verifyRole('creator'),
  getContestSubmissions
);

router.patch('/:id', verifyJWT, updateSubmission);

// Get all submissions for my contests (Creator only)
router.get('/my-received', verifyJWT, verifyRole('creator'), getMyContestSubmissions);

module.exports = router;


