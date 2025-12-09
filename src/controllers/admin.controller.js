const User = require('../models/User.model');
const Contest = require('../models/Contest.model');

/**
 * GET /admin/stats
 * Get admin dashboard statistics
 * Returns counts for users, contests (total, pending, confirmed)
 */
const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalContests = await Contest.countDocuments();
    const pendingContests = await Contest.countDocuments({ status: 'pending' });
    const confirmedContests = await Contest.countDocuments({ status: 'confirmed' });

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
