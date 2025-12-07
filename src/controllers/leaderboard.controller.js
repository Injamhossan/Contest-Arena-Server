const User = require('../models/User.model');

/**
 * GET /leaderboard
 * Get leaderboard sorted by winsCount (Public)
 */
const getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const users = await User.find({ winsCount: { $gt: 0 } })
      .select('name photoURL winsCount email')
      .sort({ winsCount: -1 })
      .limit(limit);

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


