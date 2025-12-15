const { client } = require('../config/db');

// Helper to get collection
const getCol = (name) => {
  const db = client.db(process.env.DB_NAME || 'contest_arena');
  return db.collection(name);
};

/**
 * GET /admin/stats
 */
const getAdminStats = async (req, res) => {
  try {
    const usersCol = getCol('users');
    const contestsCol = getCol('contests');

    const totalUsers = await usersCol.countDocuments();
    const totalContests = await contestsCol.countDocuments();
    const pendingContests = await contestsCol.countDocuments({ status: 'pending' });
    const confirmedContests = await contestsCol.countDocuments({ status: 'confirmed' });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalContests,
        pendingContests,
        confirmedContests,
      },
    });
  } catch (error) {
    console.error('Error in getAdminStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin stats',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminStats,
};
