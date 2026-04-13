// src/routes/subscriptionRoutes.ts
import express from 'express';
import {
  handleRevenueCatWebhook,
  getCurrentUserSubscription,
  getAllSubscriptions,
  getSubscriptionStatistics
} from '../controllers/subscriptionController';
import { verifyTokenMiddleware } from '../middleware/authMiddleware';

const router = express.Router();
router.post('/webhook', handleRevenueCatWebhook);

// ============================================================================
// 🔒 PROTECTED ROUTES (AUTH REQUIRED) 🔒
// Apply token verification for all routes below this line
// ============================================================================
router.use(verifyTokenMiddleware);

// User Route: Get their own subscription status
router.get('/my-subscription', getCurrentUserSubscription);

// Admin Routes: Get all subscriptions and stats
// Note: Agar aapka authorizeRoles jaisa koi middleware hai toh usay yahan lagayein
// e.g., router.get('/all', authorizeRoles('admin'), getAllSubscriptions);
router.get('/all', getAllSubscriptions);
router.get('/stats', getSubscriptionStatistics);

export default router;