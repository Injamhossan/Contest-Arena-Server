const Contest = require('../models/Contest.model');

/**
 * GET /contests
 * Get all contests (Public)
 * Supports filtering by status, type, and search
 */
const getAllContests = async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (type) {
      query.contestType = { $regex: type, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { contestType: { $regex: search, $options: 'i' } },
      ];
    }

    const contests = await Contest.find(query)
      .populate('creatorId', 'name email photoURL')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: contests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error in getAllContests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contests',
      error: error.message,
    });
  }
};

/**
 * GET /contests/popular
 * Get popular contests sorted by participantsCount
 */
const getPopularContests = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const contests = await Contest.find({ status: 'confirmed' })
      .populate('creatorId', 'name email photoURL')
      .sort({ participantsCount: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: contests,
    });
  } catch (error) {
    console.error('Error in getPopularContests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular contests',
      error: error.message,
    });
  }
};

/**
 * GET /contests/:id
 * Get contest by ID (Public)
 */
const getContestById = async (req, res) => {
  try {
    const { id } = req.params;

    const contest = await Contest.findById(id).populate(
      'creatorId',
      'name email photoURL'
    ).lean();

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Dynamic participant count
    const Submission = require('../models/Submission.model');
    const submissionCount = await Submission.countDocuments({ contestId: id });
    contest.participantsCount = submissionCount;

    res.status(200).json({
      success: true,
      contest,
    });
  } catch (error) {
    console.error('Error in getContestById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contest',
      error: error.message,
    });
  }
};

/**
 * POST /contests
 * Create a new contest (Creator only)
 */
const createContest = async (req, res) => {
  try {
    const {
      name,
      image,
      description,
      shortDescription,
      price,
      prizeMoney,
      taskInstructions,
      contestType,
      deadline,
      participationLimit,
    } = req.body;
    
    console.log('Creating contest with body:', req.body);
    console.log('User from token:', req.user);

    // Validation
    if (!name || !description || !price || !prizeMoney || !taskInstructions || !contestType || !deadline || participationLimit === undefined) {
      console.error('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const userId = req.user.userId;
    const userName = req.user.name || 'Creator';

    console.log('Creating contest for user:', userId, userName);

    const contest = await Contest.create({
      name,
      image: image || '',
      description,
      shortDescription: shortDescription || '',
      price,
      prizeMoney,
      taskInstructions,
      contestType,
      creatorId: userId,
      creatorName: userName,
      deadline: new Date(deadline),
      deadline: new Date(deadline),
      participationLimit: parseInt(participationLimit),
      status: 'pending',
    });
    
    console.log('Contest created:', contest);

    res.status(201).json({
      success: true,
      message: 'Contest created successfully. Waiting for admin approval.',
      contest,
    });
  } catch (error) {
    console.error('Error in createContest:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create contest', // Send actual error message
      error: error.message,
    });
  }
};

/**
 * PUT /contests/:id
 * Update contest (Creator only, only if status is pending)
 */
const updateContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const contest = await Contest.findById(id);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Check if user is the creator
    if (contest.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own contests.',
      });
    }

    // Check if contest is still pending OR confirmed (if confirmed, we will reset to pending)
    // Removed the block that prevents editing confirmed contests.
    // if (contest.status !== 'pending') { ... }

    // Update allowed fields
    const {
      name,
      image,
      description,
      shortDescription,
      price,
      prizeMoney,
      taskInstructions,
      contestType,
      deadline,
      participationLimit,
    } = req.body;

    if (name) contest.name = name;
    if (image !== undefined) contest.image = image;
    if (description) contest.description = description;
    if (shortDescription !== undefined) contest.shortDescription = shortDescription;
    if (price !== undefined) contest.price = price;
    if (prizeMoney !== undefined) contest.prizeMoney = prizeMoney;
    if (taskInstructions) contest.taskInstructions = taskInstructions;
    if (contestType) contest.contestType = contestType;
    if (deadline) contest.deadline = new Date(deadline);


    if (participationLimit !== undefined) contest.participationLimit = parseInt(participationLimit);

    // If contest was confirmed, reset to pending
    if (contest.status === 'confirmed') {
        contest.status = 'pending';
    }

    await contest.save();

    res.status(200).json({
      success: true,
      message: 'Contest updated successfully',
      contest,
    });
  } catch (error) {
    console.error('Error in updateContest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contest',
      error: error.message,
    });
  }
};

