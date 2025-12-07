const Submission = require('../models/Submission.model');
const Contest = require('../models/Contest.model');
const Payment = require('../models/Payment.model');
const User = require('../models/User.model');

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

    // Verify payment exists and is completed
    const payment = await Payment.findOne({
      _id: paymentId,
      userId,
      contestId,
      paymentStatus: 'completed',
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or not completed',
      });
    }

    // Check if contest exists
    const contest = await Contest.findById(contestId);
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

    // Check if deadline has passed
    if (new Date() > new Date(contest.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Contest deadline has passed',
      });
    }

    // Check if user already participated
    const existingSubmission = await Submission.findOne({
      contestId,
      userId,
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this contest',
      });
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Create submission/participation
    const submission = await Submission.create({
      contestId,
      userId,
      userName: user.name,
      userEmail: user.email,
      submissionLink: submissionLink || '',
      paymentId: paymentId,
      transactionId: payment.transactionId || '',
      paymentStatus: 'paid',
    });

    // Increment participantsCount in contest
    contest.participantsCount = (contest.participantsCount || 0) + 1;
    await contest.save();

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

    let sortOption = { createdAt: -1 };
    if (sort === 'deadline') {
      sortOption = { 'contest.deadline': 1 };
    }

    const submissions = await Submission.find({ userId })
      .populate({
        path: 'contestId',
        select: 'name image description shortDescription price prizeMoney contestType deadline status participantsCount winnerUserId',
      })
      .sort(sortOption);

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

    // Verify contest exists and user is the creator
    const contest = await Contest.findById(contestId);

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

    const submissions = await Submission.find({ contestId })
      .populate('userId', 'name email photoURL')
      .sort({ createdAt: -1 });

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

    const submission = await Submission.findById(id);

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
    const contest = await Contest.findById(submission.contestId);
    if (new Date() > new Date(contest.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update submission. Contest deadline has passed.',
      });
    }

    // Update submission
    if (submissionLink !== undefined) submission.submissionLink = submissionLink;
    if (submissionText !== undefined) submission.submissionText = submissionText;

    await submission.save();

    res.status(200).json({
      success: true,
      message: 'Submission updated successfully',
      submission,
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

module.exports = {
  createParticipation,
  getMyParticipations,
  getContestSubmissions,
  updateSubmission,
};


