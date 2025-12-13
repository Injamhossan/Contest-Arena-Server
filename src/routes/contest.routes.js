const express = require('express');
const router = express.Router();
const {
  getAllContests,
  getPopularContests,
  getContestById,
  createContest,
  updateContest,
  deleteContest,
  updateContestStatus,
  declareWinner,
  getRecentWinners,
  getMyContests,
} = require('../controllers/contest.controller');
const verifyJWT = require('../middleware/verifyJWT');
const verifyRole = require('../middleware/roleChecker');

//  Get all contests (Public)
router.get('/', getAllContests);

// Get popular contests (Public)
router.get('/popular', getPopularContests);

// Get recent winners (Public)
router.get('/winners/recent', getRecentWinners);

// Get contests created by me (Creator only)
router.get('/my-created', verifyJWT, verifyRole('creator'), getMyContests);

// Get contest by ID (Public)
router.get('/:id', getContestById);

// Create contest (Creator only)
router.post('/', verifyJWT, verifyRole('creator'), createContest);

// Update contest (Creator only, pending only)
router.put('/:id', verifyJWT, verifyRole('creator'), updateContest);

// Delete contest (Creator can delete own pending, Admin can delete any)
router.delete('/:id', verifyJWT, verifyRole(['creator', 'admin']), deleteContest);

// Approve contest (Admin only)
router.patch('/:id/status', verifyJWT, verifyRole('admin'), updateContestStatus);

// Declare winner (Creator only)
router.patch('/:id/winner', verifyJWT, verifyRole('creator'), declareWinner);

module.exports = router;


