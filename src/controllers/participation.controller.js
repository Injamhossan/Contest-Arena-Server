const { client } = require('../config/db');
const { ObjectId } = require('mongodb');

// Helper to get collection
const getCol = (name) => {
  const db = client.db(process.env.DB_NAME || 'contest_arena');
  return db.collection(name);
};

/**
 * POST /participations
 * Join contest after payment (User only)
 */
const createParticipation = async (req, res) => {
  try {
    const { contestId, submissionLink, paymentId } = req.body;
    const userId = req.user.userId;

    if (!contestId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'contestId and paymentId are required',
      });
    }

    const paymentsCol = getCol('payments');
    const contestsCol = getCol('contests');
    const submissionsCol = getCol('submissions');
    const usersCol = getCol('users');

    // Verify payment exists and is completed
    const payment = await paymentsCol.findOne({
      _id: new ObjectId(paymentId),
      userId: new ObjectId(userId),
      contestId: new ObjectId(contestId),
      paymentStatus: 'completed',
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or not completed',
      });
    }

    // Check if contest exists
    const contest = await contestsCol.findOne({ _id: new ObjectId(contestId) });
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Check if contest is confirmed
    if (contest.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Contest is not confirmed yet',
      });
    }

    // Check participation limit
    if (contest.participationLimit > 0 && (contest.participantsCount || 0) >= contest.participationLimit) {
        return res.status(400).json({
            success: false,
            message: 'Contest participation limit reached',
        });
    }

    // Check if deadline has passed
    if (new Date() > new Date(contest.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Contest deadline has passed',
      });
    }

    // Check if user already participated
    const existingSubmission = await submissionsCol.findOne({
      contestId: new ObjectId(contestId),
      userId: new ObjectId(userId),
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this contest',
      });
    }

    // Get user info
    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Create submission/participation
    const newSubmission = {
      contestId: new ObjectId(contestId),
      userId: new ObjectId(userId),
      userName: user.name,
      userEmail: user.email,
      submissionLink: submissionLink || '',
      paymentId: new ObjectId(paymentId),
      transactionId: payment.transactionId || '',
      paymentStatus: 'paid',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await submissionsCol.insertOne(newSubmission);
    const submission = { _id: result.insertedId, ...newSubmission };

    // Increment participantsCount in contest
    await contestsCol.updateOne(
        { _id: new ObjectId(contestId) },
        { $inc: { participantsCount: 1 } }
    );

    // Increment user's participations count
    await usersCol.updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { participationsCount: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Successfully joined the contest',
      submission,
    });
  } catch (error) {
    console.error('Error in createParticipation:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this contest',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to join contest',
      error: error.message,
    });
  }
};

/**
 * GET /participations/me
 * Get current user's participations
 */
const getMyParticipations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sort } = req.query;
    const submissionsCol = getCol('submissions');

    let sortOption = { createdAt: -1 };
    
    // Note: sorting by populated field in simple find is not possible directly correctly without aggregation.
    // If sort is 'deadline', we need to lookup contest first.
    
    const pipeline = [
      { $match: { userId: new ObjectId(userId) } },
      {
        $lookup: {
          from: 'contests',
          localField: 'contestId',
          foreignField: '_id',
          as: 'contest'
        }
      },
      { $unwind: { path: '$contest', preserveNullAndEmptyArrays: true } },
      // Select specific fields for contest to match "select" in mongoose if needed, or keep all.
      // We populate `contestId` with the contest object.
      // AND we also add `contest` field because the frontend uses `item.contest` for display 
      // but `item.contestId` for filtering (inconsistent frontend code).
      {
         $addFields: {
             contestId: '$contest', // Mongoose populates into the field itself
             contest: '$contest'    // Add alias for frontend display
         }
      },
      // { $project: { contest: 0 } } // Removed to keep 'contest' field for frontend display
    ];

    if (sort === 'deadline') {
       pipeline.push({ $sort: { 'contestId.deadline': 1 } });
    } else {
       pipeline.push({ $sort: { createdAt: -1 } });
    }

    const submissions = await submissionsCol.aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      data: submissions,
      count: submissions.length,
    });
  } catch (error) {
    console.error('Error in getMyParticipations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participations',
      error: error.message,
    });
  }
};