/**
 * DELETE /contests/:id
 * Delete contest (Creator can delete own pending contests, Admin can delete any)
 */
const deleteContest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const contest = await Contest.findById(id);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Creator can only delete own pending contests
    if (userRole === 'creator') {
      if (contest.creatorId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only delete your own contests.',
        });
      }
      if (contest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete contest. Contest is already confirmed.',
        });
      }
    }

    // Admin can delete any contest
    await Contest.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Contest deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteContest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contest',
      error: error.message,
    });
  }
};

/**
 * PATCH /contests/:id/status
 * Approve contest (Admin only)
 */
const updateContestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (pending or confirmed)',
      });
    }

    const contest = await Contest.findById(id);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    contest.status = status;
    await contest.save();

    res.status(200).json({
      success: true,
      message: `Contest ${status === 'confirmed' ? 'approved' : 'status updated'} successfully`,
      contest,
    });
  } catch (error) {
    console.error('Error in updateContestStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contest status',
      error: error.message,
    });
  }
};

/**
 * PATCH /contests/:id/winner
 * Declare winner (Creator only, after deadline)
 */
const declareWinner = async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerUserId } = req.body;
    const userId = req.user.userId;

    if (!winnerUserId) {
      return res.status(400).json({
        success: false,
        message: 'winnerUserId is required',
      });
    }

    const contest = await Contest.findById(id);

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Check if user is the creator
    if (contest.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the contest creator can declare winners.',
      });
    }

    // Check if deadline has passed
    if (new Date() < new Date(contest.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot declare winner. Contest deadline has not passed yet.',
      });
    }

    // Check if winner already declared
    if (contest.winnerUserId) {
      return res.status(400).json({
        success: false,
        message: 'Winner has already been declared for this contest.',
      });
    }

    const User = require('../models/User.model');
    const winner = await User.findById(winnerUserId);

    if (!winner) {
      return res.status(404).json({
        success: false,
        message: 'Winner user not found',
      });
    }

    // Update contest with winner
    contest.winnerUserId = winnerUserId;
    contest.winnerName = winner.name;
    contest.winnerPhotoURL = winner.photoURL || '';
    await contest.save();

    // Increment winner's winsCount
    winner.winsCount = (winner.winsCount || 0) + 1;
    await winner.save();

    res.status(200).json({
      success: true,
      message: 'Winner declared successfully',
      contest,
    });
  } catch (error) {
    console.error('Error in declareWinner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to declare winner',
      error: error.message,
    });
  }
};

/**
 * GET /contests/winners/recent
 * Get recent winners (for Home page)
 */
const getRecentWinners = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const contests = await Contest.find({
      status: 'confirmed',
      winnerUserId: { $ne: null },
    })
      .populate('winnerUserId', 'name photoURL')
      .sort({ updatedAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: contests,
    });
  } catch (error) {
    console.error('Error in getRecentWinners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent winners',
      error: error.message,
    });
  }
};

const Payment = require('../models/Payment.model');

/**
 * GET /contests/my-created
 * Get contests created by current user (Creator only)
 */
const getMyContests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const contests = await Contest.find({ creatorId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean to get plain JS objects

    const total = await Contest.countDocuments({ creatorId: userId });

    // Fetch payments for these contests by this user
    const contestIds = contests.map(c => c._id);
    const payments = await Payment.find({
      contestId: { $in: contestIds },
      userId: userId,
      paymentStatus: 'completed'
    });

    const Submission = require('../models/Submission.model');
    const submissionCounts = await Submission.aggregate([
      { $match: { contestId: { $in: contestIds } } },
      { $group: { _id: '$contestId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    submissionCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Add paymentStatus and participantsCount to contests
    const contestsWithPayment = contests.map(contest => {
      const isPaid = payments.some(p => p.contestId.toString() === contest._id.toString());
      return {
        ...contest,
        participantsCount: countMap[contest._id.toString()] || 0,
        paymentStatus: isPaid ? 'Paid' : 'Unpaid'
      };
    });

    res.status(200).json({
      success: true,
      data: contestsWithPayment,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error('Error in getMyContests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch my contests',
      error: error.message,
    });
  }
};

module.exports = {
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
};


 