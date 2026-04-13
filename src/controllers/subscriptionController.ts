// src/controllers/subscriptionController.ts
import { Request, Response, NextFunction } from "express";
import Subscription, { ISubscription } from "../models/subscription.model";
import User from "../models/user.model";
import { ObjectId } from "mongodb";
import { ErrorResponse } from "../utils/errorResponse";

// ============================================================================
// 1. REVENUECAT WEBHOOK HANDLER (CORE LOGIC)
// ============================================================================
export const handleRevenueCatWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { event } = req.body;

    // RevenueCat sends a test webhook when you first set it up
    if (event.type === 'TEST') {
      res.status(200).json({ success: true, message: 'Test webhook received' });
      return;
    }

    const appUserId = event.app_user_id; // Yeh aapka MongoDB User ID hona chahiye (jab aap mobile se login karte waqt set karte hain)
    const eventType = event.type; // e.g., INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
    const store = event.store; // play_store, app_store, stripe
    const productId = event.product_id; // e.g., 'budgetsaver_monthly_pro'
    
    // Convert timestamps
    const startDate = new Date(event.purchased_at_ms);
    const expiresDate = new Date(event.expiration_at_ms);

    // Determine platform
    let platform: "android" | "ios" | "stripe" = "android";
    if (store === 'app_store') platform = "ios";
    if (store === 'stripe') platform = "stripe";

    // Determine plan type from product ID (Aap apne product IDs ke hisaab se adjust kar sakte hain)
    const planType: "monthly" | "yearly" = productId.toLowerCase().includes('yearly') ? 'yearly' : 'monthly';

    // Verify User Exists
    const user = await User.findById(appUserId);
    if (!user) {
      console.error(`Webhook Error: User not found for app_user_id: ${appUserId}`);
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        // Create or Update Subscription
        const subscription = await Subscription.findOneAndUpdate(
          { user: user._id }, // Find by user ID
          {
            revenuecatAppUserId: appUserId,
            entitlementId: 'pro', // Ya event.entitlement_ids[0] agar dynamically aa raha ho
            planType,
            status: 'active',
            startDate,
            expiresDate,
            willRenew: true,
            platform,
          },
          { new: true, upsert: true, runValidators: true } // Upsert: Agar nahi hai toh bana do
        );

        // 🔥 Hybrid Approach: Update User Model 🔥
        await User.findByIdAndUpdate(user._id, {
          isPro: true,
          subscriptionId: subscription._id
        });
        break;

      case 'CANCELLATION':
        // User cancelled auto-renewal, BUT access remains until expiresDate
        await Subscription.findOneAndUpdate(
          { user: user._id, status: 'active' },
          { willRenew: false }
        );
        // Note: isPro remains true until EXPIRATION event comes
        break;

      case 'EXPIRATION':
        // Time is up, revoke access
        await Subscription.findOneAndUpdate(
          { user: user._id },
          { status: 'expired', willRenew: false }
        );

        // 🔥 Hybrid Approach: Revoke User Access 🔥
        await User.findByIdAndUpdate(user._id, {
          isPro: false
        });
        break;

      default:
        console.log(`Unhandled RevenueCat event type: ${eventType}`);
        break;
    }

    // Always return 200 OK quickly so RevenueCat knows we received it
    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Webhooks ke liye 500 return karein taake RevenueCat retry kare
    res.status(500).json({ success: false, message: 'Internal server error processing webhook' });
  }
};

// ============================================================================
// 2. GET CURRENT USER SUBSCRIPTION
// ============================================================================
export const getCurrentUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return next(new ErrorResponse('User not authenticated', 401));
    }

    // Get latest active subscription
    const subscription = await Subscription.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();

    if (!subscription) {
      res.status(200).json({
        success: true,
        data: null,
        message: "No active subscription found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 3. GET ALL SUBSCRIPTIONS (ADMIN ONLY)
// ============================================================================
export const getAllSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      planType,
      platform,
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query: any = {};

    // Filters
    if (status && ['active', 'canceled', 'expired', 'past_due'].includes(status as string)) {
      query.status = status;
    }
    if (planType && ['monthly', 'yearly'].includes(planType as string)) {
      query.planType = planType;
    }
    if (platform && ['android', 'ios', 'stripe'].includes(platform as string)) {
      query.platform = platform;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const total = await Subscription.countDocuments(query);

    const subscriptions = await Subscription.find(query)
      .populate('user', 'name email phone') // Fetch user details along with subscription
      .select('-__v')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 4. GET SUBSCRIPTION STATISTICS (ADMIN DASHBOARD)
// ============================================================================
export const getSubscriptionStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statistics = await Subscription.aggregate([
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          activeSubscriptions: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          expiredSubscriptions: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          canceledSubscriptions: { $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] } },
          monthlyPlans: { $sum: { $cond: [{ $eq: ['$planType', 'monthly'] }, 1, 0] } },
          yearlyPlans: { $sum: { $cond: [{ $eq: ['$planType', 'yearly'] }, 1, 0] } },
          androidUsers: { $sum: { $cond: [{ $eq: ['$platform', 'android'] }, 1, 0] } },
          iosUsers: { $sum: { $cond: [{ $eq: ['$platform', 'ios'] }, 1, 0] } },
          // Count users who canceled but are still active (willRenew = false)
          churningSoon: { 
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$status', 'active'] }, { $eq: ['$willRenew', false] }] }, 1, 0
              ] 
            } 
          }
        }
      },
      {
        $project: {
          _id: 0
        }
      }
    ]);

    const stats = statistics[0] || {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      expiredSubscriptions: 0,
      canceledSubscriptions: 0,
      monthlyPlans: 0,
      yearlyPlans: 0,
      androidUsers: 0,
      iosUsers: 0,
      churningSoon: 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};