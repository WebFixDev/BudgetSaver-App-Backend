// src/models/User.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUser {
  _id?: Types.ObjectId; 
  profileImage?: string;
  name: string;
  email: string;
  phone?: string;
  role: "agent" | "admin";
  isActive: boolean;
  address?: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other";
  bio?: string;
  languages?: string[];
  
  // 🔥 NEW: Subscription fields for Hybrid Approach 🔥
  isPro: boolean;
  subscriptionId?: Types.ObjectId; 
}

export type IUserDocument = IUser & Document<Types.ObjectId, any, IUser>;

const userSchema = new Schema<IUser, mongoose.Model<IUserDocument>>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    profileImage: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?\d{10,15}$/, "Please enter a valid phone number"],
    },
    role: {
      type: String,
      enum: ["agent", "admin"],
      default: "agent",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    address: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    bio: { type: String, trim: true },
    
    // 🔥 NEW: Hybrid Schema Implementation 🔥
    isPro: {
      type: Boolean,
      default: false, // Default user is not pro
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription", // Links to the Subscription collection
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser, mongoose.Model<IUserDocument>>("User", userSchema);
export default User;