const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment.model');
const Contest = require('../models/Contest.model');

/**
 * POST /payments/create-intent
 * Create Stripe payment intent
 */
const createPaymentIntent = async (req, res) => {
  try {
    const { price, contestId } = req.body;
    const userId = req.user.userId;

    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required',
      });
    }

    if (!contestId) {
      return res.status(400).json({
        success: false,
        message: 'contestId is required',
      });
    }

    // Verify contest exists
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Verify price matches contest price
    // Use loose equality or parse float to handle string/number differences
    if (parseFloat(price) !== contest.price) {
      return res.status(400).json({
        success: false,
        message: 'Price does not match contest entry fee',
      });
    }

    // Create payment intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: userId,
        contestId: contestId,
      },
    });

    // Create payment record in database
    const payment = await Payment.create({
      userId,
      contestId,
      amount: price,
      paymentStatus: 'pending',
      paymentId: paymentIntent.id,
      stripePaymentIntentId: paymentIntent.id,
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentId: payment._id,
    });
  } catch (error) {
    console.error('Error in createPaymentIntent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message,
    });
  }
};

/**
 * POST /payments/confirm
 * Confirm payment after Stripe payment succeeds
 */
const confirmPayment = async (req, res) => {
  try {
    const { paymentId, transactionId } = req.body;
    const userId = req.user.userId;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'paymentId is required',
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Verify payment belongs to user
    if (payment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Verify payment intent with Stripe
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId
      );

      if (paymentIntent.status === 'succeeded') {
        payment.paymentStatus = 'completed';
        payment.transactionId = transactionId || paymentIntent.id;
        payment.paidAt = new Date();
        await payment.save();

        res.status(200).json({
          success: true,
          message: 'Payment confirmed successfully',
          payment,
        });
      } else {
        payment.paymentStatus = 'failed';
        await payment.save();

        res.status(400).json({
          success: false,
          message: 'Payment not completed',
          payment,
        });
      }
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      res.status(500).json({
        success: false,
        message: 'Failed to verify payment with Stripe',
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error('Error in confirmPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message,
    });
  }
};

/**
 * POST /payments/webhook
 * Stripe webhook handler 
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;

    // Update payment status in database
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (payment) {
      payment.paymentStatus = 'completed';
      payment.transactionId = paymentIntent.id;
      payment.paidAt = new Date();
      await payment.save();
    }
  }

  res.json({ received: true });
};

/**
 * GET /payments/me
 * Get current user's payment history
 */
const getMyPayments = async (req, res) => {
  try {
    const userId = req.user.userId;

    const payments = await Payment.find({ userId })
      .populate('contestId', 'name image price prizeMoney')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    console.error('Error in getMyPayments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message,
    });
  }
};

/**
 * GET /payments
 * Get all payments (Admin only)
 */
const getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find()
      .populate('userId', 'name email')
      .populate({
        path: 'contestId',
        select: 'name creatorId'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments();

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error('Error in getAllPayments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message,
    });
  }
};

/**
 * GET /payments/creator-users
 * Get payments made by users for contests created by current creator
 */
const getCreatorUserPayments = async (req, res) => {
  try {
    const userId = req.user.userId;

    // First find all contests created by this user
    const contests = await Contest.find({ creatorId: userId }).select('_id');
    const contestIds = contests.map(c => c._id);

    // Find payments for these contests, excluding the creator's own payments (if they paid for their own contest)
    // Actually, usually creators pay for their own contest to publish it.
    // The user wants "User's payment history" to go to Creator.
    // So we want payments where contestId IN [my_contests] AND userId != me
    
    const payments = await Payment.find({
      contestId: { $in: contestIds },
      userId: { $ne: userId }
    })
      .populate('userId', 'name email photoURL')
      .populate('contestId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('Error in getCreatorUserPayments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user payments',
      error: error.message,
    });
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getMyPayments,
  getAllPayments,
  getCreatorUserPayments,
};


