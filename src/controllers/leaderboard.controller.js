const { client } = require('../config/db');
const { ObjectId } = require('mongodb');

// Helper to get collection
const getCol = (name) => {
  const db = client.db(process.env.DB_NAME || 'contest_arena');
  return db.collection(name);
};

/**
 * GET /leaderboard
 * Get leaderboard sorted by winsCount (Public)
 */
const getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const usersCol = getCol('users');

    const users = await usersCol.find(
      { winsCount: { $gt: 0 } },
      { projection: { name: 1, photoURL: 1, winsCount: 1, email: 1 } }
    )
    .sort({ winsCount: -1 })
    .limit(limit)
    .toArray();

    // Add rank to each user
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      name: user.name,
      photoURL: user.photoURL,
      winsCount: user.winsCount,
      email: user.email,
    }));

    res.status(200).json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
    });
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message,
    });
  }
};

module.exports = {
  getLeaderboard,
};


