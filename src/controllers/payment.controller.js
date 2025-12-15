const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { client } = require('../config/db');
const { ObjectId } = require('mongodb');

// Helper to get collection
const getCol = (name) => {
  const db = client.db(process.env.DB_NAME || 'contest_arena');
  return db.collection(name);
};

/**
 * POST /payments/create-intent
 * Create Stripe payment intent
 */
const createPaymentIntent = async (req, res) => {
  try {
    const { price, contestId } = req.body;
    const userId = req.user.userId;
    const contestsCol = getCol('contests');
    const paymentsCol = getCol('payments');

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
    const contest = await contestsCol.findOne({ _id: new ObjectId(contestId) });
    if (!contest) {
      return res.status(404).json({
        success: false,
        message: 'Contest not found',
      });
    }

    // Verify price matches contest price
    const { paymentType } = req.body;
    
    if (paymentType === 'update' && parseFloat(price) === 10) {
        // Allow update fee
    } else if (parseFloat(price) !== contest.price) {
      return res.status(400).json({
        success: false,
        message: 'Price does not match contest entry fee',
      });
    }

    // Check for existing payment
    const existingPayment = await paymentsCol.findOne({
        userId: new ObjectId(userId),
        contestId: new ObjectId(contestId)
    });

    if (existingPayment) {
      if (existingPayment.paymentStatus === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'You have already paid for this contest',
        });
      }
    }

    // Create payment intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId: userId,
        contestId: contestId,
        paymentType: req.body.paymentType || 'entry'
      },
    });

    let payment;
    const today = new Date();

    if (req.body.paymentType === 'update') {
         const newPayment = {
          userId: new ObjectId(userId),
          contestId: new ObjectId(contestId),
          amount: price,
          paymentStatus: 'pending',
          paymentId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          createdAt: today,
          updatedAt: today
        };
        const result = await paymentsCol.insertOne(newPayment);
        payment = { _id: result.insertedId, ...newPayment };
    } else {
        if (existingPayment) {
             // Update existing pending payment
            await paymentsCol.updateOne(
                { _id: existingPayment._id },
                { 
                    $set: {
                        amount: price,
                        paymentId: paymentIntent.id,
                        stripePaymentIntentId: paymentIntent.id,
                        updatedAt: today
                    }
                }
            );
            // Re-fetch or merge
            payment = { ...existingPayment, amount: price, paymentId: paymentIntent.id, stripePaymentIntentId: paymentIntent.id };
        } else {
             // Create new payment record
            const newPayment = {
                userId: new ObjectId(userId),
                contestId: new ObjectId(contestId),
                amount: price,
                paymentStatus: 'pending',
                paymentId: paymentIntent.id,
                stripePaymentIntentId: paymentIntent.id,
                createdAt: today,
                updatedAt: today
            };
            const result = await paymentsCol.insertOne(newPayment);
            payment = { _id: result.insertedId, ...newPayment };
        }
    }

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
    const paymentsCol = getCol('payments');

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'paymentId is required',
      });
    }

    const payment = await paymentsCol.findOne({ _id: new ObjectId(paymentId) });

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
        const updateDoc = {
            paymentStatus: 'completed',
            transactionId: transactionId || paymentIntent.id,
            paidAt: new Date(),
            updatedAt: new Date()
        };
        
        await paymentsCol.updateOne(
            { _id: new ObjectId(paymentId) },
            { $set: updateDoc }
        );

        res.status(200).json({
          success: true,
          message: 'Payment confirmed successfully',
          payment: { ...payment, ...updateDoc },
        });
      } else {
        await paymentsCol.updateOne(
            { _id: new ObjectId(paymentId) },
            { $set: { paymentStatus: 'failed', updatedAt: new Date() } }
        );

        res.status(400).json({
          success: false,
          message: 'Payment not completed',
          payment: { ...payment, paymentStatus: 'failed' },
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
  const paymentsCol = getCol('payments');

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
    await paymentsCol.updateOne(
        { stripePaymentIntentId: paymentIntent.id },
        { 
            $set: {
                paymentStatus: 'completed',
                transactionId: paymentIntent.id,
                paidAt: new Date(),
                updatedAt: new Date()
            }
        }
    );
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
    const paymentsCol = getCol('payments');

    const pipeline = [
      { $match: { userId: new ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      // Populate contestId
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
          'contest.description': 0, 'contest.taskInstructions': 0,
        }
      },
      {
        $addFields: {
          contestId: '$contest'
        }
      },
      {
        $project: { contest: 0 }
      }
    ];

    const payments = await paymentsCol.aggregate(pipeline).toArray();

    const uniquePaymentsMap = new Map();
    
    payments.forEach(payment => {
      const contestId = payment.contestId?._id?.toString();
      if (!contestId) return;

      if (!uniquePaymentsMap.has(contestId)) {
        uniquePaymentsMap.set(contestId, payment);
      } else {
        const existing = uniquePaymentsMap.get(contestId);
        if (payment.paymentStatus === 'completed' && existing.paymentStatus !== 'completed') {
          uniquePaymentsMap.set(contestId, payment);
        }
      }
    });

    const uniquePayments = Array.from(uniquePaymentsMap.values());

    res.status(200).json({
      success: true,
      data: uniquePayments,
      count: uniquePayments.length,
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
    const paymentsCol = getCol('payments');


    const pipeline = [
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      // Populate contestId
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
             'contest.description': 0, 'contest.taskInstructions': 0
        }
      },
      {
        $addFields: {
          userId: '$user',
          contestId: '$contest'
        }
      },
      { $project: { user: 0, contest: 0 } }
    ];

    const payments = await paymentsCol.aggregate(pipeline).toArray();

    // Filter to show unique user+contest pairs
    const uniquePaymentsMap = new Map();
    
    payments.forEach(payment => {
      const uId = payment.userId?._id?.toString();
      const cId = payment.contestId?._id?.toString();
      if (!uId || !cId) return;
      
      const key = `${uId}_${cId}`;

      if (!uniquePaymentsMap.has(key)) {
        uniquePaymentsMap.set(key, payment);
      } else {
        const existing = uniquePaymentsMap.get(key);
        // Prioritize completed
        if (payment.paymentStatus === 'completed' && existing.paymentStatus !== 'completed') {
          uniquePaymentsMap.set(key, payment);
        }
      }
    });

    const uniquePayments = Array.from(uniquePaymentsMap.values());
    
    // Manual pagination corresponding to original logic
    const paginatedPayments = uniquePayments.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: paginatedPayments,
      pagination: {
        total: uniquePayments.length,
        page,
        pages: Math.ceil(uniquePayments.length / limit),
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
    const contestsCol = getCol('contests');
    const paymentsCol = getCol('payments');

    // First find all contests created by this user
    const contests = await contestsCol.find(
        { creatorId: new ObjectId(userId) },
        { projection: { _id: 1 } }
    ).toArray();
    
    const contestIds = contests.map(c => c._id);
    
    const pipeline = [
      { 
          $match: {
            contestId: { $in: contestIds },
            userId: { $ne: new ObjectId(userId) }
          }
      },
      { $sort: { createdAt: -1 } },
      // Populate userId
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      // Populate contestId
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
            'contest.description': 0, 'contest.taskInstructions': 0
        }
      },
      {
        $addFields: {
          userId: '$user',
          contestId: '$contest'
        }
      },
      { $project: { user: 0, contest: 0 } }
    ];

    const payments = await paymentsCol.aggregate(pipeline).toArray();

    // Filter to show unique user+contest pairs
    const uniquePaymentsMap = new Map();
    
    payments.forEach(payment => {
      const uId = payment.userId?._id?.toString();
      const cId = payment.contestId?._id?.toString();
      if (!uId || !cId) return;
      
      const key = `${uId}_${cId}`;

      if (!uniquePaymentsMap.has(key)) {
        uniquePaymentsMap.set(key, payment);
      } else {
        const existing = uniquePaymentsMap.get(key);
        // Prioritize completed
        if (payment.paymentStatus === 'completed' && existing.paymentStatus !== 'completed') {
          uniquePaymentsMap.set(key, payment);
        }
      }
    });

    const uniquePayments = Array.from(uniquePaymentsMap.values());

    res.status(200).json({
      success: true,
      data: uniquePayments,
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


