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

// Create payment intent
router.post('/create-intent', verifyJWT, createPaymentIntent);

// Confirm payment
router.post('/confirm', verifyJWT, confirmPayment);

// Stripe webhook (no auth needed, uses signature)
router.post('/webhook', handleWebhook);

// Get my payments
router.get('/me', verifyJWT, getMyPayments);

// Get payments from users for my contests
router.get('/creator-users', verifyJWT, roleChecker('creator'), getCreatorUserPayments);

// Get all payments (Admin only)
router.get('/', verifyJWT, roleChecker('admin'), getAllPayments);

module.exports = router;


