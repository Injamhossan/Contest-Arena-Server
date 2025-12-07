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
} = require('../controllers/contest.controller');
const verifyJWT = require('../middleware/verifyJWT');
const verifyRole = require('../middleware/roleChecker');

// GET /contests - Get all contests (Public)
router.get('/', getAllContests);

// GET /contests/popular - Get popular contests (Public)
router.get('/popular', getPopularContests);

// GET /contests/winners/recent - Get recent winners (Public)
router.get('/winners/recent', getRecentWinners);

// GET /contests/:id - Get contest by ID (Public)
router.get('/:id', getContestById);

// POST /contests - Create contest (Creator only)
router.post('/', verifyJWT, verifyRole('creator'), createContest);

// PUT /contests/:id - Update contest (Creator only, pending only)
router.put('/:id', verifyJWT, verifyRole('creator'), updateContest);

// DELETE /contests/:id - Delete contest (Creator can delete own pending, Admin can delete any)
router.delete('/:id', verifyJWT, verifyRole(['creator', 'admin']), deleteContest);

// PATCH /contests/:id/status - Approve contest (Admin only)
router.patch('/:id/status', verifyJWT, verifyRole('admin'), updateContestStatus);

// PATCH /contests/:id/winner - Declare winner (Creator only)
router.patch('/:id/winner', verifyJWT, verifyRole('creator'), declareWinner);

module.exports = router;