/**
 * GET /participations/contest/:contestId
 * Get all submissions for a contest (Creator only)
 */
const getContestSubmissions = async (req, res) => {
  try {
    const { contestId } = req.params;
    const userId = req.user.userId;
    const contestsCol = getCol('contests');
    const submissionsCol = getCol('submissions');

    // Verify contest exists and user is the creator
    const contest = await contestsCol.findOne({ _id: new ObjectId(contestId) });

    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    if (contest.creatorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view submissions for your own contests.',
      });
    }

    const pipeline = [
        { $match: { contestId: new ObjectId(contestId) } },
        {
            $lookup: {
                from: 'users',
                localField: 'userId', // The field in submission
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { 
            $project: {
                'user.password': 0, 
                'user.__v': 0 
            }
        },
        {
            $addFields: {
                userId: '$user' // Replace userId ID with User Object
            }
        },
        { $project: { user: 0 } },
        { $sort: { createdAt: -1 } }
    ];

    const submissions = await submissionsCol.aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      data: submissions,
      count: submissions.length,
    });
  } catch (error) {
    console.error('Error in getContestSubmissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contest submissions',
      error: error.message,
    });
  }
};

/**
 * PATCH /participations/:id
 * Update submission link/text (User only, before deadline)
 */
const updateSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { submissionLink, submissionText } = req.body;
    const submissionsCol = getCol('submissions');
    const contestsCol = getCol('contests');

    const submission = await submissionsCol.findOne({ _id: new ObjectId(id) });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Check if user owns this submission
    if (submission.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own submissions.',
      });
    }

    // Check if deadline has passed
    const contest = await contestsCol.findOne({ _id: new ObjectId(submission.contestId) });
    if (new Date() > new Date(contest.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update submission. Contest deadline has passed.',
      });
    }

    // Update submission
    const updateFields = { updatedAt: new Date() };
    if (submissionLink !== undefined) updateFields.submissionLink = submissionLink;
    if (submissionText !== undefined) updateFields.submissionText = submissionText;

    await submissionsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    
    const updatedSubmission = await submissionsCol.findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: 'Submission updated successfully',
      submission: updatedSubmission,
    });
  } catch (error) {
    console.error('Error in updateSubmission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update submission',
      error: error.message,
    });
  }
};

/**
 * GET /participations/my-received
 * Get all submissions received for contests created by current user (Creator only)
 */
const getMyContestSubmissions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const contestsCol = getCol('contests');
    const submissionsCol = getCol('submissions');

    // Find all contests created by this user
    const contests = await contestsCol.find(
        { creatorId: new ObjectId(userId) },
        { projection: { _id: 1 } }
    ).toArray();
    
    const contestIds = contests.map(c => c._id);

    // Find submissions for these contests
    const pipeline = [
        { $match: { contestId: { $in: contestIds } } },
        // Populate User (submitter)
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        // Populate Contest
        {
            $lookup: {
                from: 'contests',
                localField: 'contestId',
                foreignField: '_id',
                as: 'contest'
            }
        },
        { $unwind: { path: '$contest', preserveNullAndEmptyArrays: true } },
        
        {
            $project: {
                'user.password': 0, 'user.__v': 0,
                // keep needed contest fields
                'contest.description': 0, 'contest.taskInstructions': 0
            }
        },
        {
            $addFields: {
                userId: '$user',
                contestId: '$contest'
            }
        },
        { $project: { user: 0, contest: 0 } },
        { $sort: { createdAt: -1 } }
    ];

    const submissions = await submissionsCol.aggregate(pipeline).toArray();

    res.status(200).json({
      success: true,
      data: submissions,
      count: submissions.length,
    });
  } catch (error) {
    console.error('Error in getMyContestSubmissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch received submissions',
      error: error.message,
    });
  }
};

module.exports = {
  createParticipation,
  getMyParticipations,
  getContestSubmissions,
  updateSubmission,
  getMyContestSubmissions,
};


