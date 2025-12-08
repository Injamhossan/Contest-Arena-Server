const express = require('express');
const router = express.Router();
const {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getMyPayments,
  getAllPayments,
  getCreatorUserPayments,
} = require('../controllers/payment.controller');
const roleChecker = require('../middleware/roleChecker');
const verifyJWT = require('../middleware/verifyJWT');

// POST /payments/create-intent - Create payment intent
router.post('/create-intent', verifyJWT, createPaymentIntent);

// POST /payments/confirm - Confirm payment
router.post('/confirm', verifyJWT, confirmPayment);

// POST /payments/webhook - Stripe webhook (no auth needed, uses signature)
router.post('/webhook', handleWebhook);

// GET /payments/me - Get my payments
router.get('/me', verifyJWT, getMyPayments);

// GET /payments/creator-users - Get payments from users for my contests
router.get('/creator-users', verifyJWT, roleChecker('creator'), getCreatorUserPayments);

// GET /payments - Get all payments (Admin only)
router.get('/', verifyJWT, roleChecker('admin'), getAllPayments);

module.exports = router;


