const express = require('express');
const router = express.Router();
const {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getMyPayments,
} = require('../controllers/payment.controller');
const verifyJWT = require('../middleware/verifyJWT');

// POST /payments/create-intent - Create payment intent
router.post('/create-intent', verifyJWT, createPaymentIntent);

// POST /payments/confirm - Confirm payment
router.post('/confirm', verifyJWT, confirmPayment);

// POST /payments/webhook - Stripe webhook (no auth needed, uses signature)
router.post('/webhook', handleWebhook);

// GET /payments/me - Get my payments
router.get('/me', verifyJWT, getMyPayments);

module.exports = router;


