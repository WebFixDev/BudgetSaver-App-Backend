// src/models/Subscription.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISubscription {
  _id?: Types.ObjectId;
  user: Types.ObjectId; // Back-reference to User
  revenuecatAppUserId: string; // The ID used in RevenueCat
  entitlementId: string; // e.g., 'pro'
  planType: "monthly" | "yearly"; // Strictly only two plans as requested
  status: "active" | "canceled" | "expired" | "past_due";
  startDate: Date;
  expiresDate: Date;
  willRenew: boolean;
  platform: "android" | "ios" | "stripe"; 
}

export type ISubscriptionDocument = ISubscription & Document<Types.ObjectId, any, ISubscription>;

const subscriptionSchema = new Schema<ISubscription, mongoose.Model<ISubscriptionDocument>>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    revenuecatAppUserId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    entitlementId: {
      type: String,
      required: true,
      default: "pro", 
    },
    planType: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "canceled", "expired", "past_due"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: true,
    },
    expiresDate: {
      type: Date,
      required: true,
    },
    willRenew: {
      type: Boolean,
      default: true, 
    },
    platform: {
      type: String,
      enum: ["android", "ios", "stripe"],
      required: true,
    },
  },
  {
    timestamps: true, 
  }
);

// Indexes for faster lookups (since we'll query by user ID or RevenueCat ID often)
subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ revenuecatAppUserId: 1 });

const Subscription = mongoose.model<ISubscription, mongoose.Model<ISubscriptionDocument>>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;