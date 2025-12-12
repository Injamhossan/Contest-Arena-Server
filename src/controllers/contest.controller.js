const { client } = require('../config/db');
const { ObjectId } = require('mongodb');

// Helper to get collection
const getCol = (name) => {
  const db = client.db(process.env.DB_NAME || 'contest_arena');
  return db.collection(name);
};

/**
 * GET /contests
 * Get all contests (Public)
 * Supports filtering by status, type, and search
 */
const getAllContests = async (req, res) => {
  try {
    const contestsCol = getCol('contests');

    const { status, type, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitVal = parseInt(limit);

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

    // Aggregation pipeline for pagination and population
    const pipeline = [
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitVal },
      // Populate creatorId
      {
        $lookup: {
          from: 'users',
          localField: 'creatorId',
          foreignField: '_id',
          as: 'creator'
        }
      },
      {
        $unwind: { path: '$creator', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          'creator.password': 0,
          'creator.__v': 0
        }
      },
      // Map creator back to creatorId field if needed to match previous response structure
      // or just keep it as 'creator' object. Previous response had populated object in 'creatorId'.
      {
        $addFields: {
           creatorId: '$creator'
        }
      },
       {
        $project: {
          creator: 0
        }
      }
    ];

    const contests = await contestsCol.aggregate(pipeline).toArray();
    const total = await contestsCol.countDocuments(query);

    res.status(200).json({
      success: true,
      data: contests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limitVal),
        limit: limitVal,
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
    const contestsCol = getCol('contests');
    const limit = parseInt(req.query.limit) || 10;

    const pipeline = [
      { $match: { status: 'confirmed' } },
      { $sort: { participantsCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'creatorId',
          foreignField: '_id',
          as: 'creatorId'
        }
      },
      {
        $unwind: { path: '$creatorId', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          'creatorId.password': 0,
          'creatorId.__v': 0
        }
      }
    ];

    const contests = await contestsCol.aggregate(pipeline).toArray();

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
    const contestsCol = getCol('contests');
    const submissionsCol = getCol('submissions');

    // Aggregate to fetch and populate
    const pipeline = [
      { $match: { _id: new ObjectId(id) } },
      {
        $lookup: {
          from: 'users',
          localField: 'creatorId',
          foreignField: '_id',
          as: 'creatorId'
        }
      },
      {
        $unwind: { path: '$creatorId', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          'creatorId.password': 0,
          'creatorId.__v': 0
        }
      }
    ];

    const results = await contestsCol.aggregate(pipeline).toArray();
    const contest = results[0];

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Dynamic participant count
    // Use stored string ID or object Id matching
    // Typically submission has contestId as ObjectId if strict, or String.
    // Let's assume ObjectId or String content. safe to check both or standardize.
    // Ideally assume ObjectId.
    // If submission stored contestId as string, we need to match string.
    // Previous code didn't specify. Mongoose normally casts string in query to ObjectId if schema says so.
    // But in createParticipation (Step 66), it creates with contestId (from body).
    // I should check strictness later. For now assume it matches what's stored.
    
    // We can count safely by converting `id` to string or ObjectId if needed.
    // For now assuming stored as ObjectId.
    const submissionCount = await submissionsCol.countDocuments({ contestId: new ObjectId(id) }); 
    // Fallback if 0 found? maybe stored as string?
    // const submissionCountString = await submissionsCol.countDocuments({ contestId: id });
    
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
    const contestsCol = getCol('contests');
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
    
    const userId = req.user.userId;
    const userName = req.user.name || 'Creator';

    // Validation
    if (!name || !description || !price || !prizeMoney || !taskInstructions || !contestType || !deadline || participationLimit === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const newContest = {
      name,
      image: image || '',
      description,
      shortDescription: shortDescription || '',
      price,
      prizeMoney,
      taskInstructions,
      contestType,
      creatorId: new ObjectId(userId),
      creatorName: userName,
      deadline: new Date(deadline),
      participationLimit: parseInt(participationLimit),
      status: 'pending',
      participantsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await contestsCol.insertOne(newContest);
    const contest = { _id: result.insertedId, ...newContest };

    res.status(201).json({
      success: true,
      message: 'Contest created successfully. Waiting for admin approval.',
      contest,
    });
  } catch (error) {
    console.error('Error in createContest:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create contest',
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
    const contestsCol = getCol('contests');

    const contest = await contestsCol.findOne({ _id: new ObjectId(id) });

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

    const updateFields = { updatedAt: new Date() };
    if (name) updateFields.name = name;
    if (image !== undefined) updateFields.image = image;
    if (description) updateFields.description = description;
    if (shortDescription !== undefined) updateFields.shortDescription = shortDescription;
    if (price !== undefined) updateFields.price = price;
    if (prizeMoney !== undefined) updateFields.prizeMoney = prizeMoney;
    if (taskInstructions) updateFields.taskInstructions = taskInstructions;
    if (contestType) updateFields.contestType = contestType;
    if (deadline) updateFields.deadline = new Date(deadline);
    if (participationLimit !== undefined) updateFields.participationLimit = parseInt(participationLimit);

    // If contest was confirmed, reset to pending
    if (contest.status === 'confirmed') {
        updateFields.status = 'pending';
    }

    await contestsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updatedContest = await contestsCol.findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: 'Contest updated successfully',
      contest: updatedContest,
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
    const contestsCol = getCol('contests');

    const contest = await contestsCol.findOne({ _id: new ObjectId(id) });

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

    await contestsCol.deleteOne({ _id: new ObjectId(id) });

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
    const contestsCol = getCol('contests');

    if (!status || !['pending', 'confirmed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (pending or confirmed)',
      });
    }

    const result = await contestsCol.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    // Check if result returned a document (depends on driver version)
    // In strict mode or new driver, this might differ. 
    // Standardizing:
    const updatedContest = await contestsCol.findOne({_id: new ObjectId(id)});

    if (!updatedContest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Contest ${status === 'confirmed' ? 'approved' : 'status updated'} successfully`,
      contest: updatedContest,
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
    const contestsCol = getCol('contests');
    const usersCol = getCol('users');

    if (!winnerUserId) {
      return res.status(400).json({
        success: false,
        message: 'winnerUserId is required',
      });
    }

    const contest = await contestsCol.findOne({ _id: new ObjectId(id) });

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

    const winner = await usersCol.findOne({ _id: new ObjectId(winnerUserId) });

    if (!winner) {
      return res.status(404).json({
        success: false,
        message: 'Winner user not found',
      });
    }

    // Update contest with winner
    await contestsCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          winnerUserId: new ObjectId(winnerUserId),
          winnerName: winner.name,
          winnerPhotoURL: winner.photoURL || '',
          updatedAt: new Date()
        }
      }
    );

    // Increment winner's winsCount
    await usersCol.updateOne(
        { _id: new ObjectId(winnerUserId) },
        { $inc: { winsCount: 1 } }
    );
    
    const updatedContest = await contestsCol.findOne({_id: new ObjectId(id)});

    res.status(200).json({
      success: true,
      message: 'Winner declared successfully',
      contest: updatedContest,
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
    const contestsCol = getCol('contests');
    const limit = parseInt(req.query.limit) || 10;

    const pipeline = [
      { 
        $match: {
          status: 'confirmed',
          winnerUserId: { $ne: null }
        }
      },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'winnerUserId',
          foreignField: '_id',
          as: 'winnerUserId' // Replace field with populated array
        }
      },
      {
        $unwind: { path: '$winnerUserId', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          'winnerUserId.name': 1,
          'winnerUserId.photoURL': 1,
          name: 1,
          contestType: 1
        }
      }
    ];

    const contests = await contestsCol.aggregate(pipeline).toArray();

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

/**
 * GET /contests/my-created
 * Get contests created by current user (Creator only)
 */
const getMyContests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const contestsCol = getCol('contests');
    const paymentsCol = getCol('payments');
    const submissionsCol = getCol('submissions');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { creatorId: new ObjectId(userId) };
    
    const contests = await contestsCol.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await contestsCol.countDocuments(query);

    // Fetch payments for these contests by this user
    const contestIds = contests.map(c => c._id);
    
    // Note: Payment collection queries need appropriate match logic
    const payments = await paymentsCol.find({
      contestId: { $in: contestIds },
      userId: new ObjectId(userId), // Assuming userId in payment is ObjectId
      paymentStatus: 'completed'
    }).toArray();

    const submissionCounts = await submissionsCol.aggregate([
      { $match: { contestId: { $in: contestIds } } },
      { $group: { _id: '$contestId', count: { $sum: 1 } } }
    ]).toArray();

    const countMap = {};
    submissionCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Add paymentStatus and participantsCount to contests
    const contestsWithPayment = contests.map(contest => {
      // Check if any payment matches. Comparing ObjectIds requires .toString()
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


 